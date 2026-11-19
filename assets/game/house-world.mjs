import * as THREE from './vendor/three.module.js';
import { createWorld as createRoom } from './world.mjs?v=tvtip20';
import { createHearth } from './hearth-world.mjs?v=hearth20';
import { createCourtyard } from './courtyard-world.mjs?v=storm29';
import {buildAttic} from './attic.mjs?v=atticnote24';
import { dressParlorWindow } from './parlor-window.mjs';

// Preserve the CRT, its ray targets and the working door; replace the hotel set.
export function createWorld(scene, options = {}) {
  const textures = options.textures || {};
  const world = createRoom(scene, options), root = world.root;
  root.name = 'House 312 ground floor';
  const removed = /^(bed |mattress$|blanket|pillow$|chair |side table$|table leg$|table base$|glass$|lamp base$|lamp stem$|window |heavy curtain$|hall wall$|hall end$|hall wainscot$|hall light fitting$)/;
  for (const object of [...root.children]) {
    if (removed.test(object.name) || object.geometry?.type === 'ConeGeometry' ||
      (!object.name && object.geometry?.type === 'PlaneGeometry' && !object.userData.interaction)) {
      root.remove(object);
    }
  }
  // The number was a hotel plaque. The room now opens into a domestic hallway.
  for (const object of [...world.hinge.children]) if (object.geometry?.type === 'PlaneGeometry') world.hinge.remove(object);
  const wall = root.getObjectByName('front wall').material;
  wall.color.setHex(0xd2cdbc); wall.bumpMap = textures.wallBump; wall.bumpScale = .022;
  const wood = root.getObjectByName('television cabinet').material;
  wood.color.setHex(0xc7baa5); wood.bumpMap = textures.woodBump; wood.bumpScale = .01; wood.roughness = .86;
  const floor = new THREE.MeshStandardMaterial({ color: 0xc9c0b1, map: textures.floor || textures.wood,
    bumpMap: textures.floorBump ?? null, bumpScale: .018, roughness: .94 });
  root.getObjectByName('worn floorboards').material = floor;
  root.getObjectByName('hall floor').material = floor;
  const dark = new THREE.MeshStandardMaterial({ color: 0x171813, roughness: 1 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xb9b4a5, map: textures.wallpaper, roughness: .98, bumpMap: textures.wallBump ?? null, bumpScale: .013 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xe1d9cb, map: textures.fabric, roughness: .98, bumpMap: textures.fabricBump ?? null, bumpScale: .009 });
  const fadedFabric = fabric.clone(); fadedFabric.color.setHex(0xb4beab);
  const brass = new THREE.MeshStandardMaterial({ color: 0x7c6945, metalness: .65, roughness: .62 });
  const enamel = new THREE.MeshStandardMaterial({ color: 0xb6b7a3, roughness: .63, metalness: .12 });
  const brick = new THREE.MeshStandardMaterial({ color: 0xd3c5b3, roughness: .97, map: textures.brick ?? null, bumpMap: textures.brickBump ?? null, bumpScale: .024 });
  const piping = new THREE.MeshStandardMaterial({ color: 0x655f50, roughness: 1 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xc5bea7, roughness: 1 });
  const grime = new THREE.MeshStandardMaterial({ map: textures.grime ?? null, color: 0x6a6656,
    transparent: true, opacity: textures.grime ? .65 : 0, depthWrite: false, roughness: 1, side: THREE.DoubleSide });
  const noRaycast = () => {};
  function solid(mesh) {
    mesh.userData.houseStatic = true; mesh.raycast = THREE.Mesh.prototype.raycast; return mesh;
  }
  function decorate(mesh) {
    // Only fine details allow picking through to the substantial surface beneath.
    mesh.userData.houseStatic = true; mesh.userData.pickThrough = true; mesh.raycast = noRaycast; return mesh;
  }
  function box(name, size, at, material = wood, parent = root) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.name = name;
    mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return solid(mesh);
  }
  function round(name, size, at, material, radius = .08) {
    const geometry = new THREE.BoxGeometry(...size, 5, 5, 5), p = geometry.attributes.position;
    const inner = new THREE.Vector3(...size).multiplyScalar(.5).addScalar(-radius);
    const point = new THREE.Vector3(), clamped = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i); clamped.copy(point).clamp(inner.clone().negate(), inner);
      point.sub(clamped).normalize().multiplyScalar(radius).add(clamped); p.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals(); const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return solid(mesh);
  }
  function cylinder(name, radius, height, at, material = brass) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material);
    mesh.name = name; mesh.position.set(...at); mesh.castShadow = true; root.add(mesh); return solid(mesh);
  }
  function beam(name, from, to, width = .09, depth = .09, material = wood) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mesh = box(name, [width, a.distanceTo(b), depth], a.clone().add(b).multiplyScalar(.5).toArray(), material);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
  }
  function tube(name, points, radius = .004, material = piping, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 5), radius, 4, closed), material);
    mesh.name = name; mesh.receiveShadow = true; root.add(mesh); return decorate(mesh);
  }
  function decal(name, size, at, rotation) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), grime); mesh.name = name;
    mesh.position.set(...at); mesh.rotation.set(...rotation); root.add(mesh); return decorate(mesh);
  }
  function sag(mesh, amount = .035) {
    const p = mesh.geometry.attributes.position, half = mesh.geometry.parameters.width / 2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0) p.setY(i, y - amount * Math.max(0, 1 - (x / half) ** 2) * Math.max(0, 1 - (z / .42) ** 2));
    }
    mesh.geometry.computeVertexNormals(); return mesh;
  }

  // Heavy structure, damaged plaster, and uneven domestic details break the box silhouette.
  for (const z of [-3.15, -.6]) box('exposed ceiling beam', [8.35, .22, .19], [0, 3.18, z]);
  box('trimmed parlor ceiling beam',[6.29,.22,.19],[-1.03,3.18,2.6]);
  box('short joist at stairwell',[.1,.12,5.49],[3.45,3.22,-1.73]);
  for (const x of [-3.1, -.9, 1.6]) box('ceiling joist', [.1, .12, 8.9], [x, 3.22, 0]);
  for (let i = 0; i < 5; i++) box('exposed wall lath', [.04, 1.25 + i * .08, .075], [4.17, 2.1, -2.8 + i * .17], wood);
  const rug = root.getObjectByName('rug'); rug.position.set(-.8, .012, .65); rug.material.color.setHex(0xc2b49c);
  root.traverse(o => { if (/dado rail/.test(o.name)) o.material = wood; });

  // Soot-black fireplace, recessed firebox, mantel and rusted grate.
  box('fireplace hearth', [1, .13, 2.8], [-3.65, .065, 0], brick);
  // Extrude the outline around the opening so each pier and the lintel share
  // a single front surface. Brick courses use the same UV scale across joints.
  const surroundProfile = new THREE.Shape();
  surroundProfile.moveTo(-1.3, .13);
  surroundProfile.lineTo(-.8, .13);
  surroundProfile.lineTo(-.8, 1.37);
  surroundProfile.lineTo(.8, 1.37);
  surroundProfile.lineTo(.8, .13);
  surroundProfile.lineTo(1.3, .13);
  surroundProfile.lineTo(1.3, 1.79);
  surroundProfile.lineTo(-1.3, 1.79);
  surroundProfile.closePath();
  const surround = new THREE.Mesh(new THREE.ExtrudeGeometry(surroundProfile, {depth:.78, bevelEnabled:false}), brick);
  surround.name = 'fireplace brick surround';
  surround.position.x = -4.06;
  surround.rotation.y = Math.PI / 2;
  surround.castShadow = surround.receiveShadow = true;
  root.add(solid(surround));
  box('firebox darkness', [.045, 1.1, 1.6], [-4.02, .7, 0], dark);
  box('chimney breast', [.5, 1.35, 2.4], [-3.91, 2.45, 0], plaster);
  // A thin fascia needs timber grain, not an entire floorboard photograph and
  // its high-contrast seams squeezed into 14 cm. Keep this close-up piece out of
  // the shared furniture batch so its sampling/shadow policy stays local.
  const mantelMap=textures.wood?.clone()??null;
  if(mantelMap){
    mantelMap.repeat.set(1,1);mantelMap.offset.set(0,0);mantelMap.rotation=0;
    mantelMap.minFilter=THREE.LinearMipmapLinearFilter;mantelMap.magFilter=THREE.LinearFilter;
    mantelMap.generateMipmaps=true;mantelMap.anisotropy=4;mantelMap.needsUpdate=true;
  }
  const mantelMaterial=wood.clone();mantelMaterial.name='Matte mantel timber';
  mantelMaterial.map=mantelMap;mantelMaterial.bumpMap=null;mantelMaterial.bumpScale=0;mantelMaterial.roughness=.9;
  const mantel=box('mantel', [.96,.14,2.85], [-3.63,1.86,0],mantelMaterial);
  const mantelPosition=mantel.geometry.attributes.position,mantelNormal=mantel.geometry.attributes.normal,mantelUV=mantel.geometry.attributes.uv;
  for(let i=0;i<mantelPosition.count;i++){
    const x=mantelPosition.getX(i),y=mantelPosition.getY(i),z=mantelPosition.getZ(i);
    const across=Math.abs(mantelNormal.getY(i))>.5?(x+.48)/.96:(y+.07)/.14;
    const along=Math.abs(mantelNormal.getZ(i))>.5?(x+.48)/.96*.28:(z+1.425)/2.85*.84;
    mantelUV.setXY(i,.33+across*.075,.08+along);
  }
  // Preserve its cast silhouette and direct warm light; excluding just this
  // small surface from resampled ceiling shadows prevents close-up acne bands.
  mantel.receiveShadow=false;mantel.userData.houseStatic=false;
  for (let i = 0; i < 7; i++) beam('rusted grate', [-3.43, .22, -.65 + i * .22], [-3.43, .56, -.65 + i * .22], .025, .025, brass);
  for (let i = 0; i < 3; i++) {
    const log = cylinder('cold charred log', .075, 1.1, [-3.74 + i * .08, .22 + i * .035, 0], dark); log.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) box('mantel book', [.23, .055, .42], [-3.55, 1.97 + .06 * i, -.78], i % 2 ? dark : fabric);
  cylinder('mantel candle', .04, .23, [-3.54, 2.05, .88], plaster);
  box('candle wax drip', [.025, .13, .022], [-3.497, 2.02, .885], paper);
  // The empty frame has fallen face down; its cracked backing stays on the mantel.
  const fallenFrame = box('fallen photograph backing', [.29, .025, .37], [-3.57, 1.95, .12], dark); fallenFrame.rotation.y = -.18;
  box('photograph frame edge', [.3, .035, .025], [-3.57, 1.956, -.07], brass);
  for (const z of [-.86, .84]) box('soot hearth edge', [.66, .018, .04], [-3.6, .143, z], dark);
  decal('fireplace smoke stain', [1.7, 1.1], [-3.648, 2.45, 0], [0, Math.PI / 2, 0]);

  // Cushioned silhouettes, seams, wooden feet and a low table rather than cubes.
  box('sofa base', [2.4, .22, 1.1], [-2.45, .3, 1.95]);
  round('sofa back', [2.4, .85, .25], [-2.45, .9, 2.36], fabric);
  for (const [i, x] of [-3.18, -2.45, -1.72].entries()) {
    const seat = sag(round('sofa cushion', [.68, .2, .8], [x, .52 - i * .005, 1.88], fabric, .075), .035 + i * .005);
    seat.rotation.y = (i - 1) * .012;
    tube('sofa cushion piping', [[x-.26,.535,1.51],[x+.26,.535,1.51],[x+.315,.535,1.57],[x+.315,.535,2.18],
      [x+.26,.535,2.245],[x-.26,.535,2.245],[x-.315,.535,2.18],[x-.315,.535,1.57]], .0045, piping, true);
    tube('compressed upholstery crease', [[x-.22,.596,1.57],[x-.16,.583,1.65],[x-.115,.571,1.69]], .0024);
  }
  for (const x of [-3.53, -1.37]) round('sofa arm', [.24, .58, 1.1], [x, .65, 1.95], fabric);
  for (const x of [-3.38, -1.52]) for (const z of [1.58, 2.32]) box('sofa foot', [.1, .2, .1], [x, .1, z]);
  round('discarded sofa cushion', [.48, .36, .18], [-3.12, .86, 2.15], fadedFabric).rotation.z = .24;
  for (const x of [-3.15,-2.45,-1.75]) tube('sofa back seam', [[x, .65, 2.224], [x, .93, 2.218], [x+.015,1.23,2.238]], .003);
  box('coffee tabletop', [1.5, .09, .9], [-1, .48, .25]);
  for (const x of [-1.62, -.38]) for (const z of [-.08, .58]) box('coffee table leg', [.075, .44, .075], [x, .22, z]);
  const bible = new THREE.Group();
  bible.name = 'Worn Holy Bible';
  bible.position.set(-1.18, .525, .27);
  bible.rotation.y = .18;
  root.add(bible);
  const binding = new THREE.MeshStandardMaterial({ color: 0x30251b, map: textures.fabric ?? null, roughness: .96 });
  const gilt = new THREE.MeshStandardMaterial({ color: 0xb49967, roughness: .75 });
  decorate(box('Bible page block', [.267,.029,.314], [.005,.021,0], paper, bible));
  for (const y of [.003,.04]) decorate(box('Bible cover board', [.29,.006,.34], [0,y,0], binding, bible));
  decorate(box('Bible bound spine', [.019,.044,.334], [-.134,.022,0], binding, bible));
  const bookTitle = new THREE.Mesh(new THREE.PlaneGeometry(.238,.235), new THREE.MeshStandardMaterial({
    map: options.labelTexture?.(['HOLY', 'BIBLE', '', ''], { background: '#201915', color: '#d9c38e', fontSize: .16, lineSpacing: .18 }) ?? null,
    color: 0xe7dbbf, roughness: .92,
  }));
  bookTitle.name = 'Holy Bible cover title';
  bookTitle.rotation.x = -Math.PI / 2;
  bookTitle.position.set(.008,.044,0);
  bible.add(decorate(bookTitle));
  decorate(box('Bible stamped cross upright', [.009,.001,.075], [.008,.045,.052], gilt, bible));
  decorate(box('Bible stamped cross arm', [.047,.001,.008], [.008,.045,.038], gilt, bible));
  const mug = cylinder('chipped mug', .065, .13, [-.65, .59, .15], enamel);
  mug.geometry.dispose(); mug.geometry = new THREE.CylinderGeometry(.065,.06,.13,24,1,true);
  const mugRim = new THREE.Mesh(new THREE.TorusGeometry(.061, .006, 6, 24), enamel); mugRim.rotation.x = Math.PI/2;
  mugRim.position.set(-.65,.659,.15); mugRim.name = 'mug hollow rim'; root.add(decorate(mugRim));
  cylinder('old tea in mug', .058, .003, [-.65,.625,.15], dark).castShadow = false;
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(.037,.009,6,14,Math.PI*1.65), enamel);
  mugHandle.name = 'mug handle'; mugHandle.position.set(-.566,.594,.15); mugHandle.rotation.z=-.2; root.add(decorate(mugHandle));
  sag(round('armchair seat', [1.05, .26, 1.05], [2.85, .5, -.2], fadedFabric), .048);
  round('armchair back', [1.3, 1.12, .28], [2.85, .94, .36], fadedFabric);
  for (const x of [2.31, 3.39]) round('armchair arm', [.22, .58, 1.3], [x, .65, -.2], fadedFabric);
  for (const x of [2.42, 3.28]) for (const z of [-.72, .3]) box('armchair foot', [.08, .25, .08], [x, .125, z]);
  tube('armchair seat piping', [[2.43,.52,-.65],[3.27,.52,-.65],[3.34,.52,-.58],[3.34,.52,.2],
    [3.27,.52,.26],[2.43,.52,.26],[2.36,.52,.2],[2.36,.52,-.58]], .0045, piping, true);
  for (const x of [2.58,3.12]) tube('armchair tired back seam', [[x,.56,.207],[x,.95,.204],[x+.015,1.4,.228]], .003);

  buildAttic({root,box,beam,wood,floor,wall,plaster,dark,brass,glassMap:textures.window,THREE});

  // Dirty sash window: moonlit tree silhouettes and rain on the glass.
  const glass = new THREE.MeshBasicMaterial({ color: 0x637b83, map: textures.window ?? null });
  world.windowPanel = box('moonlit window', [1.65, 1.65, .03], [-2.7, 2.1, -4.39], glass);
  world.windowPanel.userData.houseStatic = false;
  world.windowPanel.userData.windowGaze = true;
  function sash(name, size, at) {
    box(name, size, at).userData.windowGaze = true;
  }
  for (const x of [-3.58, -1.82]) sash('sash window frame', [.12, 1.85, .15], [x, 2.1, -4.3]);
  for (const y of [1.2, 3]) sash('sash window frame', [1.88, .09, .16], [-2.7, y, -4.3]);
  sash('sash window mullion', [.065, 1.8, .15], [-2.7, 2.1, -4.27]);
  dressParlorWindow(root, { fabric, wood, brass, decorate, box, tube });
  world.moon.position.set(-2.8, 2.4, -3.9); world.moon.intensity = 3.4;
  box('lamp side stand', [.48, .7, .45], [1.35, .35, -3.55]);
  cylinder('table lamp base', .15, .045, [1.35, .74, -3.55]);
  cylinder('table lamp stem', .025, .4, [1.35, .96, -3.55]);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.15, .26, .32, 24, 1, true), new THREE.MeshStandardMaterial({
    color: 0xb69d70, emissive: 0x6c421e, emissiveIntensity: .55, side: THREE.DoubleSide, roughness: 1,
  })); shade.name = 'frayed lamp shade'; shade.position.set(0, .06, 0); shade.raycast = noRaycast;
  const lampShade = new THREE.Group(); lampShade.name = 'unsteady shade hinge'; lampShade.position.set(1.35, 1.2, -3.55);
  lampShade.add(shade); root.add(lampShade);
  tube('lamp cloth lower binding', Array.from({length: 20}, (_,i) => [1.35+Math.cos(i/20*Math.PI*2)*.262,1.101,-3.55+Math.sin(i/20*Math.PI*2)*.262]), .004, piping, true);
  world.lamp.position.set(1.35, 1.18, -3.25); world.lamp.intensity = 8;
  world.ceilingLight.intensity = 7; world.ceilingLight.color.setHex(0xb9b393);

  // Domestic corridor with a real side doorway, not a hotel exit sign.
  box('narrow hall right wall', [.16, 3.3, 7.2], [.96, 1.65, 8.05], wall);
  box('narrow hall left near', [.16, 3.3, 1.85], [-.96, 1.65, 5.375], wall);
  box('narrow hall left far',[.16,3.3,3.8],[-.96,1.65,9.8],wall);
  box('kitchen opening lintel', [.16, .65, 1.6], [-.96, 2.975, 7.1], wall);
  for (const z of [6.3, 7.9]) box('kitchen doorway jamb', [.23, 2.7, .09], [-.96, 1.35, z]);
  box('kitchen doorway top', [.23, .1, 1.7], [-.96, 2.7, 7.1]);
  for (const z of [5.4, 8.8, 10.7]) box('hall ceiling joist', [1.8, .12, .13], [0, 3.2, z]);
  box('kitchen floor', [3.35, .15, 3.35], [-2.565, -.075, 7.375], floor);
  box('kitchen left wall', [.2, 3.3, 3.55], [-4.25, 1.65, 7.375], plaster);
  box('kitchen end wall',[3.35,3.3,.2],[-2.565,1.65,5.7],plaster);
  box('kitchen rear wall',[3.35,3.3,.2],[-2.565,1.65,9.05],plaster);
  box('kitchen ceiling', [3.35, .15, 3.55], [-2.565, 3.35, 7.375], dark);
  box('old kitchen cupboards', [.8, .85, 2.6], [-3.68, .425, 7.35], enamel);
  box('kitchen countertop', [.88, .08, 2.7], [-3.68, .89, 7.35], wood);
  const cupboard = new THREE.Group(); cupboard.name = 'loose cupboard hinge'; cupboard.position.set(-3.255,.44,8.595); root.add(cupboard);
  for (const z of [6.48, 7.35, 8.22]) {
    const moving = z === 8.22, parent = moving ? cupboard : root;
    const center = moving ? [0,0,-.375] : [-3.26,.44,z];
    box('cupboard inset', [.025,.63,.75], center, enamel, parent);
    box('cupboard pull', [.05,.025,.15], moving ? [.03,.25,-.38] : [-3.23,.69,z], brass, parent);
    box('cupboard inset panel', [.012,.49,.61], moving ? [.02,-.015,-.375] : [-3.239,.425,z], plaster, parent);
  }
  box('sink rim', [.65, .04, .72], [-3.65, .96, 7.23], enamel);
  box('empty sink basin', [.49, .045, .57], [-3.65, .982, 7.23], dark);
  beam('sink tap', [-3.96, .98, 7.3], [-3.96, 1.25, 7.3], .03, .03, brass);
  beam('sink tap spout', [-3.96, 1.25, 7.3], [-3.7, 1.25, 7.3], .03, .03, brass);
  box('rusted refrigerator', [.84, 1.8, .73], [-1.58, .9, 8.565], enamel);
  box('refrigerator gasket', [.78, 1.65, .03], [-1.58, .91, 8.18], dark);
  box('refrigerator front', [.75, 1.62, .035], [-1.58, .91, 8.15], enamel);
  box('refrigerator handle', [.035, .34, .08], [-1.85, 1.2, 8.1], brass);
  box('refrigerator freezer seam', [.74,.009,.008], [-1.58,1.43,8.127], dark).castShadow = false;
  const plate = cylinder('tipped kitchen plate', .17, .018, [-3.59,1.073,7.22], enamel);
  plate.rotation.z = .32; plate.rotation.x = -.13;
  cylinder('draining saucer', .115, .012, [-3.53,.945,6.48], paper).rotation.z = .035;
  box('abandoned dishcloth', [.36,.015,.28], [-3.42,.947,8.15], fadedFabric).rotation.y = .15;
  tube('dishcloth crumple', [[-3.57,.96,8.06],[-3.48,.975,8.1],[-3.42,.965,8.12],[-3.32,.96,8.2]], .009, fadedFabric);
  box('kitchen dirty window', [.035, 1.05, 1.1], [-4.13, 2.15, 7.35], textures.kitchenArtwork ? dark : glass);
  for (const z of [6.76, 7.94]) box('kitchen window frame', [.09, 1.2, .07], [-4.08, 2.15, z]);
  for (const y of [1.55, 2.75]) box('kitchen window frame', [.09, .07, 1.25], [-4.08, y, 7.35]);
  if (textures.kitchenArtwork) {
    const art = textures.kitchenArtwork;
    const aspect = art.image.width / art.image.height;
    const height = Math.min(1.1, 1.09 / aspect);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height),
      new THREE.MeshStandardMaterial({map:art, emissiveMap:art, emissive:0xffffff, emissiveIntensity:.20, roughness:.96}));
    print.name = 'The Scream in the kitchen window frame';
    print.rotation.y = Math.PI / 2;
    print.position.set(-4.105, 2.15, 7.35);
    root.add(decorate(print));
  }
  const kitchenLight = new THREE.PointLight(0x718b91, 2.8, 5, 2); kitchenLight.position.set(-2.65, 2.35, 7.3); scene.add(kitchenLight);
  world.kitchenLight = kitchenLight;
  world.hallLight.color.setHex(0x91a396); world.hallLight.intensity = 2.5;
  const frontHinge=new THREE.Group();frontHinge.name='Front door hinge';frontHinge.position.set(-.725,0,11.55);
  frontHinge.userData.interaction='front-door';root.add(frontHinge);
  world.frontHinge=frontHinge;
  world.frontDoor=box('house front door',[1.45,2.75,.14],[.725,1.375,0],wood,frontHinge);
  for(const y of [.7,1.8])box('front door panel',[1.15,.8,.04],[.725,y,-.1],dark,frontHinge);
  box('front door handle',[.13,.03,.06],[.225,1.06,-.12],brass,frontHinge);
  frontHinge.traverse(object=>{object.userData.houseStatic=false;});
  world.frontTransom=box('front door transom',[1.4,.3,.04],[0,2.97,11.48],
    new THREE.MeshPhysicalMaterial({color:0x879b9d,transparent:true,opacity:.18,roughness:.5,transmission:.08,depthWrite:false}));
  for(const x of [-1.04,1.04])box('front doorway side wall',[.55,3.3,.18],[x,1.65,11.7],plaster);
  box('front doorway lintel',[1.55,.14,.2],[0,3.23,11.7],wood);
  box('rain-darkened porch floor',[3.3,.15,3.7],[0,-.075,13.45],floor);
  box('porch roof',[3.3,.12,3.7],[0,3.2,13.45],dark);
  for(const x of [-1.35,1.35])box('porch timber post',[.12,3.2,.12],[x,1.6,14.65],wood);
  box('night beyond the porch',[6,5,.1],[0,2,16],dark);
  const porchLamp=new THREE.PointLight(0xbccad1,3.1,5,2);
  porchLamp.position.set(.62,2.35,12.15);scene.add(porchLamp);
  box('porch lantern glass',[.1,.18,.1],[.92,2.36,12.2],new THREE.MeshBasicMaterial({color:0xb3a88c}));
  // Moonlit trunks on the other side of the porch establish a real exterior.
  const bark=new THREE.MeshStandardMaterial({color:0x384743,roughness:1});
  for(const [i,x] of [-2.8,-2.02,-1.5,-.66,.38,1.19,2.05,2.95].entries()){
    const z=15.36+(i%3)*.19;
    beam('wet tree trunk',[x,-.15,z],[x+.11,3.1,z+.18],.13,.11,bark);
    beam('bare moonlit branch',[x,1.25+i%2*.6,z],[x+(i%2?.71:-.64),2.72,z+.08],.055,.06,bark);
  }
  world.lighting = { lamp: 8, ceiling: 7, hall: 2.5 };

  // Layers hug existing walls and furniture so every established walking route stays clear.
  for (const x of [-4.15,4.15]) {
    box('scuffed skirting board', [.07,.14,8.6], [x,.08,0]);
    decal('damp wall tide mark', [7.8,.85], [x < 0 ? -4.187 : 4.187,.44,.05], [0,x < 0 ? Math.PI/2 : -Math.PI/2,0]);
  }
  box('scuffed front skirting', [8.25,.14,.06], [0,.08,-4.4]);
  decal('rain stain beneath window', [1.9,1.14], [-2.7,.57,-4.393], [0,0,0]);
  decal('kitchen damp plaster', [2.75,.96], [-4.137,.5,7.35], [0,Math.PI/2,0]);
  decal('hall damp plaster', [3.4,.82], [.869,.42,9.4], [0,-Math.PI/2,0]);
  // A hanging print shifts by less than two degrees. Its worn frame supplies scale at eye level.
  const picture = new THREE.Group(); picture.name = 'crooked landscape picture'; picture.position.set(4.105,2.76,-1.45); root.add(picture);
  box('picture wooden backing', [.038,.73,.59], [0,-.39,0], dark,picture);
  for (const y of [-.76,-.02]) box('picture frame rail', [.07,.045,.67], [-.013,y,0],wood,picture);
  for (const z of [-.31,.31]) box('picture frame rail', [.07,.75,.045], [-.013,-.39,z],wood,picture);
  const pictureImage = new THREE.Mesh(new THREE.PlaneGeometry(.56,.67),new THREE.MeshStandardMaterial({
    map: textures.landscape ?? null, color: 0xc0b8a0, roughness: .86, metalness: .04,
  }));
  pictureImage.name = 'faded landscape behind glass'; pictureImage.rotation.y=-Math.PI/2; pictureImage.position.set(-.025,-.39,0);
  pictureImage.raycast=noRaycast; picture.add(pictureImage);
  beam('picture hanging cord', [4.09,2.75,-1.45], [4.09,2.55,-1.68], .003,.003,piping).castShadow=false;
  beam('picture hanging cord', [4.09,2.75,-1.45], [4.09,2.55,-1.22], .003,.003,piping).castShadow=false;
  // Cobwebs use a single sparse line batch, with no opaque cards in the beam of the torch.
  const webPositions = [];
  for (const [cornerX, cornerY, cornerZ, direction] of [[-4.13,3.12,-4.32,1],[4.13,3.12,3.9,-1],[-4.1,3.15,8.89,1]]) {
    const ends = [];
    for (let i=0;i<7;i++) {
      const angle=i/6*Math.PI/2, x=cornerX+direction*Math.cos(angle)*.45, y=cornerY-Math.sin(angle)*.43;
      ends.push([x,y,cornerZ]); webPositions.push(cornerX,cornerY,cornerZ,x,y,cornerZ);
    }
    for (const fraction of [.3,.6,.88]) for (let i=1;i<ends.length;i++) {
      for (const endpoint of [ends[i-1],ends[i]]) webPositions.push(cornerX+(endpoint[0]-cornerX)*fraction,cornerY+(endpoint[1]-cornerY)*fraction,cornerZ+.004);
    }
  }
  const webGeometry = new THREE.BufferGeometry(); webGeometry.setAttribute('position',new THREE.Float32BufferAttribute(webPositions,3));
  const cobweb = new THREE.LineSegments(webGeometry,new THREE.LineBasicMaterial({color:0xb6b7a3,transparent:true,opacity:.14,depthWrite:false}));
  cobweb.name='abandoned corner cobwebs'; cobweb.raycast=noRaycast; root.add(cobweb);
  const rain = new THREE.Group(); rain.name='rain on cold windows'; root.add(rain);
  const rainMaterial = new THREE.MeshBasicMaterial({map:textures.rain??null,color:0xc1d3d2,transparent:true,
    opacity:textures.rain?.isTexture ? .26 : 0,depthWrite:false,side:THREE.DoubleSide});
  for (const [size,at,rotation] of [[[1.6,1.6],[-2.7,2.1,-4.366],0],[[1.05,1.04],[-4.105,2.15,7.35],Math.PI/2]]) {
    const streaks = new THREE.Mesh(new THREE.PlaneGeometry(...size),rainMaterial); streaks.position.set(...at); streaks.rotation.y=rotation;
    streaks.name='sliding condensation'; streaks.raycast=noRaycast; rain.add(streaks);
  }
  for (const name of ['worn floorboards','hall floor','kitchen floor','rug']) {
    const surface=root.getObjectByName(name); surface.userData.walkSurface=true; surface.userData.houseStatic=false;
    surface.raycast=THREE.Mesh.prototype.raycast;
  }
  const fineDetails = new Set(['exposed wall lath','rusted grate','cold charred log','mantel book','mantel candle',
    'candle wax drip','fallen photograph backing','photograph frame edge','soot hearth edge','discarded sofa cushion',
    'chipped mug','old tea in mug',
    'table lamp base','table lamp stem','cupboard pull','refrigerator handle','refrigerator freezer seam',
    'tipped kitchen plate','draining saucer','abandoned dishcloth','picture hanging cord','front door handle']);
  root.traverse(mesh => { if (mesh.isMesh && fineDetails.has(mesh.name)) decorate(mesh); });
  picture.traverse(mesh => { if (mesh.isMesh) decorate(mesh); });
  // Merge repeated fixed details by material. Original CRT, note, door and floor
  // meshes remain independent and keep exactly their original ray targets.
  const batches = new Map(); root.updateMatrixWorld(true);
  for (const mesh of [...root.children]) {
    if (!mesh.isMesh || !mesh.userData.houseStatic || mesh.material.transparent) continue;
    const key=`${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.userData.pickThrough===true}:${mesh.userData.windowGaze===true}`;
    if (!batches.has(key)) batches.set(key,[]); batches.get(key).push(mesh);
  }
  for (const meshes of batches.values()) {
    if (meshes.length<2) continue;
    const geometries=meshes.map(mesh=>{
      const geometry=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = new THREE.BufferGeometry();
    for (const attribute of ['position','normal','uv']) {
      const size=geometries[0].getAttribute(attribute).itemSize;
      const data=new Float32Array(geometries.reduce((sum,g)=>sum+g.getAttribute(attribute).array.length,0));
      let cursor=0; for (const g of geometries) { data.set(g.getAttribute(attribute).array,cursor); cursor+=g.getAttribute(attribute).array.length; }
      geometry.setAttribute(attribute,new THREE.BufferAttribute(data,size));
    }
    geometry.computeBoundingSphere();
    const merged=new THREE.Mesh(geometry,meshes[0].material); merged.name=meshes[0].userData.pickThrough ? 'house detail batch' : 'house solid batch';
    merged.userData.windowGaze = meshes[0].userData.windowGaze === true;
    merged.userData.parts=meshes.map(mesh=>mesh.name); merged.castShadow=meshes[0].castShadow; merged.receiveShadow=meshes[0].receiveShadow;
    merged.userData.pickThrough=meshes[0].userData.pickThrough===true; merged.raycast=meshes[0].raycast; root.add(merged);
    for (let i=0;i<meshes.length;i++) { root.remove(meshes[i]); meshes[i].geometry.dispose(); geometries[i].dispose(); }
  }
  const hearth=createHearth(scene,root),courtyard=createCourtyard(root,world.windowPanel,{textures});
  world.hearth=hearth;world.courtyard=courtyard;
  world.atmosphere = {lampShade,picture,cupboard,rain,cobweb,hearth,courtyard};
  let atmosphereTime=0,lastTime=null;
  world.updateAtmosphere = (time,{tension=0,disturbance=0,reducedMotion=false,paused=false,weather=null}={}) => {
    const safeTime=Number.isFinite(time)?time:0;
    const dt=lastTime===null?0:Math.min(.1,Math.max(0,safeTime-lastTime)); lastTime=safeTime;
    if (paused) return;
    if (!reducedMotion) atmosphereTime+=dt;
    const stress=THREE.MathUtils.clamp(Number.isFinite(tension)?tension:0,0,1);
    const jolt=THREE.MathUtils.clamp(Number.isFinite(disturbance)?disturbance:0,0,1);
    const t=atmosphereTime, motion=reducedMotion?0:1;
    lampShade.rotation.z=motion*(Math.sin(t*1.63)*(.009+stress*.012)+Math.sin(t*6.8)*jolt*.046);
    lampShade.rotation.x=motion*Math.sin(t*1.21+.4)*(.006+jolt*.024);
    picture.rotation.x=.032+motion*(Math.sin(t*.72)*stress*.006+Math.sin(t*3.1)*jolt*.022);
    cupboard.rotation.y=-.018-motion*(Math.max(0,Math.sin(t*.58-1.1))*(.025+stress*.035)+jolt*.055);
    world.dust.position.y=motion*Math.sin(t*.19)*.025;
    world.dust.material.opacity=.2+stress*.07;
    if (textures.rain) textures.rain.offset.y=motion*t*.021%1;
    hearth.update(t,{reducedMotion});
    const rumble=courtyard.update(t,{dt,weather,reducedMotion});
    world.moon.intensity=3.4+5.8*courtyard.storm.level;
    return rumble;
  };
  world.resetAtmosphere=()=>{
    atmosphereTime=0;lastTime=null;
    world.updateAtmosphere(0,{reducedMotion:true});lastTime=null;
  };
  world.updateAtmosphere(0);
  return world;
}
