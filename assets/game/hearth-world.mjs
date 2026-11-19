import * as THREE from './vendor/three.module.js';

/** A small open hearth: soft flame/ember detail and actual warm room lighting. */
export function createHearth(scene, root) {
  const group=new THREE.Group();group.name='Low fire in the existing hearth';root.add(group);
  const emberMaterial=new THREE.MeshStandardMaterial({color:0x251b12,emissive:0xc84510,emissiveIntensity:.65,roughness:1});
  const bed=new THREE.Mesh(new THREE.BoxGeometry(.26,.025,1.08),emberMaterial);
  bed.position.set(-3.68,.208,0);bed.name='Glowing coal bed';bed.raycast=()=>{};group.add(bed);
  const embers=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.02,.08),emberMaterial,16),dummy=new THREE.Object3D();
  for(let i=0;i<16;i++){
    dummy.position.set(-3.78+(i%3)*.09,.228+(i%2)*.016,-.5+(i/15)*1.0);dummy.rotation.set(.08*(i%3),i*.73,0);dummy.updateMatrix();embers.setMatrixAt(i,dummy.matrix);
  }
  embers.name='Small embers between the logs';embers.raycast=()=>{};group.add(embers);
  const clock={value:0};
  const flameMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{time:clock},
    vertexShader:`varying vec2 flameUV;void main(){flameUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 flameUV;uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){
        vec2 uv=flameUV;float drift=noise(vec2(uv.y*4.,time*.55))-.5;
        float grain=noise(vec2(uv.x*11.+drift*.7,uv.y*8.-time*1.2));
        float detail=noise(vec2(uv.x*23.,uv.y*14.-time*1.7));
        float mound=pow(max(0.,1.-abs(uv.x-.5+drift*.04)*1.95),.55);
        float height=(.22+.43*grain+.13*detail)*mound;
        float fire=(1.-smoothstep(height-.14,height,uv.y))*smoothstep(0.,.085,uv.y);
        fire*=smoothstep(0.,.12,uv.x)*(1.-smoothstep(.88,1.,uv.x));
        float heat=max(0.,1.-uv.y*1.7);vec3 color=mix(vec3(1.05,.22,.025),vec3(1.35,.77,.25),heat*heat);
        gl_FragColor=vec4(color,fire*(.42+.20*grain));
      }`});
  const flame=new THREE.Mesh(new THREE.PlaneGeometry(1.22,.68),flameMaterial);
  flame.name='Low organic hearth flames';flame.position.set(-3.59,.54,0);flame.rotation.y=Math.PI/2;flame.raycast=()=>{};group.add(flame);
  // This is a real light, positioned at the front of the recess so its warm
  // spill reaches the floor, table and sofa rather than illuminating a back wall.
  const baseIntensity=18;
  const light=new THREE.PointLight(0xffb578,baseIntensity,8.4,1.7);light.name='Warm hearth light';
  light.position.set(-3.08,.78,0);light.castShadow=false;scene.add(light);
  function update(time,{reducedMotion=false}={}){
    const t=reducedMotion?0:(Number.isFinite(time)?Math.max(0,time):0);
    clock.value=t;
    const breath=reducedMotion?0:Math.sin(t*1.7)*.025+Math.sin(t*2.73+.4)*.018;
    emberMaterial.emissiveIntensity=.65+breath*.8;
  }
  function reset(){update(0,{reducedMotion:true});}
  reset();
  return {group,light,flame,embers,baseIntensity,update,reset};
}
