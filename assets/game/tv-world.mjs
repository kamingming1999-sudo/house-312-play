import * as THREE from './vendor/three.module.js';

function roundedRect(path, x, y, w, h, r) {
  path.moveTo(x+r,y); path.lineTo(x+w-r,y); path.quadraticCurveTo(x+w,y,x+w,y+r);
  path.lineTo(x+w,y+h-r); path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  path.lineTo(x+r,y+h); path.quadraticCurveTo(x,y+h,x,y+h-r);
  path.lineTo(x,y+r); path.quadraticCurveTo(x,y,x+r,y); return path;
}
function roundedBox(size, radius) {
  const geometry = new THREE.BoxGeometry(...size, 6, 6, 6), p = geometry.attributes.position;
  const half = new THREE.Vector3(...size).multiplyScalar(.5).addScalar(-radius), min=half.clone().negate();
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i=0;i<p.count;i++) {
    v.fromBufferAttribute(p,i); c.copy(v).clamp(min,half); v.sub(c).normalize().multiplyScalar(radius).add(c);
    p.setXYZ(i,v.x,v.y,v.z);
  }
  geometry.computeVertexNormals(); return geometry;
}

/** A physical consumer CRT around the unchanged screen and touch anchor. */
export function upgradeTelevision(world, {plastic = null, labelTexture} = {}) {
  const root = world.root;
  for (const child of [...root.children]) if (/^CRT casing$|^CRT bezel$|^CRT knob$|^speaker grille$|^antenna$/.test(child.name)) root.remove(child);
  const map = plastic;
  const bump = map?.clone() ?? null; if (bump) bump.colorSpace = THREE.NoColorSpace;
  const casing = new THREE.MeshStandardMaterial({color:0xdbd9d5,map,bumpMap:bump,bumpScale:.0018,roughness:.74,metalness:.02});
  const trim = new THREE.MeshStandardMaterial({color:0x383937,roughness:.52,metalness:.08});
  const rubber = new THREE.MeshStandardMaterial({color:0x111310,roughness:.94});
  const control = new THREE.MeshStandardMaterial({color:0x686b65,roughness:.65,metalness:.13});
  const dark = new THREE.MeshStandardMaterial({color:0x080b09,roughness:1});
  function mesh(name, geometry, material, at, interactive=true) {
    const object=new THREE.Mesh(geometry,material); object.name=name; object.position.set(...at);
    object.castShadow=object.receiveShadow=true;
    if (interactive) object.userData.interaction='tv'; else object.raycast=()=>{};
    root.add(object); return object;
  }
  const body=mesh('CRT aged charcoal housing',roundedBox([1.85,1.38,.8],.075),casing,[-.5,1.44,-3.63]);
  mesh('CRT tapered rear shell',roundedBox([1.58,1.12,.35],.09),casing,[-.5,1.48,-4.03]);
  // A recessed bevel surrounds a real opening; glass bulges forward into it.
  const shape=roundedRect(new THREE.Shape(),-.865,-.625,1.73,1.25,.075);
  shape.holes.push(roundedRect(new THREE.Path(),-.825,-.49,1.39,1.02,.065));
  const bezel=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.014,bevelSegments:3,curveSegments:12});
  mesh('CRT recessed screen bezel',bezel,trim,[-.5,1.45,-3.215]);
  for (const y of [1.16,1.76]) {
    const knob=mesh('CRT tuning wheel',new THREE.CylinderGeometry(.049,.049,.047,28),control,[.275,y,-3.145]);
    knob.rotation.x=Math.PI/2;
    mesh('CRT wheel indicator',new THREE.BoxGeometry(.004,.025,.006),rubber,[.275,y+.016,-3.117]);
  }
  const grille=new THREE.InstancedMesh(new THREE.BoxGeometry(.155,.007,.014),dark,20);
  const dummy=new THREE.Object3D();
  for(let i=0;i<20;i++){dummy.position.set(.275,1.29+i*.016,-3.15);dummy.updateMatrix();grille.setMatrixAt(i,dummy.matrix);}
  grille.name='CRT recessed speaker slots';grille.userData.interaction='tv';root.add(grille);
  mesh('CRT mechanical power key',roundedBox([.08,.026,.036],.007),control,[.27,.925,-3.148]);
  const led=mesh('CRT dim standby light',new THREE.SphereGeometry(.005,8,6),new THREE.MeshBasicMaterial({color:0x875644}),[.18,.927,-3.12],false);
  for(const x of [-1.14,.14]) mesh('CRT rubber foot',new THREE.BoxGeometry(.13,.035,.31),rubber,[x,.735,-3.52],false);
  if(labelTexture){
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.15,.025),new THREE.MeshBasicMaterial({
      map:labelTexture(['TUNING'],{background:'#343633',color:'#8b8c82',size:256,font:'monospace'}),transparent:false,
    }));label.name='CRT worn tuning label';label.position.set(.275,1.675,-3.117);label.raycast=()=>{};root.add(label);
  }
  const glassMaterial=new THREE.MeshPhysicalMaterial({color:0xb3bcba,roughness:.25,metalness:0,clearcoat:.7,
    clearcoatRoughness:.16,transparent:true,opacity:.065,depthWrite:false});
  const glass=mesh('CRT curved glass reflection',world.screen.geometry.clone(),glassMaterial,world.screen.position.toArray(),false);
  glass.position.z+=.006;glass.castShadow=false;glass.renderOrder=1;
  const wire=new THREE.CatmullRomCurve3([
    new THREE.Vector3(.2,.83,-3.98),new THREE.Vector3(.65,.26,-4.2),new THREE.Vector3(.94,.13,-4.29),new THREE.Vector3(1,.43,-4.3),
  ]);
  mesh('CRT slack power lead',new THREE.TubeGeometry(wire,24,.008,6,false),rubber,[0,0,0],false);
  mesh('CRT wall outlet',roundedBox([.12,.15,.026],.012),new THREE.MeshStandardMaterial({color:0x7e8070,roughness:.9}),[1,.44,-4.31],false);
  mesh('CRT power plug',roundedBox([.055,.065,.04],.008),rubber,[1,.44,-4.275],false);
  world.screenMaterial.color.setHex(0xffffff);
  world.tvLight.color.setHex(0xb6c1be);world.tvLight.intensity=.58;
  world.television={body,glass,led}; return world.television;
}
