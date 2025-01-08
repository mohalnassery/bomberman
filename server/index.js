import { WebSocketServer } from 'ws';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { count } from 'console';

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
        this.gameState = {
            players: new Map(),
            readyPlayers: new Set(),
            bombs: new Map(),
            levelVotes: new Map(),
            selectedLevel: null,
            gameStatus: 'waiting',
            lastUpdateTime: Date.now(),
            grid: []
        };
        this.tickRate = 60;
        this.tickInterval = null;
        this.mapWidth = 15;
        this.mapHeight = 13;  // Match the level file dimensions
        this.waitingTimer = null;
        this.startTimer = null;
        this.waitingInterval = null;
        this.startInterval = null;
        this.chatMessages = []; // Add this to store chat history
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


    // -- GAME LOOP FUNCTIONS -- 

    startGame() {
        // Select the winning level if not already selected
        if (!this.gameState.selectedLevel) {
            this.gameState.selectedLevel = this.selectWinningLevel();
        }
        
        console.log('Starting game with selected level:', this.gameState.selectedLevel);
        
        this.gameState.gameStatus = 'running';
        
        // Initialize game state with selected level
        this.initializeLevel(this.gameState.selectedLevel)
            .then(this.broadcastGameState.bind(this))
            .then(this.startGameLoop.bind(this))
        
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
            //this.broadcastGameState();
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
        // Removed check win condition because that is already being checked after explosions
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

    // -- GAME ACTION HANDLERS --

    // recieve move request and shares it with the rest
    handlePlayerMove(ws, data) {
        const playerId = ws.playerId;
        if (!playerId) {
            console.log('No playerId found for movement');
            return;
        }

        const player = this.gameState.players.get(playerId);
        if (!player) {
            console.log('No player found for movement');
            return;
        }

        // Update player position in server's game state
        player.position = data.position;
        console.log(`Server: Player ${playerId} moved to:`, data.position);

        // Broadcast to ALL clients including sender
        this.broadcast('playerMove', {
            playerId: playerId,
            position: data.position,
            timestamp: Date.now()
        })

        const playerX = Math.round(player.position.x);
        const playerY = Math.round(player.position.y);
        if (this.gameState.grid[playerY][playerX].type && this.gameState.grid[playerY][playerX].type === 'powerup') {
            this.handlePowerUpCollection(playerId,playerX,playerY)
        }

    }

    handleBombPlacement(ws, data) {
        const playerId = ws.playerId;
        const position = data.position;
        if (!position || this.gameState.grid[position.y][position.x].bomb) return;
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        const bomb = {
            id: this.gameState.bombs.size+1,
            position: position,
            playerId: playerId,
            range: data.range,
            timeRemaining: 3
        };

        this.gameState.bombs.set(bomb.id, bomb);
        this.gameState.grid[bomb.position.y][bomb.position.x].bomb = bomb

        player.bombsPlaced++;
        player.activeBombs++;

        console.log("bomb placed successfully", data)

        // Broadcast bomb placement to all clients
        this.broadcast('bombPlaced', bomb);
    }

    handleBombExplosion(bombId, bomb) {
        console.log("BOOOM")
        const affectedPositions = this.calculateExplosionArea(bomb.position, bomb.range);
        const chainReactionBombs = new Set();
        const destroyedBlocks = new Set();
        const affectedPlayers = new Set();

        
        const bomber = this.gameState.players.get(bomb.playerId)
        bomber.activeBombs--
        // Process each position in the explosion range
        affectedPositions.forEach(pos => {
            
            // Check for blocks
            if (this.gameState.grid[pos.y][pos.x].type === 'block') {
                destroyedBlocks.add(`${pos.x},${pos.y}`);
                if (this.gameState.grid[pos.y][pos.x].powerUp) {
                    this.gameState.grid[pos.y][pos.x].type = "powerup"
                } else {
                    this.gameState.grid[pos.y][pos.x].type = "empty"
                }
            } else {
                console.log(this.gameState.grid[pos.y][pos.x].type)
            }
            
            // Check for chain reactions with other bombs
            const bombAtPosition = this.gameState.grid[pos.y][pos.x].bomb;
            if (bombAtPosition) {
                chainReactionBombs.add(bombAtPosition.id);
            }
            
            // Maybe we can also keep track of players in the grid? might be overcomplicating other stuff by doing that though
            // Check for affected players
            this.gameState.players.forEach((player, playerId) => {
                if (!player.isDead && Math.round(player.position.x) === pos.x && Math.round(player.position.y) === pos.y) {
                    affectedPlayers.add(playerId);
                    player.lives--;
                    player.position = player.spawnPosition
                    if (player.lives <= 0) {
                        player.isDead = true;
                        if (bomb.playerId !== playerId) {
                            bomber.killCount++;
                        }
                    }
                }
            });
        });
        

        // Remove the exploded bomb
        this.gameState.grid[bomb.position.y][bomb.position.x].bomb = null
        this.gameState.bombs.delete(bombId);
        
        console.log("send explosion")
        // Broadcast explosion event
        this.broadcast('bombExplosion', {
            bombId,
            affectedPositions,
            destroyedBlocks: Array.from(destroyedBlocks),
            affectedPlayers: Array.from(affectedPlayers),
            chainReaction: Array.from(chainReactionBombs),
            bomberId: bomb.playerId,
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

    handlePowerUpCollection(playerId, powerUpX, powerUpY) {
        const player = this.gameState.players.get(playerId);
        const powerUpCell = this.gameState.grid[powerUpY][powerUpX]
        
        if (!player || player.isDead || powerUpCell.type !== "powerup" || !powerUpCell.powerUp) return;
        
        // Apply power-up effect
        switch (powerUpCell.powerUp) {
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
        
        // Broadcast power-up collection
        this.broadcast('powerUpCollected', {
            playerId,
            position: {
                x: powerUpX,
                y: powerUpY
            },
            type: powerUpCell.powerUp,
            stats: {
                maxBombs: player.maxBombs,
                flameRange: player.flameRange,
                speed: player.speed,
                powerUpsCollected: player.powerUpsCollected
            },
            timestamp: Date.now()
        });

        // Remove power-up from game state
        this.gameState.grid[powerUpY][powerUpX] = {
            type: "empty",
            powerUp: null
        }
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
        positions.push({ x: Math.round(position.x), y: Math.round(position.y) });
        
        // Check each direction
        directions.forEach(dir => {
            for (let i = 1; i <= range; i++) {
                const x = Math.round(position.x + (dir.x * i));
                const y = Math.round(position.y + (dir.y * i));
                
                // Check map boundaries
                if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight || this.gameState.grid[y][x] === "wall") {
                    break;
                }
                
                // Add position
                positions.push({ x, y });
                
                // Stop if we hit a wall
                if (this.gameState.grid[y][x] === 'block') {
                    break;
                }
            }
        });
        
        return positions;
    }

    // -- WEBSOCKET ASSIGNMENTS ---

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
                    case 'playerMove':  // Add this case
                        console.log('Handling player move');
                        this.handlePlayerMove(ws, data.payload);
                        break;
                    case 'placeBomb':
                        this.handleBombPlacement(ws, data.payload)
                        break;
                    case 'requestSync':
                        this.sendGameState(ws);
                        break;
                    case 'chatMessage':
                        this.handleChatMessage(ws, data.payload);
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
    
    broadcast(type, payload, excludePlayerId = null) {
        const message = JSON.stringify({ type, payload });
        this.wss.clients.forEach(client => {
            if (client.readyState === 1 && (!excludePlayerId || client.playerId !== excludePlayerId)) {
                try {
                    client.send(message);
                    console.log(`Broadcasting ${type} to ${client.playerId}`);
                } catch (error) {
                    console.error('Error broadcasting message:', error);
                }
            }
        });
    }
    

    broadcastGameState() {
        const gameState = {
            players: Array.from(this.gameState.players.values()),
            readyPlayers: Array.from(this.gameState.readyPlayers),
            levelVotes: Object.fromEntries(this.gameState.levelVotes),
            gameStatus: this.gameState.gameStatus,
            selectedLevel: this.gameState.selectedLevel,
            grid: this.gameState.grid
        };

        this.broadcast('gameState', gameState);
    }
    
    // we can probably replace this with broadcastState, revisit once the starting game stuff is clear to me
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
            grid: this.gameState.grid
        };

        console.log('Sending game state with level:', gameState.selectedLevel);

        ws.send(JSON.stringify({
            type: 'gameState',
            payload: gameState
        }));
    }

    // -- LOBBY LISTENERS -- 

    handlePlayerJoin(ws, data) {
        const { nickname, sessionId } = data;
        ws.playerId = sessionId;
        
        const player = {
            id: sessionId,
            nickname,
            ready: false,
            votedLevel: null
        };

        if (this.gameState.players.size >= 4) {
            ws.send(JSON.stringify({
                type: 'playerDenied',
                payload: {message: "Room Full"}
            }));
            return;
        }
        
        // Add new player to game state
        this.gameState.players.set(sessionId, player);
        
        // Create a synchronized state for the new player
        const syncState = {
            players: Array.from(this.gameState.players.values()),
            readyPlayers: Array.from(this.gameState.readyPlayers),
            levelVotes: Object.fromEntries(this.gameState.levelVotes),
            selectedLevel: this.gameState.selectedLevel,
            playerCount: this.gameState.players.size,
            waitingTimer: this.waitingTimer,
            startTimer: this.startTimer
        };

        // Send synchronized state to the new player
        ws.send(JSON.stringify({
            type: 'syncPlayers',
            payload: syncState
        }));
        
        // Then broadcast to all clients including new player
        this.broadcast('playerJoined', {
            player,
            playerCount: this.gameState.players.size
        });

        // Update timers based on player count
        this.updateTimers();
    }

    // CHECK PLAYER ID
    handlePlayerReady(ws, data) {
        const playerId = ws.playerId;
        if (!playerId) return;

        const player = this.gameState.players.get(playerId);
        if (!player) return;

        // Toggle ready state
        if (this.gameState.readyPlayers.has(playerId)) {
            this.gameState.readyPlayers.delete(playerId);
            player.ready = false;
        } else {
            this.gameState.readyPlayers.add(playerId);
            player.ready = true;
        }

        const readyCount = this.gameState.readyPlayers.size;
        console.log('Ready players count:', readyCount); // Debug log

        // First broadcast the ready state
        this.broadcast('playerReady', {
            playerId,
            ready: player.ready,
            readyCount
        });

        // Then handle timer logic based on ready count
        if (readyCount >= 2) {
            if (readyCount === 4) {
                // Skip waiting timer and go straight to game countdown
                this.startGameCountdown();
            } else {
                // Start or continue waiting timer for 2-3 players
                this.startWaitingPhase();
            }
        } else {
            // Clear timers if less than 2 players ready
            this.clearTimers();
            this.broadcast('timerUpdate', {
                waitingTimer: null,
                startTimer: null,
                readyCount
            });
        }
    }

    handlePlayerUnready(ws, data) {
        const player = this.gameState.players.get(ws.playerId);
        if (!player) return;

        player.ready = false;
        this.gameState.readyPlayers.delete(ws.playerId);

        this.broadcast('playerUnready', {
                playerId: ws.playerId,
                nickname: player.nickname
            });
    }

    handlePlayerDisconnect(ws) {
        if (!ws.playerId) return;

        const player = this.gameState.players.get(ws.playerId);
        if (player) {
            this.gameState.players.delete(ws.playerId);
            this.gameState.readyPlayers.delete(ws.playerId);
            this.gameState.levelVotes.delete(ws.playerId);

            this.broadcast('playerLeave',{
                    playerId: ws.playerId,
                    playerCount: this.gameState.players.size
                });
        }
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
        
        if (this.checkAllReady()) {
            this.startGameCountdown();
        }
    }

    checkAllReady() {
        // Check if we have enough players and all are ready
        const allReady = Array.from(this.gameState.players.keys())
            .every(id => this.gameState.readyPlayers.has(id));
        return (allReady && this.gameState.players.size >= 2)
    }

    async initializeLevel(levelName) {
        try {
            // Read the level file
            const levelPath = path.join(process.cwd(), 'src', 'levels', `${levelName}.TXT`);
            const levelData = await fs.promises.readFile(levelPath, 'utf8');
            
            // Initialize grid
            this.gameState.grid = [];
            
            // Process level data
            const lines = levelData.split('\n')
                .map(line => line.trim())
                .filter(line => line);

            const spawnPositions = new Array(4)
            
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
                            // 20% chance of power-up under block
                            if (Math.random() < 0.3) {
                                const types = ['bomb', 'flame', 'speed'];
                                this.gameState.grid[y][x].powerUp = types[Math.floor(Math.random() * types.length)];
                            }
                            break;
                        case '1':
                        case '2':
                        case '3':
                        case '4':
                            // Keep track of spawn positions
                            this.gameState.grid[y][x].playerStart = char;
                            this.gameState.grid[y][x].type = 'empty';
                            const playerId = parseInt(char)
                            spawnPositions[playerId - 1] = {x,y}
                            break;
                        default:
                            this.gameState.grid[y][x].type = 'empty';
                            break;
                    }
                }
            }

            // apply spawn points
            this.gameState.players.forEach((player) => {
                player.spawnPosition = spawnPositions.shift()
                player.position = player.spawnPosition
            })
            
            this.gameState.level = levelName;
            console.log(`Server: Level ${levelName} initialized`);
            console.log(this.gameState.grid)
            
            // Broadcast the updated game state with the new level
            //this.broadcast('levelLoaded', {
            //    level: levelName,
            //    grid: this.gameState.grid,
            //    timestamp: Date.now()
            //});
            
        } catch (error) {
            console.error('Error initializing level:', error);
            // Fall back to default empty map
            this.generateDefaultMap();
        }
    }

    generateDefaultMap() {
        this.gameState.grid = []
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

    startGameCountdown() {
        const readyCount = this.gameState.readyPlayers.size;
        
        // Clear waiting timer if it exists
        if (this.waitingInterval) {
            clearInterval(this.waitingInterval);
            this.waitingInterval = null;
        }

        this.waitingTimer = null;
        this.startTimer = 10;

        // Broadcast initial countdown state
        this.broadcast('timerUpdate', {
            waitingTimer: null,
            startTimer: this.startTimer,
            readyCount
        });

        this.startInterval = setInterval(() => {
            this.startTimer--;
            
            // Broadcast countdown update
            this.broadcast('timerUpdate', {
                waitingTimer: null,
                startTimer: this.startTimer,
                readyCount
            });

            if (this.startTimer <= 0) {
                clearInterval(this.startInterval);
                this.startGame();
            }
        }, 1000);
    }

    clearTimers() {
        if (this.waitingInterval) {
            clearInterval(this.waitingInterval);
            this.waitingInterval = null;
        }
        if (this.startInterval) {
            clearInterval(this.startInterval);
            this.startInterval = null;
        }
        this.waitingTimer = null;
        this.startTimer = null;
    }

    startWaitingPhase() {
        const readyCount = this.gameState.readyPlayers.size;

        // Clear any existing timers
        this.clearTimers();

        // If 4 players are ready, skip waiting phase
        if (readyCount === 4) {
            this.startGameCountdown();
            return;
        }

        // Start 20s waiting timer for 2-3 players
        this.waitingTimer = 20;
        
        // Broadcast initial timer state
        this.broadcast('timerUpdate', {
            waitingTimer: this.waitingTimer,
            startTimer: null,
            readyCount
        });

        this.waitingInterval = setInterval(() => {
            this.waitingTimer--;
            
            // Broadcast current timer state
            this.broadcast('timerUpdate', {
                waitingTimer: this.waitingTimer,
                startTimer: null,
                readyCount
            });

            if (this.waitingTimer <= 0) {
                clearInterval(this.waitingInterval);
                this.startGameCountdown();
            }
        }, 1000);
    }

    updateTimers() {
        const readyPlayerCount = this.gameState.readyPlayers.size;
        console.log('Ready players:', readyPlayerCount); // Debug log

        // Clear any existing timers
        if (this.waitingInterval) clearInterval(this.waitingInterval);
        if (this.startInterval) clearInterval(this.startInterval);
        
        // Reset timers
        this.waitingTimer = null;
        this.startTimer = null;

        // Handle different ready player counts
        if (readyPlayerCount >= 2 && readyPlayerCount < 4) {
            // Start 20s waiting timer
            this.waitingTimer = 20;
            console.log('Starting waiting timer:', this.waitingTimer); // Debug log

            // Broadcast initial state
            this.broadcast('timerUpdate', {
                waitingTimer: this.waitingTimer,
                startTimer: null,
                readyPlayerCount
            });

            this.waitingInterval = setInterval(() => {
                this.waitingTimer--;
                console.log('Waiting timer:', this.waitingTimer); // Debug log
                
                if (this.waitingTimer <= 0) {
                    clearInterval(this.waitingInterval);
                    this.startGameCountdown();
                } else {
                    this.broadcast('timerUpdate', {
                        waitingTimer: this.waitingTimer,
                        startTimer: null,
                        readyPlayerCount
                    });
                }
            }, 1000);
        } else if (readyPlayerCount === 4) {
            // Skip waiting timer and start game countdown immediately
            this.startGameCountdown();
        } else {
            // Less than 2 ready players
            this.broadcast('timerUpdate', {
                waitingTimer: null,
                startTimer: null,
                readyPlayerCount
            });
        }
    }

    handleChatMessage(ws, data) {
        const { message, playerName, timestamp } = data;
        
        // Validate message
        if (!message || !playerName) {
            console.error('Invalid chat message data');
            return;
        }

        const chatMessage = {
            playerName,
            message: message.slice(0, 200),
            timestamp: timestamp || new Date().toISOString()
        };

        this.chatMessages.push(chatMessage);
        if (this.chatMessages.length > 100) {
            this.chatMessages.shift();
        }

        // Broadcast to everyone including sender
        this.broadcast('chatMessage', chatMessage);
    }
}

// Start the server
const gameServer = new GameServer();
