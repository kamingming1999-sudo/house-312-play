import * as THREE from './vendor/three.module.js';
import {createOccupant} from './occupant-rig.mjs?v=fold30';
import {createDetailedHand} from './detailed-hand.mjs';
import {createFoldedBody} from './folded-house.mjs';

const clamp = value => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const lerp = THREE.MathUtils.lerp;
const v = (x,y,z) => new THREE.Vector3(x,y,z);
const up = v(0,1,0);
const noPick = () => {};

function group(parent,name,at=[0,0,0]) {
  const object = new THREE.Group();
  object.name=name; object.position.set(...at); parent.add(object);
  return object;
}

function surface(color, options={}) {
  return new THREE.MeshStandardMaterial({color,roughness:.85,...options});
}

function mesh(parent,name,geometry,material,at=[0,0,0]) {
  const object = new THREE.Mesh(geometry,material);
  object.name=name; object.position.set(...at); object.raycast=noPick;
  object.userData.pickThrough=true; object.receiveShadow=true;
  parent.add(object); return object;
}

const boxGeometry = new THREE.BoxGeometry(1,1,1);
const sphereGeometry = new THREE.SphereGeometry(1,16,12);
const cylinderGeometry = new THREE.CylinderGeometry(1,1,1,12);
function box(parent,name,size,at,mat) {
  const m=mesh(parent,name,boxGeometry,mat,at);
  m.scale.set(...size);return m;
}
function oval(parent,name,radii,at,mat) {
  const m=mesh(parent,name,sphereGeometry,mat,at);
  m.scale.set(...radii);return m;
}
function beam(parent,name,from,to,width,depth,mat,round=false) {
  const a=v(...from),b=v(...to),axis=b.clone().sub(a);
  const m=mesh(parent,name,round?cylinderGeometry:boxGeometry,mat);
  m.position.copy(a).lerp(b,.5); m.scale.set(width,axis.length(),depth);
  m.quaternion.setFromUnitVectors(up,axis.normalize()); return m;
}
function tube(parent,name,points,radius,mat,n=14) {
  const curve = new THREE.CatmullRomCurve3(points.map(p=>v(...p)));
  return mesh(parent,name,new THREE.TubeGeometry(curve,n,radius,5,false),mat);
}
function ring(parent,name,radius,gauge,at,mat) {
  return mesh(parent,name,new THREE.TorusGeometry(radius,gauge,6,24),mat,at);
}

// A folded sheet has a ragged hem, a shallow ridge and actual thickness in the
// lighting. The wallpaper reverse is visible as it crosses the frame.
function sheet(parent,name,w,h,material,at=[0,0,0]) {
  const geo=new THREE.PlaneGeometry(w,h,12,10);
  const pos=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=0;i<pos.count;i++) {
    const u=uv.getX(i),t=uv.getY(i);
    pos.setXYZ(i,pos.getX(i),pos.getY(i)+(Math.sin(u*15)*.016+Math.cos(u*30)*.008)*(1-t),
      (.013*Math.sin(u*13+t)+.007*Math.cos(u*30-t*2))*(1.2-t*.35));
  }
  geo.computeVertexNormals();
  return mesh(parent,name,geo,material,at);
}

// Combine attachments on each rigid joint. Knuckles, screw heads and fluting
// only add triangles to the draw for the same material, even on a small phone.
function batchRigidParts(parent) {
  for(const child of [...parent.children]) if(child.isGroup) batchRigidParts(child);
  const byMaterial=new Map();
  for(const child of parent.children) if(child.isMesh) {
    if(!byMaterial.has(child.material))byMaterial.set(child.material,[]);
    byMaterial.get(child.material).push(child);
  }
  for(const [mat,parts] of byMaterial) {
    if(parts.length<2)continue;
    const geometries=parts.map(part=>{
      part.updateMatrix();
      const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
      return g.applyMatrix4(part.matrix);
    });
    const merged=new THREE.BufferGeometry();
    for(const attr of ['position','normal','uv']) {
      const count=geometries.reduce((n,g)=>n+g.attributes[attr].array.length,0);
      const array=new Float32Array(count);let index=0;
      for(const g of geometries){const src=g.attributes[attr].array;array.set(src,index);index+=src.length;}
      merged.setAttribute(attr,new THREE.BufferAttribute(array,geometries[0].attributes[attr].itemSize));
    }
    for(const g of geometries)g.dispose();
    merged.computeBoundingSphere();parent.remove(...parts);
    mesh(parent,parts[0].name,merged,mat);
  }
}

