// src/components/Game.js
import { Component } from '../core/component.js';
import { GameMap } from './Map.js';
import { Player } from './Player.js';
import { Chat } from './Chat.js';
import webSocket from '../core/websocket.js';

export class Game extends Component {
    constructor(props) {
        super(props);
        this.players = new Map();
        this.map = new GameMap();
        this.chat = null;
        this.isRunning = false;
        this.isGameOver = false;
        this.winner = null;
        this.localPlayerId = props.playerInfo?.playerId || null;
        this.nickname = props.playerInfo?.nickname || null;
        this.spectatorMode = false;
        this.lastFrameTime = 0;
        this.stateBuffer = [];
        this.interpolationDelay = 100;
        
        // Bind event handlers
        this.handleGameState = this.handleGameState.bind(this);
        this.handlePlayerJoin = this.handlePlayerJoin.bind(this);
        this.handlePlayerLeave = this.handlePlayerLeave.bind(this);
        this.handleGameOver = this.handleGameOver.bind(this);
        
        this.setupWebSocket();
    }

    setupWebSocket() {
        webSocket.on('gameState', this.handleGameState);
        webSocket.on('playerJoin', this.handlePlayerJoin);
        webSocket.on('playerLeave', this.handlePlayerLeave);
        webSocket.on('gameOver', this.handleGameOver);
    }

    handleGameState(data) {
        if (!this.map) return;  // Guard clause
        
        const currentTime = Date.now();
        
        // Determine the correct level
        let levelToLoad = data.selectedLevel;
        if (!levelToLoad && data.levelVotes) {
            // If no selected level, use the most voted level
            const votes = {};
            Object.values(data.levelVotes).forEach(level => {
                votes[level] = (votes[level] || 0) + 1;
            });
            const maxVotes = Math.max(...Object.values(votes));
            const topLevels = Object.entries(votes)
                .filter(([_, count]) => count === maxVotes)
                .map(([level]) => level);
            levelToLoad = topLevels[0]; // Use the first level with max votes
        }

        console.log('Loading level from game state:', levelToLoad);
        
        // Handle initial game state for new players
        if (data.gameStatus === 'running' && !this.isRunning) {
            console.log('Initializing new player with game state:', data);
            
            // Set active players before loading the level
            if (data.players) {
                const activePlayerIds = data.players.map(p => p.id);
                this.map.setActivePlayers(activePlayerIds);
                console.log('Set active player IDs:', activePlayerIds);
                
                // Initialize players with their data and correct player numbers
                data.players.forEach((playerData, index) => {
                    if (!this.players.has(playerData.id)) {
                        const player = new Player({
                            id: playerData.id,
                            nickname: playerData.nickname,
                            isLocal: playerData.id === this.localPlayerId,
                            gameMap: this.map,
                            position: playerData.position || this.map.getPlayerStartPosition(index),
                            playerNumber: index + 1  // Explicitly set player number (1-based)
                        });
                        this.players.set(playerData.id, player);
                        console.log(`Initialized player ${playerData.nickname} (Player ${index + 1}) at position:`, player.position);
                    }
                });
            }
            
            // Load the level first
            if (levelToLoad) {
                this.map.loadLevel(levelToLoad).catch(error => {
                    console.error('Error loading level:', error);
                    this.map.generateDefaultMap();
                });
            }
            
            // Update blocks from server state if available
            if (data.blocks && Array.isArray(data.blocks)) {
                const blockPositions = data.blocks.map(pos => `${pos.x},${pos.y}`);
                this.map.updateBlocks(blockPositions);
            }

            this.isRunning = true;
        }
        
        // Add state update to buffer
        this.stateBuffer.push({
            state: data,
            timestamp: currentTime
        });
        
        // Remove old states from buffer
        while (this.stateBuffer.length > 0 && 
               currentTime - this.stateBuffer[0].timestamp > 1000) {
            this.stateBuffer.shift();
        }
        
        this.updateGameState();
    }

