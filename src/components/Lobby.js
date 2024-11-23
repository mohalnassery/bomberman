import { Component } from '../core/component.js';
import { Store } from '../core/state.js';
import webSocket from '../core/websocket.js';

export class Lobby extends Component {
    constructor(props) {
        super(props);
        
        // Check for existing session
        const existingSession = JSON.parse(localStorage.getItem('playerSession'));
        if (existingSession) {
            this.nickname = existingSession.nickname;
            this.playerId = existingSession.playerId;
            this.isJoined = true;
        }
        
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
        
        this.mounted = false;
        this.setupWebSocket();
        
        // If we have an existing session, reconnect
        if (existingSession) {
            this.reconnect();
        }
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
        webSocket.on('syncPlayers', this.handleSyncPlayers.bind(this));
        webSocket.on('connect_error', () => {
            localStorage.removeItem('playerSession');
            localStorage.removeItem('playerInfo');
            window.location.reload();
        });
        
        webSocket.on('disconnect', () => {
            if (this.mounted) {
                alert('Disconnected from server. Please refresh the page.');
                localStorage.removeItem('playerSession');
                localStorage.removeItem('playerInfo');
                window.location.reload();
            }
        });
    }

    handlePlayerJoined(data) {
        const state = this.store.getState();
        const newPlayer = data.player;
        
        // Don't add if player already exists
        if (!state.players.find(p => p.id === newPlayer.id)) {
            const newPlayers = [...state.players, newPlayer];
            this.store.setState({
                players: newPlayers,
                playerCount: newPlayers.length
            });
        }
        
        // Request full state sync after join
        webSocket.send('requestSync', {
            playerId: this.playerId
        });
        
        this.updatePlayerList();
    }

    handlePlayerLeft(data) {
        const state = this.store.getState();
        const { playerId } = data;
        const newPlayers = state.players.filter(p => p.id !== playerId);
        
        this.store.setState({
            players: newPlayers,
            playerCount: newPlayers.length,
            readyPlayers: new Set([...state.readyPlayers].filter(id => id !== playerId))
        });
        this.render(); // Force a re-render when a player leaves
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
        
        if (data.gameStatus === 'running') {
            const currentPlayer = data.players.find(p => p.id === this.playerId);
            if (currentPlayer) {
                // Save complete game state
                const playerInfo = {
                    playerId: this.playerId,
                    nickname: currentPlayer.nickname,
                    selectedLevel: data.selectedLevel || currentState.gameSettings.startLevel,
                    settings: currentState.gameSettings,
                    ready: true,
                    gameStatus: 'running'
                };
                
                // Update session with game state
                const session = JSON.parse(localStorage.getItem('playerSession'));
                if (session) {
                    session.currentPage = '#/game';
                    session.gameState = {
                        selectedLevel: data.selectedLevel,
                        players: data.players,
                        readyPlayers: data.readyPlayers,
                        gameStatus: data.gameStatus
                    };
                    localStorage.setItem('playerSession', JSON.stringify(session));
                }
                
                localStorage.setItem('playerInfo', JSON.stringify(playerInfo));
                this.startGame();
                return;
            }
        }
        
        // Otherwise update lobby state
        this.store.setState({
            ...currentState,
            players: data.players || currentState.players,
            playerCount: data.players ? data.players.length : currentState.playerCount,
            readyPlayers: new Set(data.readyPlayers || []),
            levelVotes: data.levelVotes || {},
            selectedLevel: data.selectedLevel,
            gameStatus: data.gameStatus
        });

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

        if (!this.nickname) {
            alert('Please enter a nickname.');
            return;
        }

        try {
            if (!webSocket.connected) {
                await webSocket.connect();
            }

            this.playerId = this.generateSessionId();
            
            // Save session and player info
            const playerInfo = {
                playerId: this.playerId,
                nickname: this.nickname,
                ready: false,
                gameStatus: 'lobby'
            };
            
            localStorage.setItem('playerInfo', JSON.stringify(playerInfo));
            localStorage.setItem('playerSession', JSON.stringify({
                nickname: this.nickname,
                playerId: this.playerId,
                currentPage: '#/lobby',
                timestamp: Date.now()
            }));

            webSocket.send('join', {
                nickname: this.nickname,
                sessionId: this.playerId
            });

            this.isJoined = true;
            nicknameInput.disabled = true;
            
            const state = this.store.getState();
            this.store.setState({
                ...state,
                players: [...state.players, {
                    id: this.playerId,
                    nickname: this.nickname,
                    ready: false
                }]
            });

            this.render();
        } catch (error) {
            console.error('Failed to join game:', error);
            alert('Failed to join game. Please try again.');
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
            nickname: this.nickname,
            playerId: this.playerId // Add player ID to vote
        });
        
        // Update UI
        this.updateLevelVotes();
        this.render(); // Force a re-render after voting
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
        
        // Don't proceed if player info is missing
        if (!this.playerId || !this.nickname) {
            console.error('Missing player information');
            return;
        }

        // Save complete game state before transition
        const playerInfo = {
            playerId: this.playerId,
            nickname: this.nickname,
            selectedLevel: state.selectedLevel || state.gameSettings.startLevel,
            settings: state.gameSettings,
            ready: true,
            gameStatus: 'running'
        };
        
        localStorage.setItem('playerInfo', JSON.stringify(playerInfo));
        
        // Update session with current game state
        const session = JSON.parse(localStorage.getItem('playerSession'));
        if (session) {
            session.currentPage = '#/game';
            session.gameState = {
                selectedLevel: state.selectedLevel,
                players: state.players,
                readyPlayers: Array.from(state.readyPlayers),
                gameStatus: 'running'
            };
            localStorage.setItem('playerSession', JSON.stringify(session));
        }

        // Clean up and transition
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
        
        const session = JSON.parse(localStorage.getItem('playerSession'));
        if (window.location.hash !== '#/game' || !session || session.currentPage !== '#/game') {
            localStorage.removeItem('playerSession');
            localStorage.removeItem('playerInfo');
        }
        
        this.mounted = false;
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    handleSyncPlayers(data) {
        const { players, readyPlayers, levelVotes } = data;
        
        this.store.setState({
            players: players,
            playerCount: players.length,
            readyPlayers: new Set(readyPlayers),
            levelVotes: levelVotes
        });
        
        this.updatePlayerList();
        this.updateLevelVotes();
    }

    async reconnect() {
        try {
            if (!webSocket.connected) {
                await webSocket.connect();
            }
            
            // Send rejoin request and wait for response
            const response = await new Promise((resolve, reject) => {
                webSocket.send('rejoin', {
                    nickname: this.nickname,
                    playerId: this.playerId
                });
                
                // Wait for response with timeout
                const timeout = setTimeout(() => reject(new Error('Rejoin timeout')), 5000);
                
                webSocket.once('rejoinResponse', (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });
            });
            
            // If server doesn't recognize the session, clear it
            if (!response.success) {
                throw new Error('Session not found on server');
            }
            
            // Update UI if successful
            const nicknameInput = document.getElementById('nickname');
            if (nicknameInput) {
                nicknameInput.value = this.nickname;
                nicknameInput.disabled = true;
            }
        } catch (error) {
            console.error('Failed to reconnect:', error);
            // Clear session and reload
            localStorage.removeItem('playerSession');
            localStorage.removeItem('playerInfo');
            window.location.reload();
        }
    }
}
