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
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

export class Chat {
    constructor(playerName) {
        this.playerName = playerName;
        this.messages = [];
        this.isMinimized = false;
        this.container = null;
        this.messageHandler = this.receiveMessage.bind(this);
        
        // Register WebSocket listener for chat messages
        webSocket.on('chatMessage', this.messageHandler);
    }

    initialize(container) {
        this.container = container;
        this.setupUI();
        this.setupEventListeners();
    }

    setupUI() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="chat">
                <div class="chat-header">
                    <span class="chat-title">Game Chat</span>
                    <div class="chat-controls">
                        <button class="minimize-btn">_</button>
                    </div>
                </div>
                <div class="chat-body">
                    <div id="chat-messages"></div>
                    <div class="chat-input-container">
                        <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200">
                        <button id="send-btn">Send</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        if (!this.container) return;
        const input = this.container.querySelector('#chat-input');
        const sendBtn = this.container.querySelector('#send-btn');
        const minimizeBtn = this.container.querySelector('.minimize-btn');

        if (input && sendBtn && minimizeBtn) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (e.target.value.trim()) {
                        this.sendMessage(e.target.value);
                        e.target.value = '';
                    }
                }
            });

            sendBtn.addEventListener('click', () => {
                if (input.value.trim()) {
                    this.sendMessage(input.value);
                    input.value = '';
                }
            });

            minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        }
    }

    sendMessage(message) {
        if (!message.trim()) return;

        const messageData = {
            message: this.sanitizeMessage(message),
            playerName: this.playerName,
            timestamp: new Date().toISOString()
        };

        console.log('Sending chat message:', messageData);
        // The message will be added when received back from server
        webSocket.send('chatMessage', messageData);
    }

    receiveMessage(data) {
        console.log('Received chat message:', data);
        // Add all received messages to chat
        this.addMessageToChat(data);
    }

    addMessageToChat(messageData) {
        console.log('Adding message to chat:', messageData);
        const messagesContainer = document.querySelector('#chat-messages');
        if (!messagesContainer) {
            console.error('Chat messages container not found');
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${messageData.playerName === this.playerName ? 'own' : ''}`;
        messageElement.innerHTML = `
            <span class="timestamp">${this.formatTime(messageData.timestamp)}</span>
            <span class="player-name">${messageData.playerName}:</span>
            <span class="message">${messageData.message}</span>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sanitizeMessage(message) {
        return message
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    toggleMinimize() {
        const chatBody = this.container.querySelector('.chat-body');
        if (chatBody) {
            this.isMinimized = !this.isMinimized;
            chatBody.style.display = this.isMinimized ? 'none' : 'flex';
        }
    }

    destroy() {
        // Clean up WebSocket listener
        webSocket.off('chatMessage', this.messageHandler);
        this.container = null;
    }
}