function makeDouble(parent,m){
  const receiver=new THREE.Group();
  receiver.name='Receiver held in the recording';
  tube(receiver,'Bakelite receiver handle',[[0,-.079,.038],[.018,-.042,.015],[.022,.053,-.009],[0,.099,-.027]],.011,m.dark);
  for(const [y,z] of [[-.078,.036],[.095,-.028]])oval(receiver,'Receiver cup',[.022,.026,.028],[0,y,z],m.dark);
  return createOccupant(parent,receiver);
}

function makeCounterHand(root,m,skin) {
  const crevice=group(root,'Split in the countertop',[-3.55,.934,8.48]);
  const slot=oval(crevice,'Black slit',[.032,.004,.153],[0,.002,0],m.dark);
  slot.rotation.y=-.2;
  const hinge=group(crevice,'Wrist stretching from the slit',[.012,.018,0]);
  const fore=group(hinge,'Knuckles curling around the key',[.006,.013,0]);
  const palm=createDetailedHand(skin);
  fore.add(palm.root);
  fore.rotation.order='YXZ';
  fore.rotation.set(-.39,.40,-1.02);
  palm.pose(.82);
  const key=group(fore,'Spare key gripped in the hand',[-.021,.071,-.039]);
  key.rotation.set(.09,.4,-1.32);
  const bow=ring(key,'Brass key bow',.028,.006,[0,.012,0],m.brass);
  bow.rotation.y=.22;
  box(key,'Key shaft',[.012,.074,.010],[.006,-.048,0],m.brass);
  box(key,'Cut key bit',[.028,.015,.013],[.016,-.078,0],m.brass);
  function update(visible,taken,reach) {
    crevice.visible=visible;
    if(!visible)return;
    const t=clamp(reach);
    hinge.rotation.z=.32-t*.38;
    hinge.position.set(.012,-.015+t*.011,-t*.018);
    fore.rotation.y=.40+t*.42;
    palm.pose(.82-.13*t);
    key.visible=!taken;
  }
  return {root:crevice,update};
}

function furnitureDoor(parent,mat,width,height,z=0) {
  box(parent,'Frayed panel rails',[width,height,.067],[0,-height/2,z],mat.wood);
  box(parent,'Recessed cupboard enamel',[width-.046,height-.068,.026],[0,-height/2,z+.040],mat.enamel);
  box(parent,'Inner raised panel',[width-.087,height-.111,.022],[0,-height/2,z+.058],mat.plaster);
  tube(parent,'Brass cupboard pull',[[-width*.18,-height*.23,z+.069],[-width*.15,-height*.23,z+.099],
    [width*.15,-height*.23,z+.099],[width*.18,-height*.23,z+.069]],.009,mat.brass,12);
}

function tableHand(parent,m,side) {
  const hand=group(parent,'Carved table-leg fingers');
  box(hand,'Butcher block palm',[.17,.16,.10],[0,-.06,0],m.wood);
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.044;
    const tip=[.155,.212,.191,.14][i];
    const s=x*.56;
    beam(hand,'Turned finger leg',[x,-.122,0],[x+s,-.136-tip*.63,.035],.017,.021,m.wood,true);
    oval(hand,'Lathe knuckle',[.021,.024,.021],[x+s,-.135-tip*.61,.035],m.brass);
    beam(hand,'Tapered chair foot',[x+s,-.136-tip*.62,.036],[x+s*.94,-.13-tip,.061],.011,.015,m.wood,true);
  }
  beam(hand,'Wooden thumb',[side*.069,-.036,0],[side*.143,-.11,.071],.023,.022,m.wood,true);
  return hand;
}

