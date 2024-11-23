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
        this.gameMap = null;
        this.chat = null;
        this.isRunning = false;
        this.isGameOver = false;
        this.winner = null;
        this.localPlayerId = props.playerInfo?.playerId || null;
        this.nickname = props.playerInfo?.nickname || null;
        this.spectatorMode = false;
        this.lastFrameTime = 0;
        
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
        const currentTime = Date.now();
        
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
        
        // Update game state
        this.updateGameState();
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
                previousState = i > 0 ? this.stateBuffer[i-1].state : nextState;
                break;
            }
        }
        
        if (!previousState || !nextState) {
            previousState = nextState = this.stateBuffer[this.stateBuffer.length - 1].state;
        }
        
        // Calculate interpolation factor
        const timeDiff = nextState.timestamp - previousState.timestamp;
        const factor = timeDiff > 0 ? 
            (renderTime - previousState.timestamp) / timeDiff : 1;
        
        // Update player positions with interpolation
        nextState.players.forEach(playerData => {
            const previousPlayerData = previousState.players
                .find(p => p.id === playerData.id);
            
            if (!previousPlayerData) return;
            
            let player = this.players.get(playerData.id);
            if (!player) {
                player = new Player(
                    playerData.id,
                    playerData.nickname,
                    playerData.position,
                    this.gameMap
                );
                this.players.set(playerData.id, player);
            }
            
            // Don't interpolate local player
            if (playerData.id === this.localPlayerId) {
                return;
            }
            
            // Interpolate position
            player.position = {
                x: previousPlayerData.position.x + 
                   (playerData.position.x - previousPlayerData.position.x) * factor,
                y: previousPlayerData.position.y + 
                   (playerData.position.y - previousPlayerData.position.y) * factor
            };
            
            // Update other player properties
            player.isDead = playerData.isDead;
            player.lives = playerData.lives;
            player.powerUps = playerData.powerUps;
        });
        
        // Update bombs
        this.gameMap.clearBombs();
        nextState.bombs.forEach(bombData => {
            this.gameMap.placeBomb(
                bombData.position.x,
                bombData.position.y,
                bombData.range,
                bombData.playerId
            );
        });
        
        // Update power-ups
        this.gameMap.clearPowerUps();
        nextState.powerUps.forEach(powerUpData => {
            this.gameMap.addPowerUp(
                powerUpData.position.x,
                powerUpData.position.y,
                powerUpData.type
            );
        });
        
        // Update blocks
        this.gameMap.updateBlocks(nextState.blocks);
        
        // Update game status
        this.isRunning = nextState.gameStatus === 'running';
        this.isGameOver = nextState.gameStatus === 'ended';
        
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

            await webSocket.connect();
            
            // Initialize game map
            this.gameMap = new GameMap();
            await this.gameMap.loadLevel(playerInfo.selectedLevel);
            
            // Send join game message
            webSocket.send('joinGame', {
                playerId: playerSession.playerId,
                nickname: playerSession.nickname,
                selectedLevel: playerInfo.selectedLevel
            });
            
            this.isRunning = true;
            this.gameLoop();
        } catch (error) {
            console.error('Failed to start game:', error);
            window.location.hash = '/';
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
        if (!this.players.has(id)) {
            const player = new Player(id, nickname, position, this.gameMap);
            this.players.set(id, player);
        }
    }

    handlePlayerLeave(data) {
        const { playerId } = data;
        if (this.players.has(playerId)) {
            this.players.delete(playerId);
        }
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
        
        if (player && !this.gameMap.hasBomb(position.x, position.y)) {
            player.activeBombs++;
            this.gameMap.placeBomb(position.x, position.y, range, playerId);
            
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
            this.gameMap.explodeBomb(position.x, position.y);
        }
    }

    handlePowerUpCollected(data) {
        const { playerId, position, type } = data;
        const player = this.players.get(playerId);
        
        if (player) {
            const cell = this.gameMap.grid[position.y][position.x];
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
        this.gameMap.update(deltaTime);

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

        // Render map
        this.gameMap.render(gameContainer);

        // Render all players
        this.players.forEach(player => {
            if (!player.isDead || this.spectatorMode) {
                player.render(gameContainer);
            }
        });

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
