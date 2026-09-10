const MAX_INTEGRITY = 3;
const MIN_SHELLS = 3;
const MAX_SHELLS = 6;

const els = {
  shell: document.getElementById('gameShell'),
  playerIntegrity: document.getElementById('playerIntegrity'),
  enemyIntegrity: document.getElementById('enemyIntegrity'),
  roundNumber: document.getElementById('roundNumber'),
  remainingCount: document.getElementById('remainingCount'),
  turnLabel: document.getElementById('turnLabel'),
  enemyRobot: document.getElementById('enemyRobot'),
  shotgun: document.getElementById('shotgun'),
  muzzleFlash: document.getElementById('muzzleFlash'),
  sparks: document.getElementById('sparks'),
  playerHitFlash: document.getElementById('playerHitFlash'),
  actionPanel: document.getElementById('actionPanel'),
  shootSelfBtn: document.getElementById('shootSelfBtn'),
  shootEnemyBtn: document.getElementById('shootEnemyBtn'),
  subtitle: document.getElementById('subtitle'),
  briefingOverlay: document.getElementById('briefingOverlay'),
  briefingEyebrow: document.getElementById('briefingEyebrow'),
  briefingTitle: document.getElementById('briefingTitle'),
  briefingText: document.getElementById('briefingText'),
  shellTray: document.getElementById('shellTray'),
  briefTotal: document.getElementById('briefTotal'),
  briefLive: document.getElementById('briefLive'),
  briefBlank: document.getElementById('briefBlank'),
  startBtn: document.getElementById('startBtn'),
  endOverlay: document.getElementById('endOverlay'),
  endTitle: document.getElementById('endTitle'),
  endText: document.getElementById('endText'),
  restartBtn: document.getElementById('restartBtn')
};

const state = {
  playerIntegrity: MAX_INTEGRITY,
  enemyIntegrity: MAX_INTEGRITY,
  ammo: [],
  round: 0,
  turn: 'player',
  running: false,
  locked: true,
  briefingToken: 0
};

let audioCtx = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function remainingStats() {
  let live = 0;
  let blank = 0;
  for (const shell of state.ammo) {
    if (shell === 'live') live += 1;
    else blank += 1;
  }
  return { total: state.ammo.length, live, blank };
}

function generateAmmo() {
  const total = MIN_SHELLS + Math.floor(Math.random() * (MAX_SHELLS - MIN_SHELLS + 1));
  const maxLive = Math.min(total - 1, Math.ceil(total / 2) + 1);
  const live = 1 + Math.floor(Math.random() * maxLive);
  const blank = total - live;
  const correctedLive = blank === 0 ? live - 1 : live;
  const correctedBlank = total - correctedLive;

  const ammo = [
    ...Array(correctedLive).fill('live'),
    ...Array(correctedBlank).fill('blank')
  ];

  return shuffle(ammo);
}

function setSubtitle(text) {
  els.subtitle.textContent = text;
}

function setLocked(locked) {
  state.locked = locked;
  els.actionPanel.classList.toggle('locked', locked);
  els.shootSelfBtn.disabled = locked;
  els.shootEnemyBtn.disabled = locked;
}

function renderIntegrity(container, value) {
  container.innerHTML = '';
  for (let i = 0; i < MAX_INTEGRITY; i += 1) {
    const pip = document.createElement('span');
    pip.className = `integrity-pip ${i < value ? 'active' : 'destroyed'}`;
    container.appendChild(pip);
  }
}

function updateRobotDamage() {
  const damage = MAX_INTEGRITY - state.enemyIntegrity;
  els.enemyRobot.classList.remove('damage-1', 'damage-2', 'destroyed');
  if (state.enemyIntegrity <= 0) {
    els.enemyRobot.classList.add('destroyed');
  } else if (damage >= 2) {
    els.enemyRobot.classList.add('damage-2');
  } else if (damage >= 1) {
    els.enemyRobot.classList.add('damage-1');
  }
}

function renderHud() {
  renderIntegrity(els.playerIntegrity, state.playerIntegrity);
  renderIntegrity(els.enemyIntegrity, state.enemyIntegrity);
  updateRobotDamage();
  els.roundNumber.textContent = String(Math.max(1, state.round)).padStart(2, '0');
  els.remainingCount.textContent = state.ammo.length;
  els.turnLabel.textContent = state.turn === 'player' ? 'YOU' : 'UNIT 07';
}

function renderShellTray(stats) {
  els.shellTray.innerHTML = '';
  const visible = [
    ...Array(stats.live).fill('live'),
    ...Array(stats.blank).fill('blank')
  ];

  for (const type of visible) {
    const shell = document.createElement('span');
    shell.className = `shell ${type}`;
    shell.title = type === 'live' ? '실탄' : '공포탄';
    els.shellTray.appendChild(shell);
  }
}

