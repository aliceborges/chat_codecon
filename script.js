let ws;
let username;
let notificationSound;
let isWindowFocused = true;
let currentTab = 'public';
let privateChats = {};
let hashtagChats = {};
let unreadMessages = {};
let activeUsers = [];
let popularHashtags = [];
let activeMenu = 'public';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; 

document.addEventListener('DOMContentLoaded', function() {
    notificationSound = document.getElementById('notificationSound');
    try {
        notificationSound.load();
    } catch(e) {
        console.error("Erro ao carregar o som:", e);
    }
    
    document.getElementById('loginButton').addEventListener('click', joinChat);
    document.getElementById('usernameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') joinChat();
    });
    
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    window.onfocus = function() { isWindowFocused = true; };
    window.onblur = function() { isWindowFocused = false; };
    
    document.getElementById('tabs').addEventListener('click', function(e) {
        const tabElement = e.target.closest('.tab');
        if (tabElement) {
            const tabId = tabElement.getAttribute('data-tab-id');
            if (tabId && tabId !== currentTab) {
                switchTab(tabId);
            }
        }
    });
    
    document.getElementById('public-chat').addEventListener('click', function(e) {
        if (e.target.classList.contains('mention')) {
            const mentionedUser = e.target.textContent;
            startPrivateChat(mentionedUser);
        }
        else if (e.target.classList.contains('hashtag')) {
            const hashtag = e.target.textContent;
            searchHashtag(hashtag);
        }
    });

    setupMenuListeners();

    const storedUsername = localStorage.getItem('duckchat_username');
    if (storedUsername) {
        username = storedUsername;
        document.getElementById('usernameInput').value = username;
        connectWebSocket();
    }

    document.getElementById('logoutButton')?.addEventListener('click', logout);
});

async function connectWebSocket() {
    if (!username) {
        const storedUsername = localStorage.getItem('duckchat_username');
        if (storedUsername) {
            username = storedUsername;
            document.getElementById('usernameInput').value = username;
        } else {
            return;
        }
    }

    ws = new WebSocket(`ws://localhost:8000/ws/${encodeURIComponent(username)}`);

    ws.onopen = function() {
        reconnectAttempts = 0;
        document.getElementById("login").style.display = "none";
        document.getElementById("chatContainer").style.display = "block";
        document.getElementById("messageInput").focus();
        document.getElementById("currentUsername").textContent = username;
        document.getElementById("logoutButton").classList.remove("hidden");
        
        fetchActiveUsers();
        fetchHashtags();
    };

    ws.onmessage = function(event) {
        try {
            const messageData = JSON.parse(event.data);
            processMessage(messageData);
        } catch(e) {
            console.error("Erro ao processar mensagem:", e);
        }
    };

    ws.onclose = function(event) {
        if (event.code === 4000) {
            alert("Este nome de usuário já está em uso. Escolha outro.");
        } else if (event.code === 4001) {
            alert("Nome de usuário deve começar com @.");
        } else if (event.code === 4002) {
            alert("Nome de usuário só pode conter letras, números e underscores.");
        } else if (username && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, RECONNECT_DELAY);
        }
    };

    ws.onerror = function(error) {
        console.error("WebSocket error:", error);
    };
}


function logout() {
    localStorage.removeItem('duckchat_username');
    
    if (ws) {
        ws.close();
    }
    
    document.getElementById("chatContainer").style.display = "none";
    document.getElementById("login").style.display = "block";
    document.getElementById("usernameInput").value = "";
    document.getElementById("usernameInput").focus();
}

