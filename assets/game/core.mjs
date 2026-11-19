export const COUNT_KEY = 'room312.forbiddenButtonPresses.v1';
export const TIMING = { decision: 10, photo: 1.4, lunge: 0.7, revealHold: 1.0, previewHold: 2.4, blackout: 0.85 };
export const TV_SCREEN = { width: 1.34, height: .98, x: -.63, y: 1.47, z: -3.14 };
export const TV_BUTTON = { canvasWidth: 640, canvasHeight: 480, x: 320, y: 330, radius: 78, hitRadius: 84 };
export const OBSTACLES = [
  { name: 'TV cabinet', minX: -1.8, maxX: .8, minZ: -4.05, maxZ: -2.95 },
  { name: 'lamp stand', minX: 1.11, maxX: 1.59, minZ: -3.775, maxZ: -3.325 },
  { name: 'fireplace', minX: -4.15, maxX: -3.15, minZ: -1.4, maxZ: 1.4 },
  { name: 'sofa', minX: -3.65, maxX: -1.25, minZ: 1.4, maxZ: 2.5 },
  { name: 'coffee table', minX: -1.75, maxX: -.25, minZ: -.2, maxZ: .7 },
  { name: 'armchair', minX: 2.2, maxX: 3.5, minZ: -.9, maxZ: .5 },
  { name: 'stair balustrade', minX: 2.18, maxX: 2.30, minZ: 1.16, maxZ: 4.41 },
  { name: 'loft door leaf',minX:2.37,maxX:2.55,minZ:4.52,maxZ:5.53 },
  { name: 'attic trunk',minX:3.47,maxX:4.15,minZ:5.99,maxZ:6.43 },
  { name: 'kitchen sink', minX: -4.08, maxX: -3.28, minZ: 6.05, maxZ: 8.65 },
  { name: 'refrigerator', minX: -2, maxX: -1.16, minZ: 8.2, maxZ: 8.93 },
];

export function readPresses(storage) {
  try {
    const count = Number(storage.getItem(COUNT_KEY));
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
  } catch { return 0; }
}
export function savePresses(storage, count) {
  try { storage.setItem(COUNT_KEY, String(count)); } catch { /* The current round still works. */ }
}
export function createRound(presses = 0) {
  return { phase: 'intro', time: 0, warningTime: 0, warningStarted: false, preview: false, phaseTime: 0, presses, roundPressed: false,
    doorUnlocked: false, doorOpen: false, deep: false, scareContext: 'button' };
}
export function startRound(state) {
  Object.assign(state, createRound(state.presses), { phase: 'explore' });
}
export function startWarning(state) {
  if (state.phase !== 'explore' || state.warningStarted) return false;
  state.warningStarted = true; state.warningTime = 0; return true;
}
export function startScarePreview(state) {
  Object.assign(state, createRound(state.presses), { phase: 'fakeout', preview: true, warningStarted: true });
}
export function pressButton(state) {
  if (state.phase !== 'explore') return false;
  state.presses = Math.min(Number.MAX_SAFE_INTEGER, state.presses + 1);
  state.roundPressed = true; state.warningStarted = true;
  state.phase = 'fakeout'; state.phaseTime = 0; state.scareContext = 'button';
  return true;
}
export function advance(state, seconds) {
  const dt = Math.max(0, Math.min(seconds, .1));
  state.time += dt; state.phaseTime += dt;
  if (state.phase === 'explore' && state.warningStarted) state.warningTime += dt;
  if (state.phase === 'explore' && state.warningTime >= TIMING.decision) {
    state.phase = 'choice'; state.phaseTime = 0;
  } else if (state.phase === 'fakeout' && state.phaseTime >= TIMING.photo) {
    state.phase = 'lunge'; state.phaseTime = 0;
  } else if (state.phase === 'lunge' && state.phaseTime >= TIMING.lunge) {
    state.phase = 'scareHold'; state.phaseTime = 0;
  } else if (state.phase === 'scareHold' && state.phaseTime >= (state.preview ? TIMING.previewHold : TIMING.revealHold)) {
    state.phase = 'blackout'; state.phaseTime = 0;
  } else if (state.phase === 'blackout' && state.phaseTime >= TIMING.blackout) {
    state.phase = state.preview ? 'previewEnd' : state.scareContext === 'hall' ? 'ending' : 'aftermath';
    state.phaseTime = 0;
  }
  return state.phase;
}
export function chooseHall(state, deeper) {
  if (!['choice', 'aftermath'].includes(state.phase)) return false;
  state.phase = 'hall'; state.phaseTime = 0;
  state.deep = Boolean(deeper); state.doorUnlocked = true;
  return true;
}
export function openDoor(state) {
  if (!state.doorUnlocked || state.phase !== 'hall') return false;
  state.doorOpen = true; return true;
}
export function checkHall(state, z) {
  if (state.phase !== 'hall' || !state.doorOpen || !Number.isFinite(z)) return;
  if (z > 4.95) { state.phase = 'hallway'; state.phaseTime = 0; }
}

