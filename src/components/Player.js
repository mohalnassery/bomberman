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
        this.isDead = false;
        this.bombsPlaced = 0;
        this.killCount = 0;
        this.powerUpsCollected = 0;
        this.initControls();
    }

    initControls() {
        on('keydown', 'body', (event) => {
            this.keysPressed[event.key] = true;
            if (event.key === ' ') {
                this.placeBomb();
            }
        });
        
        on('keyup', 'body', (event) => {
            this.keysPressed[event.key] = false;
        });
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

    move() {
        if (this.isMoving) return;

        const oldPosition = { ...this.position };
        let newX = this.position.x;
        let newY = this.position.y;
        const moveSpeed = this.speed;

        // Calculate new position based on input
        if (this.keysPressed['ArrowUp']) newY -= moveSpeed;
        if (this.keysPressed['ArrowDown']) newY += moveSpeed;
        if (this.keysPressed['ArrowLeft']) newX -= moveSpeed;
        if (this.keysPressed['ArrowRight']) newX += moveSpeed;

        // Check for collisions at the new position
        if (!this.checkCollision(newX, newY)) {
            // Update position if no collision
            this.setPosition({ x: newX, y: newY });

            // Send position update if changed
            if (oldPosition.x !== this.position.x || oldPosition.y !== this.position.y) {
                this.isMoving = true;
                webSocket.send('move', { position: this.position });
                
                // Reset moving flag after movement animation
                setTimeout(() => {
                    this.isMoving = false;
                }, 100);
            }
        }

        // Check for power-ups
        this.checkPowerUps();
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
        if (this.activeBombs < this.maxBombs && !this.isDead) {
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

    update() {
        this.move();
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
