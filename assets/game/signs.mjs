// Original optional house investigation. No audio, scene, DOM or Keeper rules.
const ANSWER_AT = 3.2, ANSWER_END = 6.5, REQUEST_INTERVAL = 12, EPSILON = 1e-9;
const RESPONSES = [
  {
    id: 'knocks', type: 'knock', pan: .68, intensity: .42,
    message: 'Three knocks answer from the stairs.',
    tvMessage: ['THREE KNOCKS ANSWERED.', 'FROM THE STAIRS.'],
    evidence: { id: 'knocks', label: 'Staircase knocks', detail: 'Three knocks answered the request from the upstairs corner.' },
  },
  {
    id: 'movement', type: 'scrape', pan: -.7, intensity: .46,
    message: 'A scrape answers from the kitchen.',
    tvMessage: ['A SCRAPE IN THE KITCHEN.', 'THE HOUSE ANSWERED.'],
    // The audible response remains accurate when reduced motion omits movement.
    evidence: { id: 'movement', label: 'Kitchen scrape', detail: 'A brief scrape answered the request near the kitchen cupboard.' },
  },
  {
    id: 'voice', type: 'voice', pan: -.18, intensity: .4,
    message: 'A faint voice answers through the radio.',
    tvMessage: ['A VOICE IN THE STATIC.', 'IT HEARD THE REQUEST.'],
    evidence: { id: 'voice', label: 'Radio voice', detail: 'A faint voice answered through the field radio.' },
  },
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const emptyVisual = () => ({ lampDip: 0, picture: 0, cupboard: 0 });

export function createSigns() {
  return { status: 'ready', requests: 0, journal: [], cooldown: 0, episodeTime: 0, response: null, answered: false };
}

export function resetSigns(state) {
  Object.assign(state, createSigns());
  return state;
}

/** Cancel an episode without removing evidence, consuming another request, or
 * shortening its cooldown. Inactive play can therefore never bypass the limit. */
export function cancelSigns(state) {
  state.response = null; state.episodeTime = 0; state.answered = false;
  state.status = state.cooldown > EPSILON ? 'cooldown' : 'ready';
  return state;
}

/** The controller gates phase, overlays and user intent before calling this. */
export function requestSign(state) {
  if (state.response !== null || state.cooldown > EPSILON) return false;
  const response = RESPONSES[state.requests % RESPONSES.length];
  state.requests += 1; state.response = response.id; state.episodeTime = 0;
  state.answered = false; state.cooldown = REQUEST_INTERVAL; state.status = 'listening';
  return true;
}

function envelope(age) {
  if (age < 0 || age >= ANSWER_END - ANSWER_AT) return 0;
  if (age < 1) return smooth(age);
  if (age < 1.35) return 1;
  return smooth(clamp(1 - (age - 1.35) / 1.95, 0, 1));
}

function frame(state, reducedMotion, events = []) {
  const response = RESPONSES.find(item => item.id === state.response);
  const answering = state.status === 'answer' && response;
  const strength = answering ? envelope(state.episodeTime - ANSWER_AT) : 0;
  const visual = emptyVisual();
  if (answering) {
    visual.lampDip = strength * (response.id === 'movement' ? .35 : .65);
    if (response.id === 'movement' && !reducedMotion) {
      visual.picture = strength; visual.cupboard = strength;
    }
  }
  return {
    status: state.status, busy: state.status === 'listening' || state.status === 'answer',
    cooldown: Math.max(0, state.cooldown), meter: Math.round(strength * 5),
    message: answering ? response.message : state.status === 'listening' ? 'Listening…'
      : state.status === 'cooldown' ? 'Let the house fall quiet.' : 'Ask the house for a sign.',
    tvMessage: answering ? [...response.tvMessage] : null, visual, events,
    journal: state.journal.map(entry => ({ ...entry })), requests: state.requests,
  };
}

/** Active time only; one bounded simulation step prevents catch-up answers.
 * Pausing freezes the entire state. Leaving active exploration cancels an
 * episode immediately and freezes any remaining cooldown until active again. */
export function advanceSigns(state, dt, { active = true, paused = false, reducedMotion = false } = {}) {
  if (paused) return frame(state, reducedMotion);
  if (!active) { cancelSigns(state); return frame(state, reducedMotion); }
  const seconds = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
  const events = [];
  if (seconds > 0) {
    state.cooldown = Math.max(0, state.cooldown - seconds);
    if (state.cooldown <= EPSILON) state.cooldown = 0;
    const response = RESPONSES.find(item => item.id === state.response);
    if (response) {
      state.episodeTime += seconds;
      if (!state.answered && state.episodeTime >= ANSWER_AT - EPSILON) {
        state.answered = true;
        events.push({ type: response.type, id: `sign-${state.requests}-${response.id}`, pan: response.pan, intensity: response.intensity });
        if (!state.journal.some(entry => entry.id === response.id)) state.journal.push({ ...response.evidence });
      }
      if (state.episodeTime >= ANSWER_END - EPSILON) cancelSigns(state);
      else state.status = state.answered ? 'answer' : 'listening';
    } else state.status = state.cooldown > 0 ? 'cooldown' : 'ready';
  }
  return frame(state, reducedMotion, events);
}
