// src/components/Lobby.js
import { Component } from '../core/component.js';
import { Store } from '../core/state.js';

export class Lobby extends Component {
    constructor(props) {
        super(props);
        this.store = new Store({ players: [], playerCount: 1 });
        this.nickname = '';
        this.handleNicknameInput = this.handleNicknameInput.bind(this);
        this.handleJoinGame = this.handleJoinGame.bind(this);
        this.updatePlayerCount = this.updatePlayerCount.bind(this);
    }

    handleNicknameInput(event) {
        this.nickname = event.target.value;
    }

    handleJoinGame() {
        if (this.nickname.trim() === '') {
            alert('Please enter a nickname.');
            return;
        }
        // Logic to add player to the lobby and update player counter
        this.store.setState({ playerCount: this.store.getState().playerCount + 1 });
        // Simulate server response
        setTimeout(() => {
            window.location.hash = '#/game';
        }, 1000);
    }

    updatePlayerCount() {
        document.getElementById('playerCount').textContent = this.store.getState().playerCount;
    }

    render() {
        const root = document.getElementById('root');
        root.innerHTML = `
            <div class="lobby">
                <h1>Welcome to Bomberman DOM</h1>
                <input type="text" id="nickname" placeholder="Enter your nickname" />
                <button id="joinBtn">Join Game</button>
                <p>Players in lobby: <span id="playerCount">${this.store.getState().playerCount}</span>/4</p>
            </div>
        `;

        document.getElementById('nickname').addEventListener('input', this.handleNicknameInput);
        document.getElementById('joinBtn').addEventListener('click', this.handleJoinGame);
        this.store.subscribe(this.updatePlayerCount);
    }
}
