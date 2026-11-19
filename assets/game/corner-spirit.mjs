import * as THREE from './vendor/three.module.js';

export const CORNER_FACE_IMAGE = Object.freeze({
  width:1060,height:1484,minU:.1368,maxU:.8708,top:.1274,bottom:.8976,
});
const faceWidth=.494,faceHeight=.598;
const photoHeight=CORNER_FACE_IMAGE.bottom-CORNER_FACE_IMAGE.top;
const photoWidth=faceWidth/faceHeight*CORNER_FACE_IMAGE.height/CORNER_FACE_IMAGE.width*photoHeight;
const photoCenter=(CORNER_FACE_IMAGE.minU+CORNER_FACE_IMAGE.maxU)/2;
export const CORNER_SPIRIT_LAYOUT = Object.freeze({
  target: Object.freeze([2.10, 2.94, 4.00]),
  concealedY: 3.55, hand: Object.freeze([2.25, 3.12, 3.94]),
  faceWidth,faceHeight,
  // Remove vertical padding while retaining enough horizontal padding to keep
  // the source pixels square. Alpha, rather than an ellipse, defines the hair.
  photoUV:Object.freeze([photoCenter-photoWidth/2,1-CORNER_FACE_IMAGE.bottom,
    photoCenter+photoWidth/2,1-CORNER_FACE_IMAGE.top]),
});
const noRaycast = () => {};

/** A still optional discovery, separate from the Keeper's rules and counters.
 * Reading the table clue enables the still face until dismiss() is called.
 * Only the face-sized convex proxy participates in picking. The controller must
 * accept its first unoccluded hit, as with other real objects in the room. */
export function createCornerSpirit({ texture = null } = {}) {
  if(texture){
    texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  }
  const root = new THREE.Group(); root.name = 'Upstairs corner spirit'; root.visible = false;
  const target = new THREE.Vector3(...CORNER_SPIRIT_LAYOUT.target);
  const head = new THREE.Group(); head.name = 'Face behind the top stair rail'; root.add(head);
  const hand = new THREE.Group(); hand.name = 'Fingers over the top stair rail'; root.add(hand);
  const skin = new THREE.MeshStandardMaterial({ color: 0x6b7668, roughness: 1, transparent: true,
    alphaTest: .025, depthTest: true, depthWrite: true });
  const shadow = new THREE.MeshStandardMaterial({ color: 0x252d27, roughness: 1, transparent: true,
    alphaTest: .025, depthTest: true, depthWrite: true });
  const faceMaterial = new THREE.MeshBasicMaterial({ map: texture, color: 0xadb7b1, transparent: true,
    alphaTest: .035, depthTest: true, depthWrite: true, toneMapped: true, fog: true });
  function mesh(name, geometry, material, parent, position, scale) {
    const object = new THREE.Mesh(geometry, material); object.name = name;
    object.position.set(...position); if (scale) object.scale.set(...scale);
    object.raycast = noRaycast; object.userData.pickThrough = true;
    object.castShadow = false; object.receiveShadow = true; parent.add(object); return object;
  }
  // The backing follows the cranium, not the long hair below the chin.
  mesh('Corner spirit skull', new THREE.SphereGeometry(1,20,16),shadow,head,[0,.045,-.02],[.205,.225,.105]);
  const faceDepth=(x,y)=>.078+.0325*(1-Math.min(1,(x/(faceWidth/2))**2+(y/(faceHeight/2))**2));
  const faceGeometry=new THREE.PlaneGeometry(faceWidth,faceHeight,24,32);
  const uv=faceGeometry.attributes.uv,positions=faceGeometry.attributes.position;
  const [u0,v0,u1,v1]=CORNER_SPIRIT_LAYOUT.photoUV;
  for(let index=0;index<positions.count;index++){
    const x=positions.getX(index),y=positions.getY(index);
    positions.setZ(index,faceDepth(x,y));uv.setXY(index,u0+uv.getX(index)*(u1-u0),v0+uv.getY(index)*(v1-v0));
  }
  faceGeometry.computeVertexNormals();
  if (texture) {
    mesh('Corner spirit photographic face', faceGeometry, faceMaterial, head, [0, 0, 0]);
  } else {
    // Geometry fallback preserves a face-shaped silhouette if the image fails.
    mesh('Corner spirit pale face', new THREE.SphereGeometry(1, 20, 16), skin, head, [0, -.012, .025], [.195, .26, .091]);
    for (const side of [-1, 1]) mesh('Corner spirit recessed eye', new THREE.SphereGeometry(1, 12, 8), shadow, head,
      [side * .0767, .0455, .1131], [.0494, .0351, .0104]);
    mesh('Corner spirit mouth shadow', new THREE.SphereGeometry(1, 12, 8), shadow, head, [0, -.117, .1131], [.0338, .0624, .0117]);
  }
  mesh('Corner spirit palm', new THREE.SphereGeometry(1, 12, 8), skin, hand, [.008, .034, .009], [.046, .021, .035]);
  for (let index = 0; index < 3; index += 1) {
    const finger = mesh('Corner spirit curled fingertip', new THREE.CapsuleGeometry(.009, .045, 5, 8), skin, hand,
      [(index - 1) * .024, -.014 - index * .002, -.052 - Math.abs(index - 1) * .006]);
    finger.rotation.x = -.2;
  }
  let dismissed = false, enabled = false;
  const proxyGeometry=new THREE.CircleGeometry(1,48),proxyPosition=proxyGeometry.attributes.position;
  for(let i=0;i<proxyPosition.count;i++){
    const x=proxyPosition.getX(i)*faceWidth/2,y=proxyPosition.getY(i)*faceHeight/2;
    proxyPosition.setXYZ(i,x,y,faceDepth(x,y));
  }
  proxyGeometry.computeVertexNormals();
  const hitProxy = new THREE.Mesh(proxyGeometry, new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, colorWrite: false, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
  }));
  hitProxy.name = 'Corner spirit face target'; hitProxy.position.z = .004;
  hitProxy.userData.interaction = 'corner-spirit'; head.add(hitProxy);
  hitProxy.raycast = function (raycaster, hits) {
    if (root.visible && !dismissed) THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
  };
  const pose = { state: 'peeking', visible: false, seen: false, amount: 1, elapsed: 0, events: [] };

  function apply() {
    head.position.copy(target); head.lookAt(.75, target.y - .35, .8);
    hand.position.set(...CORNER_SPIRIT_LAYOUT.hand);
  }
  function publish() {
    root.visible = enabled && !dismissed;
    Object.assign(pose, { state: dismissed ? 'dismissed' : 'peeking', visible: root.visible,
      seen: dismissed, amount: dismissed ? 0 : 1, elapsed: 0, events: [] });
    return { ...pose, events: [] };
  }
  function reset() {
    dismissed = false; enabled = false; target.set(...CORNER_SPIRIT_LAYOUT.target);
    apply(); publish(); return pose;
  }
  function dismiss() {
    if (dismissed || !root.visible) return false;
    dismissed = true; publish(); return true;
  }
  function update(_dt, { active = false, hintRead = false, paused = false } = {}) {
    enabled = Boolean(active) && hintRead === true && !paused;
    if (!enabled) { root.visible = false; return { ...pose, visible: false, events: [] }; }
    return publish();
  }
  reset();
  return { root, target, head, hand, hitProxy, pose, update, reset, dismiss };
}
