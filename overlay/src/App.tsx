import React, { useMemo } from "react";
import SettingsTray from "./components/SettingsTray";
import SettingsWindow from "./components/SettingsWindow";
import { useStatus } from "./hooks/useStatus";

const App: React.FC = () => {
  const windowType = useMemo(() => {
    return new URLSearchParams(window.location.search).get("window");
  }, []);

  // Ensure polling runs for the main overlay to update borders and tray status
  // We don't need the return values (recording, etc) for the UI here, just the side effects.
  useStatus();

  if (windowType === "tray") {
    return <SettingsTray />;
  }

  if (windowType === "settings") {
    return <SettingsWindow />;
  }

  return (
    <div>
      <div id="border-right" className="border-edge"></div>
      <div id="border-left" className="border-edge"></div>
      {/* InfoPanel removed as requested */}
    </div>
  );
};

export default App;