async function showTurnBriefing(isNewRound = false) {
  const token = ++state.briefingToken;
  const stats = remainingStats();

  els.startBtn.style.display = 'none';
  els.briefingEyebrow.textContent = isNewRound
    ? `CHAMBER ${String(state.round).padStart(2, '0')} // LOAD REPORT`
    : `${state.turn === 'player' ? 'REMOTE AVATAR' : 'HOUSE UNIT'} // TURN REPORT`;
  els.briefingTitle.textContent = `${stats.total}발`;
  els.briefingText.textContent = `실탄 ${stats.live}발. 공포탄 ${stats.blank}발.`;
  els.briefTotal.textContent = stats.total;
  els.briefLive.textContent = stats.live;
  els.briefBlank.textContent = stats.blank;
  renderShellTray(stats);
  els.briefingOverlay.classList.add('visible');

  setSubtitle(`총 ${stats.total}발. 실탄 ${stats.live}발. 공포탄 ${stats.blank}발.`);
  await sleep(isNewRound ? 1900 : 1350);

  if (token !== state.briefingToken || !state.running) return false;
  els.briefingOverlay.classList.remove('visible');
  await sleep(230);
  return true;
}

async function newRound() {
  if (!state.running) return;
  setLocked(true);
  state.round += 1;
  state.ammo = generateAmmo();
  state.turn = 'player';
  renderHud();

  setSubtitle('장전 시퀀스 확인 중...');
  const ok = await showTurnBriefing(true);
  if (!ok || !state.running) return;
  beginTurn();
}

async function beginTurn() {
  if (!state.running) return;

  if (state.ammo.length === 0) {
    setSubtitle('탄환 소진. 새 장전을 준비한다.');
    setLocked(true);
    await sleep(900);
    if (state.running) newRound();
    return;
  }

  setLocked(true);
  renderHud();
  const ok = await showTurnBriefing(false);
  if (!ok || !state.running) return;

  renderHud();
  if (state.turn === 'player') {
    setSubtitle('선택해. 어느 기체에 발사하지?');
    setLocked(false);
  } else {
    setSubtitle('UNIT 07이 계산 중이다...');
    await sleep(700 + Math.random() * 650);
    if (!state.running) return;
    aiTurn();
  }
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}

function createNoiseBuffer(duration = 0.5) {
  if (!audioCtx) return null;
  const length = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playMechanicalClick() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(155, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 0.045);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

function playMetalTing(delay = 0.16) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime + delay;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
  gain.connect(audioCtx.destination);

  [1320, 1890, 2480].forEach((frequency, index) => {
    const osc = audioCtx.createOscillator();
    osc.type = index === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.86, now + 0.65);
    const partialGain = audioCtx.createGain();
    partialGain.gain.value = index === 0 ? 0.75 : 0.25;
    osc.connect(partialGain).connect(gain);
    osc.start(now);
    osc.stop(now + 0.75);
  });
}

function playBlankSound() {
  ensureAudio();
  playMechanicalClick();
  playMetalTing(0.17);
}

function playLiveSound() {
  ensureAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const noise = audioCtx.createBufferSource();
  noise.buffer = createNoiseBuffer(0.48);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(5200, now);
  filter.frequency.exponentialRampToValueAtTime(550, now + 0.42);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.42, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + 0.5);

  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(105, now);
  thump.frequency.exponentialRampToValueAtTime(42, now + 0.23);
  thumpGain.gain.setValueAtTime(0.26, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
  thump.connect(thumpGain).connect(audioCtx.destination);
  thump.start(now);
  thump.stop(now + 0.28);

  const ring = audioCtx.createOscillator();
  const ringGain = audioCtx.createGain();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(720, now + 0.015);
  ring.frequency.exponentialRampToValueAtTime(390, now + 0.38);
  ringGain.gain.setValueAtTime(0.055, now + 0.015);
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  ring.connect(ringGain).connect(audioCtx.destination);
  ring.start(now + 0.015);
  ring.stop(now + 0.43);
}

function animateShot(isLive, target) {
  els.shotgun.classList.remove('recoil');
  void els.shotgun.offsetWidth;
  els.shotgun.classList.add('recoil');
  setTimeout(() => els.shotgun.classList.remove('recoil'), 160);

  if (isLive) {
    els.muzzleFlash.classList.remove('fire');
    void els.muzzleFlash.offsetWidth;
    els.muzzleFlash.classList.add('fire');

    els.shell.classList.remove('shake');
    void els.shell.offsetWidth;
    els.shell.classList.add('shake');
    setTimeout(() => els.shell.classList.remove('shake'), 280);

    if (target === 'enemy') {
      els.sparks.classList.remove('active');
      void els.sparks.offsetWidth;
      els.sparks.classList.add('active');
    } else {
      els.playerHitFlash.classList.remove('active');
      void els.playerHitFlash.offsetWidth;
      els.playerHitFlash.classList.add('active');
    }
  }
}

