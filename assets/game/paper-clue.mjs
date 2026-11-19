import * as THREE from './vendor/three.module.js';

export const CORNER_CLUE = 'Above the last stair, someone is watching. Look up. Touch the face to send it away.';

// The clue sits on the user's folded paper, above the old printed ink. It is a
// real lit surface and an independent hit target; the table keeps its hide tag.
export function createPaperClue(world, { labelTexture } = {}) {
  const map = labelTexture?.(['ABOVE THE LAST STAIR,', 'SOMEONE IS WATCHING.', '', 'TOUCH THE FACE.', 'MAKE IT LEAVE.'],
    { background: '#d2c7a6', color: '#29271f', font: 'serif', fontSize: .086, lineSpacing: .15 });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(.42, .003, .30),
    new THREE.MeshStandardMaterial({color:0xc5baa0,roughness:1}));
  edge.name = 'Clue paper resting on the table'; edge.position.set(-.74,.5268,.49);
  edge.raycast=()=>{};world.root.add(edge);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(.42, .30),
    new THREE.MeshStandardMaterial({ map, color: 0xe0d6b7, roughness: 1, side: THREE.DoubleSide }));
  paper.name = 'handwritten stair-corner clue';
  paper.position.set(-.74, .529, .49); paper.rotation.set(-Math.PI / 2, 0, 0);
  paper.userData.interaction = 'corner-note';
  paper.receiveShadow = true; world.root.add(paper);
  return paper;
}
