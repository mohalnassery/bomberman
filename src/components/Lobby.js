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
        
        this.isJoined = false;
        this.playerId = null;
        this.nickname = '';
        
        // Check for existing session
        const playerSession = localStorage.getItem('playerSession');
        const playerInfo = localStorage.getItem('playerInfo');
        
        if (playerSession && playerInfo) {
            const session = JSON.parse(playerSession);
            const info = JSON.parse(playerInfo);
            
            // Only restore session if it's recent (within last hour)
            const sessionAge = Date.now() - session.timestamp;
            if (sessionAge < 3600000) { // 1 hour in milliseconds
                this.playerId = session.playerId;
                this.nickname = session.nickname;
                this.isJoined = true;
            } else {
                // Clear expired session
                localStorage.removeItem('playerSession');
                localStorage.removeItem('playerInfo');
            }
        }
        
        // Bind methods
        this.handleJoinGame = this.handleJoinGame.bind(this);
        this.handleReadyToggle = this.handleReadyToggle.bind(this);
        this.handleVoteLevel = this.handleVoteLevel.bind(this);
        
        // Initialize websocket handlers
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

    render() {
        const state = this.store.getState();
        const currentPlayer = state.players.find(p => p.nickname === this.nickname);
        const isReady = currentPlayer?.ready || false;
        
        let html = `
            <div class="lobby-container">
                <h1>Bomberman Lobby</h1>
                <div class="join-section">
                    <input type="text" id="nickname" placeholder="Enter your nickname" 
                           value="${this.nickname}" ${this.isJoined ? 'disabled' : ''}>
                    <button id="joinBtn" ${this.isJoined ? 'disabled' : ''}>Join Game</button>
                </div>`;

        if (this.isJoined) {
            html += `
                <div class="lobby-controls">
                    <button id="readyBtn" class="${isReady ? 'ready' : ''}" ${!state.levelVotes[this.nickname] ? 'disabled' : ''}>
                        ${isReady ? 'Not Ready' : 'Ready'}
                    </button>
                </div>
                <div class="level-selection">
                    <h2>Select Level:</h2>
                    <p class="level-note">You must vote for a level before marking yourself as ready</p>
                    <div class="level-buttons">
                        ${Array.from({ length: 6 }, (_, i) => i + 1)
                            .map(level => {
                                const levelKey = `L${level}`;
                                const votes = Object.values(state.levelVotes)
                                    .filter(vote => vote === levelKey).length;
                                const isSelected = state.levelVotes[this.nickname] === levelKey;
                                return `
                                    <button class="level-btn ${isSelected ? 'selected' : ''}" 
                                            data-level="${levelKey}" 
                                            ${state.levelVotes[this.nickname] ? 'disabled' : ''}>
                                        Level ${level}
                                        <span class="vote-count">${votes}</span>
                                    </button>
                                `;
                            }).join('')}
                    </div>
                </div>
                ${this.renderPlayersList(state)}`;
        }

        html += '</div>';
        
        const root = document.getElementById('root');
        if (root) {
            root.innerHTML = html;
            this.attachEventListeners();
        }
    }

    async handleJoinGame() {
        const nicknameInput = document.getElementById('nickname');
        const nickname = nicknameInput ? nicknameInput.value.trim() : '';

        if (!nickname) {
            alert('Please enter a nickname.');
            return;
        }

        try {
            // Only connect if not already connected
            if (!webSocket.connected) {
                await webSocket.connect();
            }

            this.playerId = this.generateSessionId();
            this.nickname = nickname;
            
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
            this.isJoined = false;
            if (nicknameInput) {
                nicknameInput.disabled = false;
            }
        }
    }

    handlePlayerJoined(data) {
        const { player, playerCount } = data;
        const state = this.store.getState();
        
        if (!state.players.find(p => p.nickname === player.nickname)) {
            this.store.setState({
                ...state,
                players: [...state.players, player],
                playerCount: playerCount
            });
            this.render();
        }
    }

    handlePlayerLeft(data) {
        const { sessionId } = data;
        const state = this.store.getState();
        
        this.updateGameState({
            players: state.players.filter(p => p.sessionId !== sessionId),
            playerCount: state.playerCount - 1
        });
    }

    handlePlayerReady(data) {
        const { nickname } = data;
        const state = this.store.getState();
        
        const updatedPlayers = state.players.map(player => {
            if (player.nickname === nickname) {
                return { ...player, ready: true };
            }
            return player;
        });

        this.store.setState({
            ...state,
            players: updatedPlayers
        });

        // Update UI
        this.render();
    }

    handlePlayerUnready(data) {
        const { nickname } = data;
        const state = this.store.getState();
        
        const updatedPlayers = state.players.map(player => {
            if (player.nickname === nickname) {
                return { ...player, ready: false };
            }
            return player;
        });

        this.store.setState({
            ...state,
            players: updatedPlayers
        });

        // Update UI
        this.render();
    }

    handleGameStarting(data) {
        const { countdown } = data;
        this.startCountdown(countdown);
    }

    handleGameState(data) {
        const { players, readyPlayers, levelVotes, selectedLevel } = data;
        
        // Update store with new state
        this.store.setState({
            ...this.store.getState(),
            players: players.map(player => ({
                ...player,
                ready: readyPlayers.includes(player.id)
            })),
            levelVotes: levelVotes || {},
            selectedLevel,
            playerCount: players.length
        });
        
        this.updateVotesDisplay();
        this.render();
    }

    updateVotesDisplay() {
        const state = this.store.getState();
        
        // Update vote counts for each level
        ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].forEach(level => {
            // Count votes for this level
            const votes = Object.values(state.levelVotes).filter(vote => vote === level).length;
            
            // Update the vote count display
            const voteDisplay = document.querySelector(`[data-level="${level}"] .vote-count`);
            if (voteDisplay) {
                voteDisplay.textContent = votes > 0 ? votes : '0';
            }
            
            // Update button states
            const levelBtn = document.querySelector(`[data-level="${level}"]`);
            if (levelBtn) {
                // Disable if player has already voted
                levelBtn.disabled = !!state.levelVotes[this.nickname];
                
                // Highlight if this is the selected level
                if (state.levelVotes[this.nickname] === level) {
                    levelBtn.classList.add('selected');
                } else {
                    levelBtn.classList.remove('selected');
                }
            }
        });

        // Update ready button state
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            const isReady = this.isPlayerReady(state);
            readyBtn.disabled = !state.levelVotes[this.nickname];
            readyBtn.textContent = isReady ? 'Not Ready' : 'Ready';
            if (isReady) {
                readyBtn.classList.add('ready');
            } else {
                readyBtn.classList.remove('ready');
            }
        }
    }

    getReadyButtonState(state) {
        // Enable ready button only if player has voted
        return !state.levelVotes[this.nickname] ? 'disabled' : '';
    }

    isPlayerReady(state) {
        const player = state.players.find(p => p.nickname === this.nickname);
        return player ? player.ready : false;
    }

    renderPlayersList(state) {
        return `
            <div class="players-container">
                ${state.players.map(player => `
                    <div class="player-item ${player.ready ? 'ready' : ''}">
                        <span class="player-name">${player.nickname}</span>
                        <span class="player-status">${player.ready ? 'Ready' : 'Not Ready'}</span>
                        ${player.nickname === this.nickname ? ' (You)' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="player-count">
                Players: ${state.players.length} / ${state.gameSettings.maxPlayers}
            </div>
        `;
    }

    handleLevelVoted(data) {
        const { nickname, level, votes } = data;
        const state = this.store.getState();
        
        // Update the votes count atomically
        this.store.setState({
            levelVotes: {
                ...state.levelVotes,
                [level]: votes
            }
        });

        // Update UI
        this.updateVotesDisplay();
        
        // Disable voting buttons after player has voted
        if (nickname === this.nickname) {
            const levelBtns = document.querySelectorAll('.level-btn');
            levelBtns.forEach(btn => {
                btn.disabled = true;
            });
        }
    }

    handleLevelSelected(data) {
        const { level } = data;
        this.store.setState({ selectedLevel: level });
        
        // Notify all players of the selected level
        const notification = document.createElement('div');
        notification.className = 'level-notification';
        notification.textContent = `Level ${level} has been selected!`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    handleVoteLevel(level) {
        if (!this.isJoined || this.store.getState().levelVotes[this.nickname]) {
            return;
        }

        // Update local state first for immediate feedback
        const state = this.store.getState();
        this.store.setState({
            levelVotes: {
                ...state.levelVotes,
                [this.nickname]: level
            }
        });

        // Send vote to server
        webSocket.send('voteLevel', {
            nickname: this.nickname,
            level: level,
            sessionId: this.playerId
        });

        // Update UI
        this.updateVotesDisplay();
    }

    handleReadyToggle() {
        const state = this.store.getState();
        if (!state.levelVotes[this.nickname]) {
            alert('Please vote for a level before marking yourself as ready');
            return;
        }

        // Get current ready state
        const currentPlayer = state.players.find(p => p.nickname === this.nickname);
        if (!currentPlayer) return;

        // Prevent multiple ready toggles while waiting for server response
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.disabled = true;
        }

        // Send ready/unready message
        const isCurrentlyReady = currentPlayer.ready;
        webSocket.send(isCurrentlyReady ? 'unready' : 'ready', {
            nickname: this.nickname,
            sessionId: this.playerId
        });

        // Re-enable button after a short delay
        setTimeout(() => {
            if (readyBtn) {
                readyBtn.disabled = false;
            }
        }, 1000);
    }

    // Consolidated state update method to prevent duplication
    updateGameState(newState) {
        this.store.setState({
            ...this.store.getState(),
            ...newState
        });
        this.render();
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
        const selectedLevel = state.selectedLevel || '1';  // Default to level 1 if no selection
        
        // Save the selected level to localStorage
        localStorage.setItem('selectedLevel', selectedLevel);
        
        // Don't proceed if player info is missing
        if (!this.playerId || !this.nickname) {
            console.error('Missing player information');
            return;
        }

        // Save complete game state before transition
        const playerInfo = {
            playerId: this.playerId,
            nickname: this.nickname,
            selectedLevel: selectedLevel,
            settings: state.gameSettings,
            ready: true,
            gameStatus: 'running'
        };
        
        localStorage.setItem('playerInfo', JSON.stringify(playerInfo));
        
        // Update session with current game state
        const session = {
            nickname: this.nickname,
            playerId: this.playerId,
            currentPage: '#/game',
            gameState: {
                selectedLevel: selectedLevel,
                players: state.players,
                readyPlayers: Array.from(state.readyPlayers),
                gameStatus: 'running',
                timestamp: Date.now()
            }
        };
        localStorage.setItem('playerSession', JSON.stringify(session));

        // Notify server that this player is starting the game
        webSocket.send('startGame', {
            playerId: this.playerId,
            nickname: this.nickname,
            selectedLevel: selectedLevel
        });

        // Clean up and transition
        window.location.hash = '/game';
    }

    isHost(state) {
        return state.players[0].id === this.playerId;
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

    reconnect() {
        if (!this.playerId || !this.nickname) return;
        
        // Only connect if not already connected
        if (!webSocket.connected) {
            webSocket.connect().then(() => {
                webSocket.send('reconnect', {
                    playerId: this.playerId,
                    nickname: this.nickname,
                    currentPage: window.location.hash
                });
            }).catch(error => {
                console.error('Failed to reconnect:', error);
                localStorage.removeItem('playerSession');
                localStorage.removeItem('playerInfo');
                window.location.reload();
            });
        }
    }

    attachEventListeners() {
        if (!this.isJoined) {
            // Add join game button listener
            const joinBtn = document.getElementById('joinBtn');
            if (joinBtn) {
                joinBtn.addEventListener('click', this.handleJoinGame);
            }
            
            // Add nickname input enter key listener
            const nicknameInput = document.getElementById('nickname');
            if (nicknameInput) {
                nicknameInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleJoinGame();
                    }
                });
            }
        } else {
            // Add ready button listener
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.addEventListener('click', this.handleReadyToggle);
            }

            // Add level button listeners
            const levelBtns = document.querySelectorAll('.level-btn');
            levelBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const level = btn.getAttribute('data-level');
                    if (level) {
                        this.handleVoteLevel(level);
                    }
                });
            });
        }
    }
}
