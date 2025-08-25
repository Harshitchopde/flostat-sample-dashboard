import axios from "axios";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { BASE_URL_LAMBDA } from "../constants";
import { resetWebSocket, setDevices, setTopics } from "../slice/webSocketSlice";
import { unsubscribeAll } from "./webSocketService2";

export default function PumpStatusMonitor() {
  const { status, devices, deviceStatus } = useSelector(
    (state) => state.websocket
  );

  const [org_id, setOrg_id] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState("all");

  const dispatch = useDispatch();

  const handleSubmitOrg = async (e) => {
    e.preventDefault();
    try {
      unsubscribeAll(); // first unsubscribe
      dispatch(resetWebSocket()); // then reset data

      const res = await axios.get(
        BASE_URL_LAMBDA + "?service=get_org_topic&org_id=" + org_id
      );

      if (res.data?.success === true) {
        const { topics, devices, blocks } = res.data;
        dispatch(setTopics(topics));
        dispatch(setDevices(devices));
        setBlocks(blocks);
        setSelectedBlock("all");
      }
    } catch (error) {
      console.log("Error ", error);
    }
  };

  // Filtering devices by selected block
  const filteredDevices =
    selectedBlock === "all"
      ? devices
      : devices.filter((d) =>
          Array.isArray(d.block_id)
            ? d.block_id.includes(selectedBlock)
            : d.block_id === selectedBlock
        );

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

        {/* Input form */}
        <form onSubmit={handleSubmitOrg} className="flex space-x-4">
          <input
            type="text"
            value={org_id}
            onChange={(e) => setOrg_id(e.target.value)}
            placeholder="Enter Org ID"
            className="border rounded-lg px-4 py-2 w-64"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Load Devices
          </button>
        </form>

        {/* Dropdown for Blocks */}
        {blocks.length > 0 && (
          <div className="mt-4">
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="border px-4 py-2 rounded-lg"
            >
              <option value="all">All Blocks</option>
              {blocks.map((b) => (
                <option key={b} value={b}>
                  Block {b.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Devices List */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((d) => (
            <div
              key={d.device_Id}
              className="p-4 bg-white rounded-xl shadow flex justify-between items-center"
            >
              <div>
                <div className="font-bold text-lg">{d.device_Id}</div>
                <div className="text-sm text-gray-500">
                  Block:{" "}
                  {Array.isArray(d.block_id)
                    ? d.block_id.join(", ")
                    : d.block_id}
                </div>
              </div>
              <div
                className={`font-semibold px-3 py-1 rounded ${
                  deviceStatus[d.device_Id]
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {deviceStatus[d.device_Id] || "Unknown"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
