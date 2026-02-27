import { useEffect, useState } from "react";
import { useStatus } from "../hooks/useStatus";

const PillOverlay = () => {
  const { recording, processing, sendAction, audioLevel } = useStatus();
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(12).fill(0.1));
  const [isHovered, setIsHovered] = useState(false);

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
      setAudioLevels((prev) => prev.map((_, i) => 0.3 + 0.3 * Math.sin(time + i * 0.5)));
    }, 50);
    return () => clearInterval(interval);
  }, [processing, recording]);

  if (!recording && !processing) return null;

  const pillBorder = recording ? "border-red-500" : "border-amber-500";
  const barColor = recording ? "bg-red-500" : "bg-amber-500";
  const textColor = recording ? "text-red-500" : "text-amber-500";

  return (
    <div className="fixed inset-0 flex items-end justify-center pb-8 pointer-events-none">
      <div
        className={`
          pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full
          bg-zinc-900/90 border-2 ${pillBorder}
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
        onClick={recording ? () => sendAction({ action: "discard" }) : undefined}
      >
        <div className={`w-2 h-2 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-amber-500"}`} />

        <div className="flex items-center gap-[3px] h-6">
          {audioLevels.map((level, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full ${barColor} transition-all duration-75`}
              style={{ height: `${Math.max(4, level * 24)}px`, opacity: 0.6 + level * 0.4 }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 ml-1">
          {recording ? (
            <>
              <span className={`${textColor} text-sm font-medium`}>
                {isHovered ? "Discard" : "Recording"}
              </span>
              {isHovered && (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </>
          ) : (
            <span className={`${textColor} text-sm font-medium`}>Processing...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PillOverlay;
