import * as THREE from './vendor/three.module.js';

const smooth = (a,b,value) => {
  const t=THREE.MathUtils.clamp((value-a)/(b-a),0,1);return t*t*(3-2*t);
};

function hemOpacity(u, v) {
  const raggedEdge = .024 + .018 * Math.sin(u * 27) + .006 * Math.cos(u * 53);
  return smooth(raggedEdge, raggedEdge + .21, v);
}

// Read the silhouette once. Keeping a small copy also gives a finger a few
// pixels of leeway at the ragged hair, sleeve and fingertips.
function pickSilhouette(mesh, texture) {
  const image = texture?.image;
  if (!image?.width || !image.height) return;
  const width = 64, height = Math.max(1, Math.min(96, Math.round(width * image.height / image.width)));
  const mask = new Uint8Array(width * height);
  if (texture.isDataTexture && texture.format === THREE.RGBAFormat && texture.type === THREE.UnsignedByteType) {
    for (let y = 0; y < height; y++) {
      const row = Math.floor((y + .5) / height * image.height);
      for (let x = 0; x < width; x++) {
        const col = Math.floor((x + .5) / width * image.width);
        mask[y * width + x] = image.data[4 * (row * image.width + col) + 3];
      }
    }
  } else {
    const canvas = globalThis.document?.createElement?.('canvas');
    if (!canvas) return;
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    try {
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3];
    } catch {
      return; // A browser without readable pixels still has the ordinary mesh target.
    }
  }
  const hits = [], threshold = mesh.material.alphaTest * 255;
  mesh.raycast = function(ray, intersections) {
    if (!this.visible) return;
    hits.length = 0;
    THREE.Mesh.prototype.raycast.call(this, ray, hits);
    for (const hit of hits) {
      const opacity = hemOpacity(hit.uv.x, hit.uv.y);
      const col = Math.min(width - 1, Math.floor(hit.uv.x * width));
      const row = Math.min(height - 1, Math.floor((texture.flipY ? 1 - hit.uv.y : hit.uv.y) * height));
      let covered = false;
      for (let y = Math.max(0,row - 1); y <= Math.min(height - 1,row + 1) && !covered; y++) {
        for (let x = Math.max(0,col - 1); x <= Math.min(width - 1,col + 1); x++) {
          if (mask[y * width + x] * opacity >= threshold) { covered = true; break; }
        }
      }
      if (covered) intersections.push(hit);
    }
  };
}

