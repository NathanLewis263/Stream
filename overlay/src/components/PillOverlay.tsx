import { useEffect, useState } from "react";
import { useStatus } from "../hooks/useStatus";

const PillOverlay = () => {
  const {
    recording,
    processing,
    handsFree,
    commandMode,
    sendAction,
    audioLevel,
    clipboardToast,
  } = useStatus();
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(12).fill(0.1));
  const [isHovered, setIsHovered] = useState(false);
  const isMac = navigator.userAgent.toLowerCase().includes("mac");

  // Update waveform with real audio levels when recording
  useEffect(() => {
    if (recording && audioLevel > 0) {
      setAudioLevels((prev) => {
        const newLevels = [...prev];
        newLevels.shift();
        newLevels.push(Math.min(1.0, audioLevel * 1.5 + 0.3));
        return newLevels;
      });
    }
  }, [recording, audioLevel]);

  // Animate waveform for processing state
  useEffect(() => {
    if (!processing) {
      if (!recording) setAudioLevels(Array(12).fill(0.1));
      return;
    }
    const interval = setInterval(() => {
      const time = Date.now() / 200;
      setAudioLevels((prev) =>
        prev.map((_, i) => 0.3 + 0.3 * Math.sin(time + i * 0.5)),
      );
    }, 50);
    return () => clearInterval(interval);
  }, [processing, recording]);

  // Show pill during recording/processing, or show toast when clipboard used
  const showPill = recording || processing;
  const showToast = clipboardToast.visible;

  if (!showPill && !showToast) return null;

  let colorTheme = {
    border: "border-red-500",
    bg: "bg-red-500",
    text: "text-red-500",
  };
  if (processing) {
    colorTheme = {
      border: "border-amber-500",
      bg: "bg-amber-500",
      text: "text-amber-500",
    };
  } else if (commandMode) {
    colorTheme = {
      border: "border-indigo-500",
      bg: "bg-indigo-500",
      text: "text-indigo-500",
    };
  } else if (handsFree) {
    colorTheme = {
      border: "border-emerald-500",
      bg: "bg-emerald-500",
      text: "text-emerald-500",
    };
  }

  const getStatusText = () => {
    if (processing) return "Processing";
    if (isHovered) return "Discard";
    if (commandMode) return "Command Mode";
    if (handsFree) return "Hands-Free";
    return "Recording";
  };

  return (
    <div className="fixed inset-0 flex items-end justify-center pb-8 pointer-events-none">
      {/* Recording/Processing Pill */}
      {showPill && (
        <div
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full
            bg-zinc-900/90 border-2 ${colorTheme.border}
            transition-all duration-300 ease-out cursor-pointer select-none
            ${isHovered ? "scale-100" : "scale-95"}
          `}
          onMouseEnter={() => {
            setIsHovered(true);
            window.overlay?.setIgnoreMouseEvents?.(false);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            window.overlay?.setIgnoreMouseEvents?.(true);
          }}
          onClick={
            recording ? () => sendAction({ action: "discard" }) : undefined
          }
        >
          <div
            className={`w-2 h-2 rounded-full ${recording ? `${colorTheme.bg} animate-pulse` : colorTheme.bg}`}
          />

          <div className="flex items-center gap-[3px] h-6">
            {audioLevels.map((level, i) => (
              <div
                key={i}
                className={`w-[3px] rounded-full ${colorTheme.bg} transition-all duration-75`}
                style={{
                  height: `${Math.max(4, level * 24)}px`,
                  opacity: 0.6 + level * 0.4,
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 ml-1">
            {recording ? (
              <>
                <span className={`${colorTheme.text} text-sm font-medium`}>
                  {getStatusText()}
                </span>
                {isHovered && (
                  <svg
                    className={`w-4 h-4 ${colorTheme.text}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </>
            ) : (
              <span className={`${colorTheme.text} text-sm font-medium`}>
                {getStatusText()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Clipboard Toast */}
      {showToast && !showPill && (
        <div
          className={`
            pointer-events-auto flex items-center gap-3 px-3 py-2 rounded-full
            bg-zinc-900/90 border-2 border-zinc-700/50
            shadow-lg backdrop-blur-sm
            animate-in fade-in slide-in-from-bottom-4 duration-300
          `}
        >
          {/* Clipboard Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg> 
          </div>

          <div className="flex flex-col pr-2">
            <span className="text-zinc-200 text-sm font-medium leading-tight whitespace-nowrap">
              Copied to clipboard
            </span>
            <span className="text-zinc-400 text-[11px] leading-tight whitespace-nowrap mt-0.5">
              No text field • Press {isMac ? "⌘V" : "Ctrl+V"} to paste
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PillOverlay;
