// src/components/Player.js
import { $ } from '../utils/helpers.js';
import { on } from '../core/events.js';
import webSocket from '../core/websocket.js';
import { PowerUp } from './PowerUp.js';

export class Player {
    // Static property to track all players
    static connectedPlayers = new Map();

    constructor(props) {
        // Handle both object and individual parameters for backward compatibility
        if (typeof props === 'object') {
            this.id = props.id;
            this.name = props.nickname;
            this.isLocal = props.isLocal || false;
            
            // Add this player to connected players
            Player.connectedPlayers.set(this.id, this);
            
            // Calculate player number based on connection order
            this.playerNumber = Player.connectedPlayers.size;
            console.log(`Player ${this.name} assigned number:`, this.playerNumber);

            // Get initial position from the level file based on player number
            let initialPosition = props.initialPosition || props.position || { x: 0, y: 0 };

            // Use provided position or fall back to initial position from level
            this.position = props.position || initialPosition;
            console.log(`Player ${this.id} (${this.name}) initialized at position:`, this.position);
        }

        this.serverPosition = { ...this.position }; // Server's last known position
        this.targetPosition = { ...this.position };  // Position to interpolate towards
        this.lives = 3;
        this.speed = 8;
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.flameRange = 1;
        this.initialPowers = {
            speed: 8,
            maxBombs: 1,
            flameRange: 1
        }
        this.isDead = false;
        this.bombsPlaced = 0;
        this.killCount = 0;
        this.powerUpsCollected = 0;
        this.lastUpdateTime = Date.now();
        this.lastServerUpdate = Date.now();
        this.updateThrottleMs = 50; // Send updates every 50ms
        this.interpolationFactor = 0.2; // Adjust for smoother movement
        this.isInvincible = false

        // Store spawn position separately
        this.spawnPosition = props.spawnPosition || props.position;
        this.position = { ...this.spawnPosition }; // Make a copy to avoid reference issues

        this.html = {
            cell: document.querySelector(`.player-${this.id}`),
            playerChar: document.querySelector(`.player-character.player-${this.playerNumber}`),
            playerTag: document.querySelector(`.player-tag.player-${this.playerNumber}`),
        }

        this.createPlayerChar();
        
        console.log(`Player ${this.id} (${this.name}) initialized at position:`, this.position, 
                    'with spawn position:', this.spawnPosition);

        this.render();

        // Initialize movement properties
        this.keysPressed = {};
        this.isMoving = false;

        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.render = this.render.bind(this)

        // Set up controls for local player
        if (this.isLocal) {
            console.log('Setting up controls for local player:', this.id);
            this.initControls();
        }
    }
    createPlayerChar() {
        if (this.html.playerChar) return
        const topCell = $(`.cell[data-x="0"][data-y="0"]`);
        if (!topCell) return

        // Create character element with player number class
        this.html.playerChar = document.createElement('div');
        this.html.playerChar.className = `player-character player-${this.playerNumber}`;
        this.html.playerChar.style.transform = 
            `translate(${(this.position.x) * 36}px, ${(this.position.y) * 36}px)`;

        // Create name tag
        this.html.playerTag = document.createElement('div');
        this.html.playerTag.className = `player-tag player-${this.playerNumber}`;
        this.html.playerTag.textContent = this.name;

        // Assemble elements
        this.html.playerChar.append(this.html.playerTag)
        topCell.append(this.html.playerChar)

    }