function makeBody(parent,m,art) {
  const body=group(parent,'Kitchen standing in the doorway');
  const pelvis=group(body,'Drawer hips');
  box(pelvis,'Drawer carcass',[.51,.23,.29],[0,.02,0],m.wood);
  box(pelvis,'Drawer lip',[.56,.035,.34],[0,.112,.014],m.enamel);
  for(const x of [-.136,.136])ring(pelvis,'Drop drawer pull',.031,.006,[x,-.013,.164],m.brass);
  const chest=group(body,'Sink and bent mounting frame');
  box(chest,'Back of the sink cabinet',[.72,.62,.085],[0,.13,-.095],m.wood);
  box(chest,'Left sink mounting flange',[.048,.57,.16],[-.355,.14,.004],m.enamel);
  box(chest,'Right sink mounting flange',[.048,.57,.16],[.355,.14,.004],m.enamel);
  // The hollow bowl reads as an upended sink, with an actual drain at the base.
  const bowlProfile=[[0,-.135],[.075,-.132],[.16,-.112],[.25,-.059],[.297,.025],
    [.303,.060],[.330,.064],[.341,.046],[.301,-.033],[.248,-.114],[.145,-.149],[.06,-.165],[0,-.165]];
  const bowl=mesh(chest,'Porcelain basin opened into the chest',new THREE.LatheGeometry(
    bowlProfile.map(([r,y])=>new THREE.Vector2(r,y)),32),m.enamel,[0,.10,.087]);
  bowl.rotation.x=Math.PI/2;bowl.scale.z=1.18;
  const drain=ring(chest,'Plughole rim',.058,.008,[0,.10,-.036],m.brass);
  oval(chest,'Plughole',[.052,.052,.012],[0,.10,-.038],m.dark);
  for(const side of [-1,1])for(let i=0;i<3;i++) {
    const y=.31-i*.13;
    tube(chest,'Cracked porcelain rib',[[side*.32,y,.07],[side*.26,y+.016,.166],
      [side*.145,y-.027,.202],[side*.042,y-.049,.177]],.014-i*.0013,m.ivory,12);
  }
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.068;
    tube(chest,'Stretching telephone tendon',[[x*.42,-.45,-.02],[x*.77,-.22,.04],[x,-.12,.13],
      [x*.84,.10,-.014],[x*.45,.41,.05]],.010,m.wire,20);
  }
  const head=group(body,'Painting on the stretched neck');
  box(head,'Black back of painting',[.65,.72,.092],[0,0,-.012],m.dark);
  const artMaterial=new THREE.MeshStandardMaterial({map:art??null,color:art?0xffffff:0x8b7960,
    emissive:art?0xffffff:0x292119,emissiveMap:art??null,emissiveIntensity:.26,roughness:.89});
  mesh(head,'Eye of the house',new THREE.PlaneGeometry(.574,.61),artMaterial,[0,0,.041]);
  for(const side of [-1,1]) {
    box(head,'Smoke-dark frame stile',[.049,.71,.085],[side*.309,0,.038],m.wood);
    box(head,'Frame inner gilt bevel',[.013,.643,.018],[side*.285,0,.082],m.brass);
    box(head,'Frame rail',[.59,.046,.088],[0,side*.328,.038],m.wood);
    box(head,'Frame gilt slip',[.567,.013,.020],[0,side*.302,.081],m.brass);
    for(const y of [-.307,.307]) oval(head,'Tarnished frame tack',[.009,.009,.004],[side*.309,y,.083],m.brass);
  }
  const patch=group(head,'Loose wallpaper carried over the eye',[.025,-.65,.123]);
  sheet(patch,'Wallpaper blindfold',.698,.766,m.wallpaper);
  tube(patch,'Torn edge of wallpaper',[[-.347,-.359,.006],[-.174,-.372,.011],[-.018,-.358,.015],
    [.162,-.381,.016],[.345,-.370,.005]],.004,m.thread,18);

  const arms=[],legs=[];
  for(const side of [-1,1]) {
    const shoulder=group(body,'Reversed cabinet hinge');
    const bolt=ring(shoulder,'Shoulder hinge',.096,.017,[0,-.025,.01],m.brass);
    bolt.rotation.y=Math.PI/2;
    furnitureDoor(shoulder,m,.27,.48);
    const elbow=group(shoulder,'Inverted elbow',[0,-.47,0]);
    oval(elbow,'Porcelain hinge pin',[.079,.066,.070],[0,0,.022],m.enamel);
    furnitureDoor(elbow,m,.172,.385,.008);
    for(const offset of [-.045,.045]) tube(elbow,'Handset cable sinew',[
      [offset,.082,-.012],[offset*1.35,-.08,.102],[offset,-.24,.126],[offset*.7,-.40,.037]],.006,m.wire,12);
    tableHand(elbow,m,side).position.set(0,-.38,.015);
    arms.push({shoulder,elbow});
    const knee=group(body,'Folded chair leg');
    furnitureDoor(knee,m,.202,.39);
    const shin=group(knee,'Splitting cabinet plinth',[0,-.37,0]);
    beam(shin,'Long carved table leg',[0,0,0],[side*.038,-.42,-.02],.048,.051,m.wood,true);
    oval(shin,'Turned foot collar',[.062,.044,.063],[side*.033,-.36,-.015],m.wood);
    box(shin,'Brass cabinet foot',[.105,.06,.18],[side*.04,-.43,.019],m.brass);
    legs.push({knee,shin});
  }

  // A stretched cord and towel rails physically link the screen to the basin.
  const neckLines=group(body,'Long telephone-cord neck');
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.042;
    const points=[];
    for(let j=0;j<=48;j++) {
      const t=j/48,rad=.012+.015*Math.sin(t*Math.PI),a=t*Math.PI*17+i;
      points.push([x + Math.cos(a)*rad,t,Math.sin(a)*rad+.015*Math.sin(t*Math.PI*2)]);
    }
    tube(neckLines,'Stretched handset helix',points,i===1?.012:.007,i===1?m.brass:m.wire,90);
  }
  const neckFrom=v(0,0,0),neckTo=v(0,0,0),delta=v(0,0,0);
  const down=v(0,-1,0),wrist=v(0,0,0),target=v(0,0,0),axis=v(0,0,0),pole=v(0,0,0),elbowPoint=v(0,0,0);
  const lowerRotation=new THREE.Quaternion();
  function update(view) {
    body.visible=Boolean(view.bodyVisible);
    if(!body.visible)return;
    const rise=clamp(view.rise??1),kneel=clamp(view.crouch),lift=Math.max(clamp(view.raise),clamp(view.blind));
    const escape=view.escape;
    const step=THREE.MathUtils.clamp(escape?.stride??view.stride??0,-1,1)*rise;
    const shrink=clamp(escape?.progress),standing=rise*(1-shrink);
    body.scale.set(1-shrink*.60,1-shrink*.40,1-shrink*.60);
    body.visible=shrink<.995;
    body.position.set(0,0,0);
    if(escape) {
      const s=body.scale;
      body.position.set(escape.x+s.x*.71,0,escape.z-s.z*7.18);
    }
    const p=pelvis.position;
    p.set(lerp(-3.53,-.78,rise),lerp(.47,1.05-kneel*.43,rise),lerp(7.30,7.18,rise));
    p.x+=step*.038;pelvis.rotation.set(kneel*.24,step*.07,(1-rise)*.19-step*.04);
    const chestX=lerp(-3.60,-.68,rise),chestY=lerp(.98,1.48-kneel*.62,rise),chestZ=lerp(7.23,7.16,rise);
    chest.position.set(chestX,chestY,chestZ);
    chest.rotation.set(lerp(-Math.PI*.50,-.13+kneel*.30,rise),lerp(Math.PI*.50,0,rise),(1-rise)*.22+rise*.08);
    for(let i=0;i<2;i++) {
      const side=i===0?-1:1,arm=arms[i],leg=legs[i];
      arm.shoulder.position.set(chestX+side*.35,chestY+.35,chestZ);
      const reaching=side===1?lift:lift*.64;
      arm.shoulder.rotation.set(lerp(-.20,-.28-reaching*.96,rise)+side*step*.19*(1-lift),-side*reaching*.12,
        side*lerp(.03,.17+reaching*.76,rise));
      arm.elbow.rotation.set(-.19-reaching*1.12,side*.075,-side*reaching*.30);
      leg.knee.position.set(p.x+side*.195,p.y+.012,p.z);
      leg.knee.rotation.set(lerp(-1.30,-.2-kneel*.86,rise)+side*step*.52,side*.12,-side*.12);
      leg.shin.rotation.set(lerp(1.77,.42+kneel*1.19,rise)+Math.max(0,-side*step)*.44,0,side*.08);
    }
    head.position.set(lerp(-4.040,-.37,rise),lerp(2.15,2.65-kneel*.68,rise),lerp(7.35,7.22,rise));
    head.rotation.set(-THREE.MathUtils.clamp(view.headPitch??0,-1,1)*.19*standing,
      lerp(Math.PI/2,0,rise)+THREE.MathUtils.clamp(view.headYaw??0,-1.5,1.5)*.19*standing,.09*rise);
    head.scale.setScalar(lerp(1.7,1,rise));
    if(lift>0 && rise>0){
      // A two-link reach keeps the table fingers hooked round the upper paper
      // edge while the painting inclines or the whole room drops to its knees.
      const {shoulder,elbow}=arms[1];
      shoulder.position.x+=.13*lift;
      shoulder.position.y+=.16*lift;
      wrist.copy(down).multiplyScalar(.38).applyQuaternion(elbow.quaternion).add(elbow.position)
        .applyQuaternion(shoulder.quaternion).add(shoulder.position);
      target.set(.13,-.175,.20).applyQuaternion(head.quaternion).add(head.position);
      wrist.lerp(target,lift);
      axis.subVectors(wrist,shoulder.position);
      const distance=THREE.MathUtils.clamp(axis.length(),.10,.849);
      axis.normalize();
      pole.set(.49,-.36,.61);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const along=(.47**2-.38**2+distance**2)/(2*distance);
      elbowPoint.copy(shoulder.position).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,.47**2-along**2)));
      wrist.copy(shoulder.position).addScaledVector(axis,distance);
      shoulder.quaternion.setFromUnitVectors(down,delta.subVectors(elbowPoint,shoulder.position).normalize());
      lowerRotation.setFromUnitVectors(down,delta.subVectors(wrist,elbowPoint).normalize());
      elbow.quaternion.copy(shoulder.quaternion).invert().multiply(lowerRotation);
    }
    const blind=clamp(view.blind),cover=blind;
    patch.visible=cover>.015;
    patch.position.set((1-cover)*.40,-(1-cover)*.73,.126+(1-cover)*.05);
    patch.rotation.set(-(1-cover)*.76,(1-cover)*.33,(1-cover)*-.43);
    // The metal spine length is tied solely to joints (including a frozen pose).
    neckFrom.set(chestX+.06,chestY+.38,chestZ-.023);
    neckTo.copy(head.position);neckTo.y-=.29*head.scale.y;
    delta.subVectors(neckTo,neckFrom);
    neckLines.position.copy(neckFrom);neckLines.scale.set(1,delta.length(),1);
    neckLines.quaternion.setFromUnitVectors(up,delta.normalize());
  }
  return {body,head,patch,update};
}

