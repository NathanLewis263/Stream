import React, { useMemo } from "react";
import SettingsTray from "./components/SettingsTray";
import SettingsWindow from "./components/SettingsWindow";
import PillOverlay from "./components/PillOverlay";

const App: React.FC = () => {
  const windowType = useMemo(() => {
    return new URLSearchParams(window.location.search).get("window");
  }, []);

  if (windowType === "tray") {
    return <SettingsTray />;
  }

  if (windowType === "settings") {
    return <SettingsWindow />;
  }

  // Default to pill overlay
  return <PillOverlay />;
};

export default App;
