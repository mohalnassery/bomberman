# Project Documentation

## Excluded Files

The following files are excluded from this documentation:
- `audit.md`
- `todo.md`
- `project_documentation.md`
- `documenter.py`

## Project Structure

```
index.html
package-lock.json
package.json
project_documentation.md
README.md
todo2.md
├── Docs/
├── audit.md
├── objectives.md
└── todo.md
├── server/
├── http-server.js
└── index.js
├── src/
└── index.js
│   ├── components/
│   ├── App.js
│   ├── Bomb.js
│   ├── Chat.js
│   ├── Game.js
│   ├── Lobby.js
│   ├── Map.js
│   ├── Player.js
│   └── PowerUp.js
│   ├── core/
│   ├── component.js
│   ├── dom.js
│   ├── events.js
│   ├── router.js
│   ├── state.js
│   └── websocket.js
│   ├── levels/
│   ├── L1.TXT
│   ├── L2.TXT
│   ├── L3.TXT
│   ├── L4.TXT
│   ├── L5.TXT
│   └── L6.TXT
│   ├── styles/
│   ├── lobby.css
│   └── main.css
│   ├── utils/
│   └── helpers.js
├── styles/
└── style.css
```

# File Contents


## .gitignore

```
node_modules

```


## index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bomberman</title>
    <link rel="stylesheet" href="src/styles/main.css">
    <link rel="stylesheet" href="src/styles/lobby.css">
    <link rel="stylesheet" href="styles/style.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="src/index.js"></script>
</body>
</html>

```


## README.md

```md
# Bomberman DOM

A modern multiplayer Bomberman game implementation using JavaScript and WebSocket for real-time gameplay.

## Features

- Real-time multiplayer gameplay
- Interactive chat system with drag-and-drop interface
- Power-ups and collectibles
- Spectator mode for eliminated players
- Game over logic with victory/defeat screens
- Player statistics tracking
- Modern UI with animations and sound effects

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
   ```bash
   git clone [your-repository-url]
   cd bomberman-dom
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Game

### For Development

1. Start the WebSocket server:
   ```bash
   npm run server
   ```
   This will start the WebSocket server on port 8080.

2. In a separate terminal, start the development server:
   ```bash
   npm start
   ```

### For Local Network Access

To play the game on your local network:

1. Find your local IP address:
   ```bash
   # On Linux/Mac
   ip addr show
   # or
   ifconfig
   
   # On Windows
   ipconfig
   ```

2. Start the server with your local IP:
   ```bash
   # Replace [YOUR_LOCAL_IP] with your actual local IP
   HOST=[YOUR_LOCAL_IP] npm start
   ```

3. Access the game:
   - Local machine: `http://localhost:3000`
   - Other devices on the network: `http://[YOUR_LOCAL_IP]:3000`

## Game Controls

- **Arrow Keys**: Move player
- **Space**: Place bomb
- **Enter**: Send chat message
- **ESC**: Toggle chat window

## Features

### Gameplay
- Multiple players can join simultaneously
- Power-ups enhance player abilities
- Destructible environment
- Real-time bomb placement and explosions

### Chat System
- Draggable chat window
- Message timestamps
- Player nicknames
- Input sanitization for security

### Spectator Mode
- Eliminated players can watch the ongoing game
- Free camera movement
- Player statistics display

## Troubleshooting

1. If you see "426 Upgrade Required":
   - Make sure both the WebSocket server and game server are running
   - Check if the WebSocket port (8080) is not blocked by firewall

2. Connection Issues:
   - Verify your firewall settings allow WebSocket connections
   - Ensure you're using the correct IP address for local network play

## Security

- Chat input is sanitized to prevent XSS attacks
- WebSocket connections are validated
- Player actions are verified server-side

## Contributing

Feel free to submit issues and enhancement requests!

```


## Docs\objectives.md

```md
## bomberman-dom

You certainly know [bomberman](https://en.wikipedia.org/wiki/Bomberman) right? Good good. You will make it. Relax, is not that hard, it is only a multiplayer version of it. Ah and forgot to mention that you will need to do it using the framework you created a while ago. Let me explain.

### Objectives

For this project you have to create a bomberman alike game, where multiple players can join in and battle until one of them is the last man standing.

### Instructions

In the beginning there are 4 players, and only one came out alive. Each player will have to start in the different corners of the map and only one will be victorious.

You will have to follow more or less the same principles of [make-your-game](../make-your-game/README.md) project. But we will refresh one of the concepts you will have to respect and deal with:

- [**Performance**](../good-practices/README.md), is one of the most important aspects while developing a game, so let's respect it.\
   Just like make-your-game you will have to respect the policy of:

  - Running the game at least at **60fps** at all time
  - No frame drops
  - Proper use of [**`requestAnimationFrame`**](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
  - Measuring performance to know if your code is fast

You must not use canvas, neither [Web-GL](https://get.webgl.org/) nor another framework. For this project you will use the framework you did on the [mini-framework](../mini-framework/) project.

You will also have to make a chat that enables the different players to talk to each other. You will have to use [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API). This chat **can be considered as a "Hello World" of the multiplayer feature** for the **bomberman-dom**.

#### Game Mechanics

1. Players

   1. Nº of players: 2 - 4
   2. Each player must have 3 lives. Then you are out!!

2. Map

   1. The map should be fixed so that every player sees the whole map.
   2. There will be two types of blocks, the ones that can be destroyed (blocks) and the ones that can not (walls).
      1. The walls will always be placed in the same place, while the blocks are meant to be generated randomly on the map. Tip: the optional project [different maps](../make-your-game/different-maps/README.md) can be useful for this part.
      2. In the starting positions the players need to be able to survive. For example: if the players place a bomb, they will need to have space to avoid the bomb explosion.
   3. The players should be placed in the corners as their starting positions.

3. Power ups (each time a player destroys a block, a random power up may or may not appear):

   1. Bombs: Increases the amount of bombs dropped at a time by 1;
   2. Flames: Increases explosion range from the bomb in four directions by 1 block;
   3. Speed: Increases movement speed;

When the user opens the game, he/she should be presented to a page where he/she should enter a **nickname** to differentiate users. After selecting a nickname the user should be presented to a waiting page with a **player counter** that ends at 4. Once a user joins, the player counter will increment by 1.

If there are more than 2 players in the counter and it does not reach 4 players before 20 seconds, a 10 second timer starts, to players get ready to start the game.\
If there are 4 players in the counter before 20 seconds, the 10 seconds timer starts and the game starts.

#### Bonus

Although this bomberman already is super cool, it can be always better. Here are some ideas you can implement into the game to make it super awesomely cool:

- **Solo + Co-Op mode**: You are supposed to develop an AI to play against the players. So once the AI is defeated all players involved win.
- **More power ups**:
  - _Bomb Push_: Ability to throw a bomb after it has been placed;
  - _Bomb Pass_: Ability to pass through bombs;
  - _Block Pass_: Ability to pass through blocks (not walls);
  - _Detonator_: Ability to choose when a bomb will explode on a key press;
  - _1 Up_: Gives the player an extra life;
- **Release power ups after defeat**: When a player dies it drops one of it's power ups. If the player had no power ups, it drops a random power up.
- **Team mode**: Make games with 2v2 (two players versus two players).
- **After defeat interaction**: When a player dies, they can reappear as a ghost. If a ghost touches another player they come back to life. If a ghost is caught in a bomb explosion, the player controlling the ghost dies permanently.


```


## server\http-server.js

```js
import express from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files with correct MIME types
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) {
        res.type('application/javascript; charset=utf-8');
    }
    next();
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const networkInterface of interfaces[name]) {
            if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                return networkInterface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`Game server is running on:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://${localIP}:${PORT}`);
});

