#!/bin/bash

# Create project directories
mkdir -p bomberman-dom/{src/{core,utils,components,assets/images},styles,scripts}

# Navigate to the project directory
cd bomberman-dom

# Create index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bomberman DOM</title>
    <link rel="stylesheet" href="styles/style.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="src/index.js"></script>
</body>
</html>
EOF

# Create styles/style.css
cat > styles/style.css << 'EOF'
/* styles/style.css */
/* General Styles */
body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    background-color: #222;
    color: #fff;
}
#root {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    position: relative;
}

/* Lobby Styles */
.lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}
.lobby input, .lobby button {
    padding: 10px;
    margin: 5px;
    font-size: 16px;
}

/* Game Map Styles */
.game-map {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
.row {
    display: flex;
}
.cell {
    width: 40px;
    height: 40px;
    border: 1px solid #333;
    box-sizing: border-box;
    position: relative;
}
.cell.wall {
    background-color: #555;
}
.cell.block {
    background-color: #888;
}
.cell.player {
    background-color: #0f0;
}
.cell.bomb {
    background-color: #f00;
}
.cell.explosion {
    background-color: #ff0;
}
.cell.power-up {
    background-color: #00f;
}

/* Chat Styles */
.chat {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 300px;
    background: rgba(0,0,0,0.7);
    color: #fff;
}
#chat-messages {
    max-height: 200px;
    overflow-y: auto;
    padding: 10px;
}
#chat-input {
    width: 100%;
    padding: 10px;
    box-sizing: border-box;
}
EOF

# Create src/index.js
cat > src/index.js << 'EOF'
// src/index.js
import { App } from './components/App.js';

const rootElement = document.getElementById('root');
const app = new App();
app.render(rootElement);
EOF

# Create src/core/component.js
cat > src/core/component.js << 'EOF'
// src/core/component.js
import { render } from './dom.js';

export class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = {};
    }

    setState(newState) {
        const prevState = this.state;
        this.state = { ...this.state, ...newState };
        this.update();
    }

    update() {
        const newVdom = this.render();
        if (this.base) {
            this.base = render(newVdom, this.base.parentNode, this.base);
        }
    }

    render() {
        throw new Error('Component must implement render method');
    }
}
EOF

# Create src/core/dom.js
cat > src/core/dom.js << 'EOF'
// src/core/dom.js
export function createElement(tag, attrs = {}, ...children) {
    return { tag, attrs, children };
}

export function render(vdom, container, oldDom = container.firstChild) {
    if (!vdom) return;

    if (typeof vdom === 'string' || typeof vdom === 'number') {
        const textNode = document.createTextNode(vdom);
        if (oldDom) {
            container.replaceChild(textNode, oldDom);
        } else {
            container.appendChild(textNode);
        }
        return textNode;
    }

    const { tag, attrs, children } = vdom;
    const domElement = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs || {})) {
        domElement.setAttribute(key, value);
    }

    children.forEach(child => render(child, domElement));

    if (oldDom) {
        container.replaceChild(domElement, oldDom);
    } else {
        container.appendChild(domElement);
    }

    return domElement;
}
EOF

# Create src/core/events.js
cat > src/core/events.js << 'EOF'
// src/core/events.js
export function on(eventType, selector, handler) {
    document.addEventListener(eventType, (event) => {
        if (event.target.matches(selector) || event.target.closest(selector)) {
            handler(event);
        }
    });
}

export function off(eventType, selector, handler) {
    // Note: Removing event listeners requires keeping a reference to the bound function
}

export function emit(eventType, detail = {}) {
    const event = new CustomEvent(eventType, { detail });
    document.dispatchEvent(event);
}
EOF

# Create src/core/router.js
cat > src/core/router.js << 'EOF'
// src/core/router.js
export class Router {
    constructor(routes) {
        this.routes = routes;
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        const route = this.routes[hash] || this.routes['*'];
        route();
    }
}
EOF

# Create src/core/state.js
cat > src/core/state.js << 'EOF'
// src/core/state.js
export class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        const prevState = this.state;
        this.state = { ...this.state, ...newState };
        this.listeners.forEach((listener) => listener(this.state, prevState));
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }
}
EOF

# Create src/utils/helpers.js
cat > src/utils/helpers.js << 'EOF'
// src/utils/helpers.js
export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return document.querySelectorAll(selector);
}
EOF

