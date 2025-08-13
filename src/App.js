
import { useEffect } from 'react';
import './App.css';
import PumpStatusMonitor from './components/PumpStatusMonitor';
import { startWebSocket } from './components/webSocketService';



function App() {
  useEffect(()=>{
    startWebSocket();
  },[])
  return (
    <div className="App flex w-full h-[100vh] items-center justify-center border border-blue-500">
      <PumpStatusMonitor/>
    </div>
  );
}

export default App;