```


## server\index.js

```js
import { WebSocketServer } from 'ws';
import os from 'os';

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const networkInterface of interfaces[name]) {
            // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                return networkInterface.address;
            }
        }
    }
    return 'localhost';
}

class GameServer {
    constructor(port = 8080) {
        this.port = port;
        this.players = new Map();
        this.gameState = {
            players: [],
            bombs: [],
            powerUps: [],
            blocks: [],
            levelVotes: {},
            selectedLevel: null
        };
        this.setupServer();
    }

    setupServer() {
        const localIP = getLocalIP();
        this.wss = new WebSocketServer({ 
            port: this.port,
            perMessageDeflate: false, // Disable per-message deflate to prevent 426 error
            clientTracking: true // Enable client tracking
        });
        
        console.log(`WebSocket server is running on:`);
        console.log(`- Local: ws://localhost:${this.port}`);
        console.log(`- Network: ws://${localIP}:${this.port}`);

        this.wss.on('connection', this.handleConnection.bind(this));
    }

    handleConnection(ws) {
        console.log('New client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('Received message:', data);
                this.handleMessage(ws, data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('close', () => {
            this.handleDisconnection(ws);
        });
    }

    handleMessage(ws, data) {
        const { type, payload } = data;
        console.log('Handling message:', type, payload);

        switch (type) {
            case 'join':
                this.handlePlayerJoin(ws, payload);
                break;
            case 'ready':
                this.handlePlayerReady(ws, payload);
                break;
            case 'unready':
                this.handlePlayerUnready(ws, payload);
                break;
            case 'voteLevel':
                this.handleLevelVote(ws, payload);
                break;
            case 'move':
                this.handlePlayerMove(ws, payload);
                break;
            case 'bomb':
                this.handleBombPlacement(ws, payload);
                break;
            case 'chat':
                this.broadcastMessage({
                    type: 'chat',
                    payload: {
                        message: payload.message,
                        player: this.players.get(ws)?.nickname
                    }
                });
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    }

    handleLevelVote(ws, data) {
        const { sessionId, level } = data;
        const player = this.players.get(ws);
        if (!player || player.id !== sessionId) return;

        // Update vote
        if (!this.gameState.levelVotes[level]) {
            this.gameState.levelVotes[level] = 0;
        }
        
        // Remove previous vote if exists
        Object.keys(this.gameState.levelVotes).forEach(l => {
            if (this.gameState.levelVotes[l] > 0 && player.votedLevel === l) {
                this.gameState.levelVotes[l]--;
            }
        });

        // Add new vote
        this.gameState.levelVotes[level]++;
        player.votedLevel = level;

        // Broadcast updated votes
        this.broadcastMessage({
            type: 'levelVoted',
            payload: {
                levelVotes: this.gameState.levelVotes
            }
        });
    }

    selectWinningLevel() {
        const votes = this.gameState.levelVotes;
        const levels = Object.keys(votes);
        
        if (levels.length === 0) {
            // No votes, select random level
            const allLevels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
            return allLevels[Math.floor(Math.random() * allLevels.length)];
        }

        // Find highest vote count
        const maxVotes = Math.max(...Object.values(votes));
        
        // Get all levels with max votes
        const topLevels = levels.filter(level => votes[level] === maxVotes);
        
        // Randomly select from top voted levels
        return topLevels[Math.floor(Math.random() * topLevels.length)];
    }

    checkGameStart() {
        const players = Array.from(this.players.values());
        if (players.length >= 2 && players.every(p => p.ready)) {
            // Select winning level before starting
            this.gameState.selectedLevel = this.selectWinningLevel();
            
            // Broadcast selected level
            this.broadcastMessage({
                type: 'levelSelected',
                payload: {
                    selectedLevel: this.gameState.selectedLevel
                }
            });

            // Start game countdown
            this.broadcastMessage({
                type: 'gameStarting',
                payload: {
                    countdown: 5,
                    selectedLevel: this.gameState.selectedLevel
                }
            });
        }
    }

    handlePlayerJoin(ws, data) {
        console.log('Processing join request:', data);
        const { nickname, sessionId } = data;
        
        // Validate data
        if (!nickname || !sessionId) {
            console.error('Invalid join data:', data);
            ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { 
                    message: 'Invalid join request: missing nickname or sessionId' 
                }
            }));
            return;
        }

        // Check max players
        if (this.gameState.players.length >= 4) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { 
                    message: 'Game is full' 
                }
            }));
            return;
        }

        console.log('Creating new player:', nickname, sessionId);
        const player = {
            id: sessionId,
            nickname,
            position: this.getStartPosition(this.gameState.players.length),
            lives: 3,
            powerUps: {
                bombs: 1,
                flames: 1,
                speed: 1
            },
            ready: false,
            votedLevel: null
        };

        this.players.set(ws, player);
        this.gameState.players.push(player);

        console.log('Current players:', this.gameState.players);

        // Send current game state to the new player
        ws.send(JSON.stringify({
            type: 'gameState',
            payload: {
                players: this.gameState.players,
                readyPlayers: Array.from(this.players.values())
                    .filter(p => p.ready)
                    .map(p => p.id),
                levelVotes: this.gameState.levelVotes,
                selectedLevel: this.gameState.selectedLevel
            }
        }));

        // Broadcast new player to all clients
        this.broadcastMessage({
            type: 'playerJoined',
            payload: {
                player
            }
        });
    }

    handlePlayerReady(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        player.ready = true;
        this.broadcastMessage({
            type: 'playerReady',
            payload: {
                playerId: player.id
            }
        });

        // Check if all players are ready to start the game
        this.checkGameStart();
    }

    handlePlayerUnready(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        player.ready = false;
        this.broadcastMessage({
            type: 'playerUnready',
            payload: {
                playerId: player.id
            }
        });
    }

    handlePlayerMove(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        // Update player position
        player.position = data.position;
        
        // Broadcast movement to all clients except sender
        this.broadcastMessage({
            type: 'playerMove',
            payload: {
                playerId: player.id,
                position: data.position
            }
        }, ws);
    }

    handleBombPlacement(ws, data) {
        const player = this.players.get(ws);
        if (!player) return;

        const bomb = {
            id: Date.now(),
            position: data.position,
            playerId: player.id,
            range: player.powerUps.flames
        };

        this.gameState.bombs.push(bomb);

        // Broadcast bomb placement to all clients
        this.broadcastMessage({
            type: 'bombPlaced',
            payload: {
                bomb
            }
        });

        // Schedule bomb explosion
        setTimeout(() => {
            this.handleBombExplosion(bomb);
        }, 3000);
    }

    handleBombExplosion(bomb) {
        // Remove bomb from game state
        this.gameState.bombs = this.gameState.bombs.filter(b => b.id !== bomb.id);

        // Calculate explosion area and affected players/blocks
        const affected = this.calculateExplosionEffects(bomb);

        // Broadcast explosion to all clients
        this.broadcastMessage({
            type: 'bombExplode',
            payload: {
                bomb,
                affected
            }
        });
    }

    handleDisconnection(ws) {
        const player = this.players.get(ws);
        if (!player) return;

        // Remove player from game state
        this.gameState.players = this.gameState.players.filter(p => p.id !== player.id);
        this.players.delete(ws);

        // Broadcast player disconnection
        this.broadcastMessage({
            type: 'playerLeave',
            payload: {
                playerId: player.id
            }
        });
    }

    calculateExplosionEffects(bomb) {
        // Implement explosion range and collision detection
        // Return affected players, blocks, and other bombs
        return {
            players: [],
            blocks: [],
            bombs: []
        };
    }

    getStartPosition(playerIndex) {
        const positions = [
            { x: 1, y: 1 },
            { x: 13, y: 1 },
            { x: 1, y: 11 },
            { x: 13, y: 11 }
        ];
        return positions[playerIndex] || positions[0];
    }

    broadcastMessage(message, exclude = null) {
        this.wss.clients.forEach(client => {
            if (client !== exclude && client.readyState === 1) { 
                client.send(JSON.stringify(message));
            }
        });
    }
}

