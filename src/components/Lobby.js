import { Component } from '../core/component.js';
import { Store } from '../core/state.js';
import webSocket from '../core/websocket.js';
import { Chat } from './Chat.js';

export class Lobby extends Component {
    constructor(props) {
        super(props);
        this.store = new Store({ 
            players: [], 
            playerCount: 0,
            readyCount: 0,
            gameStarting: false,
            selectedLevel: null,
            gameSettings: {
                maxPlayers: 4,
                startLevel: 1,
                lives: 3,
            },
            waitingTimer: null,  // 20s timer when 2-3 players
            startTimer: null,    // 10s timer before game starts
        });
        
        this.isJoined = false;
        this.playerId = null;
        this.nickname = '';
        this.errorMessage = '';
        this.chat = null;
        
        // Check for existing session
        const playerSession = localStorage.getItem('playerSession');
        const playerInfo = localStorage.getItem('playerInfo');
        
        if (playerSession && playerInfo) {
            const session = JSON.parse(playerSession);
            const info = JSON.parse(playerInfo);
            
            // If there was a previous session in the lobby, send a leave event
            if (session.currentPage === '#/') {
                // Connect to websocket first
                webSocket.connect().then(() => {
                    // Send leave event for the previous session
                    webSocket.send('playerLeave', {
                        playerId: session.playerId,
                        sessionId: session.playerId
                    });
                    
                    // Clear the session
                    localStorage.removeItem('playerSession');
                    localStorage.removeItem('playerInfo');
                });
            }
            
            // Only restore session if it's for the game page
            if (session.currentPage === '#/game') {
                // Only restore session if it's recent (within last hour)
                const sessionAge = Date.now() - session.timestamp;
                if (sessionAge < 3600000) { // 1 hour in milliseconds
                    this.playerId = session.playerId;
                    this.nickname = session.nickname;
                    this.isJoined = true;
                }
            }
        }
        
        // Bind methods
        this.handleJoinGame = this.handleJoinGame.bind(this);
        this.handleReadyToggle = this.handleReadyToggle.bind(this);
        this.handleVoteLevel = this.handleVoteLevel.bind(this);
        
        // Initialize websocket handlers
        this.setupWebSocket();

        // Add reference to track if initial render is done
        this.initialRenderDone = false;
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
        webSocket.on('playerDenied', this.handlePlayerDenied.bind(this))
        
        webSocket.on('disconnect', () => {
            if (this.mounted) {
                alert('Disconnected from server. Please refresh the page.');
                localStorage.removeItem('playerSession');
                localStorage.removeItem('playerInfo');
                window.location.reload();
            }
        });

        // Add timer handlers
        webSocket.on('timerUpdate', (data) => {
            const { waitingTimer, startTimer, readyCount } = data;
            
            // Update store
            this.store.setState({
                ...this.store.getState(),
                waitingTimer,
                startTimer,
                readyCount
            });
            
            // Update only the timer display if initial render is done
            if (this.initialRenderDone) {
                this.updateTimerDisplay();
            } else {
                this.render();
            }
        });

        // Game starting handler
        webSocket.on('gameStarting', () => {
            this.store.setState({ ...this.store.getState(), gameStarting: true });
            this.render();
        });
    }

    // -- WS HANDLERS: client to server --

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

            this.playerId = Math.random().toString(36).substring(2) + Date.now().toString(36); // previously generateSessionId (Session ID formula)
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

