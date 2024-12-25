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
        this.mapLoaded = false;
        this.interpolationDelay = 100;

        // Bind event handlers
        this.handleGameState = this.handleGameState.bind(this);
        this.handlePlayerLeave = this.handlePlayerLeave.bind(this);
        this.handlePlayerMove = this.handlePlayerMove.bind(this);
        this.handleGameOver = this.handleGameOver.bind(this);

        this.setupWebSocket();
    }

    // -- GAMELOOP FUNCTIONS --

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
            webSocket.send('requestSync');

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
            if (player.isMoving && !this.map.checkCollision(player.position.x, player.position.y, player.id)) {
                // Update visual position immediately for local player
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

        // Update bombs
        this.map.activeBombs.forEach((bomb, id) => {
            bomb.update(deltaTime);
            if (bomb.shouldExplode) {
                this.map.handleBombExplosion(bomb);
                this.map.activeBombs.delete(id);
            }
        });

        // Update explosions
        this.map.explosions.forEach((explosion, id) => {
            explosion.update(deltaTime);
            if (explosion.isFinished) {
                this.map.explosions.delete(id);
                // Clear explosion cells
                explosion.cells.forEach(cell => {
                    if (this.map.grid[cell.y][cell.x]) {
                        this.map.grid[cell.y][cell.x].hasExplosion = false;
                    }
                });
            }
        });

        // removed win check because that should only happen during explosions, and also on server side
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

    // -- WEBSOCKET LISTENERS --

    setupWebSocket() {
        console.log('Setting up WebSocket handlers');

        // Add a general message listener to debug what's coming in
        webSocket.socket.addEventListener('message', (event) => {
            console.log('Raw WebSocket message received:', event.data);
            const data = JSON.parse(event.data);
            console.log('Parsed message:', data);
        });

        webSocket.on('gameState', this.handleGameState);
        //webSocket.on('playerMove', this.handlePlayerMove);
        webSocket.on('playerLeave', this.handlePlayerLeave);
        webSocket.on('gameOver', this.handleGameOver);
    }

    handleGameState(data) {
        console.log('Received game state:', data);

        // Load map only once
        if (data.selectedLevel && !this.mapLoaded) {
            console.log('Loading level:', data.selectedLevel);

            this.map.loadLevel(data.selectedLevel, data.grid)
                .then(() => {
                    this.mapLoaded = true;
                    console.log('Map loaded successfully');
                    data.players?.forEach(playerData => {
                        let player = this.players.get(playerData.id);
                        if (player) {
                            player.position = playerData.position || this.map.getPlayerStartPosition(index) || { x: 0, y: 0 } // Provide default position
                        }
                    });
                    this.render(); // Force render after map loads
                })
                .catch(error => {
                    console.error('Failed to load map:', error);
                });
        }

        // Update all players from game state
        data.players?.forEach(playerData => {
            let player = this.players.get(playerData.id);

            if (!player) {
                // Create new player if doesn't exist
                player = new Player({
                    id: playerData.id,
                    nickname: playerData.nickname,
                    isLocal: playerData.id === this.localPlayerId,
                    position: playerData.position || this.map.getPlayerStartPosition(index) || { x: 0, y: 0 } // Provide default position
                });
                this.players.set(playerData.id, player);
                this.map.addPlayer(player); // Transition this out eventually
            }

            // Only update position if valid position data exists
            if (playerData.position && typeof playerData.position.x === 'number' && typeof playerData.position.y === 'number') {
                player.updatePosition(playerData.position);
            }
            if (!this.isRunning) {
                this.isRunning = true;
                this.gameLoop()
            }
        });
    }

    handlePlayerLeave(data) {
        const { playerId } = data;
        this.players.delete(playerId);
        this.map.removePlayer(playerId);
    }

    handlePlayerMove(data) {
        const { playerId, position } = data;
        console.log('Handling move for player:', playerId, position);

        const player = this.players.get(playerId);
        if (player) {
            player.updatePosition(position);
            console.log(`Updated position for player ${playerId} to:`, position);
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
        const cell = `.cell[data-x="${x}"][data-y="${y}"]`;
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

    // -- SPECTATOR MODE --

    enterSpectatorMode() {
        this.spectatorMode = true;

        // Disable controls
        this.localPlayer.disableControls();

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

    destroy() {
        this.isRunning = false;
        webSocket.disconnect();
        super.destroy();
    }
}