    getPlayerStartPosition(playerId) {
        // Get player start positions based on level 2 layout
        const positions = {
            '1': { x: 5, y: 5 },  // Top left center
            '2': { x: 9, y: 7 },  // Bottom right center
            '3': { x: 9, y: 5 },  // Top right center
            '4': { x: 5, y: 7 }   // Bottom left center
        };
        return positions[playerId] || { x: 1, y: 1 };
    }

    updateGameState() {
        if (this.stateBuffer.length === 0) return;
        
        const currentTime = Date.now();
        const renderTime = currentTime - this.interpolationDelay;
        
        // Find the two states to interpolate between
        let previousState = null;
        let nextState = null;
        
        for (let i = 0; i < this.stateBuffer.length; i++) {
            if (this.stateBuffer[i].timestamp >= renderTime) {
                nextState = this.stateBuffer[i].state;
                previousState = i > 0 ? this.stateBuffer[i - 1].state : nextState;
                break;
            }
        }
        
        if (!nextState) {
            nextState = this.stateBuffer[this.stateBuffer.length - 1].state;
            previousState = nextState;
        }

        // Update player states
        nextState.players?.forEach(playerData => {
            let player = this.players.get(playerData.id);
            if (!player) {
                player = new Player({
                    id: playerData.id,
                    nickname: playerData.nickname,
                    isLocal: playerData.id === this.localPlayerId,
                    gameMap: this.map,
                    position: playerData.position || { x: 0, y: 0 }
                });
                this.players.set(playerData.id, player);
                this.map.addPlayer(player);
            }
            
            // Update player stats
            player.lives = playerData.lives || player.lives;
            player.maxBombs = playerData.maxBombs || player.maxBombs;
            player.flameRange = playerData.flameRange || player.flameRange;
            player.speed = playerData.speed || player.speed;
            player.isDead = playerData.isDead || false;
            
            // Update position with interpolation
            if (playerData.position) {
                player.updateServerPosition(playerData.position, nextState.timestamp);
            }
        });

        // Remove players that are no longer in the game
        const currentPlayerIds = new Set(nextState.players?.map(p => p.id) || []);
        for (const [playerId, player] of this.players) {
            if (!currentPlayerIds.has(playerId)) {
                this.players.delete(playerId);
                this.map.removePlayer(playerId);
            }
        }
        
        // Update bombs
        this.map.clearBombs();
        if (Array.isArray(nextState.bombs)) {
            nextState.bombs.forEach(bombData => {
                if (bombData && bombData.position) {
                    this.map.placeBomb(
                        bombData.position.x,
                        bombData.position.y,
                        bombData.range,
                        bombData.playerId
                    );
                }
            });
        }
        
        // Update power-ups
        this.map.clearPowerUps();
        if (Array.isArray(nextState.powerUps)) {
            nextState.powerUps.forEach(powerUpData => {
                if (powerUpData && powerUpData.position) {
                    this.map.addPowerUp(
                        powerUpData.position.x,
                        powerUpData.position.y,
                        powerUpData.type
                    );
                }
            });
        }
        
        // Update game status
        if (nextState.gameStatus) {
            this.isRunning = nextState.gameStatus === 'running';
            this.isGameOver = nextState.gameStatus === 'ended';
        }
        
        // Render updates
        this.render();
    }

