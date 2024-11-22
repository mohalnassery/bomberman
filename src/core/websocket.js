// src/core/websocket.js

class WebSocketService {
    constructor() {
        this.socket = null;
        this.handlers = new Map();
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.serverUrl = this.getWebSocketUrl();
        this.pendingMessages = [];
    }

    getWebSocketUrl() {
        const host = window.location.hostname;
        const port = '8080';
        return `ws://${host}:${port}`;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Connecting to:', this.serverUrl);
                this.socket = new WebSocket(this.serverUrl);
                
                this.socket.addEventListener('open', () => {
                    console.log('Connected to game server');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // Send any pending messages
                    while (this.pendingMessages.length > 0) {
                        const msg = this.pendingMessages.shift();
                        this.send(msg.type, msg.data);
                    }
                    
                    resolve();
                });

                this.socket.addEventListener('message', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                });

                this.socket.addEventListener('close', () => {
                    this.connected = false;
                    console.log('Disconnected from server');
                    this.reconnect();
                });

                this.socket.addEventListener('error', (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    handleMessage(data) {
        const { type, payload } = data;
        if (!type) {
            console.error('Invalid message format:', data);
            return;
        }

        const handlers = this.handlers.get(type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(payload);
                } catch (error) {
                    console.error(`Error in handler for ${type}:`, error);
                }
            });
        }
    }

    send(type, data = {}) {
        if (!this.socket || !this.connected) {
            console.warn('Socket not connected, queueing message:', { type, data });
            this.pendingMessages.push({ type, data });
            return;
        }

        try {
            const message = JSON.stringify({ type, payload: data });
            this.socket.send(message);
        } catch (error) {
            console.error('Error sending message:', error);
            this.pendingMessages.push({ type, data });
        }
    }

    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type).add(handler);
    }

    off(type, handler) {
        if (this.handlers.has(type)) {
            this.handlers.get(type).delete(handler);
        }
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        setTimeout(() => {
            this.connect().catch(() => this.reconnect());
        }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.connected = false;
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.close();
        }
        this.handlers.clear();
        this.connected = false;
        this.pendingMessages = [];
    }
}

// Create a singleton instance
const webSocket = new WebSocketService();
export default webSocket;