            // Initialize chat after successful join
            if (!this.chat) {
                this.chat = new Chat(this.nickname);
            }

        } catch (error) {
            console.error('Failed to join game:', error);
            alert('Failed to join game. Please try again.');
            this.isJoined = false;
            if (nicknameInput) {
                nicknameInput.disabled = false;
            }
        }
    }
    
    handleVoteLevel(level) {
        if (!this.isJoined) {
            return;
        }

        // Send vote to server
        webSocket.send('voteLevel', {
            nickname: this.nickname,
            level: level,
            sessionId: this.playerId
        });
    }

    handleReadyToggle() {
        const state = this.store.getState();

        // Get current ready state
        const player = state.players.find(p => p.nickname === this.nickname);
        if (!player) return;

        if (!player.votedLevel) {
            alert('Please vote for a level before marking yourself as ready');
            return;
        }


        // Prevent multiple ready toggles while waiting for server response
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.disabled = true;
        }
        
        const levelBtns = document.querySelectorAll('.level-btn');
        console.log("here,", player.ready, levelBtns);
        levelBtns.forEach(btn => {
            btn.disabled = !!player.ready ? false : true;
        });
        
        console.log("here2,", player.ready, levelBtns);

        // Send ready/unready message
        webSocket.send(player.ready ? 'unready' : 'ready', {
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

    // -- WS HANDLERS: server to client --

    handlePlayerJoined(data) {
        const { player, playerCount, readyCount } = data;
        const state = this.store.getState();
        
        if (!state.players.find(p => p.nickname === player.nickname)) {
            this.store.setState({
                ...state,
                players: [...state.players, player],
                playerCount: playerCount,
                readyCount: readyCount || state.readyCount || 0  // Keep existing ready count or use server's count
            });
        }
        
        if (player.nickname === this.nickname) {
            this.isJoined = true;
            this.errorMessage = '';
        }

        // Update only the player list display
        const playerListElement = document.querySelector('.players-container');
        if (playerListElement) {
            playerListElement.innerHTML = this.store.getState().players.map(p => `
                <div class="player-item ${p.ready ? 'ready' : ''}">
                    <span class="player-name">${p.nickname}</span>
                    <span class="player-status">${p.ready ? '✓ Ready' : 'Not Ready'}</span>
                    ${p.nickname === this.nickname ? ' (You)' : ''}
                </div>
            `).join('');
        }

        // Only do a full render if this is the joining player
        if (player.nickname === this.nickname) {
            this.render();
        }
    }

    handlePlayerDenied(data) {
        this.isJoined = false;
        this.errorMessage = data.message;
        this.render();
    }

    handlePlayerLeft(data) {
        const { playerId, playerCount, readyCount } = data;
        const state = this.store.getState();

        const newState = {
            players: state.players.filter(p => p.id !== playerId),
            playerCount: playerCount,
            readyCount: readyCount
        }
        
        this.store.setState({
            ...this.store.getState(),
            ...newState
        });

        // Update only the necessary DOM elements
        const playerListElement = document.querySelector('.players-container');
        if (playerListElement) {
            playerListElement.innerHTML = this.store.getState().players.map(p => `
                <div class="player-item ${p.ready ? 'ready' : ''}">
                    <span class="player-name">${p.nickname}</span>
                    <span class="player-status">${p.ready ? '✓ Ready' : 'Not Ready'}</span>
                    ${p.nickname === this.nickname ? ' (You)' : ''}
                </div>
            `).join('');
        }

        // Update ready count display
        const readyCountElement = document.querySelector('.player-count');
        if (readyCountElement) {
            readyCountElement.textContent = `Ready Players: ${readyCount} / ${state.gameSettings.maxPlayers}`;
        }

        // Update level votes display
        this.updateVotesDisplay();
    }

    handlePlayerReady(data) {
        const state = this.store.getState();
        const { nickname, ready, readyCount } = data;

        const players = state.players;
        const playerIdx = players.findIndex(p => p.nickname === nickname);
        if (playerIdx === -1) {
            console.log("something is wrong with handlePlayerReady...");
            return;
        }
        
        players[playerIdx].ready = ready;

        // Update store with new state
        this.store.setState({
            ...state,
            players,
            readyCount: readyCount || players.filter(p => p.ready).length
        });

        // Update only the affected player's status in the DOM
        const playerItem = document.querySelector(`.player-item:nth-child(${playerIdx + 1})`);
        if (playerItem) {
            playerItem.className = `player-item ${ready ? 'ready' : ''}`;
            const statusSpan = playerItem.querySelector('.player-status');
            if (statusSpan) {
                statusSpan.textContent = ready ? '✓ Ready' : 'Not Ready';
            }
        }

        // Update ready count display
        const readyCountElement = document.querySelector('.player-count');
        if (readyCountElement) {
            readyCountElement.textContent = `Ready Players: ${readyCount} / ${state.gameSettings.maxPlayers}`;
        }

        // Update level buttons state if it's the current player
        if (nickname === this.nickname) {
            const levelBtns = document.querySelectorAll('.level-btn');
            levelBtns.forEach(btn => {
                btn.disabled = ready;
            });

            // Update ready button
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.textContent = ready ? 'Not Ready' : 'Ready';
                readyBtn.className = ready ? 'ready' : '';
            }
        }
    }

    handlePlayerUnready(data) {
        const { nickname, ready, readyCount } = data;
        const state = this.store.getState();
        
        const players = state.players;
        const playerIdx = players.findIndex(p => p.nickname === nickname);
        if (playerIdx === -1) {
            console.log("something is wrong with handlePlayerUnready...");
            return;
        }

        players[playerIdx].ready = ready;

        this.store.setState({
            ...state,
            players,
            readyCount
        });

        // Update only the affected player's status in the DOM
        const playerItem = document.querySelector(`.player-item:nth-child(${playerIdx + 1})`);
        if (playerItem) {
            playerItem.className = 'player-item';
            const statusSpan = playerItem.querySelector('.player-status');
            if (statusSpan) {
                statusSpan.textContent = 'Not Ready';
            }
        }

        // Update ready count display
        const readyCountElement = document.querySelector('.player-count');
        if (readyCountElement) {
            readyCountElement.textContent = `Ready Players: ${readyCount} / ${state.gameSettings.maxPlayers}`;
        }

        // Update level buttons state if it's the current player
        if (nickname === this.nickname) {
            const levelBtns = document.querySelectorAll('.level-btn');
            levelBtns.forEach(btn => {
                btn.disabled = false;
            });

            // Update ready button
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.textContent = 'Ready';
                readyBtn.className = '';
            }
        }
    }

    handleGameState(data) {
        const { players, selectedLevel, gameStatus } = data;
        
        // Update store with new state
        this.store.setState({
            ...this.store.getState(),
            players,
            selectedLevel,
            playerCount: players.length
        });
        switch (gameStatus) {
            case 'running':
                this.startGame(data);
            default:
                this.updateVotesDisplay();
                this.render();
        }
    }

    handleLevelVoted(data) {
        const { nickname, level } = data;
        const state = this.store.getState();

        const players = state.players
        const playerIdx = players.findIndex(p => p.nickname === nickname);
        if (playerIdx === -1) {
            console.log("something is wrong with handleLevelVoted...")
        } else {
            players[playerIdx].votedLevel = level
        }
        
        // Update the votes count atomically
        this.store.setState({
            ...state,
            players
        });

        // Update UI
        this.updateVotesDisplay();
    }

    handleLevelSelected(data) {
        const { level } = data;
        this.store.setState({ 
            ...this.store.getState(),
            selectedLevel: level 
        });
        
        // Notify all players of the selected level
        const notification = document.createElement('div');
        notification.className = 'level-notification';
        notification.textContent = `Level ${level} has been selected!`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    handleChatMessage(data) {
        const { nickname, message } = data;
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message';
            messageElement.innerHTML = `
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
                <span class="player-name">${nickname}:</span>
                <span class="message">${message}</span>
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    handleSyncPlayers(data) {
        // Update the store with synchronized state
        this.store.setState({
            ...this.store.getState(),
            players: data.players,
            levelVotes: data.levelVotes || {},
            selectedLevel: data.selectedLevel,
            playerCount: data.playerCount,
            readyCount: data.readyCount || data.players.filter(p => p.ready).length, // Use server's ready count
            waitingTimer: data.waitingTimer,
            startTimer: data.startTimer
        });

        // Force render to update the view
        this.render();
    }

    handleGameStarting(data) {
        const { countdown } = data;
        const state = this.store.getState();
        if (state.gameStarting) return;

        this.store.setState({ 
            ...this.store.getState(),
            gameStarting: true, 
            countdown: countdown 
        });

        const countdownInterval = setInterval(() => {
            const state = this.store.getState();
            if (state.countdown <= 1) {
                clearInterval(countdownInterval);
            } else {
                this.store.setState({ countdown: state.countdown - 1 });
            }
        }, 1000);
    }

    // -- UI Control --

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

        // Add chat event listeners
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const minimizeBtn = document.querySelector('.minimize-btn');
        const chat = document.querySelector('.chat');

        if (chatInput && sendBtn) {
            const sendMessage = () => {
                const message = chatInput.value.trim();
                if (message) {
                    webSocket.send('chat', {
                        nickname: this.nickname,
                        message: message
                    });
                    chatInput.value = '';
                }
            };

            sendBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }

        if (minimizeBtn && chat) {
            minimizeBtn.addEventListener('click', () => {
                chat.classList.toggle('minimized');
            });
        }
    }

    updateVotesDisplay() {
        console.log('updateVotesDisplay')
        const state = this.store.getState();
        const player = state.players.find(p => p.nickname === this.nickname);
        
        // Update vote counts for each level
        ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].forEach(level => {
            // Count votes for this level
            const votes = Object.values(state.players).filter(p => p.votedLevel === level).length;
            
            // Update the vote count display
            const voteDisplay = document.querySelector(`[data-level="${level}"] .vote-count`);
            if (voteDisplay) {
                voteDisplay.textContent = votes > 0 ? votes : '0';
            }
            
            // Update button states
            const levelBtn = document.querySelector(`[data-level="${level}"]`);
            if (levelBtn) {
                // Disable if player is already ready
                levelBtn.disabled = !!player.ready;
                
                // Highlight if this is the selected level
                if (player.votedLevel === level) {
                    levelBtn.classList.add('selected');
                } else {
                    levelBtn.classList.remove('selected');
                }
            }
        });

        // Update ready button state
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            const isReady = player ? player.ready : false;
            readyBtn.disabled = !player.votedLevel;
            readyBtn.textContent = isReady ? 'Not Ready' : 'Ready';
            if (isReady) {
                readyBtn.classList.add('ready');
            } else {
                readyBtn.classList.remove('ready');
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
                <div class="player-item ${player.ready ? 'ready' : ''}">
                    <span class="player-name">${player.nickname}</span>
                    <span class="player-status">${player.ready ? '✓ Ready' : 'Not Ready'}</span>
                    ${player.votedLevel ? `<span class="player-vote">Vote: ${player.votedLevel}</span>` : ''}
                </div>
            `).join('');
        }
        
        if (playerCountElement) {
            playerCountElement.textContent = `${state.playerCount}/${state.gameSettings.maxPlayers}`;
        }
    }

    // -- START GAME --

    startGame(initialState) {
        const state = this.store.getState();
        const selectedLevel = state.selectedLevel || '1';  // Default to level 1 if no selection
        
        // Save the selected level to localStorage
        localStorage.setItem('selectedLevel', selectedLevel);

        // Save initial grid
        localStorage.setItem('initialState', JSON.stringify(initialState));
        
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
                gameStatus: 'running',
                timestamp: Date.now()
            }
        };
        localStorage.setItem('playerSession', JSON.stringify(session));

        // Clean up and transition
        window.location.hash = '/game';
    }

    // -- COMPONENT RENDERING --
    
    render() {
        const state = this.store.getState();
        const currentPlayer = state.players.find(p => p.nickname === this.nickname);
        const isReady = currentPlayer?.ready || false;
        
        let html = `
            <div class="page-container">
                <div class="main-content">
                    <div class="lobby-container">
                        <h1>Bomberman Lobby</h1>`;

        // Only show join section if not joined
        if (!this.isJoined) {
            html += `
                <div class="join-section">
                    <input type="text" id="nickname" placeholder="Enter your nickname" 
                           value="${this.nickname}">
                    <button id="joinBtn">Join Game</button>
                    ${this.errorMessage !== '' ? `<div class="error-message">${this.errorMessage}</div>` : ``}
                </div>`;
        }
        // Show game controls if joined
        else {
            html += `
            <div class="lobby-controls-container">
                <button id="readyBtn" class="${isReady ? 'ready' : ''}" 
                            ${!currentPlayer.votedLevel ? 'disabled' : ''}>
                        ${isReady ? 'Not Ready' : 'Ready'}
                </button>
                <div class="level-selection">
                    <h2>Select Level:</h2>
                    <p class="level-note">You must vote for a level before marking yourself as ready</p>
                    <div class="level-buttons">
                        ${Array.from({ length: 6 }, (_, i) => i + 1)
                            .map(level => {
                                const levelKey = `L${level}`;
                                const votes = Object.values(state.players)
                                    .filter(p => p.votedLevel === levelKey).length;
                                const isSelected = currentPlayer.votedLevel === levelKey;
                                return `
                                    <button class="level-btn ${isSelected ? 'selected' : ''}" 
                                            data-level="${levelKey}" 
                                             ${currentPlayer.ready ? 'disabled' : ''}>
                                        Level ${level}
                                        <span class="vote-count">${votes}</span>
                                    </button>
                                `;
                            }).join('')}
                    </div>
                </div>
                <div class="players-container">
                    ${state.players.map(player => `
                        <div class="player-item ${player.ready ? 'ready' : ''}">
                            <span class="player-name">${player.nickname}</span>
                            <span class="player-status">${player.ready ? 'Ready' : 'Not Ready'}</span>
                            ${player.nickname === this.nickname ? ' (You)' : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="stats-container">
                    <div class="player-count">
                        Ready Players: ${state.readyCount} / ${state.gameSettings.maxPlayers}
                    </div>
                    <div class="time-count ${(state.startTimer !== null && state.startTimer <= 5) ? 'urgent' : ''}">
                        ${this.getTimerDisplay()}
                    </div>
                </div>
            </div>`;
                
        }

        html += `</div>`;

        // Add chat container if joined
        if (this.isJoined) {
            html += `<div class="game-panel right-panel"></div>`;
        }

        html += `</div></div>`;
        
        const root = document.getElementById('root');
        if (root) {
            root.innerHTML = html;
            this.attachEventListeners();
            
            // Initialize chat if joined
            if (this.isJoined && this.chat) {
                const rightPanel = document.querySelector('.right-panel');
                if (rightPanel) {
                    this.chat.initialize(rightPanel);
                }
            }
            
            this.initialRenderDone = true;
        }
    }

    getTimerDisplay() {
        const state = this.store.getState();
        const readyCount = state.readyCount || 0; // Use server's ready count
        
        let timerDisplay = '';
        
        if (readyCount < 2) {
            timerDisplay = 'Waiting for players...';
        } else if (readyCount >= 2 && readyCount < 4) {
            if (state.waitingTimer !== null) {
                timerDisplay = `Players joining: ${state.waitingTimer}s`;
            } else if (state.startTimer !== null) {
                timerDisplay = `Game starting in: ${state.startTimer}s`;
            }
        } else if (readyCount === 4) {
            if (state.startTimer !== null) {
                timerDisplay = `Game starting in: ${state.startTimer}s`;
            } else {
                timerDisplay = 'Starting game...';
            }
        }

        console.log('Timer Display:', {
            readyCount,
            waitingTimer: state.waitingTimer,
            startTimer: state.startTimer,
            display: timerDisplay
        });

        return timerDisplay;
    }

    updateTimerDisplay() {
        const timeCountElement = document.querySelector('.time-count');
        if (timeCountElement) {
            const timerDisplay = this.getTimerDisplay();
            const state = this.store.getState();
            
            // Update classes and content
            timeCountElement.className = `time-count ${(state.startTimer !== null && state.startTimer <= 5) ? 'urgent' : ''}`;
            timeCountElement.textContent = timerDisplay;
        }
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

        // Clean up chat if it exists
        if (this.chat) {
            this.chat.destroy();
        }
        
        this.mounted = false;
    }
}
