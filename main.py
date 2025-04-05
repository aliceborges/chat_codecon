from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, List, Set
import random
import re
import json
from datetime import datetime

app = FastAPI()

duck_emojis = ["🦆", "🐤", "🐥", "🐣", "🪿"]

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.public_message_history: List[Dict] = []
        self.private_messages: Dict[str, List[Dict]] = {}
        self.hashtags: Dict[str, List[Dict]] = {}

    async def connect(self, username: str, websocket: WebSocket):
        if not username.startswith('@'):
            await websocket.close(code=4001, reason="Nome de usuário deve começar com @.")
            return False
        if not re.match(r'^@[a-zA-Z0-9_]+$', username):
            await websocket.close(code=4002, reason="Nome de usuário só pode conter letras, números e underscores.")
            return False
        if username in self.active_connections:
            await websocket.close(code=4000, reason="Nome de usuário já em uso.")
            return False
            
        await websocket.accept()
        self.active_connections[username] = websocket
        
        for message in self.public_message_history:
            await websocket.send_text(json.dumps(message))
            
        private_conversation_keys = [key for key in self.private_messages.keys() if username in key.split('|')]
        for key in private_conversation_keys:
            for message in self.private_messages[key]:
                await websocket.send_text(json.dumps(message))
        
        return True

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def broadcast(self, message_data: Dict, save_to_history: bool = True):
        message_json = json.dumps(message_data)
        if save_to_history and message_data.get('type') == 'public':
            self.public_message_history.append(message_data)
            
            if 'content' in message_data:
                hashtags = re.findall(r'#[a-zA-Z0-9_]+', message_data['content'])
                for tag in hashtags:
                    if tag not in self.hashtags:
                        self.hashtags[tag] = []
                    self.hashtags[tag].append(message_data)
                
        for connection in self.active_connections.values():
            await connection.send_text(message_json)
    
    async def send_private_message(self, from_user: str, to_user: str, content: str):
        if to_user not in self.active_connections:
            return False
        
        users = sorted([from_user, to_user])
        conversation_key = f"{users[0]}|{users[1]}"
        
        timestamp = datetime.now().isoformat()
        message_data = {
            "type": "private",
            "from": from_user,
            "to": to_user,
            "content": content,
            "timestamp": timestamp,
            "conversation": conversation_key
        }
        
        if conversation_key not in self.private_messages:
            self.private_messages[conversation_key] = []
        self.private_messages[conversation_key].append(message_data)
        
        message_json = json.dumps(message_data)
        
        if to_user in self.active_connections:
            await self.active_connections[to_user].send_text(message_json)
        
        if from_user in self.active_connections:
            await self.active_connections[from_user].send_text(message_json)
            
        return True
    
    async def notify_user(self, username: str, message_data: Dict):
        if username in self.active_connections:
            try:
                notification = {
                    "type": "notification",
                    "content": f"🔔 Você foi mencionado por {message_data['from']}",
                    "original_message": message_data
                }
                await self.active_connections[username].send_text(json.dumps(notification))
            except:
                pass
                
    async def get_hashtag_messages(self, username: str, hashtag: str):
        if hashtag in self.hashtags and username in self.active_connections:
            for message in self.hashtags[hashtag]:
                await self.active_connections[username].send_text(json.dumps({
                    "type": "hashtag_result",
                    "tag": hashtag,
                    "message": message
                }))

manager = ConnectionManager()

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    is_connected = await manager.connect(username, websocket)
    if not is_connected:
        return

    duck_emoji_in = random.choice(duck_emojis)
    join_message = {
        "type": "system",
        "content": f"{duck_emoji_in} {username} entrou no chat",
        "timestamp": datetime.now().isoformat()
    }
    await manager.broadcast(join_message, save_to_history=False)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                
                if message_data.get("type") == "private":
                    to_user = message_data.get("to")
                    content = message_data.get("content")
                    await manager.send_private_message(username, to_user, content)
                
                elif message_data.get("type") == "hashtag_search":
                    hashtag = message_data.get("tag")
                    await manager.get_hashtag_messages(username, hashtag)
                    
            except json.JSONDecodeError:
                timestamp = datetime.now().isoformat()
                message_data = {
                    "type": "public",
                    "from": username,
                    "content": data,
                    "timestamp": timestamp
                }
                await manager.broadcast(message_data)
                
                mentioned_users = re.findall(r'@[a-zA-Z0-9_]+', data)
                for mentioned_user in mentioned_users:
                    if mentioned_user in manager.active_connections and mentioned_user != username:
                        await manager.notify_user(mentioned_user, message_data)
                    
    except WebSocketDisconnect:
        manager.disconnect(username)
        duck_emoji_out = random.choice(duck_emojis)
        leave_message = {
            "type": "system",
            "content": f"{duck_emoji_out} {username} saiu do chat",
            "timestamp": datetime.now().isoformat()
        }
        await manager.broadcast(leave_message, save_to_history=False)

@app.get("/api/users")
async def get_active_users():
    return {"users": list(manager.active_connections.keys())}

@app.get("/api/hashtags")
async def get_hashtags():
    return {"hashtags": list(manager.hashtags.keys())}