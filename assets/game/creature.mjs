import * as THREE from './vendor/three.module.js';

// This model is a replaceable blockout; future reference images belong here.
export function createCreature() {
  const root = new THREE.Group(); root.name = 'temporary horror creature'; root.visible = false;
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a8475, roughness: .84 });
  const shadow = new THREE.MeshStandardMaterial({ color: 0x111211, roughness: 1 });
  const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x010202 });
  const teeth = new THREE.MeshStandardMaterial({ color: 0xa6a18b, roughness: .7 });
  const eyes = new THREE.MeshBasicMaterial({ color: 0xabb9a8 });
  function sphere(name, at, scale, material = skin, parent = root) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), material);
    mesh.name = name; mesh.position.set(...at); mesh.scale.set(...scale); mesh.castShadow = true;
    parent.add(mesh); return mesh;
  }
  function bone(a, b, radius, material = skin, parent = root) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .8, radius, start.distanceTo(end), 12), material);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  const chest = sphere('breathing chest', [0, 1.1, 0], [.25, .45, .16], shadow);
  bone([0, 1.4, 0], [0, 1.71, .025], .075);
  const head = new THREE.Group(); head.position.set(0, 1.85, .02); head.rotation.z = .2; root.add(head);
  sphere('long face', [0, 0, 0], [.166, .257, .15], skin, head);
  for (const side of [-1, 1]) {
    sphere('eye socket', [side * .075, .045, .128], [.052, .044, .029], voidMaterial, head);
    sphere('eye glint', [side * .075, .045, .155], [.009, .012, .005], eyes, head);
    sphere('hollow cheek', [side * .105, -.055, .09], [.055, .072, .027], shadow, head);
  }
  sphere('open mouth', [0, -.115, .132], [.052, .09, .023], voidMaterial, head);
  sphere('nose bridge', [0, -.005, .145], [.022, .047, .03], skin, head);
  for (let i = -2; i <= 2; i++) for (const side of [-1, 1]) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(.006, .025, 5), teeth);
    tooth.position.set(i * .015, -.115 + side * .062, .155); tooth.rotation.z = side > 0 ? Math.PI : 0; head.add(tooth);
  }
  const hands = [];
  for (const side of [-1, 1]) {
    bone([side * .1, .78, 0], [side * .19, .07, -.02], .07, shadow);
    sphere('foot', [side * .19, .04, .06], [.075, .05, .18], shadow);
    bone([side * .23, 1.4, 0], [side * .48, 1.05, .08], .057);
    bone([side * .48, 1.05, .08], [side * .34, .94, .57], .043);
    const hand = new THREE.Group(); hand.position.set(side * .34, .94, .57); root.add(hand); hands.push(hand);
    sphere('hand', [0, 0, 0], [.068, .10, .035], skin, hand);
    for (let i = 0; i < 4; i++) {
      const x = -.05 + i * .032;
      bone([x, .04, .005], [x * 1.3, .11, .12 + .02 * Math.sin(i)], .012, skin, hand);
      bone([x * 1.3, .11, .12], [x * 1.2, .065, .2], .009, skin, hand);
    }
    bone([side * .06, -.015, 0], [side * .12, -.005, .10], .018, skin, hand);
  }
  function breathe(time, reach = 0) {
    const breath = Math.sin(time * 2.4);
    chest.scale.set(.25 + breath * .007, .45 + breath * .012, .16 + breath * .008);
    head.position.y = 1.85 + breath * .008;
    head.rotation.z = .2 + Math.sin(time * .7) * .035;
    hands.forEach((hand, i) => { hand.rotation.x = -.12 - reach * .35; hand.rotation.z = (i ? -1 : 1) * reach * .25; });
  }
  return { root, breathe, head };
}
