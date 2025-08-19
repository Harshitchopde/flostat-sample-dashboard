import * as AWS from "aws-sdk";
import mqtt from "mqtt";
import store from "../store";

import {
  setStatus,
  setPumpMessage,
  addDisconnectEvent,
  setError,
  setDevicesStatus,
} from "../slice/webSocketSlice";

import {
  AWS_REGION,
  IDENTITY_POOL,
  DEFAULT_TOPICS,
  BASE_RECONNECT_MS,
  MAX_RECONNECT_MS,
  KEEPALIVE_SEC,
  REFRESH_COOLDOWN_MS,
} from "../constants";

import { createSignedUrl } from "./createSignedUrl";

// --- Module-singleton state ---
let client = null;
let subscribedTopics = new Set([...DEFAULT_TOPICS]);
let disconnectStartedAt = null;
let refreshInProgress = false;
let lastRefreshAt = 0;
let forcedClose = false;

// backoff
let reconnectAttempts = 0;
function nextBackoffMs() {
  const exp = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * 2 ** reconnectAttempts);
  const jitter = Math.floor(Math.random() * (exp * 0.3)); // +/- 30% jitter
  return Math.max(BASE_RECONNECT_MS, exp - jitter);
}

function resetBackoff() {
  reconnectAttempts = 0;
}

// --- Public API ---
export function startWebSocket() {
  if (client?.connected || client?.reconnecting) return;
  forcedClose = false;
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  connectInitial();
}

export function stopWebSocket() {
  forcedClose = true;
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
  safeEndClient();
  store.dispatch(setStatus("disconnected"));
}

export function publish(topic, payload, opts = {}) {
  if (!client || !client.connected) throw new Error("MQTT not connected");
  client.publish(topic, typeof payload === "string" ? payload : JSON.stringify(payload), opts);
}

export function subscribe(topic) {
  subscribedTopics.add(topic);
  if (client?.connected) client.subscribe(topic);
}

export function unsubscribe(topic) {
  subscribedTopics.delete(topic);
  if (client?.connected) client.unsubscribe(topic);
}
export function unsubscribeAll (){
  if(client?.connected){
    for(const topic of subscribedTopics){
        client.unsubscribe(topic);
    }
  }
  subscribedTopics.clear() // reset the topics
}

// --- Connection flow ---
function connectInitial() {
  store.dispatch(setStatus("connecting"));

  AWS.config.update({
    region: AWS_REGION,
    credentials: new AWS.CognitoIdentityCredentials({ IdentityPoolId: IDENTITY_POOL }),
  });

  AWS.config.credentials.get((err) => {
    if (err) {
      store.dispatch(setError(`Cognito Error: ${err.message}`));
      scheduleReconnect(); // will retry with backoff
      return;
    }
    openMqttWithCurrentCreds();
  });
}

function openMqttWithCurrentCreds() {
  if (!AWS.config.credentials || !AWS.config.credentials.accessKeyId) {
    store.dispatch(setError("Missing AWS credentials"));
    scheduleReconnect();
    return;
  }

  const url = createSignedUrl(AWS.config.credentials);

  // IMPORTANT: let mqtt.js handle socket reconnects,
  // but we control credential refreshes to avoid thrash.
  client = mqtt.connect(url, {
    clientId: `mqtt-client-${Math.floor(Math.random() * 1e9)}`,
    keepalive: KEEPALIVE_SEC,
    reconnectPeriod: 0, // we'll handle reconnect/backoff ourselves
    clean: true,
  });

  wireClientEvents();
}

