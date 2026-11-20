import * as THREE from './vendor/three.module.js';
import { labelTexture } from './textures.mjs?v=note18';
import { createScreen } from './crt.mjs?v=dread2';
import { upgradeTelevision } from './tv-world.mjs?v=dread2';
import { createHouseTextures } from './house-textures.mjs?v=fold30';
import { createWorld } from './house-world.mjs?v=fold30';
import { createHallWorld } from './hall-world.mjs?v=fold30';
import {stairHeight} from './attic.mjs?v=fold30';
import {createShowPresentation} from './show-home.mjs?v=fold30';
import { createHallChapter, resetHallChapter, startHallChapter, hallChapterAction, advanceHallChapter, freeHallMovement, hallTargetLabel, restoreShowCheckpoint, CHECKPOINT_KEY, OUTSIDE_KEY } from './hall-chapter.mjs?v=fold30';
import { createPaperClue, CORNER_CLUE } from './paper-clue.mjs?v=presence7';
import { createCornerSpirit } from './corner-spirit.mjs?v=note12';
import { createCourtyardGirl } from './courtyard-girl.mjs?v=storm29';
import { createCreature } from './roomkeeper.mjs?v=nightmare4';
import { TIMING, createRound, startRound, startWarning, startScarePreview, pressButton, advance, chooseHall, openDoor, checkHall,
  movePlayer, canStand, angleToward, readPresses, savePresses, joystickVector, scareEndDistance, lungeProgress } from './core.mjs?v=showhome23';

import { findPath, stepPath } from './navigation.mjs?v=showhome23';
import { createDread, resetDread, updateDread } from './dread.mjs?v=dread2';
import { createAudio } from './audio.mjs?v=storm29';
import { createSigns, resetSigns, requestSign, advanceSigns, cancelSigns } from './signs.mjs?v=signals8';
import { createSignalWorld } from './signal-world.mjs?v=signals8';
import { createLookControl } from './look-control.mjs?v=touch9';
import { createTrials, startTrials, resetTrials, advanceTrials, trialAction, failTrials } from './trials.mjs?v=nightmare4';
import { createHideWorld } from './hide-world.mjs?v=presence7';

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const coarse = matchMedia('(pointer: coarse)').matches;
const touchMovement = coarse || matchMedia('(any-pointer: coarse)').matches;
const phoneFirst = true;
const WALK_ZOOM = .5, REVEAL_ZOOM = 1;
const requestedPreview = new URLSearchParams(location.search).has('preview');
const requestedChapter = new URLSearchParams(location.search).get('chapter') === '2';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let storage;
try { storage = localStorage; } catch { storage = null; }
const state = createRound(readPresses(storage));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.15 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101512);
scene.fog = new THREE.FogExp2(0x101512, .028);
const camera = new THREE.PerspectiveCamera(62, 1, .055, 45); camera.rotation.order = 'YXZ';
camera.zoom = WALK_ZOOM; camera.updateProjectionMatrix(); scene.add(camera);
scene.add(new THREE.HemisphereLight(0x84968c, 0x3a2a1e, .85));
scene.add(new THREE.AmbientLight(0x8a8d7a, .22));
const crt = createScreen(); crt.draw(0, undefined, { presses: state.presses });
$('enterRoom').textContent='Opening the old house…';
document.querySelectorAll('[data-preview]').forEach(button=>{button.disabled=true;});
const [houseTextures,roomkeeperTexture,plasticTexture,courtyardGirlTexture,cornerTexture]=await Promise.all([
  createHouseTextures(),new THREE.TextureLoader().loadAsync('assets/game/roomkeeper-v4.png'),
  new THREE.TextureLoader().loadAsync('assets/game/tv-plastic-v2.webp').catch(()=>null),
  new THREE.TextureLoader().loadAsync('assets/game/courtyard-woman-v11.png').catch(()=>null),
  new THREE.TextureLoader().loadAsync('assets/game/corner-face-v11.png').catch(()=>null),
]);
const world = createWorld(scene, { textures: houseTextures, labelTexture, screenTexture: crt.texture });
if(plasticTexture){plasticTexture.colorSpace=THREE.SRGBColorSpace;plasticTexture.wrapS=plasticTexture.wrapT=THREE.RepeatWrapping;plasticTexture.repeat.set(2,2);}
upgradeTelevision(world,{plastic:plasticTexture,labelTexture});
world.ceilingLight.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
world.ceilingLight.shadow.normalBias = .025;
roomkeeperTexture.colorSpace=THREE.SRGBColorSpace;
roomkeeperTexture.minFilter=THREE.LinearFilter;roomkeeperTexture.magFilter=THREE.LinearFilter;
roomkeeperTexture.generateMipmaps=false;roomkeeperTexture.anisotropy=4;
const creature = createCreature({texture:roomkeeperTexture,reveal:true}); scene.add(creature.root);
const hideWorld = createHideWorld(scene,world,{texture:roomkeeperTexture});
const cornerPaper = createPaperClue(world,{labelTexture});
const cornerSpirit = createCornerSpirit({texture:cornerTexture}); scene.add(cornerSpirit.root);
const courtyardGirl = createCourtyardGirl(world,{texture:courtyardGirlTexture});
const hallWorld = createHallWorld(world,{texture:cornerTexture,labelTexture});
const hallChapter = createHallChapter();
let hallView = advanceHallChapter(hallChapter,0,{active:false});
let lessonYaw=0,lessonPitch=0,porchStart={x:0,z:10};
const showHome=createShowPresentation({world,camera,renderer,girl:courtyardGirl,art:houseTextures.kitchenArtwork,
  grime:houseTextures.grime,handSkin:houseTextures.handSkin,foldSkin:houseTextures.foldSkin,foldGeometry:houseTextures.foldGeometry,element:$,act:showAction});
let cornerHintRead = false;
let windowView = null;
const flashlight = new THREE.SpotLight(0xffe7c1, 5.5, 11, .38, .65, 1.6);
flashlight.position.set(.12, -.10, .02); flashlight.target.position.set(0, -.04, -6);
camera.add(flashlight, flashlight.target);
let photoFailed = false;
let photoActive = false;
const photo = new THREE.TextureLoader().load('assets/easter-egg-room.png', t => { t.colorSpace = THREE.SRGBColorSpace; }, undefined, () => {
  photoFailed = true;
});
const keys = new Set();
const moveAxis = { x: 0, y: 0 };
let stickPointer = null;
const position = { x: .9, z: .9 };
let yaw = .36, pitch = -.025, started = false, paused = false, panel = 'intro';
const lookControl = createLookControl();
let lastFrame = 0, visualTime = 0, focused = null, toastUntil = 0, stepDistance = 0;
let drag = null, hadPointerLock = false, expectedUnlock = false, lightEnabled = true;
let lastScreen = -1, doorAngle = 0, scareOrigin = new THREE.Vector3(), scareDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster(); const centre = new THREE.Vector2();
const direction = new THREE.Vector3();

