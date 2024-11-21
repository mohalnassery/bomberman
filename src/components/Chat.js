// src/components/Chat.js
import { $ } from '../utils/helpers.js';
import webSocket from '../core/websocket.js';

function purifyText(text) {
    // Convert special characters to HTML entities
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        // Optional: Remove any control characters and non-printable characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

export class Chat {
    constructor(playerName) {
        this.playerName = playerName;
        this.messages = [];
        this.isMinimized = false;
        this.dragState = {
            isDragging: false,
            startX: 0,
            startY: 0
        };
    }

    initialize() {
        this.setupUI();
        this.setupWebSocket();
        this.setupDragAndDrop();
    }

    setupWebSocket() {
        webSocket.on('chatMessage', this.receiveMessage.bind(this));
        webSocket.on('playerJoined', (data) => {
            this.systemMessage(`${data.playerName} joined the game`);
        });
        webSocket.on('playerLeft', (data) => {
            this.systemMessage(`${data.playerName} left the game`);
        });
    }

    setupUI() {
        const root = $('#root');
        const chatHtml = `
            <div class="chat" id="chat-window">
                <div class="chat-header">
                    <span class="chat-title">Chat</span>
                    <div class="chat-controls">
                        <button class="minimize-btn">_</button>
                        <button class="close-btn">×</button>
                    </div>
                </div>
                <div class="chat-body">
                    <div id="chat-messages"></div>
                    <div class="chat-input-container">
                        <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200" />
                        <button id="send-btn">Send</button>
                    </div>
                </div>
            </div>
        `;
        root.insertAdjacentHTML('beforeend', chatHtml);

        // Event listeners
        $('#chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(e.target.value);
                e.target.value = '';
            }
        });

        $('#send-btn').addEventListener('click', () => {
            const input = $('#chat-input');
            this.sendMessage(input.value);
            input.value = '';
        });

        $('.minimize-btn').addEventListener('click', () => this.toggleMinimize());
        $('.close-btn').addEventListener('click', () => this.toggleMinimize(true));
    }

    setupDragAndDrop() {
        const chatWindow = $('#chat-window');
        const header = $('.chat-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            
            this.dragState = {
                isDragging: true,
                startX: e.clientX - chatWindow.offsetLeft,
                startY: e.clientY - chatWindow.offsetTop
            };
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.dragState.isDragging) return;

            const newX = e.clientX - this.dragState.startX;
            const newY = e.clientY - this.dragState.startY;

            // Keep window within viewport bounds
            const maxX = window.innerWidth - chatWindow.offsetWidth;
            const maxY = window.innerHeight - chatWindow.offsetHeight;
            
            chatWindow.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
            chatWindow.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            this.dragState.isDragging = false;
        });
    }

    toggleMinimize(forceClose = false) {
        const chatWindow = $('#chat-window');
        this.isMinimized = forceClose || !this.isMinimized;
        chatWindow.classList.toggle('minimized', this.isMinimized);
    }

    sendMessage(message) {
        message = message.trim();
        if (message === '') return;

        // Sanitize input using our custom purify function
        message = purifyText(message);
        
        webSocket.send('chatMessage', {
            message,
            playerName: this.playerName,
            timestamp: new Date().toISOString()
        });
    }

    systemMessage(message) {
        this.messages.push({
            type: 'system',
            message,
            timestamp: new Date().toISOString()
        });
        this.render();
    }

    receiveMessage(data) {
        this.messages.push({
            type: 'chat',
            playerName: data.playerName,
            message: data.message,
            timestamp: data.timestamp
        });
        this.render();
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    render() {
        const chatMessages = $('#chat-messages');
        chatMessages.innerHTML = this.messages.map(msg => {
            if (msg.type === 'system') {
                return `<div class="chat-message system">
                    <span class="timestamp">${this.formatTimestamp(msg.timestamp)}</span>
                    <span class="message">${msg.message}</span>
                </div>`;
            }
            return `<div class="chat-message ${msg.playerName === this.playerName ? 'own' : ''}">
                <span class="timestamp">${this.formatTimestamp(msg.timestamp)}</span>
                <span class="player-name">${msg.playerName}:</span>
                <span class="message">${msg.message}</span>
            </div>`;
        }).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
