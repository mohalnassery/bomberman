// src/components/App.js
import { Component } from '../core/component.js';
import { Router } from '../core/router.js';
import { Lobby } from './Lobby.js';
import { Game } from './Game.js';

export class App extends Component {
    constructor(props) {
        super(props);
        this.router = new Router({
            '/': this.showLobby.bind(this),
            '/game': this.showGame.bind(this),
            '*': this.showNotFound.bind(this),
        });
    }

    showLobby() {
        const lobby = new Lobby();
        lobby.render();
    }

    showGame() {
        const game = new Game();
        game.start();
    }

    showNotFound() {
        // Implement 404 view
        document.getElementById('root').innerHTML = '<h1>404 - Page Not Found</h1>';
    }

    render() {
        // Initial render handled by router
    }
}
