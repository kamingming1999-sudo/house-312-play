import * as THREE from './vendor/three.module.js';
import { createCreature } from './roomkeeper.mjs?v=nightmare4';
import { findPath } from './navigation.mjs?v=dread2';

const START = { x: 1.3, z: 3.5 };
const WAYPOINTS = [{ x: .28, z: .98 }, { x: .2, z: -.82 }, { x: -.25, z: -1.05 }];
const WAIT_END = .045, APPROACH_END = .46, SEARCH_END = .68;
const noRaycast = () => {};
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const finitePlayer = player => player && Number.isFinite(player.x) && Number.isFinite(player.z);

/** Adds interaction/actor helpers around existing graphics without moving them.
 * seekTime is absolute seconds within a hunt; replaying it gives the same pose.
 * The parent owns player movement, hiding transitions and caught/release rules.
 */
export function createHideWorld(scene, world, { texture = null } = {}) {
  const cover = {
    id: 'table',
    approach: { x: -1, z: -.68 },
    hidden: { x: -1, z: .25, eyeY: .27 },
  };
  // Only this close-fitting invisible slab is tagged. The actual table shares a
  // static batch with other furniture, which must never become a cover target.
  const target = new THREE.Mesh(new THREE.BoxGeometry(1.5,.1,.9),new THREE.MeshBasicMaterial({
    transparent:true,opacity:0,depthWrite:false,colorWrite:false,
  }));
  // One millimetre above the real tabletop, below the paper resting on it.
  target.name='Coffee table hiding target'; target.position.set(-1,.476,.25);
  target.userData.interaction='cover'; target.userData.coverId=cover.id;
  world.root.add(target); cover.target=target;

  const hunter=createCreature({texture}); hunter.root.name='Searching Roomkeeper';
  hunter.root.traverse(object => { if (object.isMesh) object.raycast=noRaycast; });
  scene.add(hunter.root);
  const legs=hunter.root.children.filter(mesh => mesh.isMesh && mesh.geometry?.type==='CapsuleGeometry' && mesh.position.y<.7);
  const feet=hunter.root.children.filter(mesh => mesh.isMesh && mesh.geometry?.type==='BoxGeometry' && mesh.position.y<.15);
  const chest=hunter.root.children.find(mesh => mesh.isMesh && mesh.geometry?.type==='CapsuleGeometry' && mesh.position.y>.7);
  const limbRest=[...legs,...feet].map(mesh => ({mesh,position:mesh.position.clone(),rotation:mesh.rotation.clone()}));
  const bodyRest=[hunter.head,chest].filter(Boolean).map(mesh => ({mesh,position:mesh.position.clone(),rotation:mesh.rotation.clone(),scale:mesh.scale.clone()}));

  // Navigation uses the same human radius, obstacles and closed room door as
  // normal movement. Sampling its polyline by distance avoids frame-rate drift.
  const route=[{...START}];
  for (const waypoint of WAYPOINTS) {
    const path=findPath(route.at(-1),waypoint,false,{maxSnapDistance:0});
    if (path.length) route.push(...path.map(point => ({...point})));
  }
  const lengths=[0];
  for (let i=1;i<route.length;i++) lengths.push(lengths.at(-1)+distance(route[i-1],route[i]));
  const totalLength=lengths.at(-1);
  hunter.route=route.map(point => ({...point}));
  const pose={x:START.x,z:START.z,yaw:0,active:false,moving:false,stage:'idle',speed:0,
    distanceToPlayer:Infinity,progress:0,seekTime:0,seekDuration:12,hidden:false,peekIntensity:0};
  hunter.pose=pose;

  function sample(at,reverse=false) {
    const d=THREE.MathUtils.clamp(at,0,totalLength);
    for (let i=1;i<route.length;i++) {
      if (d>lengths[i] && i<route.length-1) continue;
      const from=route[i-1],to=route[i],length=lengths[i]-lengths[i-1];
      const amount=length>0?(d-lengths[i-1])/length:0;
      const direction=reverse?-1:1;
      return {x:from.x+(to.x-from.x)*amount,z:from.z+(to.z-from.z)*amount,
        yaw:Math.atan2((to.x-from.x)*direction,(to.z-from.z)*direction)};
    }
    return {...START,yaw:0};
  }
  function restoreLimbs() {
    for (const rest of limbRest) {rest.mesh.position.copy(rest.position);rest.mesh.rotation.copy(rest.rotation);}
  }
  function restoreBody() {
    for (const rest of bodyRest) {rest.mesh.position.copy(rest.position);rest.mesh.rotation.copy(rest.rotation);rest.mesh.scale.copy(rest.scale);}
  }
  function reset() {
    restoreLimbs(); restoreBody(); hunter.breathe(0,0); hunter.root.visible=false;
    const start=sample(0); hunter.root.position.set(START.x,0,START.z); hunter.root.rotation.set(0,start.yaw,0);
    Object.assign(pose,{x:START.x,z:START.z,yaw:start.yaw,active:false,moving:false,stage:'idle',speed:0,
      distanceToPlayer:Infinity,progress:0,seekTime:0,seekDuration:12,hidden:false,peekIntensity:0});
    return pose;
  }
  function update(_time,{active=false,seekTime=0,seekDuration=12,player=null,hidden=false,reducedMotion=false,paused=false}={}) {
    if (paused) return pose;
    const elapsed=Number.isFinite(seekTime)?Math.max(0,seekTime):0;
    const duration=Number.isFinite(seekDuration)&&seekDuration>0?seekDuration:12;
    const progress=THREE.MathUtils.clamp(elapsed/duration,0,1);
    let at=0,reverse=false,stage='waiting',speed=0;
    if (progress>=SEARCH_END) {
      at=totalLength*(1-(progress-SEARCH_END)/(1-SEARCH_END)); reverse=true;
      stage=progress>=1?'gone':'withdrawing'; speed=progress>=1?0:totalLength/((1-SEARCH_END)*duration);
    } else if (progress>=APPROACH_END) {at=totalLength;stage='searching';}
    else if (progress>=WAIT_END) {
      at=totalLength*(progress-WAIT_END)/(APPROACH_END-WAIT_END); stage='approaching';
      speed=totalLength/((APPROACH_END-WAIT_END)*duration);
    }
    const point=sample(at,reverse);
    const moving=Boolean(active)&&speed>0;
    let yaw=point.yaw;
    if (stage==='searching') {
      const look=hidden||!finitePlayer(player)?cover.hidden:player;
      yaw=Math.atan2(look.x-point.x,look.z-point.z);
      if (!reducedMotion) yaw+=Math.sin(elapsed*1.1)*.055;
    }
    const visible=Boolean(active)&&progress<1;
    hunter.root.visible=visible;
    hunter.root.position.set(point.x,!reducedMotion&&moving?Math.sin(elapsed*6.4)*.006:0,point.z);
    hunter.root.rotation.set(0,yaw,0);
    restoreLimbs(); restoreBody(); hunter.breathe(reducedMotion?0:elapsed,0);
    if (!reducedMotion&&moving) {
      legs.forEach((leg,i) => {leg.rotation.x+=Math.sin(elapsed*6.4+i*Math.PI)*.14;});
      feet.forEach((foot,i) => {
        const step=Math.sin(elapsed*6.4+i*Math.PI);
        foot.position.z+=step*.035; foot.position.y+=Math.max(0,step)*.014;
      });
    }
    let peekIntensity=0;
    if (stage==='searching'&&visible) {
      const search=(progress-APPROACH_END)/(SEARCH_END-APPROACH_END);
      const second=THREE.MathUtils.clamp((duration-12)/2,0,1);
      const holdEnd=.60+second*.10;
      // One slow fold and recovery, sampled from absolute hunt time. The second
      // search holds lower for longer; neither the route nor the face is scaled.
      peekIntensity=THREE.MathUtils.smoothstep(search,0,.43)*(1-THREE.MathUtils.smoothstep(search,holdEnd,1));
      const gaze=THREE.MathUtils.smoothstep(search,.26,.43)*(1-THREE.MathUtils.smoothstep(search,holdEnd,.94));
      const lowEye=reducedMotion ? .43-second*.04 : .42-second*.12;
      hunter.head.position.y=THREE.MathUtils.lerp(hunter.head.position.y,lowEye,peekIntensity);
      hunter.head.position.z+=peekIntensity*(reducedMotion ? .12 : .16+second*.06);
      if (!reducedMotion) {
        hunter.head.rotation.x+=peekIntensity*(.10+.65*(1-gaze));
        hunter.head.rotation.z-=peekIntensity*(.055+second*.035);
      }
      if (chest) {
        chest.position.y-=peekIntensity*(reducedMotion ? .56 : .56+second*.09);
        chest.position.z+=peekIntensity*(reducedMotion ? .12 : .18+second*.04);
        chest.rotation.x+=peekIntensity*(reducedMotion ? .62 : .88+second*.14);
      }
    }
    Object.assign(pose,{x:point.x,z:point.z,yaw,active:visible,moving:visible&&moving,stage:active?stage:'idle',speed:visible?speed:0,
      distanceToPlayer:finitePlayer(player)?Math.hypot(point.x-player.x,point.z-player.z):Infinity,
      progress,seekTime:elapsed,seekDuration:duration,hidden:Boolean(hidden),peekIntensity});
    return pose;
  }
  reset();
  return {cover,hunter,update,reset};
}
