// src/core/component.js
import { render } from './dom.js';

export class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = {};
        this.element = null;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.update();
    }

    update() {
        if (this.element) {
            this.render();
        }
    }

    mount(element) {
        this.element = element;
        this.render();
    }

    render() {
        throw new Error('Component must implement render method');
    }

    destroy() {
        // Cleanup method to be implemented by child classes
    }
}