function joinChat() {
    username = document.getElementById("usernameInput").value.trim();
    if (!username) return alert("Nome de usuário é obrigatório!");
    if (!username.startsWith('@')) return alert("Nome de usuário deve começar com @");
    if (!/^@[a-zA-Z0-9_]+$/.test(username)) return alert("Nome de usuário só pode conter letras, números e underscores");

    localStorage.setItem('duckchat_username', username);
    connectWebSocket();

    requestNotificationPermission();

    ws = new WebSocket(`ws://localhost:8000/ws/${encodeURIComponent(username)}`);

    ws.onopen = function () {
        document.getElementById("login").style.display = "none";
        document.getElementById("chatContainer").style.display = "block";
        document.getElementById("messageInput").focus();
        document.getElementById("currentUsername").textContent = username;
        
        fetchActiveUsers();
        fetchHashtags();
        
        setInterval(fetchActiveUsers, 10000);
        setInterval(fetchHashtags, 30000);
    };

    ws.onmessage = function (event) {
        try {
            const messageData = JSON.parse(event.data);
            processMessage(messageData);
        } catch(e) {
            console.error("Erro ao processar mensagem:", e);
            const messages = document.getElementById('public-chat');
            const message = document.createElement('div');
            message.classList.add('message');
            
            const isOwnMessage = event.data.startsWith(`${username}:`);
            if (isOwnMessage) {
                message.classList.add('self');
                message.textContent = event.data.replace(`${username}:`, "Você:");
            } else {
                message.classList.add('other');
                message.textContent = event.data;
            }
            
            messages.appendChild(message);
            messages.scrollTop = messages.scrollHeight;
        }
    };

    ws.onclose = function (event) {
        if (event.code === 4000) {
            alert("Este nome de usuário já está em uso. Escolha outro.");
        } else if (event.code === 4001) {
            alert("Nome de usuário deve começar com @.");
        } else if (event.code === 4002) {
            alert("Nome de usuário só pode conter letras, números e underscores.");
        }
    };
}

function setupMenuListeners() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchMenu(tab);
        });
    });
}

function switchMenu(menu) {
    activeMenu = menu;
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === menu) {
            item.classList.add('active');
        }
    });
    
    document.getElementById('privateConversations').classList.add('hidden');
    document.getElementById('popularHashtags').classList.add('hidden');
    
    if (menu === 'private') {
        document.getElementById('privateConversations').classList.remove('hidden');
        updatePrivateConversationsList();
    } else if (menu === 'hashtags') {
        document.getElementById('popularHashtags').classList.remove('hidden');
        updateHashtagsList();
    }
}

function updatePrivateConversationsList() {
    const list = document.getElementById('privateChatsList');
    list.innerHTML = '';
    
    const privateChatKeys = Object.keys(privateChats);
    
    if (privateChatKeys.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma conversa privada';
        li.style.fontStyle = 'italic';
        li.style.color = '#888';
        li.style.cursor = 'default';
        list.appendChild(li);
        return;
    }
    
    privateChatKeys.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        li.addEventListener('click', () => startPrivateChat(user));
        list.appendChild(li);
    });
}

