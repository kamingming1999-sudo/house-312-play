import * as THREE from './vendor/three.module.js';

// The generated wardrobe and head turnarounds share the same neutral pose.
// Positions below are fitted cross sections in plate pixels: height from the top,
// left/right silhouette, then front/back depth relative to the profile centre.
const scale=.00249, floor=720;
const position=(x,y,z=0)=>new THREE.Vector3(x*scale,(floor-y)*scale,z*scale);
const clamp=THREE.MathUtils.clamp, smooth=THREE.MathUtils.smoothstep;
const chest=[
  [104,-18,18,19,-17],[112,-34,34,27,-32],[125,-57,57,29,-46],
  [140,-79,79,41,-49],[154,-88,88,46,-52],[177,-88,88,50,-54],
  [201,-85,85,54,-56],[226,-81,81,58,-59],[251,-81,82,59,-65],
  [268,-82,83,62,-68],[287,-85,86,62,-70],[308,-88,89,64,-72],
  [326,-90,90,66,-74],[342,-92,92,66,-75],[360,-91,93,66,-75],
  [374,-90,92,67,-73],[380,-85,86,62,-68],[381,-4,4,6,-5]
];
const sleeve=[
  [137,66,76,10,-14],[145,65,90,23,-26],[156,65,99,29,-29],
  [177,71,109,34,-32],[199,80,117,32,-33],[218,84,126,28,-31],
  [233,86,133,28,-28],[248,85,139,31,-25],[258,84,141,30,-24],
  [271,90,147,30,-23],[288,99,151,34,-18],[305,109,158,33,-16],
  [318,115,162,34,-14],[331,121,166,36,-10],[339,124,166,34,-8],
  [347,127,168,33,-6],[357,132,168,32,-6],[362,134,166,29,-4],
  [364,136,163,26,-2]
];
const palm=[
  [354,137,163,27,-1],[365,137,165,30,-3],[374,135,168,30,-3],
  [382,134,167,30,-1],[390,143,166,28,0],[399,145,165,28,2]
];
const leg=[
  [353,-4,76,47,-57],[369,-2,83,50,-58],[387,0,84,50,-54],
  [405,2,86,46,-50],[428,10,87,44,-49],[450,15,89,39,-47],
  [469,22,88,35,-49],[486,25,86,35,-48],[496,27,87,32,-50],
  [506,29,90,29,-54],[519,34,92,26,-55],[535,36,94,20,-57],
  [557,36,99,14,-61],[580,37,100,10,-62],[598,40,99,9,-62],
  [613,42,102,6,-60],[628,46,104,8,-58],[641,48,105,10,-56],
  [652,49,102,10,-60],[663,51,102,12,-59],[673,56,101,20,-57],
  [678,56,99,23,-55]
];
const boot=[
  [657,57,97,11,-52],[671,57,99,22,-54],[680,58,99,38,-57],
  [687,58,107,61,-58],[697,56,115,66,-59],[705,57,121,64,-60],
  [712,63,124,57,-57],[717,71,121,44,-49],[720,76,112,30,-33]
];
const hairAndFace=[
  [4,-2,2,3,-3],[6,-17,16,17,-13],[10,-25,24,28,-24],
  [16,-32,32,39,-32],[23,-38,37,44,-40],[31,-42,41,47,-46],
  [40,-43,43,49,-48],[48,-42,42,50,-49],[55,-41,40,50,-49],
  [61,-39,39,48,-48],[67,-37,37,49,-46],[73,-35,34,54,-43],
  [77,-34,34,55,-43],[81,-32,32,50,-41],[86,-29,30,47,-39],
  [91,-28,29,48,-37],[97,-27,27,47,-33],[102,-24,25,46,-29],
  [106,-20,21,44,-19],[110,-14,15,40,0],[112,-4,4,29,10]
];
const neck=[
  [90,-20,20,23,-26],[104,-24,24,23,-30],[113,-24,24,21,-22],
  [121,-23,23,20,-24],[133,-26,27,21,-23],[141,-30,30,22,-25]
];

