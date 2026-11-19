import * as THREE from './vendor/three.module.js';
import { TV_SCREEN, TV_BUTTON } from './core.mjs?v=tv1';

export function createWorld(scene, { textures = {}, labelTexture, screenTexture } = {}) {
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: 0xc0b58d, map: textures.wallpaper, roughness: .98 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9c8063, map: textures.wood, roughness: .79 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x28241b, roughness: .8 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x83755a, map: textures.fabric, roughness: 1 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xb6ac8b, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9b7e40, roughness: .48, metalness: .65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x192b35, roughness: .28, metalness: .25 }),
    red: new THREE.MeshStandardMaterial({ color: 0x9e221a, emissive: 0x450a05, emissiveIntensity: .4, roughness: .34 }),
  };
  const root = new THREE.Group(); root.name = 'Room 312'; scene.add(root);
  function box(name, size, at, material = materials.wood, parent = root) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name; mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function cylinder(name, radius, height, at, material, parent = root) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material);
    mesh.name = name; mesh.position.set(...at); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function label(lines, size, at, rotation = 0, opts = {}, parent = root) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({
      map: labelTexture?.(lines, opts), color: labelTexture ? 0xffffff : 0xaea07f,
      side: THREE.DoubleSide,
    }));
    mesh.position.set(...at); mesh.rotation.y = rotation; parent.add(mesh); return mesh;
  }
  function tag(mesh, id) { mesh.userData.interaction = id; return mesh; }
  const wall = (name, size, at) => box(name, size, at, materials.wall);
  box('worn floorboards', [8.65, .15, 9.2], [0, -.075, 0], materials.wood);
  wall('front wall', [8.65, 3.3, .2], [0, 1.65, -4.55]);
  wall('left wall', [.2, 3.3, 9.2], [-4.3, 1.65, 0]);
  wall('right wall', [.2, 3.3, 9.2], [4.3, 1.65, 0]);
  wall('door wall left', [3.52, 3.3, .2], [-2.54, 1.65, 4.5]);
  wall('door wall right', [3.52, 3.3, .2], [2.54, 1.65, 4.5]);
  wall('door lintel', [1.56, .65, .2], [0, 2.975, 4.5]);
  box('ceiling', [8.65, .15, 9.2], [0, 3.35, 0], materials.dark);
  for (const z of [-4.38, 4.38]) {
    if (z < 0) box('wainscot', [8.4, .95, .08], [0, .5, z]);
    else for (const x of [-2.54, 2.54]) box('wainscot', [3.42, .95, .08], [x, .5, z]);
  }
  for (const x of [-4.16, 4.16]) {
    box('wainscot', [.08, .95, 8.9], [x, .5, 0]);
    box('dado rail', [.11, .06, 9], [x, 1, 0], materials.brass);
    box('crown moulding', [.16, .12, 9], [x, 3.15, 0]);
  }
  box('front dado rail', [8.4, .06, .11], [0, 1, -4.32], materials.brass);
  box('rug', [3.9, .018, 3.3], [.35, .012, .35], new THREE.MeshStandardMaterial({ color: 0xab9976, map: textures.rug, roughness: 1 }));

  // A low CRT cabinet and a touch target aligned with the button drawn on its glass.
  box('television cabinet', [2.6, .64, 1.05], [-.5, .43, -3.55]);
  for (const x of [-1.62, .62]) for (const z of [-3.95, -3.13]) box('cabinet foot', [.09, .16, .09], [x, .08, z]);
  for (const x of [-1.1, .05]) {
    box('cabinet door', [1.04, .45, .025], [x, .44, -3.012], materials.dark);
    cylinder('cabinet handle', .025, .13, [x + .36, .47, -2.98], materials.brass).rotation.x = Math.PI / 2;
  }
  box('CRT casing', [1.85, 1.38, .8], [-.5, 1.44, -3.63], materials.dark);
  box('CRT bezel', [1.69, 1.23, .06], [-.5, 1.45, -3.19], new THREE.MeshStandardMaterial({ color: 0x403a2c, roughness: .65 }));
  const screenGeometry = new THREE.PlaneGeometry(TV_SCREEN.width, TV_SCREEN.height, 22, 18);
  const vertices = screenGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i);
    vertices.setZ(i, .045 * (1 - (x / .8) ** 2 - (y / .65) ** 2));
  }
  screenGeometry.computeVertexNormals();
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, color: 0xc5ddc3 });
  const screen = new THREE.Mesh(screenGeometry, screenMaterial); screen.position.set(TV_SCREEN.x, TV_SCREEN.y, TV_SCREEN.z);
  screen.name = 'CRT screen'; tag(screen, 'tv'); root.add(screen);
  for (const y of [1.18, 1.73]) {
    const knob = cylinder('CRT knob', .075, .08, [.28, y, -3.1], materials.brass); knob.rotation.x = Math.PI / 2;
  }
  for (let y = 1.27; y < 1.6; y += .04) box('speaker grille', [.2, .012, .02], [.28, y, -3.11], materials.dark);
  for (const side of [-1, 1]) {
    const antenna = cylinder('antenna', .008, .76, [-.5 + side * .16, 2.43, -3.65], materials.brass);
    antenna.rotation.z = side * -.45;
  }
  const button = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  button.name = 'TV screen button hit area';
  button.position.set(TV_SCREEN.x + (TV_BUTTON.x / TV_BUTTON.canvasWidth - .5) * TV_SCREEN.width,
    TV_SCREEN.y + (.5 - TV_BUTTON.y / TV_BUTTON.canvasHeight) * TV_SCREEN.height, TV_SCREEN.z + .075);
  button.scale.set(TV_BUTTON.hitRadius / TV_BUTTON.canvasWidth * TV_SCREEN.width,
    TV_BUTTON.hitRadius / TV_BUTTON.canvasHeight * TV_SCREEN.height, 1);
  tag(button, 'button'); root.add(button);
  const note = label(['TV TIP', 'Watch the TV.', 'Follow an order', 'only if it starts with', '“Keeper says…”'],
    [.34, .55], [-1.60, .752, -3.33], 0, { background: '#e1d7b7', color: '#1e1a15', font: 'sans-serif', fontWeight: 'bold', fontSize: .11, lineSpacing: .166 });
  note.name = 'Keeper’s note on the cabinet';
  note.rotation.x = -Math.PI / 2; tag(note, 'note');

  // Bed and an armchair give the room scale and create real walking obstacles.
  box('bed frame', [2.1, .36, 3.2], [-2.75, .24, -.05]);
  box('bed headboard', [2.14, 1.1, .13], [-2.75, .68, -1.6]);
  box('mattress', [2, .25, 3.08], [-2.75, .54, -.04], materials.cream);
  box('blanket', [2.025, .07, 2.12], [-2.75, .7, .43], materials.fabric);
  const pillow = box('pillow', [1.3, .13, .58], [-2.75, .75, -1.08], materials.cream); pillow.rotation.y = .04;
  for (let i = 0; i < 5; i++) box('blanket fold', [2.035, .012, .018], [-2.75, .744, -.42 + i * .4], materials.dark);
  box('chair seat', [1.05, .3, 1.2], [3.05, .48, .15], materials.fabric);
  box('chair back', [1.12, 1.1, .25], [3.05, 1, -.34], materials.fabric);
  for (const x of [2.52, 3.58]) box('chair arm', [.2, .63, 1.3], [x, .65, .15], materials.fabric);
  for (const x of [2.7, 3.4]) for (const z of [-.26, .55]) box('chair foot', [.09, .3, .09], [x, .15, z]);
  cylinder('side table', .46, .09, [3.1, .7, 2.1], materials.wood);
  cylinder('table leg', .07, .65, [3.1, .33, 2.1], materials.wood);
  cylinder('table base', .31, .07, [3.1, .05, 2.1], materials.dark);
  cylinder('glass', .055, .13, [3.23, .81, 2.1], materials.glass);

  // A lamp, boarded window and long shadows carry the horror before the reveal.
  cylinder('lamp base', .2, .06, [2.94, .04, -2.5], materials.brass);
  cylinder('lamp stem', .024, 1.85, [2.94, .98, -2.5], materials.brass);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.35, .43, 32, 1, true), new THREE.MeshStandardMaterial({
    color: 0xc5ab70, emissive: 0x8d5b25, emissiveIntensity: .5, roughness: .85, side: THREE.DoubleSide,
  }));
  shade.position.set(2.94, 1.91, -2.5); root.add(shade);
  const lamp = new THREE.PointLight(0xffc17a, 11, 8, 2); lamp.position.set(2.94, 1.75, -2.5); scene.add(lamp);
  const windowPanel = box('window glass', [.025, 1.45, 2], [-4.17, 2.03, .4], materials.glass);
  for (const z of [-.65, 1.45]) box('window frame', [.13, 1.65, .1], [-4.1, 2.03, z]);
  for (const y of [1.22, 2.85]) box('window frame', [.13, .1, 2.2], [-4.1, y, .4]);
  box('window divider', [.12, 1.55, .065], [-4.09, 2.03, .4]);
  for (const z of [-.85, 1.65]) {
    const curtain = box('heavy curtain', [.22, 2.12, .43], [-3.96, 1.85, z], materials.fabric);
    curtain.rotation.y = z < 0 ? -.12 : .12;
  }
  const moon = new THREE.PointLight(0x7c9baf, 2.3, 9, 2); moon.position.set(-3.6, 2.5, .4); scene.add(moon);
  const tvLight = new THREE.PointLight(0x9bc7b3, .8, 4, 2); tvLight.position.set(-.6, 1.6, -2.85); scene.add(tvLight);
  const ceilingLight = new THREE.SpotLight(0xffd6a1, 20, 11, .9, .7, 1.4);
  ceilingLight.position.set(.7, 3.1, .2); ceilingLight.target.position.set(.2, 0, -.5);
  ceilingLight.castShadow = true; ceilingLight.shadow.mapSize.set(1024, 1024); ceilingLight.shadow.bias = -.001;
  scene.add(ceilingLight, ceilingLight.target);

  const hinge = new THREE.Group(); hinge.position.set(-.76, 0, 4.45); root.add(hinge);
  tag(box('door', [1.52, 2.65, .11], [.76, 1.325, 0], materials.wood, hinge), 'door');
  for (const y of [.65, 1.63]) tag(box('raised door panel', [1.22, .83, .025], [.76, y, -.071], materials.dark, hinge), 'door');
  tag(label(['312'], [.4, .2], [.76, 2.25, -.082], Math.PI, { background: '#736347', color: '#e4d5ae' }, hinge), 'door');
  tag(box('door handle', [.17, .035, .055], [1.3, 1.04, -.13], materials.brass, hinge), 'door');
  for (const x of [-.86, .86]) box('door frame', [.12, 2.8, .2], [x, 1.4, 4.43]);
  box('door frame top', [1.85, .1, .2], [0, 2.78, 4.43]);
  box('hall floor', [2.65, .15, 7.2], [0, -.075, 8.05], materials.wood);
  for (const x of [-1.34, 1.34]) {
    box('hall wall', [.16, 3.3, 7.4], [x, 1.65, 8], materials.wall);
    box('hall wainscot', [.05, .95, 7.4], [x * .94, .5, 8]);
  }
  box('hall ceiling', [2.7, .15, 7.4], [0, 3.35, 8], materials.dark);
  box('hall end', [2.7, 3.3, .16], [0, 1.65, 11.7], materials.dark);
  label(['EXIT'], [.65, .26], [0, 2.52, 11.57], Math.PI, { background: '#16332c', color: '#9bbaa4', font: 'monospace' });
  const hallLight = new THREE.PointLight(0xa2b5aa, 4.2, 10, 2); hallLight.position.set(0, 2.65, 8.5); scene.add(hallLight);
  for (const z of [6.4, 9.5]) box('hall light fitting', [.45, .06, .18], [0, 3.22, z], materials.cream);
  const dustPositions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) { dustPositions[i * 3] = Math.sin(i * 71) * 3.9; dustPositions[i * 3 + 1] = .4 + (i % 29) / 11; dustPositions[i * 3 + 2] = Math.cos(i * 41) * 4; }
  const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xc7b792, size: .014, transparent: true, opacity: .27, depthWrite: false }));
  scene.add(dust);
  return { root, screen, screenMaterial, button, hinge, lamp, ceilingLight, hallLight, moon, tvLight, dust,
    tvPoint: new THREE.Vector3(-.63, 1.47, -3.14), windowPanel };
}
