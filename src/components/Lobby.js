// src/components/Lobby.js
import { Component } from '../core/component.js';
import { Store } from '../core/state.js';
import webSocket from '../core/websocket.js';

export class Lobby extends Component {
    constructor(props) {
        super(props);
        this.store = new Store({ 
            players: [], 
            playerCount: 0,
            gameStarting: false,
            countdown: null,
            readyPlayers: new Set(),
            gameSettings: {
                maxPlayers: 4,
                startLevel: 1,
                lives: 3,
                timeLimit: 180
            }
        });
        this.nickname = '';
        this.isJoined = false;
        this.setupWebSocket();
    }

    setupWebSocket() {
        webSocket.on('playerJoined', this.handlePlayerJoined.bind(this));
        webSocket.on('playerLeave', this.handlePlayerLeft.bind(this));
        webSocket.on('playerReady', this.handlePlayerReady.bind(this));
        webSocket.on('playerUnready', this.handlePlayerUnready.bind(this));
        webSocket.on('gameStarting', this.handleGameStarting.bind(this));
        webSocket.on('gameState', this.handleGameState.bind(this));
    }

    handlePlayerJoined(data) {
        console.log('Player joined data:', data);
        const state = this.store.getState();
        const { player } = data;
        if (!state.players.some(p => p.id === player.id)) {
            console.log('Adding player:', player);
            state.players.push(player);
            this.store.setState({
                players: state.players,
                playerCount: state.players.length
            });
            this.updatePlayerList();
        }
    }

