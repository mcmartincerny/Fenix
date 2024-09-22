import "./App.css";
import { Game } from "./Game";

function App() {
  return (
    <>
      <Game />
    </>
  );
}

export default App;

window.onbeforeunload = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = "";
  return "Are you sure you want to leave?";
};
