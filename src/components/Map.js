// src/components/Map.js
import { $ } from '../utils/helpers.js';

export class GameMap {
    constructor() {
        this.grid = [];
        this.width = 15;
        this.height = 13;
        this.currentLevel = 1;
        this.activeBombs = new Map();
        this.explosions = new Map();
        this.blocks = new Set();
        this.powerUps = new Map();
    }

    async loadLevel(levelNumber) {
        try {
            const response = await fetch(`/levels/level${levelNumber}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load level ${levelNumber}`);
            }
            
            const levelData = await response.json();
            this.parseLevel(levelData);
            this.currentLevel = levelNumber;
        } catch (error) {
            console.error('Error loading level:', error);
            this.generateDefaultMap();
        }
    }

    parseLevel(levelData) {
        this.grid = [];
        this.blocks.clear();
        this.powerUps.clear();
        
        // Initialize empty grid
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = {
                    type: 'empty',
                    powerUp: null,
                    bomb: null,
                    explosion: null
                };
            }
        }
        
        // Place walls (border)
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1) {
                    this.grid[y][x].type = 'wall';
                }
            }
        }
        
        // Place blocks and power-ups from level data
        levelData.blocks.forEach(block => {
            const { x, y, type } = block;
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                this.grid[y][x].type = type;
                if (type === 'block') {
                    this.blocks.add(`${x},${y}`);
                }
            }
        });
        
        levelData.powerUps.forEach(powerUp => {
            const { x, y, type } = powerUp;
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                this.addPowerUp(x, y, type);
            }
        });
    }

    generateDefaultMap() {
        this.grid = [];
        this.blocks.clear();
        this.powerUps.clear();
        
        // Initialize empty grid with walls
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                const isWall = y === 0 || y === this.height - 1 || 
                             x === 0 || x === this.width - 1 || 
                             (x % 2 === 0 && y % 2 === 0);
                             
                this.grid[y][x] = {
                    type: isWall ? 'wall' : 'empty',
                    powerUp: null,
                    bomb: null,
                    explosion: null
                };
            }
        }
        
        // Add random blocks (avoiding player spawn points)
        const spawnPoints = [
            { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
            { x: this.width - 2, y: 1 }, { x: this.width - 3, y: 1 }, { x: this.width - 2, y: 2 },
            { x: 1, y: this.height - 2 }, { x: 2, y: this.height - 2 }, { x: 1, y: this.height - 3 },
            { x: this.width - 2, y: this.height - 2 }, { x: this.width - 3, y: this.height - 2 }, { x: this.width - 2, y: this.height - 3 }
        ];
        
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (this.grid[y][x].type === 'empty' && 
                    !spawnPoints.some(p => p.x === x && p.y === y) &&
                    Math.random() < 0.7) {
                    this.grid[y][x].type = 'block';
                    this.blocks.add(`${x},${y}`);
                }
            }
        }
    }

    clearBombs() {
        this.activeBombs.clear();
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].bomb) {
                    this.grid[y][x].bomb = null;
                }
            }
        }
    }

    clearPowerUps() {
        this.powerUps.clear();
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].powerUp) {
                    this.grid[y][x].powerUp = null;
                }
            }
        }
    }

    updateBlocks(blocks) {
        this.blocks = new Set(blocks);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const key = `${x},${y}`;
                if (this.grid[y][x].type === 'block' && !this.blocks.has(key)) {
                    this.grid[y][x].type = 'empty';
                } else if (this.grid[y][x].type === 'empty' && this.blocks.has(key)) {
                    this.grid[y][x].type = 'block';
                }
            }
        }
    }

    addPowerUp(x, y, type) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const key = `${x},${y}`;
            this.powerUps.set(key, { type, position: { x, y } });
            this.grid[y][x].powerUp = { type };
        }
    }

    placeBomb(x, y, range, playerId) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const bombId = `${playerId}-${Date.now()}`;
            this.activeBombs.set(bombId, {
                position: { x, y },
                range,
                playerId
            });
            this.grid[y][x].bomb = {
                id: bombId,
                range,
                playerId
            };
        }
    }

    hasBomb(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height && 
               this.grid[y][x].bomb !== null;
    }

    explodeBomb(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const bomb = this.grid[y][x].bomb;
            if (bomb) {
                this.activeBombs.delete(bomb.id);
                this.grid[y][x].bomb = null;
            }
        }
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
