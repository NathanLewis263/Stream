from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from commands import command_manager
from hotkey_config import hotkey_config
from pydantic import BaseModel
import threading
import json
import asyncio
import sys
from typing import List, Optional, Callable

STATUS_SERVER_PORT = 3847

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

# Callback for hotkey listener reload (set by main.py)
hotkey_reload_callback: Optional[Callable] = None
hotkey_start_capture_callback: Optional[Callable] = None
hotkey_stop_capture_callback: Optional[Callable] = None
hotkey_key_captured_callback_setter: Optional[Callable] = None

def set_hotkey_reload_callback(callback: Callable):
    global hotkey_reload_callback
    hotkey_reload_callback = callback

def set_hotkey_capture_callbacks(start_callback: Callable, stop_callback: Callable):
    global hotkey_start_capture_callback, hotkey_stop_capture_callback
    hotkey_start_capture_callback = start_callback
    hotkey_stop_capture_callback = stop_callback

def set_hotkey_key_captured_callback_setter(setter: Callable):
    global hotkey_key_captured_callback_setter
    hotkey_key_captured_callback_setter = setter

class Item(BaseModel):
    key: str
    value: str

class EditorCommand(BaseModel):
    instruction: str
    selected_text: str

def run_status_server(engine_ref):
    """
    Runs a lightweight FastAPI server.
    The Electron overlay polls this for recording state and available commands.
    """
    
    # --- WebSocket Endpoint ---
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            # Send initial state on connection
            hotkeys = hotkey_config.get_hotkeys()
            platform = sys.platform
            ptt_key = hotkeys.get("push_to_talk", {}).get(platform, {}).get("key", "fn" if platform == "darwin" else "Ctrl+Win")
            await websocket.send_json({
                "type": "status_update",
                "data": {
                    "recording": engine_ref.is_recording,
                    "processing": getattr(engine_ref, "is_processing", False),
                    "hotkey": ptt_key,
                    "snippets": command_manager.get_snippets(),
                    "hotkeys": hotkeys,
                    "platform": platform
                }
            })
            while True:
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    action = message.get("action")

                    if action == "start":
                        with engine_ref.lock:
                            if not engine_ref.is_recording:
                                engine_ref.start_recording()
                    
                    elif action == "stop":
                        with engine_ref.lock:
                            if engine_ref.is_recording:
                                audio_data = engine_ref.stop_recording()
                                threading.Thread(target=lambda: engine_ref.process_audio(audio_data)).start()

                    elif action == "discard":
                        with engine_ref.lock:
                            if engine_ref.is_recording:
                                engine_ref.discard_recording()

                    elif action == "toggle":
                        with engine_ref.lock:
                            if engine_ref.is_recording:
                                audio_data = engine_ref.stop_recording()
                                threading.Thread(target=lambda: engine_ref.process_audio(audio_data)).start()
                            else:
                                engine_ref.start_recording()
                                
                    elif action == "editor_command":
                        instruction = message.get("instruction")
                        selected_text = message.get("selected_text")
                        if instruction and selected_text:
                            threading.Thread(target=lambda: engine_ref.process_editor_command(selected_text, instruction)).start()

                    elif action == "get_hotkeys":
                        hotkeys = hotkey_config.get_hotkeys()
                        await websocket.send_json({
                            "type": "hotkeys_config",
                            "data": {
                                "hotkeys": hotkeys,
                                "platform": sys.platform
                            }
                        })

                    elif action == "set_hotkey":
                        action_name = message.get("action_name")
                        platform = message.get("platform", sys.platform)
                        config = message.get("config")
                        if action_name and config:
                            hotkey_config.set_hotkey(action_name, platform, config)
                            # Trigger reload in hotkey listener
                            if hotkey_reload_callback:
                                hotkey_reload_callback(hotkey_config.get_hotkeys())
                            # Broadcast update to all clients
                            await manager.broadcast({
                                "type": "hotkeys_updated",
                                "data": {
                                    "hotkeys": hotkey_config.get_hotkeys(),
                                    "platform": sys.platform
                                }
                            })

                    elif action == "reset_hotkeys":
                        hotkey_config.reset_to_defaults()
                        if hotkey_reload_callback:
                            hotkey_reload_callback(hotkey_config.get_hotkeys())
                        await manager.broadcast({
                            "type": "hotkeys_updated",
                            "data": {
                                "hotkeys": hotkey_config.get_hotkeys(),
                                "platform": sys.platform
                            }
                        })

                    elif action == "start_capture":
                        if hotkey_start_capture_callback:
                            hotkey_start_capture_callback()
                            await websocket.send_json({
                                "type": "capture_started",
                                "data": {"success": True}
                            })

                    elif action == "stop_capture":
                        if hotkey_stop_capture_callback:
                            hotkey_stop_capture_callback()
                            await websocket.send_json({
                                "type": "capture_stopped",
                                "data": {"success": True}
                            })

                except json.JSONDecodeError:
                    print(f"Invalid JSON received: {data}")
                    
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    # --- Async Loop Capture & Callbacks ---
    @app.on_event("startup")
    async def startup_event():
        running_loop = asyncio.get_running_loop()
        def bridge_to_async(topic, data):
            asyncio.run_coroutine_threadsafe(manager.broadcast({"type": topic, "data": data}), running_loop)

        engine_ref.on_status_change = lambda data: bridge_to_async("status_update", data)
        engine_ref.on_text_generated = lambda data: bridge_to_async("text_generated", data)
        engine_ref.on_audio_level = lambda level: bridge_to_async("audio_level", {"level": level})

        hotkey_key_captured_callback_setter(lambda data: bridge_to_async("key_captured", data))

    @app.post("/snippets")
    def add_snippet(item: Item):
        command_manager.add_snippet(item.key, item.value)
        engine_ref.notify_status()
        return {"status": "ok"}

    @app.delete("/snippets/{key}")
    def delete_snippet(key: str):
        command_manager.remove_snippet(key)
        engine_ref.notify_status()
        return {"status": "ok"}
    
    uvicorn.run(app, host="127.0.0.1", port=STATUS_SERVER_PORT, log_level="warning")


