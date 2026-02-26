import React from "react";
import { HotkeySettings } from "./HotkeySettings";

const SettingsWindow = () => {
  return (
    <div className="w-screen h-screen bg-zinc-900 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold">Stream Dictation Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure your voice dictation preferences
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bt">
        <HotkeySettings />
      </div>
    </div>
  );
};

export default SettingsWindow;