# Create src/components/App.js
cat > src/components/App.js << 'EOF'
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
EOF

# Create src/components/Lobby.js
cat > src/components/Lobby.js << 'EOF'
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
EOF

# Create src/components/Game.js
cat > src/components/Game.js << 'EOF'
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
EOF

# Create src/components/Map.js
cat > src/components/Map.js << 'EOF'
// src/components/Map.js
import { $ } from '../utils/helpers.js';

export class Map {
    constructor() {
        this.grid = [];
        this.width = 15;
        this.height = 13;
    }

    generateMap() {
        // Generate map with walls and destructible blocks
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                let cellType = 'empty';

                // Place indestructible walls
                if (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1) {
                    cellType = 'wall';
                } else if (y % 2 === 0 && x % 2 === 0) {
                    cellType = 'wall';
                } else if (Math.random() < 0.7) {
                    cellType = 'block';
                }

                this.grid[y][x] = {
                    type: cellType,
                    hasPlayer: false,
                    hasBomb: false,
                    hasPowerUp: false,
                };
            }
        }

        // Clear starting positions
        const startingPositions = [
            { x: 1, y: 1 },
            { x: this.width - 2, y: 1 },
            { x: 1, y: this.height - 2 },
            { x: this.width - 2, y: this.height - 2 },
        ];

        startingPositions.forEach(pos => {
            this.grid[pos.y][pos.x].type = 'empty';
            this.grid[pos.y][pos.x + 1].type = 'empty';
            this.grid[pos.y + 1][pos.x].type = 'empty';
        });
    }

    render() {
        const root = $('#root');
        let mapHtml = '<div class="game-map">';
        for (let y = 0; y < this.height; y++) {
            mapHtml += '<div class="row">';
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                let cellClass = 'cell';
                if (cell.type === 'wall') cellClass += ' wall';
                if (cell.type === 'block') cellClass += ' block';
                mapHtml += `<div class="${cellClass}" data-x="${x}" data-y="${y}"></div>`;
            }
            mapHtml += '</div>';
        }
        mapHtml += '</div>';
        root.innerHTML = mapHtml;
    }
}
EOF

# Create src/components/Player.js
cat > src/components/Player.js << 'EOF'
// src/components/Player.js
import { $ } from '../utils/helpers.js';
import { on } from '../core/events.js';

export class Player {
    constructor(id, name, position) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.lives = 3;
        this.speed = 1;
        this.bombCount = 1;
        this.flameRange = 1;
        this.keysPressed = {};
        this.initControls();
    }

    initControls() {
        on('keydown', 'body', (event) => {
            this.keysPressed[event.key] = true;
        });
        on('keyup', 'body', (event) => {
            this.keysPressed[event.key] = false;
        });
    }

    move() {
        const moveSpeed = this.speed;
        if (this.keysPressed['ArrowUp']) this.position.y -= moveSpeed;
        if (this.keysPressed['ArrowDown']) this.position.y += moveSpeed;
        if (this.keysPressed['ArrowLeft']) this.position.x -= moveSpeed;
        if (this.keysPressed['ArrowRight']) this.position.x += moveSpeed;

        // Collision detection and boundaries
        this.position.x = Math.max(0, Math.min(this.position.x, 14));
        this.position.y = Math.max(0, Math.min(this.position.y, 12));
    }

    placeBomb() {
        // Implement bomb placement logic
    }

    applyPowerUp(powerUp) {
        switch (powerUp) {
            case 'Bombs':
                this.bombCount += 1;
                break;
            case 'Flames':
                this.flameRange += 1;
                break;
            case 'Speed':
                this.speed += 0.5;
                break;
        }
    }

    update() {
        this.move();
    }

    render() {
        // Remove previous player cell
        const previousCells = document.querySelectorAll(`.cell.player-${this.id}`);
        previousCells.forEach(cell => cell.classList.remove(`player-${this.id}`));

        // Render player on the map
        const cell = $(`.cell[data-x="${Math.round(this.position.x)}"][data-y="${Math.round(this.position.y)}"]`);
        if (cell) {
            cell.classList.add(`player-${this.id}`);
        }
    }
}
EOF