function makeFirstPerson(camera,m,double,skin) {
  const root=group(camera,'Occupant sleeves in first person');
  const arm=group(root,'Ochre stitched sleeve');
  const hand=createDetailedHand(skin);
  const handMaterial=hand.root.getObjectByName('Photographed palm, knuckles and nails').material;
  arm.add(hand.root);
  const sleeve=double.makeForearm({sleeveOnly:true});
  sleeve.name='Sleeve ending just over the wrist';sleeve.rotation.z=Math.PI;sleeve.position.y=-.106;
  arm.add(sleeve);
  const cloth=group(arm,'Cloth gripped in front of the face',[-.014,.07,-.037]);
  const fabric=sheet(cloth,'Cloth in hand',.26,.24,m.cloth);fabric.rotation.x=-.94;
  batchRigidParts(root);
  function pose(p) {
    root.visible=Boolean(p);
    if(!p)return;
    const reach=clamp(p.reach),lift=clamp(p.raise),showCloth=Boolean(p.cloth);
    const fov=2*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)/(camera.zoom||1);
    const height=.37*fov,width=height*camera.aspect;
    const size=Math.min(height*1.66,width*2.50);
    root.scale.setScalar(size);
    if(skin)handMaterial.color.setScalar(lerp(.18,.88,THREE.MathUtils.smoothstep(camera.aspect,.52,1.38)));
    const low=p.demonstrating?-.80:-.48;
    arm.position.set((.31-reach*.085-lift*.035)*width/size,(low+reach*.19+lift*(-.23-low))*height/size,-.37/size);
    arm.rotation.order='YXZ';
    arm.rotation.set(lerp(-.64,-.12,lift)-reach*.48,lerp(-.50,-.25,lift),lerp(.46,.15,lift)+reach*.25);
    hand.pose(showCloth?.65:lerp(.21,.045,Math.max(reach,lift)));
    cloth.visible=showCloth;
  }
  return {root,pose};
}

