import { useState } from "react";
import { DictationSettings } from "./DictationSettings";
import { DictionarySettings } from "./DictionarySettings";
import { HotkeySettings } from "./HotkeySettings";
import { SettingsList } from "./SettingsList";
import { useStatus } from "../hooks/useStatus";

type Tab = "dictation" | "snippets" | "dictionary" | "hotkeys";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
   {
    id: "hotkeys",
    label: "Hotkeys",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
      </svg>
    ),
  },
  {
    id: "dictation",
    label: "Dictation",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: "snippets",
    label: "Snippets",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    id: "dictionary",
    label: "Dictionary",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  }
];

const SettingsWindow = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dictation");
  const { snippets, statusPort, wsConnected } = useStatus();

  return (
    <div className="w-screen h-screen bg-[#0a0a0c] text-zinc-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="relative px-8 py-6 border-b border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-3xl mx-auto">
          {/* Logo and title */}
          <div className="flex items-center gap-4">
            <div className="card-header-icon">
              <svg className="w-5 h-5 text-[#4d65ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
                Stream
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Voice to text, refined
              </p>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex gap-1 mt-6 p-1 bg-[#111114] rounded-xl border border-white/[0.04] w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${activeTab === tab.id
                    ? "bg-[#4d65ff]/10 text-[#4d65ff] border border-[#4d65ff]/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                  }
                `}
              >
                <span className={activeTab === tab.id ? "text-[#4d65ff]" : "text-zinc-500"}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="relative flex-1 overflow-auto bg-[#0a0a0c]">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {activeTab === "hotkeys" && (
            <div className="animate-[fade-in_0.2s_ease-out]">
              <HotkeySettings />
            </div>
          )}
          {activeTab === "dictation" && (
            <div className="animate-[fade-in_0.2s_ease-out]">
              <DictationSettings />
            </div>
          )}
          {activeTab === "snippets" && (
            <div className="animate-[fade-in_0.2s_ease-out]">
              <SettingsList items={snippets} statusPort={statusPort} />
            </div>
          )}
          {activeTab === "dictionary" && (
            <div className="animate-[fade-in_0.2s_ease-out]">
              <DictionarySettings />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative px-8 py-3 border-t border-white/[0.03] bg-[#0a0a0c]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${
              wsConnected
                ? "bg-teal-500/10 border-teal-500/15"
                : "bg-zinc-800/80 border-zinc-600/40"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsConnected ? "bg-teal-400" : "bg-amber-500 animate-pulse"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                wsConnected ? "text-teal-400" : "text-zinc-400"
              }`}
            >
              {wsConnected ? "Connected" : "Reconnecting…"}
            </span>
          </div>
          <span className="text-xs text-zinc-600 font-mono">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
};

export default SettingsWindow;
