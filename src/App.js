
import { useEffect } from 'react';
import './App.css';
import PumpStatusMonitor from './components/PumpStatusMonitor';
import { startWebSocket , subscribe,stopWebSocket} from './components/webSocketService2';



function App() {
  if(Notification.permission==="default"){
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("✅ Notification permission granted");
      } else {
        console.warn("🚫 Notification permission denied");
      }
    });
  }
  useEffect(()=>{
    startWebSocket();
    subscribe("pump/status");

    return () => {
      stopWebSocket();
    };
  },[])
  return (
    <div className="App flex w-full h-[100vh] items-center justify-center border border-blue-500">
      <PumpStatusMonitor/>
    </div>
  );
}

export default App;
