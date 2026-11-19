import * as THREE from './vendor/three.module.js';

const bindings=new WeakMap();
const normalized=value=>Number.isFinite(value)?THREE.MathUtils.clamp(value,0,1):0;

/** Add small radio-answer offsets after world.updateAtmosphere(). Empty child
 * pivots keep the base hinges under their original owner's control: repeated or
 * paused updates cannot accumulate rotations or require guessing a base pose.
 * The engine owns timing/easing; this adapter only applies its normalized frame.
 */
export function createSignalWorld(world){
  if(bindings.has(world))return bindings.get(world);
  function pivot(hinge,name){
    if(!hinge?.isObject3D)return null;
    const offset=new THREE.Group();offset.name=name;
    for(const child of [...hinge.children])offset.add(child);
    hinge.add(offset);return offset;
  }
  const picture=pivot(world.atmosphere?.picture,'Radio answer picture offset');
  const cupboard=pivot(world.atmosphere?.cupboard,'Radio answer cupboard offset');
  function reset(){
    picture?.rotation.set(0,0,0);cupboard?.rotation.set(0,0,0);
  }
  function update(frame,{reducedMotion=false,paused=false}={}){
    if(paused)return;
    const visual=frame?.visual??{};
    if(picture)picture.rotation.x=reducedMotion?0:normalized(visual.picture)*.04;
    const opening=reducedMotion?0:normalized(visual.cupboard);
    if(cupboard)cupboard.rotation.y=opening?-opening*.24:0;
  }
  reset();const result={update,reset};bindings.set(world,result);return result;
}