const sound = createAudio(() => state);
const dread = createDread(Date.now() >>> 0);
let dreadFrame = { tension: 0, disturbance: 0, events: [], tvMessage: null, stalker: null };
const stalker = createCreature({ texture: roomkeeperTexture }); scene.add(stalker.root);
let stalkerId = null, stalkerSeen = false, stalkerDismissed = false, stalkerAway = 0;
const stalkerPoint = new THREE.Vector3();
let walkPath = [], walkLook = null, walkAction = null;
const trials = createTrials();
const signs = createSigns(), signalWorld = createSignalWorld(world);
let signFrame = advanceSigns(signs,0,{active:false}), radioOpen = false;
let trialView = advanceTrials(trials,0), commandYaw = 0, trialFailureReason = '';
let coverMode = 'none', coverTime = 0, eyeHeight = 1.65, coverFrom = null, pendingCaught = false;
let hunterLast = null, hunterStepDistance = 0, omenPulse = 0;
const gazeDirection = new THREE.Vector3(), gazeTarget = new THREE.Vector3();
const destinationMarker = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 32),
  new THREE.MeshBasicMaterial({color:0xa8bea0,transparent:true,opacity:.65,depthWrite:false}));
destinationMarker.name = 'Tap destination'; destinationMarker.rotation.x = -Math.PI / 2;
destinationMarker.visible = false; scene.add(destinationMarker);

function stopWalking() {
  const wasWalking = walkPath.length > 0;
  walkPath.length = 0; walkLook = null; walkAction = null; destinationMarker.visible = false;
  $('stopMoving').hidden = coverMode === 'none';
  if (wasWalking && $('objective').textContent.startsWith('Walking')) {
    $('objective').textContent = state.warningStarted && state.phase === 'explore'
      ? "Ten seconds. Don't press the button on the TV." : 'Tap floor to walk. Drag to look around.';
  }
}
function walkTo(target, lookTarget = null, action = null) {
  stopWalking();
  if (Math.hypot(target.x-position.x,target.z-position.z)<.15) { if(action==='hide') enterCover(); else if(action==='painting')showAction('painting'); return true; }
  const open = state.doorOpen && doorAngle > 1.18;
  const path = findPath(position, target, open);
  if (!path.length) { toast('The way is blocked. Tap a clear part of the floor.', 2); return false; }
  walkPath = path; walkLook = lookTarget; walkAction = action;
  const end = path[path.length - 1]; destinationMarker.position.set(end.x, stairHeight(end.x,end.z)+.045, end.z);
  destinationMarker.visible = true; $('stopMoving').hidden = false;
  $('objective').textContent = action==='painting' ? 'Walking up to the painting.' : action==='chapter' ? 'Walking closer. Tap again to inspect.' : lookTarget ? 'Walking to the monitor. Tap again when you are close.' : 'Walking. Tap another spot to change direction.';
  return true;
}
function requestHide() {
  if (windowView || paused || panel || state.phase !== 'explore' || coverMode !== 'none') return;
  if (!trialView.hideAllowed) { toast('Wait for the Keeper to tell you to hide.', 3); return; }
  walkTo(hideWorld.cover.approach,null,'hide');
  $('objective').textContent = 'Get under the table before it arrives.';
}
function enterCover() {
  if (!trialView.hideAllowed || coverMode !== 'none') return;
  clearMovement(); coverMode = 'entering'; coverTime = 0;
  coverFrom = {x:position.x,z:position.z,eyeY:eyeHeight};
}
function exitCover(caught = false) {
  if (!['hidden','entering'].includes(coverMode)) return;
  clearMovement(); coverMode = 'exiting'; coverTime = 0; pendingCaught = caught;
  coverFrom = {x:position.x,z:position.z,eyeY:eyeHeight};
}
function requestLeaveCover() {
  if (paused || panel || coverMode !== 'hidden') return;
  const accepted = trialAction(trials,'leave');
  if (trials.status === 'failed') return; // The next active frame handles the caught rise.
  if (accepted && trialView.canLeave) exitCover(false);
  else toast('Stay hidden. Wait for “Keeper says”.',3);
}
function updateCover(dt) {
  if (!['entering','exiting'].includes(coverMode) || paused || panel || state.phase !== 'explore') return;
  coverTime += dt; const p=Math.min(1,coverTime/.8),ease=p*p*(3-2*p);
  const entering=coverMode==='entering',target=entering?hideWorld.cover.hidden:{...hideWorld.cover.approach,eyeY:1.65};
  position.x=THREE.MathUtils.lerp(coverFrom.x,target.x,ease); position.z=THREE.MathUtils.lerp(coverFrom.z,target.z,ease);
  eyeHeight=THREE.MathUtils.lerp(coverFrom.eyeY,target.eyeY,ease);
  pitch+=(0-pitch)*Math.min(1,dt*4);
  if (p>=1) {
    coverMode=entering?'hidden':'none';
    if(entering) trialAction(trials,'hide');
    else if(pendingCaught) {pendingCaught=false;triggerTrialScare();}
  }
}
function triggerTrialScare() {
  if(state.phase!=='explore') return;
  clearMovement(); hideWorld.reset(); sound.stopCommand?.();
  state.phase='lunge'; state.phaseTime=0; state.scareContext='trial'; state.preview=false;
  camera.position.set(position.x,1.65,position.z); eyeHeight=1.65; setScarePosition();
}
function trialFailed(reason) {
  if(state.phase!=='explore' || pendingCaught) return;
  trialFailureReason=reason; clearMovement(); sound.stopCommand?.();
  if(coverMode!=='none') exitCover(true); else triggerTrialScare();
}
function gazeAt(point, cone=.94) {
  camera.getWorldDirection(gazeDirection); gazeTarget.copy(point).sub(camera.position).normalize();
  return gazeDirection.dot(gazeTarget)>cone;
}
function updateTrialGame(dt,moving) {
  const frozen=paused || Boolean(panel) || Boolean(windowView) || !started || state.phase!=='explore';
  trialView=advanceTrials(trials,dt,{paused:frozen,moving,hidden:coverMode==='hidden',
    lookAtWindow:gazeAt(world.windowPanel.position,.985),lookAtTV:gazeAt(world.tvPoint,.985),
    lookBehind:Math.cos(yaw-commandYaw-Math.PI)>.86 && Math.abs(pitch)<.8});
  if(frozen) return;
  for(const event of trialView.events) {
    if(event.type==='command') {
      commandYaw=yaw;
      const aliases={window:'look-window',behind:'look-behind',tv:'look-tv','come-out-bait':'come-out-fake'};
      if(event.voiceKey!=='stay-hidden') sound.command?.(aliases[event.voiceKey]||event.voiceKey);
    } else if(event.type==='omen') {
      sound.omen?.(event);omenPulse=Math.max(omenPulse,event.intensity||.6);
    } else if(event.type==='success') sound.click();
    else if(event.type==='huntStart') {hunterLast=null;hunterStepDistance=0;sound.cue({type:'breath',pan:.5,intensity:.65});}
    else if(event.type==='fail') trialFailed(event.reason);
    else if(event.type==='complete') {
      state.doorUnlocked=true; state.phase='choice'; state.phaseTime=0; phaseChanged('explore');
    }
  }
  if(state.phase==='explore' && trials.status!=='idle') $('objective').textContent=trialView.objective;
}
function updateStalker(dt) {
  const cue = dreadFrame.stalker;
  // The old curved window figure intersected the pane and flickered through it.
  // Window unease now belongs to the actual courtyard, behind the glass.
  if (!cue || cue.kind === 'window' || paused || panel) { stalker.root.visible = false; return; }
  if (cue.id !== stalkerId) { stalkerId = cue.id; stalkerSeen = false; stalkerDismissed = false; stalkerAway = 0; }
  if (stalkerDismissed) { stalker.root.visible = false; return; }
  stalker.root.scale.setScalar(1);
  stalker.root.position.set(cue.x, 0, cue.z);
  stalker.root.lookAt(position.x, stalker.root.position.y, position.z);
  stalker.breathe(dread.time, 0);
  stalker.figure.material.color.setScalar(.34);
  stalkerPoint.set(cue.x, 1.84, cue.z).project(camera);
  const inView = stalkerPoint.z > -1 && stalkerPoint.z < 1 && Math.abs(stalkerPoint.x) < 1 && Math.abs(stalkerPoint.y) < 1;
  if (inView) { stalkerSeen = true; stalkerAway = 0; }
  else if (stalkerSeen) stalkerAway += dt;
  if (stalkerAway > .16) stalkerDismissed = true;
  stalker.root.visible = !stalkerDismissed;
}