// Start the server
const gameServer = new GameServer();

```


## src\index.js

```js
// src/index.js
import { App } from './components/App.js';

const rootElement = document.getElementById('root');
const app = new App();
app.render(rootElement);

```


## src\components\App.js

```js
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

```


## src\components\Bomb.js

```js
// src/components/Bomb.js
import { $ } from '../utils/helpers.js';
import { GameMap } from './Map.js';
import { PowerUp } from './PowerUp.js';

export class Bomb {
    constructor(position, flameRange, ownerId, gameMap) {
        this.position = position;
        this.flameRange = flameRange;
        this.ownerId = ownerId;
        this.timer = 3000; // 3 seconds
        this.gameMap = gameMap;
        this.explosionTimeout = null;
        this.chainReactionTimeout = null;
        this.startTimer();
    }

    startTimer() {
        this.render();
        this.explosionTimeout = setTimeout(() => {
            this.explode();
        }, this.timer);
    }

    explode() {
        const explosionPositions = this.getExplosionPositions();
        const chainReactionBombs = new Set();
        const affectedCells = new Set();

        explosionPositions.forEach(pos => {
            const cell = this.gameMap.grid[pos.y][pos.x];
            if (!cell) return;

            affectedCells.add(`${pos.x},${pos.y}`);

            if (cell.type === 'block') {
                cell.type = 'empty';
                if (Math.random() < 0.3) {
                    const powerUp = new PowerUp(
                        PowerUp.getRandomType(),
                        { x: pos.x, y: pos.y },
                        this.gameMap
                    );
                    powerUp.spawn();
                }
            }

            // Chain reaction with other bombs
            if (cell.hasBomb) {
                const bombAtCell = this.gameMap.getBombAt(pos.x, pos.y);
                if (bombAtCell && bombAtCell !== this) {
                    chainReactionBombs.add(bombAtCell);
                }
            }

            // Handle player damage
            this.gameMap.getPlayersInCell(pos.x, pos.y).forEach(player => {
                if (!player.isDefeated) {
                    player.handleExplosion(this.ownerId);
                }
            });
        });

        // Trigger chain reactions after a small delay
        if (chainReactionBombs.size > 0) {
            this.chainReactionTimeout = setTimeout(() => {
                chainReactionBombs.forEach(bomb => bomb.explode());
            }, 100);
        }

        this.showExplosionAnimation(Array.from(affectedCells));
        this.gameMap.removeBomb(this);
    }

    showExplosionAnimation(affectedCells) {
        affectedCells.forEach(cellCoord => {
            const [x, y] = cellCoord.split(',').map(Number);
            const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.classList.add('explosion');
                setTimeout(() => {
                    cell.classList.remove('explosion');
                }, 1000);
            }
        });
    }

    destroy() {
        if (this.explosionTimeout) {
            clearTimeout(this.explosionTimeout);
        }
        if (this.chainReactionTimeout) {
            clearTimeout(this.chainReactionTimeout);
        }
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.remove('bomb');
        }
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
                if (x < 0 || x >= this.gameMap.width || y < 0 || y >= this.gameMap.height) break;
                const cell = this.gameMap.grid[y][x];
                if (cell.type === 'wall') break;
                positions.push({ x, y });
                if (cell.type === 'block') break;
            }
        });

        return positions;
    }

    render() {
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.add('bomb');
        }
    }
}

```


## src\components\Chat.js

```js
// src/components/Chat.js
import { $ } from '../utils/helpers.js';
import webSocket from '../core/websocket.js';

