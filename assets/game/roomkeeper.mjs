import * as THREE from './vendor/three.module.js';

export const ROOMKEEPER_IMAGE = { width: .8, height: 1.2, faceU: [.18,.82], faceV: [.045,.565], anchorV: .305 };

// A photographic alpha surface in the 3D room, with a clothed 3D silhouette.
// The image supplies skin, hair and hands; this is not a fully rigged scan.
export function createCreature({ texture = null, reveal = false } = {}) {
  const root = new THREE.Group(); root.name = 'The Roomkeeper'; root.visible = false;
  const cloth = new THREE.MeshStandardMaterial({ color: 0x151b18, roughness: .97 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x101411, roughness: .9 });
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(.18,.42,8,16),cloth);
  chest.position.set(0,1.04,-.06);chest.scale.set(1,.95,.7);chest.castShadow=true;root.add(chest);
  for(const side of [-1,1]) {
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.53,6,12),cloth);
    leg.position.set(side*.115,.38,-.04);leg.rotation.z=side*-.055;leg.castShadow=true;root.add(leg);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.11,.075,.23),shoe);
    foot.position.set(side*.13,.055,.035);root.add(foot);
  }
  const head = new THREE.Group(); head.name='Roomkeeper photographic rig';head.position.set(0,1.84,.045);root.add(head);
  const { width,height,anchorV }=ROOMKEEPER_IMAGE;
  const geometry=new THREE.PlaneGeometry(width,height,32,48);
  const positions=geometry.attributes.position,uv=geometry.attributes.uv;
  const offsetY=-(.5-anchorV)*height;
  for(let i=0;i<positions.count;i++) {
    const u=uv.getX(i);
    positions.setY(i,positions.getY(i)+offsetY);
    positions.setZ(i,.04*(1-((u-.5)*2)**2));
  }
  geometry.computeVertexNormals();
  const rest=positions.array.slice();
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.018,depthWrite:false,depthTest:!reveal,toneMapped:false,fog:false});
  const figure=new THREE.Mesh(geometry,material);figure.name='Roomkeeper photographic cutout';figure.renderOrder=reveal?10000:2;figure.frustumCulled=false;head.add(figure);
  const facePoints=[];
  for(const u of ROOMKEEPER_IMAGE.faceU) for(const v of ROOMKEEPER_IMAGE.faceV) {
    facePoints.push(new THREE.Vector3((u-.5)*width,(.5-v)*height+offsetY,.04*(1-((u-.5)*2)**2)));
  }
  function breathe(time,reach=0) {
    const drive=Math.min(1,Math.max(0,reach));
    const air=Math.sin(time*(2.0+drive*.65)),motion=1-drive*.75;
    head.position.y=1.84+air*.003*motion;
    head.rotation.z=Math.sin(time*.75)*.008*motion;
    head.rotation.y=Math.sin(time*.57)*.009*(1-drive);
    head.rotation.x=air*.004*motion;
    chest.scale.z=.7+air*.012;
    for(let i=0;i<positions.count;i++) {
      const imageV=1-uv.getY(i);
      const chestMask=Math.exp(-(((imageV-.72)/.19)**2));
      const hands=imageV>.67?Math.abs(uv.getX(i)-.5)*2:0;
      const jaw=Math.exp(-(((imageV-.405)/.045)**2))*Math.exp(-(((uv.getX(i)-.54)/.16)**2));
      positions.setXYZ(i,rest[i*3]*(1+air*.005*chestMask),rest[i*3+1]+air*.004*chestMask-jaw*drive*.008,
        rest[i*3+2]+air*.004*chestMask+drive*.02*hands);
    }
    positions.needsUpdate=true;
    material.color.setScalar(drive===1?1:.63+.37*drive);
  }
  return {root,head,figure,facePoints,breathe};
}
