import * as THREE from './vendor/three.module.js';

// Pixel coordinates in the dorsal photograph. Both photographs in the atlas
// share this silhouette; the palmar plate occupies the mirrored right half.
const width = 1536, height = 1024, metresPerPixel = .000224;
const heel = [428, 829];
const outline = [
  [557,1016],[304,1016],[302,1013],[302,889],[296,842],[284,811],[265,786],[237,766],
  [148,676],[116,612],[72,563],[38,515],[12,493],[8,482],[12,464],[20,454],
  [33,448],[55,444],[86,452],[114,464],[136,480],[199,560],[211,566],[220,559],
  [240,504],[246,445],[244,398],[218,272],[216,196],[210,161],[212,127],[216,98],
  [232,76],[250,70],[270,76],[282,93],[294,144],[300,205],[314,267],[330,358],
  [335,368],[347,368],[352,363],[354,348],[344,237],[346,149],[344,89],[346,55],
  [350,34],[358,21],[368,12],[382,6],[398,8],[409,14],[418,23],[424,40],
  [426,142],[436,226],[436,325],[440,368],[450,365],[454,352],[456,304],[472,216],
  [486,93],[492,71],[505,58],[519,52],[539,56],[554,68],[560,92],[558,143],
  [552,180],[548,280],[528,396],[530,417],[539,426],[550,421],[580,346],[594,298],
  [604,247],[616,216],[629,202],[647,200],[657,204],[666,212],[670,225],[672,253],
  [666,296],[648,379],[614,483],[594,678],[560,779],[560,810],[564,852],[558,900],[560,1014],
];

const fingers = [
  {name:'Thumb', points:[[238,691],[145,590],[80,530],[27,470]], bend:[.86,1.04,.94]},
  {name:'Index', points:[[305,449],[268,273],[247,159],[249,73]], bend:[1.05,1.48,.99]},
  {name:'Middle', points:[[398,446],[390,250],[383,128],[387,8]], bend:[1.14,1.54,1.05]},
  {name:'Ring', points:[[486,449],[510,274],[522,152],[524,55]], bend:[1.18,1.59,1.11]},
  {name:'Little', points:[[566,476],[610,344],[637,266],[648,203]], bend:[1.25,1.63,1.15]},
];
const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

function xyz(x, y, z = 0) {
  return new THREE.Vector3((x - heel[0]) * metresPerPixel, (heel[1] - y) * metresPerPixel, z * metresPerPixel);
}

function distanceToEdge(x, y) {
  let inside = false, nearest = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i], [bx, by] = outline[(i + 1) % outline.length];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx*dx + dy*dy), 0, 1);
    nearest = Math.min(nearest, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2);
    if ((ay > y) !== (by > y) && x < ax + dx * (y - ay) / dy) inside = !inside;
  }
  return Math.sqrt(nearest) * (inside ? 1 : -1);
}

const chains = fingers.map(finger => {
  let arc = 0;
  return finger.points.slice(1).map(([x, y], i) => {
    const [ax, ay] = finger.points[i], dx = x - ax, dy = y - ay;
    const length = Math.hypot(dx, dy);
    const segment = {ax, ay, dx:dx/length, dy:dy/length, arc, length};
    arc += length;
    return segment;
  });
});

function nearestFinger(x, y) {
  let nearest = Infinity, chosen = 0, along = 0;
  for (const [index, segments] of chains.entries()) {
    for (const s of segments) {
      const t = (x-s.ax) * s.dx + (y-s.ay) * s.dy;
      const u = clamp(t, 0, s.length);
      const square = (x-s.ax-u*s.dx) ** 2 + (y-s.ay-u*s.dy) ** 2;
      if (square < nearest) {
        nearest = square;
        chosen = index;
        along = s.arc + (s.arc === 0 ? Math.min(t,s.length) : u);
      }
    }
  }
  return {index:chosen, along};
}

