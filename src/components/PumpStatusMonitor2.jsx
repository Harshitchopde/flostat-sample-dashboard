import { useEffect, useRef, useState } from "react";
import AWS from "aws-sdk";
import mqtt from "mqtt";
import { AWS_REGION, IDENTITY_POOL } from "../constants";
import { createSignedUrl } from "./createSignedUrl";
import { formatDateTime } from "./timeformate";

export default function PumpStatusMonitor() {
  const [status, setStatus] = useState("Connecting...");
  const [pumpMessage, setPumpMessage] = useState("");
  const [disconnectEvents, setDisconnectEvents] = useState([]);

  const clientRef = useRef(null);
  const disconnectTimeRef = useRef(null);
  const refreshInProgressRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const topic = "pump/status";

  useEffect(() => {
    // Step 1: Set AWS credentials
    AWS.config.region = AWS_REGION;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: IDENTITY_POOL,
    });
// dadsfas
    // Fetch initial credentials and start connection
    AWS.config.credentials.get((err) => {
      if (err) {
        console.error("❌ Cognito Credentials Error:", err);
        setStatus("❌ Cognito Error!");
        return;
      }

      setupConnection(AWS.config.credentials);
    });

    // Cleanup on component unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current.removeAllListeners();
      }
    };
  }, []);

  const setupConnection = (credentials) => {
    const signedUrl = createSignedUrl(credentials);

    const client = mqtt.connect(signedUrl, {
      clientId: "mqtt-client-" + Math.floor(Math.random() * 100000),
      keepalive: 60,
      reconnectPeriod: 3000, // Try reconnect every 3s
      clean: true,
      connectTimeout:30000
    });

    clientRef.current = client;

    client.on("connect", () => {
      console.log("✅ Connected to AWS IoT");
      setStatus("✅ Connected!");
      client.subscribe(topic);

      // If reconnecting after disconnection, calculate downtime
      if (disconnectTimeRef.current) {
        const reconnectTime = new Date();
        const downtime = Math.round(
          (reconnectTime - disconnectTimeRef.current) / 1000
        );

        const formattedTime = formatDateTime(disconnectTimeRef.current);

        setDisconnectEvents((prev) => [
          {
            disconnectTime: formattedTime,
            duration: downtime,
          },
          ...prev,
        ]);

        disconnectTimeRef.current = null;
      }
    });

    client.on("message", (_topic, message) => {
      setPumpMessage(message.toString());
    });

    client.on("error", (err) => {
      console.error("❌ MQTT Error:", err);
      if (err?.message?.includes("403")) {
        console.warn("🔑 Credentials likely expired, attempting refresh...");
        attemptCredentialRefreshAndReconnect();
      } else {
        setStatus("❌ MQTT Error!");
      }
    });

    client.on("close", () => {
      console.warn("🔌 Disconnected from AWS IoT");
      setStatus("🔌 Disconnected");
      disconnectTimeRef.current = new Date();
      attemptCredentialRefreshAndReconnect();
    });

    client.on("reconnect", () => {
      console.log("🔁 Attempting Reconnect...");
    });

    // Monitor online/offline state
    window.addEventListener("online", handleNetworkOnline);
    window.addEventListener("offline", handleNetworkOffline);
  };

  const handleNetworkOnline = () => {
    console.log("🌐 Network Online. Checking client status...");
    if (!clientRef.current?.connected) {
      // If not connected, try to refresh credentials and reconnect
      attemptCredentialRefreshAndReconnect();
    }
  };

  const handleNetworkOffline = () => {
    console.warn("🚫 Network Offline");
    setStatus("🚫 Network Offline");
  };

  const attemptCredentialRefreshAndReconnect = () => {
    const now = Date.now();

    // Avoid duplicate refreshes
    if (refreshInProgressRef.current) return;

    // Cooldown to avoid too many refreshes
    if (now - lastRefreshTimeRef.current < 60000) return;

    // if (!navigator.onLine) {
    //   console.log("⚠️ Offline, can't refresh credentials yet.");
    //   return;
    // }

    refreshInProgressRef.current = true;
    console.log("🔄 Refreshing AWS credentials...");

    AWS.config.credentials.refresh((err) => {
      if (err) {
        console.error("❌ Credential refresh failed:", err);
        setStatus("❌ Credential Refresh Failed");
        refreshInProgressRef.current = false;
        return;
      }

      console.log("✅ Credentials refreshed successfully.");
      lastRefreshTimeRef.current = Date.now();
      refreshInProgressRef.current = false;

      // Close existing client
      if (clientRef.current) {
          clientRef.current.removeAllListeners();
        clientRef.current.end(true);
        clientRef.current = null;
      }

      // Reconnect with new credentials
      setupConnection(AWS.config.credentials);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-100 text-center p-6">
      <h1 className="text-3xl font-bold text-blue-700 mb-4">
        Pump Status Monitor
      </h1>

      <div className="text-xl font-medium text-gray-700 mb-2">{status}</div>

      {pumpMessage && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow text-2xl font-semibold text-green-600">
          Pump Status: {pumpMessage}
        </div>
      )}

      {disconnectEvents.length > 0 && (
        <div className="mt-8 w-full max-w-2xl grid grid-cols-1 gap-4">
          {disconnectEvents.map((event, index) => (
            <div
              key={index}
              className="bg-white shadow-md rounded-xl p-4 flex flex-col items-start"
            >
              <div className="text-lg font-bold text-red-600">
                🔌 Disconnected At:
              </div>
              <div className="text-gray-800 text-lg mb-2">
                {event.disconnectTime}
              </div>
              <div className="text-blue-600 text-lg font-semibold">
                Duration: {event.duration} sec
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