    async start() {
        try {
            const playerInfo = JSON.parse(localStorage.getItem('playerInfo'));
            const playerSession = JSON.parse(localStorage.getItem('playerSession'));
            
            if (!playerInfo || !playerSession) {
                throw new Error('Missing player information');
            }

            // Get the selected level from session state or votes
            const gameState = playerSession.gameState || {};
            let selectedLevel = gameState.selectedLevel;
            
            if (!selectedLevel && gameState.levelVotes) {
                // If no selected level, use the voted level
                selectedLevel = gameState.levelVotes[playerInfo.nickname];
            }
            
            console.log('Starting game with level:', selectedLevel);
            
            // Ensure root element exists
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            
            // Clear the root element and add a loading indicator
            root.innerHTML = '<div class="loading">Loading game...</div>';
            
            // Only connect if not already connected
            if (!webSocket.connected) {
                await webSocket.connect();
            }
            
            // Request initial game state from server
            webSocket.send('requestGameState', {
                playerId: playerSession.playerId,
                nickname: playerSession.nickname,
                selectedLevel: selectedLevel
            });
            
            // Wait for initial state before starting game loop
            await new Promise((resolve) => {
                const handleInitialState = async (data) => {
                    try {
                        console.log('Received initial game state:', data);
                        
                        // Clear existing players
                        this.players.clear();
                        
                        // Initialize game map with correct level first
                        if (data.selectedLevel) {
                            await this.map.loadLevel(data.selectedLevel);
                        }
                        
                        // Initialize players
                        if (data.players && Array.isArray(data.players)) {
                            const playerIds = data.players.map(p => p.id);
                            this.map.setActivePlayers(playerIds);
                            
                            // Initialize each player with their position from the level file
                            data.players.forEach((playerData, index) => {
                                const startPosition = this.map.getPlayerStartPosition(index);
                                const player = new Player({
                                    id: playerData.id,
                                    nickname: playerData.nickname,
                                    isLocal: playerData.id === this.localPlayerId,
                                    gameMap: this.map,
                                    position: playerData.position || startPosition,
                                    playerNumber: index + 1 // Set player number (1-based)
                                });
                                this.players.set(playerData.id, player);
                                console.log(`Initialized player ${playerData.nickname} (Player ${index + 1}) at position:`, startPosition);
                            });
                        }
                        
                        // Initialize blocks if available
                        if (data.blocks && Array.isArray(data.blocks)) {
                            const blockPositions = data.blocks.map(pos => `${pos.x},${pos.y}`);
                            this.map.updateBlocks(blockPositions);
                        }
                        
                        // Start game loop
                        this.isRunning = true;
                        this.gameLoop();
                        
                    } catch (error) {
                        console.error('Error handling initial state:', error);
                        throw error;
                    }
                };
                webSocket.on('gameState', handleInitialState);
            });
        } catch (error) {
            console.error('Failed to start game:', error);
            const root = document.getElementById('root');
            if (root) {
                root.innerHTML = '<div class="error">Failed to start game. <a href="#/">Return to Lobby</a></div>';
            } else {
                window.location.hash = '/';
            }
        }
    }

    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;

        // Calculate delta time in seconds
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // Update game state
        this.update(deltaTime);

        // Render the game
        this.render();

        // Schedule next frame
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    handlePlayerJoin(data) {
        const { id, nickname, position } = data;
        const player = new Player({
            id,
            nickname,
            position,
            gameMap: this.map,
            isLocal: id === this.localPlayerId
        });
        this.players.set(id, player);
        this.map.addPlayer(player);
    }

    handlePlayerLeave(data) {
        const { playerId } = data;
        this.players.delete(playerId);
        this.map.removePlayer(playerId);
    }

    handlePlayerMove(data) {
        const { id, position, timestamp } = data;
        const player = this.players.get(id);
        
        if (player && id !== this.localPlayerId) {
            // Apply position update with interpolation
            const latency = Date.now() - timestamp;
            const interpolationFactor = Math.min(1, latency / 100); // 100ms interpolation window
            
            player.position = {
                x: player.position.x + (position.x - player.position.x) * interpolationFactor,
                y: player.position.y + (position.y - player.position.y) * interpolationFactor
            };
        }
    }

    handleBombPlaced(data) {
        const { playerId, position, range, timestamp } = data;
        const player = this.players.get(playerId);
        
        if (player && !this.map.hasBomb(position.x, position.y)) {
            player.activeBombs++;
            this.map.placeBomb(position.x, position.y, range, playerId);
            
            // Schedule bomb explosion
            setTimeout(() => {
                webSocket.send('bombExplode', {
                    playerId,
                    position,
                    timestamp: Date.now()
                });
            }, 3000);
        }
    }

