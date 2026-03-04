import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import * as path from "path";
import WebSocket, { MessageEvent, ErrorEvent } from "ws";
import { spawn, ChildProcess } from "child_process";
import {
  handleCommandMode,
  setPreferredAI,
  setSendAction,
} from "./main/commands";

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let pillWindow: BrowserWindow | null = null;

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 300,
    height: 380,
    type: "panel",
    frame: false,
    resizable: false,
    show: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  trayWindow.on("blur", () => {
    if (!trayWindow?.webContents.isDevToolsOpened()) {
      trayWindow?.hide();
    }
  });

  const isDev = process.env.NODE_ENV === "development";
  const trayUrl = isDev
    ? "http://localhost:3000?window=tray"
    : `file://${path.join(__dirname, "..", "dist-react", "index.html")}?window=tray`;

  trayWindow.loadURL(trayUrl);
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    minWidth: 400,
    minHeight: 400,
    frame: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  const isDev = process.env.NODE_ENV === "development";
  const settingsUrl = isDev
    ? "http://localhost:3000?window=settings"
    : `file://${path.join(__dirname, "..", "dist-react", "index.html")}?window=settings`;

  settingsWindow.loadURL(settingsUrl);
  settingsWindow.once("ready-to-show", () => settingsWindow?.show());
}

function createPillWindow() {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.bounds;

  // Pill dimensions
  const pillWidth = 240;
  const pillHeight = 80;
  const bottomPadding = 32;

  pillWindow = new BrowserWindow({
    x: Math.round((width - pillWidth) / 2),
    y: height - pillHeight - bottomPadding,
    width: pillWidth,
    height: pillHeight,
    type: "panel",
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  pillWindow.setAlwaysOnTop(true, "screen-saver", 1);
  pillWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    pillWindow.loadURL("http://localhost:3000");
  } else {
    pillWindow.loadFile(path.join(__dirname, "..", "dist-react", "index.html"));
  }

  pillWindow.once("ready-to-show", () => {
    pillWindow?.show();
    pillWindow?.setIgnoreMouseEvents(true, { forward: true });
  });
}

const toggleTrayWindow = () => {
  if (!trayWindow || !tray) return;

  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    const trayBounds = tray.getBounds();
    const windowBounds = trayWindow.getBounds();
    const x = Math.round(
      trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2,
    );
    const y = Math.round(trayBounds.y + trayBounds.height + 4);
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    const finalX = Math.max(0, Math.min(x, width - windowBounds.width));
    trayWindow.setPosition(finalX, y, false);
    trayWindow.show();
    trayWindow.focus();
  }
};

function createTray() {
  const iconPath = path.join(__dirname, "..", "tray-icon.png");
  const icon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.on("click", () => toggleTrayWindow());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Settings",
      click: () => createSettingsWindow(),
    },
    { type: "separator" },
    {
      label: "Show Overlay",
      click: () => BrowserWindow.getAllWindows().forEach((w) => w.show()),
    },
    {
      label: "Hide Overlay",
      click: () => BrowserWindow.getAllWindows().forEach((w) => w.hide()),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("Stream Dictation: Ready");
  tray.on("right-click", () => {
    tray?.popUpContextMenu(contextMenu);
  });
}

function startBackend() {
  const backendDir = path.join(__dirname, "..", "..", "backend");
  console.log("[main.ts] Starting Python backend at:", backendDir);

  // Use sub-process spawn
  backendProcess = spawn("python3", ["main.py"], {
    cwd: backendDir,
    stdio: "inherit",
  });

  backendProcess.on("close", (code) => {
    console.log(`[main.ts] Python backend exited with code ${code}`);
    backendProcess = null;
  });
}

let backendProcess: ChildProcess | null = null;

app.whenReady().then(() => {
  startBackend();
  createTrayWindow();
  createPillWindow();
  createTray();
});

ipcMain.on("update-tray", (_event, recording: boolean) => {
  if (tray) {
    tray.setToolTip(
      recording ? "Stream Dictation: Recording" : "Stream Dictation: Ready",
    );
  }
});

// IPC listener to toggle mouse transparency (click-through)
ipcMain.on("set-ignore-mouse-events", (event: any, ignore: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on("quit-app", () => {
  if (backendProcess) backendProcess.kill();
  app.quit();
});

function getOverlayVisible(): boolean {
  return pillWindow?.isVisible() ?? false;
}

ipcMain.handle("get-overlay-visible", () => getOverlayVisible());

ipcMain.handle("toggle-overlay", () => {
  if (!pillWindow) return false;

  if (pillWindow.isVisible()) {
    pillWindow.hide();
    return false;
  } else {
    pillWindow.show();
    return true;
  }
});

ipcMain.on("set-preferred-ai", (_event, ai: string) => {
  setPreferredAI(ai);
});

ipcMain.on("open-settings", () => {
  createSettingsWindow();
});

app.on("before-quit", () => {
  if (backendProcess) {
    console.log("[main.ts] Killing Python backend...");
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

// --- State ---
let isCommandMode = false;

// WebSocket Implementation
const STATUS_PORT = 3847;
const WS_URL = `ws://127.0.0.1:${STATUS_PORT}/ws`;
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

function sendAction(message: Record<string, string>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn(
      "[main.ts] WebSocket not connected, cannot send action:",
      message,
    );
  }
}

setSendAction(sendAction);

function connectWebSocket() {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  )
    return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("[main.ts] Connected to WebSocket");
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data.toString());

      // Handle command mode state updates from backend
      if (message.type === "command_mode") {
        isCommandMode = message.data.active;
        console.log("[main.ts] Command mode:", isCommandMode);
      }

      // Handle generated text
      if (message.type === "text_generated") {
        const { text, command_mode, output_method } = message.data;
        console.log("[main.ts] Received text:", text, "output_method:", output_method);

        if (command_mode || isCommandMode) {
          // Backend indicates this was recorded in command mode
          handleCommandMode(text);
          isCommandMode = false;
        }
      }
    } catch (e) {
      console.error("[main.ts] Error parsing WebSocket message:", e);
    }
  };

  ws.onclose = () => {
    console.log("[main.ts] WebSocket closed. Reconnecting in 1s...");
    ws = null;
    reconnectTimeout = setTimeout(connectWebSocket, 1000);
  };

  ws.onerror = (err: ErrorEvent) => {
    console.error("[main.ts] WebSocket error:", err);
    ws?.close();
  };
}

// Start WebSocket connection
connectWebSocket();
