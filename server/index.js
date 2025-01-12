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
            readyCount: 0,
            bombs: new Map(),
            selectedLevel: null,
            gameStatus: 'waiting',// waiting, starting, running
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
        this.chatMessages = []; 
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

        // Broadcast game over with winner stats
        this.broadcast('gameOver', {
            winnerId: winner?.id,
            winnerName: winner?.nickname,
            stats: {
                kills: winner?.killCount || 0,
                powerUps: winner?.powerUpsCollected || 0,
                bombsPlaced: winner?.bombsPlaced || 0
            }
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

        // Update player position
        player.position = data.position;

        // Check for power-up collection
        const playerX = Math.round(player.position.x);
        const playerY = Math.round(player.position.y);
        
        const cell = this.gameState.grid[playerY][playerX];
        if (cell && cell.type === 'powerup' && cell.powerUp) {
            // Instead of handling power-up collection here, trigger the dedicated handler
            this.handlePowerUpCollected({
                playerId,
                position: { x: playerX, y: playerY },
                type: cell.powerUp
            });
        }

        // Broadcast movement
        this.broadcast('playerMove', {
            playerId: playerId,
            position: data.position,
            timestamp: Date.now()
        });
    }

    handleBombPlacement(ws, data) {
        const playerId = ws.playerId;
        const position = data.position;
        if (!position || this.gameState.grid[position.y][position.x].bomb) return;
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        const bomb = {
            id: this.gameState.bombs.size + 1,
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
        const powerUpsSpawned = new Set();


        const bomber = this.gameState.players.get(bomb.playerId)
        bomber.activeBombs--
        // Process each position in the explosion range
        affectedPositions.forEach(pos => {
            const cell = this.gameState.grid[pos.y][pos.x];
            if (cell.type === 'block') {
                destroyedBlocks.add(`${pos.x},${pos.y}`);
                
                // Check for power-up in the block
                if (cell.powerUp) {
                    console.log('Found power-up in block:', cell.powerUp);
                    // Just update the cell type and keep the powerUp
                    cell.type = 'powerup';
                    powerUpsSpawned.add({
                        type: cell.powerUp,
                        position: pos
                    })
                } else {
                    cell.type = 'empty';
                    cell.powerUp = null;
                }
            }

            // Check for chain reactions with other bombs
            const bombAtPosition = cell.bomb;
            if (bombAtPosition) {
                chainReactionBombs.add(bombAtPosition.id);
            }

            // Maybe we can also keep track of players in the grid? might be overcomplicating other stuff by doing that though
            // Check for affected players
            this.gameState.players.forEach((player, playerId) => {
                if (!player.isDead && Math.round(player.position.x) === pos.x && Math.round(player.position.y) === pos.y) {
                    affectedPlayers.add(playerId);
                    
                    // Make sure lives is a number
                    player.lives = player.lives || 3;  // Fallback if lives is undefined
                    player.lives--;
                    player.position = player.spawnPosition;
                    
                    console.log(`Player ${playerId} hit, lives remaining: ${player.lives}`);
                    
                    if (player.lives <= 0) {
                        player.isDead = true;
                        if (bomb.playerId !== playerId) {
                            bomber.killCount++;
                        }
                        
                        // Broadcast player death immediately
                        this.broadcast('playerDeath', {
                            playerId,
                            position: player.position
                        });
                        
                        // Check for game over
                        const alivePlayers = Array.from(this.gameState.players.values())
                            .filter(p => !p.isDead);
                        
                        console.log(`Alive players remaining: ${alivePlayers.length}`);
                        
                        if (alivePlayers.length === 1) {
                            const winner = alivePlayers[0];
                            console.log(`Game Over - Winner: ${winner.nickname}`);
                            this.endGame(winner);
                        } else if (alivePlayers.length === 0) {
                            console.log('Game Over - No winners');
                            this.endGame(null);
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
            powerUpsSpawned: Array.from(powerUpsSpawned),
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
                if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight || this.gameState.grid[y][x].type === "wall") {
                    break;
                }

                // Add position
                positions.push({ x, y });

                // Stop if we hit a wall
                if (this.gameState.grid[y][x].type === 'block') {
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
                const appropriateMessages = new Map()
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
                      //  console.log('Handling player move');
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

    // -- Broadcasting --

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
            gameStatus: this.gameState.gameStatus,
            selectedLevel: this.gameState.selectedLevel,
            grid: this.gameState.grid
        };

        this.broadcast('gameState', gameState);
    }

    // we can probably replace this with broadcastState, revisit once the starting game stuff is clear to me
    sendGameState(ws) {
        // Ensure we have a selected level from votes if not already set
        if (this.gameState.gameStatus !== "waiting" && !this.gameState.selectedLevel && this.checkAllReady()) {
            this.gameState.selectedLevel = this.selectWinningLevel();
        }

        const gameState = {
            players: Array.from(this.gameState.players.values()),
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

    broadcastTimers() {
        this.broadcast('timerUpdate', {
            waitingTimer: this.waitingTimer,
            startTimer: this.startTimer,
            readyCount: this.gameState.readyCount
        });
    }

    // --- LOBBY LISTENERS ---

    // -- Player Join and Ready listeners

    handlePlayerJoin(ws, data) {
        const { nickname, sessionId } = data;
        ws.playerId = sessionId;

        if (Array.from(this.gameState.players.values()).some((p) => p.nickname === nickname)) {
            ws.send(JSON.stringify({
                type: 'playerDenied',
                payload: { message: "Nickname Already in use" }
            }));
            return;
        }
        if (this.gameState.players.size >= 4) {
            ws.send(JSON.stringify({
                type: 'playerDenied',
                payload: { message: "Room Full" }
            }));
            return;
        }
        if (this.gameState.gameStatus !== "waiting") {
            ws.send(JSON.stringify({
                type: 'playerDenied',
                payload: { message: "Game is already " + this.gameState.gameStatus }
            }));
            return;
        }

        const player = {
            id: sessionId,
            nickname,
            ready: false,
            votedLevel: null,
            lives: 3,
            isDead: false,
            killCount: 0,
            bombsPlaced: 0,
            activeBombs: 0,
            powerUpsCollected: 0,
            maxBombs: 1,
            flameRange: 1,
            speed: 4,
            position: null,
            spawnPosition: null
        };

        // Add new player to game state
        this.gameState.players.set(sessionId, player);

        // Create a synchronized state for the new player
        const syncState = {
            players: Array.from(this.gameState.players.values()),
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

    handlePlayerDisconnect(ws) {
        const playerId = ws.playerId;
        if (!playerId) return;

        const player = this.gameState.players.get(playerId);
        if (player) {
            this.gameState.players.delete(playerId);

            this.broadcast('playerLeave', {
                playerId: playerId,
                playerCount: this.gameState.players.size
            });

            // Check if game should end due to disconnection
            if (this.gameState.gameStatus === 'running') {
                const alivePlayers = Array.from(this.gameState.players.values())
                    .filter(p => !p.isDead);

                if (alivePlayers.length === 1) {
                    // Last player standing wins
                    const winner = alivePlayers[0];
                    this.endGame(winner);
                } else if (alivePlayers.length === 0) {
                    // No players left, end game with no winner
                    this.endGame(null);
                }
            }
        }
    }

    handlePlayerReady(ws, data) {
        const playerId = ws.playerId;
        if (!playerId) return;

        const player = this.gameState.players.get(playerId);
        if (!player) return;

        player.ready = true

        this.gameState.readyCount = Array.from(this.gameState.players.values()).filter((player) => player.ready).length;

        console.log('Ready players count:', this.gameState.readyCount); // Debug log

        // First broadcast the ready state
        this.broadcast('playerReady', {
            nickname: player.nickname,
            ready: player.ready,
            readyCount: this.gameState.readyCount
        });

        this.updateTimers();
    }

    handlePlayerUnready(ws, data) {
        const playerId = ws.playerId;
        if (!playerId) return;
        const player = this.gameState.players.get(playerId);
        if (!player) return;

        player.ready = false;

        this.gameState.readyCount = Array.from(this.gameState.players.values()).filter((player) => player.ready).length;

        this.broadcast('playerUnready', {
            nickname: player.nickname,
            ready: player.ready,
            readyCount: this.gameState.readyCount
        });
        this.clearTimers();
        this.broadcastTimers();
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

        // Broadcast the vote
        this.broadcast('levelVoted', {
            playerId: player.id,
            nickname: player.nickname,
            level: level,
            timestamp: Date.now(), 
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
                timestamp: Date.now()
            });

            // Check if we can start the game
            this.checkGameStart();
        }
    }

    selectWinningLevel() {
        const votes = {};

        // Count votes for each level
        for (const [playerSession, player] of this.gameState.players) {
            if (player.votedLevel) {
                votes[player.votedLevel] = (votes[player.votedLevel] || 0) + 1;
            }
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
        return (this.gameState.players.size >= 2 && this.gameState.players.size === this.gameState.readyCount)
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
                            spawnPositions[playerId - 1] = { x, y }
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

        // Clear waiting timer if it exists
        this.gameState.gameStatus = "starting"
        if (this.waitingInterval) {
            clearInterval(this.waitingInterval);
            this.waitingInterval = null;
        }

        this.waitingTimer = null;
        // 10s
        this.startTimer = 3;

        // Broadcast initial countdown state
        this.broadcastTimers();

        this.startInterval = setInterval(() => {
            this.startTimer--;

            // Broadcast countdown update
            this.broadcastTimers();

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
        // Start 20s waiting timer for 2-3 players
        this.waitingTimer = 5;
        this.gameState.gameStatus = "waiting"
        console.log('Starting waiting timer:', this.waitingTimer); // Debug log

        // Broadcast initial timer state
        this.broadcastTimers();

        this.waitingInterval = setInterval(() => {
            this.waitingTimer--;

            // Broadcast current timer state
            this.broadcastTimers();

            if (this.waitingTimer <= 0) {
                clearInterval(this.waitingInterval);
                this.startGameCountdown();
            }
        }, 1000);
    }

    updateTimers() {
        console.log('Ready players:', this.gameState.readyCount); // Debug log

        // Clear and reset any existing timers
        this.clearTimers();

        // Handle different ready player counts
        if (this.checkAllReady()) {
            // If 4 players are ready, skip waiting phase
            if (this.gameState.readyCount === 4) {
                this.startGameCountdown();
            } else {
                this.startWaitingPhase();
            }
        } else {
            // Less than 2 ready players
            this.broadcast('timerUpdate', {
                waitingTimer: null,
                startTimer: null,
                readyPlayerCount: this.gameState.readyCount
            });
        }
    }

    handleChatMessage(data) {
        const { message, playerName, timestamp } = data;
        
        // Debug log
        console.log('Received chat message:', data);
        
        // Validate message
        if (!message || !playerName) {
            console.error('Invalid chat message data:', data);
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

    //handle powerups collection on server side to prevent cheating
    handlePowerUpCollected(data) {
        const { playerId, position, type } = data;
        const player = this.gameState.players.get(playerId);
        
        if (!player) return;

        // Validate the power-up exists at this position
        const cell = this.gameState.grid[position.y][position.x];
        if (!cell || cell.type !== 'powerup' || cell.powerUp !== type) {
            return; // Invalid collection attempt
        }

        // Update player stats
        player.powerUpsCollected++;
        switch (type) {
            case 'bomb':
                player.maxBombs = Math.min(player.maxBombs + 1, 8);
                break;
            case 'flame':
                player.flameRange = Math.min(player.flameRange + 1, 8);
                break;
            case 'speed':
                player.speed = Math.min(player.speed + 0.5, 10);
                break;
        }

        // Clear the power-up
        cell.type = 'empty';
        cell.powerUp = null;

        // Broadcast the validated collection
        this.broadcast('powerUpCollected', {
            playerId,
            position,
            type,
            stats: {
                maxBombs: player.maxBombs,
                flameRange: player.flameRange,
                speed: player.speed,
                powerUpsCollected: player.powerUpsCollected
            }
        });
    }
}

// Start the server
const gameServer = new GameServer();
