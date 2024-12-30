// src/components/Map.js
import { $ } from '../utils/helpers.js';

export class GameMap {
    constructor() {
        this.grid = [];
        this.width = 15;
        this.height = 13;  // Match the level file dimensions
        this.currentLevel = null;
        this.activeBombs = new Map();
        this.explosions = new Map();
        this.players = new Map();
        this.playerStartPositions = new Map(); // Store player starting positions
        this.isLoaded = false
    }

    loadLevel(levelNumber, serverGrid) {
        if (this.isLoaded) return
        try {
            // Clear existing state
            this.activeBombs.clear();
            this.explosions.clear();

            // Initialize grid with proper dimensions
            this.grid = Array(this.height).fill().map(() => 
                Array(this.width).fill().map(() => ({
                    type: 'empty',
                    powerUp: null,
                    bomb: null
                }))
            );

            // Copy server grid data if provided
            if (serverGrid) {
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        if (serverGrid[y] && serverGrid[y][x]) {
                            this.grid[y][x] = { ...serverGrid[y][x] };
                        }
                    }
                }
                this.isLoaded = true
            }

            // Store player starting positions
            this.playerStartPositions = new Map();
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.grid[y][x].playerStart) {
                        this.playerStartPositions.set(
                            this.grid[y][x].playerStart,
                            {x, y}
                        );
                    }
                }
            }

            this.currentLevel = levelNumber;
            return true;
        } catch (error) {
            console.error('Error loading level:', error);
            throw error;
        }
    }

    // Get starting position for a player based on their index
    getPlayerStartPosition(playerIndex) {
        // Convert index to player number (1-based)
        const playerNumber = String(playerIndex + 1);
        
        // Get position from level file
        if (this.playerStartPositions.has(playerNumber)) {
            const pos = this.playerStartPositions.get(playerNumber);
            console.log(`Using level-defined position for player ${playerNumber}:`, pos);
            return pos;
        }
        
         // Fallback positions if not found in level
         const fallbackPositions = [
            {x: 1, y: 1},                        // Player 1: Top-left corner
            {x: this.width-2, y: this.height-2}, // Player 2: Bottom-right corner
            {x: this.width-2, y: 1},             // Player 3: Top-right corner
            {x: 1, y: this.height-2}             // Player 4: Bottom-left corner
        ];
        
        const fallbackPos = fallbackPositions[playerIndex % 2];
        console.log(`Using fallback position for player ${playerNumber}:`, fallbackPos);
        return fallbackPos;
    }

    clearBombs() {
        this.activeBombs.clear();
        for (let y = 0; y < this.height; y++) {
            if (!this.grid[y]) {
                this.grid[y] = [];
            }
            for (let x = 0; x < this.width; x++) {
                if (!this.grid[y][x]) {
                    this.grid[y][x] = {
                        type: 'empty',
                        powerUp: null,
                        bomb: null,
                        explosion: null
                    };
                } else if (this.grid[y][x].bomb) {
                    this.grid[y][x].bomb = null;
                }
            }
        }
    }

    placeBomb(id, x, y, range, playerId) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.activeBombs.set(bombId, {
                id,
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
        if (!this.grid || !Array.isArray(this.grid) || x < 0 || x >= this.width || y < 0 || y >= this.height ||!this.grid[y] || !this.grid[y][x] ) return false;
        return this.grid[y][x].bomb !== null && this.grid[y][x].bomb !== undefined;
    }

    explodeBomb(bombId) {
        const bomb = this.activeBombs.get(bombId)
        if (bomb) {
            this.activeBombs.delete(bomb.id);
            this.grid[bomb.position.y][this.bomb.position.x].bomb = null;
        }

        // Handle destroyed blocks and show animations
        destroyedBlocks.forEach(blockKey => {
            const [x, y] = blockKey.split(',').map(Number);
            const cell = $(`.cell[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.classList.add('block-destroy');
                setTimeout(() => {
                    cell.classList.remove('block', 'block-destroy');
                }, 500);
            }
        });

        // Show explosion animation
        affectedPositions.forEach(pos => {
            const cell = $(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (cell) {
                cell.classList.add('explosion');
                setTimeout(() => {
                    cell.classList.remove('explosion');
                }, 1000);
            }
        });
    }    

    removePowerUp(position) {
        const cellGrid = this.map.grid[position.y][position.x];
        if (cellGrid && cellGrid.type === 'powerup') {
            cellGrid.type = 'empty';
            cellGrid.powerUp = null;
        }

        // Remove power-up from map
        const cell = `.cell[data-x="${position.x}"][data-y="${position.y}"]`;
        if (cell) {
            cell.classList.remove('power-up', `power-up-${type}`);

            // Show collection animation
            const animation = document.createElement('div');
            animation.className = 'power-up-collect';
            animation.textContent = this.getPowerUpDisplayText(type);
            cell.appendChild(animation);

            setTimeout(() => {
                animation.remove();
            }, 1000);
        }
    }    

    addPlayer(player) {
        console.log('Adding player to map:', player.id);
        this.players.set(player.id, player);
        console.log('Current players in map:', Array.from(this.players.keys()));
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            // Remove player's visual elements
            const cells = document.querySelectorAll(`.player-${playerId}`);
            cells.forEach(cell => {
                cell.classList.remove(`player-${playerId}`);
                const playerChar = cell.querySelector('.player-character');
                const nameTag = cell.querySelector('.player-name');
                if (playerChar) playerChar.remove();
                if (nameTag) nameTag.remove();
            });
            this.players.delete(playerId);
        }
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

                //Removed from check player hits because the server already doest that
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

    checkCollision(x, y) {
        const CELL_SIZE = 40;
        const PLAYER_SIZE = 30;
        const COLLISION_TOLERANCE = 10;
        
        const cellX = Math.floor(x);
        const cellY = Math.floor(y);
        
        const playerCenterX = x * CELL_SIZE + PLAYER_SIZE/2;
        const playerCenterY = y * CELL_SIZE + PLAYER_SIZE/2;
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = cellX + dx;
                const checkY = cellY + dy;
                
                if (checkX < 0 || checkX >= this.width || checkY < 0 || checkY >= this.height) {
                    continue;
                }
                
                const cell = this.grid[checkY][checkX];
                
                if (cell && (
                    cell.type === 'wall' || 
                    cell.type === 'block' || 
                    cell.bomb
                )) {
                    const cellCenterX = checkX * CELL_SIZE + CELL_SIZE/2;
                    const cellCenterY = checkY * CELL_SIZE + CELL_SIZE/2;
                    
                    const dx = Math.abs(playerCenterX - cellCenterX);
                    const dy = Math.abs(playerCenterY - cellCenterY);
                    
                    const collisionThreshold = (CELL_SIZE + PLAYER_SIZE) / 2 - COLLISION_TOLERANCE;
                    if (dx < collisionThreshold && dy < collisionThreshold) {
                        console.log('Collision detected at:', checkX, checkY);
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    render() {
        // Create map container if it doesn't exist
        let mapContainer = document.querySelector('.map-container');
        if (!mapContainer) {
            mapContainer = document.createElement('div');
            mapContainer.className = 'map-container';
            const root = document.getElementById('root');
            if (!root) {
                console.error('Root element not found');
                return;
            }
            root.appendChild(mapContainer);
        }

        // Clear existing map content
        mapContainer.innerHTML = '';

        // Create and append map grid
        const mapGrid = document.createElement('div');
        mapGrid.className = 'map-grid';
        mapContainer.appendChild(mapGrid);

        // Ensure grid exists before rendering
        if (!this.grid || !this.grid.length) {
            console.error('No grid data available');
            return;
        }

        // Render each cell
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                // Add cell type classes
                const cellData = this.grid[y][x];
                if (cellData && cellData.type !== 'empty') {
                    cell.classList.add(cellData.type);
                }

                // Add power-ups, bombs, and explosions
                if (cellData) {
                    if (cellData.powerUp) {
                        cell.classList.add('power-up', `power-up-${cellData.powerUp}`);
                    }
                    if (cellData.bomb) {
                        cell.classList.add('bomb');
                    }
                    if (cellData.explosion) {
                        cell.classList.add('explosion');
                    }
                }

                mapGrid.appendChild(cell);
            }
        }
    }
}