function purifyText(text) {
    // Convert special characters to HTML entities
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        // Optional: Remove any control characters and non-printable characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

export class Chat {
    constructor(playerName) {
        this.playerName = playerName;
        this.messages = [];
        this.isMinimized = false;
        this.dragState = {
            isDragging: false,
            startX: 0,
            startY: 0
        };
    }

    initialize() {
        this.setupUI();
        this.setupWebSocket();
        this.setupDragAndDrop();
    }

    setupWebSocket() {
        webSocket.on('chatMessage', this.receiveMessage.bind(this));
        webSocket.on('playerJoined', (data) => {
            this.systemMessage(`${data.playerName} joined the game`);
        });
        webSocket.on('playerLeft', (data) => {
            this.systemMessage(`${data.playerName} left the game`);
        });
    }

    setupUI() {
        const root = $('#root');
        const chatHtml = `
            <div class="chat" id="chat-window">
                <div class="chat-header">
                    <span class="chat-title">Chat</span>
                    <div class="chat-controls">
                        <button class="minimize-btn">_</button>
                        <button class="close-btn">×</button>
                    </div>
                </div>
                <div class="chat-body">
                    <div id="chat-messages"></div>
                    <div class="chat-input-container">
                        <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200" />
                        <button id="send-btn">Send</button>
                    </div>
                </div>
            </div>
        `;
        root.insertAdjacentHTML('beforeend', chatHtml);

        // Event listeners
        $('#chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(e.target.value);
                e.target.value = '';
            }
        });

        $('#send-btn').addEventListener('click', () => {
            const input = $('#chat-input');
            this.sendMessage(input.value);
            input.value = '';
        });

        $('.minimize-btn').addEventListener('click', () => this.toggleMinimize());
        $('.close-btn').addEventListener('click', () => this.toggleMinimize(true));
    }

    setupDragAndDrop() {
        const chatWindow = $('#chat-window');
        const header = $('.chat-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            
            this.dragState = {
                isDragging: true,
                startX: e.clientX - chatWindow.offsetLeft,
                startY: e.clientY - chatWindow.offsetTop
            };
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.dragState.isDragging) return;

            const newX = e.clientX - this.dragState.startX;
            const newY = e.clientY - this.dragState.startY;

            // Keep window within viewport bounds
            const maxX = window.innerWidth - chatWindow.offsetWidth;
            const maxY = window.innerHeight - chatWindow.offsetHeight;
            
            chatWindow.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
            chatWindow.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            this.dragState.isDragging = false;
        });
    }

    toggleMinimize(forceClose = false) {
        const chatWindow = $('#chat-window');
        this.isMinimized = forceClose || !this.isMinimized;
        chatWindow.classList.toggle('minimized', this.isMinimized);
    }

    sendMessage(message) {
        message = message.trim();
        if (message === '') return;

        // Sanitize input using our custom purify function
        message = purifyText(message);
        
        webSocket.send('chatMessage', {
            message,
            playerName: this.playerName,
            timestamp: new Date().toISOString()
        });
    }

    systemMessage(message) {
        this.messages.push({
            type: 'system',
            message,
            timestamp: new Date().toISOString()
        });
        this.render();
    }

    receiveMessage(data) {
        this.messages.push({
            type: 'chat',
            playerName: data.playerName,
            message: data.message,
            timestamp: data.timestamp
        });
        this.render();
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    render() {
        const chatMessages = $('#chat-messages');
        chatMessages.innerHTML = this.messages.map(msg => {
            if (msg.type === 'system') {
                return `<div class="chat-message system">
                    <span class="timestamp">${this.formatTimestamp(msg.timestamp)}</span>
                    <span class="message">${msg.message}</span>
                </div>`;
            }
            return `<div class="chat-message ${msg.playerName === this.playerName ? 'own' : ''}">
                <span class="timestamp">${this.formatTimestamp(msg.timestamp)}</span>
                <span class="player-name">${msg.playerName}:</span>
                <span class="message">${msg.message}</span>
            </div>`;
        }).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

```


## src\components\Game.js

```js
// src/components/Game.js
import { Component } from '../core/component.js';
import { GameMap } from './Map.js';
import { Player } from './Player.js';
import { Chat } from './Chat.js';
import webSocket from '../core/websocket.js';

export class Game extends Component {
    constructor(props) {
        super(props);
        this.players = new Map();
        this.gameMap = new GameMap();
        this.chat = null;  // Initialize chat as null
        this.isRunning = false;
        this.isGameOver = false;
        this.winner = null;
        this.localPlayerId = null;
        this.spectatorMode = false;
        this.lastFrameTime = 0;
        this.setupWebSocket();
    }

    setupWebSocket() {
        webSocket.on('init', this.handleInitialState.bind(this));
        webSocket.on('playerJoin', this.handlePlayerJoin.bind(this));
        webSocket.on('playerLeave', this.handlePlayerLeave.bind(this));
        webSocket.on('playerMove', this.handlePlayerMove.bind(this));
        webSocket.on('bombPlaced', this.handleBombPlaced.bind(this));
        webSocket.on('bombExplode', this.handleBombExplode.bind(this));
        webSocket.on('playerDefeat', this.handlePlayerDefeat.bind(this));
        webSocket.on('gameOver', this.handleGameOver.bind(this));
        webSocket.on('error', this.handleError.bind(this));
    }

    async start() {
        try {
            await webSocket.connect();
            this.gameMap.generateMap();
            this.isRunning = true;
            this.gameLoop();
        } catch (error) {
            console.error('Failed to start game:', error);
        }
    }

    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;

        // Calculate delta time in seconds
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // Update game state
        this.update(deltaTime);

        // Render the game
        this.render();

        // Schedule next frame
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    handleInitialState(data) {
        const { gameState, playerId } = data;
        this.localPlayerId = playerId;

        // Initialize all existing players
        gameState.players.forEach(playerData => {
            if (!this.players.has(playerData.id)) {
                const player = new Player(
                    playerData.id,
                    playerData.nickname,
                    playerData.position,
                    this.gameMap
                );
                this.players.set(playerData.id, player);
                
                // Initialize chat with local player's nickname
                if (playerData.id === playerId) {
                    this.chat = new Chat(playerData.nickname);
                    this.chat.initialize();
                }
            }
        });

        // Check if joining an ongoing game
        if (gameState.spectatorMode) {
            this.enterSpectatorMode();
        }
    }

    handlePlayerJoin(data) {
        const { id, nickname, position } = data;
        if (!this.players.has(id)) {
            const player = new Player(id, nickname, position, this.gameMap);
            this.players.set(id, player);
        }
    }

    handlePlayerLeave(data) {
        const { playerId } = data;
        if (this.players.has(playerId)) {
            this.players.delete(playerId);
        }
    }

    handlePlayerMove(data) {
        const { playerId, position } = data;
        const player = this.players.get(playerId);
        if (player) {
            player.setPosition(position);
        }
    }

    handleBombPlaced(data) {
        const { position, playerId, range } = data;
        const player = this.players.get(playerId);
        if (player) {
            player.placeBomb(position, range);
        }
    }

    handleBombExplode(data) {
        const { position, affectedCells, playerId } = data;
        
        // Handle bomb explosion effects on blocks and items
        affectedCells.forEach(cell => {
            if (this.gameMap.grid[cell.y][cell.x]) {
                const currentCell = this.gameMap.grid[cell.y][cell.x];
                
                // Handle block destruction
                if (currentCell.type === 'block') {
                    currentCell.type = 'empty';
                    
                    // Chance to spawn power-up
                    if (Math.random() < 0.3) {  // 30% chance
                        const powerUpTypes = ['bomb', 'flame', 'speed'];
                        const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                        this.gameMap.addPowerUp(cell.x, cell.y, randomType);
                    }
                }
                
                // Check for players in explosion range
                this.players.forEach((player) => {
                    const playerX = Math.floor(player.position.x);
                    const playerY = Math.floor(player.position.y);
                    
                    if (playerX === cell.x && playerY === cell.y && !player.isDefeated) {
                        player.die();
                        if (playerId && playerId !== player.id) {
                            const killer = this.players.get(playerId);
                            if (killer) {
                                killer.killCount++;
                            }
                        }
                    }
                });
            }
        });
        
        // Remove the bomb from active bombs
        this.gameMap.removeBomb(position);
    }

    handlePlayerDefeat(data) {
        const { playerId, position } = data;
        const player = this.players.get(playerId);
        
        if (player) {
            player.die(position);
            
            // Enter spectator mode if local player died
            if (playerId === this.localPlayerId) {
                this.enterSpectatorMode();
            }
            
            // Check for game over
            this.checkGameOver();
        }
    }

    handleGameOver(data) {
        const { winnerId, winnerName } = data;
        this.isGameOver = true;
        this.winner = {
            id: winnerId,
            name: winnerName
        };
        this.showGameOverScreen();
    }

    handleError(error) {
        console.error('Game error:', error);
        // Handle error appropriately (show message to user, etc.)
    }

    enterSpectatorMode() {
        this.spectatorMode = true;
        // Enable free camera movement for spectating
        this.setupSpectatorControls();
    }

    setupSpectatorControls() {
        const camera = {
            x: 0,
            y: 0,
            speed: 5
        };

        document.addEventListener('keydown', (e) => {
            if (!this.spectatorMode) return;

            switch(e.key) {
                case 'ArrowLeft':
                    camera.x = Math.max(camera.x - camera.speed, 0);
                    break;
                case 'ArrowRight':
                    camera.x = Math.min(camera.x + camera.speed, this.gameMap.width * 40 - window.innerWidth);
                    break;
                case 'ArrowUp':
                    camera.y = Math.max(camera.y - camera.speed, 0);
                    break;
                case 'ArrowDown':
                    camera.y = Math.min(camera.y + camera.speed, this.gameMap.height * 40 - window.innerHeight);
                    break;
            }

            document.documentElement.style.setProperty('--camera-x', -camera.x + 'px');
            document.documentElement.style.setProperty('--camera-y', -camera.y + 'px');
        });
    }

    checkGameOver() {
        const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDefeated);
        
        if (alivePlayers.length === 1) {
            const winner = alivePlayers[0];
            webSocket.send('gameOver', {
                winnerId: winner.id,
                winnerName: winner.name
            });
        }
    }

    showGameOverScreen() {
        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        
        const content = document.createElement('div');
        content.className = 'game-over-content';
        
        const title = document.createElement('h1');
        title.textContent = this.winner.id === this.localPlayerId ? 'Victory!' : 'Game Over';
        title.className = this.winner.id === this.localPlayerId ? 'victory-title' : 'defeat-title';
        
        const message = document.createElement('p');
        message.textContent = `${this.winner.name} wins the game!`;
        
        const stats = document.createElement('div');
        stats.className = 'game-stats';
        // Add any relevant game stats here
        
        const buttons = document.createElement('div');
        buttons.className = 'game-over-buttons';
        
        const playAgainBtn = document.createElement('button');
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.onclick = () => window.location.reload();
        
        const lobbyBtn = document.createElement('button');
        lobbyBtn.textContent = 'Back to Lobby';
        lobbyBtn.onclick = () => {
            webSocket.send('returnToLobby');
            window.location.href = '/lobby.html';
        };
        
        buttons.appendChild(playAgainBtn);
        buttons.appendChild(lobbyBtn);
        
        content.appendChild(title);
        content.appendChild(message);
        content.appendChild(stats);
        content.appendChild(buttons);
        overlay.appendChild(content);
        
        document.body.appendChild(overlay);
    }

    update(deltaTime) {
        if (this.isGameOver) return;

        // Update all players
        this.players.forEach(player => {
            if (!player.isDefeated) {
                player.update(deltaTime);
            }
        });

        // Update local player position on server
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer && !localPlayer.isDefeated) {
            const oldPosition = { ...localPlayer.position };
            
            // Only send update if position changed
            if (oldPosition.x !== localPlayer.position.x || 
                oldPosition.y !== localPlayer.position.y) {
                webSocket.send('move', { position: localPlayer.position });
            }
        }

        // Update game map (bombs, explosions, etc.)
        this.gameMap.update(deltaTime);
    }

    render() {
        // Clear the game container
        const root = document.getElementById('root');
        if (!root) return;
        
        root.innerHTML = '';
        
        // Create game container
        const gameContainer = document.createElement('div');
        gameContainer.className = 'game-container';
        root.appendChild(gameContainer);
        
        // Render map
        this.gameMap.render(gameContainer);
        
        // Render all players
        this.players.forEach(player => {
            if (!player.isDefeated || this.spectatorMode) {
                player.render(gameContainer);
            }
        });
        
        // Render chat
        if (this.chat) {
            this.chat.render();
        }
        
        // Render spectator mode indicator
        if (this.spectatorMode) {
            const indicator = document.createElement('div');
            indicator.className = 'spectator-indicator';
            indicator.textContent = 'Spectator Mode';
            root.appendChild(indicator);
        }
    }

    destroy() {
        this.isRunning = false;
        webSocket.disconnect();
        super.destroy();
    }
}

