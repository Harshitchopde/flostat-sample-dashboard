import * as AWS from "aws-sdk";
import mqtt from "mqtt";
import store from "../store";
import {
  setStatus,
  setPumpMessage,
  addDisconnectEvent,
  setError,
} from "../slice/webSocketSlice";
import { AWS_REGION, IDENTITY_POOL } from "../constants";
import { createSignedUrl } from "./createSignedUrl";

let client = null;
let disconnectTime = null;
let refreshInProgress = false;
let lastRefreshTime = 0;
const topic = "pump/status";
const reconnectDelay = 5000; // retry every 5 sec

export function startWebSocket() {
//   if (client) return; // already running

  connectToAWS();
  window.addEventListener("online", handleOnline);
}

function connectToAWS() {
  store.dispatch(setStatus("connecting"));

  AWS.config.region = AWS_REGION;
  console.log("IPOOL ",IDENTITY_POOL)
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: IDENTITY_POOL,
  });

  AWS.config.credentials.get((err) => {
    if (err) {
        console.log("cred error ",err)
      store.dispatch(setError(`Cognito Error: ${err.message}`));
      store.dispatch(setStatus("error"));
      retryConnect();
      return;
    }
    setupConnection(AWS.config.credentials);
  });
}

function setupConnection(credentials) {
  const signedUrl = createSignedUrl(credentials);
    console.log("Signed url : ",signedUrl)
  client = mqtt.connect(signedUrl, {
    clientId: "mqtt-client-" + Math.floor(Math.random() * 100000),
    keepalive: 60,
    reconnectPeriod: reconnectDelay,
  });

  client.on("connect", () => {
    store.dispatch(setStatus("connected"));
    client.subscribe(topic);

    if (disconnectTime) {
      const downtime = Math.round((Date.now() - lastRefreshTime) / 1000);
      store.dispatch(
        addDisconnectEvent({ disconnectTime, duration: downtime })
      );
      disconnectTime = null;
    }
  });

  client.on("message", (_topic, message) => {
    store.dispatch(setPumpMessage(message.toString()));
  });

  client.on("error", (err) => {
    store.dispatch(setError(`MQTT Error: ${err.message}`));
    if (err?.message?.includes("403")) {
      attemptCredentialRefreshAndReconnect();
    }
  });

  client.on("close", () => {
    store.dispatch(setStatus("disconnected"));
    disconnectTime = new Date();
  });
}

function retryConnect() {
  setTimeout(() => {
    connectToAWS();
  }, reconnectDelay);
}

function attemptCredentialRefreshAndReconnect() {
  const now = Date.now();
  if (refreshInProgress) return;
  if (now - lastRefreshTime < 60000) return;

  refreshInProgress = true;
  AWS.config.credentials.refresh((err) => {
    refreshInProgress = false;
    if (err) {
      store.dispatch(setError(`Credential Refresh Failed: ${err.message}`));
      store.dispatch(setStatus("error"));
      retryConnect();
      return;
    }
    lastRefreshTime = Date.now();

    if (client) {
      client.removeAllListeners();
      client.end(true);
      client = null;
    }
    setupConnection(AWS.config.credentials);
  });
}
function handleOnline() {
  if (!client?.connected) {
    connectToAWS();
  }
}

export function stopWebSocket() {
  if (client) {
    client.end(true);
    client = null;
  }
  window.removeEventListener("online", handleOnline);
}
