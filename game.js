const playerIntegrityEl = document.getElementById("playerIntegrity");
const enemyIntegrityEl = document.getElementById("enemyIntegrity");
const turnLabelEl = document.getElementById("turnLabel");
const subtitleEl = document.getElementById("subtitle");
const logBoxEl = document.getElementById("logBox");

const shootSelfBtn = document.getElementById("shootSelfBtn");
const shootEnemyBtn = document.getElementById("shootEnemyBtn");
const restartBtn = document.getElementById("restartBtn");

const cameraRig = document.getElementById("cameraRig");
const ammoReveal = document.getElementById("ammoReveal");
const ammoTotalEl = document.getElementById("ammoTotal");
const ammoLiveEl = document.getElementById("ammoLive");
const ammoBlankEl = document.getElementById("ammoBlank");
const shellSlotsEl = document.getElementById("shellSlots");

const shotgunEl = document.getElementById("shotgun");
const enemyRobotEl = document.getElementById("enemyRobot");
const playerRobotEl = document.getElementById("playerRobot");

const state = {
  playerHp: 3,
  enemyHp: 3,
  shells: [],
  round: 0,
  turn: "player",
  locked: true,
  gameOver: false,
  audioCtx: null,
};

shootSelfBtn.addEventListener("click", () => playerAction("self"));
shootEnemyBtn.addEventListener("click", () => playerAction("enemy"));
restartBtn.addEventListener("click", startGame);

startGame();

function startGame() {
  state.playerHp = 3;
  state.enemyHp = 3;
  state.round = 0;
  state.turn = "player";
  state.shells = [];
  state.locked = true;
  state.gameOver = false;

  removeRobotStates();
  restartBtn.style.display = "none";
  setSubtitle("불법 경기장 연결 완료. 경기 준비 중...");
  writeLog("새 프로토타입 매치를 시작한다.");
  renderIntegrity();
  updateTurnLabel("라운드 준비");
  nextRound();
}

async function nextRound() {
  if (state.gameOver) return;

  state.locked = true;
  state.round += 1;
  state.shells = generateShellSet();

  const liveCount = countType("live");
  const blankCount = countType("blank");

  updateTurnLabel(`라운드 ${state.round}`);
  writeLog(`라운드 ${state.round}: 총 ${state.shells.length}발 / 실탄 ${liveCount} / 공포탄 ${blankCount}`);

  // 탄환 구성 확인은 라운드 시작 시 딱 한 번만.
  await revealAmmoSequence(liveCount, blankCount);

  if (state.gameOver) return;

  if (state.turn === "player") {
    state.locked = false;
    setSubtitle("네 차례다. 누구를 겨냥할지 선택해.");
    updateTurnLabel("너의 턴");
  } else {
    updateTurnLabel("상대 턴");
    setSubtitle("상대 기체가 움직인다...");
    await sleep(700);
    enemyTurn();
  }
}

function generateShellSet() {
  const total = randInt(2, 5);
  const maxLive = Math.min(2, total - 1);
  const live = randInt(1, maxLive);
  const blank = total - live;

  const shells = [
    ...Array(live).fill("live"),
    ...Array(blank).fill("blank"),
  ];

  shuffle(shells);
  return shells;
}

async function revealAmmoSequence(liveCount, blankCount) {
  state.locked = true;
  setSubtitle("테이블 스캔 시작. 장전 정보를 확인한다.");

  // 카메라가 테이블로 이동하는 느낌.
  cameraRig.classList.add("focus-table");

  ammoTotalEl.textContent = String(state.shells.length);
  ammoLiveEl.textContent = String(liveCount);
  ammoBlankEl.textContent = String(blankCount);

  shellSlotsEl.innerHTML = "";
  for (let i = 0; i < state.shells.length; i += 1) {
    const slot = document.createElement("div");
    slot.className = `shell-slot ${i < liveCount ? "live" : "blank"}`;
    shellSlotsEl.appendChild(slot);
  }

  ammoReveal.classList.remove("hidden");
  setSubtitle(`총 ${state.shells.length}발이다. ${liveCount}발은 실탄. ${blankCount}발은 공포탄.`);

  await sleep(2200);

  ammoReveal.classList.add("hidden");
  await sleep(250);

  cameraRig.classList.remove("focus-table");
  await sleep(550);
}