    handleBombExplode(data) {
        const { position, playerId } = data;
        const player = this.players.get(playerId);
        
        if (player) {
            player.activeBombs--;
            this.map.explodeBomb(position.x, position.y);
        }
    }

    handlePowerUpCollected(data) {
        const { playerId, position, type } = data;
        const player = this.players.get(playerId);
        
        if (player) {
            const cell = this.map.grid[position.y][position.x];
            if (cell && cell.type === 'powerup') {
                player.handlePowerUp(type);
                cell.type = 'empty';
                cell.powerUp = null;
            }
        }
    }

    handlePlayerDeath(data) {
        const { playerId, position } = data;
        const player = this.players.get(playerId);

        if (player) {
            player.die(position);

            // Enter spectator mode if local player died
            if (playerId === this.localPlayerId) {
                this.enterSpectatorMode();
            }

            // Check for game over
            this.checkGameOver();
        }
    }

    handleGameOver(data) {
        const { winnerId, winnerName } = data;
        this.isGameOver = true;
        this.winner = {
            id: winnerId,
            name: winnerName
        };
        this.showGameOverScreen();
    }

    handleError(error) {
        console.error('Game error:', error);
        // Handle error appropriately (show message to user, etc.)
    }

    enterSpectatorMode() {
        this.spectatorMode = true;
        
        // Disable controls
        this.localPlayer.destroy();
        
        // Add spectator UI
        const spectatorUI = document.createElement('div');
        spectatorUI.className = 'spectator-overlay';
        spectatorUI.innerHTML = `
            <div class="spectator-message">
                <h2>You were eliminated!</h2>
                <p>Spectating remaining players...</p>
            </div>
        `;
        this.element.appendChild(spectatorUI);
        
        // Enable spectator camera controls
        this.initSpectatorControls();
    }

    initSpectatorControls() {
        // Add keyboard controls for spectator camera
        document.addEventListener('keydown', (e) => {
            if (!this.spectatorMode) return;
            
            const speed = 5;
            switch (e.key) {
                case 'ArrowLeft':
                    this.spectatorOffset.x -= speed;
                    break;
                case 'ArrowRight':
                    this.spectatorOffset.x += speed;
                    break;
                case 'ArrowUp':
                    this.spectatorOffset.y -= speed;
                    break;
                case 'ArrowDown':
                    this.spectatorOffset.y += speed;
                    break;
            }
            this.updateSpectatorView();
        });
    }

    updateSpectatorView() {
        if (!this.spectatorMode) return;
        
        const container = $('.game-container');
        if (container) {
            container.style.transform = `translate(${this.spectatorOffset.x}px, ${this.spectatorOffset.y}px)`;
        }
    }

    checkGameOver() {
        const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDead);