```


## src\components\Lobby.js

```js
// src/components/Lobby.js
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
        this.nickname = '';
        this.isJoined = false;
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
    }

    handlePlayerJoined(data) {
        console.log('Player joined data:', data);
        const state = this.store.getState();
        
        // Update players array if player doesn't exist
        if (!state.players.find(p => p.id === data.player.id)) {
            state.players.push(data.player);
            state.playerCount = state.players.length;
        }
        
        this.store.setState(state);
        this.updatePlayerList();
    }

    handlePlayerLeft(data) {
        const state = this.store.getState();
        const { playerId } = data;
        const index = state.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            state.players.splice(index, 1);
            state.readyPlayers.delete(playerId);
            this.store.setState({
                players: state.players,
                playerCount: state.players.length,
                readyPlayers: state.readyPlayers
            });
            this.updatePlayerList();
        }
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
        
        // Update the store with new state while preserving existing properties
        this.store.setState({
            ...currentState,
            players: data.players || currentState.players,
            playerCount: data.players ? data.players.length : currentState.playerCount,
            readyPlayers: new Set(data.readyPlayers || []),
            levelVotes: data.levelVotes || {},
            selectedLevel: data.selectedLevel
        });

        // Update UI
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

        // Validate nickname
        if (this.nickname.length === 0) {
            alert('Please enter a nickname.');
            return;
        }

        try {
            // Connect to WebSocket if not connected
            if (!webSocket.connected) {
                await webSocket.connect();
            }

            const sessionId = this.generateSessionId();
            console.log('Joining with nickname:', this.nickname, 'sessionId:', sessionId);
            
            // Send join request
            webSocket.send('join', {
                nickname: this.nickname,
                sessionId: sessionId
            });

            this.isJoined = true;
            nicknameInput.disabled = true;
            document.getElementById('joinBtn').disabled = true;

            // Enable all level buttons
            const levelButtons = document.querySelectorAll('.level-btn');
            levelButtons.forEach(button => {
                button.disabled = false;
            });

            // Keep ready button disabled until vote
            document.getElementById('readyBtn').disabled = true;
        } catch (error) {
            console.error('Failed to join game:', error);
            alert('Failed to join game. Please try again.');
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
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

    handleVoteLevel(level) {
        if (!this.isJoined) return;

        // Update local state first for immediate feedback
        const state = this.store.getState();
        state.levelVotes[this.nickname] = level;
        this.store.setState(state);

        // Send vote to server
        webSocket.send('voteLevel', { 
            level,
            nickname: this.nickname
        });
        
        // Update UI
        this.updateLevelVotes();
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
        // Save player info and game settings
        localStorage.setItem('playerInfo', JSON.stringify({
            nickname: this.nickname,
            sessionId: this.generateSessionId(),
            settings: state.gameSettings
        }));
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
    }
}

```


## src\components\Map.js

```js
// src/components/Map.js
import { $ } from '../utils/helpers.js';

export class GameMap {
    constructor() {
        this.grid = [];
        this.width = 15;
        this.height = 13;
        this.players = new Map(); // Store player references
        this.currentLevel = 1;
        this.activeBombs = new Map(); // Track active bombs
        this.explosions = new Map(); // Track active explosions
        this.playerStartPositions = [];
    }

    async loadLevel(levelNumber) {
        try {
            // Validate level number
            if (!Number.isInteger(levelNumber) || levelNumber < 1) {
                throw new Error('Invalid level number');
            }
            
            // Use relative path and handle errors
            const response = await fetch(`../levels/L${levelNumber}.TXT`);
            if (!response.ok) {
                throw new Error(`Failed to load level ${levelNumber}`);
            }
            
            const mapData = await response.text();
            this.parseMapData(mapData);
            this.currentLevel = levelNumber;
        } catch (error) {
            console.error('Error loading level:', error);
            this.generateMap(); // Fallback to random map
        }
    }

