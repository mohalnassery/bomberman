// src/components/Chat.js
import { $ } from '../utils/helpers.js';

export class Chat {
    constructor() {
        this.socket = null;
        this.messages = [];
    }

    initialize() {
        this.setupUI();
        this.socket = new WebSocket('ws://localhost:8080');
        this.socket.addEventListener('open', () => {
            console.log('Connected to chat server');
        });
        this.socket.addEventListener('message', this.receiveMessage.bind(this));
    }

    setupUI() {
        const root = $('#root');
        const chatHtml = `
            <div class="chat">
                <div id="chat-messages"></div>
                <input type="text" id="chat-input" placeholder="Type a message..." />
            </div>
        `;
        root.insertAdjacentHTML('beforeend', chatHtml);
        $('#chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage(e.target.value);
                e.target.value = '';
            }
        });
    }

    sendMessage(message) {
        if (message.trim() === '') return;
        this.socket.send(JSON.stringify({ message }));
    }

    receiveMessage(event) {
        const data = JSON.parse(event.data);
        this.messages.push(data.message);
        this.render();
    }

    render() {
        const chatMessages = $('#chat-messages');
        chatMessages.innerHTML = this.messages.map(msg => `<p>${msg}</p>`).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
