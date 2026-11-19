const COMMAND_KEYS = ['intro', 'look-window', 'look-behind', 'note', 'hide', 'come-out-fake', 'come-out', 'still', 'button', 'look-tv', 'complete'];
const OMEN_KEYS = ['under-table', 'hands', 'familiar', 'learned'];
const FILES = {
  impact: 'roomkeeper-impact-v1.mp3',
  leave: 'whisper-leave-v2.mp3', screen: 'whisper-screen-v2.mp3',
  behind: 'whisper-behind-v2.mp3', hear: 'whisper-hear-v2.mp3',
  ...Object.fromEntries(COMMAND_KEYS.map(key => [`command:${key}`, `keeper-${key}-v3.mp3`])),
  ...Object.fromEntries([...OMEN_KEYS, 'growl'].map(key => [`nightmare:${key}`, `nightmare-${key}-v4.mp3`])),
  'radio:request': 'radio-request-v8.mp3', 'radio:answer': 'radio-answer-v8.mp3',
};
const WHISPERS = ['leave', 'screen', 'behind', 'hear'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const asset = name => new URL(name, import.meta.url).href;

/** Audio is unlocked by init/resume in a user gesture; cue/update never unlock it. */
export function createAudio(getState = () => ({})) {
  let context, master, breathingGain, noiseBuffer, brownBuffer;
  let scoreGain, scoreQuietUntil = 0, reading = false;
  let muted = false, paused = false, breathTime = 0, nextHeartbeat = 0, whisperIndex = 0;
  let warningWanted = false, decodingStarted = false, currentCommand = null, currentCommandUntil = 0;
  let currentOmen = null, omenSilenceUntil = 0;
  const buffers = new Map(), sources = new Set();
  const raw = new Map(Object.entries(FILES).map(([key, file]) => [key,
    fetch(asset(file)).then(response => response.ok ? response.arrayBuffer() : null).catch(() => null),
  ]));
  const warning = typeof globalThis.Audio === 'function' ? new globalThis.Audio(asset('warning.mp3')) : null;
  if (warning) { warning.preload = 'auto'; warning.volume = .65; }
  const state = () => getState() || {};
  const haunted = () => {
    const current = state();
    return current.phase === 'explore' || current.phase === 'hallway' || (current.phase === 'hall' && current.deep);
  };
  const canPlay = () => context && context.state === 'running' && !paused && !muted;

  function playWarning() {
    if (!warning || paused || muted || !warningWanted) return;
    try { warning.play()?.catch(() => {}); } catch { /* Autoplay remains user controlled. */ }
  }
  function stopSources() {
    currentCommand = null; currentCommandUntil = 0; currentOmen = null; omenSilenceUntil = 0;
    for (const source of sources) {
      try { source.stop(); } catch { /* An already ended source is harmless. */ }
    }
    sources.clear();
  }
  function noiseData(brown = false) {
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = brown ? 8471 : 312, previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const white = (seed >>> 0) / 2147483648 - 1;
      previous = (previous + .025 * white) / 1.025;
      samples[index] = brown ? previous * 4 : white;
    }
    return buffer;
  }
  function startScore() {
    // A bowed-sounding pedal with two slow swells. Each frequency completes
    // whole cycles over the buffer so it loops without a click.
    const duration = 32, tau = 2 * Math.PI;
    const buffer = context.createBuffer(1, duration * context.sampleRate, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      const time = i / context.sampleRate;
      const phrase = tau * i / samples.length;
      const low = .36 * Math.sin(tau * 110 * time) + .13 * Math.sin(tau * 220 * time);
      const swell = .5 - .5 * Math.cos(phrase);
      const dissonance = .23 * swell * Math.sin(tau * 155.5625 * time + .6 * Math.sin(phrase * 3));
      const overtone = .08 * (1 - swell) * Math.sin(tau * 233.0625 * time + .4 * Math.sin(phrase * 2));
      samples[i] = (low + dissonance + overtone) * (.78 + .22 * Math.cos(phrase * 2));
    }
    scoreGain = context.createGain();
    scoreGain.gain.value = 0;
    scoreGain.connect(master);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(scoreGain);
    source.start();
  }
  function quietScore(seconds) {
    if (!canPlay()) return;
    const at = context.currentTime;
    scoreQuietUntil = Math.max(scoreQuietUntil, at + seconds);
    scoreGain.gain.setTargetAtTime(0, at, .045);
  }
  function scoreLevel() {
    const phase = state().phase;
    return phase === 'hallway' || phase === 'hall' ? .11 : phase === 'explore' ? .07 : 0;
  }
  function updateReadingScore() {
    scoreGain.gain.setTargetAtTime(muted ? 0 : scoreLevel() * .8, context.currentTime, .25);
  }
  function init() {
    paused = false;
    reading = false;
    if (!context) {
      const AudioEngine = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioEngine) return;
      try { context = new AudioEngine(); } catch { return; }
      master = context.createGain(); master.gain.value = muted ? 0 : .30;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14; compressor.knee.value = 18; compressor.ratio.value = 3;
      compressor.attack.value = .006; compressor.release.value = .22;
      master.connect(compressor).connect(context.destination);
      noiseBuffer = noiseData(); brownBuffer = noiseData(true);
      const breath = context.createBufferSource(); breath.buffer = brownBuffer; breath.loop = true;
      const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 520;
      const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 75;
      breathingGain = context.createGain(); breathingGain.gain.value = 0;
      breath.connect(highpass).connect(lowpass).connect(breathingGain).connect(master); breath.start();
      startScore();
      nextHeartbeat = context.currentTime + 1;
    }
    if (!decodingStarted) {
      decodingStarted = true;
      for (const [key, data] of raw) {
        data.then(bytes => bytes ? context.decodeAudioData(bytes) : null)
          .then(buffer => { if (buffer) buffers.set(key, buffer); }).catch(() => {});
      }
    }
    context.resume()?.catch(() => {});
  }
  function route(source, at, seconds, level, pan = 0, lowpass = 1400, highpass = 55, attack = .025, release) {
    const low = context.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = lowpass;
    const high = context.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = highpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), at + Math.min(attack, seconds * .3));
    const hold = release === undefined ? seconds * .55
      : Math.max(Math.min(attack, seconds * .3), seconds - Math.min(seconds * .45, Math.max(0, release)));
    gain.gain.setValueAtTime(Math.max(.0002, level), at + hold);
    gain.gain.exponentialRampToValueAtTime(.0001, at + seconds);
    source.connect(high).connect(low).connect(gain);
    const panner = context.createStereoPanner ? context.createStereoPanner() : null;
    if (panner) { panner.pan.value = clamp(pan, -1, 1); gain.connect(panner).connect(master); }
    else gain.connect(master);
    sources.add(source);
    source.onended = () => {
      sources.delete(source); source.disconnect(); high.disconnect(); low.disconnect(); gain.disconnect(); panner?.disconnect();
    };
  }
  function noise(seconds, level, frequency, pan = 0, delay = 0, brown = false, attack = .04) {
    if (!canPlay()) return;
    const at = context.currentTime + clamp(delay, 0, .45);
    const source = context.createBufferSource(); source.buffer = brown ? brownBuffer : noiseBuffer; source.loop = true;
    route(source, at, seconds, level, pan, frequency, brown ? 55 : 150, attack);
    source.start(at); source.stop(at + seconds + .02);
  }
  function clip(key, { level = .6, pan = 0, rate = 1, lowpass = 3400, duration, delay = 0, offset = 0, onSource, release } = {}) {
    const buffer = buffers.get(key);
    if (!buffer || !canPlay()) return false;
    const at = context.currentTime + clamp(delay, 0, .45);
    const length = Math.min(duration || buffer.duration, buffer.duration - offset);
    if (length <= 0) return false;
    const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
    route(source, at, length / rate, level, pan, lowpass, 90, .018, release);
    source.start(at, offset, length); source.stop(at + length / rate + .02);
    onSource?.(source);
    return true;
  }
  function stopCommand() {
    currentCommandUntil = 0;
    if (currentCommand) {
      const previous = currentCommand; currentCommand = null;
      try { previous.stop(); } catch { /* It may have just finished. */ }
    }
  }
  function stopOmen() {
    omenSilenceUntil = 0;
    if (currentOmen) {
      const previous = currentOmen; currentOmen = null;
      try { previous.stop(); } catch { /* The next real order takes precedence. */ }
    }
  }
  function command(key) {
    if (key == null) { stopCommand(); stopOmen(); return false; }
    if (!COMMAND_KEYS.includes(key)) return false;
    // A new order cuts off the previous spoken order, including its baked echo,
    // while leaving the room ambience and unrelated sound sources untouched.
    stopCommand(); stopOmen();
    const played = clip(`command:${key}`, { level: .7, lowpass: 4700, release: .08, onSource(source) {
      currentCommand = source; currentCommandUntil = context.currentTime + buffers.get(`command:${key}`).duration;
      const cleanup = source.onended;
      source.onended = () => {
        if (currentCommand === source) { currentCommand = null; currentCommandUntil = 0; }
        cleanup?.();
      };
    } });
    if (played) quietScore(currentCommandUntil - context.currentTime + .2);
    return played;
  }
  function thump(at, level, duration = .12, startFrequency = 53) {
    if (!canPlay()) return;
    const oscillator = context.createOscillator(); oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(startFrequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(29, at + duration);
    route(oscillator, at, duration, level, 0, 230, 20, .015);
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  function knock(pan = 0, intensity = .55) {
    if (!canPlay()) return;
    for (const [delay, strength] of [[0, 1], [.18, .65], [.4, .85]]) {
      const level = (.15 + intensity * .24) * strength;
      if (!clip('impact', { pan, delay, level, rate: .65, duration: .14, lowpass: 440 })) {
        noise(.19, level, 400, pan, delay, true, .012);
      }
    }
  }
  function whisper(event) {
    let index = whisperIndex++;
    if (event.id) {
      index = 0;
      for (const character of String(event.id)) index = ((index * 31) + character.charCodeAt(0)) >>> 0;
    }
    if (!clip(WHISPERS[index % WHISPERS.length], { pan: event.pan, level: .65 + event.intensity * .3, lowpass: 3300 })) {
      noise(1.1, .12 + event.intensity * .07, 1050, event.pan, 0, false, .18);
    }
  }
  function omen(event = {}) {
    if (!canPlay() || !haunted() || !OMEN_KEYS.includes(event.voiceKey)) return false;
    const pan = Number.isFinite(event.pan) ? clamp(event.pan, -1, 1) : 0;
    const intensity = Number.isFinite(event.intensity) ? clamp(event.intensity, 0, 1) : .5;
    // Never obscure a qualified spoken instruction. The authored TV message and
    // soft texture still communicate an omen if a long order has not finished.
    const commandBusy = currentCommand && currentCommandUntil > context.currentTime + .05;
    stopOmen();
    const played = !commandBusy && clip(`nightmare:${event.voiceKey}`, {
      pan, level: .6 + intensity * .1, lowpass: 3200, release: .10,
      onSource(source) {
        currentOmen = source;
        const cleanup = source.onended;
        source.onended = () => { if (currentOmen === source) currentOmen = null; cleanup?.(); };
      },
    });
    const length = played ? buffers.get(`nightmare:${event.voiceKey}`).duration : .8;
    omenSilenceUntil = context.currentTime + Math.min(2.7, length + .12);
    breathingGain.gain.cancelScheduledValues(context.currentTime);
    breathingGain.gain.setTargetAtTime(0, context.currentTime, .04);
    nextHeartbeat = omenSilenceUntil + .3;
    if (event.layer === 'scrape') noise(.7, .045 + intensity * .02, 720, pan, 0, false, .16);
    else noise(.9, .055 + intensity * .02, 470, pan, 0, true, .18);
    return Boolean(played);
  }
  function radio(key) {
    if (!canPlay() || state().phase !== 'explore') return false;
    // The radio never interrupts a Keeper order, resumes a context, or captures
    // microphone audio. The active controller owns requests and delayed replies.
    if (currentCommand && currentCommandUntil > context.currentTime) return false;
    const played = clip(`radio:${key}`, { level: .6, lowpass: key === 'request' ? 2800 : 2500, release: .1 });
    if (played) quietScore(buffers.get(`radio:${key}`).duration + .2);
    if (!played) noise(.16, .035, 2200, 0, 0, false, .012);
    return played;
  }
  const canPlayHallway = () => canPlay() && state().phase === 'hallway';
  function hallBell(frequency,at,seconds,level) {
    const bell=context.createOscillator();bell.type='sine';bell.frequency.setValueAtTime(frequency,at);
    route(bell,at,seconds,clamp(level,.0002,.10),-.12,3400,320,.003,seconds*.65);
    bell.start(at);bell.stop(at+seconds+.02);
  }
  function hallRing() {
    if(!canPlayHallway())return false;
    quietScore(1.35);
    // A mechanical striker alternates two imperfect bells. Short inharmonic
    // partials supply metal, rather than an electronic telephone/DTMF tone.
    const at=context.currentTime;
    for(let strike=0;strike<6;strike++){
      const frequency=strike%2?1067:780,time=at+strike*.13;
      hallBell(frequency,time,.43,.07);
      hallBell(frequency*2.414,time,.28,.013);
    }
    return true;
  }
  function hallKnock() {
    if(!canPlayHallway())return false;
    quietScore(.48);
    // Two layers share one attack. The chapter engine owns the three separate
    // knock events; this method must never schedule a second or third knock.
    const at=context.currentTime,body=context.createOscillator();body.type='sine';
    body.frequency.setValueAtTime(155,at);body.frequency.exponentialRampToValueAtTime(90,at+.11);
    route(body,at,.13,clamp(.10,0,.12),.15,700,65,.003,.09);
    body.start(at);body.stop(at+.15);
    noise(.105,.075,1150,.15,0,true,.003);
    return true;
  }
  function hallStatic() {
    if(!canPlayHallway())return false;
    quietScore(.9);
    // Original filtered receiver hiss: no additional clip, speech asset or fetch.
    noise(.75,.032,2200,0,0,false,.12);
    noise(.62,.014,650,.12,0,true,.10);
    return true;
  }

  return {
    init,
    // Like cue(), command() never creates or resumes an AudioContext. A false
    // result lets the active controller retry after decoding/user-gesture init.
    command,
    stopCommand,
    omen,
    radioRequest() { return radio('request'); },
    radioReply() { return radio('answer'); },
    hallRing,
    hallKnock,
    hallStatic,
    startWarning() {
      warningWanted = true; init();
      if (warning) { warning.currentTime = 0; warning.muted = muted; }
      playWarning();
    },
    stopWarning() { warningWanted = false; warning?.pause(); },
    pause({ keepScore = false } = {}) {
      paused = true; reading = keepScore; warning?.pause(); stopSources();
      if (context) {
        breathingGain.gain.cancelScheduledValues(context.currentTime); breathingGain.gain.value = 0;
        scoreQuietUntil = 0;
        nextHeartbeat = context.currentTime + .8;
        if (reading) {
          updateReadingScore();
        } else {
          scoreGain.gain.cancelScheduledValues(context.currentTime);
          scoreGain.gain.value = 0;
          context.suspend()?.catch(() => {});
        }
      }
    },
    resume() {
      init();
      const current = state();
      if (warningWanted && current.phase === 'explore' && current.warningStarted && current.warningTime < 10) {
        if (warning && Number.isFinite(current.warningTime)) warning.currentTime = Math.max(0, current.warningTime);
        playWarning();
      }
    },
    toggle() {
      muted = !muted;
      if (warning) warning.muted = muted;
      if (context) {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(muted ? 0 : .30, context.currentTime, .025);
        if (muted) {
          stopSources();
          breathingGain.gain.setTargetAtTime(0, context.currentTime, .025);
          scoreGain.gain.setTargetAtTime(0, context.currentTime, .025);
          scoreQuietUntil = 0;
        }
        if (reading && !muted) updateReadingScore();
        nextHeartbeat = context.currentTime + .8;
      }
      if (muted) warning?.pause();
      else {
        const current = state();
        if (warning && warningWanted && Number.isFinite(current.warningTime)) warning.currentTime = clamp(current.warningTime, 0, 10);
        playWarning();
      }
      return muted;
    },
    footstep() { noise(.11, .075, 480, 0, 0, true, .012); },
    click() { noise(.07, .13, 1500, 0, 0, false, .01); },
    knock,
    scare() {
      if (!canPlay()) return;
      stopCommand(); stopOmen(); quietScore(3);
      noise(.26, .20, 2200, 0, 0, false, .012);
      const hasImpact = clip('impact', { level: .8, delay: .12, lowpass: 5500 });
      clip('nightmare:growl', { level: .4, delay: .08, lowpass: 950, release: .24 });
      thump(context.currentTime + .12, hasImpact ? .18 : .32, .5, 58);
    },
    cue(event = {}) {
      if (!canPlay() || !haunted()) return;
      const cue = { ...event, pan: Number.isFinite(event.pan) ? clamp(event.pan, -1, 1) : 0,
        intensity: Number.isFinite(event.intensity) ? clamp(event.intensity, 0, 1) : .5 };
      if (cue.type === 'knock') knock(cue.pan, cue.intensity);
      else if (cue.type === 'whisper') whisper(cue);
      else if (cue.type === 'scrape') noise(.85, .12 + cue.intensity * .13, 950, cue.pan, 0, false, .2);
      else if (cue.type === 'static') noise(.45, .06 + cue.intensity * .07, 1350, cue.pan, 0, false, .13);
      else if (cue.type === 'breath' || cue.type === 'stalker') noise(1.3, .14 + cue.intensity * .10, 700, cue.pan, 0, true, .22);
    },
    update(dt, { tension = 0, moving = false } = {}) {
      if (!context || context.state !== 'running') return;
      const at = context.currentTime;
      const strength = Number.isFinite(tension) ? clamp(tension, 0, 1) : 0;
      const quiet = paused || muted || warningWanted || at < Math.max(scoreQuietUntil, omenSilenceUntil, currentCommandUntil);
      if (!reading) scoreGain.gain.setTargetAtTime(quiet ? 0 : scoreLevel() * (1 + .35 * strength), at, quiet ? .045 : .6);
      if (paused || muted || !haunted()) {
        breathingGain.gain.setTargetAtTime(0, at, .15); nextHeartbeat = at + .8;
        return;
      }
      if (at < omenSilenceUntil) {
        breathingGain.gain.setTargetAtTime(0, at, .04); nextHeartbeat = omenSilenceUntil + .3;
        return;
      }
      const step = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
      breathTime += step;
      const breath = .2 + .8 * (.5 - .5 * Math.cos(breathTime * Math.PI / 2.7));
      breathingGain.gain.setTargetAtTime((.014 + strength * .031 + (moving ? .006 : 0)) * breath, at, .12);
      if (strength > .33 && step > 0 && at >= nextHeartbeat) {
        const level = .025 + strength * .045;
        thump(at, level); thump(at + .18, level * .6, .10, 47);
        nextHeartbeat = at + 1.4 - strength * .68;
      }
    },
  };
}
