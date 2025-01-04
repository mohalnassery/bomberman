// src/index.js
import { App } from './components/App.js';
import { render } from './core/dom.js';

const rootElement = document.getElementById('root');
const app = new App();
render(app.render(), rootElement);

