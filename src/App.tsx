import SimulatorWorkspace from "./SimulatorWorkspace";
import ExamPortal from "./ExamPortal";
import PracticePortal from "./PracticePortal";
export default function App() {
  return <SimulatorWorkspace AccountPortal={ExamPortal} PracticePortal={PracticePortal} />;
}