function renderTV() {
  if (photoActive && !photoFailed && photo.image?.width) {
    crt.drawPhoto(photo.image, state.presses);
  } else {
    const words = photoActive ? ['YOU PRESSED IT.', 'THE SCREEN KNOWS.'] : state.phase==='explore' && trials.status!=='idle' ? trialView.message : signFrame.tvMessage || dreadFrame.tvMessage || (['hall','hallway'].includes(state.phase) ? ['IT REMEMBERS', 'YOUR CHOICE'] : ["DON'T PRESS", 'THE BUTTON']);
    crt.draw(visualTime, words, { button: !photoActive && ['intro', 'explore'].includes(state.phase),
      status: state.phase==='explore' && trials.status!=='idle' ? trialView.remaining===null ? 'LISTEN CAREFULLY.' : `${Math.ceil(trialView.remaining)} SECONDS` : 'TOUCH THE SCREEN TO BEGIN.', presses: state.presses });
  }
}
function canInvestigate() {
  return !windowView&&started&&!paused&&!panel&&state.phase==='explore'&&trials.status==='idle'&&coverMode==='none';
}
function receiverText(id,value) { if($(id).textContent!==value) $(id).textContent=value; }
function renderReceiver() {
  const available=canInvestigate();
  if(!started||state.phase!=='explore'||trials.status!=='idle'||coverMode!=='none') radioOpen=false;
  $('radioToggle').disabled=!available;
  $('radioToggle').setAttribute('aria-expanded',String(radioOpen&&available));
  $('fieldReceiver').hidden=!(radioOpen&&available);
  $('askSign').disabled=!available||signFrame.cooldown>0;
  receiverText('askSign',signFrame.busy?'Listening…':signFrame.cooldown>0?`Wait ${Math.ceil(signFrame.cooldown)}s`:'Ask for a sign');
  receiverText('radioReading',`${signFrame.meter} / 5`);
  receiverText('radioStatus',signFrame.message);
  for(let i=1;i<=5;i++) $('signalBar'+i).classList.toggle('lit',i<=signFrame.meter);
  const journal=signFrame.journal;
  receiverText('openJournal',`Journal · ${journal.length}/3`);
  receiverText('journalProgress',`${journal.length} of 3 responses recorded`);
  receiverText('journalRecords',journal.length?journal.map((entry,i)=>`${String(i+1).padStart(2,'0')} / ${entry.label}\n${entry.detail}`).join('\n\n'):'Use the field radio to ask for a sign. Listen and watch the room.');
}
function askForSign() {
  if(!canInvestigate()||!requestSign(signs)) return;
  clearMovement();sound.init();sound.radioRequest?.();
  signFrame=advanceSigns(signs,0,{active:true,reducedMotion});renderReceiver();
  toast('You asked the house for a sign. Listen.',2.6);
}
function toast(message, seconds = 3) {
  $('toast').textContent = message; $('toast').hidden = false; toastUntil = visualTime + seconds;
}
function unlockMouse() {
  if (document.pointerLockElement === canvas) { expectedUnlock = true; document.exitPointerLock(); }
}
function lockMouse() {
  if (phoneFirst || coarse || !canvas.requestPointerLock) return;
  try {
    const result = canvas.requestPointerLock();
    result?.catch(() => toast('Drag to look around. WASD still moves you.'));
  } catch { toast('Drag to look around. WASD still moves you.'); }
}
const readingPanels = new Set(['note', 'corner-note', 'attic-note', 'journal']);
function showPanel(name) {
  courtyardGirl.watch(0, {paused:true});
  sound.pause({ keepScore: readingPanels.has(name) });
  panel = name; $('overlay').hidden = false;
  document.querySelectorAll('[data-panel]').forEach(node => { node.hidden = node.dataset.panel !== name; });
  clearMovement(); drag = null; unlockMouse();
  $('interact').hidden = true; $('reticle').classList.remove('active');
}
function hidePanel() { panel = null; $('overlay').hidden = true; }
function resetView() {
  resetHallChapter(hallChapter);hallView=advanceHallChapter(hallChapter,0,{active:false});hallWorld.reset();showHome.reset();lessonYaw=lessonPitch=0;
  resetSigns(signs);signFrame=advanceSigns(signs,0,{active:false});signalWorld.reset();radioOpen=false;
  windowView = null;
  cornerHintRead = false; cornerSpirit.reset(); courtyardGirl.reset(); world.resetAtmosphere?.();
  coverMode='none';coverTime=0;eyeHeight=1.65;coverFrom=null;pendingCaught=false;trialFailureReason='';
  omenPulse=0;resetTrials(trials);trialView=advanceTrials(trials,0);hideWorld.reset();sound.stopCommand?.();
  stopWalking(); resetDread(dread, Date.now() >>> 0); stalker.root.visible = false;
  stalkerId = null; dreadFrame = { tension: 0, disturbance: 0, events: [], tvMessage: null, stalker: null };
  position.x = .9; position.z = .9; yaw = .36; pitch = -.025; camera.fov = 62; camera.zoom = WALK_ZOOM; camera.updateProjectionMatrix();
  doorAngle = 0; world.hinge.rotation.y = 0; creature.root.visible = false;
  photoActive = false;
  world.screenMaterial.map = crt.texture; world.screenMaterial.color.setHex(0xffffff);
  world.screenMaterial.needsUpdate = true; $('blackout').style.opacity = '0';
  renderTV();
  stepDistance = 0; clearMovement();
}
function begin() {
  state.presses = Math.max(state.presses, readPresses(storage));
  startRound(state); resetView(); started = true; paused = false; hidePanel(); renderTV();
  sound.init(); showHome.audio.resume(); sound.stopWarning(); $('objective').textContent = 'Tap the monitor to walk up to it. Drag to look around.';
  lockMouse();
}
function beginChapter() {
  begin();state.phase='hall';state.doorUnlocked=true;state.doorOpen=true;
  position.x=0;position.z=5.35;yaw=Math.PI;pitch=-.025;
  doorAngle=1.48;world.hinge.rotation.y=doorAngle;cancelLook();
  const before=state.phase;checkHall(state,position.z);phaseChanged(before);
}
function storedLesson(){
  try{return JSON.parse(storage?.getItem(CHECKPOINT_KEY)||'null');}catch{return null;}
}
function saveLesson(key,value){
  try{if(value===null)storage?.removeItem(key);else storage?.setItem(key,JSON.stringify(value));}catch{/* Private browsing can disable saves. */}
}
function resumeLesson(){
  const saved=hallChapter.checkpoint??storedLesson();
  if(!saved)return;
  beginChapter();
  if(!restoreShowCheckpoint(hallChapter,saved))return;
  position.x=.32;position.z=9.9;
  faceShowBody();hallView=advanceHallChapter(hallChapter,0,{active:false});
  $('toast').hidden=true;
}
function faceShowBody(){
  const t=showHome.figures.anchors.revealTarget;
  cutView(Math.atan2(position.x-t.x,position.z-t.z),Math.atan2(t.y-1.65,Math.hypot(t.x-position.x,t.z-position.z)));
  lessonYaw=yaw;lessonPitch=pitch;
}
function showAction(id){
  if(state.phase!=='hallway'||paused||panel)return;
  if(id.startsWith('walk:')){
    if(hallChapter.mirrorOpen)return;
    const dest=hallWorld.targets[{'walk:key':'hall-key','walk:phone':'hall-phone','walk:door':'front-door'}[id]];
    if(dest)walkTo(dest.approach,dest.point,'chapter');
    return;
  }
  const result=hallChapterAction(hallChapter,id);
  if(!result.accepted){if(result.copy)toast(result.copy);return;}
  clearMovement();$('toast').hidden=true;
  if(id==='hall-key'||id==='painting'||hallChapter.stage==='replay'){lessonYaw=yaw;lessonPitch=pitch;}
  if(id==='replace-painting'){showHome.audio.stop('mirror-scream');cutView(lessonYaw,lessonPitch);}
  if(id==='step-out'){porchStart={...position};cutView(Math.PI,0);}
  if(id==='hangup')for(const name of ['practice-1','practice-2','practice-3'])showHome.audio.stop(name);
  if(id==='cloth-full'||hallChapter.stage==='opening'){
    for(const name of ['stand-still','third-lesson','like-you','show-door','no-need','cant-see'])showHome.audio.stop(name);
  }
  updateHallGame(0);
}
function updateHallGame(dt){
  const active=started&&state.phase==='hallway',frozen=paused||Boolean(panel),prior=hallView.stage;
  hallView=advanceHallChapter(hallChapter,dt,{active,paused:frozen,player:position,yaw,pitch});
  if(!active||frozen)return;
  for(const e of hallView.events){
    if(e.type==='sound')showHome.sound(e.id);
    if(e.type==='checkpoint')saveLesson(CHECKPOINT_KEY,hallChapter.checkpoint);
  }
  $('objective').textContent=hallView.objective;
  if(hallView.stage==='mimic'&&prior==='rising')faceShowBody();
  if(hallView.stage==='crossing'||(hallView.stage==='outside'&&prior==='crossing')){
    const k=hallView.stage==='outside'?1:Math.min(1,hallView.stageTime/2.5);
    position.x=porchStart.x*(1-k);position.z=porchStart.z+(13.45-porchStart.z)*k;
    if(k===1)cutView(0,-.04);
  }
  if(hallView.stage==='porch'&&prior==='opening'){sound.pause();cutView(Math.PI,-.025);}
  if(hallView.stage==='graveyard'&&prior==='quiet'){
    const grave=hallWorld.targets['yard-tomb'].point;
    cutView(Math.atan2(position.x-grave.x,position.z-grave.z),
      Math.atan2(grave.y+.22-eyeHeight,Math.hypot(grave.x-position.x,grave.z-position.z)));
  }
  if(['trapped','escaped'].includes(hallView.stage)){
    if(hallView.stage==='escaped'){saveLesson(OUTSIDE_KEY,{chapter:2,location:'outside',x:position.x,z:position.z});saveLesson(CHECKPOINT_KEY,null);}
    const before=state.phase;state.phase='ending';state.phaseTime=0;phaseChanged(before);
  }
}
function applyPhoto() {
  photoActive = true; world.screenMaterial.map = crt.texture;
  world.screenMaterial.color.setHex(0xffffff); world.screenMaterial.needsUpdate = true; renderTV();
}
function beginPreview() {
  state.presses = Math.max(state.presses, readPresses(storage));
  startScarePreview(state); resetView();
  position.x = -.63; position.z = .2; yaw = 0; pitch = -.05;
  started = true; paused = false; hidePanel(); clearMovement(); renderTV();
  sound.init(); showHome.audio.resume(); sound.stopWarning(); applyPhoto(); $('objective').textContent = 'Jump scare preview · your count stays unchanged';
}
function beginTest() {
  if(paused||panel||state.phase!=='explore'||trials.status!=='idle') return;
  cancelSigns(signs);signFrame=advanceSigns(signs,0,{active:false});signalWorld.reset();radioOpen=false;
  clearMovement();startTrials(trials);trialView=advanceTrials(trials,0);
  sound.command?.('intro');commandYaw=yaw;renderTV();$('objective').textContent=trialView.objective;
}
function pressForbiddenButton() {
  if (paused || panel) return;
  state.presses = Math.max(state.presses, readPresses(storage));
  if (!pressButton(state)) return;
  cancelSigns(signs);signFrame=advanceSigns(signs,0,{active:false});signalWorld.reset();radioOpen=false;
  failTrials(trials,'You touched the forbidden button.');trialFailureReason='You touched the forbidden button.';sound.stopCommand?.();
  savePresses(storage, state.presses); renderTV(); clearMovement(); sound.stopWarning(); sound.click();
  applyPhoto(); toast('You pressed it.', 1.2);
  $('objective').textContent = 'The screen changed.';
}
function pauseGame() {
  if (!started || (paused && !readingPanels.has(panel)) || !['explore', 'hall', 'hallway', 'fakeout', 'lunge', 'scareHold', 'blackout'].includes(state.phase)) return;
  paused = true; showHome.audio.pause(); showPanel('pause');
}
function resumeGame() { paused=false;hidePanel();if(!['porch','crossing','outside','quiet','graveyard'].includes(hallChapter.stage))sound.resume();showHome.audio.resume();lockMouse(); }
function startHall(deeper) {
  if (!chooseHall(state, deeper)) return;
  photoActive = false; creature.root.visible = false;
  world.screenMaterial.map = crt.texture; world.screenMaterial.color.setHex(0xffffff); world.screenMaterial.needsUpdate = true; renderTV();
  $('blackout').style.opacity = '0'; hidePanel(); sound.resume(); sound.knock();
  $('objective').textContent = 'The latch released. Open the door behind you.';
  toast(deeper ? 'Something is waiting in the hallway.' : 'The door is unlocked. You can leave.'); lockMouse();
}
function setScarePosition() {
  camera.zoom = REVEAL_ZOOM; camera.updateProjectionMatrix();
  pitch = 0; camera.rotation.set(0, yaw, 0, 'YXZ');
  camera.updateMatrixWorld(); scareOrigin.copy(camera.position);
  camera.getWorldDirection(scareDirection); scareDirection.normalize();
  creature.root.visible = true; sound.stopWarning(); sound.scare();
}
function phaseChanged(before) {
  if (before === state.phase) return;
  if (state.phase === 'choice') {
    sound.stopWarning(); showPanel('choice'); $('objective').textContent = trials.status==='complete'?'You followed every order.':'You left the button alone.';
  } else if (state.phase === 'hallway') {
    startHallChapter(hallChapter);hallView=advanceHallChapter(hallChapter,0,{active:false});
    $('objective').textContent=hallView.objective;toast('CHAPTER II · The Show Home',4);
  } else if (state.phase === 'lunge') {
    setScarePosition();
  } else if (state.phase === 'aftermath') {
    creature.root.visible = false; hideWorld.reset(); showPanel('aftermath');
    const caught=state.scareContext==='trial'||trials.status==='failed';
    $('aftermathEyebrow').textContent=caught?'THE KEEPER FOUND YOU':'YOU PRESSED IT';
    $('aftermathTitle').innerHTML=caught?'It found<br>you.':"That wasn't<br>the joke.";
    $('aftermathCopy').textContent=caught?(trialFailureReason||trials.failureReason||'You broke the rule.'):'The picture was the easy part. The door is unlocked now.';
    $('failureExit').hidden=caught;
  } else if (state.phase === 'previewEnd') {
    creature.root.visible = false; showPanel('previewEnd');
  } else if (state.phase === 'ending') {
    creature.root.visible = false; sound.stopWarning(); showPanel('ending');
    $('endingChapter').textContent='CHAPTER II / THE SHOW HOME';
    if(!['escaped','trapped'].includes(hallChapter.stage)){
      $('endingTitle').textContent=state.deep?'It was waiting.':'You left it alone.';
      $('endingCopy').textContent=state.roundPressed?'You found the exit. The room kept your choice.':'You found the quiet way out.';
      $('showRetry').hidden=true;return;
    }
    const escaped=hallChapter.stage==='escaped';
    if(escaped)$('endingChapter').textContent='CHAPTER II / GAME OVER';
    $('endingTitle').textContent=escaped?'Outside.':'One person in the house.';
    $('endingCopy').textContent=escaped?'Cold stone under your hand. Behind the shut door, the house still has your voice.':'You can see the sink below you. Through the open door, your coat disappears into the rain.';
    $('showRetry').hidden=escaped;
    showHome.audio.reset();
  }
}
function interactionRange(id) {
  if(id==='yard-tomb')return 4;
  if (['corner-spirit','waving-woman','attic-box'].includes(id)) return 12;
  return ['tv','button'].includes(id) ? 3.4 : 2.25;
}
function interactionId(object) {
  while (object && object !== scene) {
    if (object.userData.interaction) return object.userData.interaction;
    if (/^CRT |^speaker grille$/.test(object.name)) return 'tv';
    object = object.parent;
  }
  return null;
}
function visibleInScene(object) {
  for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}
