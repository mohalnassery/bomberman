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
        // If already connected, return resolved promise
        if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        
        // If already connecting, return existing promise
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
            return new Promise((resolve, reject) => {
                this.socket.addEventListener('open', () => resolve());
                this.socket.addEventListener('error', (error) => reject(error));
            });
        }

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

        // Log incoming messages for debugging
        console.debug(`WebSocket received: ${type}`, payload);

        // Handle reconnection acknowledgment
        if (type === 'reconnect_ack') {
            this.handleReconnection(payload);
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

    handleReconnection(payload) {
        const { gameState, sessionId } = payload;
        if (gameState) {
            // Notify all handlers of game state sync
            const syncHandlers = this.handlers.get('gameState');
            if (syncHandlers) {
                syncHandlers.forEach(handler => handler(gameState));
            }
        }
    }

    send(type, data = {}) {
        if (!this.socket || !this.connected) {
            console.warn('Socket not connected, queueing message:', { type, data });
            this.pendingMessages.push({ type, data });
            return;
        }

        try {
            // Add timestamp to help with message ordering
            const message = JSON.stringify({
                type,
                payload: {
                    ...data,
                    timestamp: Date.now()
                }
            });
            
            this.socket.send(message);
            console.debug(`WebSocket sent: ${type}`, data);
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
            // Notify any error handlers
            const errorHandlers = this.handlers.get('error');
            if (errorHandlers) {
                errorHandlers.forEach(handler => 
                    handler(new Error('Max reconnection attempts reached'))
                );
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect()
                .then(() => {
                    // Request state sync after reconnection
                    this.send('requestSync', {
                        sessionId: localStorage.getItem('sessionId')
                    });
                })
                .catch(() => this.reconnect());
        }, delay);
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