async function shoot(shooter, target) {
  if (!state.running || state.ammo.length === 0) return;
  if (shooter === 'player' && (state.turn !== 'player' || state.locked)) return;
  if (shooter === 'ai' && state.turn !== 'ai') return;

  setLocked(true);
  ensureAudio();

  const shell = state.ammo.shift();
  const isLive = shell === 'live';
  const targetName = target === 'player' ? 'REMOTE AVATAR' : 'UNIT 07';

  setSubtitle(`${targetName} 조준.`);
  await sleep(380);

  animateShot(isLive, target === 'player' ? 'player' : 'enemy');

  if (isLive) {
    playLiveSound();
    setSubtitle('타앙—! 실탄이다.');

    if (target === 'player') {
      state.playerIntegrity -= 1;
    } else {
      state.enemyIntegrity -= 1;
    }

    renderHud();
    await sleep(1050);
  } else {
    playBlankSound();
    setSubtitle('찰칵.  티잉—  공포탄이다.');
    renderHud();
    await sleep(1050);
  }

  if (state.playerIntegrity <= 0 || state.enemyIntegrity <= 0) {
    endGame(state.enemyIntegrity <= 0 ? 'win' : 'lose');
    return;
  }

  if (state.ammo.length === 0) {
    setSubtitle('탄환 소진. 새 장전을 준비한다.');
    await sleep(850);
    if (state.running) newRound();
    return;
  }

  const selfTarget = (shooter === 'player' && target === 'player') || (shooter === 'ai' && target === 'enemy');
  const extraTurn = !isLive && selfTarget;

  if (extraTurn) {
    setSubtitle(`${shooter === 'player' ? '공포탄. 추가 행동을 획득했다.' : 'UNIT 07이 추가 행동을 확보했다.'}`);
  } else {
    state.turn = shooter === 'player' ? 'ai' : 'player';
  }

  renderHud();
  await sleep(620);
  if (state.running) beginTurn();
}

function aiTurn() {
  if (!state.running || state.turn !== 'ai' || state.ammo.length === 0) return;

  const stats = remainingStats();
  const blankChance = stats.blank / stats.total;
  let chooseSelf = false;

  if (blankChance >= 0.75) {
    chooseSelf = Math.random() < 0.88;
  } else if (blankChance >= 0.6) {
    chooseSelf = Math.random() < 0.68;
  } else if (blankChance >= 0.5) {
    chooseSelf = Math.random() < 0.42;
  } else {
    chooseSelf = Math.random() < 0.08;
  }

  if (chooseSelf) {
    setSubtitle('UNIT 07이 자기 기체를 겨눈다.');
    shoot('ai', 'enemy');
  } else {
    setSubtitle('UNIT 07이 네 기체를 겨눈다.');
    shoot('ai', 'player');
  }
}

function endGame(result) {
  state.running = false;
  state.briefingToken += 1;
  setLocked(true);
  els.briefingOverlay.classList.remove('visible');

  if (result === 'win') {
    els.endTitle.textContent = 'HOUSE UNIT OFFLINE';
    els.endText.textContent = `상대 기체가 정지했다. ${state.round}번째 챔버에서 세션 승리.`;
    setSubtitle('상대 기체 정지. 세션 승리.');
  } else {
    els.endTitle.textContent = 'REMOTE AVATAR OFFLINE';
    els.endText.textContent = `원격 아바타 연결이 끊겼다. ${state.round}번째 챔버에서 세션 종료.`;
    setSubtitle('기체 파손. 원격 접속 종료.');
  }

  setTimeout(() => els.endOverlay.classList.add('visible'), 350);
}

function resetGame() {
  state.playerIntegrity = MAX_INTEGRITY;
  state.enemyIntegrity = MAX_INTEGRITY;
  state.ammo = [];
  state.round = 0;
  state.turn = 'player';
  state.running = true;
  state.locked = true;
  state.briefingToken += 1;

  els.endOverlay.classList.remove('visible');
  els.enemyRobot.classList.remove('damage-1', 'damage-2', 'destroyed');
  renderHud();
  setSubtitle('원격 아바타 연결 완료.');
  newRound();
}

els.shootSelfBtn.addEventListener('click', () => shoot('player', 'player'));
els.shootEnemyBtn.addEventListener('click', () => shoot('player', 'enemy'));

els.startBtn.addEventListener('click', () => {
  ensureAudio();
  els.briefingOverlay.classList.remove('visible');
  els.startBtn.style.display = 'none';
  setTimeout(resetGame, 240);
});

els.restartBtn.addEventListener('click', () => {
  ensureAudio();
  resetGame();
});

window.addEventListener('keydown', event => {
  if (!state.running || state.turn !== 'player' || state.locked) return;
  if (event.key === '1') shoot('player', 'player');
  if (event.key === '2') shoot('player', 'enemy');
});

renderHud();
setLocked(true);