function cutView(angle, tilt) {
  yaw = angle;
  pitch = tilt;
  cancelLook();
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  camera.updateMatrixWorld();
}
function updateFocus(gazeSeconds) {
  focused = null;
  const atGrave=state.phase==='hallway'&&hallChapter.stage==='graveyard';
  if (!started || paused || panel || coverMode!=='none' || (state.phase==='hallway'&&!atGrave&&!freeHallMovement(hallChapter)) || !['explore', 'hall', 'hallway'].includes(state.phase)) {
    if (!paused && !panel) courtyardGirl.watch(0, {lookingAtWindow:false});
    $('interact').hidden = true; $('reticle').classList.remove('active'); return;
  }
  camera.updateMatrixWorld(); world.root.updateMatrixWorld(true);
  raycaster.setFromCamera(centre, camera);
  const hits = raycaster.intersectObjects([world.root,cornerSpirit.root], true);
  const hit = hits.find(h => visibleInScene(h.object));
  const id = hit && interactionId(hit.object);
  const atSash = Boolean(hit?.object.userData.windowGaze) && state.phase !== 'hallway';
  if (courtyardGirl.watch(gazeSeconds, {camera, lookingAtWindow:atSash, canPlace:(x,z)=>canStand(x,z,state.doorOpen)})) {
    clearMovement();
    windowView = {yaw, pitch};
    radioOpen = false;
    const offset = gazeDirection.copy(courtyardGirl.revealFocus()).sub(camera.position);
    cutView(Math.atan2(-offset.x,-offset.z), Math.atan2(offset.y,Math.hypot(offset.x,offset.z)));
    sound.scare();
    $('toast').hidden = true;
    focused = 'waving-woman';
  } else if (id && (!atGrave||id==='yard-tomb') && hit.distance < interactionRange(id)) {
    if (id !== 'button' || state.phase === 'explore') focused = id;
  }
  const labels = { cover:trialView.hideAllowed?'Hide under the table':'Inspect hiding place', button: 'Press the button', note: 'Read the TV tip', 'corner-note': 'Read the handwritten line', 'attic-box': 'Inspect the box', 'corner-spirit': 'Make it leave', 'waving-woman': 'Send her back', tv: 'Read the screen', door: state.doorUnlocked ? 'Open the door' : 'Try the door', 'hall-phone':'Answer the telephone', 'hall-key':'Lift the folded cloth', 'front-door':hallView.stage==='unlocked'?'Use the front-door key':'Try the front door' };
  $('interact').hidden = !focused || ['button', 'tv'].includes(focused);
  $('interactLabel').textContent = (hallWorld.targets[focused]?hallTargetLabel(hallChapter,focused):labels[focused]) || '';
  $('reticle').classList.toggle('active', Boolean(focused));
}
function interact() {
  if (paused || panel || coverMode!=='none' || !focused || (windowView && focused !== 'waving-woman')) return;
  if(hallWorld.targets[focused]) {
    showAction(focused);
  }else if(focused==='cover') {requestHide();
  } else if (focused === 'button') {
    pressForbiddenButton();
  } else if (focused === 'door') {
    if (openDoor(state)) { sound.knock(); $('objective').textContent = 'Walk down the hallway to the exit.'; }
    else { sound.click(); toast('The latch is holding. Listen to the television.'); }
  } else if (focused === 'waving-woman') {
    if (windowView && courtyardGirl.returnToWindow()) {
      world.courtyard.storm.cueNextWave();
      clearMovement();
      cutView(windowView.yaw, windowView.pitch);
      windowView = null;
      focused = null;
      toast('She’s back at the window.', 2);
    }
  } else if (focused === 'corner-spirit') {
    cornerSpirit.dismiss(); sound.cue({type:'whisper',pan:.7,intensity:.24}); toast('The corner is empty now.',1.8);
  } else if (focused === 'attic-box') {
    paused = true; showPanel('attic-note');
  } else if (focused === 'corner-note') {
    cornerHintRead = true; $('cornerClueCopy').textContent = CORNER_CLUE;
    paused = true; showPanel('corner-note');
  } else if (focused === 'note') {
    if(trialAction(trials,'note')) {sound.click();toast('The Keeper heard you.',2);return;}
    paused = true; showPanel('note');
  } else if (focused === 'tv') {
    if (trials.status==='idle' && state.phase === 'explore') beginTest();
    else toast(trialView.objective||"DON'T PRESS THE BUTTON.",4);
  }
}

