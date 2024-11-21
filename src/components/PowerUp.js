// src/components/PowerUp.js
import { $ } from '../utils/helpers.js';

export class PowerUp {
    static TYPES = {
        BOMB: 'Bombs',
        FLAME: 'Flames',
        SPEED: 'Speed'
    };

    static getRandomType() {
        const types = Object.values(PowerUp.TYPES);
        return types[Math.floor(Math.random() * types.length)];
    }

    constructor(type, position, map) {
        this.type = type;
        this.position = position;
        this.map = map;
        this.collected = false;
    }

    collect(player) {
        if (this.collected) return;
        
        this.collected = true;
        player.applyPowerUp(this.type);
        
        // Remove power-up from the map grid
        const cell = this.map.grid[this.position.y][this.position.x];
        if (cell) {
            cell.hasPowerUp = false;
            cell.powerUpType = null;
            cell.powerUp = null;
        }

        // Remove power-up visuals
        const cellElement = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cellElement) {
            cellElement.classList.remove('power-up', this.type.toLowerCase());
            
            // Add collection animation
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
                return '+1 💣';
            case PowerUp.TYPES.FLAME:
                return '+1 🔥';
            case PowerUp.TYPES.SPEED:
                return '🏃‍♂️';
            default:
                return '';
        }
    }

    render() {
        if (this.collected) return;

        // Update map grid
        const cell = this.map.grid[this.position.y][this.position.x];
        if (cell) {
            cell.hasPowerUp = true;
            cell.powerUpType = this.type;
            cell.powerUp = this;
        }

        // Render power-up visuals
        const cellElement = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cellElement) {
            cellElement.classList.add('power-up', this.type.toLowerCase());
            
            // Add power-up icon
            const icon = document.createElement('div');
            icon.className = 'power-up-icon';
            icon.textContent = this.getDisplayText();
            cellElement.appendChild(icon);
        }
    }
}
