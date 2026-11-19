import * as THREE from './vendor/three.module.js';

export const COURTYARD_APERTURE={minX:-3.525,maxX:-1.875,minY:1.275,maxY:2.925,wallZ:-4.55};

function mergedBoxes(parts){
  const geometries=parts.map(([size,at])=>new THREE.BoxGeometry(...size).toNonIndexed().translate(...at));
  const result=new THREE.BufferGeometry();
  for(const name of ['position','normal','uv']){
    const size=geometries[0].getAttribute(name).itemSize;
    const values=new Float32Array(geometries.reduce((n,g)=>n+g.getAttribute(name).array.length,0));
    let cursor=0;for(const geometry of geometries){values.set(geometry.getAttribute(name).array,cursor);cursor+=geometry.getAttribute(name).array.length;}
    result.setAttribute(name,new THREE.BufferAttribute(values,size));
  }
  for(const geometry of geometries)geometry.dispose();result.computeBoundingSphere();return result;
}
function paving(){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/16),offset=row%2*16,edge=(x+offset)%32<2||y%16<2;
    const n=(Math.sin(x*12.97+y*78.23)*43758.54%1+1)%1;
    const value=edge?39:65+n*18;const i=(y*size+x)*4;
    data[i]=value*.86;data[i+1]=value;data[i+2]=value*1.04;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,size,size);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.repeat.set(5,5);map.needsUpdate=true;return map;
}

/** A shallow, fully depth-tested exterior visible only through the sash opening.
 * The glass keeps its exact original position/size and remains a solid pick hit.
 */