function wireClientEvents() {
  if (!client) return;

  client.on("connect", () => {
    resetBackoff();
    store.dispatch(setStatus("connected"));
    console.log("✅ Connected to AWS IoT");
    client.subscribe("pump/status")
    // (Re)subscribe to topics
    if (subscribedTopics.size) {
      client.subscribe(Array.from(subscribedTopics));
    }

    // record downtime if any
    if (disconnectStartedAt) {
      const seconds = Math.round((Date.now() - disconnectStartedAt) / 1000);
      store.dispatch(
        addDisconnectEvent({
          disconnectTime: new Date(disconnectStartedAt).toISOString(),
          duration: seconds,
        })
      );
      disconnectStartedAt = null;
    }
  });

  client.on("message", (topic, message) => {
    // Application-specific handling
    store.dispatch(setPumpMessage(message.toString()));
      try {
      const deviceDetail = JSON.parse(message.toString());
      const device = Object.keys(deviceDetail)[0];
      const status = deviceDetail[device];
      // console.log("d ",device+" status "+status)
      store.dispatch(setDevicesStatus({device,status}))
    } catch (e) {
      console.error("Invalid JSON:", e);
    }
  });

  client.on("error", (err) => {
    console.error("❌ MQTT Error:", err?.message || err);
    // Detect expired/invalid creds -> 403 during handshake
    if (String(err?.message || "").includes("403")) {
      credentialRefreshAndReconnect("403");
      return;
    }
    // For other errors during an active connection, try reconnect with backoff
    scheduleReconnect();
  });

  client.on("close", () => {
    // If we intentionally called stop, do nothing.
    if (forcedClose) return;

    if (!disconnectStartedAt) disconnectStartedAt = Date.now();
    store.dispatch(setStatus("disconnected"));

    // If browser is offline, just wait for 'online' event.
    if (!navigator.onLine) {
      console.warn("🔌 Offline detected, waiting for network...");
      return;
    }

    // If close happens soon after connect during handshake, it might be 403
    // but mqtt.js sometimes emits `error` separately. If we didn't see 403,
    // fall back to normal reconnect with backoff.
    scheduleReconnect();
  });
}

function safeEndClient() {
  try {
    if (client) {
      client.removeAllListeners?.();
      client.end?.(true);
    }
  } catch (_) {}
  client = null;
}

// --- Reconnect / Backoff ---
let reconnectTimer = null;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (forcedClose) return;

  clearReconnectTimer();
  const delay = nextBackoffMs();
  reconnectAttempts += 1;

  console.warn(`🔁 Reconnecting in ${delay} ms (attempt ${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => {
    clearReconnectTimer();
    // If offline, wait; online handler will connect.
    if (!navigator.onLine) return;
    safeEndClient();
    // Instead of directly reconnecting, try refreshing credentials first
    const now = Date.now();
    const credsExist = AWS.config.credentials && AWS.config.credentials.accessKeyId;
    const credsExpiredSoon =
      credsExist &&
      AWS.config.credentials.expireTime &&
      AWS.config.credentials.expireTime.getTime() - now < 60_000; // less than 1 min left
    console.warn("schedule: ",credsExpiredSoon,credsExist)
    console.warn("Expire time: ",AWS.config.credentials.expireTime.getTime() - now )
    if (!credsExist || credsExpiredSoon) {
      console.warn("🔄 Credentials missing/expiring soon, refreshing before reconnect...");
      credentialRefreshAndReconnect("expire cred");
    } else {
      openMqttWithCurrentCreds();
    }
  }, delay);
}

// --- Credential refresh (cooldown + race-safe) ---
function credentialRefreshAndReconnect(reason = "unknown") {
  const now = Date.now();
  if (refreshInProgress) {
    console.warn("⏳ Credential refresh already in progress...");
    return;
  }
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    console.warn("🧊 Skipping credential refresh (cooldown).");
    scheduleReconnect();
    return;
  }

  refreshInProgress = true;
  console.warn(`🔄 Refreshing AWS credentials (reason: ${reason})...`);

  AWS.config.credentials.refresh((err) => {
    refreshInProgress = false;
    if (err) {
      store.dispatch(setError(`Credential Refresh Failed: ${err.message}`));
      lastRefreshAt = now; // still set so we don't tight-loop
      scheduleReconnect();
      return;
    }

    lastRefreshAt = Date.now();

    // Tear down any old client and reconnect with fresh signed URL
    clearReconnectTimer();
    safeEndClient();
    openMqttWithCurrentCreds();
  });
}

// --- Browser network events ---
function onOnline() {
  console.log("🌐 Browser online");
  if (forcedClose) return;
  if (client?.connected) return;
  // try immediate reconnect
  safeEndClient();
  openMqttWithCurrentCreds();
}

function onOffline() {
  console.warn("📴 Browser offline");
  // keep state as disconnected; reconnect will happen on 'online'
}
