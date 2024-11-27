import { WebSocketServer } from 'ws';
import os from 'os';
import fs from 'fs';
import path from 'path';

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const networkInterface of interfaces[name]) {
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
            players: new Map(),
            readyPlayers: new Set(),
            bombs: new Map(),
            powerUps: new Map(),
            blocks: new Set(),
            levelVotes: new Map(),
            selectedLevel: null,
            gameStatus: 'waiting',
            lastUpdateTime: Date.now(),
            grid: [],
            level: null
        };
        this.tickRate = 60;
        this.tickInterval = null;
        this.mapWidth = 15;
        this.mapHeight = 13;  // Match the level file dimensions
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

    startGameLoop() {
        if (this.tickInterval) return;
        
        const tickDuration = 1000 / this.tickRate;
        this.gameState.lastUpdateTime = Date.now();
        
        this.tickInterval = setInterval(() => {
            const currentTime = Date.now();
            const deltaTime = (currentTime - this.gameState.lastUpdateTime) / 1000;
            this.gameState.lastUpdateTime = currentTime;
            
            this.updateGameState(deltaTime);
            this.broadcastGameState();
        }, tickDuration);
    }

    stopGameLoop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    updateGameState(deltaTime) {
        // Update bomb timers and check for explosions
        for (const [bombId, bomb] of this.gameState.bombs) {
            bomb.timeRemaining -= deltaTime;
            if (bomb.timeRemaining <= 0) {
                this.handleBombExplosion(bombId, bomb);
            }
        }

        // Process player movements and reconcile positions
        for (const [playerId, player] of this.gameState.players) {
            if (player.pendingMoves && player.pendingMoves.length > 0) {
                // Process all pending moves in order
                while (player.pendingMoves.length > 0) {
                    const move = player.pendingMoves.shift();
                    this.validateAndUpdatePlayerPosition(playerId, move);
                }
            }
        }

        // Check win conditions
        if (this.gameState.gameStatus === 'running') {
            const alivePlayers = Array.from(this.gameState.players.values())
                .filter(p => !p.isDead);
            
            if (alivePlayers.length <= 1) {
                const winner = alivePlayers[0];
                this.endGame(winner);
            }
        }
    }

    validateAndUpdatePlayerPosition(playerId, moveData) {
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        const { position, timestamp } = moveData;
        
        // Basic validation of movement
        const dx = position.x - player.position.x;
        const dy = position.y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if movement is within reasonable bounds
        const maxAllowedDistance = player.speed * (Date.now() - timestamp) / 1000 * 1.5; // 50% tolerance
        
        if (distance <= maxAllowedDistance) {
            // Update position if valid
            player.position = position;
            player.lastMoveTimestamp = timestamp;
        } else {
            // If invalid, force position update to client
            this.broadcastToPlayer(playerId, 'forcePosition', {
                position: player.position,
                timestamp: Date.now()
            });
        }
    }

    handlePlayerMove(ws, data) {
        const { id, position, timestamp } = data;
        const player = this.gameState.players.get(id);
        
        if (!player) return;
        
        // Add move to pending moves queue
        if (!player.pendingMoves) {
            player.pendingMoves = [];
        }
        
        player.pendingMoves.push({ position, timestamp });
    }

    handleBombExplosion(bombId, bomb) {
        const affectedPositions = this.calculateExplosionArea(bomb.position, bomb.range);
        const chainReactionBombs = new Set();
        const destroyedBlocks = new Set();
        const affectedPlayers = new Set();
        
        // Process each position in the explosion range
        affectedPositions.forEach(pos => {
            const key = `${pos.x},${pos.y}`;
            
            // Check for blocks
            if (this.gameState.blocks.has(key)) {
                this.gameState.blocks.delete(key);
                destroyedBlocks.add(key);
                
                // Chance to spawn power-up
                if (Math.random() < 0.3) {
                    const powerUpType = this.getRandomPowerUpType();
                    this.gameState.powerUps.set(key, {
                        type: powerUpType,
                        position: pos
                    });
                }
            }
            
            // Check for chain reactions with other bombs
            const bombAtPosition = Array.from(this.gameState.bombs.values())
                .find(b => Math.floor(b.position.x) === pos.x && Math.floor(b.position.y) === pos.y);
            
            if (bombAtPosition && bombAtPosition.id !== bombId) {
                chainReactionBombs.add(bombAtPosition.id);
            }
            
            // Check for affected players
            this.gameState.players.forEach((player, playerId) => {
                if (player.isDead) return;
                
                const playerX = Math.floor(player.position.x);
                const playerY = Math.floor(player.position.y);
                
                if (playerX === pos.x && playerY === pos.y) {
                    affectedPlayers.add(playerId);
                }
            });
        });
        
        // Handle player damage
        affectedPlayers.forEach(playerId => {
            const player = this.gameState.players.get(playerId);
            if (player) {
                player.lives--;
                if (player.lives <= 0) {
                    player.isDead = true;
                    if (bomb.ownerId !== playerId) {
                        const killer = this.gameState.players.get(bomb.ownerId);
                        if (killer) {
                            killer.killCount++;
                        }
                    }
                }
            }
        });

        // Remove the exploded bomb
        this.gameState.bombs.delete(bombId);
        
        // Broadcast explosion event
        this.broadcast('bombExplosion', {
            bombId,
            affectedPositions,
            destroyedBlocks: Array.from(destroyedBlocks),
            affectedPlayers: Array.from(affectedPlayers),
            chainReaction: Array.from(chainReactionBombs),
            timestamp: Date.now()
        });

        // Trigger chain reactions
        if (chainReactionBombs.size > 0) {
            setTimeout(() => {
                chainReactionBombs.forEach(chainBombId => {
                    const chainBomb = this.gameState.bombs.get(chainBombId);
                    if (chainBomb) {
                        this.handleBombExplosion(chainBombId, chainBomb);
                    }
                });
            }, 100);
        }

        // Check game over condition
        this.checkGameOver();
    }

    getRandomPowerUpType() {
        const types = ['bomb', 'flame', 'speed'];
        return types[Math.floor(Math.random() * types.length)];
    }

    handlePowerUpCollection(playerId, powerUpKey) {
        const player = this.gameState.players.get(playerId);
        const powerUp = this.gameState.powerUps.get(powerUpKey);
        
        if (!player || !powerUp || player.isDead) return;
        
        // Apply power-up effect
        switch (powerUp.type) {
            case 'bomb':
                player.maxBombs = Math.min(player.maxBombs + 1, 8);
                break;
            case 'flame':
                player.flameRange = Math.min(player.flameRange + 1, 8);
                break;
            case 'speed':
                player.speed = Math.min(player.speed + 0.2, 2.5);
                break;
        }
        
        // Update statistics
        player.powerUpsCollected++;
        
        // Remove power-up from game state
        this.gameState.powerUps.delete(powerUpKey);
        
        // Broadcast power-up collection
        this.broadcast('powerUpCollected', {
            playerId,
            powerUpKey,
            type: powerUp.type,
            stats: {
                maxBombs: player.maxBombs,
                flameRange: player.flameRange,
                speed: player.speed,
                powerUpsCollected: player.powerUpsCollected
            },
            timestamp: Date.now()
        });
    }

    checkGameOver() {
        if (this.gameState.gameStatus !== 'running') return;

        const alivePlayers = Array.from(this.gameState.players.values())
            .filter(p => !p.isDead);
        
        if (alivePlayers.length <= 1) {
            const winner = alivePlayers[0];
            this.endGame(winner);
        }
    }

    endGame(winner) {
        this.gameState.gameStatus = 'ended';
        this.stopGameLoop();
        
        // Calculate final statistics
        const gameStats = Array.from(this.gameState.players.entries()).map(([id, player]) => ({
            id,
            name: player.name,
            kills: player.killCount,
            powerUps: player.powerUpsCollected,
            bombsPlaced: player.bombsPlaced,
            isWinner: winner && winner.id === id
        }));
        
        // Broadcast game over
        this.broadcast('gameOver', {
            winner: winner ? {
                id: winner.id,
                name: winner.name
            } : null,
            stats: gameStats,
            timestamp: Date.now()
        });
    }

    calculateExplosionArea(position, range) {
        const positions = [];
        const directions = [
            { x: 0, y: 1 },  // down
            { x: 0, y: -1 }, // up
            { x: 1, y: 0 },  // right
            { x: -1, y: 0 }  // left
        ];
        
        // Add center position
        positions.push({ x: Math.floor(position.x), y: Math.floor(position.y) });
        
        // Check each direction
        directions.forEach(dir => {
            for (let i = 1; i <= range; i++) {
                const x = Math.floor(position.x + (dir.x * i));
                const y = Math.floor(position.y + (dir.y * i));
                
                // Check map boundaries
                if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
                    break;
                }
                
                // Add position
                positions.push({ x, y });
                
                // Stop if we hit a wall
                const key = `${x},${y}`;
                if (this.gameState.blocks.has(key)) {
                    break;
                }
            }
        });
        
        return positions;
    }

    handleConnection(ws) {
        console.log('New client connected');
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                switch (data.type) {
                    case 'join':
                        this.handlePlayerJoin(ws, data.payload);
                        break;
                    case 'ready':
                        this.handlePlayerReady(ws, data.payload);
                        break;
                    case 'unready':
                        this.handlePlayerUnready(ws, data.payload);
                        break;
                    case 'voteLevel':
                        this.handleLevelVote(ws, data.payload);
                        break;
                    case 'requestSync':
                        this.handleSyncRequest(ws, data.payload);
                        break;
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });

        ws.on('close', () => {
            this.handlePlayerDisconnect(ws);
        });
    }

    handlePlayerJoin(ws, data) {
        const { nickname, sessionId } = data;
        ws.playerId = sessionId;
        
        const player = {
            id: sessionId,
            nickname,
            ready: false,
            votedLevel: null
        };
        
        this.gameState.players.set(sessionId, player);
        
        // Broadcast to all clients including new player
        this.broadcastMessage({
            type: 'playerJoined',
            payload: {
                player,
                playerCount: this.gameState.players.size
            }
        });

        // Send current game state to new player
        this.sendGameState(ws);
    }

    handlePlayerReady(ws, data) {
        const playerId = ws.playerId;
        if (!playerId) return;

        this.gameState.readyPlayers.add(playerId);
        
        // Check if all players are ready
        const allReady = Array.from(this.gameState.players.keys())
            .every(id => this.gameState.readyPlayers.has(id));
        
        if (allReady && this.gameState.players.size >= 2) {
            this.startGameCountdown();
        }

        this.broadcastGameState();
    }

    handlePlayerUnready(ws, data) {
        const player = this.gameState.players.get(ws.playerId);
        if (!player) return;

        player.ready = false;
        this.gameState.readyPlayers.delete(ws.playerId);

        this.broadcastMessage({
            type: 'playerUnready',
            payload: {
                playerId: ws.playerId,
                nickname: player.nickname
            }
        });
    }

    handleSyncRequest(ws, data) {
        this.sendGameState(ws);
    }

    sendGameState(ws) {
        // Ensure we have a selected level from votes if not already set
        if (!this.gameState.selectedLevel && this.gameState.levelVotes.size > 0) {
            this.gameState.selectedLevel = this.selectWinningLevel();
        }

        const gameState = {
            players: Array.from(this.gameState.players.values()),
            readyPlayers: Array.from(this.gameState.readyPlayers),
            levelVotes: Object.fromEntries(this.gameState.levelVotes),
            gameStatus: this.gameState.gameStatus,
            selectedLevel: this.gameState.selectedLevel,
            grid: this.gameState.grid,
            blocks: Array.from(this.gameState.blocks).map(block => {
                const [x, y] = block.split(',').map(Number);
                return { x, y };
            })
        };

        console.log('Sending game state with level:', gameState.selectedLevel);

        ws.send(JSON.stringify({
            type: 'gameState',
            payload: gameState
        }));
    }

    handlePlayerDisconnect(ws) {
        if (!ws.playerId) return;

        const player = this.gameState.players.get(ws.playerId);
        if (player) {
            this.gameState.players.delete(ws.playerId);
            this.gameState.readyPlayers.delete(ws.playerId);
            this.gameState.levelVotes.delete(ws.playerId);

            this.broadcastMessage({
                type: 'playerLeave',
                payload: {
                    playerId: ws.playerId,
                    playerCount: this.gameState.players.size
                }
            });
        }
    }

    broadcast(type, payload, excludePlayerId = null) {
        const message = JSON.stringify({ type, payload });
        this.wss.clients.forEach(client => {
            if (client.readyState === 1 && (!excludePlayerId || client.playerId !== excludePlayerId)) {
                client.send(message);
            }
        });
    }

    getSerializableGameState() {
        return {
            players: Array.from(this.gameState.players.entries()).map(([id, player]) => ({
                id,
                ...player,
                position: { ...player.position }
            })),
            bombs: Array.from(this.gameState.bombs.entries()).map(([id, bomb]) => ({
                id,
                ...bomb,
                position: { ...bomb.position }
            })),
            powerUps: Array.from(this.gameState.powerUps.entries()).map(([key, powerUp]) => ({
                key,
                ...powerUp,
                position: { ...powerUp.position }
            })),
            blocks: Array.from(this.gameState.blocks),
            gameStatus: this.gameState.gameStatus,
            selectedLevel: this.gameState.selectedLevel,
            timestamp: Date.now(),
            grid: this.gameState.grid,
            level: this.gameState.level
        };
    }

    generatePlayerId() {
        return Math.floor(Math.random() * 1000000).toString();
    }

    handlePlayerDisconnect(playerId) {
        // Implement player disconnection logic here
    }

    broadcastGameState() {
        const gameState = {
            players: Array.from(this.gameState.players.values()),
            readyPlayers: Array.from(this.gameState.readyPlayers),
            levelVotes: Object.fromEntries(this.gameState.levelVotes),
            gameStatus: this.gameState.gameStatus,
            selectedLevel: this.gameState.selectedLevel,
            grid: this.gameState.grid,
            level: this.gameState.level
        };

        this.broadcastMessage({
            type: 'gameState',
            payload: gameState
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
            case 'voteLevel':
                this.handleLevelVote(ws, payload);
                break;
            case 'move':
                this.handlePlayerMove(ws, payload);
                break;
            case 'bomb':
                this.handleBombPlacement(ws.playerId, payload);
                break;
            case 'chat':
                this.broadcastMessage({
                    type: 'chat',
                    payload: {
                        message: payload.message,
                        player: this.gameState.players.get(ws.playerId)?.nickname
                    }
                });
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    }

    handleBombPlacement(playerId, data) {
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        const bomb = {
            id: Date.now(),
            position: data.position,
            ownerId: player.id,
            range: player.powerUps.flames,
            timeRemaining: 3
        };

        this.gameState.bombs.set(bomb.id, bomb);

        // Broadcast bomb placement to all clients
        this.broadcastMessage({
            type: 'bombPlaced',
            payload: {
                bomb
            }
        });

        player.bombsPlaced++;
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

    broadcastMessage(message) {
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) { 
                client.send(JSON.stringify(message));
            }
        });
    }

    handleLevelVote(ws, data) {
        const { level, nickname } = data;
        const player = Array.from(this.gameState.players.values())
            .find(p => p.nickname === nickname);
        
        if (!player) {
            console.error('Player not found for level vote:', nickname);
            return;
        }

        console.log('Received level vote:', level, 'from player:', nickname);

        // Store the vote
        player.votedLevel = level;
        this.gameState.levelVotes.set(player.id, level);

        // Broadcast the vote
        this.broadcast('levelVoted', {
            playerId: player.id,
            nickname: player.nickname,
            level: level,
            timestamp: Date.now()
        });

        // Check if all players have voted
        this.checkLevelVotes();
    }

    checkLevelVotes() {
        if (this.gameState.gameStatus !== 'waiting') return;

        const players = Array.from(this.gameState.players.values());
        const readyPlayers = players.filter(p => p.ready);
        const votedPlayers = players.filter(p => p.votedLevel);

        // If all ready players have voted, select the winning level
        if (readyPlayers.length > 0 && readyPlayers.length === votedPlayers.length) {
            const selectedLevel = this.selectWinningLevel();
            this.gameState.selectedLevel = selectedLevel;

            // Broadcast selected level
            this.broadcast('levelSelected', {
                level: selectedLevel,
                votes: Object.fromEntries(this.gameState.levelVotes),
                timestamp: Date.now()
            });

            // Check if we can start the game
            this.checkGameStart();
        }
    }

    selectWinningLevel() {
        const votes = {};
        
        // Count votes for each level
        for (const [playerId, level] of this.gameState.levelVotes) {
            votes[level] = (votes[level] || 0) + 1;
        }

        // Find level(s) with most votes
        const maxVotes = Math.max(...Object.values(votes));
        const topLevels = Object.entries(votes)
            .filter(([_, count]) => count === maxVotes)
            .map(([level]) => level);

        // Randomly select from top voted levels
        const selectedLevel = topLevels[Math.floor(Math.random() * topLevels.length)];
        
        console.log('Selected winning level:', selectedLevel);
        
        return selectedLevel;
    }

    checkGameStart() {
        if (this.gameState.gameStatus !== 'waiting') return;

        const players = Array.from(this.gameState.players.values());
        const readyPlayers = players.filter(p => p.ready);

        // Check if we have enough players and all are ready
        if (readyPlayers.length >= 2 && readyPlayers.length === players.length) {
            // Start game countdown
            this.gameState.gameStatus = 'starting';
            this.broadcast('gameStarting', {
                countdown: 3,
                timestamp: Date.now()
            });

            // Start countdown
            let countdown = 3;
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    this.broadcast('gameStarting', {
                        countdown,
                        timestamp: Date.now()
                    });
                } else {
                    clearInterval(countdownInterval);
                    this.startGame();
                }
            }, 1000);
        }
    }

    startGame() {
        // Select the winning level if not already selected
        if (!this.gameState.selectedLevel) {
            this.gameState.selectedLevel = this.selectWinningLevel();
        }
        
        console.log('Starting game with selected level:', this.gameState.selectedLevel);
        
        this.gameState.gameStatus = 'running';
        
        // Initialize game state with selected level
        this.initializeLevel(this.gameState.selectedLevel);
        
        // Broadcast game start with selected level
        this.broadcast('gameStarted', {
            level: this.gameState.selectedLevel,
            playerCount: this.gameState.players.size,
            timestamp: Date.now()
        });

        this.startGameLoop();
    }

    async initializeLevel(levelName) {
        try {
            // Read the level file
            const levelPath = path.join(process.cwd(), 'src', 'levels', `${levelName}.TXT`);
            const levelData = await fs.promises.readFile(levelPath, 'utf8');
            
            // Initialize grid
            this.gameState.grid = [];
            this.gameState.blocks.clear();
            
            // Process level data
            const lines = levelData.split('\n')
                .map(line => line.trim())
                .filter(line => line);
            
            for (let y = 0; y < this.mapHeight; y++) {
                this.gameState.grid[y] = [];
                const line = lines[y] || '';
                
                for (let x = 0; x < this.mapWidth; x++) {
                    const char = line[x] || ' ';
                    this.gameState.grid[y][x] = {
                        type: 'empty',
                        powerUp: null
                    };
                    
                    switch (char) {
                        case '*':
                            this.gameState.grid[y][x].type = 'wall';
                            break;
                        case '-':
                            this.gameState.grid[y][x].type = 'block';
                            this.gameState.blocks.add(`${x},${y}`);
                            // 20% chance of power-up under block
                            if (Math.random() < 0.2) {
                                const powerUpType = this.getRandomPowerUpType();
                                this.gameState.powerUps.set(`${x},${y}`, {
                                    type: powerUpType,
                                    position: { x, y }
                                });
                            }
                            break;
                        case '1':
                        case '2':
                        case '3':
                        case '4':
                            // Keep track of spawn positions
                            this.gameState.grid[y][x].type = 'empty';
                            break;
                    }
                }
            }
            
            this.gameState.level = levelName;
            console.log(`Server: Level ${levelName} initialized`);
            
            // Broadcast the updated game state with the new level
            this.broadcast('levelLoaded', {
                level: levelName,
                grid: this.gameState.grid,
                blocks: Array.from(this.gameState.blocks),
                powerUps: Array.from(this.gameState.powerUps.entries()),
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('Error initializing level:', error);
            // Fall back to default empty map
            this.generateDefaultMap();
        }
    }

    generateDefaultMap() {
        this.gameState.grid = [];
        this.gameState.blocks.clear();
        
        for (let y = 0; y < this.mapHeight; y++) {
            this.gameState.grid[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                const isWall = x === 0 || x === this.mapWidth - 1 || 
                              y === 0 || y === this.mapHeight - 1;
                
                this.gameState.grid[y][x] = {
                    type: isWall ? 'wall' : 'empty',
                    powerUp: null
                };
            }
        }
        
        console.log('Server: Generated default map');
    }

    broadcastToPlayer(playerId, type, payload) {
        const message = JSON.stringify({ type, payload });
        this.wss.clients.forEach(client => {
            if (client.readyState === 1 && client.playerId === playerId) {
                client.send(message);
            }
        });
    }

    startGameCountdown() {
        if (this.gameState.gameStatus !== 'waiting') return;
        
        this.gameState.gameStatus = 'countdown';
        let countdown = 3;
        
        const timer = setInterval(() => {
            if (countdown <= 0) {
                clearInterval(timer);
                this.gameState.gameStatus = 'running';
                this.broadcastGameState();
            } else {
                this.broadcastMessage({
                    type: 'gameStarting',
                    payload: { countdown }
                });
                countdown--;
            }
        }, 1000);
    }
}

// Start the server
const gameServer = new GameServer();
