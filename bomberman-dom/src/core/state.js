// src/core/state.js
export class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        const prevState = this.state;
        this.state = { ...this.state, ...newState };
        this.listeners.forEach((listener) => listener(this.state, prevState));
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }
}