function updateHashtagsList() {
    const list = document.getElementById('hashtagsList');
    list.innerHTML = '';
    
    if (popularHashtags.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma hashtag encontrada';
        li.style.fontStyle = 'italic';
        li.style.color = '#888';
        li.style.cursor = 'default';
        list.appendChild(li);
        return;
    }
    
    popularHashtags.sort((a, b) => b.count - a.count);
    
    popularHashtags.forEach(tag => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${tag.name}</span>
            <span class="hashtag-count">${tag.count}</span>
        `;
        li.addEventListener('click', () => searchHashtag(tag.name));
        list.appendChild(li);
    });
}

function processMessage(data) {
    let messageContainer;
    const messageElement = document.createElement('div');
    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    switch(data.type) {
        case 'public':
            messageContainer = document.getElementById('public-chat');
            messageElement.classList.add('message');
            
            if (data.from === username) {
                messageElement.classList.add('self');
                messageElement.innerHTML = `<div>Você: ${formatMessage(data.content)}</div><div class="timestamp">${timestamp}</div>`;
            } else {
                messageElement.classList.add('other');
                messageElement.innerHTML = `<div>${data.from}: ${formatMessage(data.content)}</div><div class="timestamp">${timestamp}</div>`;
            }
            
            if (currentTab !== 'public') {
                markTabUnread('public');
            }
            break;
            
        case 'private':
            const otherUser = data.from === username ? data.to : data.from;
            const chatId = `private-${otherUser}`;
            
            ensurePrivateChatExists(otherUser);
            
            messageContainer = document.getElementById(chatId);
            messageElement.classList.add('message', 'private');
            
            if (data.from === username) {
                messageElement.classList.add('self');
                messageElement.innerHTML = `<div>Você <span class="mention-chip">privado</span>: ${formatMessage(data.content)}</div><div class="timestamp">${timestamp}</div>`;
            } else {
                messageElement.classList.add('other');
                messageElement.innerHTML = `<div>${data.from} <span class="mention-chip">privado</span>: ${formatMessage(data.content)}</div><div class="timestamp">${timestamp}</div>`;
                playNotificationSound();
            }
            
            if (currentTab !== chatId) {
                markTabUnread(chatId);
            }
            break;
            
        case 'system':
            messageContainer = document.getElementById('public-chat');
            messageElement.classList.add('message', 'system');
            messageElement.innerHTML = `<div>${data.content}</div><div class="timestamp">${timestamp}</div>`;
            break;
            
        case 'notification':
            messageContainer = document.getElementById('public-chat');
            messageElement.classList.add('notification');
            messageElement.innerHTML = `<div>${data.content}</div>`;
            playNotificationSound();
            break;
            
        case 'hashtag_result':
            const tag = data.tag;
            const tagId = `hashtag-${tag}`;
            
            ensureHashtagChatExists(tag);
            
            messageContainer = document.getElementById(tagId);
            
            const originalMessage = data.message;
            messageElement.classList.add('message');
            
            if (originalMessage.from === username) {
                messageElement.classList.add('self');
                messageElement.innerHTML = `<div>Você: ${formatMessage(originalMessage.content)}</div><div class="timestamp">${new Date(originalMessage.timestamp).toLocaleTimeString()}</div>`;
            } else {
                messageElement.classList.add('other');
                messageElement.innerHTML = `<div>${originalMessage.from}: ${formatMessage(originalMessage.content)}</div><div class="timestamp">${new Date(originalMessage.timestamp).toLocaleTimeString()}</div>`;
            }
            break;
            
        default:
            console.warn("Tipo de mensagem desconhecido:", data.type);
            return;
    }
    
    if (messageContainer) {
        messageContainer.appendChild(messageElement);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}

function formatMessage(text) {
    text = text.replace(/#[a-zA-Z0-9_]+/g, match => {
        return `<span class="hashtag" onclick="searchHashtag('${match}')">${match}</span>`;
    });
    
    text = text.replace(/@[a-zA-Z0-9_]+/g, match => {
        return `<span class="mention" data-username="${match}">${match}</span>`;
    });
    
    return text;
}

function startPrivateChat(otherUser) {
    if (otherUser === username) return; 
    
    otherUser = otherUser.trim();
    
    ensurePrivateChatExists(otherUser);
    
    const chatId = `private-${otherUser}`;
    switchTab(chatId);
    
    document.getElementById('messageInput').focus();
}

function ensurePrivateChatExists(otherUser) {
    const chatId = `private-${otherUser}`;
    
    if (!privateChats[otherUser]) {
        const tabsContainer = document.getElementById('tabs');
        const newTab = document.createElement('div');
        newTab.id = `tab-${chatId}`;
        newTab.className = 'tab';
        newTab.setAttribute('data-tab-id', chatId);
        newTab.innerHTML = `${otherUser} <span class="tab-indicator"></span>`;
        tabsContainer.appendChild(newTab);
        
        const chatAreas = document.getElementById('chatAreas');
        const newChatArea = document.createElement('div');
        newChatArea.id = chatId;
        newChatArea.className = 'chat hidden';
        chatAreas.appendChild(newChatArea);
        
        privateChats[otherUser] = true;
    }
}

function ensureHashtagChatExists(hashtag) {
    const tagId = `hashtag-${hashtag}`;
    
    if (!hashtagChats[hashtag]) {
        const tabsContainer = document.getElementById('tabs');
        const newTab = document.createElement('div');
        newTab.id = `tab-${tagId}`;
        newTab.className = 'tab';
        newTab.setAttribute('data-tab-id', tagId);
        newTab.innerHTML = `${hashtag} <span class="tab-indicator"></span>`;
        tabsContainer.appendChild(newTab);
        
        const chatAreas = document.getElementById('chatAreas');
        const newChatArea = document.createElement('div');
        newChatArea.id = tagId;
        newChatArea.className = 'chat hidden';
        chatAreas.appendChild(newChatArea);
        
        hashtagChats[hashtag] = true;
    }
}

function switchTab(tabId) {
    if (currentTab === tabId) return;
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const chats = document.querySelectorAll('.chat');
    chats.forEach(chat => chat.classList.add('hidden'));
    
    const selectedTab = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    let selectedChat;
    if (tabId === 'public') {
        selectedChat = document.getElementById('public-chat');
    } else {
        selectedChat = document.getElementById(tabId);
    }
    
    if (selectedChat) {
        selectedChat.classList.remove('hidden');
    }
    
    if (unreadMessages[tabId]) {
        const indicator = document.querySelector(`[data-tab-id="${tabId}"] .tab-indicator`);
        if (indicator) {
            indicator.classList.remove('new');
        }
        unreadMessages[tabId] = false;
    }
    
    currentTab = tabId;
    
    updateMessageInputPlaceholder();
    
    document.getElementById('messageInput').focus();
}

function updateMessageInputPlaceholder() {
    const messageInput = document.getElementById('messageInput');
    
    if (currentTab === 'public') {
        messageInput.placeholder = "Diga algo...";
    } else if (currentTab.startsWith('private-')) {
        const otherUser = currentTab.replace('private-', '');
        messageInput.placeholder = `Mensagem privada para ${otherUser}...`;
    } else if (currentTab.startsWith('hashtag-')) {
        const hashtag = currentTab.replace('hashtag-', '');
        messageInput.placeholder = `Escreva uma mensagem com ${hashtag}...`;
    }
}

function markTabUnread(tabId) {
    unreadMessages[tabId] = true;
    const indicator = document.querySelector(`[data-tab-id="${tabId}"] .tab-indicator`);
    if (indicator) {
        indicator.classList.add('new');
    }
}

function searchHashtag(hashtag) {
    if (hashtag.startsWith('#')) {
        hashtag = hashtag.trim();
    } else {
        hashtag = `#${hashtag.trim()}`;
    }
    
    const tagId = `hashtag-${hashtag}`;
    
    ensureHashtagChatExists(hashtag);
    switchTab(tagId);
    
    ws.send(JSON.stringify({
        type: "hashtag_search",
        tag: hashtag
    }));
}

