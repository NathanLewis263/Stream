import { useState, useEffect, useRef, useCallback } from "react";

export interface StatusData {
  recording: boolean;
  processing: boolean;
  hands_free: boolean;
  command_mode: boolean;
  hotkey: string;
  commands: Record<string, string> | null;
  snippets: Record<string, string> | null;
}

export interface ClipboardToast {
  visible: boolean;
  text: string;
}

export const useStatus = () => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [commandMode, setCommandMode] = useState(false);
  const [hotkey, setHotkey] = useState("—");
  const [snippets, setSnippets] = useState<Record<string, string> | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [clipboardToast, setClipboardToast] = useState<ClipboardToast>({ visible: false, text: "" });
  const wsRef = useRef<WebSocket | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const statusPort = window.overlay?.statusPort || 3847;

  const showClipboardToast = useCallback((text: string) => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    // Show toast
    setClipboardToast({ visible: true, text });

    // Auto-hide after 2 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setClipboardToast({ visible: false, text: "" });
    }, 2000);
  }, []);

  const sendAction = useCallback((message: Record<string, string>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      wsRef.current = new WebSocket(`ws://127.0.0.1:${statusPort}/ws`);

      wsRef.current.onopen = () => {
        console.log("[useStatus] Connected");
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "status_update") {
            const data = message.data;
            setRecording(Boolean(data.recording));
            setProcessing(Boolean(data.processing));
            setHandsFree(Boolean(data.hands_free));
            setCommandMode(Boolean(data.command_mode));
            setHotkey(data.hotkey || "—");
            setSnippets(data.snippets);

            // Sync tray status
            window.overlay?.updateTray?.(Boolean(data.recording));
          } else if (message.type === "audio_level") {
            setAudioLevel(message.data.level);
          } else if (message.type === "text_generated") {
            // Show toast when clipboard fallback was used
            const { output_method, text } = message.data;
            if (output_method === "clipboard") {
              const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
              showClipboardToast(preview);
            }
          }
        } catch (e) {
          console.error("[useStatus] Error parsing message:", e);
        }
      };

      wsRef.current.onclose = () => {
        console.log("[useStatus] Disconnected. Reconnecting...");
        reconnectTimeout = setTimeout(connect, 1000);
      };

      wsRef.current.onerror = (err) => {
        console.error("[useStatus] Error:", err);
        wsRef.current?.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [statusPort]);

  return {
    recording,
    processing,
    handsFree,
    commandMode,
    hotkey,
    snippets,
    statusPort,
    sendAction,
    audioLevel,
    clipboardToast,
  };
};
