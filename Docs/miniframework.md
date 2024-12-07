# Mini Framework Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Core Modules](#core-modules)
3. [Installation & Setup](#installation--setup)
4. [API Reference](#api-reference)
5. [Implementation Details](#implementation-details)
6. [Examples](#examples)
7. [Best Practices](#best-practices)

## Introduction

Mini Framework is a lightweight JavaScript framework that provides essential features for building modern web applications. It implements:

- Virtual DOM for efficient rendering
- State management with subscriptions
- Event delegation system
- Hash-based routing

### Key Features
- Zero dependencies
- Small footprint (~5KB minified)
- Simple API
- Performance optimized

## Core Modules

### 1. DOM Module (`src/core/dom.js`)
The DOM module provides virtual DOM implementation with efficient diffing algorithm.

#### Key Components:
- Virtual DOM representation
- Diffing algorithm
- Patch operations
- Element creation API

```javascript
import { DOM } from './src/index.js';
const { createElement, render } = DOM;

// Create element
const element = createElement('div', { class: 'container' }, [
  createElement('h1', {}, ['Hello']),
  createElement('p', {}, ['Content'])
]);

// Render to DOM
render(element, document.getElementById('app'));
```

### 2. State Management (`src/core/state.js`)
Implements a centralized store for application state.

#### Features:
- Immutable state updates
- Subscription system
- Path-based subscriptions
- Deep equality checking

```javascript
import { Store } from './src/index.js';

// Initialize store
const store = new Store({
  todos: [],
  filter: 'all'
});

// Subscribe to changes
store.subscribe((state) => {
  console.log('State updated:', state);
});

// Subscribe to specific path
store.subscribe((state) => {
  console.log('Todos updated:', state.todos);
}, 'todos');

// Update state
store.setState({ todos: [...store.getState().todos, newTodo] });
```

### 3. Event System (`src/core/events.js`)
Provides event delegation and custom event handling.

#### Features:
- Event delegation
- Custom event emission
- Memory leak prevention
- Selector-based handling

```javascript
import { Events } from './src/index.js';

// Add delegated event listener
Events.on('click', '.button', (event) => {
  console.log('Button clicked:', event.target);
});

// Remove listener
Events.off('click', '.button', handler);

// Emit custom event
Events.emit('customEvent', { detail: 'data' });
```

### 4. Router (`src/core/router.js`)
Implements hash-based routing system.

#### Features:
- Hash-based navigation
- Route registration
- Default routes
- Error handling

```javascript
import { Router } from './src/index.js';

const router = new Router();

router.addRoute('', () => {
  console.log('Home page');
});

router.addRoute('todos', () => {
  console.log('Todos page');
});

router.navigate('todos');
```

## Implementation Details

### Virtual DOM Implementation
The framework uses a virtual DOM system for efficient updates:

1. **Element Creation**:
```javascript
{
  tag: 'div',
  attrs: { class: 'container' },
  children: [],
  key: null
}
```

2. **Diffing Algorithm**:
- Compares old and new virtual DOM trees
- Generates minimal set of patches
- Handles node creation, removal, updates
- Supports keyed elements for lists

3. **Patch Types**:
- CREATE: New node creation
- REMOVE: Node removal
- REPLACE: Node replacement
- UPDATE_ATTRS: Attribute updates
- UPDATE_TEXT: Text content updates

### State Management Implementation
The store uses:
- Immutable state updates
- Deep equality checking
- Path-based subscriptions
- WeakMap for listener storage

### Event System Implementation
Uses event delegation with:
- WeakMap for listener storage
- Selector matching
- Event bubbling
- Automatic cleanup

## TodoMVC Example

Reference to TodoMVC implementation:

```javascript:examples/todomvc/app.js
startLine: 1
endLine: 197
```

This example demonstrates:
- State management
- Event handling
- DOM manipulation
- Routing
- Local storage persistence

## Best Practices

1. **State Management**:
   - Keep state immutable
   - Use path-based subscriptions for performance
   - Batch state updates when possible

2. **DOM Manipulation**:
   - Use keys for list items
   - Minimize direct DOM access
   - Leverage event delegation

3. **Event Handling**:
   - Use delegation for dynamic elements
   - Clean up listeners when removing elements
   - Keep handlers small and focused

4. **Performance**:
   - Use keys for list rendering
   - Implement shouldUpdate checks
   - Batch DOM updates
   - Use path-based subscriptions

## Error Handling

The framework implements comprehensive error handling:

1. **DOM Errors**:
   - Invalid element creation
   - Rendering failures
   - Diffing errors

2. **State Errors**:
   - Invalid state updates
   - Subscription errors
   - Path validation

3. **Event Errors**:
   - Invalid event types
   - Selector errors
   - Handler errors

4. **Router Errors**:
   - Invalid routes
   - Navigation errors
   - Action errors