function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;
    
    if (currentTab === 'public') {
        ws.send(message);
    } else if (currentTab.startsWith('private-')) {
        const toUser = currentTab.replace('private-', '');
        ws.send(JSON.stringify({
            type: "private",
            to: toUser,
            content: message
        }));
    } else if (currentTab.startsWith('hashtag-')) {
        const hashtag = currentTab.replace('hashtag-', '');
        if (!message.includes(hashtag)) {
            ws.send(`${message} ${hashtag}`);
        } else {
            ws.send(message);
        }
    }
    
    input.value = '';
    input.focus();
}

function playNotificationSound() {
    try {
        notificationSound.currentTime = 0;
        notificationSound.play().catch(e => console.error("Erro ao reproduzir som:", e));
        
        if (!isWindowFocused && Notification.permission === "granted") {
            new Notification("DuckChat - Nova mensagem", {
                body: "Você recebeu uma nova mensagem!",
                icon: "https://cdn-icons-png.flaticon.com/512/616/616408.png"
            });
        }
    } catch(e) {
        console.error("Erro ao reproduzir som:", e);
    }
}

function requestNotificationPermission() {
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            console.log("Permissão para notificações:", permission);
        });
    }
}

function fetchActiveUsers() {
    fetch('/api/users')
        .then(response => response.json())
        .then(data => {
            activeUsers = data.users || [];
            updateUserList();
        })
        .catch(error => console.error('Erro ao buscar usuários:', error));
}

function fetchHashtags() {
    fetch('/api/hashtags')
        .then(response => response.json())
        .then(data => {
            popularHashtags = data.hashtags || [];
            if (activeMenu === 'hashtags') {
                updateHashtagsList();
            }
        })
        .catch(error => console.error('Erro ao buscar hashtags:', error));
}

function updateUserList() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    
    activeUsers.forEach(user => {
        if (user === username) return;
        
        const li = document.createElement('li');
        li.textContent = user;
        li.addEventListener('click', () => startPrivateChat(user));
        userList.appendChild(li);
    });
    
    if (userList.children.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhum usuário online';
        li.style.fontStyle = 'italic';
        li.style.color = '#888';
        li.style.cursor = 'default';
        userList.appendChild(li);
    }
}

function updateHashtagList() {
    const hashtagList = document.getElementById('hashtagList');
    hashtagList.innerHTML = '';
    
    popularHashtags.forEach(hashtag => {
        const li = document.createElement('li');
        li.textContent = hashtag;
        li.addEventListener('click', () => searchHashtag(hashtag));
        hashtagList.appendChild(li);
    });
    
    if (hashtagList.children.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma hashtag encontrada';
        li.style.fontStyle = 'italic';
        li.style.color = '#888';
        li.style.cursor = 'default';
        hashtagList.appendChild(li);
    }
}

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('close-tab')) {
      const tab = e.target.parentElement;
      const room = tab.dataset.room;
      delete chatRooms[room];
      tab.remove();
  
      if (currentRoom === room) {
        const tabs = document.querySelectorAll('.tab');
        if (tabs.length) {
          tabs[0].click();
        } else {
          document.getElementById('chat').innerHTML = '';
          currentRoom = null;
        }
      }
    }
});
  