const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static("public"));

const themesPath = path.join(__dirname, "public/assets/themes");

// funkcija nuskaityti temas
function getThemes() {
  const themes = fs.readdirSync(themesPath).filter((file) => {
    return fs.statSync(path.join(themesPath, file)).isDirectory();
  });

  return themes.map((theme) => {
    const themeFolder = path.join(themesPath, theme);

    const files = fs
      .readdirSync(themeFolder)
      .filter((file) => file.endsWith(".jpg"));

    const cards = files.map((file) => {
      return {
        image: `/assets/themes/${theme}/${file}`,
        answer: file.replace(".jpg", "").replace(/-/g, " "),
      };
    });

    return {
      id: theme,
      cards: cards,
    };
  });
}

const themes = getThemes();

let activeGame = null;
let lastHostId = null;
const connectedPlayers = new Set();

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickRandomCards(theme, maxQuestions) {
  const cards = Array.isArray(theme?.cards) ? [...theme.cards] : [];
  shuffleInPlace(cards);
  const limit = Math.max(1, Math.min(maxQuestions ?? 10, 10));
  return cards.slice(0, Math.min(limit, cards.length));
}

function getElapsedMs(game, now = Date.now()) {
  if (!game) return 0;
  const inProgressPausedMs = game.isPaused && game.pausedAt ? now - game.pausedAt : 0;
  return Math.max(0, now - game.startTime - game.pausedTotalMs - inProgressPausedMs);
}

function broadcastCurrentQuestion() {
  if (!activeGame) return;
  const { cards, index, startTime } = activeGame;
  const card = cards[index];
  if (!card) return;

  const elapsedMs = getElapsedMs(activeGame);

  const payloadBase = {
    image: card.image,
    index,
    total: cards.length,
    startTime,
    elapsedMs,
    isPaused: activeGame.isPaused,
  };

  io.to(activeGame.hostId).emit("question-host", {
    ...payloadBase,
    answer: card.answer,
  });

  for (const playerId of activeGame.allowedPlayers) {
    io.to(playerId).emit("question-player", payloadBase);
  }
}

function broadcastPausedState() {
  if (!activeGame) return;
  const elapsedMs = getElapsedMs(activeGame);
  for (const playerId of activeGame.allowedPlayers) {
    io.to(playerId).emit("paused-state", {
      isPaused: activeGame.isPaused,
      elapsedMs,
    });
  }
  io.to(activeGame.hostId).emit("paused-state", {
    isPaused: activeGame.isPaused,
    elapsedMs,
  });
}

function stopGame(reason = "stopped") {
  if (!activeGame) return;
  // Stop resets UI for everyone (including people who were denied mid-game).
  io.emit("game-stopped", { reason });
  activeGame = null;
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("register-host", () => {
    lastHostId = socket.id;
  });

  socket.on("register-player", () => {
    connectedPlayers.add(socket.id);

    // If a game is already running, do not allow this player to join mid-game.
    if (activeGame && !activeGame.allowedPlayers.has(socket.id)) {
      socket.emit("join-denied");
    }
  });

  // host gali gauti temas
  socket.on("get-themes", () => {
    socket.emit("themes-list", themes.map((t) => t.id));
  });

  socket.on("start-game", ({ themeId, maxQuestions } = {}) => {
    const resolvedThemeId = themeId ?? themes[0]?.id;
    const theme = themes.find((t) => t.id === resolvedThemeId);

    if (!theme) {
      socket.emit("error-message", "Theme nerasta");
      return;
    }

    const cards = pickRandomCards(theme, maxQuestions);
    if (cards.length === 0) {
      socket.emit("error-message", "Temoje nėra .jpg paveikslėlių");
      return;
    }

    activeGame = {
      hostId: socket.id,
      themeId: theme.id,
      cards,
      index: 0,
      startTime: Date.now(),
      correctCount: 0,
      isPaused: false,
      pausedAt: null,
      pausedTotalMs: 0,
      allowedPlayers: new Set(connectedPlayers),
    };

    // Ensure host is not treated as a player.
    activeGame.allowedPlayers.delete(socket.id);

    lastHostId = socket.id;

    // Only players present at start may participate in this game.
    for (const playerId of activeGame.allowedPlayers) {
      io.to(playerId).emit("game-start", {
        themeId: theme.id,
        total: cards.length,
        startTime: activeGame.startTime,
        elapsedMs: 0,
      });
    }

    io.to(activeGame.hostId).emit("game-start", {
      themeId: theme.id,
      total: cards.length,
      startTime: activeGame.startTime,
      elapsedMs: 0,
    });

    broadcastCurrentQuestion();
  });

  socket.on("answer", ({ value } = {}) => {
    if (!activeGame) return;
    if (socket.id !== activeGame.hostId) return;

    if (activeGame.isPaused) {
      return;
    }

    if (value === true) {
      activeGame.correctCount += 1;
    }

    // value is currently not persisted; it only advances the quiz.
    activeGame.index += 1;
    if (activeGame.index >= activeGame.cards.length) {
      const elapsedMs = getElapsedMs(activeGame);
      io.to(activeGame.hostId).emit("game-over", {
        themeId: activeGame.themeId,
        total: activeGame.cards.length,
        startTime: activeGame.startTime,
        elapsedMs,
        correctCount: activeGame.correctCount,
      });

      for (const playerId of activeGame.allowedPlayers) {
        io.to(playerId).emit("game-over");
      }

      activeGame = null;
      return;
    }

    broadcastCurrentQuestion();
  });

  socket.on("pause-game", () => {
    if (!activeGame) return;
    if (socket.id !== activeGame.hostId) return;

    if (!activeGame.isPaused) {
      activeGame.isPaused = true;
      activeGame.pausedAt = Date.now();
    } else {
      const now = Date.now();
      if (activeGame.pausedAt) {
        activeGame.pausedTotalMs += now - activeGame.pausedAt;
      }
      activeGame.isPaused = false;
      activeGame.pausedAt = null;
    }

    broadcastPausedState();
    broadcastCurrentQuestion();
  });

  socket.on("stop-game", () => {
    if (!activeGame) return;
    if (socket.id !== activeGame.hostId) return;
    stopGame("stopped");
  });

  // Allows host to reset Player UI back to the "Pasiruošk" screen after game over.
  socket.on("reset-ui", () => {
    if (socket.id !== lastHostId) return;
    io.emit("ui-reset");
  });

  // Do NOT auto-attach new sockets to an active game.

  socket.on("disconnect", () => {
    console.log("User disconnected");

    connectedPlayers.delete(socket.id);

    if (activeGame && socket.id === activeGame.hostId) {
      // End game if host disconnects.
      stopGame("host-disconnected");
    }

    if (socket.id === lastHostId) {
      lastHostId = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});