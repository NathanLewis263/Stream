Stream is a headless voice dictation tool that records your speech, transcribes it with **Groq Whisper**, refines it with **Llama 3.3 70B** for perfect grammar and formatting, and types the result directly into whatever app you're using — VS Code, Slack, Notes, your browser, anything.

It runs as a transparent Electron overlay with a Python backend. No windows to switch to. No copy-paste. Just hold a hotkey, speak, and release.

**Cross-platform:** Works on macOS and Windows.

## How It Works

```
Voice → Microphone → Groq Whisper (transcription) → Llama 3.3 (refinement) → Type/Paste
```

1. **Record** — Hold the push-to-talk hotkey to start recording via `sounddevice`.
2. **Detect** — `ten-vad` filters out background noise and silence.
3. **Transcribe** — Audio is sent to Groq's Whisper Large V3 API.
4. **Refine** — Raw text is cleaned by Llama 3.3 70B (grammar, punctuation, formatting) using your personal dictionary.
5. **Type** — Text is typed directly into your active app (CGEvent on macOS, SendInput on Windows) with clipboard fallback.

## Features

| Feature                  | Description                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| **Ghost Typing**         | Text appears in your active app — no window switching                                         |
| **Push-to-Talk**         | Hold hotkey to record, release to transcribe (default: `fn` on macOS, `Ctrl+Win` on Windows)  |
| **Hands-Free Mode**      | Toggle with hotkey + Space for continuous dictation                                           |
| **Smart Formatting**     | Auto-fixes grammar, punctuation, markdown, and code blocks                                    |
| **Command Mode**         | Hold hotkey + modifier to send your voice query to Perplexity, ChatGPT, or Grok               |
| **Editor Mode**          | Select text + command mode → the LLM rewrites your selection based on your spoken instruction |
| **Personal Dictionary**  | Map transcription errors to correct words (e.g., "selana" → "Solana", "pie torch" → "PyTorch")|
| **Snippets**             | Auto-expand placeholders (e.g., say "my email" → `you@example.com`)                           |
| **Speech Detection**     | `ten-vad` filters silence and background noise to prevent hallucinations                      |
| **System Tray**          | Manage settings, snippets, and dictionary from the tray menu                                  |
| **WebSocket Sync**       | Real-time communication between the Python backend and Electron frontend                      |

## Architecture

```
┌───────────────────────────────┐     WebSocket (ws://127.0.0.1:3847)
│     Electron Overlay          │◄──────────────────────────────────────┐
│  • Transparent fullscreen     │                                      │
│  • Hotkey listener            │     ┌────────────────────────────┐   │
│  • Paste trigger (nut.js)     │     │    Python Backend           │   │
│  • System tray (React)        │────►│  • FastAPI + WebSocket      │   │
│  • Command routing            │     │  • Groq Whisper (STT)       │   │
└───────────────────────────────┘     │  • Llama 3.3 70B (refine)   │   │
                                      │  • sounddevice + ten-vad    │───┘
                                      │  • Dictionary + Snippets    │
                                      └────────────────────────────┘
```

## Prerequisites

