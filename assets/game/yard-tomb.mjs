// The left half of the slate atlas is the carver's face; the right half is
// unlettered stone for the exposed back, broken ledger and bevels.
export function createYardTomb({THREE, labelTexture}) {
  const root = new THREE.Group();
  root.name = 'The last witness in the yard';
  root.userData.interaction = 'yard-tomb';

  const slate = new THREE.MeshStandardMaterial({
    color: 0x838c8c, roughness: .91, metalness: .03, bumpScale: .0026,
  });
  const salt = .003;
  const atlas = (u, v, carved) => [
    (carved ? 0 : .5) + .5 * (salt + THREE.MathUtils.clamp(u, 0, 1) * (1 - 2*salt)),
    salt + THREE.MathUtils.clamp(v, 0, 1) * (1 - 2*salt),
  ];

  // Six separate surfaces across the thickness keep stone cleavage and broken
  // corners readable from the porch, from the side, and in the torch beam.
  function plate(name, points, thickness, bevel, carved = false) {
    const outline = points.map(([x,y]) => new THREE.Vector2(x,y));
    if (THREE.ShapeUtils.isClockWise(outline)) outline.reverse();
    const box = new THREE.Box2().setFromPoints(outline);
    const centre = box.getCenter(new THREE.Vector2()), span = box.getSize(new THREE.Vector2());
    const indices = THREE.ShapeUtils.triangulateShape(outline, []);
    const positions = [], uvs = [];
    // The face is inset on a shallow chamfer. It has the same profile as the
    // chipped middle, preventing cracks around the corners of the bevel.
    const rings = [[-.5,1],[-.40,.16],[-.31,0],[.33,0],[.43,.22],[.5,1]].map(([z,edge]) =>
      outline.map(p => new THREE.Vector3(
        centre.x+(p.x-centre.x)*(1-2*bevel*edge/span.x),
        centre.y+(p.y-centre.y)*(1-2*bevel*edge/span.y), z*thickness))
    );
    const faceUV = (p, front) => {
      if (front && carved) return atlas((p.x+.322)/.644, (p.y-.08)/.855, true);
      return atlas((p.x-box.min.x)/span.x, (p.y-box.min.y)/span.y, false);
    };
    function triangle(a,b,c,ta,tb,tc) {
      positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
      uvs.push(...ta,...tb,...tc);
    }
    for (const [i,j,k] of indices) {
      let a=rings[5][i],b=rings[5][j],c=rings[5][k];
      triangle(a,b,c,faceUV(a,true),faceUV(b,true),faceUV(c,true));
      a=rings[0][i];b=rings[0][j];c=rings[0][k];
      triangle(c,b,a,faceUV(c,false),faceUV(b,false),faceUV(a,false));
    }
    let along = 0;
    for (let i=0; i<outline.length; i++) {
      const j=(i+1)%outline.length, length=outline[i].distanceTo(outline[j]);
      const start=.10+.67*((along*1.813)%1);
      const end=Math.min(.99,start+length*.53);
      for (let row=0; row<rings.length-1; row++) {
        const a=rings[row][i],b=rings[row][j],c=rings[row+1][j],d=rings[row+1][i];
        const low=.43+a.z/thickness*.18,high=.43+d.z/thickness*.18;
        const ta=atlas(start,low,false),tb=atlas(end,low,false);
        const tc=atlas(end,high,false),td=atlas(start,high,false);
        triangle(a,b,c,ta,tb,tc);triangle(a,c,d,ta,tc,td);
      }
      along+=length;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry,slate);
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    return mesh;
  }

  // The broken crown and stepped shoulders are part of the silhouette.
  const upright = [
    [-.284,.084],[.281,.084],[.282,.258],[.277,.281],[.281,.294],
    [.285,.547],[.281,.593],[.287,.611],[.286,.656],[.300,.664],
    [.302,.687],[.294,.700],[.265,.701],[.254,.710],[.249,.725],
  ];
  for (let i=0; i<=32; i++) {
    const a=i*Math.PI/32;
    const chip=(i===7?.014:i===8?.009:i===20?.006:i===28?.007:0);
    upright.push([(.249-chip)*Math.cos(a),.727+(.194-chip)*Math.sin(a)]);
  }
  upright.push([-.257,.706],[-.267,.698],[-.291,.697],[-.306,.687],
    [-.310,.671],[-.302,.656],[-.285,.651],[-.286,.526],[-.280,.504],
    [-.283,.490],[-.284,.327],[-.278,.309],[-.284,.286]);
  const marker=plate('Incised arched slate headstone',upright,.112,.010,true);
  marker.rotation.set(-.042,.023,-.012);

  // All slab profiles start on the ground plane. A small, genuine split lets
  // light into the break through the two halves of the adult-sized ledger.
  function horizontal(name, xz, thickness, y, bevel) {
    const stone=plate(name,xz.map(([x,z])=>[x,-z]),thickness,bevel);
    stone.rotation.x=-Math.PI/2;stone.position.y=y;
    return stone;
  }
  horizontal('Settled foot of the headstone',[
    [-.367,-.137],[-.353,-.177],[.330,-.176],[.365,-.148],[.371,.106],
    [.356,.153],[.256,.161],[.233,.153],[-.340,.156],[-.371,.126],
  ],.128,.063,.018);
  horizontal('Ledger beneath the inscription',[
    [-.291,.105],[.286,.105],[.328,.173],[.310,.588],
    [.191,.607],[.076,.599],[-.027,.620],[-.177,.617],[-.320,.651],[-.330,.187],
  ],.078,.042,.009);
  const foot=horizontal('Fractured end of the grave ledger',[
    [-.320,.658],[-.176,.623],[-.026,.626],[.077,.607],[.192,.614],[.310,.593],
    [.302,1.087],[.273,1.115],[.132,1.125],[.119,1.115],
    [-.140,1.127],[-.216,1.12],[-.313,1.091],[-.315,.997],
  ],.071,.029,.009);
  foot.rotation.z=.016;

  // Sparse waterlogged blades keep the low stone seated in the grass outside.
  const bladePositions=[],bladeColors=[];
  let seed=1973;
  function random() {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  for (const [x,z] of [[-.35,.15],[.354,.02],[.311,.73],[-.314,.63],[-.28,1.104]]) {
    for(let blade=0;blade<5;blade++){
      const bx=x+(random()-.5)*.042,bz=z+(random()-.5)*.044;
      const height=.04+random()*.065,width=.0025+random()*.0037;
      const age=random(),lx=(random()-.5)*.060,lz=(random()-.5)*.058;
      bladePositions.push(bx-width,.007,bz,bx+width,.007,bz,bx+lx,height,bz+lz);
      const c=new THREE.Color().setHSL(.17+age*.035,.25-age*.10,.19+age*.13);
      bladeColors.push(c.r*.56,c.g*.56,c.b*.56,c.r*.68,c.g*.68,c.b*.68,c.r,c.g,c.b);
    }
  }
  const grass=new THREE.BufferGeometry();
  grass.setAttribute('position',new THREE.Float32BufferAttribute(bladePositions,3));
  grass.setAttribute('color',new THREE.Float32BufferAttribute(bladeColors,3));
  grass.computeVertexNormals();
  const blades=new THREE.Mesh(grass,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}));
  blades.name='Grass in the ledger joints';root.add(blades);

  function fallback() {
    if (!labelTexture) return;
    const map=labelTexture(['HERE LIES','THE LAST','WITNESS'],{
      size:512,background:'rgba(0,0,0,0)',color:'#101b19',font:'Georgia,serif',fontWeight:'bold',fontSize:.126,lineSpacing:.23,
    });
    const engraving=new THREE.Mesh(new THREE.PlaneGeometry(.45,.245),
      new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.05,depthWrite:false}));
    engraving.position.set(0,.495,.057);engraving.name='Weathered epitaph';marker.add(engraving);
  }
  if (typeof document!=='undefined' && typeof document.createElementNS==='function') {
    const loader=new THREE.TextureLoader();
    loader.load(new URL('./yard-slate.webp',import.meta.url).href, texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
      slate.map=texture;slate.color.setHex(0xffffff);slate.needsUpdate=true;
    },undefined,fallback);
    loader.load(new URL('./yard-slate-relief.webp',import.meta.url).href, texture=>{
      texture.anisotropy=4;slate.bumpMap=texture;slate.needsUpdate=true;
    },undefined,()=>{});
  }
  return root;
}
