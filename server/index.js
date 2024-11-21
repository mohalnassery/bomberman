import { WebSocketServer } from 'ws';
import os from 'os';

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const networkInterface of interfaces[name]) {
            // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                return networkInterface.address;
            }
        }
    }
    return 'localhost';
}

class GameServer {
    constructor(port = 8080) {
        this.port = port;
        this.players = new Map();
        this.gameState = {
            players: [],
            bombs: [],
            powerUps: [],
            blocks: []
        };
        this.setupServer();
    }

    setupServer() {
        const localIP = getLocalIP();
        this.wss = new WebSocketServer({ 
            port: this.port,
            perMessageDeflate: false, // Disable per-message deflate to prevent 426 error
            clientTracking: true // Enable client tracking
        });
        
        console.log(`WebSocket server is running on:`);
        console.log(`- Local: ws://localhost:${this.port}`);
        console.log(`- Network: ws://${localIP}:${this.port}`);

        this.wss.on('connection', this.handleConnection.bind(this));
    }

    handleConnection(ws) {
        console.log('New client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('Received message:', data);
                this.handleMessage(ws, data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('close', () => {
            this.handleDisconnection(ws);
        });
    }

    handleMessage(ws, data) {
        const { type, payload } = data;
        console.log('Handling message:', type, payload);

        switch (type) {
            case 'join':
                this.handlePlayerJoin(ws, payload);
                break;
            case 'ready':
                this.handlePlayerReady(ws, payload);
                break;
            case 'unready':
                this.handlePlayerUnready(ws, payload);
                break;
            case 'move':
                this.handlePlayerMove(ws, payload);
                break;
            case 'bomb':
                this.handleBombPlacement(ws, payload);
                break;
            case 'chat':
                this.broadcastMessage({
                    type: 'chat',
                    payload: {
                        message: payload.message,
                        player: this.players.get(ws)?.nickname
                    }
                });
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    }

    handlePlayerJoin(ws, data) {
        console.log('Processing join request:', data);
        const { nickname, sessionId } = data;
        
        // Validate data
        if (!nickname || !sessionId) {
            console.error('Invalid join data:', data);
            ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { 
                    message: 'Invalid join request: missing nickname or sessionId' 
                }
            }));
            return;
        }

        // Check max players
        if (this.gameState.players.length >= 4) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { 
                    message: 'Game is full' 
                }
            }));
            return;
        }

        // Check for duplicate nicknames
        if (this.gameState.players.some(p => p.nickname === nickname)) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { 
                    message: 'Nickname already taken' 
                }
            }));
            return;
        }

        console.log('Creating new player:', nickname, sessionId);
        const player = {
            id: sessionId,
            nickname,
            position: this.getStartPosition(this.gameState.players.length),
            lives: 3,
            powerUps: {
                bombs: 1,
                flames: 1,
                speed: 1
            },
            ready: false
        };

        this.players.set(ws, player);
        this.gameState.players.push(player);

        console.log('Current players:', this.gameState.players);

        // Send current game state to the new player
        ws.send(JSON.stringify({
            type: 'gameState',
            payload: {
                players: this.gameState.players,
                readyPlayers: Array.from(this.players.values())
                    .filter(p => p.ready)
                    .map(p => p.id)
            }
        }));

        // Broadcast new player to all clients
        this.broadcastMessage({
            type: 'playerJoined',
            payload: {
                player
            }
        });
    }

    handlePlayerReady(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        player.ready = true;
        this.broadcastMessage({
            type: 'playerReady',
            payload: {
                playerId: player.id
            }
        });

        // Check if all players are ready to start the game
        this.checkGameStart();
    }

    handlePlayerUnready(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        player.ready = false;
        this.broadcastMessage({
            type: 'playerUnready',
            payload: {
                playerId: player.id
            }
        });
    }

    handlePlayerMove(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        // Update player position
        player.position = data.position;
        
        // Broadcast movement to all clients except sender
        this.broadcastMessage({
            type: 'playerMove',
            payload: {
                playerId: player.id,
                position: data.position
            }
        }, ws);
    }

    handleBombPlacement(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        const bomb = {
            id: Date.now(),
            position: data.position,
            playerId: player.id,
            range: player.powerUps.flames
        };

        this.gameState.bombs.push(bomb);

        // Broadcast bomb placement to all clients
        this.broadcastMessage({
            type: 'bombPlaced',
            payload: {
                bomb
            }
        });

        // Schedule bomb explosion
        setTimeout(() => {
            this.handleBombExplosion(bomb);
        }, 3000);
    }

    handleBombExplosion(bomb) {
        // Remove bomb from game state
        this.gameState.bombs = this.gameState.bombs.filter(b => b.id !== bomb.id);

        // Calculate explosion area and affected players/blocks
        const affected = this.calculateExplosionEffects(bomb);

        // Broadcast explosion to all clients
        this.broadcastMessage({
            type: 'bombExplode',
            payload: {
                bomb,
                affected
            }
        });
    }

    handleDisconnection(ws) {
        const player = this.players.get(ws);
        if (!player) return;

        // Remove player from game state
        this.gameState.players = this.gameState.players.filter(p => p.id !== player.id);
        this.players.delete(ws);

        // Broadcast player disconnection
        this.broadcastMessage({
            type: 'playerLeave',
            payload: {
                playerId: player.id
            }
        });
    }

    calculateExplosionEffects(bomb) {
        // Implement explosion range and collision detection
        // Return affected players, blocks, and other bombs
        return {
            players: [],
            blocks: [],
            bombs: []
        };
    }

    getStartPosition(playerIndex) {
        const positions = [
            { x: 1, y: 1 },
            { x: 13, y: 1 },
            { x: 1, y: 11 },
            { x: 13, y: 11 }
        ];
        return positions[playerIndex] || positions[0];
    }

    checkGameStart() {
        const players = Array.from(this.players.values());
        if (players.length >= 2 && players.every(p => p.ready)) {
            this.broadcastMessage({
                type: 'gameStarting',
                payload: {
                    countdown: 5
                }
            });
        }
    }

    broadcastMessage(message, exclude = null) {
        this.wss.clients.forEach(client => {
            if (client !== exclude && client.readyState === 1) { 
                client.send(JSON.stringify(message));
            }
        });
    }
}

// Start the server
const gameServer = new GameServer();
