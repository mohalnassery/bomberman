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
        this.serverPosition = { ...position }; // Server's last known position
        this.targetPosition = { ...position };  // Position to interpolate towards
        this.gameMap = gameMap;
        this.lives = 3;
        this.speed = 1;
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.flameRange = 1;
        this.keysPressed = {};
        this.isMoving = false;
        this.isDead = false;
        this.bombsPlaced = 0;
        this.killCount = 0;
        this.powerUpsCollected = 0;
        this.lastUpdateTime = Date.now();
        this.lastServerUpdate = Date.now();
        this.updateThrottleMs = 50; // Send updates every 50ms
        this.interpolationFactor = 0.2; // Adjust for smoother movement
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
        if (event.key === ' ' && !this.isDead) {
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

    update(deltaTime) {
        if (this.isDead) return;

        const oldPosition = { ...this.position };
        let moved = false;
        const newPosition = { ...this.position };

        // Calculate new position based on input
        if (this.keysPressed['ArrowUp'] || this.keysPressed['w']) {
            newPosition.y -= this.speed * deltaTime;
            moved = true;
        }
        if (this.keysPressed['ArrowDown'] || this.keysPressed['s']) {
            newPosition.y += this.speed * deltaTime;
            moved = true;
        }
        if (this.keysPressed['ArrowLeft'] || this.keysPressed['a']) {
            newPosition.x -= this.speed * deltaTime;
            moved = true;
        }
        if (this.keysPressed['ArrowRight'] || this.keysPressed['d']) {
            newPosition.x += this.speed * deltaTime;
            moved = true;
        }

        // Test collision with new position
        const originalPosition = { ...this.position };
        this.position = newPosition;
        
        if (this.checkCollision()) {
            this.position = originalPosition;
            moved = false;
        }

        // Interpolate towards server position when receiving updates
        if (!moved) {
            const dx = this.targetPosition.x - this.position.x;
            const dy = this.targetPosition.y - this.position.y;
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                this.position.x += dx * this.interpolationFactor;
                this.position.y += dy * this.interpolationFactor;
                moved = true;
            }
        }

        // Send position updates to server with throttling
        if (moved && Date.now() - this.lastServerUpdate >= this.updateThrottleMs) {
            this.lastServerUpdate = Date.now();
            webSocket.send('playerMove', {
                id: this.id,
                position: this.position,
                timestamp: Date.now()
            });
        }

        this.isMoving = moved;
    }

    // Method to handle server position updates
    updateServerPosition(serverPos, timestamp) {
        // Update target position for interpolation
        this.targetPosition = { ...serverPos };
        this.serverPosition = { ...serverPos };
        
        // If the difference is too large, snap to the server position
        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            this.position = { ...serverPos };
        }
    }

    placeBomb() {
        if (this.activeBombs >= this.maxBombs || this.isDead) return;

        const bombX = Math.floor(this.position.x);
        const bombY = Math.floor(this.position.y);

        // Check if there's already a bomb at this position
        if (this.gameMap.hasBomb(bombX, bombY)) return;

        this.activeBombs++;
        webSocket.send('placeBomb', {
            playerId: this.id,
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

    render(container) {
        // Remove previous player cell
        const previousCells = document.querySelectorAll(`.cell.player-${this.id}`);
        previousCells.forEach(cell => cell.classList.remove(`player-${this.id}`));

        // Don't render if dead (unless in spectator mode)
        if (this.isDead) return;

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
                <div class="player-name ${this.isDead ? 'dead' : ''}">${this.name}</div>
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
