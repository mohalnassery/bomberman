// src/components/Game.js
import { Component } from '../core/component.js';
import { Map } from './Map.js';
import { Player } from './Player.js';
import { Chat } from './Chat.js';
import webSocket from '../core/websocket.js';

export class Game extends Component {
    constructor(props) {
        super(props);
        this.players = new Map();
        this.map = new Map();
        this.chat = new Chat();
        this.isRunning = false;
        this.isGameOver = false;
        this.winner = null;
        this.localPlayerId = null;
        this.spectatorMode = false;
        this.setupWebSocket();
    }

    setupWebSocket() {
        webSocket.on('init', this.handleInitialState.bind(this));
        webSocket.on('playerJoin', this.handlePlayerJoin.bind(this));
        webSocket.on('playerLeave', this.handlePlayerLeave.bind(this));
        webSocket.on('playerMove', this.handlePlayerMove.bind(this));
        webSocket.on('bombPlaced', this.handleBombPlaced.bind(this));
        webSocket.on('bombExplode', this.handleBombExplode.bind(this));
        webSocket.on('playerDeath', this.handlePlayerDeath.bind(this));
        webSocket.on('gameOver', this.handleGameOver.bind(this));
        webSocket.on('error', this.handleError.bind(this));
    }

    async start() {
        try {
            await webSocket.connect();
            this.map.generateMap();
            this.chat.initialize();
            this.isRunning = true;
            this.gameLoop();
        } catch (error) {
            console.error('Failed to start game:', error);
        }
    }

    handleInitialState(data) {
        const { gameState, playerId } = data;
        this.localPlayerId = playerId;

        // Initialize all existing players
        gameState.players.forEach(playerData => {
            if (!this.players.has(playerData.id)) {
                const player = new Player(
                    playerData.id,
                    playerData.nickname,
                    playerData.position,
                    this.map
                );
                this.players.set(playerData.id, player);
            }
        });

        // Check if joining an ongoing game
        if (gameState.spectatorMode) {
            this.enterSpectatorMode();
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

    enterSpectatorMode() {
        this.spectatorMode = true;
        // Enable free camera movement for spectating
        this.setupSpectatorControls();
    }

    setupSpectatorControls() {
        const camera = {
            x: 0,
            y: 0,
            speed: 5
        };

        document.addEventListener('keydown', (e) => {
            if (!this.spectatorMode) return;

            switch(e.key) {
                case 'ArrowLeft':
                    camera.x = Math.max(camera.x - camera.speed, 0);
                    break;
                case 'ArrowRight':
                    camera.x = Math.min(camera.x + camera.speed, this.map.width * 40 - window.innerWidth);
                    break;
                case 'ArrowUp':
                    camera.y = Math.max(camera.y - camera.speed, 0);
                    break;
                case 'ArrowDown':
                    camera.y = Math.min(camera.y + camera.speed, this.map.height * 40 - window.innerHeight);
                    break;
            }

            document.documentElement.style.setProperty('--camera-x', -camera.x + 'px');
            document.documentElement.style.setProperty('--camera-y', -camera.y + 'px');
        });
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

    update() {
        if (this.isGameOver) return;

        // Update local player and send position to server
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer && !localPlayer.isDead) {
            const oldPosition = { ...localPlayer.position };
            localPlayer.update();
            
            // Only send update if position changed
            if (oldPosition.x !== localPlayer.position.x || 
                oldPosition.y !== localPlayer.position.y) {
                webSocket.send('move', { position: localPlayer.position });
            }
        }
    }

    render() {
        // Clear previous render
        const root = document.getElementById('root');
        root.innerHTML = '';
        
        // Add game container with camera transform
        const gameContainer = document.createElement('div');
        gameContainer.className = 'game-container';
        root.appendChild(gameContainer);
        
        // Render map
        this.map.render(gameContainer);
        
        // Render all players
        this.players.forEach(player => {
            if (!player.isDead || this.spectatorMode) {
                player.render(gameContainer);
            }
        });
        
        // Render chat
        this.chat.render();
        
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
}
