import * as THREE from './vendor/three.module.js';

// The silver is tipped down above the basin. Its reflected eye and asymmetric
// frustum use the physical edges of the glass, so leaning changes the parallax.
export function createPaintingMirror({world,camera,renderer,girl,figures,art,grime}){
  const width=1.10,height=1.12,tilt=.36;
  const frame=new THREE.Group();
  frame.name='Silvered glass behind The Scream';
  frame.position.set(-3.91,2.12,7.35);
  frame.rotation.order='ZYX';frame.rotation.y=Math.PI/2;frame.rotation.z=-tilt;
  world.root.add(frame);
  const silver=new THREE.MeshBasicMaterial({color:0xd5d9ce,toneMapped:false});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(width,height),silver);
  glass.raycast=()=>{};frame.add(glass);
  if(grime){
    const film=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({
      map:grime,color:0xb2aca0,transparent:true,opacity:.16,depthWrite:false,
    }));
    film.position.z=.002;film.raycast=()=>{};frame.add(film);
  }
  const edging=new THREE.MeshStandardMaterial({color:0x857663,metalness:.32,roughness:.52});
  for(const side of [-1,1]){
    const stile=new THREE.Mesh(new THREE.BoxGeometry(.028,height+.04,.026),edging);
    stile.position.x=side*(width+.02)/2;frame.add(stile);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(width,.028,.026),edging);
    rail.position.y=side*(height+.017)/2;frame.add(rail);
  }
  const canvas=new THREE.Mesh(new THREE.BoxGeometry(.24,.255,.010),[
    edging,edging,edging,edging,new THREE.MeshBasicMaterial({map:art,color:0xbaa98d}),edging,
  ]);
  canvas.name='Painting held by the lower corner';canvas.rotation.set(.14,-.20,-.20);
  camera.add(canvas);
  // Shares the courtyard rig's deforming hand geometry; the original encounter
  // and its one-time scare keep their own visibility and state.
  const visitor=girl.figure.clone();
  visitor.name='Woman reflected over the occupant’s shoulder';
  const scale=1.89/visitor.geometry.parameters.height;
  visitor.scale.setScalar(scale);visitor.rotation.y=-Math.PI/2;visitor.raycast=()=>{};
  world.root.add(visitor);
  const bounce=new THREE.PointLight(0xd2c6a9,2.4,3.5,2);
  bounce.position.set(-3.72,2.02,7.15);bounce.visible=false;world.root.add(bounce);
  const normal=new THREE.Vector3(Math.cos(tilt),-Math.sin(tilt),0);
  const up=new THREE.Vector3(Math.sin(tilt),Math.cos(tilt),0);
  const right=new THREE.Vector3(0,0,1),delta=new THREE.Vector3(),forward=new THREE.Vector3();
  const reflected=new THREE.PerspectiveCamera();reflected.up.copy(up);
  const aim=new THREE.Vector3();
  let buffer=null;
  function hide(){frame.visible=false;canvas.visible=false;visitor.visible=false;}
  hide();
  function present(player,time){
    frame.visible=true;canvas.visible=Boolean(art);
    const lean=THREE.MathUtils.clamp(player.lookOffset,-.8,.8);
    const nod=THREE.MathUtils.clamp(player.pitch-player.basePitch,-.65,.65);
    camera.position.set(-3.02,1.70+nod*.085,7.35+lean*.20);
    aim.copy(frame.position);aim.z+=lean*.055;aim.y+=nod*.06;camera.lookAt(aim);
    canvas.position.set(-Math.min(.23,.23*camera.aspect),-.33+Math.max(0,1-time/.6)*.28,-.37);
    visitor.position.set(-2.20,.98,7.77);
    return {x:camera.position.x,z:camera.position.z,yaw:Math.PI/2+lean*.54,pitch:nod*.65,reach:.28,raise:.45};
  }
  function reflect(scene){
    if(!frame.visible)return;
    if(!buffer){
      buffer=new THREE.WebGLRenderTarget(512,512);
      buffer.texture.colorSpace=THREE.SRGBColorSpace;
      buffer.texture.repeat.x=-1;buffer.texture.offset.x=1;
      silver.map=buffer.texture;silver.needsUpdate=true;
    }
    const distance=delta.subVectors(camera.position,frame.position).dot(normal);
    reflected.position.copy(camera.position).addScaledVector(normal,-2*distance);
    reflected.lookAt(forward.copy(reflected.position).add(normal));
    delta.subVectors(frame.position,reflected.position);
    const x=delta.dot(right),y=delta.dot(up);
    reflected.near=distance;reflected.far=30;
    reflected.projectionMatrix.makePerspective(x-width/2,x+width/2,y+height/2,y-height/2,distance,30);
    reflected.projectionMatrixInverse.copy(reflected.projectionMatrix).invert();reflected.updateMatrixWorld();
    const previous=renderer.getRenderTarget(),shadows=renderer.shadowMap.autoUpdate;
    frame.visible=false;canvas.visible=false;visitor.visible=Boolean(visitor.material.map);bounce.visible=true;figures.double.visible=true;
    try{
      renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(buffer);renderer.render(scene,reflected);
    }finally{
      renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadows;
      visitor.visible=false;bounce.visible=false;figures.double.visible=false;frame.visible=true;canvas.visible=Boolean(art);
    }
  }
  return {present,reflect,hide};
}