# Create src/components/Bomb.js
cat > src/components/Bomb.js << 'EOF'
// src/components/Bomb.js
import { $ } from '../utils/helpers.js';
import { Map } from './Map.js';

export class Bomb {
    constructor(position, flameRange, ownerId, map) {
        this.position = position;
        this.flameRange = flameRange;
        this.ownerId = ownerId;
        this.timer = 3000; // 3 seconds
        this.map = map;
        this.startTimer();
    }

    startTimer() {
        this.render();
        setTimeout(() => {
            this.explode();
        }, this.timer);
    }

    explode() {
        // Handle explosion logic
        const explosionPositions = this.getExplosionPositions();

        explosionPositions.forEach(pos => {
            const cell = this.map.grid[pos.y][pos.x];
            if (cell.type === 'block') {
                cell.type = 'empty';
                // Chance to spawn power-up
                if (Math.random() < 0.3) {
                    cell.hasPowerUp = true;
                    cell.powerUpType = this.randomPowerUp();
                }
            }
            // Handle damage to players
        });

        this.renderExplosion(explosionPositions);
        // Remove explosion after a short delay
        setTimeout(() => {
            this.clearExplosion(explosionPositions);
        }, 500);
    }

    getExplosionPositions() {
        const positions = [{ x: this.position.x, y: this.position.y }];

        // Add positions in four directions based on flameRange
        const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
        ];

        directions.forEach(dir => {
            for (let i = 1; i <= this.flameRange; i++) {
                const x = this.position.x + dir.dx * i;
                const y = this.position.y + dir.dy * i;
                if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) break;
                const cell = this.map.grid[y][x];
                if (cell.type === 'wall') break;
                positions.push({ x, y });
                if (cell.type === 'block') break;
            }
        });

        return positions;
    }

    randomPowerUp() {
        const powerUps = ['Bombs', 'Flames', 'Speed'];
        return powerUps[Math.floor(Math.random() * powerUps.length)];
    }

    render() {
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.add('bomb');
        }
    }

    renderExplosion(positions) {
        positions.forEach(pos => {
            const cell = $(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (cell) {
                cell.classList.add('explosion');
                cell.classList.remove('bomb', 'block');
            }
        });
    }

    clearExplosion(positions) {
        positions.forEach(pos => {
            const cell = $(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (cell) {
                cell.classList.remove('explosion');
            }
        });
    }
}
EOF

# Create src/components/PowerUp.js
cat > src/components/PowerUp.js << 'EOF'
// src/components/PowerUp.js
import { $ } from '../utils/helpers.js';

export class PowerUp {
    constructor(type, position) {
        this.type = type;
        this.position = position;
    }

    collect(player) {
        player.applyPowerUp(this.type);
        // Remove power-up from the map
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.remove('power-up', this.type);
        }
    }

    render() {
        // Render power-up on the map
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.add('power-up', this.type);
        }
    }
}
EOF

# Create src/components/Chat.js
cat > src/components/Chat.js << 'EOF'
// src/components/Chat.js
import { $ } from '../utils/helpers.js';

export class Chat {
    constructor() {
        this.socket = null;
        this.messages = [];
    }

    initialize() {
        this.setupUI();
        this.socket = new WebSocket('ws://localhost:8080');
        this.socket.addEventListener('open', () => {
            console.log('Connected to chat server');
        });
        this.socket.addEventListener('message', this.receiveMessage.bind(this));
    }

    setupUI() {
        const root = $('#root');
        const chatHtml = `
            <div class="chat">
                <div id="chat-messages"></div>
                <input type="text" id="chat-input" placeholder="Type a message..." />
            </div>
        `;
        root.insertAdjacentHTML('beforeend', chatHtml);
        $('#chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage(e.target.value);
                e.target.value = '';
            }
        });
    }

    sendMessage(message) {
        if (message.trim() === '') return;
        this.socket.send(JSON.stringify({ message }));
    }

    receiveMessage(event) {
        const data = JSON.parse(event.data);
        this.messages.push(data.message);
        this.render();
    }

    render() {
        const chatMessages = $('#chat-messages');
        chatMessages.innerHTML = this.messages.map(msg => `<p>${msg}</p>`).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
EOF

# Create src/assets/images/ (empty directory for images)

# Make sure the script has execute permissions
chmod +x scripts/setup.sh

echo "Project setup complete. You can now start developing your Bomberman DOM game."
