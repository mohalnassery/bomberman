// src/components/App.js
import { Component } from '../core/component.js';
import { Router } from '../core/router.js';
import { Lobby } from './Lobby.js';
import { Game } from './Game.js';

export class App extends Component {
    constructor(props) {
        super(props);
        this.currentComponent = null;
        this.router = new Router({
            '/': this.showLobby.bind(this),
            '/game': this.showGame.bind(this),
            '*': this.showNotFound.bind(this),
        });
    }

    cleanup() {
        if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
            this.currentComponent.destroy();
        }
    }

    showLobby() {
        this.cleanup();
        const lobby = new Lobby();
        this.currentComponent = lobby;
        lobby.render();
    }

    async showGame() {
        this.cleanup();
        try {
            const playerInfo = JSON.parse(localStorage.getItem('playerInfo'));
            if (!playerInfo || !playerInfo.nickname) {
                throw new Error('No player information found');
            }

            const game = new Game({ playerInfo });
            this.currentComponent = game;
            await game.start();
        } catch (error) {
            console.error('Failed to start game:', error);
            window.location.hash = '/';
        }
    }

    showNotFound() {
        this.cleanup();
        const root = document.getElementById('root');
        root.innerHTML = `
            <div class="not-found">
                <h1>404 - Page Not Found</h1>
                <a href="#/">Return to Lobby</a>
            </div>
        `;
    }

    render() {
        // Initial render handled by router
    }
}
