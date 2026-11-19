import * as THREE from './vendor/three.module.js';
import { TV_BUTTON } from './core.mjs?v=tv1';

const WIDTH = 640, HEIGHT = 480;
const randomFrom = seed => () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
};
function surface(width = WIDTH, height = HEIGHT) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

// The game owns the count and hit target. This module only renders the video
// signal beneath the existing curved screen at the original 640 x 480 anchors.
export function createScreen() {
  const [canvas, context] = surface();
  const [signal, field] = surface();
  const [glass, pane] = surface();
  const [grain, noise] = surface(160,120);
  const noisePixels = noise.createImageData(160,120);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let grainFrame = null, lastTime = 0, photoTime = 0;

  // These marks belong to the glass rather than the broadcast: very faint
  // burn-in, dust, edge falloff and reflected room light remain still.
  const vignette = pane.createRadialGradient(315,230,155,320,240,395);
  vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(.65,'rgba(0,0,0,.06)'); vignette.addColorStop(1,'rgba(0,0,0,.72)');
  pane.fillStyle = vignette; pane.fillRect(0,0,WIDTH,HEIGHT);
  const reflection = pane.createLinearGradient(0,0,420,370);
  reflection.addColorStop(0,'rgba(170,179,171,.045)'); reflection.addColorStop(.37,'rgba(118,130,126,.014)'); reflection.addColorStop(.55,'rgba(118,130,126,0)');
  pane.fillStyle=reflection; pane.fillRect(0,0,WIDTH,HEIGHT);
  pane.fillStyle='rgba(0,0,0,.11)';
  for (let y=1;y<HEIGHT;y+=3) pane.fillRect(0,y,WIDTH,1);
  const staticRandom=randomFrom(312042);
  for (let i=0;i<125;i++) {
    const x=staticRandom()*WIDTH,y=staticRandom()*HEIGHT,r=.2+staticRandom()*.7;
    pane.fillStyle=`rgba(188,190,178,${.015+staticRandom()*.025})`;
    pane.beginPath(); pane.arc(x,y,r,0,Math.PI*2); pane.fill();
  }
  pane.strokeStyle='rgba(170,179,171,.018)'; pane.lineWidth=.65;
  for (const [x,y,length] of [[77,62,92],[544,326,51],[29,195,38]]) {
    pane.beginPath(); pane.moveTo(x,y); pane.lineTo(x+1.2,y+length); pane.stroke();
  }

  function updateGrain(time) {
    const frame=Math.floor(time*8);
    if (grainFrame===frame) return;
    grainFrame=frame;
    const random=randomFrom((frame*747796405+312)>>>0 || 312);
    const data=noisePixels.data;
    for (let i=0;i<data.length;i+=4) {
      const value=30+Math.floor(random()*155);
      data[i]=value; data[i+1]=value+1; data[i+2]=value;
      data[i+3]=10+Math.floor(random()*15);
    }
    noise.putImageData(noisePixels,0,0);
  }
  function finishSignal(time) {
    context.globalAlpha=1; context.filter='none';
    context.drawImage(signal,0,0);
    // A displaced, dim echo and one slow travelling tracking seam suggest an
    // unstable analog input without flashing the image or erasing the count.
    context.globalAlpha=.045;
    context.drawImage(signal,1.5+Math.sin(time*.23)*.6,.3);
    const trackingY=(time*11+67)%HEIGHT;
    context.globalAlpha=.08;
    context.drawImage(signal,0,trackingY,WIDTH,7,-2,trackingY,WIDTH+3,7);
    context.globalAlpha=1;
    context.fillStyle='rgba(8,10,10,.16)'; context.fillRect(0,trackingY-1,WIDTH,1);
    updateGrain(time);
    context.globalAlpha=.36; context.imageSmoothingEnabled=false; context.drawImage(grain,0,0,WIDTH,HEIGHT);
    context.imageSmoothingEnabled=true; context.globalAlpha=1; context.drawImage(glass,0,0);
  }
  function drawCount(presses,y,photo=false) {
    const safeCount=Number.isFinite(presses)?Math.max(0,Math.floor(presses)):0;
    const label=`YOUR PRESSES: ${safeCount.toLocaleString('en-US')}`;
    context.save(); context.globalAlpha=1; context.filter='none';
    context.textAlign='center'; context.textBaseline='middle'; context.font='23px "Courier New", monospace';
    const width=Math.min(570,context.measureText(label).width+30);
    context.fillStyle=photo?'rgba(9,11,11,.93)':'rgba(15,18,18,.88)';
    context.fillRect((WIDTH-width)/2,y-18,width,36);
    context.fillStyle='#c3c5bb'; context.fillText(label,WIDTH/2,y,550); context.restore();
  }
  return {
    texture,
    draw(time,message=["DON'T PRESS",'THE BUTTON'],{button=true,status='WAIT FOR THE LATCH.',presses=0}={}) {
      lastTime=Number.isFinite(time)?Math.max(0,time):0; photoTime=lastTime;
      field.globalAlpha=1; field.filter='none';
      const base=field.createLinearGradient(0,0,0,HEIGHT);
      base.addColorStop(0,'#1d2222'); base.addColorStop(.45,'#161b1b'); base.addColorStop(1,'#101414');
      field.fillStyle=base; field.fillRect(0,0,WIDTH,HEIGHT);
      // The old channel's lettering is barely retained in the phosphor.
      field.textAlign='center'; field.textBaseline='middle'; field.font='28px "Courier New", monospace';
      field.fillStyle='rgba(153,161,150,.017)'; field.fillText('NO SIGNAL',323,176,550);
      field.textAlign='left'; field.font='15px "Courier New", monospace'; field.fillStyle='#656e69'; field.fillText('AV 1',43,44);
      field.textAlign='center'; field.font='28px "Courier New", monospace'; field.fillStyle='#bfc3b8';
      const lines=Array.isArray(message)?message:[String(message)];
      const center=button?153:203;
      lines.slice(0,3).forEach((line,i) => field.fillText(String(line),WIDTH/2,center+(i-(Math.min(3,lines.length)-1)/2)*42,550));
      if (button) {
        const x=TV_BUTTON.x,y=TV_BUTTON.y;
        field.fillStyle='#342b27'; field.fillRect(x-84,y-35,168,70);
        field.strokeStyle='#896957'; field.lineWidth=1.5; field.strokeRect(x-83.25,y-34.25,166.5,68.5);
        field.font='25px "Courier New", monospace'; field.fillStyle='#c7b9a9'; field.fillText('PRESS',x,y+1,150);
        field.font='18px "Courier New", monospace'; field.fillStyle='#929c93'; field.fillText(String(status),WIDTH/2,414,550);
      }
      finishSignal(lastTime);
      // Counts are rendered last and remain readable over every tracking seam.
      drawCount(presses,button?234:356);
      texture.needsUpdate=true;
    },
    drawPhoto(image,presses) {
      photoTime=Math.max(lastTime,photoTime)+1/9;
      field.globalAlpha=1; field.fillStyle='#101313'; field.fillRect(0,0,WIDTH,HEIGHT);
      field.filter='saturate(.2) brightness(.7) contrast(1.08)'; field.drawImage(image,0,0,WIDTH,HEIGHT); field.filter='none';
      finishSignal(photoTime); drawCount(presses,451,true); texture.needsUpdate=true;
    },
  };
}
