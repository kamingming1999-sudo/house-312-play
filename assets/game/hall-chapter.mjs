// All chapter clocks run on active play time. A tape is a pair of short, dated
// excerpts from this run. The playback cursor never dispatches recorded input.
export const COPY_DELAY = .72;
export const KEYHOLE_HOLD = 3.2;
const MIRROR_SCREAM_AT = .58;
export const CHECKPOINT_KEY = 'house312.showhome.rehearsal.v1';
export const OUTSIDE_KEY = 'house312.showhome.porch.v1';
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const amount = n => clamp(n,0,1);
const defaultPose = () => ({x:0,z:5.35,yaw:Math.PI,pitch:0,crouch:0,raise:0,reach:0,phone:0,stride:0});
const captions = {
  ring:'[A telephone rings in the kitchen.]',
  greeting:'TELEPHONE   Hello. Before you leave, please confirm there is one person in the house.',
  'player-line':'YOU   [Two short coughs.] I’m here. I want to go out.',
  'echo-cough':'[The receiver coughs twice. Exactly your rhythm.]',
  'key-instructions':'TELEPHONE   Confirmed. The key is under the cloth. Once you have it, wait for three knocks.',
  hangup:'[You set down the receiver.]', 'echo-hangup':'[A second receiver settles, one beat late.]',
  'practice-1':'TELEPHONE   I … want … to go out.', 'practice-2':'TELEPHONE   I want to go out.', 'practice-3':'YOUR VOICE, ON THE LINE   I want to go out.',
  'dont-cover':'TELEPHONE   Please don’t cover that. I can’t follow.',
  'knock-1':'[KNOCK 1 · Inside the counter. The brass key is in your hand.]',
  'knock-2':'[KNOCK 2 · The canvas bucks against its frame.]',
  'knock-3':'[KNOCK 3 · Inside your chest. Across the room, your double moves first.]',
  'step-echo':'[Your last footstep lands behind you.]',
  unlock:'[The key turns. The door is still shut. Warm light leaks from the keyhole.]',
  'show-door':'TELEPHONE   Good. Now show me how to open the door.',
  rise:'[The sink lifts. Cabinet hinges crack like knuckles.]',
  'stand-still':'TELEPHONE   If you don’t move, I can’t learn.',
  'third-lesson':'TELEPHONE   Just the door now. After the third knock, you won’t have to show me.',
  'like-you':'TELEPHONE   Don’t be afraid. I’ll look just like you.',
  'no-need':'TELEPHONE   You don’t need to do that. Just the door, please.',
  'paper-cover':'[Wallpaper tears. It presses the paper over its own painted eyes.]',
  'cant-see':'TELEPHONE   I can’t see. Have you done the next one? Could you do it again?',
  'door-open':'[The front door swings open.]', 'door-close':'[The door catches shut behind you.]',
  'outside':'[Open air. Birds call from beyond the porch.]',
  'knock-recording':'[From inside: tape hiss. The first two knocks play back.]',
  'retained-line':'YOUR RECORDED VOICE, INSIDE   [Two short coughs.] I’m here. I want to go out.',
  replacement:'YOUR DOUBLE   Oh. That’s how it opens. Thank you.',
  'latch-warning':'[Your fingers touch the handle. Another hand copies them. The latch stays shut.]',
  'keyhole-cough':'[Your cough comes through the keyhole.]',
  'echo-reach':'[Slate scrapes. The fingers copy your reach.]',
  'test-cover':'[The cloth passes over the painting. The hand stops mid-gesture.]',
  'test-clear':'[Light touches the painted eyes. The fingers move again.]',
  'film-drag':'[The film sticks. A face made of wallpaper fills the keyhole.]',
  'projector':'[A tape catches. You recognize the sleeve, then the gesture.]',
};
const duration = {'greeting':5.2,'player-line':3.6,'key-instructions':6,'no-need':3.7,'cant-see':5.5,'third-lesson':5,'like-you':3.4,'show-door':3.6,'stand-still':3,'replacement':3.6};
function cue(s,id,delay=0,copy=captions[id],seconds=duration[id]??2.5) {
  s.pending.push({at:s.elapsed+delay,id,copy:copy??'',seconds});
}
function stage(s,name) {s.stage=name;s.stageTime=0;}
function knock(s,n) {
  if (s.knocks !== n-1) return;
  s.knocks=n;
  cue(s,'knock-'+n);
  s.notifications.push({type:'story-knock',index:n});
}
export function createHallChapter() {
  return {stage:'dormant',stageTime:0,elapsed:0,phoneAnswered:false,keyTaken:false,hasCloth:false,knocks:0,
    phoneUp:false,practice:0,callDoneAt:0,reach:0,handPose:0,clothTest:false,testPlayed:false,testEnds:0,
    doorUnlocked:false,eyeCover:'',clothLevel:0,raised:false,crouched:false,stoodAt:0,copyQueue:[],copied:defaultPose(),
    mirrorOpen:false,mirrorTime:0,pose:defaultPose(),rolling:[],clips:[],lastSample:-1,playTime:0,returnSlot:false,
    nextRing:.45,stepDistance:0,stepTime:0,gaitBeat:.42,lastPosition:null,stride:0,doorAmount:0,
    caption:'',captionUntil:0,voiceCaption:'',voiceUntil:0,pending:[],notifications:[],checkpoint:null};
}
export function resetHallChapter(s){Object.assign(s,createHallChapter());return s;}
export function startHallChapter(s){if(s.stage==='dormant')stage(s,'search');return s;}
function saveMoment(s,label) {
  if(s.clips.some(c=>c.label===label))return;
  const from=Math.max(0,s.elapsed-1.5);
  s.clips.push({label,eventAt:s.elapsed,from,to:s.elapsed+2.5,frames:s.rolling.filter(f=>f.t>=from).map(f=>({...f}))});
}
function record(s) {
  if(s.elapsed-s.lastSample<.075)return;
  s.lastSample=s.elapsed;
  const f={t:s.elapsed,...s.pose};
  s.rolling.push(f);while(s.rolling.length&&s.rolling[0].t<s.elapsed-1.6)s.rolling.shift();
  for(const c of s.clips)if(f.t>=c.from&&f.t<=c.to)c.frames.push(f);
}
function playback(s) {
  let time=s.playTime;
  for(const [i,c] of s.clips.entries()){
    const length=c.to-c.from;
    if(time<=length || i===s.clips.length-1){
      const t=c.from+clamp(time,0,length),frames=c.frames;
      const right=frames.findIndex(f=>f.t>=t);
      const a=frames[right<=0?(right===0?0:frames.length-1):right-1]??s.pose,b=frames[right]??a;
      const k=amount((t-a.t)/(b.t-a.t||1)),p={...a};
      for(const key of ['x','z','pitch','reach','phone','crouch','raise','stride'])p[key]=a[key]+(b[key]-a[key])*k;
      p.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*k;
      // Stride is cumulative. At a counter the last walking phase stays on
      // the tape, but both feet settle when the recorded positions stop.
      p.gait=b.t>a.t?amount(Math.hypot(b.x-a.x,b.z-a.z)/(b.t-a.t)):0;
      return {pose:p,label:c.label,time:t,splice:i};
    }
    time-=length;
  }
  return null;
}
function checkpoint(s) {
  return {version:1,stage:'mimic',phoneAnswered:true,keyTaken:true,hasCloth:true,doorUnlocked:true,knocks:2,
    eyeCover:s.eyeCover==='direct'?'direct':'',clips:s.clips.map(c=>({...c,frames:c.frames.map(f=>({...f}))})),stride:s.stride,gaitBeat:s.gaitBeat};
}
export function restoreShowCheckpoint(s,value) {
  if(value?.version!==1||value.stage!=='mimic'||value.knocks!==2||!value.keyTaken||!value.hasCloth||!value.doorUnlocked||
    !Array.isArray(value.clips)||value.clips.length!==2||!value.clips.every(c=>Array.isArray(c.frames)&&c.frames.length>0&&c.frames.length<=80&&Number.isFinite(c.from)&&Number.isFinite(c.to)&&c.frames.every(f=>Object.keys(defaultPose()).every(k=>Number.isFinite(f[k]))&&Number.isFinite(f.t))))return false;
  resetHallChapter(s);
  Object.assign(s,{stage:'mimic',phoneAnswered:true,keyTaken:true,hasCloth:true,doorUnlocked:true,knocks:2,
    eyeCover:value.eyeCover==='direct'?'direct':'',clips:value.clips,stride:Number.isFinite(value.stride)?value.stride:0,gaitBeat:Number.isFinite(value.gaitBeat)?clamp(value.gaitBeat,.22,1.1):.42,stoodAt:-4,testPlayed:true});
  s.copied.stand=s.eyeCover?0:1;
  s.checkpoint=checkpoint(s);return true;
}
const talking=s=>s.stage==='call'||s.stage==='practice';
const accepted = {accepted:true};
function blocked(copy){return {accepted:false,copy};}
function beginReplay(s,skipped){
  s.pending=s.pending.filter(e=>e.id!=='keyhole-cough'&&e.id!=='step-echo');s.captionUntil=0;
  stage(s,skipped?'latch':'replay');s.playTime=0;s.returnSlot=false;
  if(skipped){cue(s,'latch-warning',0,s.eyeCover?'[You touch the handle. The latch stays shut.]':captions['latch-warning']);cue(s,'third-lesson',.75);}
  else cue(s,'projector');
  return accepted;
}
export function hallChapterAction(s,id) {
  if(s.stage==='dormant')return blocked('Enter the hallway first.');
  if(s.mirrorOpen){
    if(id!=='replace-painting')return blocked('Put the painting back first.');
    s.mirrorOpen=false;s.mirrorTime=0;return accepted;
  }
  switch(id){
  case 'hall-phone':
    if(!['search','travel','unlocked'].includes(s.stage))return blocked('The line is busy.');
    s.returnSlot=s.stage;s.phoneUp=true;
    if(!s.phoneAnswered){
      s.phoneAnswered=true;stage(s,'call');saveMoment(s,'Lifting the receiver');
      cue(s,'greeting');cue(s,'player-line',5.35);cue(s,'echo-cough',9.1);cue(s,'key-instructions',10.35);
      s.callDoneAt=s.elapsed+16.5;
    }else{
      stage(s,'practice');s.practice=Math.min(3,s.practice+1);cue(s,'practice-'+s.practice);
      if(s.practice<3)cue(s,'practice-'+(s.practice+1),3.2);
      if(s.practice===1)cue(s,'practice-3',6.5);
      s.callDoneAt=s.elapsed;
    }return accepted;
  case 'hangup':
    if(!talking(s)||s.elapsed<s.callDoneAt)return blocked('Listen to the end of the message.');
    s.pending=s.pending.filter(e=>!e.id.startsWith('practice-'));s.voiceUntil=0;
    s.phoneUp=false;stage(s,s.returnSlot||'search');s.returnSlot=false;cue(s,'hangup');cue(s,'echo-hangup',.72);return accepted;
  case 'hall-key':
    if(!s.phoneAnswered||talking(s))return blocked('The rotary telephone is ringing.');
    if(!['search','travel','unlocked'].includes(s.stage))return blocked('The counter is quiet.');
    s.returnSlot=s.stage;stage(s,'hand');s.reach=0;cue(s,'cloth',0,'[A wrist vanishes into a gap thinner than two fingers.]',3);return accepted;
  case 'reach':
    if(s.stage!=='hand')return blocked('');
    s.reach=s.reach?0:1;
    if(s.reach){saveMoment(s,'Reaching into the seam');cue(s,'echo-reach');
      if(!s.testPlayed&&!s.eyeCover){s.testPlayed=true;s.testEnds=s.elapsed+2.1;cue(s,'test-cover',.48);cue(s,'dont-cover',2.15);}}
    return accepted;
  case 'test':
    if(s.stage!=='hand'||s.eyeCover)return blocked('');
    s.testEnds=0;s.clothTest=!s.clothTest;cue(s,s.clothTest?'test-cover':'test-clear');return accepted;
  case 'take':
    if(s.stage!=='hand'||!s.reach||s.keyTaken||s.testEnds>s.elapsed)return blocked('Reach towards the key.');
    s.keyTaken=s.hasCloth=true;s.clothTest=false;s.reach=0;stage(s,'travel');knock(s,1);return accepted;
  case 'leave-hand':
    if(s.stage!=='hand')return blocked('');
    s.reach=0;s.clothTest=false;s.testEnds=0;stage(s,s.returnSlot||'travel');return accepted;
  case 'painting':
    if(!['search','travel','unlocked'].includes(s.stage))return blocked('The frame is out of reach.');
    s.mirrorOpen=true;s.mirrorTime=0;return accepted;
  case 'cover-painting':
    if(!s.hasCloth)return blocked('Its painted eyes look wet.');
    if(!['travel','unlocked'].includes(s.stage))return blocked('The frame is out of reach.');
    s.eyeCover=s.eyeCover?'':'direct';cue(s,s.eyeCover?'paper-cover':'test-clear',0,s.eyeCover?'[You hang the key cloth over the painted eyes.]':captions['test-clear']);return accepted;
  case 'front-door':
    if(s.stage==='travel'){s.doorUnlocked=true;stage(s,'unlocked');cue(s,'unlock');cue(s,'keyhole-cough',2.1);return accepted;}
    if(s.stage==='unlocked')return beginReplay(s,true);
    if(s.stage==='mimic'){
      if(s.clothLevel===2)return blocked('Lower the cloth so you can find the latch.');
      s.pending=s.pending.filter(e=>!['stand-still','third-lesson','like-you','show-door','cant-see','no-need','step-echo'].includes(e.id));
      stage(s,'opening');s.voiceUntil=0;s.doorAmount=0;cue(s,'door-open');return accepted;
    }
    return blocked(s.keyTaken?'The latch is already moving.':'The lock needs a key.');
  case 'keyhole':
    if(s.stage!=='unlocked')return blocked('Turn the spare key first.');
    return beginReplay(s,false);
  case 'stand':
    if(s.stage!=='reflection')return blocked('');
    s.stoodAt=s.elapsed;s.crouched=false;stage(s,'rising');cue(s,'rise',COPY_DELAY);return accepted;
  case 'crouch':case 'raise':
    if(s.stage!=='mimic'||s.clothLevel===2)return blocked('');
    if(id==='crouch')s.crouched=!s.crouched;else s.raised=!s.raised;return accepted;
  case 'cloth-half':
    if(s.stage!=='mimic'||s.eyeCover||s.clothLevel!==0)return blocked('');
    s.clothLevel=1;return accepted;
  case 'cloth-full':
    if(s.stage!=='mimic'||s.eyeCover||s.clothLevel!==1)return blocked('');
    s.pending=s.pending.filter(e=>!['stand-still','third-lesson','like-you','show-door','cant-see'].includes(e.id));
    s.clothLevel=2;s.voiceUntil=0;cue(s,'no-need');return accepted;
  case 'lower':
    if(s.stage!=='mimic'||!s.clothLevel)return blocked('');
    s.clothLevel=0;
    if(!s.eyeCover){s.copyQueue=s.copyQueue.filter(f=>f.clothLevel!==2);s.pending=s.pending.filter(e=>e.id!=='no-need');}
    else cue(s,'cant-see',Math.max(.45,s.voiceUntil-s.elapsed+.12));
    return accepted;
  case 'step-out':
    if(s.stage!=='porch')return blocked('');
    stage(s,'crossing');cue(s,'outside');return accepted;
  case 'shut':
    if(s.stage!=='outside')return blocked('');
    stage(s,'quiet');cue(s,'door-close');cue(s,'knock-recording',3.4);cue(s,'retained-line',5.8);return accepted;
  case 'yard-tomb':
    if(s.stage!=='graveyard')return blocked('');
    stage(s,'escaped');return accepted;
  default:return blocked('');
  }
}
function coveredDuringTest(s){return s.clothTest||(s.testEnds>s.elapsed&&s.testEnds-s.elapsed<1.62);}
const objectives={
  dormant:'',search:'Answer the kitchen telephone.',call:'Listen to both ends of the line.',practice:'Listen. Whose voice is it now?',
  hand:'Try reaching for the key. Watch the fingers.',travel:'Use the brass key at the front door.',
  latch:'Your hand is still on the closed door.',unlocked:'Warm light leaks through the keyhole. Look inside.',replay:'',imprint:'',reflection:'Tilt your view. Watch the other head. Then stand up.',
  rising:'',mimic:'The house is waiting for one last demonstration.',opening:'',porch:'The porch is open. Step outside.',
  crossing:'',outside:'Close the door behind you.',quiet:'',graveyard:'Touch the gravestone beside the porch.',replaced:'',escaped:'The rain is real.',trapped:'There is one person in the house.',
};
export function showActions(s){
  if(s.mirrorOpen)return [['replace-painting','Put the painting back']];
  if(talking(s))return s.elapsed>=s.callDoneAt?[['hangup','Put the receiver down']]:[];
  if(s.stage==='hand')return [['reach',s.reach?'Pull your hand back':'Reach towards the fingers'],
    ...(s.eyeCover?[]:[['test',s.clothTest?'Uncover the painting':'Test the cloth']]),
    ...(s.reach&&!s.keyTaken&&s.elapsed>=s.testEnds?[['take','Take the key']]:[]),['leave-hand','Step back']];
  if(s.stage==='reflection')return [['stand','Stand up']];
  if(s.stage==='mimic'){
    if(s.clothLevel===2)return [['lower','Lower the cloth']];
    if(s.clothLevel===1)return [['cloth-full','Cover both eyes'],['lower','Lower the cloth']];
    return [...(s.eyeCover?[]:[['cloth-half','Raise the cloth halfway']]),['crouch',s.crouched?'Stand up':'Crouch'],['raise',s.raised?'Lower your hand':'Raise your hand']];
  }
  if(s.stage==='porch')return [['step-out','Step onto the porch']];
  if(s.stage==='outside')return [['shut','Close the door']];
  return [];
}
export function hallTargetLabel(s,id){
  if(id==='yard-tomb')return 'Touch the gravestone';
  if(id==='keyhole')return 'Look through the keyhole';
  if(id==='painting')return 'Lift the painting';
  if(id==='cover-painting')return s.eyeCover==='direct'?'Lift the cloth off the frame':'Cover the painted eyes';
  if(id==='hall-key')return s.keyTaken?'Inspect the empty hand':'Lift the folded cloth';
  if(id==='hall-phone')return s.phoneAnswered?'Listen again':'Answer the telephone';
  return s.stage==='mimic'?'Demonstrate opening the door':s.stage==='unlocked'?'Touch the handle':s.doorUnlocked?'Door unlocked':'Try the lock';
}
export const freeHallMovement=s=>!s.mirrorOpen&&['search','travel','unlocked','mimic'].includes(s.stage)&&s.clothLevel===0;
function view(s,events=[]){
  const isCopy=['reflection','rising','mimic','opening','porch','crossing','outside','quiet','graveyard','escaped','replaced','trapped'].includes(s.stage);
  return {stage:s.stage,mirrorOpen:s.mirrorOpen,mirrorTime:s.mirrorTime,elapsed:s.elapsed,stageTime:s.stageTime,events,objective:s.mirrorOpen?'You are holding the painting.':s.eyeCover&&s.stage==='mimic'?'Its eyes are covered. Open the front door.':s.stage==='search'&&s.phoneAnswered?'Lift the folded cloth at the far end of the counter.':objectives[s.stage],
    hasCloth:s.hasCloth,inventory:s.hasCloth?'Brass key · '+(s.eyeCover==='direct'?'Cloth on painting':'Key cloth'):'',
    caption:s.mirrorOpen?(s.mirrorTime>=MIRROR_SCREAM_AT&&s.mirrorTime<MIRROR_SCREAM_AT+1.7?'[A woman screams just behind your shoulder.]':''):[s.voiceUntil>s.elapsed?s.voiceCaption:'',s.captionUntil>s.elapsed?s.caption:''].filter(Boolean).join('\n'),
    gaitBeat:s.gaitBeat,doorAmount:s.doorAmount,frontOpen:s.doorAmount>.99,phoneAnswered:s.phoneAnswered,phoneUp:s.phoneUp,keyTaken:s.keyTaken,
    handVisible:s.stage==='hand'||s.keyTaken,handReach:s.handPose,coverEye:s.eyeCover==='direct'||coveredDuringTest(s)?1:0,
    bodyVisible:isCopy&&s.stage!=='reflection'&&s.eyeCover!=='direct',rise:s.eyeCover==='direct'?0:(s.copied.stand||0),
    stride:Math.sin(s.copied.stride),crouch:s.copied.crouch,raise:Math.max(s.copied.raise,(s.copied.clothLevel||0)/2),blind:s.eyeCover==='copied'?1:(s.copied.clothLevel||0)/2,
    headYaw:s.copied.yaw,headPitch:s.copied.pitch,playerPose:s.pose,blindfold:s.clothLevel,eyeCover:s.eyeCover,knocks:s.knocks,
    tape:s.stage==='replay'||s.stage==='imprint'?playback(s):null,projection:s.stage==='reflection'?{...s.copied,x:-2.72,z:6.52}:null,
    lightDip:0,watcherAmount:0,actions:showActions(s)};
}
export function advanceHallChapter(s,dt,ctx={}){
  if(ctx.active===false||ctx.paused||s.stage==='dormant')return view(s);
  const seconds=Number.isFinite(dt)?clamp(dt,0,.25):0;
  if(s.mirrorOpen){
    const before=s.mirrorTime;
    s.mirrorTime+=seconds;
    const scream=before<MIRROR_SCREAM_AT && s.mirrorTime>=MIRROR_SCREAM_AT;
    return view(s,scream?[{type:'sound',id:'mirror-scream'}]:[]);
  }
  s.elapsed+=seconds;s.stageTime+=seconds;
  const player=ctx.player??s.pose;
  if(s.lastPosition&&freeHallMovement(s)){
    const distance=Math.hypot(player.x-s.lastPosition.x,player.z-s.lastPosition.z);
    if(distance>.0001&&distance<.7){s.stepTime+=seconds;s.stepDistance+=distance;s.stride+=distance*9;}
    if(s.stepDistance>=.59){
      s.stepDistance%=.59;s.gaitBeat=.5*s.gaitBeat+.5*clamp(s.stepTime,.22,1.1);s.stepTime=0;
      if(['travel','unlocked'].includes(s.stage))cue(s,'step-echo',.46,undefined,.9);
    }
  }
  s.lastPosition={x:player.x,z:player.z};
  const handLift=s.pose.raise+clamp(Number(s.raised)-s.pose.raise,-seconds*6.5,seconds*6.5);
  s.pose={x:player.x,z:player.z,yaw:ctx.yaw??s.pose.yaw,pitch:ctx.pitch??s.pose.pitch,crouch:+s.crouched,raise:handLift,reach:s.reach,phone:+s.phoneUp,stride:s.stride};
  if(!s.doorUnlocked&&s.clips.length<3)record(s);
  if(s.stage==='search'&&!s.phoneAnswered&&s.elapsed>=s.nextRing){s.nextRing=s.elapsed+6.5;cue(s,'ring');}
  if(!coveredDuringTest(s)&&!s.eyeCover)s.handPose+=(s.reach-s.handPose)*Math.min(1,seconds*8);
  if(s.stage==='latch'&&s.stageTime>=5.25){stage(s,'replay');cue(s,'projector');}
  if(s.stage==='replay'){
    s.playTime+=seconds;
    const length=s.clips.reduce((n,c)=>n+c.to-c.from,0);
    if(s.playTime>=length){
      s.playTime=length;
      knock(s,2);stage(s,'imprint');s.crouched=true;
      cue(s,'film-drag',1.05);
    }
  }
  if(s.stage==='imprint'&&s.stageTime>=KEYHOLE_HOLD){
    stage(s,'reflection');cue(s,'show-door',.4);
  }
  if(seconds>0&&['imprint','reflection','rising','mimic','opening'].includes(s.stage)&&!s.eyeCover){
    const stand=s.stage==='imprint'||s.stage==='reflection'?0:amount((s.elapsed-s.stoodAt)/1.65);
    s.copyQueue.push({...s.pose,t:s.elapsed,clothLevel:s.clothLevel,stand});
    while(s.copyQueue.length&&s.copyQueue[0].t<=s.elapsed-COPY_DELAY){
      s.copied=s.copyQueue.shift();
      if(s.copied.clothLevel===2){
        s.eyeCover='copied';s.copyQueue.length=0;cue(s,'paper-cover');break;
      }
    }
  }
  if(s.stage==='rising'&&s.stageTime>=2.6){
    stage(s,'mimic');s.checkpoint=checkpoint(s);s.notifications.push({type:'checkpoint'});
    if(!s.eyeCover){const after=Math.max(0,s.voiceUntil-s.elapsed+.12);cue(s,'stand-still',after);cue(s,'third-lesson',after+3.25);cue(s,'like-you',after+8.6);}
  }
  if(s.stage==='opening'){
    s.doorAmount=amount(s.stageTime/1.2);
    if(s.doorAmount===1){
      if(s.eyeCover){stage(s,'porch');}
      else{stage(s,'replaced');knock(s,3);cue(s,'replacement',1.8);cue(s,'greeting',7.3);}
    }
  }
  if(s.stage==='crossing'&&s.stageTime>=2.5)stage(s,'outside');
  if(s.stage==='quiet'){s.doorAmount=1-amount(s.stageTime/.85);if(s.stageTime>=10.4)stage(s,'graveyard');}
  if(s.stage==='replaced'&&s.stageTime>=13)stage(s,'trapped');
  const events=s.notifications.splice(0);
  s.pending=s.pending.filter(e=>{
    if(e.at>s.elapsed+1e-7)return true;
    events.push({type:'sound',id:e.id});
    if(e.copy&&!e.copy.startsWith('[')){s.voiceCaption=e.copy;s.voiceUntil=s.elapsed+e.seconds;}
    else if(e.copy&&(e.id!=='step-echo'||s.captionUntil<=s.elapsed)){s.caption=e.copy;s.captionUntil=s.elapsed+e.seconds;}
    return false;
  });
  return view(s,events);
}