export function canStand(x, z, doorOpen, radius = .22) {
  const inRoom = x >= -4.15 + radius && x <= 4.15 - radius && z >= -4.4 + radius && z <= 4.4 - radius;
  const inHall = Math.abs(x) <= .88 - radius && z >= 4.05 && z <= 11.55 - radius;
  const inKitchen = x >= -4.15 + radius && x <= -1.04 - radius && z >= 5.8 + radius && z <= 8.95 - radius;
  // Join the kitchen and hall only through the visible 1.6 m opening.
  const kitchenOpening = x >= -1.2 - radius && x <= -.6 + radius && z >= 6.3 + radius && z <= 7.9 - radius;
  const inAttic=x>=2.32+radius&&x<=4.15-radius&&z>=3.70&&z<=6.31-radius;
  if (!inAttic && !inRoom && !inHall && !inKitchen && !kitchenOpening) return false;
  if (!inAttic && z > 4.33 - radius && z < 4.53 + radius && Math.abs(x) > .76 - radius) return false;
  if (!inAttic && !doorOpen && z > 4.395 - radius && z < 4.505 + radius) return false;
  return !OBSTACLES.some(o => x > o.minX - radius && x < o.maxX + radius && z > o.minZ - radius && z < o.maxZ + radius);
}
export function movePlayer(position, dx, dz, doorOpen) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .1));
  for (let i = 0; i < steps; i += 1) {
    if (canStand(position.x + dx / steps, position.z, doorOpen)) position.x += dx / steps;
    if (canStand(position.x, position.z + dz / steps, doorOpen)) position.z += dz / steps;
  }
  return position;
}
export function angleToward(current, target, amount) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * Math.min(1, Math.max(0, amount));
}
export function joystickVector(dx, dy, radius = 48) {
  const distance = Math.hypot(dx, dy);
  if (distance < radius * .12) return { x: 0, y: 0 };
  const strength = Math.min(1, distance / radius);
  return { x: dx / distance * strength, y: dy / distance * strength };
}
export function scareEndDistance(aspect, verticalFov = 62) {
  // The .8 × 1.2 photographic rig's face spans U .18–.82 and V .045–.565,
  // centered at anchorV .305. Reserve clearance for its curved surface, tiny
  // breathing pose and up to .055 radians of camera tilt. Hands may crop.
  const halfFov = verticalFov * Math.PI / 360;
  const margin = .9, tangent = Math.tan(halfFov);
  const horizontal = .26 / (tangent * Math.max(.25, aspect) * margin);
  const vertical = .321 / Math.max(.1, tangent * margin - Math.tan(.055));
  return .09 + Math.max(horizontal, vertical);
}
export function lungeProgress(progress) {
  const drive = Math.max(0, Math.min(1, (progress - .20) / .80));
  return drive * drive;
}
