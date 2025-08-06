
import './App.css';
import PumpStatusMonitor from './components/try/PumpStatusMonitor2';
// import PumpStatusMonitor from './components/PumpStatusMonitor';



function App() {
  return (
    <div className="App flex w-full h-[100vh] items-center justify-center border border-blue-500">
      <PumpStatusMonitor/>
      {/* <PumpStatusMonitor/> */}
    </div>
  );
}

export default App;
