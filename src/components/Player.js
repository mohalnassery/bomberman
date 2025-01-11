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
        this.speed = 3.6;
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.flameRange = 1;
        this.isDead = false;
        this.bombsPlaced = 0;
        this.killCount = 0;
        this.powerUpsCollected = 0;
        this.lastUpdateTime = Date.now();
        this.lastServerUpdate = Date.now();
        this.updateThrottleMs = 50; // Send updates every 50ms
        this.interpolationFactor = 0.2; // Adjust for smoother movement

        this.createPlayerElement();

        // Initialize movement properties
        this.keysPressed = {};
        this.isMoving = false;

        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        // Set up controls for local player
        if (this.isLocal) {
            console.log('Setting up controls for local player:', this.id);
            this.initControls();
        }

        // Add power-up counters
        this.bombCount = 0;
        this.flameCount = 0;
        this.speedCount = 0;
    }

    createPlayerElement() {
        this.element = null;
        // Create player element
        const cell = document.createElement('div');
        cell.className = `cell player-${this.id}`;
        cell.dataset.x = this.position.x;
        cell.dataset.y = this.position.y;

        // Create character element with player number class
        const character = document.createElement('div');
        character.className = `player-character player-${this.playerNumber}`;
        console.log(`Creating player ${this.name} with number ${this.playerNumber}`);

        // Create name tag
        const nameTag = document.createElement('div');
        nameTag.className = 'player-tag';
        nameTag.textContent = this.name;

        // Assemble elements
        cell.appendChild(character);
        cell.appendChild(nameTag);
        this.element = cell;

        console.log('Created player element:', {
            id: this.id,
            playerNumber: this.playerNumber,
            element: this.element.outerHTML
        });
    }

    initControls() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        console.log('Keyboard controls initialized');
    }

    update(deltaTime) {
        if (this.isDead || !this.isLocal) return;

        const oldPosition = { ...this.position };
        this.isMoving = false;

        // Calculate movement based on pressed keys
        const moveSpeed = this.speed * deltaTime;

        if (this.keysPressed['ArrowUp'] || this.keysPressed['w']) {
            this.position.y -= moveSpeed;
            this.isMoving = true;
        }
        if (this.keysPressed['ArrowDown'] || this.keysPressed['s']) {
            this.position.y += moveSpeed;
            this.isMoving = true;
        }
        if (this.keysPressed['ArrowLeft'] || this.keysPressed['a']) {
            this.position.x -= moveSpeed;
            this.isMoving = true;
        }
        if (this.keysPressed['ArrowRight'] || this.keysPressed['d']) {
            this.position.x += moveSpeed;
            this.isMoving = true;
        }

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
        console.log("activeBombs", this.activeBombs)
        if (this.activeBombs >= this.maxBombs || this.isDead) return;

        const bombX = Math.round(this.position.x);
        const bombY = Math.round(this.position.y);

        console.log("sendBomb")
        webSocket.send('placeBomb', {
            position: { x: bombX, y: bombY },
            range: this.flameRange,
            timestamp: Date.now()
        });
    }

    handlePowerUp(type) {
        const LIMITS = {
            bomb: 4,    // Maximum bombs
            flame: 3,   // Maximum flame length 
            speed: 4  // Maximum speed 
        };

        switch (type) {
            case 'bomb':
                if (this.maxBombs < LIMITS.bomb) {
                    this.maxBombs++;
                    this.bombCount++;
                    console.log(`Bombs increased to: ${this.maxBombs}, Total collected: ${this.bombCount}`);
                }
                break;
                
            case 'flame':
                if (this.flameRange < LIMITS.flame) {
                    this.flameRange++;
                    this.flameCount++;
                    console.log(`Flame range increased to: ${this.flameRange}, Total collected: ${this.flameCount}`);
                }
                break;
                
            case 'speed':
                if (this.speed < LIMITS.speed) {
                    this.speed = Math.min(this.speed + 0.1, LIMITS.speed);
                    this.speedCount++;
                    console.log(`Speed increased to: ${this.speed}, Total collected: ${this.speedCount}`);
                }
                break;
        }
        this.powerUpsCollected++;
    }

    takeDamage() {
        if (this.isDead) return true;

        this.lives--;

        // Play damage sound
        const audio = new Audio('/assets/sounds/damage.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => { });

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
        this.isDead = true;
        this.activeBombs = 0; // Clear active bombs on death
        this.keysPressed = {}; // Clear any pressed keys

        // Update position if provided (for death animation)
        if (position) {
            this.position = position;
        }

            // Reset all power-ups and counters
    this.maxBombs = 1;        // Reset to initial bomb count
    this.flameRange = 1;      // Reset to initial flame range
    this.speed = 3.6;         // Reset to initial speed
    
    // Reset power-up counters
    this.bombCount = 0;
    this.flameCount = 0;
    this.speedCount = 0;
    

        // Play death sound
        const audio = new Audio('/assets/sounds/death.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => { });

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

        // Notify other players
        webSocket.send('playerDeath', {
            playerId: this.id,
            position: this.position,
            finalStats: {
                bombsPlaced: this.bombsPlaced,
                killCount: this.killCount,
                powerUpsCollected: this.powerUpsCollected
            }
        });
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
        this.position = position;
        this.element.style.transform =
            `translate(${position.x * 40}px, ${position.y * 40}px)`;
        //console.log(`Updated position for player ${this.id} to:`, position);
    }

    incrementScore(points = 1) {
        this.score += points;
        Player.updateHUD();
    }

    render() {
        // Remove all previous player cells for this player
        const playerId = typeof this.id === 'object' ? JSON.stringify(this.id) : this.id;
        const previousCell = document.querySelector(`.player-${playerId}`);
        const cellPosition = {
            x: Math.round(this.position.x),
            y: Math.round(this.position.y)
        }

        // remove last position only if outdated
        if (previousCell) {
            if (this.isDead || previousCell.dataset.x !== cellPosition.x || previousCell.dataset.y !== cellPosition.y) {
                previousCell.classList.remove(`player-${playerId}`);
                const playerChar = previousCell.querySelector('.player-character');
                if (playerChar) {
                    playerChar.remove();
                }
                const playerTag = previousCell.querySelector('.player-tag');
                if (playerTag) {
                    playerTag.remove();
                }
            }
        }

        // Don't render if dead (unless in spectator mode)
        if (this.isDead) return;

        // Get the exact cell based on rounded position. 
        // Only update position if outdated
        if (!previousCell || previousCell.dataset.x !== cellPosition.x || previousCell.dataset.y !== cellPosition.y) {
            const cell = $(`.cell[data-x="${cellPosition.x}"][data-y="${cellPosition.y}"]`);
            if (cell) {
                cell.classList.add(`player-${playerId}`);

                // Use the stored player number
                if (!cell.querySelector('.player-character')) {
                    const playerChar = document.createElement('div');
                    playerChar.className = `player-character player-${this.playerNumber}`;
                    cell.appendChild(playerChar);
                }

                // Add player tag if it doesn't exist
                if (!cell.querySelector('.player-tag')) {
                    const playerTag = document.createElement('div');
                    playerTag.className = 'player-tag';
                    playerTag.textContent = this.name;
                    cell.appendChild(playerTag);
                }
            }
        }
    }
}
