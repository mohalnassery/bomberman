// src/components/Map.js
import { $ } from '../utils/helpers.js';

export class GameMap {
    constructor() {
        this.grid = [];
        this.width = 15;
        this.height = 13;
        this.players = new Map(); // Store player references
        this.currentLevel = 1;
        this.activeBombs = new Map(); // Track active bombs
        this.explosions = new Map(); // Track active explosions
        this.playerStartPositions = [];
    }

    async loadLevel(levelNumber) {
        try {
            // Validate level number
            if (!Number.isInteger(levelNumber) || levelNumber < 1) {
                throw new Error('Invalid level number');
            }
            
            // Use relative path and handle errors
            const response = await fetch(`../levels/L${levelNumber}.TXT`);
            if (!response.ok) {
                throw new Error(`Failed to load level ${levelNumber}`);
            }
            
            const mapData = await response.text();
            this.parseMapData(mapData);
            this.currentLevel = levelNumber;
        } catch (error) {
            console.error('Error loading level:', error);
            this.generateMap(); // Fallback to random map
        }
    }

    parseMapData(mapData) {
        const rows = mapData.trim().split('\n');
        
        // Validate map dimensions
        if (rows.length !== this.height) {
            throw new Error(`Invalid map height: ${rows.length}, expected ${this.height}`);
        }
        
        this.grid = [];
        this.playerStartPositions = [];
        
        for (let y = 0; y < rows.length; y++) {
            const cells = rows[y].trim().split('');
            
            // Validate row width
            if (cells.length !== this.width) {
                throw new Error(`Invalid map width at row ${y}: ${cells.length}, expected ${this.width}`);
            }
            
            this.grid[y] = [];
            
            for (let x = 0; x < cells.length; x++) {
                const char = cells[x];
                let cellType = 'empty';
                
                switch (char) {
                    case '*':
                        cellType = 'wall';
                        break;
                    case '-':
                        cellType = 'block';
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                        cellType = 'empty';
                        this.playerStartPositions.push({
                            id: parseInt(char),
                            position: { x, y }
                        });
                        break;
                    case 'P':
                        cellType = 'powerup';
                        break;
                    case ' ':
                        cellType = 'empty';
                        break;
                    default:
                        throw new Error(`Invalid map character at (${x}, ${y}): ${char}`);
                }
                
                this.grid[y][x] = {
                    type: cellType,
                    hasPlayer: false,
                    hasBomb: false,
                    powerUpType: cellType === 'powerup' ? this.getRandomPowerUpType() : null
                };
            }
        }
    }
    
    getRandomPowerUpType() {
        const types = ['bomb', 'flame', 'speed'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    addPowerUp(x, y, type) {
        if (this.grid[y][x] && this.grid[y][x].type === 'empty') {
            this.grid[y][x].type = 'powerup';
            this.grid[y][x].powerUpType = type;
        }
    }

    getPlayerStartPosition(playerNumber) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].playerStart === String(playerNumber)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    generateMap() {
        // Fallback random map generation
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                let cellType = 'empty';

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
                    hasExplosion: false
                };
            }
        }

        // Clear starting positions
        const startingPositions = [
            { x: 1, y: 1 },
            { x: this.width - 2, y: 1 },
            { x: 1, y: this.height - 2 },
            { x: this.width - 2, y: this.height - 2 }
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
                if (cell.type === 'powerup') cellClass += ' powerup';
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

    update(deltaTime) {
        // Update bombs
        this.activeBombs.forEach((bomb, id) => {
            bomb.update(deltaTime);
            if (bomb.shouldExplode) {
                this.handleBombExplosion(bomb);
                this.activeBombs.delete(id);
            }
        });

        // Update explosions
        this.explosions.forEach((explosion, id) => {
            explosion.update(deltaTime);
            if (explosion.isFinished) {
                this.explosions.delete(id);
                // Clear explosion cells
                explosion.cells.forEach(cell => {
                    if (this.grid[cell.y][cell.x]) {
                        this.grid[cell.y][cell.x].hasExplosion = false;
                    }
                });
            }
        });
    }

    handleBombExplosion(bomb) {
        const affectedCells = this.calculateExplosionCells(bomb);
        
        // Create explosion effect
        const explosion = {
            cells: affectedCells,
            duration: 0.5, // Duration in seconds
            timer: 0,
            update(deltaTime) {
                this.timer += deltaTime;
                this.isFinished = this.timer >= this.duration;
            },
            isFinished: false
        };

        this.explosions.set(Date.now(), explosion);

        // Mark cells as affected by explosion
        affectedCells.forEach(cell => {
            if (this.grid[cell.y][cell.x]) {
                const gridCell = this.grid[cell.y][cell.x];
                gridCell.hasExplosion = true;

                // Destroy blocks
                if (gridCell.type === 'block') {
                    gridCell.type = 'empty';
                }

                // Check for player hits
                const playersInCell = this.getPlayersInCell(cell.x, cell.y);
                playersInCell.forEach(player => {
                    if (!player.isDead) {
                        player.handleDeath();
                    }
                });
            }
        });
    }

    calculateExplosionCells(bomb) {
        const cells = [];
        const directions = [
            { dx: 0, dy: 0 },   // Center
            { dx: 1, dy: 0 },   // Right
            { dx: -1, dy: 0 },  // Left
            { dx: 0, dy: 1 },   // Down
            { dx: 0, dy: -1 }   // Up
        ];

        directions.forEach(dir => {
            for (let i = 0; i <= bomb.range; i++) {
                const x = bomb.position.x + (dir.dx * i);
                const y = bomb.position.y + (dir.dy * i);

                // Check bounds
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                    break;
                }

                const cell = this.grid[y][x];
                cells.push({ x, y });

                // Stop explosion at walls
                if (cell.type === 'wall') {
                    break;
                }
            }
        });

        return cells;
    }

    addBomb(bomb) {
        const { x, y } = bomb.position;
        if (this.grid[y][x]) {
            this.grid[y][x].hasBomb = true;
            this.activeBombs.set(bomb.id, bomb);
        }
    }

    removeBomb(bombId) {
        const bomb = this.activeBombs.get(bombId);
        if (bomb) {
            const { x, y } = bomb.position;
            if (this.grid[y][x]) {
                this.grid[y][x].hasBomb = false;
            }
            this.activeBombs.delete(bombId);
        }
    }
}