### Both Platforms
- **Python 3.10+**
- **Node.js 18+**
- **Groq API Key** — [Get one here](https://console.groq.com/keys)

### macOS
- **portaudio** — required for microphone access:
  ```bash
  brew install portaudio
  ```

### Windows
- **Microsoft Visual C++ Build Tools** — may be required for some Python packages
- **Python** — ensure `python` is in your PATH

## Installation

```bash
# Clone
git clone https://github.com/nathanlewis1/Stream.git
cd Stream

# Backend
pip install -r backend/requirements.txt

# Frontend
cd overlay
npm install
cd ..
```

Create a `.env` file in the project root:

```
GROQ_API_KEY=your_groq_key_here
```

## Usage

Start both processes:

**macOS:**
```bash
# Terminal 1 — Backend
cd backend
python3 main.py

# Terminal 2 — Overlay
cd overlay
npm run dev
```

**Windows (PowerShell or CMD):**
```bash
# Terminal 1 — Backend
cd backend
python main.py

# Terminal 2 — Overlay
cd overlay
npm run dev
```

### Default Hotkeys

| Platform | Shortcut                | Action                                               |
| -------- | ----------------------- | ---------------------------------------------------- |
| macOS    | Hold `fn`               | Push-to-talk — record while held                     |
| macOS    | `fn` + `Space`          | Toggle hands-free mode                               |
| macOS    | `fn` + `Cmd`            | Command mode — send voice to AI / edit selected text |
| Windows  | Hold `Ctrl + Win`       | Push-to-talk — record while held                     |
| Windows  | `Ctrl + Win` + `Space`  | Toggle hands-free mode                               |
| Windows  | `Ctrl + Win` + `Shift`  | Command mode — send voice to AI / edit selected text |

Hotkeys are customizable via the system tray settings.

### Command Mode

When you activate command mode, Stream checks if you have text selected:

- **Text selected** → Editor mode. Your spoken instruction is applied to the selected text (e.g., _"make this a bullet list"_, _"fix the grammar"_).
- **No text selected** → Browser mode. Your spoken query opens in your preferred AI (Perplexity, ChatGPT, or Grok).

## Permissions

Stream needs system permissions to detect hotkeys and type text into applications.

### macOS

Grant these permissions in **System Settings → Privacy & Security**:

| Permission        | Why It's Needed                                      | How to Enable                                |
| ----------------- | ---------------------------------------------------- | -------------------------------------------- |
| **Accessibility** | Simulate keyboard input (typing text into apps)      | Privacy & Security → Accessibility → Enable your terminal/IDE |
| **Input Monitoring** | Detect global hotkey presses                      | Privacy & Security → Input Monitoring → Enable your terminal/IDE |
| **Microphone**    | Record audio for transcription                       | Privacy & Security → Microphone → Enable your terminal/IDE |

**Steps:**
1. Open **System Settings** → **Privacy & Security**
2. Click **Accessibility** → Add and enable your terminal app (Terminal, iTerm, VS Code, etc.)
3. Click **Input Monitoring** → Add and enable your terminal app
4. Click **Microphone** → Enable your terminal app
5. **Restart your terminal** after granting permissions

### Windows

| Permission        | Why It's Needed                                      | How to Enable                                |
| ----------------- | ---------------------------------------------------- | -------------------------------------------- |
| **Run as Administrator** | Required for global hotkey detection in some apps | Right-click the terminal → "Run as administrator" (optional) |
| **Microphone**    | Record audio for transcription                       | Settings → Privacy → Microphone → Allow apps to access microphone |

**Steps:**
1. Open **Settings** → **Privacy** → **Microphone**
2. Ensure "Allow apps to access your microphone" is **On**
3. Ensure "Allow desktop apps to access your microphone" is **On**

**Note:** On Windows, you may need to run the application as Administrator if hotkeys don't work in certain elevated applications.

## Project Structure

```
audioToTextFormat/
├── backend/
│   ├── main.py              # Entry point — starts engine + API server
│   ├── voice_engine.py      # Audio pipeline: record → Groq → output
│   ├── server.py            # FastAPI + WebSocket server
│   ├── text_output.py       # Cross-platform text typing (CGEvent/SendInput)
│   ├── active_context.py    # Cross-platform active app detection
│   ├── hotkeys.py           # Cross-platform hotkey listener
│   ├── keycodes.py          # Platform-specific keycode mappings
│   ├── commands.py          # Snippets and dictionary manager
│   ├── templates/
│   │   └── system.md        # LLM system prompt for text refinement
│   └── requirements.txt
├── overlay/
│   ├── src/
│   │   ├── main.ts          # Electron main process — windows, tray, WebSocket
│   │   ├── preload.ts       # Context bridge for renderer
│   │   ├── main/
│   │   │   └── commands.ts  # Command routing, clipboard, ghost-paste
│   │   ├── App.tsx          # React overlay UI
│   │   └── components/      # Tray window UI (settings, dictionary, status)
│   └── package.json
├── .env                     # API keys (not committed)
└── README.md
```

## Troubleshooting

### macOS
- **"Accessibility access required"** — Grant Accessibility permission and restart terminal
- **Hotkeys not working** — Ensure Input Monitoring permission is granted
- **No audio input** — Check Microphone permission in System Settings

### Windows
- **Hotkeys not detected** — Try running as Administrator
- **No audio input** — Check microphone permissions in Settings → Privacy → Microphone
- **Python not found** — Ensure Python is installed and added to PATH

## License

MIT
