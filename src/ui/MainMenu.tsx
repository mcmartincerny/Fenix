import { useEffect, useState } from "react";
import { MenuContent, MenuWindow, Overlay } from "./Components";
import { Settings } from "./Settings";

interface MainMenuProps {
  reloadGame: () => void;
}

export const MainMenu = (props: MainMenuProps) => {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVisible((visible) => !visible);
        setShowSettings(false);
      }
    }
    function pointerLockChangeListener() {
      if (document.pointerLockElement === null) {
        setVisible(true);
      }
    }
    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("pointerlockchange", pointerLockChangeListener);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("pointerlockchange", pointerLockChangeListener);
    };
  }, []);

  if (!visible) {
    return null;
  }
  return (
    <Overlay blur darkenBackground>
      <MenuWindow>
        {!showSettings && (
          <>
            <h1>Shoot & Loot</h1>
            <MenuContent>
              <button onClick={() => setVisible(false)}>Resume Game</button>
              <button onClick={() => setShowSettings(true)}>Settings</button>
              <button
                onClick={() => {
                  props.reloadGame();
                  setVisible(false);
                }}
              >
                Reload Game
              </button>
              <br />
              <button onClick={() => window.location.reload()}>Exit</button>
            </MenuContent>
          </>
        )}
        {showSettings && <Settings closeSettings={() => setShowSettings(false)} reloadGame={props.reloadGame} />}
      </MenuWindow>
    </Overlay>
  );
};
