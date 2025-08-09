import { useEffect, useRef, useState } from "react";
import AWS from "aws-sdk";
import mqtt from "mqtt";
import { AWS_REGION, IDENTITY_POOL } from "../constants";
import { createSignedUrl } from "./createSignedUrl2";
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
    AWS.config.region = AWS_REGION;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: IDENTITY_POOL,
    });
    AWS.config.credentials.get((err) => {
      if (err) {
        console.error("❌ Cognito Credentials Error:", err);
        setStatus("❌ Cognito Error!");
        return;
      }
      setupConnection(AWS.config.credentials);
    });

    const setupConnection = (credentials) => {
      const signedUrl = createSignedUrl(credentials);
      const client = mqtt.connect(signedUrl, {
        clientId: "mqtt-client-" + Math.floor(Math.random() * 100000),
        keepalive: 60,
        reconnectPeriod: 5000,
        // clean: true,
        // connectTimeout: 30000,
      });
      clientRef.current = client;

      client.on("connect", () => {
        console.log("✅ Connected to AWS IoT");
        setStatus("✅ Connected!");
        client.subscribe(topic);
        if (disconnectTimeRef.current) {
          const reconnectTime = new Date();
          const downtime = Math.round(
            (reconnectTime - lastRefreshTimeRef.current) / 1000
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
        // console.log("2.message")
        setPumpMessage(message.toString());
      });
      client.on("error", (err) => {
        // console.log("3.Error: -> ",err)
        console.error("❌ MQTT Error:", err);
        if (err?.message?.includes("403")) {
          console.warn("🔑 Credentials likely expired, attempting refresh...");
          // attemptCredentialRefreshAndReconnect(); //1
        } else {
          setStatus("❌ MQTT Error!");
        }
      });
      client.on("close", () => {
        if (!client.connected && !refreshInProgressRef.current) {
          const now = Date.now();
        //   if (now - lastRefreshTimeRef.current >= 60000) {
            console.warn(
              "🔌 Disconnected from AWS IoT, attempting credential refresh..."
            );
            // adfad
            setStatus("🔌 Disconnected");

            disconnectTimeRef.current = new Date();

            attemptCredentialRefreshAndReconnect();
          } else {
            console.warn("🔁 Cooldown active, skipping credential refresh.");
          }
        // } else {
        //   console.warn(
        //     "ℹ️ MQTT client still considered connected or refresh already in progress."
        //   );
        // }
      });

      console.log("client : ", client);
      client.on("reconnect", () => {
        console.log("t: ", client);
        console.log("5.reconnect");
      });
    };

    const attemptCredentialRefreshAndReconnect = () => {
    const now = Date.now();
    // avoid duplicate refreshes
    if (refreshInProgressRef.current) return;

    // cooldown
    if (now - lastRefreshTimeRef.current < 60000) return;
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
      setupConnection(AWS.config.credentials);
    });
  };
  const handleOnline = () => {
      console.log("ONline wala code ");
      if (!clientRef.current?.connected) {
        attemptCredentialRefreshAndReconnect();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current = null;
      }
      window.removeEventListener("online", handleOnline);
    };
  }, []);


  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-gray-100 p-6 shadow">
        <h1 className="text-3xl font-bold text-blue-700 mb-2 text-center">
          Pump Status Monitor
        </h1>

        <div className="text-xl font-medium text-gray-700 mb-2 text-center">
          {status}
        </div>

        {pumpMessage && (
          <div className="mt-2 p-4 bg-white rounded-lg shadow text-2xl font-semibold text-green-600 text-center">
            Pump Status: {pumpMessage}
          </div>
        )}
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
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
    </div>
  );
}
