const film = document.getElementById('film');
const play = document.getElementById('play');
const status = document.getElementById('status');
const lookBehind = document.getElementById('lookBehind');
const outcome = document.getElementById('outcome');
const outcomeTitle = document.getElementById('outcomeTitle');
const outcomeCopy = document.getElementById('outcomeCopy');
const moreHorror = document.getElementById('moreHorror');
const behindView = document.getElementById('behindView');
const behindTitle = document.getElementById('behindTitle');
const branchFilm = document.getElementById('branchFilm');
const branchStatus = document.getElementById('branchStatus');
const branchSave = document.getElementById('branchSave');
const backToTV = document.getElementById('backToTV');
let route = 'opening';
let branchRequest = 0;

function updateLookButton() {
  lookBehind.hidden = route !== 'opening' || film.currentTime < 3 || film.ended;
}

function clearChoice() {
  route = 'opening';
  outcome.hidden = true;
  moreHorror.hidden = true;
  lookBehind.hidden = true;
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
    status.textContent = 'You stayed facing the TV. Continue when you are ready.';
  } else {
    play.focus();
    status.textContent = 'Press Try again to make another choice.';
  }
}

function closeBranch() {
  if (typeof behindView.close === 'function') behindView.close();
  else {
    behindView.removeAttribute('open');
    stopBranch();
  }
}

function launchBranch(kind) {
  const isLook = kind === 'look';
  const request = ++branchRequest;
  behindTitle.textContent = isLook ? 'You looked.' : 'The next room';
  branchFilm.poster = isLook ? 'assets/easter-egg-room.png' : 'assets/realistic-warning.png';
  branchFilm.src = isLook ? 'assets/photo-fakeout-scare.mp4' : 'assets/dont-look-behind-encounter-10s.mp4';
  branchFilm.muted = film.muted;
  branchFilm.volume = film.volume;
  branchFilm.load();
  branchSave.href = isLook ? 'assets/dont-look-behind-fakeout-10s.mp4' : 'assets/dont-look-behind-encounter-10s.mp4';
  branchSave.download = isLook ? 'room-312-fakeout-10s.mp4' : 'room-312-encounter-10s.mp4';
  branchStatus.textContent = 'Loading the scene…';
  if (typeof behindView.showModal === 'function') behindView.showModal();
  else behindView.setAttribute('open', '');
  branchFilm.play().catch(() => {
    if (request === branchRequest && behindView.open) {
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
  status.textContent = 'Playing. Stay facing the TV, or choose where to look.';
  updateLookButton();
});
film.addEventListener('pause', () => {
  if (route === 'opening') {
    play.textContent = film.ended ? 'Replay opening' : 'Continue playing';
    status.textContent = film.ended ? 'The opening has ended.' : 'Paused. Continue when you are ready.';
  }
});
film.addEventListener('timeupdate', updateLookButton);
film.addEventListener('seeked', updateLookButton);
film.addEventListener('ended', () => {
  lookBehind.hidden = true;
  if (route !== 'opening') return;
  route = 'resisted';
  outcomeTitle.textContent = 'You stayed facing the TV.';
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

lookBehind.addEventListener('click', () => {
  if (route !== 'opening' || film.currentTime < 3 || film.ended) return;
  route = 'looked';
  film.pause();
  lookBehind.hidden = true;
  moreHorror.hidden = true;
  outcomeTitle.textContent = 'You looked behind.';
  outcomeCopy.textContent = 'Try again to make another choice.';
  outcome.hidden = false;
  play.textContent = 'Try again';
  status.textContent = 'You turned away from the TV.';
  launchBranch('look');
});
moreHorror.addEventListener('click', () => {
  if (route === 'resisted') launchBranch('more');
});
backToTV.addEventListener('click', closeBranch);
behindView.addEventListener('close', stopBranch);
branchFilm.addEventListener('play', () => { branchStatus.textContent = 'Playing the scene.'; });
branchFilm.addEventListener('pause', () => {
  if (behindView.open && !branchFilm.ended) branchStatus.textContent = 'Paused. Press Play to continue.';
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
    if (request === branchRequest && behindView.open) branchStatus.textContent = 'Press Play inside the video to replay.';
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
