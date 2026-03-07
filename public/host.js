const socket = io();

socket.emit("register-host");

const setupEl = document.getElementById("setup");
const gameEl = document.getElementById("game");
const resultsEl = document.getElementById("results");

const themeSelect = document.getElementById("theme-select");
const startButton = document.getElementById("start-game");

const elapsedEl = document.getElementById("elapsed");
const progressEl = document.getElementById("progress");
const imageEl = document.getElementById("image");
const filenameEl = document.getElementById("filename");
const yesButton = document.getElementById("btn-yes");
const noButton = document.getElementById("btn-no");
const pauseButton = document.getElementById("btn-pause");
const stopButton = document.getElementById("btn-stop");
const newGameButton = document.getElementById("btn-new-game");

const correctEl = document.getElementById("correct");
const durationEl = document.getElementById("duration");

let selectedThemeId = null;
let timerIntervalId = null;
let elapsedMsBase = 0;
let lastSyncAt = null;
let isPaused = false;

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

function showSetup() {
  setupEl.style.display = "block";
  gameEl.style.display = "none";
  resultsEl.style.display = "none";
  imageEl.src = "";
  filenameEl.textContent = "-";
  progressEl.textContent = "-";
  elapsedEl.textContent = "0:00";
  pauseButton.textContent = "Pause";
  isPaused = false;
  syncElapsed(0);
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  setAnswerButtonsEnabled(false);
}

function showGame() {
  setupEl.style.display = "none";
  resultsEl.style.display = "none";
  gameEl.style.display = "block";
}

function showResults({ correctCount, elapsedMs } = {}) {
  setupEl.style.display = "none";
  gameEl.style.display = "none";
  resultsEl.style.display = "block";
  correctEl.textContent = String(correctCount ?? 0);
  durationEl.textContent = formatElapsed(elapsedMs ?? getDisplayedElapsedMs());
}

socket.emit("get-themes");

socket.on("themes-list", (themes) => {
  themeSelect.innerHTML = "";
  themes.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = theme;

    themeSelect.appendChild(option);
  });

  if (themes.length > 0) {
    selectedThemeId = themeSelect.value || themes[0];
  }
});

themeSelect.addEventListener("change", () => {
  selectedThemeId = themeSelect.value;
});

startButton.addEventListener("click", () => {
  socket.emit("start-game", {
    themeId: selectedThemeId,
    maxQuestions: 10,
  });
});

function setAnswerButtonsEnabled(enabled) {
  yesButton.disabled = !enabled;
  noButton.disabled = !enabled;
}

function isFormElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (isFormElement(e.target)) return;
  if (gameEl.style.display === "none") return;

  // Pause/Resume: Space
  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    pauseButton.click();
    return;
  }

  // Stop: Escape
  if (e.key === "Escape") {
    e.preventDefault();
    stopButton.click();
    return;
  }

  // Answers only while not paused
  if (isPaused) return;

  const key = String(e.key || "").toLowerCase();
  if (key === "t" && !yesButton.disabled) {
    e.preventDefault();
    yesButton.click();
  }
  if (key === "n" && !noButton.disabled) {
    e.preventDefault();
    noButton.click();
  }
});

yesButton.addEventListener("click", () => {
  setAnswerButtonsEnabled(false);
  socket.emit("answer", { value: true });
});

noButton.addEventListener("click", () => {
  setAnswerButtonsEnabled(false);
  socket.emit("answer", { value: false });
});

socket.on("game-start", ({ startTime, total }) => {
  showGame();
  syncElapsed(0);
  isPaused = false;
  pauseButton.textContent = "Pause";
  startElapsedTimer();
  progressEl.textContent = total ? `1/${total}` : "-";
});

socket.on("question-host", ({ image, answer, index, total, elapsedMs, isPaused: pausedFlag }) => {
  if (typeof elapsedMs === "number") {
    syncElapsed(elapsedMs);
  }
  if (typeof pausedFlag === "boolean") {
    isPaused = pausedFlag;
    pauseButton.textContent = isPaused ? "Resume" : "Pause";
  }

  progressEl.textContent = `${index + 1}/${total}`;
  imageEl.src = image;
  filenameEl.textContent = answer;
  setAnswerButtonsEnabled(!isPaused);
});

socket.on("paused-state", ({ isPaused: pausedFlag, elapsedMs }) => {
  if (typeof elapsedMs === "number") {
    syncElapsed(elapsedMs);
  }
  if (typeof pausedFlag === "boolean") {
    isPaused = pausedFlag;
    pauseButton.textContent = isPaused ? "Resume" : "Pause";
    setAnswerButtonsEnabled(!isPaused);
  }
});

pauseButton.addEventListener("click", () => {
  socket.emit("pause-game");
});

stopButton.addEventListener("click", () => {
  const ok = confirm("Ar tikrai sustabdyti žaidimą?");
  if (!ok) return;
  socket.emit("stop-game");
});

socket.on("game-stopped", () => {
  showSetup();
});

socket.on("game-over", ({ correctCount, elapsedMs }) => {
  setAnswerButtonsEnabled(false);
  showResults({ correctCount, elapsedMs });
});

socket.on("error-message", (message) => {
  // Keep it minimal: show alert for now.
  alert(message);
  showSetup();
});

newGameButton.addEventListener("click", () => {
  socket.emit("reset-ui");
  showSetup();
});

showSetup();
