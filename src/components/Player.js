// src/components/Player.js
import { $ } from '../utils/helpers.js';
import { on } from '../core/events.js';
import webSocket from '../core/websocket.js';
import { PowerUp } from './PowerUp.js';

export class Player {
    constructor(props) {
        // Handle both object and individual parameters for backward compatibility
        if (typeof props === 'object') {
            this.id = props.id;
            this.name = props.nickname;
            this.isLocal = props.isLocal || false;
            this.playerNumber = props.playerNumber || 1; // Default to player 1

            // Get initial position from the level file based on player number
            let initialPosition = props.initialPosition || props.position || { x: 0, y: 0 };

            // Use provided position or fall back to initial position from level
            this.position = props.position || initialPosition;
            console.log(`Player ${this.id} (${this.name}) initialized at position:`, this.position);
        }

        this.serverPosition = { ...this.position }; // Server's last known position
        this.targetPosition = { ...this.position };  // Position to interpolate towards
        this.lives = 3;
        this.speed = 4;
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
        this.speed = 4;
        this.isMoving = false;
        
        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        // Set up controls for local player
        if (this.isLocal) {
            console.log('Setting up controls for local player:', this.id);
            this.initControls();
        }
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

        // Create name tag with player number
        const nameTag = document.createElement('div');
        nameTag.className = 'player-name';
        nameTag.textContent = `${this.name} (P${this.playerNumber})`;

        // Assemble elements
        cell.appendChild(character);
        cell.appendChild(nameTag);
        this.element = cell;
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

    checkCollision() {
        // Convert position to grid coordinates
        const gridX = Math.floor(this.position.x);
        const gridY = Math.floor(this.position.y);

        // Check map boundaries
        if (gridX < 0 || gridX >= this.gameMap.width || gridY < 0 || gridY >= this.gameMap.height) {
            return true;
        }

        // Get cells that the player's hitbox would occupy
        const cellsToCheck = [
            this.gameMap.grid[gridY][gridX], // Target cell
            // Check adjacent cells if player is between grid lines
            this.gameMap.grid[Math.ceil(this.position.y)][gridX],
            this.gameMap.grid[gridY][Math.ceil(this.position.x)],
            this.gameMap.grid[Math.ceil(this.position.y)][Math.ceil(this.position.x)]
        ].filter(Boolean); // Remove undefined cells

        // Check for collisions with walls, blocks, or other players
        return cellsToCheck.some(cell => 
            cell.type === 'wall' || 
            cell.type === 'block' || 
            (cell.hasPlayer && !cell.hasPlayer[this.id]) ||
            cell.hasBomb
        );
    }

    // Method to handle server position updates
    updateServerPosition(serverPos, timestamp) {
        // Update target position for interpolation
        this.targetPosition = { ...serverPos };
        this.serverPosition = { ...serverPos };

        // If difference is too large, snap to server position
        const dx = serverPos.x - this.position.x;
        const dy = serverPos.y - this.position.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            this.position = { ...serverPos };
        } else {
            // Otherwise smoothly interpolate
            this.targetPosition = { ...serverPos };
        }
    }

    placeBomb() {
        if (this.activeBombs >= this.maxBombs || this.isDead) return;

        const bombX = Math.floor(this.position.x);
        const bombY = Math.floor(this.position.y);

        this.activeBombs++;
        webSocket.send('placeBomb', {
            position: { x: bombX, y: bombY },
            range: this.flameRange,
            timestamp: Date.now()
        });
    }

    checkPowerUps() {
        const currentCell = this.gameMap.grid[Math.floor(this.position.y)][Math.floor(this.position.x)];
        if (currentCell && currentCell.type === 'powerup') {
            const powerUp = currentCell.powerUp;
            webSocket.send('collectPowerUp', {
                playerId: this.id,
                position: {
                    x: Math.floor(this.position.x),
                    y: Math.floor(this.position.y)
                },
                type: powerUp.type,
                timestamp: Date.now()
            });
        }
    }

    handlePowerUp(type) {
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

    takeDamage() {
        if (this.isDead) return true;
        
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
        this.isDead = true;
        this.activeBombs = 0; // Clear active bombs on death
        this.keysPressed = {}; // Clear any pressed keys
        
        // Update position if provided (for death animation)
        if (position) {
            this.position = position;
        }

        // Play death sound
        const audio = new Audio('/assets/sounds/death.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});

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

    handleExplosion(explosionPosition) {
        const dx = Math.abs(this.position.x - explosionPosition.x);
        const dy = Math.abs(this.position.y - explosionPosition.y);
        
        // Check if player is in explosion range (1 tile)
        if (dx <= 1 && dy <= 1) {
            return this.takeDamage();
        }
        return false;
    }

    static connectedPlayers = new Set();

    static addPlayer(player) {
        Player.connectedPlayers.add(player);
        Player.updateHUD();
    }

    static removePlayer(playerId) {
        for (const player of Player.connectedPlayers) {
            if (player.id === playerId) {
                Player.connectedPlayers.delete(player);
                break;
            }
        }
        Player.updateHUD();
    }

    static updateHUD() {
        const hudContainer = document.getElementById('player-hud');
        if (!hudContainer) return;

        hudContainer.innerHTML = '';
        
        // Sort players by ID to ensure consistent order
        const players = Array.from(Player.connectedPlayers)
            .sort((a, b) => a.id.localeCompare(b.id));

        players.forEach(player => {
            const playerHUD = document.createElement('div');
            playerHUD.className = 'player-stats';
            playerHUD.style.borderColor = player.color;
            
            playerHUD.innerHTML = `
                <div class="player-name" style="color: ${player.color}">${player.name}</div>
                <div class="player-info">
                    <div>Score: ${player.score}</div>
                    <div>Bombs: ${player.maxBombs}</div>
                    <div>Range: ${player.bombRange}</div>
                    <div>Speed: ${player.speed}</div>
                </div>
            `;
            
            hudContainer.appendChild(playerHUD);
        });
    }

    updatePosition(position) {
        this.position = position;
        this.element.style.transform = 
            `translate(${position.x * 32}px, ${position.y * 32}px)`;
        console.log(`Updated position for player ${this.id} to:`, position);
    }

    incrementScore(points = 1) {
        this.score += points;
        Player.updateHUD();
    }

    render(container) {
        // Remove all previous player cells for this player
        const playerId = typeof this.id === 'object' ? JSON.stringify(this.id) : this.id;
        const previousCells = document.querySelectorAll(`.player-${playerId}`);
        previousCells.forEach(cell => {
            cell.classList.remove(`player-${playerId}`);
            const playerChar = cell.querySelector('.player-character');
            if (playerChar) {
                playerChar.remove();
            }
        });

        // Don't render if dead (unless in spectator mode)
        if (this.isDead) return;

        // Get the exact cell based on rounded position
        const cell = $(`.cell[data-x="${Math.round(this.position.x)}"][data-y="${Math.round(this.position.y)}"]`);
        if (cell) {
            cell.classList.add(`player-${playerId}`);
            
            // Add player character if it doesn't exist
            if (!cell.querySelector('.player-character')) {
                const playerChar = document.createElement('div');
                playerChar.className = 'player-character';
                cell.appendChild(playerChar);
            }
        }
    }
}
