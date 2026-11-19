import * as THREE from './vendor/three.module.js';

const centerX = -2.7;
const rodY = 3.13;
const rodZ = -4.16;

// Keep each panel on the plaster beside the sash. The cloth gathers up at
// the wall hook, fans out below it, and hangs a little lower on the loose side.
function clothPoint(side, u, drop) {
  const across = side < 0 ? 1 - u : u;
  const tie = side < 0 ? .56 : .6;
  const aboveTie = drop <= tie;
  const span = aboveTie ? (tie - drop) / tie : (drop - tie) / (1 - tie);
  const ease = THREE.MathUtils.smoothstep(span, 0, 1);
  const width = .15 + ease * (aboveTie ? .34 : .28);
  const outerEdge = 1.33 + .025 * Math.sin(Math.PI * drop);
  const x = centerX + side * (outerEdge - width * (1 - across));
  const pleat = across * 4.25 + .19 * Math.sin(across * 5 + side) * Math.sin(drop * Math.PI);
  const ridge = Math.cos(pleat * Math.PI * 2);
  const y = rodY - .045 - drop * (2.68 + (side > 0 ? .07 : 0))
    - .049 * (1 - across) * Math.sin(Math.PI * drop)
    - .022 * (.5 + .5 * ridge) * Math.pow(drop, 4);
  const z = rodZ + .025 + (.022 + .041 * ease) * ridge
    + .052 * Math.sin(Math.PI * span) - .038 * across;
  return [x, y, z];
}

function clothGeometry(side, from, to, rows, offset = 0) {
  const geometry = new THREE.PlaneGeometry(1, 1, 32, rows);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const drop = THREE.MathUtils.lerp(from, to, 1 - uv.getY(i));
    const [x, y, z] = clothPoint(side, uv.getX(i), drop);
    positions.setXYZ(i, x, y, z + offset);
    uv.setY(i, 1 - drop);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function dressParlorWindow(root, { fabric, wood, brass, decorate, box, tube }) {
  const drape = fabric.clone();
  drape.name = 'Faded oxblood parlor drapery';
  drape.color.setHex(0xba7772);
  drape.side = THREE.DoubleSide;
  const braid = fabric.clone();
  braid.name = 'Old gold woven curtain braid';
  braid.color.setHex(0xcfab72);
  braid.side = THREE.DoubleSide;

  // These small pieces share the room's existing static material batches.
  function detail(name, geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    root.add(decorate(mesh));
    return mesh;
  }

  const rod = detail('Tarnished brass curtain pole', new THREE.CylinderGeometry(.017, .017, 2.76, 12), brass);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(centerX, rodY, rodZ);

  for (const side of [-1, 1]) {
    detail('Gathered parlor curtain', clothGeometry(side, 0, 1, 22), drape);
    const tie = side < 0 ? .56 : .6;
    detail('Gathered curtain tie', clothGeometry(side, tie - .009, tie + .009, 2, .005), braid);
    detail('Worn curtain hem braid', clothGeometry(side, .964, .97, 1, .003), braid);

    const [x, y, z] = clothPoint(side, side < 0 ? .4 : .6, tie);
    tube('Loop of window tie cord', [
      [x, y, z + .025], [x + side * .025, y - .19, z + .055],
      [x + side * .072, y - .24, z + .035], [x + side * .09, y + .018, z - .075],
    ], .006, braid);
    const cap = detail('Curtain pole finial', new THREE.SphereGeometry(.052, 12, 8), brass);
    cap.position.set(centerX + side * 1.4, rodY, rodZ);
    cap.scale.set(1.36, .8, .8);
    for (let ring = 0; ring < 5; ring++) {
      const [ringX] = clothPoint(side, ring / 5 + .1, 0);
      const eye = detail('Curtain suspension ring', new THREE.TorusGeometry(.029, .006, 6, 12), brass);
      eye.rotation.y = Math.PI / 2;
      eye.position.set(ringX, rodY - .012, rodZ);
    }
    const bracket = box('Curtain pole wall bracket', [.038, .044, .28], [centerX + side * 1.31, rodY - .015, -4.3], brass);
    decorate(bracket);
  }

  // A projecting sill catches the lamp and outlines the bottom of the recess.
  box('Stepped sash sill', [2.09, .067, .285], [centerX, 1.142, -4.265], wood);
  box('Sill apron molding', [1.96, .085, .1], [centerX, 1.074, -4.36], wood);
}
