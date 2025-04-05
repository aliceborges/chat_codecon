from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, List
import random

app = FastAPI()

duck_emojis = ["🦆", "🐤", "🐥", "🐣", "🪿"]

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.message_history: List[str] = []

    async def connect(self, username: str, websocket: WebSocket):
        if username in self.active_connections:
            await websocket.close(code=4000, reason="Nome de usuário já em uso.")
            return False
        await websocket.accept()
        self.active_connections[username] = websocket
        for message in self.message_history:
            await websocket.send_text(message)
        return True

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def broadcast(self, message: str, save_to_history: bool = True):
        if save_to_history:
            self.message_history.append(message)
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    is_connected = await manager.connect(username, websocket)
    if not is_connected:
        return

    duck_emoji_in = random.choice(duck_emojis)
    await manager.broadcast(f"{duck_emoji_in} {username} entrou no chat", save_to_history=False)

    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"{username}: {data}")
    except WebSocketDisconnect:
        manager.disconnect(username)
        duck_emoji_out = random.choice(duck_emojis)
        await manager.broadcast(f"{duck_emoji_out} {username} saiu do chat", save_to_history=False)
