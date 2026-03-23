import { useEffect, useState } from "react";
import { useStatus } from "../hooks/useStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { DictationSettings } from "./DictationSettings";
import { DictionarySettings } from "./DictionarySettings";
import { SettingsList } from "./SettingsList";

const SettingsTray = () => {
  const { recording, snippets, statusPort } = useStatus();
  const [overlayVisible, setOverlayVisible] = useState(true);

  useEffect(() => {
    window.overlay?.getOverlayVisible?.().then((visible: boolean) => {
      setOverlayVisible(visible);
    });
  }, []);

  const handleToggleOverlay = async () => {
    const newState = await window.overlay?.toggleOverlay?.();
    if (typeof newState === "boolean") {
      setOverlayVisible(newState);
    }
  };

  return (
    <div className="w-full h-full glass-panel text-zinc-100 flex flex-col select-none p-4 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="relative flex items-center justify-between pb-3 mb-3 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-3">
          {/* Waveform indicator */}
          <div className="flex items-end gap-[2px] h-5 px-1">
            {[0.4, 1, 0.6, 0.8, 0.5].map((height, i) => (
              <span
                key={i}
                className={`
                  w-[3px] rounded-full transition-all duration-200
                  ${recording
                    ? "bg-red-400 animate-[pulse_0.5s_ease-in-out_infinite]"
                    : "bg-zinc-600"
                  }
                `}
                style={{
                  height: recording ? `${height * 20}px` : `${height * 12}px`,
                  animationDelay: recording ? `${i * 0.1}s` : undefined,
                }}
              />
            ))}
          </div>
          <span className="font-semibold text-[14px] tracking-tight text-zinc-100">
            Stream
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Overlay Button */}
          <button
            onClick={handleToggleOverlay}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium
              transition-all duration-200 uppercase tracking-wider
              ${overlayVisible
                ? "bg-[#4d65ff]/15 text-[#4d65ff] border border-[#4d65ff]/25 hover:bg-[#4d65ff]/25"
                : "bg-zinc-800/50 text-zinc-500 border border-white/[0.04] hover:text-zinc-300 hover:bg-zinc-700/50"
              }
            `}
            title={overlayVisible ? "Hide pill overlay" : "Show pill overlay"}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {overlayVisible ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
            Overlay
          </button>

          {/* Status badge */}
          <span
            className={`
              status-badge px-2.5 py-1.5 rounded-full flex items-center gap-1.5
              transition-all duration-200
              ${recording ? "status-live" : "status-idle"}
            `}
          >
            {recording && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            )}
            {recording ? "Live" : "Idle"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="dictation"
        className="relative flex-1 flex flex-col overflow-hidden min-h-0"
      >
        <TabsList className="grid w-full grid-cols-3 p-1 rounded-lg bg-[#111114] border border-white/[0.04] shrink-0 gap-0.5">
          <TabsTrigger
            value="dictation"
            className="
              text-[11px] font-medium text-zinc-400 rounded-md py-1.5 px-1
              transition-all duration-200
              data-[state=active]:bg-[#4d65ff]/10 data-[state=active]:text-[#4d65ff]
              data-[state=active]:border data-[state=active]:border-[#4d65ff]/20
              hover:text-zinc-200
            "
          >
            Dictation
          </TabsTrigger>
          <TabsTrigger
            value="snippets"
            className="
              text-[11px] font-medium text-zinc-400 rounded-md py-1.5 px-1
              transition-all duration-200
              data-[state=active]:bg-[#4d65ff]/10 data-[state=active]:text-[#4d65ff]
              data-[state=active]:border data-[state=active]:border-[#4d65ff]/20
              hover:text-zinc-200
            "
          >
            Snippets
          </TabsTrigger>
          <TabsTrigger
            value="dictionary"
            className="
              text-[11px] font-medium text-zinc-400 rounded-md py-1.5 px-1
              transition-all duration-200
              data-[state=active]:bg-[#4d65ff]/10 data-[state=active]:text-[#4d65ff]
              data-[state=active]:border data-[state=active]:border-[#4d65ff]/20
              hover:text-zinc-200
            "
          >
            Dictionary
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="dictation"
          className="flex-1 mt-3 min-h-0 overflow-y-auto overflow-x-hidden animate-[fade-in_0.2s_ease-out]"
        >
          <DictationSettings compact />
        </TabsContent>
        <TabsContent
          value="snippets"
          className="flex-1 mt-3 min-h-0 overflow-y-auto overflow-x-hidden animate-[fade-in_0.2s_ease-out]"
        >
          <SettingsList items={snippets} statusPort={statusPort} />
        </TabsContent>
        <TabsContent
          value="dictionary"
          className="flex-1 mt-3 min-h-0 overflow-y-auto overflow-x-hidden animate-[fade-in_0.2s_ease-out]"
        >
          <DictionarySettings compact />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsTray;
