// Original Keeper command trials, adapted from the observed instruction/hiding
// loop. Timings and command order are this game's design, not Suzy Says rules.
const EPSILON = 1e-9;
const FEEDBACK_TIME = .7;
const STEPS = [
  { id: 'look-window', kind: 'command', target: 'window', qualified: true, duration: 9, voiceKey: 'window', message: ['KEEPER SAYS...', 'LOOK AT THE WINDOW.'], objective: 'Look at the window and hold your gaze.' },
  { id: 'look-behind-decoy', kind: 'command', target: 'behind', qualified: false, duration: 4, voiceKey: 'behind', message: ['LOOK BEHIND YOU.', 'RIGHT NOW.'], objective: 'Follow only orders that begin “Keeper says”.' },
  { id: 'touch-note', kind: 'command', target: 'note', qualified: true, duration: 12, voiceKey: 'note', message: ['KEEPER SAYS...', 'TOUCH THE NOTE.'], objective: 'Walk to the TV cabinet and touch the note.' },
  { id: 'hide-one', kind: 'hideCountdown', qualified: true, duration: 12, voiceKey: 'hide', message: ['KEEPER SAYS...', 'HIDE.'], objective: 'Get under the table before it arrives.' },
  { id: 'hunt-one', kind: 'seeking', qualified: true, duration: 12, voiceKey: 'stay-hidden', message: ['KEEPER SAYS...', 'STAY HIDDEN.'], objective: 'Stay hidden until a qualified order releases you.' },
  { id: 'release-one', kind: 'release', qualified: true, voiceKey: 'come-out', message: ['KEEPER SAYS...', 'COME OUT.'], objective: 'You may leave your hiding place.' },
  { id: 'stay-still', kind: 'command', target: 'still', qualified: true, duration: 4, voiceKey: 'still', message: ['KEEPER SAYS...', 'STAND STILL.'], objective: 'Stop moving and wait for the next order.' },
  { id: 'button-decoy', kind: 'command', target: 'button', qualified: false, duration: 4, voiceKey: 'button', message: ['PRESS THE RED BUTTON.', 'GO ON.'], objective: 'Follow only orders that begin “Keeper says”.' },
  { id: 'hide-two', kind: 'hideCountdown', qualified: true, duration: 10, voiceKey: 'hide', message: ['KEEPER SAYS...', 'HIDE AGAIN.'], objective: 'Get under the table. It is coming back.' },
  { id: 'hunt-two', kind: 'seeking', qualified: true, duration: 14, voiceKey: 'stay-hidden', message: ['KEEPER SAYS...', 'STAY HIDDEN.'], objective: 'Stay hidden. Wait for the complete order.' },
  { id: 'release-two', kind: 'release', qualified: true, voiceKey: 'come-out', message: ['KEEPER SAYS...', 'COME OUT.'], objective: 'You may leave your hiding place.' },
  { id: 'look-tv', kind: 'command', target: 'tv', qualified: true, duration: 8, voiceKey: 'tv', message: ['KEEPER SAYS...', 'LOOK AT THE TV.'], objective: 'Look back at the TV and hold your gaze.' },
];
const INTRO = ['ONLY OBEY ORDERS', 'BEGINNING “KEEPER SAYS”.'];
const BAIT = ['COME OUT NOW.', 'THE HALL IS CLEAR.'];
// These are unqualified threats/lures, never additional pass/fail conditions.
// The existing four-second bait fits between them without overlapping onsets.
const OMENS = {
  'hunt-one': [
    { at: 2, voiceKey: 'under-table', pan: -.65, layer: 'breath', intensity: .42, message: ['YOU LEFT ROOM UNDER THERE.', 'ROOM FOR ME.'] },
    { at: 7, voiceKey: 'hands', pan: .7, layer: 'scrape', intensity: .58, message: ['I CAN SEE YOUR HANDS.', 'DO NOT MOVE.'] },
    { at: 9, voiceKey: 'familiar', pan: -.35, layer: 'breath', intensity: .5, message: ['IT IS SAFE NOW.', 'COME OUT.'] },
  ],
  'hunt-two': [
    { at: 2, voiceKey: 'learned', pan: .8, layer: 'scrape', intensity: .48, message: ['IT LEARNED YOUR HIDING PLACE.', 'THERE IS ROOM FOR TWO.'] },
    { at: 7, voiceKey: 'hands', pan: -.7, layer: 'breath', intensity: .58, message: ['YOUR HANDS ARE STILL SHOWING.', 'WAIT UNTIL I SAY IT.'] },
    { at: 9, voiceKey: 'familiar', pan: .45, layer: 'scrape', intensity: .55, message: ['YOU CAN TRUST THIS VOICE.', 'COME OUT NOW.'] },
  ],
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const active = trials => !['idle', 'complete', 'failed'].includes(trials.status);

export function createTrials() {
  return {
    status: 'idle', step: -1, elapsed: 0, phaseTime: 0, commandId: null,
    hold: 0, movement: 0, hidden: false, failureReason: null,
    seekTime: 0, huntDuration: 0, baitSent: false, omenIndex: 0, events: [],
  };
}

export function resetTrials(trials) {
  Object.assign(trials, createTrials());
  return trials;
}

function commandEvent(trials, step, message = step.message, suffix = '') {
  trials.events.push({
    type: 'command', commandId: `${step.id}${suffix}`, voiceKey: step.voiceKey,
    qualified: step.qualified, message: [...message],
  });
}

export function startTrials(trials) {
  resetTrials(trials);
  trials.status = 'instructions'; trials.commandId = 'instructions';
  commandEvent(trials, { id: 'instructions', voiceKey: 'intro', qualified: null, message: INTRO });
  return trials;
}

export function failTrials(trials, reason = 'The Keeper caught you.') {
  if (!active(trials)) return false;
  trials.status = 'failed'; trials.failureReason = String(reason);
  trials.events.push({ type: 'fail', commandId: trials.commandId, reason: trials.failureReason });
  return true;
}

function enterStep(trials, index) {
  trials.step = index; trials.phaseTime = 0; trials.hold = 0; trials.movement = 0; trials.baitSent = false; trials.omenIndex = 0;
  const step = STEPS[index];
  if (!step) {
    trials.status = 'complete'; trials.commandId = 'complete'; trials.hidden = false;
    trials.seekTime = 0; trials.huntDuration = 0;
    trials.events.push({ type: 'complete', commandId: 'complete' });
    return;
  }
  trials.status = step.kind; trials.commandId = step.id;
  if (step.kind === 'hideCountdown') trials.hidden = false;
  if (step.kind === 'seeking') { trials.huntDuration = step.duration; trials.seekTime = 0; }
  else if (step.kind !== 'release') { trials.huntDuration = 0; trials.seekTime = 0; }
  commandEvent(trials, step);
  if (step.kind === 'seeking') trials.events.push({ type: 'huntStart', commandId: step.id, duration: step.duration });
  if (step.kind === 'release') trials.events.push({ type: 'huntEnd', commandId: step.id, duration: trials.huntDuration });
}

function succeed(trials) {
  trials.events.push({ type: 'success', commandId: trials.commandId });
  if (['hideCountdown', 'seeking'].includes(trials.status)) enterStep(trials, trials.step + 1);
  else { trials.status = 'feedback'; trials.phaseTime = 0; trials.hold = 0; }
}

/** Report an interaction after the caller validates its world position. Events
 * remain queued until advanceTrials, so the frame loop handles all effects once.
 * Use failTrials for the forbidden button's unconditional, external trap. */
export function trialAction(trials, action) {
  if (!active(trials)) return false;
  if (action === 'leave' && trials.status === 'seeking') {
    failTrials(trials, 'You left before “Keeper says”.');
    return true;
  }
  if (action === 'leave' && trials.status === 'release') {
    trials.hidden = false; succeed(trials); return true;
  }
  if (action === 'hide' && trials.status === 'hideCountdown') {
    trials.hidden = true; succeed(trials); return true;
  }
  const step = STEPS[trials.step];
  if (trials.status === 'command' && step.target === action) {
    if (!step.qualified) { failTrials(trials, 'That order did not begin “Keeper says”.'); return true; }
    if (action === 'note') { succeed(trials); return true; }
  }
  return false;
}

function model(trials, events = []) {
  const step = STEPS[trials.step];
  let message = ['THE KEEPER IS WAITING.', 'TOUCH THE TV TO BEGIN.'];
  let objective = 'Start the Keeper’s game at the TV.', tension = 0;
  if (trials.status === 'instructions') {
    message = INTRO; objective = 'Listen to the whole order. Unqualified orders are traps.'; tension = .18;
  } else if (trials.status === 'feedback') {
    message = ['GOOD.', 'KEEP LISTENING.']; objective = 'Wait for the next order.'; tension = .3;
  } else if (trials.status === 'failed') {
    message = ['YOU BROKE THE RULE.', 'IT FOUND YOU.']; objective = trials.failureReason; tension = 1;
  } else if (trials.status === 'complete') {
    message = ['YOU FOLLOWED THE RULES.', 'THE DOOR IS UNLOCKED.']; objective = 'Choose whether to leave or ask for more.'; tension = .1;
  } else if (step) {
    message = step.message; objective = step.objective;
    tension = trials.status === 'seeking' ? .82 + .12 * clamp(trials.seekTime / step.duration, 0, 1)
      : trials.status === 'hideCountdown' ? .6 + .25 * clamp(trials.phaseTime / step.duration, 0, 1)
      : trials.status === 'release' ? .35 : step.qualified ? .42 : .58;
    if (trials.status === 'seeking') {
      if (trials.phaseTime >= 4 - EPSILON && trials.phaseTime < 7 - EPSILON) message = BAIT;
      else if (trials.phaseTime >= 7 - EPSILON) message = ['IT IS STILL HERE.', '...'];
      const omen = OMENS[step.id]?.find(beat => trials.phaseTime >= beat.at - EPSILON && trials.phaseTime < beat.at + 2 - EPSILON);
      if (omen) message = omen.message;
    }
  }
  const huntPhase = ['seeking', 'release'].includes(trials.status);
  const progress = trials.status === 'complete' ? 1 : trials.status === 'idle' ? 0
    : clamp((trials.step + (trials.status === 'feedback' ? 1 : 0)) / STEPS.length, 0, 1);
  return {
    status: trials.status, commandId: trials.commandId, message: [...message], objective,
    events, hideAllowed: trials.status === 'hideCountdown', huntActive: trials.status === 'seeking',
    canLeave: trials.status === 'release', tension, progress, failureReason: trials.failureReason,
    seekTime: huntPhase ? trials.seekTime : 0, huntDuration: huntPhase ? trials.huntDuration : 0,
    remaining: step && Number.isFinite(step.duration) && ['command','hideCountdown','seeking'].includes(trials.status) ? Math.max(0,step.duration-trials.phaseTime) : null,
  };
}

/** Advance once after world input. Pauses freeze timers and retain queued events.
 * A .1-second cap prevents hidden tabs or large frame deltas replaying a round.
 * Gaze requires .45 continuous seconds. Stillness allows .6 seconds to stop, then
 * tolerates .07 seconds of movement. Context and round/count state are never edited. */
export function advanceTrials(trials, dt, context = {}) {
  if (context.paused) return model(trials);
  const seconds = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
  if (active(trials) && seconds > 0) {
    trials.elapsed += seconds; trials.phaseTime += seconds;
    const step = STEPS[trials.step];
    if (trials.status === 'instructions' && trials.phaseTime >= 3.5 - EPSILON) enterStep(trials, 0);
    else if (trials.status === 'feedback' && trials.phaseTime >= FEEDBACK_TIME - EPSILON) enterStep(trials, trials.step + 1);
    else if (trials.status === 'hideCountdown') {
      if (context.hidden === true) { trials.hidden = true; succeed(trials); }
      else if (trials.phaseTime >= step.duration - EPSILON) failTrials(trials, 'You did not hide in time.');
    } else if (trials.status === 'seeking') {
      trials.seekTime = Math.min(step.duration, trials.phaseTime);
      if (context.hidden === false) failTrials(trials, 'You left your hiding place too soon.');
      else {
        const omen = OMENS[step.id]?.[trials.omenIndex];
        if (omen && trials.phaseTime >= omen.at - EPSILON) {
          trials.omenIndex += 1;
          trials.events.push({
            type: 'omen', id: `${step.id}-${omen.voiceKey}`, commandId: step.id,
            voiceKey: omen.voiceKey, pan: omen.pan, layer: omen.layer, intensity: omen.intensity,
            message: [...omen.message], qualified: false, at: omen.at,
          });
        }
        if (!trials.baitSent && trials.phaseTime >= 4 - EPSILON) {
          trials.baitSent = true;
          commandEvent(trials, { ...step, voiceKey: 'come-out-bait', qualified: false }, BAIT, '-bait');
        }
        if (trials.phaseTime >= step.duration - EPSILON) succeed(trials);
      }
    } else if (trials.status === 'command') {
      if (!step.qualified) {
        if (step.target === 'behind' && trials.phaseTime > .35 && context.lookBehind) failTrials(trials, 'That order did not begin “Keeper says”.');
        else if (trials.phaseTime >= step.duration - EPSILON) succeed(trials);
      } else if (step.target === 'window' || step.target === 'tv') {
        const looking = step.target === 'window' ? context.lookAtWindow : context.lookAtTV;
        trials.hold = looking ? trials.hold + seconds : 0;
        if (trials.hold >= .45 - EPSILON) succeed(trials);
        else if (trials.phaseTime >= step.duration - EPSILON) failTrials(trials, 'You did not follow the Keeper’s order in time.');
      } else if (step.target === 'still') {
        const afterGrace = Math.max(0, Math.min(seconds, trials.phaseTime - .6));
        if (context.moving) trials.movement += afterGrace;
        if (trials.movement > .07 + EPSILON) failTrials(trials, 'You moved when the Keeper said to stand still.');
        else if (trials.phaseTime >= step.duration - EPSILON) succeed(trials);
      } else if (trials.phaseTime >= step.duration - EPSILON) failTrials(trials, 'You did not follow the Keeper’s order in time.');
    }
  }
  const events = trials.events.splice(0);
  return model(trials, events);
}
