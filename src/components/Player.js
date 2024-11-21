// src/components/Player.js
import { $ } from '../utils/helpers.js';
import { on } from '../core/events.js';

export class Player {
    constructor(id, name, position) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.lives = 3;
        this.speed = 1;
        this.bombCount = 1;
        this.flameRange = 1;
        this.keysPressed = {};
        this.initControls();
    }

    initControls() {
        on('keydown', 'body', (event) => {
            this.keysPressed[event.key] = true;
        });
        on('keyup', 'body', (event) => {
            this.keysPressed[event.key] = false;
        });
    }

    move() {
        const moveSpeed = this.speed;
        if (this.keysPressed['ArrowUp']) this.position.y -= moveSpeed;
        if (this.keysPressed['ArrowDown']) this.position.y += moveSpeed;
        if (this.keysPressed['ArrowLeft']) this.position.x -= moveSpeed;
        if (this.keysPressed['ArrowRight']) this.position.x += moveSpeed;

        // Collision detection and boundaries
        this.position.x = Math.max(0, Math.min(this.position.x, 14));
        this.position.y = Math.max(0, Math.min(this.position.y, 12));
    }

    placeBomb() {
        // Implement bomb placement logic
    }

    applyPowerUp(powerUp) {
        switch (powerUp) {
            case 'Bombs':
                this.bombCount += 1;
                break;
            case 'Flames':
                this.flameRange += 1;
                break;
            case 'Speed':
                this.speed += 0.5;
                break;
        }
    }

    update() {
        this.move();
    }

    render() {
        // Remove previous player cell
        const previousCells = document.querySelectorAll(`.cell.player-${this.id}`);
        previousCells.forEach(cell => cell.classList.remove(`player-${this.id}`));

        // Render player on the map
        const cell = $(`.cell[data-x="${Math.round(this.position.x)}"][data-y="${Math.round(this.position.y)}"]`);
        if (cell) {
            cell.classList.add(`player-${this.id}`);
        }
    }
}