        if (alivePlayers.length === 1) {
            const winner = alivePlayers[0];
            webSocket.send('gameOver', {
                winnerId: winner.id,
                winnerName: winner.name
            });
        }
    }

    showGameOverScreen() {
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';

        const content = document.createElement('div');
        content.className = 'game-over-content';

        const title = document.createElement('h1');
        title.textContent = this.winner.id === this.localPlayerId ? 'Victory!' : 'Game Over';
        title.className = this.winner.id === this.localPlayerId ? 'victory-title' : 'defeat-title';

        const message = document.createElement('p');
        message.textContent = `${this.winner.name} wins the game!`;

        const stats = document.createElement('div');
        stats.className = 'game-stats';
        // Add any relevant game stats here

        const buttons = document.createElement('div');
        buttons.className = 'game-over-buttons';

        const playAgainBtn = document.createElement('button');
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.onclick = () => window.location.reload();

        const lobbyBtn = document.createElement('button');
        lobbyBtn.textContent = 'Back to Lobby';
        lobbyBtn.onclick = () => {
            webSocket.send('returnToLobby');
            window.location.href = '/lobby.html';
        };

        buttons.appendChild(playAgainBtn);
        buttons.appendChild(lobbyBtn);

        content.appendChild(title);
        content.appendChild(message);
        content.appendChild(stats);
        content.appendChild(buttons);
        overlay.appendChild(content);

        document.body.appendChild(overlay);
    }

    update(deltaTime) {
        if (!this.isRunning || this.isGameOver) return;

        // Update all players
        this.players.forEach(player => {
            if (!player.isDead) {
                player.update(deltaTime);
            }
        });

        // Update game map (bombs, explosions, etc.)
        this.map.update(deltaTime);

        // Check win condition
        const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDead);
        if (alivePlayers.length <= 1) {
            const winner = alivePlayers[0];
            webSocket.send('gameOver', {
                winnerId: winner?.id,
                timestamp: Date.now()
            });
        }
    }

    render() {
        // Clear the game container
        const root = document.getElementById('root');
        if (!root) return;

        root.innerHTML = '';

        // Create game container
        const gameContainer = document.createElement('div');
        gameContainer.className = 'game-container';
        root.appendChild(gameContainer);

        // Only render map and players if the game is running
        if (this.isRunning) {
            // Render map (which includes player HUD)
            this.map.render(gameContainer);

            // Render all players
            this.players.forEach(player => {
                if (!player.isDead || this.spectatorMode) {
                    player.render(gameContainer);
                }
            });
        } else {
            // Show waiting screen
            const waitingScreen = document.createElement('div');
            waitingScreen.className = 'waiting-screen';
            waitingScreen.innerHTML = '<h2>Waiting for game to start...</h2>';
            gameContainer.appendChild(waitingScreen);
        }

        // Render chat
        if (this.chat) {
            this.chat.render();
        }

        // Render spectator mode indicator
        if (this.spectatorMode) {
            const indicator = document.createElement('div');
            indicator.className = 'spectator-indicator';
            indicator.textContent = 'Spectator Mode';
            root.appendChild(indicator);
        }
    }

    destroy() {
        this.isRunning = false;
        webSocket.disconnect();
        super.destroy();
    }

    handleBombExplosion(data) {
        const {
            bombId,
            affectedPositions,
            destroyedBlocks,
            affectedPlayers,
            chainReaction,
            timestamp
        } = data;

        // Remove the bomb
        const bomb = this.bombs.get(bombId);
        if (bomb) {
            bomb.destroy();
            this.bombs.delete(bombId);
        }

        // Handle destroyed blocks and show animations
        destroyedBlocks.forEach(blockKey => {
            const [x, y] = blockKey.split(',').map(Number);
            const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.classList.add('block-destroy');
                setTimeout(() => {
                    cell.classList.remove('block', 'block-destroy');
                }, 500);
            }
        });

        // Show explosion animation
        affectedPositions.forEach(pos => {
            const cell = $(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (cell) {
                cell.classList.add('explosion');
                setTimeout(() => {
                    cell.classList.remove('explosion');
                }, 1000);
            }
        });

        // Handle affected players
        affectedPlayers.forEach(playerId => {
            const player = this.players.get(playerId);
            if (player) {
                player.handleExplosion();
                if (player.lives <= 0 && playerId === this.localPlayerId) {
                    this.enterSpectatorMode();
                }
            }
        });
    }

    handlePowerUpCollection(data) {
        const {
            playerId,
            powerUpKey,
            type,
            stats
        } = data;

        // Update player stats
        const player = this.players.get(playerId);
        if (player) {
            Object.assign(player, stats);
        }

        // Remove power-up from map
        const [x, y] = powerUpKey.split(',').map(Number);
        const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
            cell.classList.remove('power-up', `power-up-${type}`);
            
            // Show collection animation
            const animation = document.createElement('div');
            animation.className = 'power-up-collect';
            animation.textContent = this.getPowerUpDisplayText(type);
            cell.appendChild(animation);
            
            setTimeout(() => {
                animation.remove();
            }, 1000);
        }
    }

    getPowerUpDisplayText(type) {
        switch (type) {
            case 'bomb':
                return '+1 Bomb';
            case 'flame':
                return '+1 Range';
            case 'speed':
                return '+Speed';
            default:
                return '';
        }
    }
}
