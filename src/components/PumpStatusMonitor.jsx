
import { useSelector } from "react-redux";


export default function PumpStatusMonitor() {
  const { status, pumpMessage,disconnectEvents,error } = useSelector(state=> state.websocket)

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
