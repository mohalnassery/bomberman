// src/components/Lobby.js
import { Component } from '../core/component.js';
import { Store } from '../core/state.js';

export class Lobby extends Component {
    constructor(props) {
        super(props);
        this.store = new Store({ 
            players: [], 
            playerCount: 0,
            gameStarting: false,
            countdown: null
        });
        this.nickname = '';
        this.handleNicknameInput = this.handleNicknameInput.bind(this);
        this.handleJoinGame = this.handleJoinGame.bind(this);
        this.updatePlayerCount = this.updatePlayerCount.bind(this);
        this.startCountdown = this.startCountdown.bind(this);
        this.timeoutId = null;
    }

    handleNicknameInput(event) {
        this.nickname = event.target.value.trim();
    }

    startCountdown(seconds) {
        const state = this.store.getState();
        if (state.gameStarting) return;

        this.store.setState({ 
            gameStarting: true, 
            countdown: seconds 
        });

        const countdownInterval = setInterval(() => {
            const currentCount = this.store.getState().countdown;
            if (currentCount <= 1) {
                clearInterval(countdownInterval);
                window.location.hash = '#/game';
            } else {
                this.store.setState({ countdown: currentCount - 1 });
            }
        }, 1000);
    }

    handleJoinGame() {
        // Validate nickname
        if (this.nickname.length === 0) {
            alert('Please enter a nickname.');
            return;
        }

        if (this.store.getState().players.includes(this.nickname)) {
            alert('This nickname is already taken.');
            return;
        }

        // Add player to the game
        const currentPlayers = this.store.getState().players;
        const newPlayerCount = currentPlayers.length + 1;

        this.store.setState({ 
            players: [...currentPlayers, this.nickname],
            playerCount: newPlayerCount
        });

        // Start countdown logic
        if (newPlayerCount === 4) {
            // If we have 4 players, start 10 second countdown immediately
            this.startCountdown(10);
        } else if (newPlayerCount >= 2) {
            // If we have 2-3 players, start 20 second timeout
            if (this.timeoutId) clearTimeout(this.timeoutId);
            
            this.timeoutId = setTimeout(() => {
                this.startCountdown(10);
            }, 20000);
        }
    }

    updatePlayerCount() {
        const state = this.store.getState();
        const countDisplay = document.getElementById('playerCount');
        const countdownDisplay = document.getElementById('countdown');
        
        if (countDisplay) {
            countDisplay.textContent = state.playerCount;
        }
        
        if (countdownDisplay && state.gameStarting) {
            countdownDisplay.textContent = state.countdown;
            countdownDisplay.style.display = 'block';
        }
    }

    render() {
        const root = document.getElementById('root');
        root.innerHTML = `
            <div class="lobby">
                <h1>Welcome to Bomberman DOM</h1>
                <div class="nickname-input">
                    <input type="text" id="nickname" placeholder="Enter your nickname" maxlength="15" />
                    <p class="error-message" id="nicknameError"></p>
                </div>
                <button id="joinBtn">Join Game</button>
                <div class="lobby-status">
                    <p>Players in lobby: <span id="playerCount">${this.store.getState().playerCount}</span>/4</p>
                    <p class="countdown" id="countdown" style="display: none;">Game starting in: ${this.store.getState().countdown || ''}</p>
                </div>
            </div>
        `;

        document.getElementById('nickname').addEventListener('input', this.handleNicknameInput);
        document.getElementById('joinBtn').addEventListener('click', this.handleJoinGame);
        this.store.subscribe(this.updatePlayerCount);
    }

    destroy() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        super.destroy();
    }
}
