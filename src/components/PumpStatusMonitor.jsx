import { useEffect, useRef, useState, useCallback } from "react";
import AWS from "aws-sdk";
import mqtt from "mqtt";
import { AWS_REGION, IDENTITY_POOL } from "../constants";
import { createSignedUrl } from "./createSignedUrl";
import { formatDateTime } from "./timeformate";

export default function PumpStatusMonitor() {
  const [status, setStatus] = useState("Connecting...");
  const [pumpMessage, setPumpMessage] = useState("");
  const [disconnectEvents, setDisconnectEvents] = useState([]);
  const [connectionState, setConnectionState] = useState("disconnected");

  const clientRef = useRef(null);
  const disconnectTimeRef = useRef(null);
  const refreshInProgressRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const networkListenersAttached = useRef(false);
  
  const topic = "pump/status";
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 3000; // 3 seconds

  // Memoized network handlers to ensure same reference for cleanup
  const handleNetworkOnline = useCallback(() => {
    console.log("🌐 Network Online. Checking client status...");
    if (connectionState !== "connected" && !refreshInProgressRef.current) {
      reconnectAttempts.current = 0; // Reset attempts on network recovery
      attemptCredentialRefreshAndReconnect();
    }
  }, [connectionState]);

  const handleNetworkOffline = useCallback(() => {
    console.warn("🚫 Network Offline");
    setStatus("🚫 Network Offline");
    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    // Step 1: Set AWS credentials
    AWS.config.region = AWS_REGION;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: IDENTITY_POOL,
    });

    // Fetch initial credentials and start connection
    AWS.config.credentials.get((err) => {
      if (err) {
        console.error("❌ Cognito Credentials Error:", err);
        setStatus("❌ Cognito Error!");
        setConnectionState("error");
        return;
      }

      setupConnection(AWS.config.credentials);
    });

    // Cleanup on component unmount
    return () => {
      // console.log("🧹 Cleaning up PumpStatusMonitor...");
      
      // Clear any pending reconnect timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Clean up MQTT client
      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
      
      // Clean up network listeners
      if (networkListenersAttached.current) {
        window.removeEventListener("online", handleNetworkOnline);
        window.removeEventListener("offline", handleNetworkOffline);
        networkListenersAttached.current = false;
      }
      
      // Reset refs
      refreshInProgressRef.current = false;
      reconnectAttempts.current = 0;
    };
  }, [handleNetworkOnline, handleNetworkOffline]);

  const setupConnection = (credentials) => {
    try {
      const signedUrl = createSignedUrl(credentials);
      console.log("🔗 Setting up MQTT connection...");
      
      setConnectionState("connecting");
      
      const client = mqtt.connect(signedUrl, {
        clientId: "mqtt-client-" + Math.floor(Math.random() * 100000),
        keepalive: 60,
        reconnectPeriod: 0, // Disable automatic reconnection, we'll handle it manually
        connectTimeout: 30000, // 30 second timeout - CRITICAL FIX
        clean: true,
        will: {
          topic: 'client/disconnect',
          payload: 'Client disconnected unexpectedly',
          qos: 1,
          retain: false
        },
        // Additional WebSocket specific options for AWS IoT
        transformWsUrl: (url, options, client) => {
          console.log("🔧 WebSocket URL:", url);
          return url;
        }
      });

      clientRef.current = client;

      client.on("connect", (connack) => {
        console.log("✅ Connected to AWS IoT", connack);
        setStatus("✅ Connected!");
        setConnectionState("connected");
        reconnectAttempts.current = 0; // Reset attempts on successful connection
        
        client.subscribe(topic, (err) => {
          if (err) {
            console.error("❌ Subscription error:", err);
          } else {
            console.log(`📡 Subscribed to ${topic}`);
          }
        });

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
            ...prev.slice(0, 9), // Keep only last 10 events
          ]);

          disconnectTimeRef.current = null;
        }
      });

      client.on("message", (_topic, message) => {
        console.log("📨 Message received:", message.toString());
        setPumpMessage(message.toString());
      });

      client.on("error", (err) => {
        console.error("❌ MQTT Error:", err);
        setConnectionState("error");
        
        if (err?.message?.includes("403")) {
          console.warn("🔑 Credentials likely expired, attempting refresh...");
          setStatus("🔑 Refreshing credentials...");
          attemptCredentialRefreshAndReconnect();
        } else if (err?.message?.includes("timeout")) {
          console.warn("⏰ Connection timeout, will retry...");
          setStatus("⏰ Connection timeout, retrying...");
          scheduleReconnect();
        } else {
          setStatus(`❌ MQTT Error: ${err.message || 'Unknown error'}`);
          scheduleReconnect();
        }
      });

      client.on("close", () => {
        console.warn("🔌 Disconnected from AWS IoT");
        setStatus("🔌 Disconnected");
        setConnectionState("disconnected");
        
        if (!disconnectTimeRef.current) {
          disconnectTimeRef.current = new Date();
        }
        
        scheduleReconnect();
      });

      client.on("reconnect", () => {
        console.log("🔁 MQTT client attempting reconnect...");
        setStatus("🔁 Reconnecting...");
        setConnectionState("connecting");
      });

      client.on("offline", () => {
        console.warn("📴 MQTT client is offline");
        setStatus("📴 Client Offline");
        setConnectionState("disconnected");
      });

      // Add network listeners only once
      if (!networkListenersAttached.current) {
        window.addEventListener("online", handleNetworkOnline);
        window.addEventListener("offline", handleNetworkOffline);
        networkListenersAttached.current = true;
      }

    } catch (error) {
      console.error("❌ Failed to setup connection:", error);
      setStatus("❌ Connection Setup Failed");
      setConnectionState("error");
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    // Don't schedule if we're already trying to reconnect or at max attempts
    if (refreshInProgressRef.current || reconnectAttempts.current >= maxReconnectAttempts) {
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setStatus(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached`);
        setConnectionState("error");
      }
      return;
    }

    // Don't schedule if network is offline
    if (!navigator.onLine) {
      console.log("⚠️ Offline, will retry when network comes back online");
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts.current - 1), 30000);
    
    console.log(`⏱️ Scheduling reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms`);
    setStatus(`🔄 Reconnecting in ${Math.round(delay/1000)}s... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      attemptCredentialRefreshAndReconnect();
    }, delay);
  };

  const attemptCredentialRefreshAndReconnect = () => {
    const now = Date.now();

    // Avoid duplicate refreshes
    if (refreshInProgressRef.current) {
      console.log("🔄 Refresh already in progress, skipping...");
      return;
    }

    // Don't attempt if network is offline
    if (!navigator.onLine) {
      console.log("⚠️ Offline, can't refresh credentials yet.");
      setStatus("🚫 Offline - waiting for network...");
      return;
    }

    // Check if we've exceeded max attempts
    if (reconnectAttempts.current > maxReconnectAttempts) {
      console.log("❌ Max reconnection attempts exceeded");
      setStatus("❌ Connection failed - please refresh page");
      setConnectionState("error");
      return;
    }

    refreshInProgressRef.current = true;
    console.log("🔄 Refreshing AWS credentials...");
    setStatus("🔄 Refreshing credentials...");
    setConnectionState("connecting");

    AWS.config.credentials.refresh((err) => {
      refreshInProgressRef.current = false;
      
      if (err) {
        console.error("❌ Credential refresh failed:", err);
        setStatus("❌ Credential Refresh Failed");
        setConnectionState("error");
        scheduleReconnect();
        return;
      }

      console.log("✅ Credentials refreshed successfully.");
      lastRefreshTimeRef.current = Date.now();

      // Close existing client properly
      if (clientRef.current) {
        try {
          clientRef.current.end(true);
          clientRef.current.removeAllListeners();
        } catch (closeError) {
          console.warn("⚠️ Error closing existing client:", closeError);
        }
        clientRef.current = null;
      }

      // Clear any pending timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Reconnect with new credentials
      setTimeout(() => {
        setupConnection(AWS.config.credentials);
      }, 1000); // Small delay to ensure cleanup is complete
    });
  };

  // Manual reconnect function for UI button
  const handleManualReconnect = () => {
    console.log("🔄 Manual reconnect requested");
    reconnectAttempts.current = 0; // Reset attempts for manual reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    attemptCredentialRefreshAndReconnect();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-100 text-center p-6">
      <h1 className="text-3xl font-bold text-blue-700 mb-4">
        Pump Status Monitor
      </h1>

      <div className="text-xl font-medium text-gray-700 mb-2">{status}</div>
      
      {/* Connection state indicator */}
      <div className="flex items-center mb-4">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          connectionState === 'connected' ? 'bg-green-500' : 
          connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
          'bg-red-500'
        }`}></div>
        <span className="text-sm text-gray-600 capitalize">{connectionState}</span>
      </div>

      {/* Manual reconnect button */}
      {(connectionState === 'error' || connectionState === 'disconnected') && (
        <button 
          onClick={handleManualReconnect}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={refreshInProgressRef.current}
        >
          {refreshInProgressRef.current ? 'Connecting...' : 'Reconnect Now'}
        </button>
      )}

      {pumpMessage && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow text-2xl font-semibold text-green-600">
          Pump Status: {pumpMessage}
        </div>
      )}

      {disconnectEvents.length > 0 && (
        <div className="mt-8 w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Recent Disconnections ({disconnectEvents.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
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
        </div>
      )}
    </div>
  );
}