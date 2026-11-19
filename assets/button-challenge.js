const film = document.getElementById('film');
const play = document.getElementById('play');
const status = document.getElementById('status');
const forbiddenButton = document.getElementById('forbiddenButton');
const outcome = document.getElementById('outcome');
const outcomeTitle = document.getElementById('outcomeTitle');
const outcomeCopy = document.getElementById('outcomeCopy');
const moreHorror = document.getElementById('moreHorror');
const buttonReveal = document.getElementById('buttonReveal');
const revealTitle = document.getElementById('revealTitle');
const branchFilm = document.getElementById('branchFilm');
const branchStatus = document.getElementById('branchStatus');
const branchSave = document.getElementById('branchSave');
const backToTV = document.getElementById('backToTV');
const pressCount = document.getElementById('pressCount');
const branchPressCount = document.getElementById('branchPressCount');
const countKey = 'room312.forbiddenButtonPresses.v1';
function storedPresses() {
  try {
    const value = Number(localStorage.getItem(countKey));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}
let presses = storedPresses();
function renderPressCount() {
  const value = presses.toLocaleString();
  pressCount.textContent = value;
  branchPressCount.textContent = value;
}
function countPress() {
  presses = Math.min(Number.MAX_SAFE_INTEGER, Math.max(presses, storedPresses()) + 1);
  try { localStorage.setItem(countKey, String(presses)); } catch { /* This visit still counts. */ }
  renderPressCount();
}
renderPressCount();
window.addEventListener('storage', event => {
  if (event.key === countKey) {
    presses = storedPresses();
    renderPressCount();
  }
});
let route = 'opening';
let branchRequest = 0;

function updateForbiddenButton() {
  forbiddenButton.hidden = route !== 'opening' || film.currentTime < 3 || film.ended;
}

function clearChoice() {
  route = 'opening';
  outcome.hidden = true;
  moreHorror.hidden = true;
  forbiddenButton.hidden = true;
  play.textContent = 'Play the scene';
}

async function startOpening() {
  if (route !== 'opening' || film.ended) {
    clearChoice();
    film.currentTime = 0;
  }
  try {
    await film.play();
  } catch {
    status.textContent = 'Press the play control inside the video to start.';
  }
}

function stopBranch() {
  branchRequest += 1;
  branchFilm.pause();
  branchFilm.currentTime = 0;
  if (route === 'resisted') {
    moreHorror.focus();
    status.textContent = 'You left the button alone. Continue when you are ready.';
  } else {
    play.focus();
    status.textContent = 'Press Try again to make another choice.';
  }
}

function closeBranch() {
  if (typeof buttonReveal.close === 'function') buttonReveal.close();
  else {
    buttonReveal.removeAttribute('open');
    stopBranch();
  }
}

function launchBranch(kind) {
  const isPress = kind === 'press';
  const request = ++branchRequest;
  revealTitle.textContent = isPress ? 'You pressed it.' : 'The next room';
  branchFilm.poster = isPress ? 'assets/easter-egg-room.png' : 'assets/button-warning.png';
  branchFilm.src = isPress ? 'assets/photo-fakeout-scare.mp4' : 'assets/dont-press-the-button-encounter-10s.mp4';
  branchFilm.muted = film.muted;
  branchFilm.volume = film.volume;
  branchFilm.load();
  branchSave.href = isPress ? 'assets/dont-press-the-button-fakeout-10s.mp4' : 'assets/dont-press-the-button-encounter-10s.mp4';
  branchSave.download = isPress ? 'dont-press-the-button-fakeout-10s.mp4' : 'dont-press-the-button-encounter-10s.mp4';
  branchStatus.textContent = 'Loading the scene…';
  if (typeof buttonReveal.showModal === 'function') buttonReveal.showModal();
  else buttonReveal.setAttribute('open', '');
  branchFilm.play().catch(() => {
    if (request === branchRequest && buttonReveal.open) {
      branchStatus.textContent = 'Press Play inside the video to continue.';
    }
  });
}

play.addEventListener('click', () => {
  if (route !== 'opening' || film.paused) startOpening();
  else film.pause();
});
film.addEventListener('play', () => {
  // A replay from the native controls also starts a fresh choice.
  if (route !== 'opening') {
    clearChoice();
    film.currentTime = 0;
  }
  play.textContent = 'Pause';
  status.textContent = "Playing. Don't press the button.";
  updateForbiddenButton();
});
film.addEventListener('pause', () => {
  if (route === 'opening') {
    play.textContent = film.ended ? 'Replay opening' : 'Continue playing';
    status.textContent = film.ended ? 'The opening has ended.' : 'Paused. Continue when you are ready.';
  }
});
film.addEventListener('timeupdate', updateForbiddenButton);
film.addEventListener('seeked', updateForbiddenButton);
film.addEventListener('ended', () => {
  forbiddenButton.hidden = true;
  if (route !== 'opening') return;
  route = 'resisted';
  outcomeTitle.textContent = 'You left the button alone.';
  outcomeCopy.textContent = 'Ready to go further?';
  outcome.hidden = false;
  moreHorror.hidden = false;
  play.textContent = 'Replay opening';
  status.textContent = 'The opening is over. Choose whether to continue.';
  moreHorror.focus();
});
film.addEventListener('error', () => {
  status.textContent = 'Use Save opening to watch in your video player.';
  status.classList.add('error');
});

forbiddenButton.addEventListener('click', () => {
  if (route !== 'opening' || film.currentTime < 3 || film.ended) return;
  route = 'pressed';
  countPress();
  film.pause();
  forbiddenButton.hidden = true;
  moreHorror.hidden = true;
  outcomeTitle.textContent = 'You pressed the button.';
  outcomeCopy.textContent = 'Try again to make another choice.';
  outcome.hidden = false;
  play.textContent = 'Try again';
  status.textContent = 'The button has been pressed.';
  launchBranch('press');
});
moreHorror.addEventListener('click', () => {
  if (route === 'resisted') launchBranch('more');
});
backToTV.addEventListener('click', closeBranch);
buttonReveal.addEventListener('close', stopBranch);
branchFilm.addEventListener('play', () => { branchStatus.textContent = 'Playing the scene.'; });
branchFilm.addEventListener('pause', () => {
  if (buttonReveal.open && !branchFilm.ended) branchStatus.textContent = 'Paused. Press Play to continue.';
});
branchFilm.addEventListener('ended', () => {
  branchStatus.textContent = 'The scene has ended. Replay or return to the TV.';
});
branchFilm.addEventListener('error', () => {
  branchStatus.textContent = 'Use Save this cut to watch in your video player.';
});
document.getElementById('replayBranch').addEventListener('click', () => {
  const request = ++branchRequest;
  branchFilm.currentTime = 0;
  branchFilm.play().catch(() => {
    if (request === branchRequest && buttonReveal.open) branchStatus.textContent = 'Press Play inside the video to replay.';
  });
});
document.getElementById('fullscreen').addEventListener('click', async () => {
  try {
    if (film.parentElement.requestFullscreen) await film.parentElement.requestFullscreen();
    else if (film.webkitEnterFullscreen) film.webkitEnterFullscreen();
  } catch {
    status.textContent = 'Use the full-screen icon inside the video controls.';
  }
});
