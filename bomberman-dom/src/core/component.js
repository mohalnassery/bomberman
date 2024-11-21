// src/core/component.js
import { render } from './dom.js';

export class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = {};
    }

    setState(newState) {
        const prevState = this.state;
        this.state = { ...this.state, ...newState };
        this.update();
    }

    update() {
        const newVdom = this.render();
        if (this.base) {
            this.base = render(newVdom, this.base.parentNode, this.base);
        }
    }

    render() {
        throw new Error('Component must implement render method');
    }
}
