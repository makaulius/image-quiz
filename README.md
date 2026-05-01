# Image Quiz

Small Socket.IO + Express image quiz.

## Requirements

- Node.js (any recent LTS is fine)
- npm (comes with Node)

## Install

From the project folder:

```bash
npm install
```

## Run locally

Start the server:

```bash
node server.js
```

You should see:

- `Server running at http://localhost:3000`

Open in your browser:

- Host: http://localhost:3000/host.html
- Player: http://localhost:3000/player.html

Tip: open multiple Player tabs/windows to simulate multiple players.

## Themes

Themes are read from:

- `public/assets/themes/<theme-name>/*.jpg`

The answer is derived from the filename (dashes become spaces).
