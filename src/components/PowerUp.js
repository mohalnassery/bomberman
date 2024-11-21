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
