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
            levelVotes: {},
            selectedLevel: null,
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
        webSocket.on('levelVoted', this.handleLevelVoted.bind(this));
        webSocket.on('levelSelected', this.handleLevelSelected.bind(this));
    }

    handlePlayerJoined(data) {
        console.log('Player joined data:', data);
        const state = this.store.getState();
        
        // Update players array if player doesn't exist
        if (!state.players.find(p => p.id === data.player.id)) {
            state.players.push(data.player);
            state.playerCount = state.players.length;
        }
        
        this.store.setState(state);
        this.updatePlayerList();
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
        const currentState = this.store.getState();
        
        // Update the store with new state while preserving existing properties
        this.store.setState({
            ...currentState,
            players: data.players || currentState.players,
            playerCount: data.players ? data.players.length : currentState.playerCount,
            readyPlayers: new Set(data.readyPlayers || []),
            levelVotes: data.levelVotes || {},
            selectedLevel: data.selectedLevel
        });

        // Update UI
        this.updatePlayerList();
        this.updateLevelVotes();
    }

    handleLevelVoted(data) {
        console.log('Level voted:', data);
        const state = this.store.getState();
        state.levelVotes = { ...state.levelVotes, ...data.levelVotes };
        this.store.setState(state);
        this.updateLevelVotes();
    }

    handleLevelSelected(data) {
        const { selectedLevel } = data;
        this.store.setState({ selectedLevel });
        this.updateLevelVotes();
    }

    updateLevelVotes() {
        const state = this.store.getState();
        
        // Update vote counts for each level
        const voteCounts = {};
        Object.values(state.levelVotes).forEach(level => {
            voteCounts[level] = (voteCounts[level] || 0) + 1;
        });

        // Update the vote count displays
        ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].forEach(level => {
            const voteCountElement = document.getElementById(`${level}-votes`);
            if (voteCountElement) {
                voteCountElement.textContent = voteCounts[level] || 0;
            }
        });

        // If the current player has voted, disable level buttons and enable ready button
        if (state.levelVotes[this.nickname]) {
            const levelButtons = document.querySelectorAll('.level-btn');
            levelButtons.forEach(button => {
                button.disabled = true;
                if (button.getAttribute('data-level') === state.levelVotes[this.nickname]) {
                    button.classList.add('selected');
                }
            });
            
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.disabled = false;
            }
        }
    }

    updatePlayerList() {
        const state = this.store.getState();
        console.log('Updating player list with state:', state);
        
        const playerListElement = document.getElementById('playerList');
        const playerCountElement = document.getElementById('playerCount');
        
        if (playerListElement) {
            playerListElement.innerHTML = state.players.map(player => `
                <div class="player-item ${state.readyPlayers.has(player.id) ? 'ready' : ''}">
                    <span class="player-name">${player.nickname}</span>
                    <span class="player-status">${state.readyPlayers.has(player.id) ? '✓ Ready' : 'Not Ready'}</span>
                    ${state.levelVotes[player.nickname] ? `<span class="player-vote">Vote: ${state.levelVotes[player.nickname]}</span>` : ''}
                </div>
            `).join('');
        }
        
        if (playerCountElement) {
            playerCountElement.textContent = `${state.playerCount}/${state.gameSettings.maxPlayers}`;
        }
    }

    async handleJoinGame() {
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

            // Enable all level buttons
            const levelButtons = document.querySelectorAll('.level-btn');
            levelButtons.forEach(button => {
                button.disabled = false;
            });

            // Keep ready button disabled until vote
            document.getElementById('readyBtn').disabled = true;
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
        
        // Check if player has voted for a level
        const state = this.store.getState();
        if (!state.levelVotes[this.nickname]) {
            alert('Please vote for a level before marking yourself as ready.');
            return;
        }

        const readyBtn = document.getElementById('readyBtn');
        const isReady = readyBtn.classList.contains('ready');

        // Send ready/unready message to server
        webSocket.send(isReady ? 'unready' : 'ready', {
            nickname: this.nickname
        });

        // Update button state immediately for better UX
        if (!isReady) {
            readyBtn.classList.add('ready');
            readyBtn.textContent = 'Not Ready';
        } else {
            readyBtn.classList.remove('ready');
            readyBtn.textContent = 'Ready';
        }
    }

    handleVoteLevel(level) {
        if (!this.isJoined) return;

        // Update local state first for immediate feedback
        const state = this.store.getState();
        state.levelVotes[this.nickname] = level;
        this.store.setState(state);

        // Send vote to server
        webSocket.send('voteLevel', { 
            level,
            nickname: this.nickname
        });
        
        // Update UI
        this.updateLevelVotes();
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
        const hasVoted = state.levelVotes[this.nickname];
        
        container.innerHTML = `
            <div class="lobby-container">
                <h1>Bomberman Lobby</h1>
                <div class="join-section">
                    <input type="text" id="nickname" placeholder="Enter your nickname" ${this.isJoined ? 'disabled' : ''}>
                    <button id="joinBtn" ${this.isJoined ? 'disabled' : ''}>Join Game</button>
                </div>
                
                <div class="game-info">
                    <h2>Players (<span id="playerCount">0</span>/${state.gameSettings.maxPlayers})</h2>
                    <div id="playerList" class="player-list"></div>
                </div>

                <div class="level-selection">
                    <h2>Select Level</h2>
                    <p class="level-note">You must vote for a level before marking yourself as ready</p>
                    <div class="level-buttons">
                        ${Array.from({ length: 6 }, (_, i) => i + 1)
                            .map(level => `
                                <button class="level-btn" data-level="L${level}">
                                    Level ${level}
                                    <span class="vote-count" id="L${level}-votes">0</span>
                                </button>
                            `).join('')}
                    </div>
                </div>

                <div class="ready-section">
                    <button id="readyBtn" ${!this.isJoined || !hasVoted ? 'disabled' : ''}>Ready</button>
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

        // Add level voting event listeners
        const levelButtons = document.querySelectorAll('.level-btn');
        levelButtons.forEach(button => {
            // Set initial disabled state
            button.disabled = !this.isJoined || hasVoted;
            
            button.addEventListener('click', () => {
                const level = button.getAttribute('data-level');
                this.handleVoteLevel(level);
            });
        });

        // Add ready button event listener
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.addEventListener('click', () => this.handleReadyToggle());
        }

        // Update initial player list and level votes
        this.updatePlayerList();
        this.updateLevelVotes();
    }

    destroy() {
        // Clean up WebSocket listeners
        webSocket.off('playerJoined');
        webSocket.off('playerLeave');
        webSocket.off('playerReady');
        webSocket.off('playerUnready');
        webSocket.off('gameStarting');
        webSocket.off('gameState');
        webSocket.off('levelVoted');
        webSocket.off('levelSelected');
        
        // Remove global handler
        delete window.handleVoteLevel;
    }
}
