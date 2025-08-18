
import axios from "axios";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AWS_REGION, BASE_URL_LAMBDA } from "../constants";
import {  resetWebSocket, setDevices, setTopics } from "../slice/webSocketSlice";
import { unsubscribeAll } from "./webSocketService2";


export default function PumpStatusMonitor() {
  const { status,devices,deviceStatus, pumpMessage,disconnectEvents,error } = useSelector(state=> state.websocket)
  const [org_id,setOrg_id] = useState("")
  const dispatch = useDispatch();
  // console.log("BS: ",deviceStatus)
  // console.log("dd", deviceStatus,devices,org_id)
  const handleSubmitOrg = async(e)=>{
    e.preventDefault();
    try {
      // console.log("BS: ",BASE_URL_LAMBDA)
      unsubscribeAll();// first unsubscribe
      dispatch(resetWebSocket()); // then reset data
      const res = await axios.get(BASE_URL_LAMBDA+"?service=get_org_topic&org_id="+org_id)
      // console.log("res: ",res);
      if(res.data?.success ===true){
        const {topics,devices} = res.data;
        dispatch(setTopics(topics));
        dispatch(setDevices(devices));
      }
    } catch (error) {
      console.log("Error ",error)
    }

  }
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-gray-100 p-6 shadow">
        <h1 className="text-3xl font-bold text-blue-700 mb-2 text-center">
          Pump Status Monitor
        </h1>

        {/* <div className="text-xl font-medium text-gray-700 mb-2 text-center">
          {status}
        </div> */}

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

      {/* Devices List */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((d) => (
          <div
            key={d}
            className="p-4 bg-white rounded-xl shadow flex justify-between items-center"
          >
            <div>
              <div className="font-bold text-lg">{d}</div>
            </div>
            <div
              className={`font-semibold px-3 py-1 rounded ${
                deviceStatus[d]
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {deviceStatus[d] || "Unknown"}
            </div>
          </div>
        ))}
      </div>


      </div>


    </div>
  );
}