function material(){
  const atlas=typeof document==='undefined'?null:new THREE.TextureLoader().load(new URL('./occupant-turnaround.webp',import.meta.url).href);
  if(atlas){atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;}
  const mat=new THREE.MeshStandardMaterial({color:atlas?0xffffff:0x6b6251,roughness:.96,map:atlas});
  if(!atlas)return mat;
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec4 plate; attribute vec4 facing; varying vec4 vPlate; varying vec4 vFacing;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvPlate=plate; vFacing=facing;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec4 vPlate; varying vec4 vFacing;')
      .replace('#include <map_fragment>',`vec3 weights = vFacing.xyz / max(dot(vFacing.xyz,vec3(1.0)),0.001);
        diffuseColor.rgb *= texture2D(map,vec2(vPlate.x,vPlate.w)).rgb * weights.x
          + texture2D(map,vec2(vPlate.y,vPlate.w)).rgb * weights.y
          + texture2D(map,vec2(vPlate.z,vPlate.w)).rgb * weights.z;
        float cuffRow=(1.0-vPlate.w)*1152.0+vFacing.w;
        float seam=min(abs(cuffRow-337.0),abs(cuffRow-343.0));
        float thread=(1.0-smoothstep(0.25,1.65,seam))*step(-9.0,vFacing.w);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.34,0.235,0.103),thread*0.61);`)
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*0.19;');
  };
  mat.customProgramCacheKey=()=>'occupant-plate-albedo-1';
  return mat;
}

