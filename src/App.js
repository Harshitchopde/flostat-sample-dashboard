
import './App.css';
// import PumpStatusMonitor from './components/PumpStatusMonitor2';
// import PumpStatusMonitor from './components/PumpStatusMonitor';
import PumpStatusMonitor from './components/PumpStatusMonitor3';



function App() {
  return (
    <div className="App flex w-full h-[100vh] items-center justify-center border border-blue-500">
      <PumpStatusMonitor/>
      {/* <PumpStatusMonitor/> */}
    </div>
  );
}

export default App;
