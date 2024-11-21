// src/core/dom.js
export function createElement(tag, attrs = {}, ...children) {
    return { tag, attrs, children };
}

export function render(vdom, container, oldDom = container.firstChild) {
    if (!vdom) return;

    if (typeof vdom === 'string' || typeof vdom === 'number') {
        const textNode = document.createTextNode(vdom);
        if (oldDom) {
            container.replaceChild(textNode, oldDom);
        } else {
            container.appendChild(textNode);
        }
        return textNode;
    }

    const { tag, attrs, children } = vdom;
    const domElement = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs || {})) {
        domElement.setAttribute(key, value);
    }

    children.forEach(child => render(child, domElement));

    if (oldDom) {
        container.replaceChild(domElement, oldDom);
    } else {
        container.appendChild(domElement);
    }

    return domElement;
}
