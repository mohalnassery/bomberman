// src/components/PowerUp.js
import { $ } from '../utils/helpers.js';

export class PowerUp {
    constructor(type, position) {
        this.type = type;
        this.position = position;
    }

    collect(player) {
        player.applyPowerUp(this.type);
        // Remove power-up from the map
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.remove('power-up', this.type);
        }
    }

    render() {
        // Render power-up on the map
        const cell = $(`.cell[data-x="${this.position.x}"][data-y="${this.position.y}"]`);
        if (cell) {
            cell.classList.add('power-up', this.type);
        }
    }
}
