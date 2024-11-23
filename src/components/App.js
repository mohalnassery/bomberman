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
        if (this.currentComponent) {
            if (typeof this.currentComponent.destroy === 'function') {
                this.currentComponent.destroy();
            }
            this.currentComponent = null;
        }
    }

    showLobby() {
        this.cleanup();
        
        // Clear any existing game data
        localStorage.removeItem('playerInfo');
        
        const lobby = new Lobby();
        this.currentComponent = lobby;
        lobby.render();
    }

    async showGame() {
        this.cleanup();
        
        try {
            const playerInfo = JSON.parse(localStorage.getItem('playerInfo'));
            const playerSession = JSON.parse(localStorage.getItem('playerSession'));
            
            if (!playerInfo || !playerSession || !playerInfo.playerId) {
                throw new Error('Missing player information');
            }

            const game = new Game({ 
                playerInfo,
                gameState: playerSession.gameState
            });
            
            this.currentComponent = game;
            await game.start();
        } catch (error) {
            console.error('Failed to start game:', error);
            localStorage.removeItem('playerInfo');
            localStorage.removeItem('playerSession');
            window.location.hash = '/';
        }
    }

    showNotFound() {
        this.cleanup();
        const root = document.getElementById('root');
        root.innerHTML = '<h1>404 - Page Not Found</h1>';
    }

    render() {
        // Initial render handled by router
    }
}