$('enterRoom').disabled = false; $('enterRoom').textContent = requestedPreview ? 'Play jump scare' : requestedChapter ? 'Start Chapter II' : 'Start game';
if(touchMovement){
  $('lookHint').innerHTML='LEFT THUMB TO WALK<br>SWIPE TO LOOK';
  $('introCopy').textContent='Move with the joystick or tap the floor. Swipe with your other thumb to look around.';
}
if(requestedChapter&&!requestedPreview){$('introTitle').innerHTML='The Show<br>Home.';$('introCopy').textContent='Chapter II. The telephone is ringing in an empty kitchen. Pick it up.';}
$('showRetry').addEventListener('click',resumeLesson);
$('showContinue').hidden=!requestedChapter||!restoreShowCheckpoint(createHallChapter(),storedLesson());
$('showContinue').addEventListener('click',resumeLesson);
$('enterRoom').addEventListener('click', requestedPreview ? beginPreview : requestedChapter ? beginChapter : begin);
if (requestedPreview) {
  $('introTitle').textContent = 'See the jump scare.';
  $('introCopy').textContent = 'One tap plays the photo fake-out and the 3D lunge. The close-up holds so you can see the creature.';
}
document.querySelectorAll('[data-preview]').forEach(button => { button.disabled=false; button.addEventListener('click', beginPreview); });
document.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', requestedChapter ? beginChapter : begin));
document.querySelectorAll('[data-restart]').forEach(button => button.addEventListener('click', requestedChapter ? beginChapter : begin));
document.querySelectorAll('[data-deeper]').forEach(button => button.addEventListener('click', () => startHall(true)));
document.querySelectorAll('[data-leave]').forEach(button => button.addEventListener('click', () => startHall(false)));
document.querySelectorAll('[data-resume]').forEach(button => button.addEventListener('click', resumeGame));
$('pause').addEventListener('click', pauseGame); $('interact').addEventListener('click', interact);
$('radioToggle').addEventListener('click',()=>{if(canInvestigate()){radioOpen=!radioOpen;renderReceiver();}});
$('closeReceiver').addEventListener('click',()=>{radioOpen=false;renderReceiver();});
$('askSign').addEventListener('click',askForSign);
$('openJournal').addEventListener('click',()=>{if(!canInvestigate())return;paused=true;showPanel('journal');renderReceiver();});
$('mute').addEventListener('click', () => { const muted = sound.toggle(); showHome.audio.setMuted(muted); $('mute').textContent = muted ? 'Sound off' : 'Sound on'; $('mute').setAttribute('aria-pressed', String(muted)); });
$('fullScreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { toast('Use your browser’s full-screen control.'); }
});
document.addEventListener('keydown', event => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) && started && !panel) event.preventDefault();
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) stopWalking();
  if(started&&!paused&&!panel&&coverMode==='hidden'&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){requestLeaveCover();return;}
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyE') interact();
  if(event.code==='KeyC'&&started&&!paused&&!panel){if(coverMode==='hidden')requestLeaveCover();else requestHide();}
  if (event.code === 'KeyF') { lightEnabled = !lightEnabled; toast(lightEnabled ? 'Flashlight on' : 'Flashlight off', 1.5); }
  if (event.code === 'Escape' && document.pointerLockElement !== canvas) { if (paused) resumeGame(); else pauseGame(); }
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { clearMovement(); pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearMovement(); pauseGame(); } });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && hadPointerLock && !expectedUnlock && !panel) pauseGame();
  hadPointerLock = locked; expectedUnlock = false;
});
document.addEventListener('pointerlockerror', () => toast('Drag to look around. WASD still moves you.'));
function gameOwnsGestures() { return started&&!paused&&!panel; }
function canLook() { return gameOwnsGestures()&&['explore','hall','hallway'].includes(state.phase)&&!['entering','exiting'].includes(coverMode); }
function cancelLook() { lookControl.cancel(yaw,pitch); }
function preventGameplayScroll(event) {
  if(gameOwnsGestures()&&!event.target?.closest?.('#overlay')&&event.cancelable!==false) event.preventDefault();
}
function look(dx, dy, options = {}) {
  if(windowView || !canLook())return;
  walkLook = null;
  lookControl.add(dx,dy,{yaw,pitch,width:window.innerWidth,height:window.innerHeight,...options});
}
document.addEventListener('mousemove', event => { if (document.pointerLockElement === canvas) look(event.movementX, event.movementY); });
canvas.addEventListener('pointerdown', event => {
  preventGameplayScroll(event);
  if(!canLook()||event.button>0||(event.isPrimary===false && !(event.pointerType==='touch' && stickPointer!==null)))return;
  if (document.pointerLockElement === canvas) return;
  if (drag) return;
  cancelLook();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, touch: event.pointerType==='touch'||coarse };
  try { canvas.setPointerCapture(event.pointerId); } catch { /* A cancelled native gesture may already own this pointer. */ }
},{passive:false});
canvas.addEventListener('pointermove', event => {
  preventGameplayScroll(event);
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 9) return;
  const dx = event.clientX - (drag.moved ? drag.x : drag.startX);
  const dy = event.clientY - (drag.moved ? drag.y : drag.startY);
  look(dx,dy,{touch:drag.touch,start:!drag.moved});drag.moved = true;drag.x = event.clientX;drag.y = event.clientY;
},{passive:false});
canvas.addEventListener('pointerup', event => {
  preventGameplayScroll(event);
  if (!drag || drag.id !== event.pointerId) return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>9){
    look(event.clientX-drag.startX,event.clientY-drag.startY,{touch:drag.touch,start:true});drag.moved=true;
  } else if(drag.moved&&(event.clientX!==drag.x||event.clientY!==drag.y)){
    look(event.clientX-drag.x,event.clientY-drag.y,{touch:drag.touch});
  }
  if (!drag.moved) tapObject(event.clientX, event.clientY);
  drag = null;
},{passive:false});
for(const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type,event=>{
  if(drag?.id===event.pointerId){drag=null;cancelLook();}
});
canvas.addEventListener('touchstart',preventGameplayScroll,{passive:false});
canvas.addEventListener('touchmove',preventGameplayScroll,{passive:false});
canvas.addEventListener('contextmenu',event=>{if(gameOwnsGestures())event.preventDefault();});
document.addEventListener('touchmove',preventGameplayScroll,{passive:false});
canvas.addEventListener('wheel',event=>{
  if(event.ctrlKey||event.metaKey||!gameOwnsGestures())return;
  preventGameplayScroll(event);if(!canLook()||drag)return;
  const unit=event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1;
  const dx=(event.deltaX||0)*unit,dy=(event.deltaY||0)*unit,scale=120/Math.max(120,Math.abs(dx),Math.abs(dy));
  look(dx*scale,dy*scale);
},{passive:false});
canvas.addEventListener('click', () => { if (document.pointerLockElement === canvas) interact(); });
function tapObject(x, y) {
  const atGrave=state.phase==='hallway'&&hallChapter.stage==='graveyard';
  if (!started || paused || panel || coverMode!=='none' || (state.phase==='hallway'&&!atGrave&&!freeHallMovement(hallChapter)) || !['explore', 'hall', 'hallway'].includes(state.phase)) return;
  const rect = canvas.getBoundingClientRect();
  camera.updateMatrixWorld(); world.root.updateMatrixWorld(true);
  raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects([world.root,cornerSpirit.root], true).find(h => visibleInScene(h.object));
  if (!hit || hit.distance > 12) return;
  const id = interactionId(hit.object);
  if (atGrave){if(id==='yard-tomb'&&hit.distance<interactionRange(id))showAction(id);return;}
  if (id==='yard-tomb')return;
  if (windowView && id !== 'waving-woman') return;
  if (id) {
    if(id==='cover'){requestHide();return;}
    const chapterTarget=hallWorld.targets[id];
    if (hit.distance > interactionRange(id)) {
      const target = chapterTarget ? chapterTarget.approach : id === 'tv' || id === 'button' ? { x: .55, z: -.2 }
        : id === 'corner-note' ? { x: -.3, z: -.7 }
        : id === 'note' ? { x: -1.60, z: -2.2 } : { x: 0, z: position.z < 4.45 ? 3.45 : 5.45 };
      walkTo(target,chapterTarget?chapterTarget.point:id==='tv'||id==='button'?world.tvPoint:null,id==='painting'?'painting':chapterTarget?'chapter':null);
      return;
    }
    stopWalking(); focused = id; interact(); return;
  }
  if(hit.object.userData.stairFlight){
    const descend=stairHeight(position.x,position.z)>.2&&hit.point.z<position.z-.12;
    walkTo({x:Math.max(2.64,Math.min(3.82,hit.point.x)),z:descend?.85:3.89});
    return;
  }
  if (hit.object.userData.walkSurface || /floor|rug/i.test(hit.object.name)) {
    walkTo({x:hit.point.x,z:hit.point.z});
  } else toast('Tap the floor to walk, or tap the monitor to approach it.', 2);
}
function clearMovement() {
  const captured=drag?.id;drag=null;
  if(captured!==undefined){try{canvas.releasePointerCapture?.(captured);}catch{/* Already released by the browser. */}}
  cancelLook();
  stopWalking();
  keys.clear(); resetStick();
}
$('stopMoving').addEventListener('click', () => { if(coverMode==='hidden')requestLeaveCover();else{stopWalking();toast('Stopped.',1);} });
const stick = $('moveStick');
function movementAllowed() {
  return started && !paused && !panel && !windowView && coverMode==='none'
    && ['explore','hall','hallway'].includes(state.phase)
    && (state.phase!=='hallway'||freeHallMovement(hallChapter));
}
function resetStick() {
  const pointer=stickPointer;
  stickPointer=null;moveAxis.x=0;moveAxis.y=0;
  const pad=$('moveStick');
  if(pointer!==null && pad.hasPointerCapture?.(pointer))pad.releasePointerCapture(pointer);
  $('stickThumb').style.transform='translate(-50%,-50%)';
}
function updateStick(event) {
  const rect = stick.getBoundingClientRect();
  const value = joystickVector(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, rect.width * .34);
  moveAxis.x = value.x; moveAxis.y = value.y;
  $('stickThumb').style.transform = `translate(calc(-50% + ${value.x * rect.width * .285}px),calc(-50% + ${value.y * rect.width * .285}px))`;
}
stick.addEventListener('pointerdown', event => {
  if (stickPointer !== null || !touchMovement || !movementAllowed()) return;
  event.preventDefault(); stopWalking(); stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); updateStick(event);
});
stick.addEventListener('pointermove', event => { if (event.pointerId === stickPointer) updateStick(event); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, event => {
  if (event.pointerId === stickPointer) resetStick();
});
function resize() {
  const width = window.innerWidth, height = window.innerHeight;
  camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize); resize(); renderTV(); resetView();

function frame(timestamp) {
  const elapsed = lastFrame ? Math.max(0, (timestamp - lastFrame) / 1000) : 0;
  const dt = Math.min(.033, elapsed);
  lastFrame = timestamp; visualTime += dt;
  if(!paused&&!panel)omenPulse=Math.max(0,omenPulse-dt*.38);
  if (started && !paused && !panel && !windowView) {
    const before = state.phase; advance(state, dt); phaseChanged(before);
  }
  let viewZoom=WALK_ZOOM;
  if(['fakeout','lunge','scareHold','blackout'].includes(state.phase))viewZoom=REVEAL_ZOOM;
  else if(state.phase==='hallway'){
    if(hallChapter.stage==='hand')viewZoom=.84;
    else if(hallChapter.stage==='graveyard')viewZoom=.98;
    else if(['replay','imprint','reflection'].includes(hallChapter.stage))viewZoom=.88;
    else if(['replaced','trapped'].includes(hallChapter.stage))viewZoom=.85;
  }
  else if(state.phase==='ending'&&hallChapter.stage==='escaped')viewZoom=.98;
  if (camera.zoom !== viewZoom) { camera.zoom = viewZoom; camera.updateProjectionMatrix(); }
  let moving = false;
  if(canLook()) { const view=lookControl.step(dt,{yaw,pitch});yaw=view.yaw;pitch=view.pitch; }
  signFrame=advanceSigns(signs,dt,{active:started&&state.phase==='explore'&&trials.status==='idle'&&coverMode==='none',paused:paused||Boolean(panel)||Boolean(windowView),reducedMotion});
  for(const event of signFrame.events){if(event.type==='voice')sound.radioReply?.();else sound.cue(event);}
  dreadFrame = updateDread(dread, dt, { ...state, paused: state.phase==='hallway' || paused || Boolean(panel) || Boolean(windowView) || !started || signFrame.busy || trials.status!=='idle'&&state.phase==='explore', reducedMotion });
  for (const event of dreadFrame.events) sound.cue(event);
  if (movementAllowed()) {
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - moveAxis.y;
    const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + moveAxis.x;
    const magnitude = Math.hypot(forward, sideways);
    const oldX = position.x, oldZ = position.z;
    if (magnitude > 0) {
      const speed = keys.has('ShiftLeft') ? 2.5 : 1.7;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * sideways) / Math.max(1, magnitude) * speed * dt;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * sideways) / Math.max(1, magnitude) * speed * dt;
      stopWalking();
      movePlayer(position, dx, dz, state.doorOpen && doorAngle > 1.18);
    } else if (walkPath.length) {
      const result = stepPath(position, walkPath, dt, state.doorOpen && doorAngle > 1.18, 1.45);
      if (walkLook) {
        const dx = walkLook.x - position.x, dz = walkLook.z - position.z;
        yaw = angleToward(yaw, Math.atan2(-dx, -dz), dt * 3);
        pitch += (Math.atan2(walkLook.y - 1.65, Math.hypot(dx, dz)) - pitch) * Math.min(1, dt * 3);
        cancelLook();
      }
      if (result.done) {
        const wasMonitor = Boolean(walkLook)&&walkAction!=='chapter', action=walkAction; stopWalking();
        if (result.blocked) toast('The way is blocked.', 2);
        else if(action==='hide') enterCover();
        else if(action==='painting')showAction('painting');
        else if(action==='chapter')toast('Tap the object again to inspect it.',2);
        else if (wasMonitor) { toast('Tap the TV lettering to begin the Keeper’s game.', 4); $('objective').textContent = 'Tap the monitor lettering to start the instructions.'; }
        else $('objective').textContent = 'Tap the floor to walk. Drag to look around.';
      }
    }
    const distance = Math.hypot(position.x - oldX, position.z - oldZ); moving = distance > .0001;
    stepDistance += distance;
    if (stepDistance > .59) { stepDistance = 0; sound.footstep(); }
    const before = state.phase; if(Math.abs(position.x)<.9)checkHall(state, position.z); phaseChanged(before);
  }
  if (!paused && state.phase === 'fakeout') {
    const dx = world.tvPoint.x - position.x, dz = world.tvPoint.z - position.z;
    yaw = angleToward(yaw, Math.atan2(-dx, -dz), dt * 5);
    pitch += (Math.atan2(world.tvPoint.y - 1.65, Math.hypot(dx, dz)) - pitch) * Math.min(1, dt * 5);
  }
  updateCover(dt);
  const breath = Math.sin(visualTime * 1.65) * (reducedMotion ? .002 : .008 + dreadFrame.tension * .006);
  const bob = moving && !reducedMotion ? Math.sin(visualTime * 10) * .023 : 0;
  camera.position.set(position.x, stairHeight(position.x,position.z) + eyeHeight + (coverMode==='hidden'?breath*.3:breath) + bob, position.z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  camera.updateMatrixWorld();updateTrialGame(dt,moving);updateHallGame(Math.min(.25,elapsed));updateStalker(dt);
  cornerSpirit.update(dt,{active:started&&['explore','hall','hallway'].includes(state.phase),
    paused:paused||Boolean(panel),camera,hintRead:cornerHintRead,reducedMotion});
  const huntPose=hideWorld.update(visualTime,{active:trialView.huntActive&&state.phase==='explore',seekTime:trialView.seekTime,seekDuration:trialView.huntDuration||12,player:position,hidden:coverMode==='hidden',reducedMotion,paused:paused||Boolean(panel)});
  if(huntPose.active){
    if(!paused&&!panel&&hunterLast&&huntPose.moving)hunterStepDistance+=Math.hypot(huntPose.x-hunterLast.x,huntPose.z-hunterLast.z);
    if(!paused&&!panel&&hunterStepDistance>.55){hunterStepDistance=0;sound.footstep();}
    hunterLast={x:huntPose.x,z:huntPose.z};
  }else hunterLast=null;
  const isScare = ['lunge', 'scareHold', 'blackout'].includes(state.phase);
  if (['lunge', 'scareHold'].includes(state.phase)) {
    const p = state.phase === 'scareHold' ? 1 : Math.min(1, state.phaseTime / TIMING.lunge), ease = lungeProgress(p);
    const endDistance = scareEndDistance(camera.aspect, camera.fov);
    creature.root.position.copy(scareOrigin).addScaledVector(scareDirection, 2.6 - (2.6 - endDistance) * ease);
    creature.root.position.y = camera.position.y - 1.84;
    creature.root.lookAt(camera.position.x, creature.root.position.y, camera.position.z);
    creature.breathe(visualTime * 1.6, ease);
    if (!reducedMotion && p < .65) camera.rotation.z = Math.sin(p * 20) * .003 * (1-p);
    else camera.rotation.z=0;
  }
  if (state.phase === 'blackout') $('blackout').style.opacity = '1';
  else if (!['aftermath', 'ending', 'previewEnd'].includes(state.phase)) $('blackout').style.opacity = '0';
  const disturbance=Math.max(dreadFrame.disturbance,omenPulse*.65);
  if(!paused&&!panel){
  world.lamp.intensity += ((isScare ? .5 : state.phase === 'fakeout' ? 2 : world.lighting.lamp * (1 - disturbance * .7)*(1-signFrame.visual.lampDip*.2)) - world.lamp.intensity) * Math.min(1, dt * 7);
  world.ceilingLight.intensity += ((isScare ? .2 : state.deep ? 3 : world.lighting.ceiling * (1 - disturbance * .6)*(1-signFrame.visual.lampDip*.12)) - world.ceilingLight.intensity) * Math.min(1, dt * 7);
  world.hallLight.color.setHex(state.deep ? 0x7c9e8a : 0xa2b5aa);
  world.hallLight.intensity = state.deep ? 1.4 + Math.sin(visualTime * 1.4) * .25 : world.lighting.hall;
  }
  flashlight.intensity = isScare ? 8 : coverMode!=='none' ? .18 : lightEnabled ? 5.5 : 0;
  const weather = started && ['explore', 'hall'].includes(state.phase) ? {
    elapsed: Math.min(.1, elapsed),
    angle: courtyardGirl.pose.angle, stare: courtyardGirl.stareSeconds,
    womanVisible: courtyardGirl.root.visible, behind: courtyardGirl.apparition.visible,
  } : null;
  const toWindowX = world.windowPanel.position.x - position.x;
  const toWindowZ = world.windowPanel.position.z - position.z;
  const windowDistance = Math.hypot(toWindowX, toWindowZ);
  const windowRain = weather ? .14 + .86 * Math.max(0, 1 - windowDistance / 8.5) : 0;
  const frozen = paused || Boolean(panel);
  const rumble = world.updateAtmosphere(visualTime, {
    tension: Math.max(dreadFrame.tension, trialView.tension), disturbance, reducedMotion, paused: frozen, weather,
  });
  courtyardGirl.update(timestamp / 1000, {paused: frozen, reducedMotion, lightning: world.courtyard.storm.level});
  if (rumble) {
    const pan = (Math.cos(yaw) * toWindowX - Math.sin(yaw) * toWindowZ) / Math.max(.1, windowDistance);
    sound.cue({type: 'thunder', pan: pan * .62, intensity: rumble * (.45 + .55 * windowRain)});
  }
  signalWorld.update(signFrame,{paused:paused||Boolean(panel),reducedMotion});
  hallWorld.update({...hallView,active:started&&['hallway','ending'].includes(state.phase),watcher:hallView.watcherAmount},visualTime,{paused:paused||Boolean(panel),reducedMotion});
  if (started && !paused && !panel) sound.update(dt, {tension:Math.max(dreadFrame.tension,trialView.tension,signFrame.meter*.1,hallView.lightDip*.8),moving,windowRain});
  $('hauntVeil').style.opacity = String(isScare||reducedMotion ? 0 : coverMode==='hidden'?.38:disturbance*.35);
  world.button.visible = ['intro', 'explore'].includes(state.phase);
  doorAngle += ((state.doorOpen ? 1.48 : 0) - doorAngle) * Math.min(1, dt * 3);
  world.hinge.rotation.y = -doorAngle;
  world.dust.rotation.y = Math.sin(visualTime * .04) * .03;
  if (visualTime - lastScreen > .11) { renderTV(); lastScreen = visualTime; }
  if (visualTime > toastUntil) $('toast').hidden = true;
  $('stopMoving').textContent=coverMode==='none'?'Stop walking':'Leave cover';
  $('stopMoving').disabled=coverMode==='entering'||coverMode==='exiting';
  $('stopMoving').hidden=!(walkPath.length||coverMode!=='none');
  const active = started && !paused && !panel && state.phase === 'explore';
  if (document.body.dataset.phase !== state.phase) document.body.dataset.phase = state.phase;
  document.body.dataset.inputMode=gameOwnsGestures()?'game':'menu';
  stick.hidden=!touchMovement||!movementAllowed();
  if(stick.hidden && stickPointer!==null)resetStick();
  $('mobileControls').hidden = !started || paused || Boolean(panel) || !['explore', 'hall', 'hallway'].includes(state.phase);
  updateFocus(elapsed);
  document.body.dataset.windowScare = String(Boolean(windowView));
  const inYard=['porch','crossing','outside','quiet','graveyard'].includes(hallView.stage);
  const hallStatus=inYard?'':hallView.inventory||'Tap floor to walk · drag to look';
  $('decisionStatus').textContent = windowView && !panel ? 'Tap her to send her back.' : active ? trials.status!=='idle'?coverMode==='hidden'?(trialView.canLeave?'Keeper says: come out.':'Stay hidden. Listen to the whole order.'):trialView.status==='hideCountdown'?`Hide · ${Math.ceil(trialView.remaining)} seconds`:trialView.objective:walkPath.length?'Walking · tap Stop to stand still':'Tap floor to walk · drag to look' : state.phase==='hallway' ? hallStatus : state.preview ? 'Jump scare preview' : '';
  showHome.update(hallView,{...position,yaw,pitch,baseYaw:lessonYaw,basePitch:lessonPitch,lookOffset:Math.atan2(Math.sin(yaw-lessonYaw),Math.cos(yaw-lessonYaw))},{active:started&&['hallway','ending'].includes(state.phase),visible:!panel&&!paused});
  renderReceiver();showHome.renderReflection(scene);renderer.render(scene,camera);
}
renderer.setAnimationLoop(frame);
window.addEventListener('pagehide', () => { sound.pause(); showHome.audio.pause(); renderer.setAnimationLoop(null); });
window.addEventListener('pageshow', event => {
  if (event.persisted) { lastFrame = 0; renderer.setAnimationLoop(frame); if (started) pauseGame(); }
});
