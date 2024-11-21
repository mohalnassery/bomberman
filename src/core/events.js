// src/core/events.js
export function on(eventType, selector, handler) {
    document.addEventListener(eventType, (event) => {
        if (event.target.matches(selector) || event.target.closest(selector)) {
            handler(event);
        }
    });
}

export function off(eventType, selector, handler) {
    // Note: Removing event listeners requires keeping a reference to the bound function
}

export function emit(eventType, detail = {}) {
    const event = new CustomEvent(eventType, { detail });
    document.dispatchEvent(event);
}
