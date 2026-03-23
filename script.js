const GAME_DURATION = 60;
const MILESTONES = [5, 25, 50];
const MILESTONE_FACTS = {
  5: "Fact: charity: water has funded 170k+ water projects worldwide.",
  25: "Fact: 100% of public donations fund clean water projects.",
  50: "Fact: Every can tap in this game supports awareness for clean water access."
};

const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const streakEl = document.getElementById("streak");
const feedbackEl = document.getElementById("feedback");
const milestoneEl = document.getElementById("milestone");
const gameGridEl = document.getElementById("game-grid");
const finalScoreEl = document.getElementById("final-score");
const endScreenEl = document.getElementById("end-screen");

const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const replayBtn = document.getElementById("replay-btn");

const canTemplate = document.getElementById("can-template");
const obstacleTemplate = document.getElementById("obstacle-template");
const holes = Array.from(document.querySelectorAll(".hole"));

let score = 0;
let streak = 0;
let timeLeft = GAME_DURATION;

let gameRunning = false;
let gamePaused = false;

let activeHoleIndex = null;
let activeType = null;
let activeMissHandled = false;
let lastHoleIndex = null;

let timerIntervalId = null;
let spawnTimeoutId = null;
let activeTimeoutId = null;
let feedbackTimeoutId = null;
let milestoneTimeoutId = null;

let audioContext = null;

function updateHUD() {
  scoreEl.textContent = String(score);
  timerEl.textContent = String(timeLeft);
  streakEl.textContent = String(streak);
}

function setButtonsForIdle() {
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";
}

function setButtonsForRunning() {
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";
}

function setButtonsForPaused() {
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Resume";
}

function clearMessages() {
  feedbackEl.textContent = "";
  milestoneEl.textContent = "";
}

function showFeedback(message, duration = 900) {
  clearTimeout(feedbackTimeoutId);
  feedbackEl.textContent = message;
  feedbackTimeoutId = setTimeout(() => {
    feedbackEl.textContent = "";
  }, duration);
}

function showMilestone(message, duration = 3500) {
  clearTimeout(milestoneTimeoutId);
  milestoneEl.textContent = message;
  milestoneTimeoutId = setTimeout(() => {
    milestoneEl.textContent = "";
  }, duration);
}

function getVisibleDuration() {
  const minMs = 420;
  const baseMs = 1200;
  const reduction = Math.min(score * 10, 780);
  return Math.max(minMs, baseMs - reduction);
}

function getGapDuration() {
  const minMs = 220;
  const baseMs = 520;
  const reduction = Math.min(score * 3, 260);
  return Math.max(minMs, baseMs - reduction);
}

function chooseHoleIndex() {
  if (holes.length === 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * holes.length);
  while (index === lastHoleIndex) {
    index = Math.floor(Math.random() * holes.length);
  }
  lastHoleIndex = index;
  return index;
}

function shouldSpawnObstacle() {
  return Math.random() < 0.15;
}

function removeActiveItem() {
  if (activeHoleIndex === null) {
    return;
  }

  const hole = holes[activeHoleIndex];
  hole.innerHTML = "";
  hole.dataset.active = "false";

  activeHoleIndex = null;
  activeType = null;
  activeMissHandled = false;
}

function registerMiss() {
  if (streak > 0) {
    showFeedback("Miss! Streak reset.");
  } else {
    showFeedback("Miss!");
  }
  streak = 0;
  updateHUD();
  playSound("miss");
}

function handleActiveTimeout() {
  if (!gameRunning || gamePaused || activeHoleIndex === null) {
    return;
  }

  if (activeType === "can" && !activeMissHandled) {
    activeMissHandled = true;
    registerMiss();
  }

  removeActiveItem();

  if (gameRunning && !gamePaused) {
    scheduleNextSpawn();
  }
}

function spawnItem() {
  if (!gameRunning || gamePaused || timeLeft <= 0) {
    return;
  }

  removeActiveItem();

  const holeIndex = chooseHoleIndex();
  const hole = holes[holeIndex];
  const itemType = shouldSpawnObstacle() ? "obstacle" : "can";
  const template = itemType === "can" ? canTemplate : obstacleTemplate;
  const itemNode = template.content.firstElementChild.cloneNode(true);

  hole.appendChild(itemNode);
  hole.dataset.active = "true";

  activeHoleIndex = holeIndex;
  activeType = itemType;
  activeMissHandled = false;

  clearTimeout(activeTimeoutId);
  activeTimeoutId = setTimeout(handleActiveTimeout, getVisibleDuration());
}

