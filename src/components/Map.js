// src/components/Map.js
import { $ } from '../utils/helpers.js';

export class Map {
    constructor() {
        this.grid = [];
        this.width = 15;
        this.height = 13;
        this.players = new Map(); // Store player references
    }

    generateMap() {
        // Generate map with walls and destructible blocks
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                let cellType = 'empty';

                // Place indestructible walls
                if (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1) {
                    cellType = 'wall';
                } else if (y % 2 === 0 && x % 2 === 0) {
                    cellType = 'wall';
                } else if (Math.random() < 0.7) {
                    cellType = 'block';
                }

                this.grid[y][x] = {
                    type: cellType,
                    hasPlayer: false,
                    hasBomb: false,
                    hasPowerUp: false,
                };
            }
        }

        // Clear starting positions
        const startingPositions = [
            { x: 1, y: 1 },
            { x: this.width - 2, y: 1 },
            { x: 1, y: this.height - 2 },
            { x: this.width - 2, y: this.height - 2 },
        ];

        startingPositions.forEach(pos => {
            this.grid[pos.y][pos.x].type = 'empty';
            this.grid[pos.y][pos.x + 1].type = 'empty';
            this.grid[pos.y + 1][pos.x].type = 'empty';
        });
    }

    render() {
        const root = $('#root');
        let mapHtml = '<div class="game-map">';
        for (let y = 0; y < this.height; y++) {
            mapHtml += '<div class="row">';
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                let cellClass = 'cell';
                if (cell.type === 'wall') cellClass += ' wall';
                if (cell.type === 'block') cellClass += ' block';
                mapHtml += `<div class="${cellClass}" data-x="${x}" data-y="${y}"></div>`;
            }
            mapHtml += '</div>';
        }
        mapHtml += '</div>';
        root.innerHTML = mapHtml;
    }

    getPlayersInCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return [];
        }

        return Array.from(this.players.values()).filter(player => {
            const playerX = Math.floor(player.position.x);
            const playerY = Math.floor(player.position.y);
            return playerX === x && playerY === y;
        });
    }

    handlePlayerDeath(player) {
        // Remove player from their current cell
        const playerX = Math.floor(player.position.x);
        const playerY = Math.floor(player.position.y);
        if (this.grid[playerY][playerX]) {
            this.grid[playerY][playerX].hasPlayer = false;
        }

        // Update player state
        player.isDead = true;
        
        // Check if game is over (only one player left)
        const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDead);
        if (alivePlayers.length === 1) {
            // Game over - we have a winner!
            webSocket.send('gameOver', {
                winner: alivePlayers[0].id,
                winnerName: alivePlayers[0].name
            });
        }
    }

    addPlayer(player) {
        this.players.set(player.id, player);
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
    }
}