    parseMapData(mapData) {
        const rows = mapData.trim().split('\n');
        
        // Validate map dimensions
        if (rows.length !== this.height) {
            throw new Error(`Invalid map height: ${rows.length}, expected ${this.height}`);
        }
        
        this.grid = [];
        this.playerStartPositions = [];
        
        for (let y = 0; y < rows.length; y++) {
            const cells = rows[y].trim().split('');
            
            // Validate row width
            if (cells.length !== this.width) {
                throw new Error(`Invalid map width at row ${y}: ${cells.length}, expected ${this.width}`);
            }
            
            this.grid[y] = [];
            
            for (let x = 0; x < cells.length; x++) {
                const char = cells[x];
                let cellType = 'empty';
                
                switch (char) {
                    case '*':
                        cellType = 'wall';
                        break;
                    case '-':
                        cellType = 'block';
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                        cellType = 'empty';
                        this.playerStartPositions.push({
                            id: parseInt(char),
                            position: { x, y }
                        });
                        break;
                    case 'P':
                        cellType = 'powerup';
                        break;
                    case ' ':
                        cellType = 'empty';
                        break;
                    default:
                        throw new Error(`Invalid map character at (${x}, ${y}): ${char}`);
                }
                
                this.grid[y][x] = {
                    type: cellType,
                    hasPlayer: false,
                    hasBomb: false,
                    powerUpType: cellType === 'powerup' ? this.getRandomPowerUpType() : null
                };
            }
        }
    }
    
    getRandomPowerUpType() {
        const types = ['bomb', 'flame', 'speed'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    addPowerUp(x, y, type) {
        if (this.grid[y][x] && this.grid[y][x].type === 'empty') {
            this.grid[y][x].type = 'powerup';
            this.grid[y][x].powerUpType = type;
        }
    }

    getPlayerStartPosition(playerNumber) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].playerStart === String(playerNumber)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    generateMap() {
        // Fallback random map generation
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                let cellType = 'empty';

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
                    hasExplosion: false
                };
            }
        }

        // Clear starting positions
        const startingPositions = [
            { x: 1, y: 1 },
            { x: this.width - 2, y: 1 },
            { x: 1, y: this.height - 2 },
            { x: this.width - 2, y: this.height - 2 }
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
                if (cell.type === 'powerup') cellClass += ' powerup';
                mapHtml += `<div class="${cellClass}" data-x="${x}" data-y="${y}"></div>`;
            }
            mapHtml += '</div>';
        }
        mapHtml += '</div>';
        root.innerHTML = mapHtml;
    }

    getPlayersInCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return [];
        }

        return Array.from(this.players.values()).filter(player => {
            const playerX = Math.floor(player.position.x);
            const playerY = Math.floor(player.position.y);
            return playerX === x && playerY === y;
        });
    }

    handlePlayerDefeat(player) {
        // Remove player from their current cell
        const playerX = Math.floor(player.position.x);
        const playerY = Math.floor(player.position.y);
        if (this.grid[playerY][playerX]) {
            this.grid[playerY][playerX].hasPlayer = false;
        }

        // Update player state
        player.isDefeated = true;
        
        // Check if game is over (only one player left)
        const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDefeated);
        if (alivePlayers.length === 1) {
            // Game over - we have a winner!
            webSocket.send('gameOver', {
                winner: alivePlayers[0].id,
                winnerName: alivePlayers[0].name
            });
        }
    }

    addPlayer(player) {
        this.players.set(player.id, player);
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
    }

    update(deltaTime) {
        // Update bombs
        this.activeBombs.forEach((bomb, id) => {
            bomb.update(deltaTime);
            if (bomb.shouldExplode) {
                this.handleBombExplosion(bomb);
                this.activeBombs.delete(id);
            }
        });

        // Update explosions
        this.explosions.forEach((explosion, id) => {
            explosion.update(deltaTime);
            if (explosion.isFinished) {
                this.explosions.delete(id);
                // Clear explosion cells
                explosion.cells.forEach(cell => {
                    if (this.grid[cell.y][cell.x]) {
                        this.grid[cell.y][cell.x].hasExplosion = false;
                    }
                });
            }
        });
    }

    handleBombExplosion(bomb) {
        const affectedCells = this.calculateExplosionCells(bomb);
        
        // Create explosion effect
        const explosion = {
            cells: affectedCells,
            duration: 0.5, // Duration in seconds
            timer: 0,
            update(deltaTime) {
                this.timer += deltaTime;
                this.isFinished = this.timer >= this.duration;
            },
            isFinished: false
        };

        this.explosions.set(Date.now(), explosion);

        // Mark cells as affected by explosion
        affectedCells.forEach(cell => {
            if (this.grid[cell.y][cell.x]) {
                const gridCell = this.grid[cell.y][cell.x];
                gridCell.hasExplosion = true;

                // Destroy blocks
                if (gridCell.type === 'block') {
                    gridCell.type = 'empty';
                }

                // Check for player hits
                const playersInCell = this.getPlayersInCell(cell.x, cell.y);
                playersInCell.forEach(player => {
                    if (!player.isDefeated) {
                        player.handleDefeat();
                    }
                });
            }
        });
    }

    calculateExplosionCells(bomb) {
        const cells = [];
        const directions = [
            { dx: 0, dy: 0 },   // Center
            { dx: 1, dy: 0 },   // Right
            { dx: -1, dy: 0 },  // Left
            { dx: 0, dy: 1 },   // Down
            { dx: 0, dy: -1 }   // Up
        ];

        directions.forEach(dir => {
            for (let i = 0; i <= bomb.range; i++) {
                const x = bomb.position.x + (dir.dx * i);
                const y = bomb.position.y + (dir.dy * i);

                // Check bounds
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                    break;
                }

                const cell = this.grid[y][x];
                cells.push({ x, y });

                // Stop explosion at walls
                if (cell.type === 'wall') {
                    break;
                }
            }
        });

        return cells;
    }

    addBomb(bomb) {
        const { x, y } = bomb.position;
        if (this.grid[y][x]) {
            this.grid[y][x].hasBomb = true;
            this.activeBombs.set(bomb.id, bomb);
        }
    }

    removeBomb(bombId) {
        const bomb = this.activeBombs.get(bombId);
        if (bomb) {
            const { x, y } = bomb.position;
            if (this.grid[y][x]) {
                this.grid[y][x].hasBomb = false;
            }
            this.activeBombs.delete(bombId);
        }
    }
}

```


## src\components\Player.js

```js
// src/components/Player.js
import { $ } from '../utils/helpers.js';
import { on } from '../core/events.js';
import webSocket from '../core/websocket.js';
import { PowerUp } from './PowerUp.js';

