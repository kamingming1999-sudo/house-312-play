import * as THREE from './vendor/three.module.js';

const clamp = value => THREE.MathUtils.clamp(value ?? 0, 0, 1);
const mix = THREE.MathUtils.lerp;
const vec = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

// The front and back of the same creature were fitted into a closed, weighted
// mesh. The four corners of its eye socket are registered to the head bone.
export function createFoldedBody(parent, geometry, skinTexture, art, wallpaper) {
  if (skinTexture) {
    skinTexture.colorSpace = THREE.SRGBColorSpace;
    skinTexture.anisotropy = 4;
  }
  const skin = new THREE.MeshStandardMaterial({
    map:skinTexture??null, color:skinTexture ? 0xeee7de : 0xa99c88, roughness:.90,
    emissiveMap:skinTexture??null, emissive:skinTexture ? 0xfff0dc : 0x332b24, emissiveIntensity:.32,
  });
  const body = new THREE.Group();
  body.name = 'Kitchen standing in the doorway';
  const shell = new THREE.SkinnedMesh(geometry,skin);
  shell.name = 'The folded house';
  shell.frustumCulled = false;
  shell.raycast = () => {};
  shell.userData.pickThrough = true;
  body.add(shell);

  const joints = new Map(), rest = new Map(), bones = [];
  for (const joint of geometry.userData.rig) {
    const bone = new THREE.Bone();
    bone.name = joint.name;
    const at = vec().fromArray(joint.at);
    rest.set(joint.name,at);
    bone.position.copy(at);
    if (joint.parent) bone.position.sub(rest.get(joint.parent));
    (joints.get(joint.parent) ?? shell).add(bone);
    joints.set(joint.name,bone);
    bones.push(bone);
  }
  shell.updateMatrixWorld(true);
  shell.bind(new THREE.Skeleton(bones));
  parent.add(body);
  const head=joints.get('head'), pelvis=joints.get('pelvis'), spine=joints.get('spine');
  const neck=joints.get('neck'), restPelvis=pelvis.position.clone();
  const corners=geometry.userData.eyeQuad.map(point=>vec().fromArray(point).sub(rest.get('head')));
  const centre=corners.reduce((sum,point)=>sum.add(point),vec()).multiplyScalar(.25);
  const normal=vec().crossVectors(vec().subVectors(corners[1],corners[0]),vec().subVectors(corners[0],corners[3])).normalize();
  const paperEye=new THREE.BufferGeometry();
  paperEye.setAttribute('position',new THREE.Float32BufferAttribute(corners.flatMap(point=>point.clone().addScaledVector(normal,.004).toArray()),3));
  paperEye.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));
  paperEye.setIndex([0,2,1,0,3,2]);paperEye.computeVertexNormals();
  const eye=new THREE.Mesh(paperEye,new THREE.MeshStandardMaterial({
    map:art??null,color:0xddd1b3,roughness:.95,emissiveMap:art??null,emissive:0xbfae8b,emissiveIntensity:.32,
    side:THREE.DoubleSide,
  }));
  eye.name='Eye of the house';eye.raycast=()=>{};head.add(eye);

  const paper=new THREE.PlaneGeometry(.365,.395,10,9),vertices=paper.attributes.position;
  for (let i=0;i<vertices.count;i++) {
    const x=vertices.getX(i),y=vertices.getY(i);
    vertices.setXYZ(i,x,y+(y<-.17?.013*Math.sin(81*x):0),.019*Math.cos(x*23)+.009*Math.sin(y*18));
  }
  paper.computeVertexNormals();
  const patch=new THREE.Mesh(paper,wallpaper);
  patch.name='Loose wallpaper carried over the eye';patch.raycast=()=>{};head.add(patch);
  const arms=['left','right'].map(side=>{
    const shoulder=joints.get(side+'Shoulder'),elbow=joints.get(side+'Elbow'),wrist=joints.get(side+'Wrist');
    return {shoulder,elbow,wrist,upper:elbow.position.clone().normalize(),lower:wrist.position.clone().normalize(),
      upperLength:elbow.position.length(),lowerLength:wrist.position.length()};
  });
  const legs=['left','right'].map(side=>[joints.get(side+'Hip'),joints.get(side+'Knee'),joints.get(side+'Ankle')]);
  const start=vec(),target=vec(),axis=vec(),pole=vec(),bend=vec(),dir=vec(),up=vec(),onFace=vec();
  const inverse=new THREE.Quaternion(),raisedWrist=new THREE.Quaternion(),openPalm=new THREE.Quaternion();
  const fingers=vec(.26,-1,.06).normalize();
  function aim(bone,localAxis,worldDirection) {
    bone.parent.getWorldQuaternion(inverse).invert();
    bone.quaternion.setFromUnitVectors(localAxis,worldDirection.applyQuaternion(inverse).normalize());
    bone.updateWorldMatrix(false,true);
  }
  function reach(arm,lift,blind) {
    if (!lift) return;
    const {shoulder,elbow,wrist,upperLength:a,lowerLength:b}=arm;
    shoulder.getWorldPosition(start);
    // An open hand goes up beside the shoulder. Only wallpaper crosses the face.
    shoulder.parent.getWorldQuaternion(inverse);
    target.set(.27,.04,.32).multiply(body.scale).applyQuaternion(inverse).add(start);
    if (blind) {
      onFace.copy(centre).add(dir.set(.11,-.13,.17));
      head.localToWorld(onFace);
      target.lerp(onFace,blind);
    }
    wrist.getWorldPosition(dir);
    target.lerpVectors(dir,target,lift);
    axis.subVectors(target,start);
    const scale=body.scale.y;
    const length=THREE.MathUtils.clamp(axis.length(),Math.abs(a-b)*scale+.002,(a+b)*scale-.002);
    axis.normalize();target.copy(start).addScaledVector(axis,length);
    pole.set(.63,-.76,.28).applyQuaternion(body.quaternion);
    pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(a*a*scale*scale-b*b*scale*scale+length*length)/(2*length);
    bend.copy(start).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a*scale*scale-along*along)));
    aim(shoulder,arm.upper,dir.subVectors(bend,start));
    aim(elbow,arm.lower,dir.subVectors(target,bend));
    wrist.parent.getWorldQuaternion(inverse).invert();
    up.set(mix(.12,-.44,blind),1,mix(.22,.02,blind)).applyQuaternion(body.quaternion).applyQuaternion(inverse).normalize();
    raisedWrist.setFromUnitVectors(fingers,up);
    wrist.quaternion.identity().slerp(raisedWrist,lift);
    wrist.quaternion.multiply(openPalm.setFromAxisAngle(fingers,1.738*lift*(1-blind)));
  }
  function update(view) {
    body.visible=Boolean(view.bodyVisible);
    if (!body.visible) return;
    const rise=clamp(view.rise),kneel=clamp(view.crouch),blind=clamp(view.blind);
    const lift=Math.max(clamp(view.raise),blind);
    const escape=view.escape,shrink=clamp(escape?.progress);
    body.visible=shrink<.997;
    const scale=mix(.84,1.035,rise)*(1-shrink*.44);
    body.scale.setScalar(scale);
    body.position.set(escape?.x??mix(-3.69,-.39,rise),.018,escape?.z??mix(7.33,7.39,rise));
    body.rotation.y=mix(Math.PI*.49,.20,rise);
    const fold=1-rise,step=(escape?.stride??view.stride??0)*rise;
    pelvis.position.copy(restPelvis);
    pelvis.position.y-=fold*.30+kneel*.46;
    pelvis.rotation.set(kneel*.16,step*.035,-.045*rise);
    spine.rotation.set(fold*.74+kneel*.17,-fold*.34+step*.035,fold*.33-.025*rise);
    neck.rotation.set(-fold*.34,.12*fold,-fold*.40+.047*rise);
    head.rotation.set(-THREE.MathUtils.clamp(view.headPitch??0,-1,1)*.22,
      THREE.MathUtils.clamp(view.headYaw??0,-1.5,1.5)*.22,fold*.20);
    for (let i=0;i<2;i++) {
      const side=i?1:-1,{shoulder,elbow,wrist}=arms[i],[hip,knee,ankle]=legs[i];
      hip.rotation.set(-1.02*fold-.87*kneel+side*step*.42,side*.04,side*.035);
      knee.rotation.set(1.54*fold+1.79*kneel+Math.max(0,-side*step)*.35,0,0);
      ankle.rotation.set(-.85*kneel-.4*fold,0,-side*.04);
      shoulder.rotation.set(-.37*fold+side*step*.18,-side*.09*fold,side*.24*fold);
      elbow.rotation.set(-.82*fold-.025,0,side*.04*fold);
      wrist.rotation.set(0,0,0);
    }
    body.updateMatrixWorld(true);
    reach(arms[1],lift,blind);
    patch.visible=blind>.012;
    patch.position.copy(centre).addScaledVector(normal,.049);
    patch.position.x+=(1-blind)*.36;
    patch.position.y-=(1-blind)*.53;
    patch.rotation.set(-.93*(1-blind),.19,-.30*(1-blind)-.07);
  }
  return {body,head,patch,update};
}