export function createOccupant(parent,receiver){
  const actor=new THREE.Group();actor.name='Independent recorded occupant';parent.add(actor);
  const bones=[],rest=[];
  function joint(name,owner,x,y,z=0){
    const bone=new THREE.Bone(),origin=position(x,y,z);bone.name=name;
    bone.position.copy(origin);if(owner!==null)bone.position.sub(rest[owner]);
    (owner===null?actor:bones[owner]).add(bone);bones.push(bone);rest.push(origin);
    return bones.length-1;
  }
  const hips=joint('Pelvis',null,0,371,-3),spine=joint('Clothed spine',hips,0,309,-7);
  const skull=joint('Head pivot',spine,0,116,0),arms=[],legs=[];
  const pos=[],plates=[],facing=[],indices=[],skin=[],weights=[],forearmTriangles=[],handTriangles=[],cuffTriangles=[];
  function addSurface(sections,bind,{side=1,head=false,kind='',segments=36}={}){
    const first=pos.length/3;
    for(const [y,left,right,front,back] of sections){
      for(let i=0;i<segments;i++){
        const t=i*Math.PI*2/segments,s=Math.sin(t),c=Math.cos(t);
        const x=side*((left+right)/2+(right-left)*.5*s);
        let z=(front+back)/2+(front-back)*.5*c;
        if(kind==='face'&&c>0){
          const bell=(xc,yc,wx,wy)=>Math.exp(-(((x-xc)/wx)**2+((y-yc)/wy)**2));
          z-=c*12*Math.exp(-(((y-76)/12)**2))*(1-Math.exp(-((x/8)**2)));
          z+=c*(2.8*(bell(-21,81,8,7)+bell(21,81,8,7))-2.2*(bell(-14,62,8,3.8)+bell(14,62,8,3.8)));
        }
        const p=position(x,y,z);pos.push(p.x,p.y,p.z);
        const [a,b=a,w=0]=bind(y);
        skin.push(a,b,0,0);weights.push(1-w,w,0,0);
        let frontX,sideX,backX,atlasY;
        if(head){
          frontX=(375+x*5.03-144)*.57;
          sideX=285+(1096-z*5-800)*.57;backX=608+(1817-x*5.03-1580)*.57;
          atlasY=734+(8+(y-4)*4.95)*.57;
        }else{
          frontX=502+x-320;sideX=384+1076-z-994;backX=576+1665-x-1488;atlasY=y;
        }
        plates.push(frontX/1024,sideX/1024,backX/1024,1-atlasY/1152);
        let lateral=smooth(Math.abs(s),.49,.96);
        // The profile camera could not see the ribcage or the opposite wrist
        // through the hanging sleeve. Use the jacket plates for these surfaces.
        if(kind==='chest'&&y>150)lateral=0;
        // In the side photograph the resting fingers overlap the upper thigh.
        // Only the actual hand may carry those pixels as the arm leaves the hip.
        if(kind==='leg')lateral*=smooth(y,432,448);
        if(kind==='sleeve'&&s<0)lateral*=.25;
        facing.push(c>=0?1-lateral:0,lateral,c<0?1-lateral:0,kind==='sleeve'?s*3+c*1.4:-64);
      }
    }
    for(let j=0;j<sections.length-1;j++)for(let i=0;i<segments;i++){
      const a=first+j*segments+i,b=first+j*segments+(i+1)%segments;
      if(side===1 && kind==='hand')handTriangles.push(a,a+segments,b,b,a+segments,b+segments);
      if(side===1 && kind==='sleeve' && sections[j][0]>=248)cuffTriangles.push(a,a+segments,b,b,a+segments,b+segments);
      if(side===1 && (kind==='sleeve'||kind==='hand') && sections[j][0]>=248)forearmTriangles.push(a,a+segments,b,b,a+segments,b+segments);
      if(side===1)indices.push(a,a+segments,b,b,a+segments,b+segments);
      else indices.push(a,b,a+segments,b,b+segments,a+segments);
    }
  }
  const taper=(y,begin,end,a,b)=>[a,b,smooth(y,begin,end)];
  addSurface(chest,y=>taper(y,260,375,spine,hips),{kind:'chest'});
  addSurface(neck,y=>taper(y,106,139,skull,spine),{head:true});
  addSurface(hairAndFace,()=>[skull],{head:true,kind:'face',segments:64});
  for(const side of [-1,1]){
    const shoulder=joint('Shoulder',spine,side*75,149,-5),elbow=joint('Elbow',shoulder,side*116,244,1);
    const wrist=joint('Hand',elbow,side*149,359,13);
    arms.push({shoulder,elbow,wrist});
    addSurface(sleeve,y=>y<163?taper(y,137,163,spine,shoulder):taper(y,222,263,shoulder,elbow),{side,kind:'sleeve',segments:24});
    addSurface(palm,()=>[wrist],{side,kind:'hand',segments:24});
    for(let finger=0;finger<4;finger++){
      const k=144+finger*4.7,tip=[420,423,419,413][finger],z=7+finger*2.1;
      addSurface([[391,k-2,k+4,z+9,z-6],[402,k-2,k+3,z+8,z-6],
        [tip-4,k-1,k+2,z+10,z+1],[tip,k,k+.6,z+6,z+5]],()=>[wrist],{side,kind:'hand',segments:10});
    }
    addSurface([[376,135,144,28,17],[387,132,142,30,19],[395,131,141,30,21],[400,136,140,28,24]],()=>[wrist],{side,kind:'hand',segments:12});
    const hip=joint('Hip',hips,side*42,366,-2),knee=joint('Knee',hip,side*56,498,-2);
    legs.push({hip,knee});
    addSurface(leg,y=>y<385?taper(y,353,385,hips,hip):taper(y,479,522,hip,knee),{side,kind:'leg',segments:26});
    addSurface(boot,()=>[knee],{side,segments:26});
  }
  const geometry=new THREE.BufferGeometry(),attr=(values,n)=>new THREE.Float32BufferAttribute(values,n);
  geometry.setAttribute('position',attr(pos,3));geometry.setAttribute('plate',attr(plates,4));
  geometry.setAttribute('facing',attr(facing,4));geometry.setAttribute('uv',attr(new Float32Array(pos.length/3*2),2));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skin,4));geometry.setAttribute('skinWeight',attr(weights,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const body=new THREE.SkinnedMesh(geometry,material());body.name='Occupant in worn field jacket';
  body.raycast=()=>{};body.userData.pickThrough=true;body.frustumCulled=false;body.receiveShadow=true;
  actor.add(body);actor.updateMatrixWorld(true);body.bind(new THREE.Skeleton(bones));
  bones[arms[1].wrist].add(receiver);receiver.position.set(0,.032,.013);
  const axis=new THREE.Vector3(),pole=new THREE.Vector3(),elbowAt=new THREE.Vector3(),handAt=new THREE.Vector3();
  const inverse=new THREE.Quaternion(),q=new THREE.Quaternion();
  const right=arms[1],upper=bones[right.elbow].position.clone(),lower=bones[right.wrist].position.clone();
  const upperLength=upper.length(),lowerLength=lower.length(),upperAxis=upper.clone().normalize(),lowerAxis=lower.clone().normalize();
  const ear=position(42,75,13).sub(rest[right.shoulder]);
  const sole=new THREE.Vector3();
  const soles=legs.map(({knee},i)=>[-48,31,55].map((z,j)=>position((i?1:-1)*78,[715,720,714][j],z).sub(rest[knee])));
  function pose(p){
    actor.visible=Boolean(p);if(!p)return;
    actor.position.set(p.x,0,p.z);actor.rotation.y=(p.yaw??0)+Math.PI;
    const crouch=clamp(p.crouch||0,0,1),reach=clamp(p.reach||0,0,1),raise=clamp(p.raise||0,0,1),phone=clamp(p.phone||0,0,1);
    const stride=Number.isFinite(p.stride)?p.stride:0;
    bones[hips].position.y=rest[hips].y-.36*crouch;
    bones[hips].rotation.y=stride*.06;bones[spine].rotation.set(.04+crouch*.30,-stride*.12,-stride*.024);
    bones[skull].rotation.set(-clamp(p.pitch??0,-1,1)*.68-.035,0,stride*.018);
    for(let i=0;i<2;i++){
      const side=i===0?-1:1,step=stride*side,{shoulder,elbow}=arms[i];
      const reaching=i===1?reach:reach*.15;
      bones[shoulder].rotation.set(-step*.31-reaching*1.10-raise*.69,side*raise*.07,side*(-.20+raise*.19));
      bones[elbow].rotation.set(-.06-reaching*.16-raise*1.26,0,-side*raise*.11);
      bones[legs[i].hip].rotation.x=step*.53-crouch*1.20;
      bones[legs[i].knee].rotation.x=crouch*2.03+Math.max(0,-step)*.64;
    }
    // Plant the lowest point of either sole while the hips lower or the gait rolls.
    let ground=Infinity;
    legs.forEach(({hip,knee},i)=>{
      for(const sample of soles[i]){
        sole.copy(sample).applyQuaternion(bones[knee].quaternion).add(bones[knee].position)
          .applyQuaternion(bones[hip].quaternion).add(bones[hip].position);
        ground=Math.min(ground,sole.y+bones[hips].position.y);
      }
    });
    bones[hips].position.y-=ground;
    receiver.visible=phone>.035;
    if(receiver.visible){
      const shoulder=bones[right.shoulder],elbow=bones[right.elbow];
      handAt.copy(lower).applyQuaternion(elbow.quaternion).add(upper).applyQuaternion(shoulder.quaternion).lerp(ear,phone);
      const distance=clamp(handAt.length(),.07,upperLength+lowerLength-.0001);axis.copy(handAt).normalize();
      pole.set(.65,-.88,.62);pole.addScaledVector(axis,-axis.dot(pole)).normalize();
      const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
      elbowAt.copy(axis).multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
      shoulder.quaternion.setFromUnitVectors(upperAxis,handAt.copy(elbowAt).normalize());
      q.setFromUnitVectors(lowerAxis,handAt.copy(axis).multiplyScalar(distance).sub(elbowAt).normalize());
      elbow.quaternion.copy(shoulder.quaternion).invert().multiply(q);
      receiver.quaternion.copy(inverse.copy(q).invert());
    }
  }
  function makeForearm({handOnly=false,sleeveOnly=false}={}){
    // The POV camera shows the same photographed wrist that appears on the
    // double. Crop only the right sleeve and fingers, and orient it for POV.
    const triangles=handOnly?handTriangles:sleeveOnly?cuffTriangles:forearmTriangles;
    const g=new THREE.BufferGeometry(),used=[...new Set(triangles)],remap=new Map(used.map((id,i)=>[id,i]));
    for(const name of ['position','normal','uv','plate','facing']){
      const a=geometry.getAttribute(name),out=new Float32Array(used.length*a.itemSize);
      used.forEach((id,i)=>out.set(a.array.subarray(id*a.itemSize,(id+1)*a.itemSize),i*a.itemSize));
      g.setAttribute(name,attr(out,a.itemSize));
    }
    g.setIndex(triangles.map(id=>remap.get(id)));
    const pivot=rest[right.wrist];
    g.translate(-pivot.x,-pivot.y,-pivot.z);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(lowerAxis,new THREE.Vector3(0,-1,0)));
    if(!handOnly)g.translate(0,-.083,0);
    const sleeveMesh=new THREE.Mesh(g,body.material);sleeveMesh.name=handOnly?'Occupant’s bare hand':'Photographed cuff and hand';
    sleeveMesh.raycast=()=>{};sleeveMesh.userData.pickThrough=true;
    return sleeveMesh;
  }
  return {actor,pose,makeForearm};
}
