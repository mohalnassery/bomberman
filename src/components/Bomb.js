// src/components/Bomb.js
import { $ } from '../utils/helpers.js';
import { Map } from './Map.js';
import { PowerUp } from './PowerUp.js';

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
        let chainReactionBombs = [];

        explosionPositions.forEach(pos => {
            const cell = this.map.grid[pos.y][pos.x];
            if (cell.type === 'block') {
                cell.type = 'empty';
                // Spawn power-up with 30% chance when destroying blocks
                if (Math.random() < 0.3) {
                    const powerUp = new PowerUp(
                        PowerUp.getRandomType(),
                        { x: pos.x, y: pos.y },
                        this.map
                    );
                    powerUp.render();
                }
            }
            
            // Check for chain reactions with other bombs
            if (cell.hasBomb && cell !== this.map.grid[this.position.y][this.position.x]) {
                chainReactionBombs.push(cell.bomb);
            }

            // Handle player damage
            const playersInCell = this.map.getPlayersInCell(pos.x, pos.y);
            playersInCell.forEach(player => {
                if (player.handleExplosion({ x: pos.x, y: pos.y })) {
                    // Player died from the explosion
                    this.map.handlePlayerDeath(player);
                }
            });
        });

        // Clear the bomb from the original cell
        const originalCell = this.map.grid[this.position.y][this.position.x];
        originalCell.hasBomb = false;
        originalCell.bomb = null;

        this.renderExplosion(explosionPositions);

        // Trigger chain reactions immediately
        chainReactionBombs.forEach(bomb => {
            if (bomb) {
                clearTimeout(bomb.timer);
                bomb.explode();
            }
        });

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