    handlePlayerLeft(data) {
        const state = this.store.getState();
        const { playerId } = data;
        const index = state.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            state.players.splice(index, 1);
            state.readyPlayers.delete(playerId);
            this.store.setState({
                players: state.players,
                playerCount: state.players.length,
                readyPlayers: state.readyPlayers
            });
            this.updatePlayerList();
        }
    }

    handlePlayerReady(data) {
        const state = this.store.getState();
        const { playerId } = data;
        state.readyPlayers.add(playerId);
        this.store.setState({ readyPlayers: state.readyPlayers });
        this.updatePlayerList();
    }

    handlePlayerUnready(data) {
        const state = this.store.getState();
        const { playerId } = data;
        state.readyPlayers.delete(playerId);
        this.store.setState({ readyPlayers: state.readyPlayers });
        this.updatePlayerList();
    }

    handleGameStarting(data) {
        const { countdown } = data;
        this.startCountdown(countdown);
    }

    handleGameState(data) {
        console.log('Game state received:', data);
        const { players, readyPlayers } = data;
        this.store.setState({
            players,
            playerCount: players.length,
            readyPlayers: new Set(readyPlayers)
        });
        this.updatePlayerList();
    }

    updatePlayerList() {
        const state = this.store.getState();
        console.log('Updating player list with state:', state);
        const playerList = document.getElementById('playerList');
        if (!playerList) return;

        playerList.innerHTML = state.players.map(player => {
            console.log('Rendering player:', player);
            const isReady = state.readyPlayers.has(player.id);
            return `
                <div class="player-item ${isReady ? 'ready' : ''}">
                    <span class="player-name">${player.nickname || 'Unknown'}</span>
                    <span class="player-status">${isReady ? '✓ Ready' : 'Not Ready'}</span>
                </div>
            `;
        }).join('');

        // Update player count
        const countDisplay = document.getElementById('playerCount');
        if (countDisplay) {
            countDisplay.textContent = `${state.playerCount}/${state.gameSettings.maxPlayers}`;
        }
    }

    async handleJoinGame() {
        if (this.isJoined) return;
        
        const nicknameInput = document.getElementById('nickname');
        this.nickname = nicknameInput.value.trim();
        
        // Validate nickname
        if (this.nickname.length === 0) {
            alert('Please enter a nickname.');
            return;
        }

        try {
            // Connect to WebSocket if not connected
            if (!webSocket.connected) {
                await webSocket.connect();
            }

            const sessionId = this.generateSessionId();
            console.log('Joining with nickname:', this.nickname, 'sessionId:', sessionId);
            
            // Send join request
            webSocket.send('join', {
                nickname: this.nickname,
                sessionId: sessionId
            });

            this.isJoined = true;
            nicknameInput.disabled = true;
            document.getElementById('joinBtn').disabled = true;
            document.getElementById('readyBtn').disabled = false;
            
            // Save player info to localStorage
            const playerInfo = {
                nickname: this.nickname,
                sessionId: sessionId
            };
            console.log('Saving player info:', playerInfo);
            localStorage.setItem('playerInfo', JSON.stringify(playerInfo));

        } catch (error) {
            console.error('Failed to join game:', error);
            alert('Failed to join game. Please try again.');
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    handleReadyToggle() {
        if (!this.isJoined) return;
        
        const state = this.store.getState();
        const playerInfo = JSON.parse(localStorage.getItem('playerInfo'));
        const isReady = state.readyPlayers.has(playerInfo.sessionId);
        
        webSocket.send(isReady ? 'unready' : 'ready', {
            sessionId: playerInfo.sessionId
        });

        // Update button state immediately for better UX
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.textContent = isReady ? 'Ready' : 'Not Ready';
            readyBtn.classList.toggle('ready', !isReady);
        }
    }

    startCountdown(seconds) {
        const state = this.store.getState();
        if (state.gameStarting) return;

        this.store.setState({ 
            gameStarting: true, 
            countdown: seconds 
        });

        const countdownInterval = setInterval(() => {
            const state = this.store.getState();
            if (state.countdown <= 1) {
                clearInterval(countdownInterval);
                this.startGame();
            } else {
                this.store.setState({ countdown: state.countdown - 1 });
            }
        }, 1000);
    }

    startGame() {
        const state = this.store.getState();
        // Save player info and game settings
        localStorage.setItem('playerInfo', JSON.stringify({
            nickname: this.nickname,
            sessionId: this.generateSessionId(),
            settings: state.gameSettings
        }));
        window.location.hash = '#/game';
    }

    render() {
        const state = this.store.getState();
        const container = document.getElementById('root');
        
        container.innerHTML = `
            <div class="lobby-container">
                <h1>Game Lobby</h1>
                <div class="lobby-content">
                    <div class="join-section">
                        <input type="text" id="nickname" placeholder="Enter your nickname" maxlength="15" ${this.isJoined ? 'disabled' : ''}>
                        <button id="joinBtn" ${this.isJoined ? 'disabled' : ''}>Join Game</button>
                        <button id="readyBtn" ${!this.isJoined ? 'disabled' : ''}>Ready Up</button>
                    </div>
                    <div class="lobby-status">
                        <p>Players in lobby: <span id="playerCount">${state.playerCount}/${state.gameSettings.maxPlayers}</span></p>
                        <div id="playerList" class="player-list">
                            ${state.players.map(player => `
                                <div class="player-item ${state.readyPlayers.has(player.id) ? 'ready' : ''}">
                                    <span class="player-name">${player.nickname || 'Unknown'}</span>
                                    <span class="player-status">${state.readyPlayers.has(player.id) ? '✓ Ready' : 'Not Ready'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        if (!this.isJoined) {
            const joinBtn = document.getElementById('joinBtn');
            const nicknameInput = document.getElementById('nickname');
            
            nicknameInput.addEventListener('input', () => {
                joinBtn.disabled = nicknameInput.value.trim().length === 0;
            });
            
            joinBtn.addEventListener('click', () => this.handleJoinGame());
            nicknameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !joinBtn.disabled) {
                    this.handleJoinGame();
                }
            });
        }

        const readyBtn = document.getElementById('readyBtn');
        readyBtn.addEventListener('click', () => this.handleReadyToggle());
    }

    destroy() {
        // Clean up WebSocket listeners
        webSocket.off('playerJoined');
        webSocket.off('playerLeave');
        webSocket.off('playerReady');
        webSocket.off('playerUnready');
        webSocket.off('gameStarting');
        webSocket.off('gameState');
    }
}