    initControls() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        console.log('Keyboard controls initialized');
    }

    getMovementDelta(deltaTime) {
        if (this.isDead || !this.isLocal) return;
        
        const delta = {
            x: 0,
            y: 0
        }

        // Calculate movement based on pressed keys
        const moveSpeed = Math.max(Math.min((this.speed * deltaTime)/2,1),-1);

        if (this.keysPressed['ArrowUp'] || this.keysPressed['w']) {
            delta.y -= moveSpeed;
        }
        if (this.keysPressed['ArrowDown'] || this.keysPressed['s']) {
            delta.y += moveSpeed;
        }
        if (this.keysPressed['ArrowLeft'] || this.keysPressed['a']) {
            delta.x -= moveSpeed;
        }
        if (this.keysPressed['ArrowRight'] || this.keysPressed['d']) {
            delta.x += moveSpeed;
            this.isMoving = true;
        }
        
        return delta
    }

    handleKeyDown(event) {
        if (!this.isLocal || this.isDead) return;

        this.keysPressed[event.key] = true;
        console.log('Key pressed:', event.key, 'Keys state:', this.keysPressed);

        // Handle bomb placement
        if (event.key === ' ') {
            this.placeBomb();
        }
    }

    handleKeyUp(event) {
        if (!this.isLocal || this.isDead) return;

        this.keysPressed[event.key] = false;
        console.log('Key released:', event.key, 'Keys state:', this.keysPressed);
    }

    disableControls() {
        if (this.isLocal) {
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('keyup', this.handleKeyUp);
            console.log('Removed keyboard controls');
        }
    }

    placeBomb() {
        if (this.activeBombs >= this.maxBombs || this.isDead) return;

        webSocket.send('placeBomb', {
            position: { x: Math.round(this.position.x), y: Math.round(this.position.y) },
            range: this.flameRange,
            timestamp: Date.now()
        });
    }

    takeDamage() {
        if (this.isDead) return true;

        this.lives--;
        
        // Remove player from grid immediately
        if (this.html.cell) {
            this.html.cell.classList.remove(`player-${this.id}`);
        }
        this.html.playerChar.style.opacity = 0.2
        setTimeout(() => {
            this.html.playerChar.style.opacity = 1
        }, 1000);


        const countElement = $(`.stats-value.lives`)
        if (this.isLocal && countElement) {
            countElement.innerHTML = Math.round(this.lives)
        }

        if (this.lives <= 0) {
            this.die();
        }
    }

    die(position) {
        this.isDead = true;
        this.activeBombs = 0; // Clear active bombs on death
        this.keysPressed = {}; // Clear any pressed keys

        // Update position if provided (for death animation)
        if (position) {
            this.position = position;
        }

        // Create death animation
        const cell = $(`.cell[data-x="${Math.round(this.position.x)}"][data-y="${Math.round(this.position.y)}"]`);
        if (cell) {
            const deathEffect = document.createElement('div');
            deathEffect.className = 'death-effect';
            cell.appendChild(deathEffect);

            // Remove death effect after animation
            setTimeout(() => {
                deathEffect.remove();
            }, 1000);
        }
    }

    destroy() {
        // Remove from connected players when destroyed
        Player.connectedPlayers.delete(this.id);
        this.disableControls();
    }

    static getPlayerCount() {
        return Player.connectedPlayers.size;
    }

    static clearPlayers() {
        Player.connectedPlayers.clear();
    }

    updatePosition(position) {
        if (!position) return;
        
        // Make a copy of the position to avoid reference issues
        this.position = {
            x: position.x,
            y: position.y
        };
    }

    incrementScore(points = 1) {
        this.score += points;
        Player.updateHUD();
    }

    render() {
        // Remove all previous player cells for this player
        const playerId = typeof this.id === 'object' ? JSON.stringify(this.id) : this.id;
        //const previousCell = document.querySelector(`.player-${playerId}`);
        const cellPosition = {
            x: Math.round(this.position.x),
            y: Math.round(this.position.y)
        }

        // remove last position only if outdated
        if (this.html.cell && (this.isDead || +this.html.cell.dataset.x !== cellPosition.x || +this.html.cell.dataset.y !== cellPosition.y)) {
            this.html.cell.classList.remove(`player-${playerId}`);
            this.html.cell = null
        }

        // Don't render if dead (unless in spectator mode)
        if (this.isDead) return;

        // Get the exact cell based on rounded position. 
        // Only update position if outdated
        if (!this.html.cell || +this.html.cell.dataset.x !== cellPosition.x || +this.html.cell.dataset.y !== cellPosition.y) {
            this.html.cell = $(`.cell[data-x="${cellPosition.x}"][data-y="${cellPosition.y}"]`);
            if (this.html.cell) {
                this.html.cell.classList.add(`player-${playerId}`);
            }
            return
        }

        // Update the cell position attributes
        if (!this.html.playerChar || !document.body.contains(this.html.playerChar)) {
            this.html.playerChar = this.html.cell.querySelector(`.player-character.player-${this.playerNumber}`);
            if (!this.html.playerChar) {
                this.createPlayerChar();
                return
            }
        }
        
        if (this.html.playerChar) {
            this.html.playerChar.style.transform = 
                `translate(${(this.position.x) * 36}px, ${(this.position.y) * 36}px)`;
        }
    }
}