export class Player {
    constructor(id, name, position, gameMap) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.gameMap = gameMap;
        this.lives = 3;
        this.speed = 1;
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.flameRange = 1;
        this.keysPressed = {};
        this.isMoving = false;
        this.isDefeated = false;
        this.bombsPlaced = 0;
        this.killCount = 0;
        this.powerUpsCollected = 0;
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        this.initControls();
    }

    initControls() {
        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);
    }
    
    handleKeyDown(event) {
        this.keysPressed[event.key] = true;
        if (event.key === ' ' && !this.isDefeated) {
            this.placeBomb();
        }
    }
    
    handleKeyUp(event) {
        this.keysPressed[event.key] = false;
    }
    
    destroy() {
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
    }

    setPosition(position) {
        const oldCell = this.gameMap.grid[Math.floor(this.position.y)][Math.floor(this.position.x)];
        if (oldCell) {
            oldCell.hasPlayer = false;
        }

        this.position = position;
        
        const newCell = this.gameMap.grid[Math.floor(position.y)][Math.floor(position.x)];
        if (newCell) {
            newCell.hasPlayer = true;
        }
    }

    checkCollision(newX, newY) {
        // Convert position to grid coordinates
        const gridX = Math.floor(newX);
        const gridY = Math.floor(newY);

        // Check map boundaries
        if (gridX < 0 || gridX >= this.gameMap.width || gridY < 0 || gridY >= this.gameMap.height) {
            return true;
        }

        // Get cells that the player's hitbox would occupy
        const cellsToCheck = [
            this.gameMap.grid[gridY][gridX], // Target cell
            // Check adjacent cells if player is between grid lines
            this.gameMap.grid[Math.ceil(newY)][gridX],
            this.gameMap.grid[gridY][Math.ceil(newX)],
            this.gameMap.grid[Math.ceil(newY)][Math.ceil(newX)]
        ].filter(Boolean); // Remove undefined cells

        // Check for collisions with walls, blocks, or other players
        return cellsToCheck.some(cell => 
            cell.type === 'wall' || 
            cell.type === 'block' || 
            (cell.hasPlayer && !cell.hasPlayer[this.id]) ||
            cell.hasBomb
        );
    }

    update(deltaTime) {
        if (this.isDefeated) return;
        
        let dx = 0;
        let dy = 0;
        
        if (this.keysPressed['ArrowLeft']) dx -= this.speed * deltaTime;
        if (this.keysPressed['ArrowRight']) dx += this.speed * deltaTime;
        if (this.keysPressed['ArrowUp']) dy -= this.speed * deltaTime;
        if (this.keysPressed['ArrowDown']) dy += this.speed * deltaTime;
        
        if (dx !== 0 || dy !== 0) {
            const newX = this.position.x + dx;
            const newY = this.position.y + dy;
            
            // Check collision with grid boundaries
            if (newX < 0 || newX >= this.gameMap.width || newY < 0 || newY >= this.gameMap.height) {
                return;
            }
            
            // Check collision with walls and blocks
            const gridX = Math.floor(newX);
            const gridY = Math.floor(newY);
            const cell = this.gameMap.grid[gridY][gridX];
            
            if (cell.type === 'wall' || cell.type === 'block') {
                return;
            }
            
            // Check for power-ups
            if (cell.type === 'powerup') {
                this.collectPowerUp(cell.powerUpType);
                cell.type = 'empty';
                cell.powerUpType = null;
            }
            
            // Update position
            this.setPosition({ x: newX, y: newY });
        }
    }
    
    collectPowerUp(type) {
        switch (type) {
            case 'bomb':
                this.maxBombs++;
                break;
            case 'flame':
                this.flameRange++;
                break;
            case 'speed':
                this.speed += 0.2;
                break;
        }
        this.powerUpsCollected++;
    }

    checkPowerUps() {
        const currentCell = this.gameMap.grid[Math.floor(this.position.y)][Math.floor(this.position.x)];
        if (currentCell.hasPowerUp && currentCell.powerUp) {
            currentCell.powerUp.collect(this);
        }
    }

    applyPowerUp(powerUp) {
        switch (powerUp) {
            case PowerUp.TYPES.BOMB:
                this.maxBombs = Math.min(this.maxBombs + 1, 8); // Cap at 8 bombs
                break;
            case PowerUp.TYPES.FLAME:
                this.flameRange = Math.min(this.flameRange + 1, 6); // Cap at 6 range
                break;
            case PowerUp.TYPES.SPEED:
                this.speed = Math.min(this.speed + 0.5, 3); // Cap at 3x speed
                break;
        }

        // Play power-up sound
        const audio = new Audio('/assets/sounds/powerup.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignore if sound fails to play

        // Notify other players of power-up collection
        webSocket.send('powerUpCollected', {
            playerId: this.id,
            powerUp: powerUp,
            position: {
                x: Math.floor(this.position.x),
                y: Math.floor(this.position.y)
            },
            stats: {
                maxBombs: this.maxBombs,
                flameRange: this.flameRange,
                speed: this.speed
            }
        });
    }

    placeBomb() {
        if (this.activeBombs < this.maxBombs && !this.isDefeated) {
            const bombX = Math.round(this.position.x);
            const bombY = Math.round(this.position.y);
            
            // Check if there's already a bomb at this position
            if (!this.gameMap.grid[bombY][bombX].hasBomb) {
                this.gameMap.grid[bombY][bombX].hasBomb = true;
                this.activeBombs++;
                
                // Create and store the bomb instance
                const bomb = new Bomb(
                    { x: bombX, y: bombY },
                    this.flameRange,
                    this.id,
                    this.gameMap
                );
                this.gameMap.grid[bombY][bombX].bomb = bomb;
                
                webSocket.send('bomb', { 
                    position: { x: bombX, y: bombY },
                    range: this.flameRange,
                    playerId: this.id
                });

                // Restore bomb count after explosion
                setTimeout(() => {
                    this.activeBombs--;
                }, 3000);
            }
        }
    }

    takeDamage() {
        if (this.isDefeated) return true;
        
        this.lives--;
        
        // Play damage sound
        const audio = new Audio('/assets/sounds/damage.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
        
        // Add visual feedback
        const playerElement = $(`.player-${this.id}`);
        if (playerElement) {
            playerElement.classList.add('damaged');
            setTimeout(() => {
                playerElement.classList.remove('damaged');
            }, 500);
        }

        if (this.lives <= 0) {
            this.die();
            return true; // Player died
        }
        
        // Player took damage but survived
        webSocket.send('playerDamaged', {
            playerId: this.id,
            lives: this.lives
        });
        
        return false; // Player still alive
    }

    die(position) {
        this.isDefeated = true;
        this.activeBombs = 0; // Clear active bombs on defeat
        this.keysPressed = {}; // Clear any pressed keys
        
        // Update position if provided (for defeat animation)
        if (position) {
            this.position = position;
        }

        // Play defeat sound
        const audio = new Audio('/assets/sounds/defeat.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});

        // Create defeat animation
        const cell = $(`.cell[data-x="${Math.round(this.position.x)}"][data-y="${Math.round(this.position.y)}"]`);
        if (cell) {
            const defeatEffect = document.createElement('div');
            defeatEffect.className = 'defeat-effect';
            cell.appendChild(defeatEffect);
            
            // Remove defeat effect after animation
            setTimeout(() => {
                defeatEffect.remove();
            }, 1000);
        }

        // Notify other players
        webSocket.send('playerDefeat', { 
            playerId: this.id,
            position: this.position,
            finalStats: {
                bombsPlaced: this.bombsPlaced,
                killCount: this.killCount,
                powerUpsCollected: this.powerUpsCollected
            }
        });
    }

    handleExplosion(explosionPosition) {
        const dx = Math.abs(this.position.x - explosionPosition.x);
        const dy = Math.abs(this.position.y - explosionPosition.y);
        
        // Check if player is in explosion range (1 tile)
        if (dx <= 1 && dy <= 1) {
            return this.takeDamage();
        }
        return false;
    }

    render(container) {
        // Remove previous player cell
        const previousCells = document.querySelectorAll(`.cell.player-${this.id}`);
        previousCells.forEach(cell => cell.classList.remove(`player-${this.id}`));

        // Don't render if defeated (unless in spectator mode)
        if (this.isDefeated) return;

        // Render player on the map
        const cell = $(`.cell[data-x="${Math.round(this.position.x)}"][data-y="${Math.round(this.position.y)}"]`);
        if (cell) {
            cell.classList.add(`player-${this.id}`);
            
            // Add player info
            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';
            
            // Add lives with hearts
            const lives = '❤️'.repeat(this.lives);
            
            playerInfo.innerHTML = `
                <div class="player-name ${this.isDefeated ? 'defeated' : ''}">${this.name}</div>
                <div class="player-lives">${lives}</div>
                <div class="player-stats">
                    <span class="bombs">💣 ${this.maxBombs}</span>
                    <span class="range">🔥 ${this.flameRange}</span>
                    <span class="speed">🏃‍♂️ ${this.speed.toFixed(1)}x</span>
                </div>
            `;
            
            cell.appendChild(playerInfo);
        }
    }
}

```


## src\components\PowerUp.js

```js
// src/components/PowerUp.js
import { $ } from '../utils/helpers.js';

export class PowerUp {
    static TYPES = {
        BOMB: 'bomb',
        FLAME: 'flame',
        SPEED: 'speed'
    };

    static getRandomType() {
        const types = Object.values(PowerUp.TYPES);
        return types[Math.floor(Math.random() * types.length)];
    }

    constructor(type, position, gameMap) {
        this.type = type;
        this.position = position;
        this.gameMap = gameMap;
        this.collected = false;
        this.element = null;
    }

    spawn() {
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            // Add spawn animation
            cell.classList.add('power-up-spawn');
            setTimeout(() => {
                cell.classList.remove('power-up-spawn');
                cell.classList.add('power-up', `power-up-${this.type}`);
            }, 500);

            // Update game map
            const mapCell = this.gameMap.grid[this.position.y][this.position.x];
            mapCell.type = 'powerup';
            mapCell.powerUpType = this.type;
            mapCell.powerUp = this;
        }
    }

    collect(player) {
        if (this.collected) return;
        
        this.collected = true;
        
        // Apply power-up effect
        switch (this.type) {
            case PowerUp.TYPES.BOMB:
                player.maxBombs++;
                break;
            case PowerUp.TYPES.FLAME:
                player.flameRange++;
                break;
            case PowerUp.TYPES.SPEED:
                player.speed += 0.2;
                break;
        }
        
        player.powerUpsCollected++;
        
        // Update game map
        const cell = this.gameMap.grid[this.position.y][this.position.x];
        if (cell) {
            cell.type = 'empty';
            cell.powerUpType = null;
            cell.powerUp = null;
        }

        // Show collection animation
        const cellElement = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cellElement) {
            cellElement.classList.remove('power-up', `power-up-${this.type}`);
            
            const animation = document.createElement('div');
            animation.className = 'power-up-collect';
            animation.textContent = this.getDisplayText();
            cellElement.appendChild(animation);
            
            // Remove animation after it completes
            setTimeout(() => {
                animation.remove();
            }, 1000);
        }
    }

    getDisplayText() {
        switch (this.type) {
            case PowerUp.TYPES.BOMB:
                return '+1 Bomb';
            case PowerUp.TYPES.FLAME:
                return '+1 Range';
            case PowerUp.TYPES.SPEED:
                return '+Speed';
            default:
                return '';
        }
    }

    destroy() {
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.remove('power-up', `power-up-${this.type}`);
        }
    }
}

