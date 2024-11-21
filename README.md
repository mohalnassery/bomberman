# Bomberman DOM

A modern multiplayer Bomberman game implementation using JavaScript and WebSocket for real-time gameplay.

## Features

- Real-time multiplayer gameplay
- Interactive chat system with drag-and-drop interface
- Power-ups and collectibles
- Spectator mode for eliminated players
- Game over logic with victory/defeat screens
- Player statistics tracking
- Modern UI with animations and sound effects

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
   ```bash
   git clone [your-repository-url]
   cd bomberman-dom
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Game

### For Development

1. Start the WebSocket server:
   ```bash
   npm run server
   ```
   This will start the WebSocket server on port 8080.

2. In a separate terminal, start the development server:
   ```bash
   npm start
   ```

### For Local Network Access

To play the game on your local network:

1. Find your local IP address:
   ```bash
   # On Linux/Mac
   ip addr show
   # or
   ifconfig
   
   # On Windows
   ipconfig
   ```

2. Start the server with your local IP:
   ```bash
   # Replace [YOUR_LOCAL_IP] with your actual local IP
   HOST=[YOUR_LOCAL_IP] npm start
   ```

3. Access the game:
   - Local machine: `http://localhost:3000`
   - Other devices on the network: `http://[YOUR_LOCAL_IP]:3000`

## Game Controls

- **Arrow Keys**: Move player
- **Space**: Place bomb
- **Enter**: Send chat message
- **ESC**: Toggle chat window

## Features

### Gameplay
- Multiple players can join simultaneously
- Power-ups enhance player abilities
- Destructible environment
- Real-time bomb placement and explosions

### Chat System
- Draggable chat window
- Message timestamps
- Player nicknames
- Input sanitization for security

### Spectator Mode
- Eliminated players can watch the ongoing game
- Free camera movement
- Player statistics display

## Troubleshooting

1. If you see "426 Upgrade Required":
   - Make sure both the WebSocket server and game server are running
   - Check if the WebSocket port (8080) is not blocked by firewall

2. Connection Issues:
   - Verify your firewall settings allow WebSocket connections
   - Ensure you're using the correct IP address for local network play

## Security

- Chat input is sanitized to prevent XSS attacks
- WebSocket connections are validated
- Player actions are verified server-side

## Contributing

Feel free to submit issues and enhancement requests!
