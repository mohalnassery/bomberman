// src/components/Game.js
import { Component } from '../core/component.js';
import { Map } from './Map.js';
import { Player } from './Player.js';
import { Chat } from './Chat.js';

export class Game extends Component {
    constructor(props) {
        super(props);
        this.players = [];
        this.map = new Map();
        this.chat = new Chat();
        this.isRunning = false;
    }

    start() {
        this.map.generateMap();
        this.addPlayers();
        this.chat.initialize();
        this.isRunning = true;
        this.gameLoop();
    }

    addPlayers() {
        // Initialize players and add them to the game
        const startingPositions = [
            { x: 0, y: 0 },
            { x: this.map.width - 1, y: 0 },
            { x: 0, y: this.map.height - 1 },
            { x: this.map.width - 1, y: this.map.height - 1 },
        ];

        for (let i = 0; i < 4; i++) {
            const player = new Player(i + 1, `Player${i + 1}`, startingPositions[i]);
            this.players.push(player);
        }
    }

    gameLoop() {
        if (!this.isRunning) return;
        // Update game state
        this.update();
        // Render game
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update game logic
        this.players.forEach(player => player.update());
    }

    render() {
        // Render game components
        this.map.render();
        this.players.forEach(player => player.render());
        this.chat.render();
    }
}
