import * as THREE from './vendor/three.module.js';

const noRaycast = () => {};
const unit = value => Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;

/** Counter props stay inside existing furniture, so they add no floor blockers.
 * time is absolute seconds. view.active defaults true; paused freezes all visible
 * state while refreshing the time baseline. Targets require a second close tap.
 */
export function createHallWorld(world, { texture = null, labelTexture } = {}) {
  const root = new THREE.Group(); root.name = 'Hallway chapter props'; world.root.add(root);
  const brass = world.frontHinge?.getObjectByName('front door handle')?.material ??
    new THREE.MeshStandardMaterial({color:0x806d45,metalness:.6,roughness:.68});
  const clothMaterial = world.root.getObjectByName('loose cupboard hinge')?.children[0]?.material?.clone() ??
    new THREE.MeshStandardMaterial({color:0xa9aa94,roughness:1});
  clothMaterial.color.setHex(0xa29b7f); clothMaterial.metalness=0; clothMaterial.roughness=1;
  const bakelite = new THREE.MeshStandardMaterial({color:0x252c26,roughness:.56,metalness:.06});
  const recess = new THREE.MeshStandardMaterial({color:0x090c09,roughness:1});
  const paper = new THREE.MeshStandardMaterial({color:0xbeb195,roughness:1});

  function mesh(name, geometry, material, parent, at = [0,0,0]) {
    const object = new THREE.Mesh(geometry,material); object.name=name; object.position.set(...at);
    object.castShadow=object.receiveShadow=true; parent.add(object); return object;
  }
  function box(name,size,at,material,parent) {
    return mesh(name,new THREE.BoxGeometry(...size),material,parent,at);
  }
  function rounded(name,size,at,material,parent,radius=.025) {
    const geometry=new THREE.BoxGeometry(...size,4,4,4),positions=geometry.attributes.position;
    const inner=new THREE.Vector3(...size).multiplyScalar(.5).addScalar(-radius);
    const point=new THREE.Vector3(),nearest=new THREE.Vector3();
    for(let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i);nearest.copy(point).clamp(inner.clone().negate(),inner);
      point.sub(nearest).normalize().multiplyScalar(radius).add(nearest);positions.setXYZ(i,point.x,point.y,point.z);
    }
    geometry.computeVertexNormals();return mesh(name,geometry,material,parent,at);
  }
  function label(name,lines,size,at,rotation,parent,options={}) {
    const material=new THREE.MeshStandardMaterial({
      map:labelTexture?.(lines,{background:'#bcb18f',color:'#282d24',font:'serif',fontSize:.16,...options})??null,
      color:labelTexture?0xffffff:0xbcb18f,roughness:1,side:THREE.DoubleSide,
    });
    const object=mesh(name,new THREE.PlaneGeometry(...size),material,parent,at);
    object.rotation.set(...rotation); object.castShadow=false; return object;
  }

  const phone=new THREE.Group();phone.name='Kitchen rotary telephone';phone.position.set(-3.6,.975,6.15);
  phone.userData.interaction='hall-phone';root.add(phone);
  rounded('Bakelite telephone base',[.34,.09,.31],[0,0,0],bakelite,phone,.026);
  rounded('Sloped rotary housing',[.27,.035,.25],[.012,.048,0],bakelite,phone,.015);
  mesh('Worn brass rotary dial',new THREE.CylinderGeometry(.086,.086,.009,28),brass,phone,[.025,.071,0]);
  const fingerPlate=mesh('Rotary finger plate',new THREE.TorusGeometry(.068,.009,5,28),brass,phone,[.025,.078,0]);
  fingerPlate.rotation.x=Math.PI/2;
  for(let i=0;i<10;i++) {
    const angle=i/10*Math.PI*2;
    mesh('Rotary finger hole',new THREE.CylinderGeometry(.011,.011,.002,8),recess,phone,
      [.025+Math.cos(angle)*.061,.079,Math.sin(angle)*.061]);
  }
  const dialCenter=label('Telephone dial number',['312'],[.066,.066],[.025,.081,0],[-Math.PI/2,0,0],phone,{fontSize:.24});
  dialCenter.raycast=noRaycast;
  label('ROTARY telephone badge',['ROTARY'],[.25,.054],[.171,.003,0],[0,Math.PI/2,0],phone,{fontSize:.19});
  for(const z of [-.108,.108])box('Telephone receiver cradle',[.045,.055,.035],[-.065,.065,z],bakelite,phone);
  const handset=new THREE.Group();handset.name='Physical telephone receiver';phone.add(handset);
  rounded('Receiver bridge',[.065,.055,.285],[0,0,0],bakelite,handset,.024);
  for(const z of [-.127,.127]) {
    mesh('Receiver earpiece',new THREE.CylinderGeometry(.055,.046,.055,16),bakelite,handset,[0,-.008,z]);
    mesh('Receiver grille',new THREE.CylinderGeometry(.037,.037,.003,12),recess,handset,[0,-.037,z]);
  }
  const cordPoints=[];
  for(let i=0;i<=48;i++) {
    const t=i/48,angle=t*Math.PI*22;
    cordPoints.push(new THREE.Vector3(-.12-t*.15,.006+Math.sin(angle)*.012,.14+Math.cos(angle)*.012));
  }
  const cord=mesh('Coiled telephone cord',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPoints),64,.004,4,false),bakelite,phone);
  cord.raycast=noRaycast;

  const keyBundle=new THREE.Group();keyBundle.name='Spare key in folded cloth';keyBundle.position.set(-3.42,.95,8.48);
  keyBundle.userData.interaction='hall-key';root.add(keyBundle);
  box('Folded key cloth',[.32,.04,.26],[0,.004,0],clothMaterial,keyBundle);
  box('Turned-back cloth fold',[.15,.018,.25],[-.074,.032,0],clothMaterial,keyBundle);
  // Visible brass at the fold makes the covered bundle recognisable at a glance.
  const keyBow=mesh('Spare key bow',new THREE.TorusGeometry(.027,.006,5,16),brass,keyBundle,[.072,.033,.014]);
  keyBow.rotation.x=Math.PI/2;
  box('Spare key shaft',[.011,.011,.095],[.072,.033,.078],brass,keyBundle);
  for(const z of [.092,.114])box('Spare key tooth',[.029,.011,.012],[.083,.033,z],brass,keyBundle);
  const keyLabel=label('SPARE KEY folded-paper label',['SPARE KEY'],[.275,.075],[0,.043,-.077],[-Math.PI/2,0,0],keyBundle,{fontSize:.15});
  keyLabel.receiveShadow=false;
  // A small tucked paper edge gives the label thickness without a floating card.
  box('Key label paper edge',[.278,.002,.078],[0,.0415,-.077],paper,keyBundle);

  const watcher=mesh('Face behind the front-door transom',new THREE.PlaneGeometry(.24,.336),
    new THREE.MeshBasicMaterial({map:texture,color:0xc4c9b7,transparent:true,opacity:0,
      alphaTest:.08,depthTest:true,depthWrite:false,side:THREE.FrontSide}),root,[0,2.97,11.54]);
  watcher.rotation.y=Math.PI;watcher.castShadow=watcher.receiveShadow=false;watcher.raycast=noRaycast;
  watcher.renderOrder=0;

  // Both targets live on their physical surfaces and can be approached by touch.
  const invisible=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const targetBox=(id,size,at,parent)=>{
    const proxy=box(id+' touch surface',size,at,invisible,parent);
    proxy.userData.interaction=id;proxy.castShadow=proxy.receiveShadow=false;
  };
  targetBox('painting',[.04,1.03,1.12],[-4.025,2.15,7.35],root);
  targetBox('hall-key',[.52,.24,.47],[-3.42,1.03,8.48],root);
  const lock=box('Front lock escutcheon',[.105,.20,.012],[1.21,1.03,-.155],brass,world.frontHinge);
  lock.userData.interaction='keyhole';
  const glow=new THREE.MeshBasicMaterial({color:0xffcc76});
  box('Warm keyhole slit',[.017,.045,.014],[1.21,1.03,-.17],glow,world.frontHinge).userData.interaction='keyhole';
  targetBox('keyhole',[.19,.26,.02],[1.21,1.03,-.18],world.frontHinge);
  const targets={
    painting:{point:new THREE.Vector3(-4.025,2.15,7.35),approach:{x:-2.66,z:7.38}},
    keyhole:{point:new THREE.Vector3(.485,1.03,11.36),approach:{x:.12,z:10.32}},
    'hall-phone':{point:new THREE.Vector3(-3.575,1.055,6.15),approach:{x:-2.65,z:6.4}},
    'hall-key':{point:new THREE.Vector3(-3.42,.994,8.48),approach:{x:-2.65,z:8.35}},
    'front-door':{point:new THREE.Vector3(0,2.4,11.37),approach:{x:0,z:10.1}},
  };
  const lights=[world.hallLight,world.kitchenLight].filter(Boolean).map(light=>({light,intensity:light.intensity}));
  let lastTime=null;
  function reset() {
    lastTime=null;root.visible=true;keyBundle.visible=true;
    handset.position.set(-.065,.12,0);handset.rotation.set(0,0,0);
    watcher.visible=false;watcher.material.opacity=0;
    if(world.frontHinge)world.frontHinge.rotation.y=0;
    for(const {light,intensity} of lights)light.intensity=intensity;
  }
  function update(view={},time=0,{paused=false,reducedMotion=false}={}) {
    const now=Number.isFinite(time)?time:0;
    const dt=lastTime===null?0:Math.min(.1,Math.max(0,now-lastTime));lastTime=now;
    if(paused)return;
    root.visible=view.active!==false;
    keyBundle.visible=!view.keyTaken&&!view.handVisible;
    if(typeof view.phoneUp==='boolean'){
      handset.position.set(view.phoneUp?.12:-.065,view.phoneUp?.34:.12,0);
      handset.rotation.set(view.phoneUp?.35:0,0,view.phoneUp?-.32:0);
    }else {
    handset.position.set(view.phoneAnswered?-.28:-.065,view.phoneAnswered?0:.12,0);
    handset.rotation.set(0,view.phoneAnswered?.15:0,0);
    }
    const amount=root.visible?unit(view.watcher):0;
    watcher.visible=amount>0&&Boolean(texture);watcher.material.opacity=amount;
    const dip=root.visible?unit(view.lightDip):0;
    for(const {light,intensity} of lights)light.intensity=intensity*(1-dip*.74);
    if(world.frontHinge) {
      const target=view.frontOpen?1.35:0;
      world.frontHinge.rotation.y=Number.isFinite(view.doorAmount)?0-1.35*unit(view.doorAmount):reducedMotion?target:
        THREE.MathUtils.lerp(world.frontHinge.rotation.y,target,1-Math.exp(-dt*5));
    }
  }
  reset();
  return {root,targets,phone,handset,keyBundle,watcher,update,reset};
}