// A photographic figure inside the opposite lit sash, behind its actual stone
// frame and mullion. Only the raised forearm moves; the face keeps watching.
export function createCourtyardGirl(world,{texture=null}={}) {
  const root=new THREE.Group();root.name='Woman waving from the opposite window';
  world.courtyard.group.add(root);root.visible=Boolean(texture);
  if(texture){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;}
  const image=texture?.image;
  const hasSize=Number.isFinite(image?.width)&&image.width>0&&Number.isFinite(image?.height)&&image.height>0;
  const width=.84,height=width*(hasSize?image.height/image.width:1402/1122);
  const geometry=new THREE.PlaneGeometry(width,height,48,64);
  const position=geometry.attributes.position,uv=geometry.attributes.uv,rest=position.array.slice();
  const material=new THREE.MeshBasicMaterial({map:texture,color:0xa5a48f,transparent:true,
    alphaTest:.025,depthTest:true,depthWrite:false,toneMapped:true,fog:true});
  const figure=new THREE.Mesh(geometry,material);figure.name='Photographic woman behind the far window';
  figure.position.set(-.85,3.53+height/2,-11.44);figure.raycast=()=>{};figure.userData.outside=true;
  figure.castShadow=false;root.add(figure);
  const apparitionHeight = 1.78;
  const closeup = new THREE.PlaneGeometry(width * apparitionHeight / height, apparitionHeight,16,24);
  const closeUV = closeup.attributes.uv;
  const colors = new THREE.Float32BufferAttribute(new Float32Array(closeUV.count * 4),4);
  for (let i=0; i<closeUV.count; i++) {
    colors.setXYZW(i,1,1,1,hemOpacity(closeUV.getX(i),closeUV.getY(i)));
  }
  closeup.setAttribute('color',colors);
  const apparition = new THREE.Mesh(closeup,
    new THREE.MeshBasicMaterial({map:texture,color:0xb4b2a0,vertexColors:true,transparent:true,alphaTest:.025,depthWrite:false}));
  apparition.name = 'Waving woman behind the player';
  apparition.userData.interaction = 'waving-woman';
  pickSilhouette(apparition,texture);
  apparition.visible = false;
  world.root?.add(apparition);

  let encounter = 'ready', stare = 0, wasLooking = false;
  const gazeRay = new THREE.Raycaster();
  const up = new THREE.Vector3(0,1,0);
  const behind = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const sight = new THREE.Vector3();
  const face = new THREE.Vector3();
  const offsets = [0,.36,-.36,.72,-.72,1.08,-1.08,1.48,-1.48];

  function clearSight(from, to) {
    sight.subVectors(to,from);
    gazeRay.set(from,sight.normalize());
    gazeRay.far = from.distanceTo(to) - .015;
    return !gazeRay.intersectObject(world.root,true).some(({object}) => {
      if (object === apparition || object.userData.pickThrough || object.material?.transparent && object.material.opacity === 0) return false;
      for (let node = object; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
  }
  // Frame the upper torso, keeping both the face and the raised palm on a phone.
  function revealFocus() {
    return apparition.localToWorld(face.set(.065 * apparition.geometry.parameters.width, .13 * apparitionHeight, 0));
  }
  function placeBehind(camera, canPlace) {
    camera.getWorldDirection(behind);
    behind.setY(0).normalize().negate();
    // Near a wall there may be no standing space behind the player. A close
    // apparition still fits in the clearance between the eye and the wall.
    for (const distance of [1.08,.82,.58,.32,.16]) {
      for (const angle of offsets) {
        candidate.copy(behind).applyAxisAngle(up,angle).multiplyScalar(distance).add(camera.position);
        if (distance > .32 && !canPlace(candidate.x,candidate.z)) continue;
        const scale = Math.min(1,distance / 1.08);
        apparition.scale.setScalar(scale);
        apparition.position.set(candidate.x,camera.position.y - .30 * apparitionHeight * scale,candidate.z);
        apparition.lookAt(camera.position.x,apparition.position.y,camera.position.z);
        apparition.updateMatrixWorld(true);
        if (clearSight(camera.position,revealFocus()) && clearSight(camera.position,apparition.position)) return true;
      }
    }
    return false;
  }
  function watch(seconds,{camera,lookingAtWindow,paused=false,canPlace}={}) {
    if (encounter !== 'ready' || !texture || !world.root) return false;
    if (paused) { wasLooking = false; return false; }
    if (!lookingAtWindow) { stare = 0; wasLooking = false; return false; }
    if (wasLooking) stare += seconds;
    wasLooking = true;
    if (stare + 1e-8 < 3 || !placeBehind(camera,canPlace)) return false;
    encounter = 'behind';
    root.visible = false;
    apparition.visible = true;
    return true;
  }
  function returnToWindow() {
    if (encounter !== 'behind' || !apparition.visible) return false;
    encounter = 'spent';
    apparition.visible = false;
    root.visible = Boolean(texture);
    return true;
  }
  // V11 elbow is near image-top-left coordinates (.88,.57); UV V is inverted.
  const pivot={x:(.88-.5)*width,y:((1-.57)-.5)*height};
  const pose={time:0,angle:0,visible:Boolean(texture)};
  let lastTime=null;
  function apply(){
    if(pose.angle===0){position.array.set(rest);position.needsUpdate=true;geometry.computeBoundingSphere();return;}
    const c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    for(let i=0;i<position.count;i++){
      const x=rest[i*3],y=rest[i*3+1],weight=smooth(.64,.78,uv.getX(i))*smooth(.40,.62,uv.getY(i));
      const dx=x-pivot.x,dy=y-pivot.y;
      position.setXYZ(i,x+((pivot.x+dx*c-dy*s)-x)*weight,y+((pivot.y+dx*s+dy*c)-y)*weight,rest[i*3+2]);
    }
    position.needsUpdate=true;geometry.computeBoundingSphere();
  }
  const nightTint=material.color.clone(),flashTint=new THREE.Color().setRGB(1.68,1.93,2.36);
  function reset(){material.color.copy(nightTint);encounter='ready';stare=0;wasLooking=false;apparition.visible=false;lastTime=null;pose.time=0;pose.angle=0;root.visible=Boolean(texture);apply();return {...pose};}
  function update(time,{paused=false,reducedMotion=false,lightning=0}={}){
    const safeTime=Number.isFinite(time)?Math.max(0,time):0;
    const dt=lastTime===null?0:Math.min(.1,Math.max(0,safeTime-lastTime));lastTime=safeTime;
    if(paused)return {...pose};
    material.color.copy(nightTint).lerp(flashTint,reducedMotion?0:lightning);
    if(encounter==='behind')return {...pose};
    if(!reducedMotion)pose.time+=dt;
    const cycle=pose.time%3;
    pose.angle=reducedMotion||cycle>=2.4?0:Math.sin(cycle*5.2)*.19*(1-smooth(2.2,2.4,cycle));
    apply();return {...pose};
  }
  reset();return {root,figure,apparition,pose,get stareSeconds(){return encounter==='ready'?stare:0;},watch,revealFocus,returnToWindow,update,reset};
}