async function playerAction(target) {
  if (state.locked || state.gameOver || state.turn !== "player") return;
  ensureAudioContext();
  state.locked = true;
  await resolveShot("player", target);
}

async function enemyTurn() {
  if (state.locked || state.gameOver || state.turn !== "enemy") return;
  state.locked = true;

  await sleep(650);

  const liveChance = countType("live") / state.shells.length;
  let target;

  if (liveChance >= 0.55) {
    target = "player";
  } else if (liveChance <= 0.35) {
    target = "self";
  } else if (state.playerHp === 1 && liveChance >= 0.4) {
    target = "player";
  } else if (state.enemyHp === 1 && liveChance <= 0.5) {
    target = "self";
  } else {
    target = Math.random() < 0.55 ? "player" : "self";
  }

  await resolveShot("enemy", target);
}

async function resolveShot(actor, target) {
  if (state.shells.length === 0) {
    await nextRound();
    return;
  }

  const aimedAt = actor === "player"
    ? (target === "self" ? "player" : "enemy")
    : (target === "self" ? "enemy" : "player");

  setSubtitle(
    actor === "player"
      ? target === "self"
        ? "내 기체를 겨눈다..."
        : "상대 기체를 겨눈다..."
      : target === "self"
      ? "상대가 자기 기체를 겨눈다..."
      : "상대가 네 기체를 겨눈다..."
  );

  updateTurnLabel(actor === "player" ? "너의 턴" : "상대 턴");

  // 총을 든다.
  await raiseShotgun(aimedAt);
  await sleep(240);

  const shell = state.shells.shift();
  const wasBlank = shell === "blank";
  const selfShot = target === "self";

  // 쏜다.
  await fireShotgun(aimedAt, shell);

  if (wasBlank) {
    setSubtitle("찰칵. 티잉— 공포탄이다.");
    writeLog(
      `${actor === "player" ? "너" : "상대"}는 ${
        selfShot ? "자기 기체" : aimedAt === "player" ? "네 기체" : "상대 기체"
      }를 겨눴지만 공포탄이었다.`
    );

    const extraTurn = selfShot;
    await sleep(600);

    // 총을 다시 내린다.
    await lowerShotgun();

    if (state.shells.length === 0) {
      state.turn = extraTurn ? actor : nextActor(actor);
      await nextRound();
      return;
    }

    if (extraTurn) {
      state.turn = actor;

      if (actor === "player") {
        updateTurnLabel("너의 턴");
        setSubtitle("공포탄이다. 자기 기체를 쐈으니 한 번 더 행동할 수 있다.");
        state.locked = false;
      } else {
        updateTurnLabel("상대 턴");
        setSubtitle("상대가 공포탄을 뽑았다. 한 번 더 행동한다.");
        await sleep(800);
        enemyTurn();
      }
    } else {
      state.turn = nextActor(actor);
      handOverTurn();
    }

    return;
  }

  if (aimedAt === "player") {
    damagePlayer();
  } else {
    damageEnemy();
  }

  setSubtitle("타앙— 실탄이다.");
  writeLog(
    `${actor === "player" ? "너" : "상대"}가 ${
      aimedAt === "player" ? "플레이어 기체" : "상대 기체"
    }에 실탄을 맞혔다.`
  );

  renderIntegrity();
  await sleep(700);
  await lowerShotgun();

  if (checkGameOver()) return;

  if (state.shells.length === 0) {
    state.turn = nextActor(actor);
    await nextRound();
    return;
  }

  state.turn = nextActor(actor);
  handOverTurn();
}

function handOverTurn() {
  if (state.turn === "player") {
    updateTurnLabel("너의 턴");
    setSubtitle("네 차례다. 선택해.");
    state.locked = false;
  } else {
    updateTurnLabel("상대 턴");
    setSubtitle("상대 기체가 판단 중이다...");
    setTimeout(() => enemyTurn(), 850);
  }
}

function damagePlayer() {
  state.playerHp = Math.max(0, state.playerHp - 1);
  pulseRobot(playerRobotEl);
  if (state.playerHp <= 1) playerRobotEl.classList.add("critical");
}

function damageEnemy() {
  state.enemyHp = Math.max(0, state.enemyHp - 1);
  pulseRobot(enemyRobotEl);
  if (state.enemyHp <= 1) enemyRobotEl.classList.add("critical");
}

function pulseRobot(el) {
  el.classList.add("hit");
  setTimeout(() => el.classList.remove("hit"), 350);
}

