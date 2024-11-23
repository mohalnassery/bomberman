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
        this.players = new Map();
    }

    async loadLevel(levelNumber) {
        try {
            // Remove 'L' prefix if present and ensure it's a string
            const levelNum = String(levelNumber).replace(/^L/i, '');
            const levelPath = `src/levels/L${levelNum}.TXT`;
            console.log('Loading level from:', levelPath);
            
            const response = await fetch(levelPath);
            
            if (!response.ok) {
                throw new Error(`Failed to load level ${levelNumber}: ${response.statusText}`);
            }
            
            const levelText = await response.text();
            const levelData = this.parseLevelText(levelText);
            
            // Clear existing state
            this.grid = [];
            this.blocks.clear();
            this.powerUps.clear();
            this.activeBombs.clear();
            this.explosions.clear();
            
            // Parse and apply the level data
            this.parseLevel(levelData);
            this.currentLevel = parseInt(levelNum);
            console.log('Successfully loaded level:', this.currentLevel);
            
        } catch (error) {
            console.error('Error loading level:', error);
            this.generateDefaultMap();
        }
    }

    parseLevelText(levelText) {
        const lines = levelText.split('\n').map(line => line.trim()).filter(line => line);
        const blocks = [];
        const powerUps = [];
        const players = [];
        
        lines.forEach((line, y) => {
            [...line].forEach((char, x) => {
                switch (char) {
                    case '*':
                        blocks.push({ x, y, type: 'wall' });
                        break;
                    case '-':
                        blocks.push({ x, y, type: 'block' });
                        break;
                    case '1':
                        players.push({ id: 1, position: { x, y } });
                        break;
                    case '2':
                        players.push({ id: 2, position: { x, y } });
                        break;
                    case '3':
                        players.push({ id: 3, position: { x, y } });
                        break;
                    case '4':
                        players.push({ id: 4, position: { x, y } });
                        break;
                }
            });
        });

        return {
            blocks,
            powerUps,
            players
        };
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
        const defaultMap = {
            blocks: [],
            powerUps: []
        };
        
        // Generate border walls
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1) {
                    defaultMap.blocks.push({ x, y, type: 'wall' });
                }
            }
        }
        
        this.parseLevel(defaultMap);
    }

    clearBombs() {
        this.activeBombs.clear();
        if (!this.grid || !Array.isArray(this.grid)) {
            console.warn('Grid not initialized in clearBombs');
            return;
        }
        for (let y = 0; y < this.height; y++) {
            if (!this.grid[y]) {
                console.warn(`Grid row ${y} not initialized in clearBombs`);
                continue;
            }
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] && this.grid[y][x].bomb) {
                    this.grid[y][x].bomb = null;
                }
            }
        }
    }

    clearPowerUps() {
        this.powerUps.clear();
        if (!this.grid || !Array.isArray(this.grid)) {
            console.warn('Grid not initialized in clearPowerUps');
            return;
        }
        for (let y = 0; y < this.height; y++) {
            if (!this.grid[y]) {
                console.warn(`Grid row ${y} not initialized in clearPowerUps`);
                continue;
            }
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] && this.grid[y][x].powerUp) {
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
        if (!this.grid || !Array.isArray(this.grid)) return false;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (!this.grid[y] || !this.grid[y][x]) return false;
        return this.grid[y][x].bomb !== null && this.grid[y][x].bomb !== undefined;
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
