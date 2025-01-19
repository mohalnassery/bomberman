// src/components/Game.js
import { Component } from '../core/component.js';
import { GameMap } from './Map.js';
import {PowerUp} from './PowerUp.js';
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
        this.localPlayerId = props?.playerInfo?.playerId || null;
        this.nickname = props?.playerInfo?.nickname || 'Player';
        this.spectatorMode = false;
        this.lastFrameTime = 0;
        this.stateBuffer = [];
        this.interpolationDelay = 100;
        this.hasInitializedPanels = false;

        // Bind all event handlers
        this.handleGameState = this.handleGameState.bind(this);
        this.handlePlayerLeave = this.handlePlayerLeave.bind(this);
        this.handlePlayerMove = this.handlePlayerMove.bind(this);
        this.handleBombPlaced = this.handleBombPlaced.bind(this);
        this.handleBombExplosion = this.handleBombExplosion.bind(this);
        this.handleGameOver = this.handleGameOver.bind(this);
        this.handlePowerUpCollected = this.handlePowerUpCollected.bind(this);
        this.handlePlayerDeath = this.handlePlayerDeath.bind(this);

        this.setupWebSocket();
        webSocket.connect();
        this.start();
    }

    // -- GAMELOOP FUNCTIONS --

    async start() {
        try {
            const playerInfo = JSON.parse(localStorage.getItem('playerInfo'));
            const playerSession = JSON.parse(localStorage.getItem('playerSession'));

            if (!playerInfo || !playerSession || !playerInfo.playerId) {
                throw new Error('Missing player information');
            }
            
            this.localPlayerId = playerInfo.playerId;
            this.nickname = playerInfo.nickname;

            // Get the selected level from session state or votes
            const gameState = playerSession.gameState || {};
            let selectedLevel = gameState.selectedLevel;

            if (!selectedLevel && gameState.levelVotes) {
                selectedLevel = gameState.levelVotes[playerInfo.nickname];
            }

            console.log('Starting game with level:', selectedLevel);

            // Only connect if not already connected
            if (!webSocket.connected) {
                await webSocket.connect();
            }

            const initialState = JSON.parse(localStorage.getItem('initialState'));
            if (initialState) {
                this.handleGameState(initialState)
            } else {
                // Request initial game state from server
                webSocket.send('requestSync');
            }

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

    update(deltaTime) {
        if (!this.isRunning || this.isGameOver) return;

        // Update local player
        const player = this.players.get(this.localPlayerId)
        if (!player.isDead) {
            const oldPosition = { ...player.position };
            player.update(deltaTime);

            // If moved and no collision, update position
            if (player.isMoving) {
                // Update visual position immediately for local player
                player.position = this.map.avoidCollision(player.position.x, player.position.y)
                player.updatePosition(player.position)
                webSocket.send('playerMove', {
                    position: player.position,
                    timestamp: Date.now()
                });
            } else {
                // Reset position if collision
                player.position = oldPosition;
            }
        }

        // removed bomb countdown and explosion stuff because that should be server side
        // removed win check because that should only happen during explosions, and also on server side
    }

    // removed checkGameOver because that is server side

    showGameOverScreen() {
        console.log('Showing game over screen'); // Debug log
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';

        const content = document.createElement('div');
        content.className = 'game-over-content';

        const isWinner = this.winner.id === this.localPlayerId;
        
        const title = document.createElement('h1');
        title.textContent = isWinner ? 'Victory!' : 'Game Over';
        title.className = isWinner ? 'victory-title' : 'defeat-title';

        const message = document.createElement('p');
        message.textContent = this.winner.id ? 
            `${this.winner.name} wins the game!` : 
            'Game Over - No winners!';

        const stats = document.createElement('div');
        stats.className = 'game-stats';
        if (this.winner.stats) {
            stats.innerHTML = `
                <p>Kills: ${this.winner.stats.kills}</p>
                <p>Power-ups Collected: ${this.winner.stats.powerUps}</p>
                <p>Bombs Placed: ${this.winner.stats.bombsPlaced}</p>
            `;
        }

        const buttons = document.createElement('div');
        buttons.className = 'game-over-buttons';

        const lobbyBtn = document.createElement('button');
        lobbyBtn.textContent = 'Back to Lobby';
        lobbyBtn.onclick = () => window.location.href = '/';
        
        buttons.appendChild(lobbyBtn);

        content.appendChild(title);
        content.appendChild(message);
        content.appendChild(stats);
        content.appendChild(buttons);
        overlay.appendChild(content);

        document.body.appendChild(overlay);
    }

    // -- WEBSOCKET LISTENERS --

    setupWebSocket() {
        console.log('Setting up WebSocket handlers in Game.js');

        // Debug all incoming messages
        webSocket.socket.addEventListener('message', (event) => {
            console.log('Raw WebSocket message received:', event.data);
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed WebSocket message:', data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        webSocket.on('gameState', this.handleGameState);
        webSocket.on('playerMove', this.handlePlayerMove);
        webSocket.on('playerLeave', this.handlePlayerLeave);
        webSocket.on('gameOver', this.handleGameOver);
        webSocket.on('bombPlaced',this.handleBombPlaced);
        webSocket.on('bombExplosion',this.handleBombExplosion);
        webSocket.on('powerUpCollected',this.handlePowerUpCollected);
        webSocket.on('playerDeath', this.handlePlayerDeath);
        webSocket.on('playerRespawn', this.handlePlayerRespawn.bind(this));
        console.log('WebSocket handlers setup complete');
    }


    handleGameState(data) {
        console.log('Received game state:', data);
        if (data.gameStatus !== "running") {
            this.isRunning = false;
            return;
        }

        // Clear existing players if this is initial load
        if (!this.map.isLoaded) {
            Player.clearPlayers();
        }

        // Update all players from game state
        data.players?.forEach((playerData, index) => {
            let player = this.players.get(playerData.id);

            if (!player) {
                // Create new player if doesn't exist
                player = new Player({
                    id: playerData.id,
                    nickname: playerData.nickname,
                    isLocal: playerData.id === this.localPlayerId,
                    position: playerData.position || playerData.spawnPosition || this.map.getPlayerStartPosition(index) || { x: 0, y: 0 }
                });
                this.players.set(playerData.id, player);
            }

            // Update player position if valid
            if (playerData.position && typeof playerData.position.x === 'number' && typeof playerData.position.y === 'number') {
                player.updatePosition(playerData.position);
            }
        });

        // Load map for all players if game is running and map not loaded
        if (!this.map.isLoaded) {
            console.log('Loading level:', data.selectedLevel);
            
            this.map.loadLevel(data.selectedLevel, data.grid)
            if (this.map.isLoaded) {
                data.players?.forEach(playerData => {
                    const player = this.players.get(playerData.id);
                    if (player && playerData.position) {
                        player.position = playerData.position;
                    }
                });
                console.log('Map loaded successfully');
                // Update player positions after map loads
                this.render(); // Force render after map loads
            }
        }

        // Start game loop if not running
        if (data.gameStatus === 'running' && !this.isRunning) {
            this.isRunning = true;
            this.gameLoop();
        }
    }

    handlePlayerLeave(data) {
        const { playerId } = data;
        const player = this.players.get(playerId);
        if (player) {
            // Remove player from grid
            const playerCell = document.querySelector(`.player-${playerId}`);
            if (playerCell) {
                const playerChar = playerCell.querySelector('.player-character');
                const playerTag = playerCell.querySelector('.player-tag');
                if (playerChar) playerChar.remove();
                if (playerTag) playerTag.remove();
                playerCell.classList.remove(`player-${playerId}`);
            }
            
            // Clean up player
            player.destroy();
            this.players.delete(playerId);
            
            console.log(`Player ${playerId} left the game`);
        }
    }

    handlePlayerMove(data) {
        const { playerId, position } = data;
        //console.log('Handling move for player:', playerId, position);

        const player = this.players.get(playerId);
        if (player) {
            player.updatePosition(position);
            //console.log(`Updated position for player ${playerId} to:`, position);
        }
    }

    handleBombPlaced(data) {
        const { id, playerId, position, range, timestamp } = data;
        const bomber = this.players.get(playerId);

        if (bomber && !this.map.hasBomb(position.x, position.y)) {
            bomber.activeBombs++;
            this.map.placeBomb(id, position.x, position.y, range, playerId);
            // removed Schedule bomb explosion because that is a server side thing
        }
    }

    handleBombExplosion(data) {
        const {
            bombId,
            affectedPositions,
            destroyedBlocks,
            affectedPlayers,
            chainReaction,
            powerUpsSpawned,
            bomberId,
            timestamp
        } = data;

        const bomber = this.players.get(bomberId);
        bomber.activeBombs--; 

        // Remove the bomb & blocks and add the explosion effect
        this.map.explodeBomb(bombId, destroyedBlocks, affectedPositions);

        // Handle affected players immediately to remove them from grid
        affectedPlayers.forEach((playerId, index) => {
            const player = this.players.get(playerId);
            if (player) {
                // Remove player from grid immediately
                const playerCell = document.querySelector(`.player-${playerId}`);
                if (playerCell) {
                    const playerChar = playerCell.querySelector('.player-character');
                    const playerTag = playerCell.querySelector('.player-tag');
                    if (playerChar) playerChar.remove();
                    if (playerTag) playerTag.remove();
                    playerCell.classList.remove(`player-${playerId}`);
                }
                
                player.takeDamage();
                if (player.lives <= 0 && playerId === this.localPlayerId) {
                    this.enterSpectatorMode();
                }
            }
        });

        // Handle power-ups after explosion animation
        setTimeout(() => {
            powerUpsSpawned.forEach((powerUpData) => {
                const { type, position } = powerUpData;
                const powerUp = new PowerUp(type, position, this.map);
                powerUp.spawn();
                this.map.grid[position.y][position.x].powerUp = powerUp;
            });
        }, 500);

        // Respawn players only after explosion effect is complete
        setTimeout(() => {
            affectedPlayers.forEach((playerId, index) => {
                const player = this.players.get(playerId);
                if (player && player.lives > 0) {
                    player.position = player.spawnPosition || this.map.getPlayerStartPosition(index) || player.position;
                    player.updatePosition(player.position);
                    player.render(); // Re-render player at spawn position
                }
            });
        }, 600); // Wait slightly longer than explosion animation
    }

    handlePowerUpCollected(data) {
        const { playerId, position, type, stats } = data;
        console.log('Power-up collected:', data);
        
        const player = this.players.get(playerId);
        if (!player) return;

        // Update player stats
        if (stats) {
            player.maxBombs = stats.maxBombs;
            player.flameRange = stats.flameRange;
            player.speed = stats.speed;
            player.powerUpsCollected = stats.powerUpsCollected;
        }

        // Get power-up from map and collect it
        const mapCell = this.map.grid[position.y][position.x];
        if (mapCell && mapCell.powerUp) {
            mapCell.powerUp.collect(player);
        }

        console.log(`Player ${playerId} has collected ${player.powerUpsCollected} power-ups`);
    }

    handlePlayerDeath(data) {
        console.log('Player death event received:', data);
        const { playerId, position } = data;
        const player = this.players.get(playerId);

        if (player) {
            player.isDead = true;
            player.lives = 0; // Set lives to 0 when player dies
            player.updatePosition(position);
            console.log(`Player ${playerId} died`);

            // Remove player from their current cell
            const playerCell = document.querySelector(`.player-${playerId}`);
            if (playerCell) {
                const playerChar = playerCell.querySelector('.player-character');
                const playerTag = playerCell.querySelector('.player-tag');
                if (playerChar) playerChar.remove();
                if (playerTag) playerTag.remove();
                playerCell.classList.remove(`player-${playerId}`);
            }

            // Update lives display in left panel if it's the local player
            if (playerId === this.localPlayerId) {
                const livesDisplay = document.querySelector('.stats-value.lives');
                if (livesDisplay) {
                    livesDisplay.textContent = '0';
                }
                console.log('Local player died, entering spectator mode');
                this.enterSpectatorMode();
            }
        }
    }

    handleGameOver(data) {
        console.log('Game over event received:', data);
        const { winnerId, winnerName, stats } = data;
        this.isGameOver = true;
        this.isRunning = false;

        // Get final stats from the winning player
        const winner = this.players.get(winnerId);
        this.winner = {
            id: winnerId,
            name: winnerName,
            stats: {
                kills: stats?.kills || 0,
                powerUps: stats?.powerUps || 0,  // Use stats from server
                bombsPlaced: stats?.bombsPlaced || 0
            }
        };

        // Show game over screen immediately
        setTimeout(() => this.showGameOverScreen(), 1000);
    }

    handleError(error) {
        console.error('Game error:', error);
        // Handle error appropriately (show message to user, etc.)
    }

    // -- SPECTATOR MODE --

    enterSpectatorMode() {
        console.log('Entering spectator mode');
        this.spectatorMode = true;
        
        // Disable controls for dead player
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer) {
            localPlayer.disableControls();
        }

        // Create and add spectator overlay
        const spectatorUI = document.createElement('div');
        spectatorUI.className = 'spectator-overlay';
        spectatorUI.innerHTML = `
            <div class="spectator-message">
                <h2>You were eliminated!</h2>
                <p>Spectating remaining players...</p>
            </div>
        `;

        // Add to document body
        document.body.appendChild(spectatorUI);
        console.log('Spectator UI added');
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

    render() {
        const root = document.getElementById('root');
        if (!root) return;

        // Only create the panel structure once
        if (!this.hasInitializedPanels) {
            root.innerHTML = '';
            const gameContainer = document.createElement('div');
            gameContainer.className = 'game-container';

            // Create left panel (stats)
            
            const player = this.players.get(this.localPlayerId)
            const leftPanel = document.createElement('div');
            leftPanel.className = 'game-panel left-panel';
            leftPanel.innerHTML = `
                <div class="player-stats">
                    <h3>Player Stats</h3>
                    <div class="stats-item">
                        <span class="stats-label">Lives:</span>
                        <span class="stats-value lives">${player.isDead ? 0 : player.lives || 3}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Power-Ups:</span>
                        <div class="power-ups-list">
                            <div class="power-up-item">
                                <span class="power-up-icon bomb"></span>
                                <span class="power-up-count bomb">${Math.floor(player.maxBombs - player.initialPowers.maxBombs) || 0}</span>
                            </div>
                            <div class="power-up-item">
                                <span class="power-up-icon flame"></span>
                                <span class="power-up-count flame">${Math.floor(player.flameRange - player.initialPowers.flameRange) || 0}</span>
                            </div>
                            <div class="power-up-item">
                                <span class="power-up-icon speed"></span>
                                <span class="power-up-count speed">${Math.floor(player.speed-player.initialPowers.speed) || 0}</span>
                            </div>
                        </div>
                    </div>
                    <button id="leaveGameBtn" class="leave-game-btn">Leave Game</button>
                </div>
            `;

            // Create center panel (game map)
            const centerPanel = document.createElement('div');
            centerPanel.className = 'game-panel center-panel';
            centerPanel.innerHTML = '<div class="map-container"></div>';

            // Create right panel (chat)
            const rightPanel = document.createElement('div');
            rightPanel.className = 'game-panel right-panel';

            // Add panels to game container
            gameContainer.appendChild(leftPanel);
            gameContainer.appendChild(centerPanel);
            gameContainer.appendChild(rightPanel);
            root.appendChild(gameContainer);

            // Initialize chat in right panel
            if (!this.chat) {
                // Try to reuse existing chat from localStorage if it exists
                const playerInfo = JSON.parse(localStorage.getItem('playerInfo'));
                if (playerInfo && playerInfo.nickname) {
                    this.chat = new Chat(playerInfo.nickname);
                } else {
                    this.chat = new Chat(this.nickname);
                }
            }
            this.chat.initialize(rightPanel);

            // Add event listener for leave game button
            document.getElementById('leaveGameBtn').addEventListener('click', () => {
                if (confirm('Are you sure you want to leave the game?')) {
                    // Notify server that player is leaving
                    webSocket.send('playerLeave', {
                        playerId: this.localPlayerId
                    });

                    // Use existing handler to clean up player
                    this.handlePlayerLeave({ playerId: this.localPlayerId });

                    // Disconnect and redirect
                    webSocket.disconnect();
                    window.location.href = '/';
                }
            });

            this.hasInitializedPanels = true;
        }

        // Only update the game map
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer && this.isRunning) {
            this.map.render();
            // Only render alive players
            this.players.forEach(player => {
                if (!player.isDead) {
                    player.render();
                }
            });
        }
    }

    destroy() {
        this.isRunning = false;
        if (this.chat) {
            this.chat.destroy();
            this.chat = null;
        }
        webSocket.disconnect();
        super.destroy();
    }

    handlePlayerRespawn(data) {
        const { playerId, position, playerNumber } = data;
        const player = this.players.get(playerId);
        if (player) {
            console.log(`Respawning player ${playerId} to position:`, position);
            player.position = position;
            player.updatePosition(position);
        }
    }
}