function checkGameOver() {
  if (state.playerHp <= 0 || state.enemyHp <= 0) {
    state.gameOver = true;
    state.locked = true;
    restartBtn.style.display = "inline-flex";

    if (state.playerHp <= 0 && state.enemyHp <= 0) {
      updateTurnLabel("무승부");
      setSubtitle("양쪽 기체 모두 정지했다.");
      writeLog("무승부. 양쪽 기체 모두 기능 정지.");
    } else if (state.enemyHp <= 0) {
      updateTurnLabel("승리");
      setSubtitle("상대 기체 정지. 네가 이겼다.");
      writeLog("승리. 상대 기체가 완전히 정지했다.");
    } else {
      updateTurnLabel("패배");
      setSubtitle("기체 파손. 접속 종료.");
      writeLog("패배. 네 기체가 기능 정지했다.");
    }

    return true;
  }

  return false;
}

async function raiseShotgun(target) {
  shotgunEl.classList.remove("lowered", "aim-self", "aim-enemy", "firing");
  shotgunEl.classList.add(target === "player" ? "aim-self" : "aim-enemy");
  await sleep(280);
}

async function fireShotgun(target, shellType) {
  shotgunEl.classList.add("firing");

  if (shellType === "blank") {
    playBlankShot();
  } else {
    playLiveShot();
  }

  await sleep(220);
  shotgunEl.classList.remove("firing");
}

async function lowerShotgun() {
  shotgunEl.classList.remove("aim-self", "aim-enemy", "firing");
  shotgunEl.classList.add("lowered");
  await sleep(240);
}

function renderIntegrity() {
  renderPips(playerIntegrityEl, state.playerHp);
  renderPips(enemyIntegrityEl, state.enemyHp);
}

function renderPips(container, activeCount) {
  container.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const pip = document.createElement("div");
    pip.className = `pip ${i < activeCount ? "active" : ""}`;
    container.appendChild(pip);
  }
}

function setSubtitle(text) {
  subtitleEl.textContent = text;
}

function updateTurnLabel(text) {
  turnLabelEl.textContent = text;
}

function writeLog(text) {
  logBoxEl.textContent = text;
}

function countType(type) {
  return state.shells.filter((shell) => shell === type).length;
}

function nextActor(actor) {
  return actor === "player" ? "enemy" : "player";
}

function removeRobotStates() {
  playerRobotEl.classList.remove("critical", "hit");
  enemyRobotEl.classList.remove("critical", "hit");
  shotgunEl.className = "shotgun lowered";
  ammoReveal.classList.add("hidden");
  cameraRig.classList.remove("focus-table");
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureAudioContext() {
  if (!state.audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioCtx();
  }

  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function playBlankShot() {
  const ctx = state.audioCtx;
  if (!ctx) return;

  const now = ctx.currentTime;

  // 찰칵
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = "square";
  clickOsc.frequency.setValueAtTime(210, now);
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.linearRampToValueAtTime(0.16, now + 0.008);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  clickOsc.connect(clickGain).connect(ctx.destination);
  clickOsc.start(now);
  clickOsc.stop(now + 0.08);

  // 티잉—
  const tingOsc1 = ctx.createOscillator();
  const tingOsc2 = ctx.createOscillator();
  const tingGain = ctx.createGain();

  tingOsc1.type = "triangle";
  tingOsc2.type = "sine";
  tingOsc1.frequency.setValueAtTime(1320, now + 0.11);
  tingOsc2.frequency.setValueAtTime(1760, now + 0.11);

  tingGain.gain.setValueAtTime(0.0001, now + 0.11);
  tingGain.gain.linearRampToValueAtTime(0.12, now + 0.14);
  tingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  tingOsc1.connect(tingGain);
  tingOsc2.connect(tingGain);
  tingGain.connect(ctx.destination);

  tingOsc1.start(now + 0.11);
  tingOsc2.start(now + 0.11);
  tingOsc1.stop(now + 0.52);
  tingOsc2.stop(now + 0.52);
}

function playLiveShot() {
  const ctx = state.audioCtx;
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sawtooth";
  osc2.type = "triangle";
  osc1.frequency.setValueAtTime(92, now);
  osc2.frequency.setValueAtTime(148, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.32, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.38);
  osc2.stop(now + 0.38);

  const bufferSize = Math.floor(ctx.sampleRate * 0.18);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(0.24, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.2);
}
