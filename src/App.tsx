import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlanEditor from './components/PlanEditor';
import ExerciseLibrary from './components/ExerciseLibrary';
import LiveWorkout from './components/LiveWorkout';
import HistoryView from './components/History';
import HistoryDetail from './components/HistoryDetail';
import ProgressView from './components/ProgressView';
import Help from './components/Help';
import NativeBackHandler from './components/NativeBackHandler';
import WorkoutStartEditor from './components/WorkoutStartEditor';

function App() {
  return (
    <BrowserRouter>
      <NativeBackHandler />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="cviky" element={<ExerciseLibrary />} />
          <Route path="historia" element={<HistoryView />} />
          <Route path="progres" element={<ProgressView />} />
          <Route path="help" element={<Help />} />
        </Route>
        <Route path="historia/:id" element={<HistoryDetail />} />
        <Route path="start/:id" element={<WorkoutStartEditor />} />
        <Route path="editor/:id" element={<PlanEditor />} />
        <Route path="/trening/:id" element={<LiveWorkout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