export function createCourtyard(root,windowPanel,{textures={}}={}){
  const front=root.getObjectByName('front wall'),a=COURTYARD_APERTURE;
  // Retain the named wall mesh/material and its outer boundary, with a genuine
  // opening instead of placing exterior scenery in front of an opaque wall.
  front.geometry.dispose();
  front.geometry=mergedBoxes([
    [[a.minX+4.325,3.3,.2],[(-4.325+a.minX)/2,0,0]],
    [[4.325-a.maxX,3.3,.2],[(a.maxX+4.325)/2,0,0]],
    [[a.maxX-a.minX,a.minY,.2],[(a.minX+a.maxX)/2,a.minY/2-1.65,0]],
    [[a.maxX-a.minX,3.3-a.maxY,.2],[(a.minX+a.maxX)/2,(a.maxY+3.3)/2-1.65,0]],
  ]);
  windowPanel.material=new THREE.MeshPhysicalMaterial({color:0x9dafb2,transparent:true,opacity:.10,
    roughness:.24,metalness:0,clearcoat:.3,depthWrite:false});
  windowPanel.material.name='Rain-stained clear sash glass';
  windowPanel.userData.outsideBarrier=true;
  windowPanel.raycast=THREE.Mesh.prototype.raycast;
  const group=new THREE.Group();group.name='Enclosed courtyard beyond the window';group.userData.outside=true;root.add(group);
  const brickMap=textures.brick?.clone()??null;if(brickMap)brickMap.repeat.set(3.2,2.2);
  const masonry=new THREE.MeshStandardMaterial({color:0x747f7b,map:brickMap,roughness:.98,emissive:0x142021,emissiveIntensity:.28});
  const stone=new THREE.MeshStandardMaterial({color:0x626e70,roughness:.94});
  const black=new THREE.MeshStandardMaterial({color:0x111918,roughness:1});
  const glass=new THREE.MeshStandardMaterial({color:0x132226,emissive:0x102024,emissiveIntensity:.25,roughness:.46});
  const lit=new THREE.MeshStandardMaterial({color:0x5b5037,emissive:0x6a4b25,emissiveIntensity:.16,roughness:.78});
  const batches=new Map();
  function box(name,size,at,material){
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push({name,size,at});
  }
  box('Back courtyard building',[9.2,6.2,.24],[-2.7,3.05,-11.65],masonry);
  for(const x of [-7.22,1.82])box('Courtyard side wing',[.24,5.8,7.0],[x,2.85,-8.05],masonry);
  for(const y of [2.93,5.62])box('Weathered facade ledge',[9.3,.12,.34],[-2.7,y,-11.46],stone);
  for(const x of [-5.55,-3.18,-.82])for(const y of [1.8,4.18]){
    box('Recessed exterior window',[.86,1.3,.05],[x,y,-11.49],x===-.82&&y===4.18?lit:glass);
    for(const xx of [x-.49,x+.49])box('Stone exterior window jamb',[.12,1.55,.16],[xx,y,-11.39],stone);
    for(const yy of [y-.74,y+.74])box('Stone exterior window sill',[1.12,.12,.21],[x,yy,-11.36],stone);
    box('Exterior window mullion',[.035,1.28,.055],[x,y,-11.43],black);
  }
  box('Courtyard service doorway',[1.02,2.1,.075],[-5.58,1.02,-11.45],black);
  const pavement=new THREE.MeshStandardMaterial({color:0x9da6a0,map:paving(),roughness:.38,metalness:.08});
  box('Rain-darkened courtyard paving',[9.1,.08,7.1],[-2.7,-.06,-8.05],pavement);
  for(const x of [-6.3,.8])box('Courtyard drainpipe',[.075,5.6,.085],[x,2.8,-11.3],black);
  // A small motionless shape across the yard, never a face pasted onto the glass.
  box('Far courtyard coat',[.25,1.03,.18],[-4.25,.92,-10.9],black);
  for(const x of [-4.32,-4.18])box('Far courtyard legs',[.075,.48,.10],[x,.22,-10.88],black);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),black);head.name='Distant courtyard silhouette head';head.position.set(-4.25,1.56,-10.89);group.add(head);
  for(const [material,parts]of batches){
    const mesh=new THREE.Mesh(mergedBoxes(parts.map(p=>[p.size,p.at])),material);mesh.name='Courtyard architectural batch';mesh.userData.parts=parts.map(p=>p.name);group.add(mesh);
  }
  const branches=[];
  const stem=[-1.45,0,-9.6];
  for(let i=0;i<10;i++){
    const y=.4+i*.27,x=stem[0]+Math.sin(i*.7)*.08,z=stem[2];
    branches.push(stem[0],i?y-.27:0,z,x,y,z);
    if(i>2)branches.push(x,y,z,x+(i%2?-.65:.55)*(i/10),y+.48,z-.12);
  }
  const branchGeometry=new THREE.BufferGeometry();branchGeometry.setAttribute('position',new THREE.Float32BufferAttribute(branches,3));
  const tree=new THREE.LineSegments(branchGeometry,new THREE.LineBasicMaterial({color:0x18211f}));tree.name='Bare courtyard sapling';tree.raycast=()=>{};group.add(tree);
  const rainPositions=new Float32Array(64*6),rainRest=[];
  for(let i=0;i<64;i++)rainRest.push({x:-6.8+(i*1.837%8.1),y:(i*1.137%5.2),z:-5.1-(i*.719%6.0),length:.09+(i%5)*.025});
  const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0x8bacae,transparent:true,opacity:.18,depthWrite:false}));
  rain.name='Rain falling into the courtyard';rain.raycast=()=>{};group.add(rain);
  group.traverse(o=>{o.castShadow=false;o.receiveShadow=false;if(o.isMesh)o.userData.outside=true;});
  function update(time,{reducedMotion=false}={}){
    const t=reducedMotion?0:(Number.isFinite(time)?Math.max(0,time):0);
    for(let i=0;i<rainRest.length;i++){
      const p=rainRest[i],y=(p.y-t*1.15%5.2+5.2)%5.2;
      rainPositions.set([p.x,y,p.z,p.x-.015,y-p.length,p.z+.007],i*6);
    }
    rainGeometry.attributes.position.needsUpdate=true;
  }
  function reset(){update(0,{reducedMotion:true});}
  reset();return {group,glass:windowPanel,rain,aperture:{...a},update,reset};
}
