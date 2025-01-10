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
        this.type = String(type).toLowerCase();
        this.position = position;
        this.gameMap = gameMap;
        this.collected = false;
        console.log('PowerUp created:', { type: this.type, position });
    }

    spawn() {
        console.log('Spawning power-up:', { type: this.type, position: this.position });
        const cell = document.querySelector(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        
        if (cell) {
            // Remove block class if it exists
            cell.classList.remove('block');
            
            // Add power-up classes
            cell.classList.add('power-up');
            cell.classList.add(`power-up-${this.type}`);
            
            // Update game map
            const mapCell = this.gameMap.grid[this.position.y][this.position.x];
            mapCell.type = 'powerup';
            mapCell.powerUp = this;
            
            console.log('Cell classes after spawn:', cell.classList.toString());
        } else {
            console.error('Cell not found for power-up spawn at:', this.position);
        }
    }

    collect(player) {
        if (this.collected) return;
        
        this.collected = true;
        console.log("pppppppppppppppppppppppppppp",this.type)
        console.log("ppppppppppppppppp", player)
        player.handlePowerUp(this.type)

        console.log("nnnnnnnnnnnnnnnnnnn", player)
        
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
