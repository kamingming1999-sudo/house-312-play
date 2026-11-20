// The treads, landing and collision ramp share the same start and top.
export const STAIR_FOOT=1.16, STAIR_RUN=2.41, LANDING_Y=2.52;
export function stairHeight(x,z){
  if(x<2.33||z<STAIR_FOOT)return 0;
  return LANDING_Y*Math.min(1,(z-STAIR_FOOT)/STAIR_RUN);
}
export function buildAttic({root,box,beam,wood,floor,wall,plaster,dark,brass,glassMap,rainMap,stormSky,labelTexture,THREE}){
  root.getObjectByName('ceiling').removeFromParent();
  root.getObjectByName('door wall right').removeFromParent();
  box('parlor ceiling to stairwell',[6.38,.15,9.2],[-1.135,3.35,0],dark);
  box('parlor ceiling in front of stairs',[2.27,.15,5.57],[3.19,3.35,-1.815],dark);
  box('short ceiling header',[2.27,.15,.12],[3.19,3.35,1.005],wood);
  box('door wall right',[1.48,3.3,.2],[1.52,1.65,4.5],wall);
  box('plaster below loft floor',[2.05,2.52,.2],[3.275,1.26,4.5],wall);
  const addTread=(name,size,at,mat)=>{
    const m=box(name,size,at,mat);m.userData.walkSurface=true;m.userData.houseStatic=false;
    m.userData.stairFlight=name!=='attic landing';return m;
  };
  const count=11,depth=STAIR_RUN/count;
  for(let i=0;i<count;i++){
    const z=STAIR_FOOT+depth*(i+.5),y=LANDING_Y*(i+1)/count;
    addTread('stair riser',[1.79,y,depth],[3.15,y/2,z],wood);
    addTread('worn stair tread',[1.82,.036,depth+.018],[3.15,y-.015,z-.006],floor);
    if(i%2===0)beam('stair baluster',[2.25,y,z],[2.25,y+.81,z],.042,.042);
  }
  beam('stair handrail',[2.25,.98,1.21],[2.25,3.31,3.52],.084,.087);
  box('stair newel',[.12,1.08,.12],[2.24,.54,1.16]);
  addTread('attic landing',[2.04,.14,2.98],[3.25,LANDING_Y-.07,5.06],floor);
  for(const z of [3.56,4.27])box('upper landing post',[.085,.83,.085],[2.25,2.93,z],wood);
  box('upper landing rail',[.084,.085,.81],[2.25,3.32,3.92],wood);
  for(const x of [2.12,4.25])box('stairwell cheek wall',[.12,1.45,3.42],[x,4.015,2.73],plaster);
  for(const x of [2.16,4.25])box('loft side wall',[.12,2.5,2.13],[x,3.77,5.52],plaster);
  // Gabled roof: two planes meet at a timber ridge. Rafters frame the doorway.
  const roof=(name,x1,y1,x2,y2,z,length,thick,mat)=>{
    const mesh=box(name,[Math.hypot(x2-x1,y2-y1),thick,length],[(x1+x2)/2,(y1+y2)/2,z],mat);
    mesh.rotation.z=Math.atan2(y2-y1,x2-x1);return mesh;
  };
  const clearGlass=new THREE.MeshPhysicalMaterial({color:0xc6dce4,roughness:.21,metalness:0,
    clearcoat:.55,transparent:true,opacity:.085,depthWrite:false});
  const rainOnGlass=rainMap&&new THREE.MeshBasicMaterial({map:rainMap,color:0xc1d4de,transparent:true,opacity:.77,depthWrite:false,side:THREE.DoubleSide});
  const startZ=2.46,endZ=6.44,midZ=(startZ+endZ)/2;
  for(const [x1,y1,x2,y2] of [[2.04,4.71,3.20,5.57],[3.20,5.57,4.36,4.71]]){
    const section=(name,t0,t1,z,length,thick,material)=>
      roof(name,x1+(x2-x1)*t0,y1+(y2-y1)*t0,x1+(x2-x1)*t1,y1+(y2-y1)*t1,z,length,thick,material);
    section('pitched attic roof',0,1,(.97+startZ)/2,startZ-.97,.11,wood);
    section('pitched attic roof',0,1,(6.61+endZ)/2,6.61-endZ,.11,wood);
    section('weathered skylight curb',0,.10,midZ,endZ-startZ,.11,wood);
    section('weathered skylight curb',.90,1,midZ,endZ-startZ,.11,wood);
    const pane=section('Clear attic skylight',.10,.90,midZ,endZ-startZ,.012,clearGlass);
    pane.castShadow=false;pane.receiveShadow=false;
    if(rainOnGlass){
      const span=endZ-startZ,slope=Math.hypot(x2-x1,y2-y1);
      const film=new THREE.Mesh(new THREE.PlaneGeometry(span,slope*.8),rainOnGlass);
      const upSlope=new THREE.Vector3(x2-x1,y2-y1,0).normalize();
      if(upSlope.y<0)upSlope.negate();
      const along=new THREE.Vector3(0,0,1),normal=new THREE.Vector3().crossVectors(along,upSlope);
      film.setRotationFromMatrix(new THREE.Matrix4().makeBasis(along,upSlope,normal));
      film.position.copy(pane.position);film.position.y-=.011;film.renderOrder=1;film.raycast=()=>{};
      const tex=film.geometry.attributes.uv;
      for(let i=0;i<tex.count;i++)tex.setXY(i,tex.getX(i)*3.5,tex.getY(i));
      film.name='Rain running down the skylight';root.add(film);
    }
    for(const z of [1.08,2.42,3.83,5.2,6.48])roof('exposed attic rafter',x1,y1-.10,x2,y2-.10,z,.098,.13,wood);
  }
  box('ridge beam',[.12,.17,5.64],[3.2,5.46,3.79],wood);
  box('attic front gable',[2.26,2.15,.10],[3.19,4.39,1.01],plaster);
  box('attic end gable',[2.15,3.10,.12],[3.2,4.04,6.62],plaster);
  for(const x of [2.40,3.98])box('loft door jamb',[.125,2.06,.18],[x,3.55,4.48],wood);
  box('loft door lintel',[1.70,.16,.20],[3.19,4.64,4.48],wood);
  const door=box('loft door left ajar',[.09,1.94,1.02],[2.46,3.49,5.03],wood);door.rotation.y=-.09;
  box('loft door latch',[.11,.042,.09],[2.54,3.46,5.43],brass);
  const trunk=new THREE.Group();
  trunk.name='Attic trunk';trunk.position.set(3.81,2.74,6.21);
  trunk.userData.interaction='attic-box';root.add(trunk);
  box('attic trunk',[.67,.43,.42],[0,0,0],dark,trunk);
  for(const x of [-.23,.23])box('trunk binding',[.035,.44,.43],[x,0,0],brass,trunk);
  const ink=labelTexture?.(["this ain't","shortcut"],{background:'#cab993',color:'#241e19',font:'Georgia, serif',fontSize:.19,lineSpacing:.28});
  const paper=new THREE.Mesh(new THREE.PlaneGeometry(.37,.24),
    new THREE.MeshStandardMaterial({map:ink??null,roughness:.96,side:THREE.DoubleSide}));
  paper.name='Handwritten note on the attic box';
  paper.position.set(0,.218,-.018);paper.rotation.set(-Math.PI/2,0,Math.PI-.05);
  trunk.add(paper);
  const pane=new THREE.MeshBasicMaterial({color:glassMap?0xc9d8da:0x718a97,map:glassMap??null});
  box('attic gable window',[.58,.69,.05],[3.17,4.26,6.53],wood);
  box('attic moonlit glass',[.49,.59,.025],[3.17,4.26,6.492],pane);
  box('attic glazing bar',[.032,.60,.035],[3.17,4.26,6.472],wood);
  const light=new THREE.PointLight(0xa4bec8,7.4,5.7,2);light.position.set(3.14,4.68,4.89);root.add(light);
  // A distant sky beyond the cut roof gives the near rafters real parallax.
  const night=new THREE.MeshBasicMaterial({map:stormSky??null,color:stormSky?0x7089a1:0x283847,fog:false});
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(24,24),night);
  sky.name='Night sky above the attic';sky.position.set(3.2,11.7,4.5);
  sky.rotation.x=Math.PI/2;sky.raycast=()=>{};root.add(sky);
  const uv=sky.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,.13+.52*uv.getX(i),.71+.28*uv.getY(i));
  const flash=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshBasicMaterial({
    map:stormSky??null,color:0xe0ebff,fog:false,transparent:true,opacity:0,depthWrite:false}));
  flash.name='Lightning over the attic';flash.position.set(3.2,11.62,4.5);
  flash.rotation.copy(sky.rotation);flash.raycast=()=>{};root.add(flash);
  return {setStorm(level){
    flash.visible=Boolean(stormSky)&&level>.004;
    flash.material.opacity=Math.min(1,level*1.15);
    light.intensity=7.4+level*6.5;
  }};
}