export function createShowFigures(world,{art=null,handSkin=null,foldSkin=null,foldGeometry=null}={}) {
  const root=group(world.root,'The Show Home: physical witnesses');
  const sourceArt=world.root.getObjectByName('The Scream in the kitchen window frame');
  const picture=art??sourceArt?.material?.map??null;
  const sourceWood=world.root.getObjectByName('television cabinet')?.material;
  const wallMap=world.root.getObjectByName('front wall')?.material?.map;
  const m={
    wood: sourceWood?.clone()??surface(0x533e29),
    enamel:surface(0x99a999,{roughness:.64,metalness:.11}),plaster:surface(0x70816e,{map:wallMap??null}),
    ivory:surface(0xc3c5a9),dark:surface(0x100f0d),brass:surface(0x9e783b,{metalness:.49,roughness:.55}),
    wire:surface(0x28261e,{metalness:.18,roughness:.40}),wallpaper:surface(0xc3c0a2,{map:wallMap??null,side:THREE.DoubleSide}),
    cloth:surface(0x9c9682,{side:THREE.DoubleSide}),thread:surface(0x675837),skin:surface(0x926e56)
  };
  const double=makeDouble(root,m);
  const hand=makeCounterHand(root,m,handSkin);
  const monster=foldGeometry?createFoldedBody(root,foldGeometry,foldSkin,picture,m.wallpaper):makeBody(root,m,picture);
  const originalCover=group(root,'Kitchen cloth caught on the picture frame',[-4.055,2.15,7.35]);
  originalCover.rotation.y=Math.PI/2;
  const drop=group(originalCover,'Sagging kitchen cloth');
  sheet(drop,'Cloth eclipsing the painting',1.14,1.18,m.cloth);
  for(const x of [-.49,-.45]){
    const stripe=box(drop,'Kitchen cloth woven edge',[.010,1.12,.001],[x,0,.017],m.thread);
    stripe.rotation.z=-.014;
  }
  // Follow the painted wrist, in the original print's 216 x 230 composition.
  // The two broken ochre brushstrokes pick up the occupant's cuff stitching.
  const stitches=new THREE.Group();
  stitches.name='Twin cuff stitches on the painted wrist';
  if(sourceArt){
    const {width,height}=sourceArt.geometry.parameters;
    const pigment=new THREE.MeshStandardMaterial({color:0xae8143,roughness:1,polygonOffset:true,
      polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    for(const dy of [0,2.2]){
      const stroke=new THREE.Shape();
      stroke.moveTo(95.6,185+dy);
      stroke.quadraticCurveTo(100.0,187.0+dy,104.1,182.9+dy);
      stroke.quadraticCurveTo(100,188.8+dy,95.6,185+dy);
      const ink=new THREE.Mesh(new THREE.ShapeGeometry(stroke),pigment);
      ink.scale.set(width/216,-height/230,1);
      ink.position.set(-width/2,height/2,.0003);ink.raycast=noPick;
      stitches.add(ink);
    }
    pigment.side=THREE.DoubleSide;
    sourceArt.add(stitches);
  }
  stitches.visible=false;
  batchRigidParts(root);

  const anchors = {
    eye:v(-4.105,2.15,7.35),raisedEye:v(-.37,2.65,7.22),
    replayCamera:v(-4.015,2.14,7.35),hand:v(-3.43,1.045,8.48),
    revealCamera:v(.54,1.54,9.47),revealTarget:v(-.51,1.61,7.18),
    finaleCamera:v(-.33,2.64,7.29),finaleTarget:v(.02,1.47,11.6)
  };
  let firstPerson=null;
  function attachFirstPerson(camera) {
    if(firstPerson)firstPerson.root.removeFromParent();
    firstPerson=makeFirstPerson(camera,m,double,handSkin);firstPerson.pose(null);
    return firstPerson.root;
  }
  function update(view={}) {
    const active=view.active!==false;
    root.visible=active;
    const bodyVisible=active&&Boolean(view.bodyVisible);
    if(sourceArt)sourceArt.visible=!bodyVisible&&!view.mirrorOpen;
    stitches.visible=active&&Boolean(view.keyTaken);
    if(firstPerson)firstPerson.pose(active?view.pov:null);
    if(!active)return;
    hand.update(Boolean(view.handVisible)&&!bodyVisible,Boolean(view.keyTaken),view.handReach);
    monster.update(view);
    const cover=clamp(view.coverEye);
    originalCover.visible=cover>.001&&!bodyVisible&&!view.mirrorOpen;
    drop.position.set((1-cover)*-.77,(1-cover)*-.60,.025);
    drop.scale.set(1,.50+cover*.5,1);
    drop.rotation.z=(1-cover)*.64;
    if(view.escape) {
      // Only the escape state supplies independent gait. Walking outside must
      // still display the exact face and coat seen in the recorded projection.
      double.pose(view.escape.progress>.47?view.escape:null);
    }else double.pose(view.projection);
  }
  function reset(){update({active:false});}
  reset();
  return {root,anchors,hand:hand.root,body:monster.body,head:monster.head,blindfold:monster.patch,
    double:double.actor,makeLatchHand:parent=>makeCounterHand(parent,m,handSkin).root,attachFirstPerson,update,reset};
}
