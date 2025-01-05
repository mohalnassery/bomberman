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
        this.localPlayerId = props?.playerInfo?.playerId || null;
        this.nickname = props?.playerInfo?.nickname || null;
        this.spectatorMode = false;
        this.lastFrameTime = 0;
        this.stateBuffer = [];
        this.interpolationDelay = 100;

        // Bind event handlers
        this.handleGameState = this.handleGameState.bind(this);
        this.handlePlayerLeave = this.handlePlayerLeave.bind(this);
        this.handlePlayerMove = this.handlePlayerMove.bind(this);
        this.handleBombPlaced = this.handleBombPlaced.bind(this);
        this.handleBombExplosion = this.handleBombExplosion.bind(this);
        this.handleGameOver = this.handleGameOver.bind(this);

        this.setupWebSocket();
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
                // If no selected level, use the voted level
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
            //console.log('Raw WebSocket message received:', event.data);
            const data = JSON.parse(event.data);
            //console.log('Parsed message:', data);
        });

        webSocket.on('gameState', this.handleGameState);
        webSocket.on('playerMove', this.handlePlayerMove);
        webSocket.on('playerLeave', this.handlePlayerLeave);
        webSocket.on('gameOver', this.handleGameOver);
        webSocket.on('bombPlaced',this.handleBombPlaced);
        webSocket.on('bombExplosion',this.handleBombExplosion);
    }

    handleGameState(data) {
        console.log('Received game state:', data);
        if (data.gameStatus !== "running") {
            this.isRunning = false;
            window.location.hash = '/';
            return
        }

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
            } else {

            }
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

        // Start game loop if not running
        if (data.gameStatus === 'running' && !this.isRunning) {
            this.isRunning = true;
            this.gameLoop();
        }
    }

    handlePlayerLeave(data) {
        const { playerId } = data;
        this.players.delete(playerId);
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
            bomberId,
            timestamp
        } = data;
        console.log("explosion data: ", data)

        const bomber = this.players.get(bomberId)
        bomber.activeBombs--; 

        // Remove the bomb & blocks and add the explosion effect
        this.map.explodeBomb(bombId, destroyedBlocks, affectedPositions);

        // Handle affected players
        affectedPlayers.forEach((playerId, index) => {
            const player = this.players.get(playerId);
            if (player) {
                player.takeDamage();
                if (player.lives <= 0 && playerId === this.localPlayerId) {
                    this.enterSpectatorMode();
                }
                player.position = player.spawnPosition || this.map.getPlayerStartPosition(index) || player.position
            }
        });
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

    handlePowerUpCollection(data) {
        const {
            playerId,
            position,
            type,
            stats
        } = data;

        // Update player stats
        const player = this.players.get(playerId);
        player?.handlePowerUp(type);
        this.map.removePowerUp(position)
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
        const localPlayer = this.players.get(this.localPlayerId)
        localPlayer.disableControls();

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

    render() {
        // Clear the game container
        const root = document.getElementById('root');
        if (!root) return;

        //root.innerHTML = '';
        

        // Create game container
        let gameContainer = document.querySelector('.game-container');
        if (!gameContainer) {
            root.innerHTML = ''
            gameContainer = document.createElement('div');
            gameContainer.className = 'game-container';
            root.appendChild(gameContainer);
        }
        gameContainer.innerHTML = ''

        // Only render map and players if the game is running
        if (this.isRunning) {
            // Render map (which includes player HUD)
            this.map.render();

            // Render all players
            this.players.forEach(player => {
                if (!player.isDead || this.spectatorMode) {
                    player.render();
                }
            });
        } else {
            // Show waiting screen
            let waitingScreen = document.querySelector('.waiting-screen');
            if (!waitingScreen) {
                waitingScreen = document.createElement('div');
                waitingScreen.className = 'waiting-screen';
                waitingScreen.innerHTML = '<h2>Waiting for game to start...</h2>';
                gameContainer.appendChild(waitingScreen);
            }
        }

        // Render chat
        if (this.chat) {
            this.chat.render();
        }

        // Render spectator mode indicator
        if (this.spectatorMode) {
            let indicator = document.querySelector('.spectator-indicator');
            if (!indicator) {
                const indicator = document.createElement('div');
                indicator.className = 'spectator-indicator';
                indicator.textContent = 'Spectator Mode';
                root.appendChild(indicator);
            }
        }
    }

    destroy() {
        this.isRunning = false;
        webSocket.disconnect();
        super.destroy();
    }
}