function handGeometry() {
  const positions = [], uv = [], indices = [], joints = [], weights = [];
  const seams = [];
  function vertex(point) {
    if (point.front !== undefined) return;
    const {x, y} = point;
    const {index, along} = nearestFinger(x,y);
    const segments = chains[index], base = index * 3 + 1;
    // Move the web gradually into the first knuckle. The two narrow blended
    // bands at the finger joints keep the whole skin watertight as it curls.
    const lift = smooth(along,-55,35);
    const middle = smooth(along,segments[1].arc-25,segments[1].arc+25);
    const tip = smooth(along,segments[2].arc-18,segments[2].arc+18);
    const palm = 1 - smooth(along,-28,65);
    const radius = 43 + 39*palm;
    const u = Math.min(Math.max(0,point.edge) / radius, 1);
    const round = Math.sqrt(u * (2-u));
    const knuckle = 9 * Math.exp(-((along / 51)**2));
    const thumbPad = 18 * Math.exp(-(((x-281)/121)**2) - ((y-680)/137)**2);
    const littlePad = 12 * Math.exp(-(((x-544)/78)**2) - ((y-685)/138)**2);
    const hollow = 12 * Math.exp(-(((x-416)/99)**2) - ((y-586)/111)**2);
    const zDorsal = round * (34 + 19*palm + knuckle);
    const zPalmar = -round * (34 + 26*palm + thumbPad + littlePad - hollow);
    point.front = positions.length/3;
    point.back = point.front + 1;
    for (const z of [zDorsal, zPalmar]) {
      positions.push(...xyz(x,y,z).toArray());
      joints.push(0,base,base+1,base+2);
      weights.push(1-lift, lift*(1-middle), lift*(middle-tip), lift*tip);
    }
    uv.push(x/width,1-y/height,(width-1-x)/width,1-y/height);
    if (point.edge === 0) seams.push(point.front);
  }

  // Cut a regular grid against the measured outline. Both photographic sides
  // meet at the same rounded physical edge, including through all four webs.
  const columns = 51, rows = 75, gridStep = 14;
  const grid = Array.from({length:rows*columns}, (_,id) => {
    const x = (id%columns)*gridStep-9, y = Math.floor(id/columns)*gridStep-8;
    return {id, x, y, edge:distanceToEdge(x,y)};
  });
  const boundary = new Map();
  function crossing(a,b) {
    const key = Math.min(a.id,b.id) * grid.length + Math.max(a.id,b.id);
    let point = boundary.get(key);
    if (!point) {
      const t = a.edge/(a.edge-b.edge);
      point = {x:THREE.MathUtils.lerp(a.x,b.x,t), y:THREE.MathUtils.lerp(a.y,b.y,t), edge:0};
      boundary.set(key,point);
    }
    return point;
  }
  function triangle(a,b,c) {
    if (a.edge < 0 && b.edge < 0 && c.edge < 0) return;
    const corners = [a,b,c], clipped = [];
    for (let i = 0; i < corners.length; i++) {
      const current = corners[i], next = corners[(i+1)%3];
      if (current.edge >= 0) clipped.push(current);
      if ((current.edge >= 0) !== (next.edge >= 0)) clipped.push(crossing(current,next));
    }
    for (const point of clipped) vertex(point);
    for (let i = 1; i+1 < clipped.length; i++) {
      const [p,q,r] = [clipped[0],clipped[i],clipped[i+1]];
      indices.push(p.front,q.front,r.front,r.back,q.back,p.back);
    }
  }
  for (let row = 1; row < rows; row++) for (let col = 1; col < columns; col++) {
    const k = row * columns + col;
    const tl = grid[k-columns-1], bl = grid[k-1], br = grid[k], tr = grid[k-columns];
    triangle(tl,bl,br);
    triangle(tl,br,tr);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal, n = new THREE.Vector3(), opposite = new THREE.Vector3();
  for (const i of seams) {
    n.fromBufferAttribute(normals,i).add(opposite.fromBufferAttribute(normals,i+1)).normalize();
    normals.setXYZ(i,n.x,n.y,n.z);
    normals.setXYZ(i+1,n.x,n.y,n.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

let sharedGeometry;
export function createDetailedHand(texture) {
  sharedGeometry ??= handGeometry();
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }
  const material = new THREE.MeshStandardMaterial({
    map:texture ?? null, color:texture ? 0xc7bdb3 : 0xae8976, roughness:.86,
    bumpMap:texture ?? null, bumpScale:.00035,
    emissiveMap:texture ?? null, emissive:texture ? 0xffffff : 0x3c2d24, emissiveIntensity:.10,
  });
  const root = new THREE.Group();
  root.name = 'Detailed right hand';
  const skin = new THREE.SkinnedMesh(sharedGeometry,material);
  skin.name = 'Photographed palm, knuckles and nails';
  skin.frustumCulled = false;
  skin.raycast = () => {};
  skin.userData.pickThrough = true;
  root.add(skin);
  const wrist = new THREE.Bone();
  wrist.name = 'Heel of the palm';
  skin.add(wrist);
  const bones = [wrist], bends = [];
  for (const [index, finger] of fingers.entries()) {
    let parent = wrist, previous = new THREE.Vector3();
    for (const [joint, segment] of chains[index].entries()) {
      const origin = xyz(segment.ax,segment.ay);
      const bone = new THREE.Bone();
      bone.name = finger.name + ' ' + ['base','middle joint','distal joint'][joint];
      bone.position.subVectors(origin,previous);
      parent.add(bone);
      const axis = new THREE.Vector3(segment.dy,segment.dx,0);
      bends.push({bone,axis,angle:finger.bend[joint],opposition:index === 0 && joint === 0});
      bones.push(bone);
      parent = bone;
      previous = origin;
    }
  }
  skin.bind(new THREE.Skeleton(bones));
  const turn = new THREE.Quaternion(), vertical = new THREE.Vector3(0,0,1);
  let last = -1;
  function pose(curl = 0) {
    const amount = clamp(Number.isFinite(curl) ? curl : 0, 0, 1);
    if (amount === last) return;
    last = amount;
    for (const {bone,axis,angle,opposition} of bends) {
      bone.quaternion.setFromAxisAngle(axis,angle*amount);
      if (opposition) bone.quaternion.premultiply(turn.setFromAxisAngle(vertical,-.53*amount));
    }
  }
  pose(0);
  return {root, pose};
}
