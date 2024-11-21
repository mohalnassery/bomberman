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
        switch (data.type) {
            case 'join':
                this.handlePlayerJoin(ws, data);
                break;
            case 'move':
                this.handlePlayerMove(ws, data);
                break;
            case 'bomb':
                this.handleBombPlacement(ws, data);
                break;
            case 'chat':
                this.broadcastMessage({
                    type: 'chat',
                    message: data.message,
                    player: this.players.get(ws)?.nickname
                });
                break;
            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    handlePlayerJoin(ws, data) {
        const { nickname } = data;
        if (this.gameState.players.length >= 4) {
            ws.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
            return;
        }

        const player = {
            id: this.gameState.players.length + 1,
            nickname,
            position: this.getStartPosition(this.gameState.players.length),
            lives: 3,
            powerUps: {
                bombs: 1,
                flames: 1,
                speed: 1
            }
        };

        this.players.set(ws, player);
        this.gameState.players.push(player);

        // Send initial game state to the new player
        ws.send(JSON.stringify({
            type: 'init',
            gameState: this.gameState,
            playerId: player.id
        }));

        // Broadcast updated player list to all clients
        this.broadcastMessage({
            type: 'playerJoin',
            player
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
            playerId: player.id,
            position: data.position
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
            bomb
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
            bomb,
            affected
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
            playerId: player.id
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

    broadcastMessage(message, exclude = null) {
        this.wss.clients.forEach(client => {
            if (client !== exclude && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

// Start the server
const gameServer = new GameServer();
