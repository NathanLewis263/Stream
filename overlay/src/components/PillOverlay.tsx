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
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(8).fill(0.15));
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const isMac = navigator.userAgent.toLowerCase().includes("mac");

  const showPill = recording || processing;
  const showToast = clipboardToast.visible;

  // Animate in/out
  useEffect(() => {
    if (showPill || showToast) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [showPill, showToast]);

  useEffect(() => {
    if (recording && audioLevel > 0) {
      setAudioLevels((prev) => {
        const newLevels = [...prev];
        newLevels.shift();
        newLevels.push(Math.min(1.0, audioLevel * 1.8 + 0.2));
        return newLevels;
      });
    }
  }, [recording, audioLevel]);

  useEffect(() => {
    if (!processing) {
      if (!recording) setAudioLevels(Array(8).fill(0.15));
      return;
    }
    const interval = setInterval(() => {
      const time = Date.now() / 180;
      setAudioLevels((prev) =>
        prev.map((_, i) => 0.25 + 0.35 * Math.sin(time + i * 0.6)),
      );
    }, 40);
    return () => clearInterval(interval);
  }, [processing, recording]);

  if (!showPill && !showToast) return null;

  // Wispr Flow inspired color themes
  const colors = {
    recording: { accent: "#ef4444", glow: "rgba(239, 68, 68, 0.4)" },
    processing: { accent: "#4d65ff", glow: "rgba(77, 101, 255, 0.4)" },
    command: { accent: "#8b5cf6", glow: "rgba(139, 92, 246, 0.4)" },
    handsFree: { accent: "#0d9488", glow: "rgba(13, 148, 136, 0.4)" },
  };

  let theme = colors.recording;
  if (processing) theme = colors.processing;
  else if (commandMode) theme = colors.command;
  else if (handsFree) theme = colors.handsFree;

  const getStatusText = () => {
    if (processing) return "Processing";
    if (isHovered) return "Cancel";
    if (commandMode) return "Command";
    if (handsFree) return "Hands-Free";
    return "Recording";
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: "28px",
        pointerEvents: "none",
      }}
    >
      {/* Recording/Processing Pill */}
      {showPill && (
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 14px 8px 12px",
            borderRadius: "9999px",
            background: "linear-gradient(135deg, rgba(17, 17, 20, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)",
            backdropFilter: "blur(20px)",
            border: `1.5px solid ${theme.accent}`,
            boxShadow: `0 0 20px ${theme.glow}, 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
            cursor: recording ? "pointer" : "default",
            userSelect: "none",
            opacity: isVisible ? 1 : 0,
            transform: isVisible
              ? isHovered ? "translateY(0) scale(1.02)" : "translateY(0) scale(1)"
              : "translateY(8px) scale(0.95)",
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
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
          {/* Pulsing dot */}
          <div
            style={{
              position: "relative",
              width: "8px",
              height: "8px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "9999px",
                backgroundColor: theme.accent,
                animation: recording ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            />
            {recording && (
              <div
                style={{
                  position: "absolute",
                  inset: "-4px",
                  borderRadius: "9999px",
                  backgroundColor: theme.accent,
                  opacity: 0.3,
                  animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
            )}
          </div>

          {/* Waveform */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "20px" }}>
            {audioLevels.map((level, i) => (
              <div
                key={i}
                style={{
                  width: "2.5px",
                  borderRadius: "9999px",
                  backgroundColor: theme.accent,
                  height: `${Math.max(4, level * 20)}px`,
                  opacity: 0.5 + level * 0.5,
                  transition: "height 60ms ease-out, opacity 60ms ease-out",
                }}
              />
            ))}
          </div>

          {/* Status text */}
          <span
            style={{
              color: isHovered && recording ? "#fca5a5" : "#e4e4e7",
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: "color 0.15s ease",
            }}
          >
            {getStatusText()}
          </span>

          {/* Cancel icon on hover */}
          {recording && isHovered && (
            <svg
              style={{
                width: "14px",
                height: "14px",
                color: "#fca5a5",
                marginLeft: "-4px",
              }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      )}

      {/* Clipboard Toast */}
      {showToast && !showPill && (
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(17, 17, 20, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(77, 101, 255, 0.3)",
            boxShadow: "0 0 20px rgba(77, 101, 255, 0.15), 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Icon */}
          <div
            style={{
              flexShrink: 0,
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "rgba(77, 101, 255, 0.15)",
              border: "1px solid rgba(77, 101, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              style={{ width: "14px", height: "14px", color: "#4d65ff" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                color: "#f0f0f2",
                fontSize: "13px",
                fontWeight: 500,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Copied to clipboard
            </span>
            <span
              style={{
                color: "#71717a",
                fontSize: "11px",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Press {isMac ? "⌘V" : "Ctrl+V"} to paste
            </span>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.3; }
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PillOverlay;
