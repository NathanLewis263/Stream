import { useState, useEffect, useCallback, useRef } from "react";

interface HotkeyConfig {
  key: string;
  keycode?: number;
  keycodes?: number[];
  vk_codes?: number[];
  vk_code?: number;
}

interface HotkeyAction {
  darwin?: HotkeyConfig;
  win32?: HotkeyConfig;
}

interface HotkeysConfig {
  push_to_talk: HotkeyAction;
  hands_free_modifier: HotkeyAction;
  command_mode_modifier: HotkeyAction;
}

export interface CapturedKeyData {
  keycodes: number[];
  displayName: string;
  keyCount: number;
}

interface UseHotkeysReturn {
  hotkeys: HotkeysConfig | null;
  platform: string;
  loading: boolean;
  error: string | null;
  updateHotkey: (action: string, config: HotkeyConfig) => void;
  resetToDefaults: () => void;
  // Capture mode
  isCapturing: boolean;
  capturedData: CapturedKeyData | null;
  startCapture: () => void;
  stopCapture: () => void;
}

export const useHotkeys = (): UseHotkeysReturn => {
  const [hotkeys, setHotkeys] = useState<HotkeysConfig | null>(null);
  const [platform, setPlatform] = useState<string>("darwin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedData, setCapturedData] = useState<CapturedKeyData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusPort = window.overlay?.statusPort || 3847;

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${statusPort}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setError(null);
      // Request hotkeys config
      ws.send(JSON.stringify({ action: "get_hotkeys" }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "hotkeys_config" || message.type === "hotkeys_updated") {
          setHotkeys(message.data.hotkeys);
          setPlatform(message.data.platform);
          setLoading(false);
        }

        // Also handle initial status_update which includes hotkeys
        if (message.type === "status_update" && message.data.hotkeys) {
          setHotkeys(message.data.hotkeys);
          setPlatform(message.data.platform || "darwin");
          setLoading(false);
        }

        // Handle key capture events from backend
        if (message.type === "key_captured") {
          setCapturedData(message.data);
        }

        if (message.type === "capture_started") {
          setIsCapturing(true);
          setCapturedData(null);
        }

        if (message.type === "capture_stopped") {
          setIsCapturing(false);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = () => {
      setError("Failed to connect to backend");
      setLoading(false);
    };

    ws.onclose = () => {
      // Reconnect after a delay
      setTimeout(() => {
        if (wsRef.current === ws) {
          connectWebSocket();
        }
      }, 2000);
    };
  }, [statusPort]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const updateHotkey = useCallback((action: string, config: HotkeyConfig) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "set_hotkey",
        action_name: action,
        platform: platform,
        config: config
      }));
    }
  }, [platform]);

  const resetToDefaults = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "reset_hotkeys" }));
    }
  }, []);

  const startCapture = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setCapturedData(null);
      wsRef.current.send(JSON.stringify({ action: "start_capture" }));
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "stop_capture" }));
      setIsCapturing(false);
    }
  }, []);

  return {
    hotkeys,
    platform,
    loading,
    error,
    updateHotkey,
    resetToDefaults,
    isCapturing,
    capturedData,
    startCapture,
    stopCapture
  };
};
