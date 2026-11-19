import * as THREE from './vendor/three.module.js';
import {createShowFigures} from './show-figures.mjs?v=listener27';
import {createPaintingMirror} from './painting-mirror.mjs';
import {createShowAudio} from './show-audio.mjs';
import {hallTargetLabel,COPY_DELAY,KEYHOLE_HOLD} from './hall-chapter.mjs?v=listener27';

const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
const alias={'retained-line':'player-line','keyhole-cough':'echo-cough','echo-reach':'reach','test-cover':'cloth','test-clear':'cloth','latch-warning':'unlock','projector':'cloth','film-drag':'paper-cover'};
export function createShowPresentation({world,camera,renderer,girl,art,grime,element,act}){
  const audio=createShowAudio(),figures=createShowFigures(world,{art});
  figures.attachFirstPerson(camera);
  const mirror=createPaintingMirror({world,camera,renderer,girl,art,grime,figures});
  const latchHand=figures.hand.clone(true);
  latchHand.name='Fingers on the other side of the latch';latchHand.visible=false;
  latchHand.position.set(1.08,1.03,-.142);latchHand.rotation.x=-Math.PI/2;
  latchHand.getObjectByName('Spare key gripped in the hand').visible=false;
  const latchWrist=latchHand.getObjectByName('Wrist stretching from the slit');
  latchHand.traverse(n=>{n.raycast=()=>{};});
  world.frontHinge.add(latchHand);
  const a=figures.anchors,target=new THREE.Vector3();
  const returnToPainting=new THREE.CatmullRomCurve3([new THREE.Vector3(.60,1.62,9.85),new THREE.Vector3(.19,1.75,7.48),new THREE.Vector3(-1.45,1.92,7.12),a.replayCamera]);
  const hud=element('showHUD'),lens=element('showLens'),fold=element('showFold'),tape=element('showTape'),caption=element('showCaption');
  const aperture=element('showAperture'),lastFrame=element('showLastFrame');
  const buttons=Array.from({length:5},(_,i)=>element('showAct'+i));
  for(const b of buttons)b.addEventListener('click',()=>{if(!b.hidden)act(b.dataset.action);});
  function actions(v,p){
    const choices=v.actions.slice();
    if(v.mirrorOpen)return choices;
    function add(id){choices.push([id,hallTargetLabel(v,id)]);}
    const kitchen=p.x<-.95&&p.z<9.1,door=p.z>9.35&&Math.abs(p.x)<.94;
    if(['search','travel','unlocked'].includes(v.stage)&&kitchen){
      if(Math.hypot(p.x+3.6,p.z-6.15)<1.85)add('hall-phone');
      if(v.phoneAnswered&&Math.hypot(p.x+3.42,p.z-8.48)<1.80)add('hall-key');
      if(Math.hypot(p.x+4.03,p.z-7.35)<1.8){
        add('painting');if(v.keyTaken)add('cover-painting');
      }
    }
    if(v.stage==='unlocked'&&door)add('keyhole');
    if(['travel','unlocked','mimic'].includes(v.stage)&&door&&!v.blindfold)add('front-door');
    if(v.stage==='search'&&!choices.some(([id])=>id===(v.phoneAnswered?'hall-key':'hall-phone')))choices.unshift(v.phoneAnswered?['walk:key','Walk to the folded cloth']:['walk:phone','Follow the ringing']);
    if(!door&&v.stage==='travel')choices.push(['walk:door','Walk to the front door']);
    return choices;
  }
  function scene(v,player){
    // Use the existing cupboard hinge for the first fold of the kitchen body.
    // Its final pose comes only from the observed delayed gesture.
    world.atmosphere.cupboard.rotation.y=-.018-v.rise*(.91+.31*v.raise);
    latchHand.visible=v.stage==='latch'&&!v.eyeCover;
    let projection=v.tape?.pose??v.projection,escape=null,pov=null;
    if(projection){
      projection={...projection,stride:Math.sin(projection.stride)*(projection.gait||0)};
      if(v.stage==='reflection')projection.yaw=Math.PI*.5+THREE.MathUtils.clamp(Math.atan2(Math.sin(v.headYaw-player.baseYaw),Math.cos(v.headYaw-player.baseYaw)),-1.3,1.3);
    }
    if(v.stage==='latch'){
      const gesture=t=>ease(t/.55)*(1-ease((t-2.1)/.7));
      pov={reach:gesture(v.stageTime),raise:0,cloth:0};
      const echo=gesture(v.stageTime-COPY_DELAY);
      latchWrist.rotation.z=.36-.74*echo;latchWrist.position.y=.018+.055*echo;
      camera.position.set(.23,1.27,10.86);target.set(.41,1.05,11.42);camera.lookAt(target);
    }
    if(v.stage==='hand'){
      pov={reach:v.playerPose.reach,raise:0,cloth:0};
      camera.position.set(-2.96,1.32,8.12);
      target.set(-3.47,1.05,8.47);camera.lookAt(target);
      // The nearby frame remains visible in the sink detail inset.
      camera.rotateY(player.lookOffset*.48);camera.rotateX((player.pitch-player.basePitch)*.48);
    }
    if(['call','practice'].includes(v.stage))pov={reach:0,raise:.1,cloth:0};
    if(v.tape||v.stage==='reflection'){
      camera.position.copy(a.replayCamera);
      const reach=projection.reach||0;
      target.set(projection.x-Math.sin(projection.yaw)*reach*.31,
        1.41-.55*(projection.crouch||0)-.14*reach,projection.z-Math.cos(projection.yaw)*reach*.31);
      camera.lookAt(target);
      if(v.stage==='reflection'){
        camera.rotateY(THREE.MathUtils.clamp(player.lookOffset,-1,1)*.12);
        camera.rotateX(THREE.MathUtils.clamp(player.pitch-player.basePitch,-1,1)*.13);
      }
    }
    if(v.stage==='rising'){
      camera.position.copy(a.revealCamera);camera.position.y=.84+ease(v.stageTime/1.65)*.81;
      camera.lookAt(a.revealTarget);
    }
    if(v.stage==='mimic'){
      camera.position.y-=.67*v.playerPose.crouch;
      if(v.blindfold||v.playerPose.raise)pov={reach:0,raise:Math.max(v.playerPose.raise,v.blindfold*.5),cloth:v.blindfold*.5};
    }
    if(v.stage==='opening'){
      pov={reach:ease(v.stageTime/.6),raise:0,cloth:0};
      camera.position.set(.08,1.55,10.16);target.set(.12,1.38,11.6);camera.lookAt(target);
    }
    if(v.stage==='replaced'||v.stage==='trapped'){
      const finished=v.stage==='trapped',t=finished?13:v.stageTime;
      const z=7.35+3.29*ease((t-.3)/3.3)+1.02*ease((t-3.65)/2.45)+.31*ease((t-6.65)/2.0)+1.85*ease((t-8.85)/2.25);
      const walk=(z-7.35)/6.47,glance=ease((t-5.45)/.77)*(1-ease((t-8.20)/.83));
      // The first unprompted step starts on the kitchen side and passes the player.
      const x=THREE.MathUtils.lerp(-.48,.25,walk);
      escape={x,z,yaw:Math.PI-glance*2.40,stride:Math.sin(t*Math.PI/v.gaitBeat+v.playerPose.stride)*(1-glance*.94)*ease((11.2-t)/.5),progress:ease((walk-.03)/.48)};
      const pull=finished?1:ease((t-8.85)/3.05);
      returnToPainting.getPoint(pull,camera.position);
      target.set(x,1.48,z).lerp(a.revealTarget,pull);camera.lookAt(target);
    }
    if(v.mirrorOpen)projection=mirror.present(player,v.mirrorTime);else mirror.hide();
    const relative=Math.atan2(Math.sin(v.headYaw-player.baseYaw),Math.cos(v.headYaw-player.baseYaw));
    figures.update({...v,active:true,headYaw:relative,projection,escape,pov});
    camera.updateMatrixWorld();
  }
  function update(v,p,{visible,active}){
    if(!active){if(!hud.hidden||figures.root.visible)reset();return;}
    hud.hidden=!visible;
    element('showWitness').hidden=v.stage!=='hand';element('showWitness').dataset.cover=String(Boolean(v.coverEye));
    scene(v,p);
    const held=v.stage==='imprint';
    aperture.hidden=!held;
    if(held){
      const t=v.stageTime;
      aperture.style.opacity=String(ease(t/.18)*(1-ease((t-KEYHOLE_HOLD+.34)/.34)));
      lastFrame.style.transform='scale('+(1+.055*ease(t/.38))+')';
    }
    const mode=v.tape||v.stage==='reflection'?'tape':['trapped','replaced'].includes(v.stage)&&(v.stage==='trapped'||v.stageTime>3)?'frame':'';
    lens.dataset.lens=mode;fold.dataset.level=String(v.blindfold);
    tape.hidden=mode!=='tape';
    if(!tape.hidden)tape.textContent=held?'FRAME 01  /  FILM JAM':v.tape?'FRAME 01  /  '+v.tape.time.toFixed(1)+' s  ·  '+v.tape.label:'FRAME 01  /  LIVE RETURN';
    caption.hidden=!v.caption;if(caption.textContent!==v.caption)caption.textContent=v.caption;
    const list=actions(v,p);
    buttons.forEach((b,i)=>{const action=list[i];b.hidden=!action;if(action){b.dataset.action=action[0];if(b.textContent!==action[1])b.textContent=action[1];}});
  }
  function reset(){aperture.hidden=true;mirror.hide();latchHand.visible=false;audio.reset();figures.reset();hud.hidden=true;fold.dataset.level='0';lens.dataset.lens='';}
  return {audio,figures,update,reset,renderReflection:mirror.reflect,sound(id){audio.play(alias[id]??id);}};
}
