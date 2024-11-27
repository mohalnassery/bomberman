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
        this.blocks = new Set();
        this.powerUps = new Map();
        this.players = new Map();
        this.activePlayers = new Set(); // Track active player IDs
        this.playerStartPositions = new Map(); // Store player starting positions
    }

    async loadLevel(levelNumber) {
        try {
            if (!levelNumber) {
                throw new Error('No level number provided');
            }

            // Handle level format (e.g., "L2" or "2")
            const levelNum = String(levelNumber).replace(/^L/i, '');
            const levelPath = `src/levels/L${levelNum}.TXT`;
            console.log('Loading level file:', levelPath);
            
            const response = await fetch(levelPath);
            if (!response.ok) {
                throw new Error(`Failed to load level ${levelNumber}`);
            }
            
            const levelText = await response.text();
            
            // Clear existing state
            this.grid = [];
            this.blocks.clear();
            this.powerUps.clear();
            this.activeBombs.clear();
            this.explosions.clear();
            
            // Store player starting positions
            this.playerStartPositions = new Map();
            
            // Process level text line by line
            const lines = levelText.split('\n')
                .map(line => line.trim())
                .filter(line => line);
            
            // Initialize grid from level file
            for (let y = 0; y < this.height; y++) {
                this.grid[y] = [];
                const line = lines[y] || '';
                
                for (let x = 0; x < this.width; x++) {
                    const char = line[x] || ' ';
                    this.grid[y][x] = {
                        type: 'empty',
                        powerUp: null,
                        bomb: null,
                        explosion: null,
                        playerStart: null
                    };
                    
                    switch (char) {
                        case '*':
                            this.grid[y][x].type = 'wall';
                            break;
                        case '-':
                            this.grid[y][x].type = 'block';
                            this.blocks.add(`${x},${y}`);
                            break;
                        case ' ':
                            // Keep as empty
                            break;
                        case '1':
                        case '2':
                        case '3':
                        case '4':
                            // Store the position for this player number
                            const playerNumber = parseInt(char);
                            this.grid[y][x].type = 'empty';
                            // Only store positions for players 1 and 2 if they exist
                            if (playerNumber <= 2) {
                                this.playerStartPositions.set(String(playerNumber), { x, y });
                                console.log(`Set player ${playerNumber} starting position at (${x}, ${y})`);
                            } else {
                                // For positions 3 and 4, just leave as empty spaces
                                console.log(`Ignoring unused player ${playerNumber} position at (${x}, ${y})`);
                            }
                            break;
                        default:
                            console.warn(`Unknown character in level: '${char}' at position:`, x, y);
                            break;
                    }
                }
            }

            this.currentLevel = parseInt(levelNum);
            console.log('Successfully loaded level:', this.currentLevel);
            console.log('Active player start positions:', Array.from(this.playerStartPositions.entries()));
            return true;
        } catch (error) {
            console.error('Error loading level:', error);
            throw error;
        }
    }

    // Add method to set active players
    setActivePlayers(playerIds) {
        this.activePlayers = new Set(playerIds);
        this.players.clear(); // Clear existing players when setting new active players
        console.log('Active players set:', Array.from(this.activePlayers));
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
            {x: 1, y: 1},             // Player 1
            {x: this.width-2, y: this.height-2}  // Player 2
        ];
        
        const fallbackPos = fallbackPositions[playerIndex % 2];
        console.log(`Using fallback position for player ${playerNumber}:`, fallbackPos);
        return fallbackPos;
    }

    getPlayerCount() {
        // Get the count of active players from the game state
        return this.players.size || 0;
    }

    parseLevelText(levelText) {
        const lines = levelText.split('\n').map(line => line.trim()).filter(line => line);
        const blocks = [];
        const powerUps = [];
        const playerPositions = new Map(); // Store player positions by ID
        
        // Process each character in the level text
        lines.forEach((line, y) => {
            [...line].forEach((char, x) => {
                switch (char) {
                    case '*':
                        blocks.push({ x, y, type: 'wall' });
                        break;
                    case '-':
                        blocks.push({ x, y, type: 'block' });
                        break;
                    case ' ':
                        // Empty space - don't add any blocks
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                        // Store player spawn position and ensure it's an empty space
                        playerPositions.set(char, { x, y });
                        break;
                    default:
                        // If it's not a recognized character, treat it as empty space
                        break;
                }
            });
        });

        return {
            blocks,
            powerUps,
            playerPositions
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
        
        // Place blocks from level data
        if (levelData.blocks && Array.isArray(levelData.blocks)) {
            levelData.blocks.forEach(block => {
                const { x, y, type } = block;
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    this.grid[y][x].type = type;
                    if (type === 'block') {
                        this.blocks.add(`${x},${y}`);
                    }
                }
            });
        }

        // Set player spawn positions
        if (levelData.playerPositions) {
            levelData.playerPositions.forEach((position, id) => {
                if (position.x >= 0 && position.x < this.width && 
                    position.y >= 0 && position.y < this.height) {
                    // Clear any blocks at spawn position and around it
                    this.grid[position.y][position.x].type = 'empty';
                    this.blocks.delete(`${position.x},${position.y}`);
                    
                    // Add player to map
                    this.players.set(id, {
                        id,
                        position: { ...position },
                        alive: true
                    });
                }
            });
        }
    }

    generateDefaultMap() {
        // Initialize empty grid first
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = {
                    type: 'empty',
                    powerUp: null,
                    bomb: null,
                    explosion: null
                };
                // Add border walls
                if (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1) {
                    this.grid[y][x].type = 'wall';
                }
            }
        }
    }

    clearBombs() {
        this.activeBombs.clear();
        
        // Initialize grid if needed
        if (!this.grid || !Array.isArray(this.grid) || this.grid.length === 0) {
            this.grid = [];
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
            return; // Return early since grid was just initialized with no bombs
        }

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

    clearPowerUps() {
        this.powerUps.clear();
        
        // Initialize grid if needed
        if (!this.grid || !Array.isArray(this.grid) || this.grid.length === 0) {
            this.grid = [];
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
            return; // Return early since grid was just initialized with no powerUps
        }

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
                } else if (this.grid[y][x].powerUp) {
                    this.grid[y][x].powerUp = null;
                }
            }
        }
    }

    updateBlocks(blocks) {
        // Ensure grid is initialized
        if (!this.grid || !Array.isArray(this.grid) || this.grid.length === 0) {
            this.grid = [];
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
        }

        // Update blocks set
        this.blocks = new Set(blocks);

        // Update grid cells
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const key = `${x},${y}`;
                // Keep walls as walls, update other cells based on blocks set
                if (this.grid[y][x].type !== 'wall') {
                    if (this.blocks.has(key)) {
                        this.grid[y][x].type = 'block';
                    } else {
                        this.grid[y][x].type = 'empty';
                    }
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
                        cell.classList.add('power-up', cellData.powerUp.type);
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

        // Let each player render themselves
        Array.from(this.players.values()).forEach(player => {
            if (!player.isDead) {
                player.render(mapGrid);
            }
        });
    }

    getPlayersInCell(x, y) {
        return Array.from(this.players.values()).filter(player => {
            const playerX = Math.floor(player.position.x);
            const playerY = Math.floor(player.position.y);
            return playerX === x && playerY === y;
        });
    }

    addPlayer(player) {
        this.players.set(player.id, player);
        player.render(document.querySelector('.map-grid'));
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
}
