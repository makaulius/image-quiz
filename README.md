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
- Learn: http://localhost:3000/learn.html

Tip: open multiple Player tabs/windows to simulate multiple players.

## Themes

Themes are read from:

- `public/assets/themes/<theme-name>/*.jpg`

The answer is derived from the filename (dashes become spaces).

## Learn mode

The learning page shows all theme images with their filenames (sorted alphabetically):

- http://localhost:3000/learn.html

For a very simple static file server (no Node API), it reads a pre-generated manifest:

- `public/assets/themes/manifest.json`

If you add/remove images, regenerate it:

```bash
npm run generate:themes
```