function scheduleNextSpawn() {
  clearTimeout(spawnTimeoutId);
  spawnTimeoutId = setTimeout(spawnItem, getGapDuration());
}

function checkMilestone() {
  if (!MILESTONES.includes(score)) {
    return;
  }

  const fact = MILESTONE_FACTS[score];
  if (fact) {
    showMilestone(fact);
  }
}

function applyCanHit() {
  score += 1;
  streak += 1;

  if (streak > 0 && streak % 5 === 0) {
    score += 2;
    showFeedback(`Streak x${streak}! +2 bonus`);
  } else {
    showFeedback("Nice hit!");
  }

  updateHUD();
  checkMilestone();
  playSound("hit");
}

function applyObstacleHit() {
  score = Math.max(0, score - 1);
  streak = 0;
  updateHUD();
  showFeedback("Obstacle! -1 point");
  playSound("miss");
}

function onGridPointerDown(event) {
  if (!gameRunning || gamePaused || timeLeft <= 0) {
    return;
  }

  const item = event.target.closest(".item");
  if (!item) {
    return;
  }

  const hole = item.closest(".hole");
  if (!hole) {
    return;
  }

  const holeIndex = Number(hole.dataset.index);

  if (holeIndex !== activeHoleIndex || hole.dataset.active !== "true") {
    return;
  }

  if (activeType === "can") {
    applyCanHit();
  } else {
    applyObstacleHit();
  }

  clearTimeout(activeTimeoutId);
  removeActiveItem();
  scheduleNextSpawn();
}

function tickTimer() {
  if (!gameRunning || gamePaused) {
    return;
  }

  timeLeft -= 1;
  if (timeLeft <= 0) {
    timeLeft = 0;
    updateHUD();
    endGame();
    return;
  }

  updateHUD();
}

function startTimer() {
  clearInterval(timerIntervalId);
  timerIntervalId = setInterval(tickTimer, 1000);
}

function stopAllTimers() {
  clearInterval(timerIntervalId);
  clearTimeout(spawnTimeoutId);
  clearTimeout(activeTimeoutId);
}

function endGame() {
  gameRunning = false;
  gamePaused = false;
  stopAllTimers();
  removeActiveItem();

  finalScoreEl.textContent = String(score);
  endScreenEl.classList.remove("hidden");
  setButtonsForIdle();
}

function startRound() {
  gameRunning = true;
  gamePaused = false;
  setButtonsForRunning();
  endScreenEl.classList.add("hidden");

  startTimer();
  spawnItem();
}

function resetState() {
  score = 0;
  streak = 0;
  timeLeft = GAME_DURATION;
  lastHoleIndex = null;

  stopAllTimers();
  removeActiveItem();
  clearMessages();
  updateHUD();
}

function handleStart() {
  if (gameRunning) {
    return;
  }

  initAudio();
  resetState();
  startRound();
}

function handlePauseToggle() {
  if (!gameRunning) {
    return;
  }

  if (!gamePaused) {
    gamePaused = true;
    stopAllTimers();
    showFeedback("Paused");
    setButtonsForPaused();
    return;
  }

  gamePaused = false;
  showFeedback("Resumed");
  setButtonsForRunning();
  startTimer();

  if (activeHoleIndex !== null) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = setTimeout(handleActiveTimeout, getVisibleDuration());
  } else {
    scheduleNextSpawn();
  }
}

function handleRestart() {
  initAudio();
  resetState();
  startRound();
}

function initAudio() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playSound(type) {
  if (!audioContext) {
    return;
  }

  const duration = type === "hit" ? 0.08 : 0.14;
  const frequency = type === "hit" ? 680 : 180;
  const gainValue = type === "hit" ? 0.05 : 0.08;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type === "hit" ? "triangle" : "sawtooth";
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(gainValue, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

startBtn.addEventListener("click", handleStart);
pauseBtn.addEventListener("click", handlePauseToggle);
restartBtn.addEventListener("click", handleRestart);
replayBtn.addEventListener("click", handleRestart);
gameGridEl.addEventListener("pointerdown", onGridPointerDown);

updateHUD();
setButtonsForIdle();