```


## src\core\component.js

```js
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

```


## src\core\dom.js

```js
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

```


## src\core\events.js

```js
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

```


## src\core\router.js

```js
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

```


## src\core\state.js

```js
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

```


## src\core\websocket.js

```js
// src/core/websocket.js

class WebSocketService {
    constructor() {
        this.socket = null;
        this.handlers = new Map();
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.serverUrl = this.getWebSocketUrl();
        this.pendingMessages = [];
    }

    getWebSocketUrl() {
        const host = window.location.hostname;
        const port = '8080';
        return `ws://${host}:${port}`;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Connecting to:', this.serverUrl);
                this.socket = new WebSocket(this.serverUrl);
                
                this.socket.addEventListener('open', () => {
                    console.log('Connected to game server');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    // Send any pending messages
                    while (this.pendingMessages.length > 0) {
                        const msg = this.pendingMessages.shift();
                        this.send(msg.type, msg.data);
                    }
                    
                    resolve();
                });

                this.socket.addEventListener('message', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                });

                this.socket.addEventListener('close', () => {
                    this.connected = false;
                    console.log('Disconnected from server');
                    this.handleDisconnect();
                });

                this.socket.addEventListener('error', (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }

    handleMessage(data) {
        console.log('WebSocket received message:', data);
        if (!data.type) {
            console.error('Invalid message format:', data);
            return;
        }

        const handlers = this.handlers.get(data.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data.payload || {});
                } catch (error) {
                    console.error(`Error in handler for ${data.type}:`, error);
                }
            });
        } else {
            console.log('No handlers for message type:', data.type);
        }
    }

    send(type, data) {
        if (!this.connected) {
            console.log('Not connected, queueing message:', type, data);
            this.pendingMessages.push({ type, data });
            return;
        }

        const message = {
            type,
            payload: data
        };
        
        try {
            console.log('Sending WebSocket message:', message);
            this.socket.send(JSON.stringify(message));
        } catch (error) {
            console.error('Error sending message:', error, message);
            throw error;
        }
    }

    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type).add(handler);
    }

    off(type, handler) {
        if (handler && this.handlers.has(type)) {
            this.handlers.get(type).delete(handler);
        } else if (!handler) {
            this.handlers.delete(type);
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.close();
        }
        this.handlers.clear();
        this.connected = false;
        this.pendingMessages = [];
    }
}

// Create a singleton instance
const webSocket = new WebSocketService();
export default webSocket;

```


## src\levels\L1.TXT

```
***************
*1 --------- 3*
* *-*-*-*-*-* *
*-------------*
*-*-*-*-*-*-*-*
*-----   -----*
*-*-*-* *-*-*-*
*-----   -----*
*-*-*-*-*-*-*-*
*-------------*
* *-*-*-*-*-* *
*4 --------- 2*
***************

```


## src\levels\L2.TXT

```
***************
*-------------*
*-*-*-*-*-*-*-*
*-------------*
*-*-*-*-*-*-*-*
*----1   3----*
*-*-* * * *-*-*
*----4   2----*
*-*-*-*-*-*-*-*
*-------------*
*-*-*-*-*-*-*-*
*-------------*
***************

```


## src\levels\L3.TXT

```
***************
*1 --------- 3*
* ***-*-*-*** *
*-*---------*-*
*-*-*******-*-*
*-----*  -----*
*-*-*-* *-*-*-*
*-----  *-----*
*-*-*******-*-*
*-*---------*-*
* ***-*-*-*** *
*4 --------- 2*
***************

```


## src\levels\L4.TXT

```
***************
*1 --------- 3*
* *-*-*-*-*-* *
*-------------*
*-*-*******-*-*
*---*******---*
*-*-*******-*-*
*---*******---*
*-*-*******-*-*
*-------------*
* *-*-*-*-*-* *
*4 --------- 2*
***************

```


## src\levels\L5.TXT

```
***************
*1 --------- 3*
* *********-* *
*-----------*-*
*-*-*-*-*-*-*-*
*-*---   ---*-*
*-*-*-* *-*-*-*
*-*---   ---*-*
*-*-*-*-*-*-*-*
*-*-----------*
* *-********* *
*4 --------- 2*
***************

```


## src\levels\L6.TXT

```
***************
*1 --------- 3*
* *****-***** *
*-------------*
*-***-***-***-*
*-----   -----*
*-***** *****-*
*-----   -----*
*-***-***-***-*
*-------------*
* *****-***** *
*4 --------- 2*
***************

```


## src\utils\helpers.js

```js
// src/utils/helpers.js
export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return document.querySelectorAll(selector);
}

```

