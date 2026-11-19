// English dialogue and foley were rendered for The Show Home. The outdoor bed
// is a public-domain field recording, “Dawn Chorus,” courtesy of Bryce Canyon
// National Park: https://www.nps.gov/subjects/sound/sounds-dawnchorus_bryce.htm
// Each cue is [start, duration] in seconds within the local, gapless MP3.
export const SHOW_AUDIO_CUES = {
  'greeting': [0.12, 4.18675],
  'key-instructions': [4.42675, 5.10833],
  'practice-1': [9.65508, 1.25537],
  'dont-cover': [11.03046, 3.08504],
  'show-door': [14.2355, 2.48442],
  'stand-still': [16.83992, 2.14267],
  'third-lesson': [19.10258, 4.16296],
  'like-you': [23.38554, 2.565],
  'no-need': [26.07054, 3.25021],
  'cant-see': [29.44075, 4.07571],
  'player-line': [33.63646, 2.77358],
  'echo-cough': [36.53004, 0.43],
  'practice-2': [37.08004, 1.25125],
  'practice-3': [38.45129, 1.29125],
  'replacement': [39.86254, 3.15117],
  'ring': [43.13371, 0.98],
  'knock-1': [44.23371, 0.64],
  'knock-2': [44.99371, 0.64],
  'knock-3': [45.75371, 0.92],
  'knock-recording': [46.79371, 1.79],
  'hangup': [48.70371, 0.314],
  'echo-hangup': [49.13771, 0.314],
  'step-echo': [49.57171, 0.61],
  'reach': [50.30171, 0.34],
  'cloth': [50.76171, 0.54],
  'paper-cover': [51.42171, 0.91],
  'rise': [52.45171, 1.5],
  'unlock': [54.07171, 0.39],
  'door-open': [54.58171, 0.9],
  'door-close': [55.60171, 0.74],
  'outside': [56.46171, 8.25],
};

const spoken = new Set([
  'greeting', 'player-line', 'echo-cough', 'key-instructions', 'practice-1', 'practice-2',
  'practice-3', 'dont-cover', 'show-door', 'stand-still', 'third-lesson', 'like-you',
  'no-need', 'cant-see', 'replacement',
]);
const pan = {'step-echo': -.48, 'knock-1': .24, 'knock-2': -.48, 'echo-hangup': -.22};
const spriteUrl = new URL('./show-home-audio.mp3', import.meta.url);

/** resume() belongs in an input gesture. The chapter clock is the single owner
 * of narrative timing. Audio may start late or be unavailable without changing it. */
export function createShowAudio() {
  let context, master, buffer, loading;
  let paused = true, muted = false;
  const playing = new Map();

  function stopChannel(channel) {
    const job = playing.get(channel);
    if (!job) return;
    playing.delete(channel);
    if (job.source) {
      job.source.onended = null;
      try { job.source.stop(); } catch { /* Already ended in the render thread. */ }
      job.source.disconnect();
      job.panner?.disconnect();
    }
  }

  function pump() {
    if (paused || !buffer || context.state !== 'running') return;
    for (const [channel, job] of playing) {
      if (job.source) continue;
      const [start, duration] = SHOW_AUDIO_CUES[job.id];
      const delay = Math.max(0, context.currentTime - job.requestedAt);
      const loop = job.id === 'outside';
      if (!loop && delay >= duration) {
        playing.delete(channel);
        continue;
      }
      const source = context.createBufferSource();
      job.source = source;
      source.buffer = buffer;
      if (pan[job.id] && context.createStereoPanner) {
        job.panner = context.createStereoPanner();
        job.panner.pan.value = pan[job.id];
        source.connect(job.panner);
        job.panner.connect(master);
      } else {
        source.connect(master);
      }
      source.onended = () => {
        if (playing.get(channel) === job) playing.delete(channel);
        source.disconnect();
        job.panner?.disconnect();
      };
      if (loop) {
        source.loop = true;
        source.loopStart = start;
        source.loopEnd = start + duration;
        source.start(0, start + (delay % duration));
      } else {
        source.start(0, start + delay, duration - delay);
      }
    }
  }

  function load() {
    if (buffer || loading) return;
    loading = fetch(spriteUrl)
      .then(response => {
        if (!response.ok) throw Error('Chapter II sound failed to load');
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .then(decoded => { buffer = decoded; pump(); })
      .catch(() => { playing.clear(); })
      .finally(() => { loading = null; });
  }

  function resume() {
    if (!context) {
      const AudioEngine = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioEngine) return;
      try { context = new AudioEngine(); } catch { return; }
      master = context.createGain();
      master.gain.value = muted ? 0 : .8;
      master.connect(context.destination);
    }
    paused = false;
    load();
    context.resume().then(pump).catch(() => {});
  }

  function play(id) {
    if (!Object.hasOwn(SHOW_AUDIO_CUES,id) || !context || paused) return false;
    const channel = spoken.has(id) ? 'dialogue' : id;
    if (id === 'outside' && playing.has(channel)) return true;
    stopChannel(channel);
    playing.set(channel, {id, requestedAt:context.currentTime, source:null, panner:null});
    load();
    pump();
    return true;
  }

  function stop(id) {
    const channel = spoken.has(id) ? 'dialogue' : id;
    if (playing.get(channel)?.id === id) stopChannel(channel);
  }

  function pause() {
    paused = true;
    context?.suspend().catch(() => {});
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master) master.gain.value = muted ? 0 : .8;
  }

  function reset() {
    for (const channel of playing.keys()) stopChannel(channel);
  }

  return {play, stop, pause, resume, setMuted, reset};
}
