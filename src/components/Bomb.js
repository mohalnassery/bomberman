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
                if (!player.isDead) {
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
