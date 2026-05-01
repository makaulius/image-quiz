const socket = io();

socket.emit("register-player");

const statusEl = document.getElementById("status");
const statusTextEl = document.getElementById("status-text");
const gameEl = document.getElementById("game");
const thanksEl = document.getElementById("thanks");

const elapsedEl = document.getElementById("elapsed");
const progressEl = document.getElementById("progress");
const imageEl = document.getElementById("image");

let timerIntervalId = null;
let thanksTimeoutId = null;
let elapsedMsBase = 0;
let lastSyncAt = null;
let isPaused = false;

function applyPausedState() {
  gameEl.classList.toggle("paused", isPaused);
  imageEl.style.visibility = isPaused ? "hidden" : "visible";
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function syncElapsed(elapsedMs) {
  elapsedMsBase = typeof elapsedMs === "number" ? elapsedMs : 0;
  lastSyncAt = Date.now();
}

function getDisplayedElapsedMs() {
  if (isPaused || lastSyncAt === null) {
    return elapsedMsBase;
  }
  return elapsedMsBase + (Date.now() - lastSyncAt);
}

function startElapsedTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
  }
  timerIntervalId = setInterval(() => {
    elapsedEl.textContent = formatElapsed(getDisplayedElapsedMs());
  }, 250);
}

function clearThanksTimeout() {
  if (!thanksTimeoutId) return;
  clearTimeout(thanksTimeoutId);
  thanksTimeoutId = null;
}

function showWaiting() {
  clearThanksTimeout();
  statusEl.style.display = "block";
  gameEl.style.display = "none";
  thanksEl.style.display = "none";
  statusTextEl.textContent = "Ar pasiruošęs?";
  progressEl.textContent = "-";
  elapsedEl.textContent = "0:00";
  imageEl.src = "";
  isPaused = false;
  applyPausedState();
  syncElapsed(0);
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function showGame() {
  clearThanksTimeout();
  statusEl.style.display = "none";
  thanksEl.style.display = "none";
  gameEl.style.display = "block";
}

function showThanks() {
  clearThanksTimeout();
  statusEl.style.display = "none";
  gameEl.style.display = "none";
  thanksEl.style.display = "block";
  isPaused = false;
  applyPausedState();

  // Auto-return to the start screen after 10 seconds.
  thanksTimeoutId = setTimeout(() => {
    showWaiting();
  }, 10_000);
}

socket.on("game-start", ({ elapsedMs, total }) => {
  showGame();
  syncElapsed(typeof elapsedMs === "number" ? elapsedMs : 0);
  isPaused = false;
  applyPausedState();
  startElapsedTimer();
});

socket.on("question-player", ({ image, index, total, elapsedMs, isPaused: pausedFlag }) => {
  showGame();
  if (typeof elapsedMs === "number") {
    syncElapsed(elapsedMs);
  }
  if (typeof pausedFlag === "boolean") {
    isPaused = pausedFlag;
  }
  progressEl.textContent = `${index + 1}/${total}`;
  imageEl.src = image;
  applyPausedState();
});

socket.on("paused-state", ({ isPaused: pausedFlag, elapsedMs }) => {
  if (typeof elapsedMs === "number") {
    syncElapsed(elapsedMs);
  }
  if (typeof pausedFlag === "boolean") {
    isPaused = pausedFlag;
    applyPausedState();
  }
});

socket.on("game-stopped", () => {
  showWaiting();
});

socket.on("game-over", (payload) => {
  showThanks();
});

socket.on("ui-reset", () => {
  showWaiting();
});

socket.on("error-message", (message) => {
  alert(message);
});

socket.on("join-denied", () => {
  // Game already running; wait for the next one.
  showWaiting();
});

showWaiting();
