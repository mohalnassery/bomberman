// src/core/websocket.js

class WebSocketService {
    constructor() {
        this.socket = null;
        this.handlers = new Map();
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.serverUrl = this.getWebSocketUrl();
    }

    getWebSocketUrl() {
        const host = window.location.hostname;
        const port = '8080'; // WebSocket server port
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
                    this.handleDisconnect();
                });

                this.socket.addEventListener('error', (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Connection error:', error);
                reject(error);
            }
        });
    }

    handleMessage(data) {
        const handler = this.handlers.get(data.type);
        if (handler) {
            handler(data);
        }
    }

    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('Attempting to reconnect...');
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    on(type, handler) {
        this.handlers.set(type, handler);
    }

    send(type, data) {
        if (!this.connected) {
            console.warn('Not connected to server');
            return;
        }
        
        try {
            const message = JSON.stringify({ type, ...data });
            this.socket.send(message);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Create a singleton instance
const webSocket = new WebSocketService();
export default webSocket;
