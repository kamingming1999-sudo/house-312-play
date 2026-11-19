// A deterministic cue scheduler. This module knows nothing about audio, rendering,
// storage or round transitions; the caller decides how to present each cue.
const MIN_GAP = 2;
const WARNING_BEATS = [
  { at: 2, type: 'whisper', intensity: .38, message: ['YOU HEARD THAT.', 'KEEP WATCHING.'] },
  { at: 5, type: 'knock', intensity: .58, message: ['SOMEONE IS HERE.', 'LEAVE IT ALONE.'] },
  { at: 8, type: 'whisper', intensity: .76, message: ['IT IS BEHIND YOU.', 'DO NOT TURN AROUND.'], stalker: true },
];
const MESSAGES = [
  ['YOU ARE STILL HERE.', 'SO IS IT.'],
  ['THAT WAS NOT THE HOUSE.', 'LISTEN AGAIN.'],
  ['DO NOT CHECK THE WINDOW.', 'IT CAN SEE YOU.'],
  ['THE DOOR WAS CLOSED.', 'WASN\'T IT?'],
];
const TYPES = ['knock', 'breath', 'scrape', 'whisper', 'static'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function normalizeSeed(seed) {
  return Number.isFinite(seed) ? (Math.trunc(seed) >>> 0) || 312 : 312;
}
function random(dread) {
  let value = dread.rng;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  dread.rng = value >>> 0;
  return dread.rng / 4294967296;
}
function empty() {
  return { events: [], tension: 0, disturbance: 0, tvMessage: null, stalker: null };
}
function clearVisuals(dread) {
  dread.disturbance = 0; dread.disturbanceUntil = 0;
  dread.message = null; dread.messageUntil = 0; dread.stalker = null;
}

export function createDread(seed = 312) {
  const normalized = normalizeSeed(seed);
  return {
    seed: normalized, rng: normalized, time: 0, mode: null, sequence: 0,
    nextEventAt: 0, lastEventAt: -Infinity, lastType: null,
    nextStalkerAt: 25, warningActive: false, warningElapsed: 0, warningBeat: 0,
    tension: 0, disturbance: 0, disturbanceUntil: 0, disturbanceStrength: 0,
    message: null, messageUntil: 0, stalker: null,
  };
}

export function resetDread(dread, seed = dread.seed) {
  Object.assign(dread, createDread(seed));
  return dread;
}

function appear(dread, reducedMotion) {
  const kind = dread.mode === 'hall' ? 'hall' : 'window';
  const duration = 1.7 + random(dread) * .7;
  if (reducedMotion) return;
  dread.stalker = {
    id: `${dread.seed}:${dread.sequence}:figure`, kind,
    x: kind === 'hall' ? 0 : -2.7, z: kind === 'hall' ? 8.65 : -4.15,
    duration, until: dread.time + duration,
  };
}

function emit(dread, type, intensity, message, reducedMotion, events) {
  dread.sequence += 1;
  const event = {
    id: `${dread.seed}:${dread.sequence}`, type, intensity,
    pan: (random(dread) * 2 - 1) * .85, at: dread.time,
  };
  events.push(event);
  dread.lastEventAt = dread.time; dread.lastType = type;
  dread.disturbanceUntil = dread.time + 1.05;
  dread.disturbanceStrength = .12 + intensity * .45;
  if (message) { dread.message = message; dread.messageUntil = dread.time + 2.5; }
  if (type === 'stalker') appear(dread, reducedMotion);
}

/**
 * Advance active play by at most .1 seconds. Call once per frame after the round
 * update. warningTime/time may be supplied from the round, but local active time
 * owns scheduling so pauses, hidden tabs and large deltas cannot replay a backlog.
 * Only explore and an explicitly chosen deep hall receive cues. No round fields
 * are written. Reduced motion keeps audio cues but omits disturbance and figures.
 * A stalker event is an audio cue; only the returned stalker field requests art.
 */
export function updateDread(dread, dt, context = {}) {
  const { phase, warningStarted = false, deep = false, paused = false, reducedMotion = false } = context;
  if (paused) return empty();
  const mode = phase === 'explore' ? 'explore' : phase === 'hall' && deep ? 'hall' : null;
  if (!mode) {
    dread.mode = null; dread.tension = 0; clearVisuals(dread);
    return empty();
  }
  const step = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
  if (dread.mode !== mode) {
    dread.mode = mode; clearVisuals(dread);
    dread.nextEventAt = dread.time + 3 + random(dread) * .7;
    dread.nextStalkerAt = Math.max(25, dread.time + 5 + random(dread) * 4);
    dread.warningActive = false; dread.warningElapsed = 0; dread.warningBeat = 0;
  }
  dread.time += step;
  const warning = mode === 'explore' && warningStarted;
  if (warning && !dread.warningActive) {
    dread.warningActive = true; dread.warningElapsed = 0; dread.warningBeat = 0;
  } else if (!warning && dread.warningActive) {
    dread.warningActive = false; dread.warningElapsed = 0; dread.warningBeat = 0;
    dread.nextEventAt = dread.time + 3 + random(dread) * .7;
  }
  if (warning) dread.warningElapsed += step;

  const events = [];
  const ready = step > 0 && dread.time - dread.lastEventAt >= MIN_GAP - 1e-9;
  if (warning) {
    const beat = WARNING_BEATS[dread.warningBeat];
    if (ready && beat && dread.warningElapsed >= beat.at - 1e-9) {
      emit(dread, beat.type, beat.intensity, beat.message, reducedMotion, events);
      if (beat.stalker) appear(dread, reducedMotion);
      dread.warningBeat += 1;
    }
  } else if (ready && dread.time >= dread.nextEventAt - 1e-9) {
    let type;
    if (dread.time >= dread.nextStalkerAt) {
      type = 'stalker'; dread.nextStalkerAt = dread.time + 18 + random(dread) * 12;
    } else {
      const choices = TYPES.filter(candidate => candidate !== dread.lastType);
      type = choices[Math.floor(random(dread) * choices.length)];
    }
    const intensity = (mode === 'hall' ? .48 : .28) + random(dread) * .25;
    const message = type === 'whisper' || type === 'static' || type === 'stalker'
      ? MESSAGES[Math.floor(random(dread) * MESSAGES.length)] : null;
    emit(dread, type, intensity, message, reducedMotion, events);
    dread.nextEventAt = dread.time + (mode === 'hall' ? 2.4 : 3.2) + random(dread) * (mode === 'hall' ? 2 : 3);
  }

  const targetTension = warning ? .35 + .6 * clamp(dread.warningElapsed / 10, 0, 1)
    : mode === 'hall' ? .74 : .18 + Math.min(.34, dread.time / 90);
  dread.tension += (targetTension - dread.tension) * (1 - Math.exp(-step * 2));
  const targetDisturbance = dread.time < dread.disturbanceUntil ? dread.disturbanceStrength : 0;
  dread.disturbance += (targetDisturbance - dread.disturbance) * (1 - Math.exp(-step * 3));
  if (dread.time >= dread.messageUntil) dread.message = null;
  if (dread.stalker && dread.time >= dread.stalker.until) dread.stalker = null;
  if (reducedMotion) dread.stalker = null;
  const stalker = dread.stalker && {
    id: dread.stalker.id, kind: dread.stalker.kind, x: dread.stalker.x, z: dread.stalker.z,
    duration: dread.stalker.duration, remaining: Math.max(0, dread.stalker.until - dread.time),
  };
  return {
    events, tension: clamp(dread.tension, 0, 1),
    disturbance: reducedMotion ? 0 : clamp(dread.disturbance, 0, 1),
    tvMessage: dread.message ? [...dread.message] : null, stalker: stalker || null,
  };
}
