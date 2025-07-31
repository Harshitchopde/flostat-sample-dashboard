
import './App.css';
import ControlPanel from './components/ControlPanel';
import PumpStatusMonitor from './components/PumpStatusMonitor';



function App() {
  return (
    <div className="App flex w-full h-[100vh] items-center justify-center border border-blue-500">
      <PumpStatusMonitor/>
    </div>
  );
}

export default App;
