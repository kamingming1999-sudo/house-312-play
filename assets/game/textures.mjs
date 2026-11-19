import * as THREE from './vendor/three.module.js';
import { TV_BUTTON } from './core.mjs?v=tv1';

function randomGenerator(seed) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}
function canvasTexture(size, draw, repeat = [1, 1]) {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  draw(canvas.getContext('2d'), size, randomGenerator(312));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat);
  texture.anisotropy = 4; return texture;
}
export function createTextures() {
  const wallpaper = canvasTexture(512, (c, n, random) => {
    c.fillStyle = '#69634e'; c.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 3) for (let x = 0; x < n; x += 3) {
      c.fillStyle = `rgba(25,23,12,${random() * .13})`; c.fillRect(x, y, 3, 3);
    }
    c.strokeStyle = '#4d4c3d'; c.lineWidth = 1.5;
    for (let y = 0; y <= n; y += 64) for (let x = 0; x <= n; x += 64) {
      const xx = x + (y % 128 ? 32 : 0);
      c.beginPath(); c.moveTo(xx, y - 23); c.bezierCurveTo(xx + 31, y, xx + 17, y + 13, xx, y + 25);
      c.bezierCurveTo(xx - 17, y + 13, xx - 31, y, xx, y - 23); c.stroke();
      c.beginPath(); c.ellipse(xx, y, 4, 9, 0, 0, Math.PI * 2); c.stroke();
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(37,30,20,${random() * .06})`;
      c.beginPath(); c.ellipse(random() * n, random() * n, 10 + random() * 80, 15 + random() * 90, 0, 0, 7); c.fill();
    }
  }, [3, 1.1]);
  const wood = canvasTexture(512, (c, n, random) => {
    c.fillStyle = '#3d2b1d'; c.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) {
      const shade = 32 + random() * 30;
      c.strokeStyle = `rgba(${shade + 39},${shade + 12},${shade},.55)`;
      c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(n / 3, y + random() * 6, n * .7, y - 3, n, y + 1); c.stroke();
    }
    c.strokeStyle = '#16130e'; c.lineWidth = 2;
    for (let x = 0; x < n; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, n); c.stroke(); }
    for (let i = 0; i < 8; i++) { const x = i * 64; const y = i % 2 ? 360 : 130; c.fillRect(x, y, 64, 1); }
  }, [2, 3]);
  const fabric = canvasTexture(256, (c, n, random) => {
    c.fillStyle = '#4e4936'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < n; i += 3) {
      c.strokeStyle = `rgba(18,20,12,${.12 + random() * .2})`; c.beginPath(); c.moveTo(i, 0); c.lineTo(i, n); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(n, i); c.stroke();
    }
  }, [2, 3]);
  const rug = canvasTexture(512, (c, n) => {
    c.fillStyle = '#3e2921'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 5; i++) { c.strokeStyle = i % 2 ? '#80704d' : '#342e24'; c.lineWidth = 5; c.strokeRect(15 + i * 13, 15 + i * 13, n - 30 - i * 26, n - 30 - i * 26); }
    c.strokeStyle = '#6d5e3f'; c.lineWidth = 2;
    for (let y = 110; y < 440; y += 60) for (let x = 110; x < 440; x += 60) {
      c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 20, y); c.lineTo(x, y + 20); c.lineTo(x - 20, y); c.closePath(); c.stroke();
    }
  });
  return { wallpaper, wood, fabric, rug };
}
export function labelTexture(lines, { background = '#a69b78', color = '#25281e', size = 512, font = 'serif', fontWeight = 'normal', fontSize = .065, lineSpacing = .12 } = {}) {
  return canvasTexture(size, (c, n) => {
    c.fillStyle = background; c.fillRect(0, 0, n, n);
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${fontWeight} ${Math.round(n * fontSize)}px ${font}`;
    lines.forEach((line, i) => c.fillText(line, n / 2, n * .5 + (i - (lines.length - 1) / 2) * n * lineSpacing, n * .84));
  });
}
export function createScreen() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
  const context = canvas.getContext('2d'); const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter;
  const random = randomGenerator(9312);
  function drawCount(presses, y, photo = false) {
    context.shadowBlur = 0;
    if (photo) { context.fillStyle = 'rgba(8,18,12,.9)'; context.fillRect(0, 438, 640, 42); }
    context.font = 'bold 28px monospace';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#d4dfc5';
    context.fillText(`YOUR PRESSES: ${presses.toLocaleString()}`, 320, y, 570);
  }
  return { texture, draw(t, message = ["DON'T PRESS", 'THE BUTTON'], { button = true, status = 'TAP TV TO START', presses = 0 } = {}) {
    context.fillStyle = '#111c19'; context.fillRect(0, 0, 640, 480);
    for (let y = 0; y < 480; y += 4) {
      context.fillStyle = `rgba(150,185,162,${.025 + random() * .08})`; context.fillRect(0, y, 640, 1);
    }
    context.fillStyle = '#d1dcc6'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = '30px monospace';
    message.forEach((line, i) => context.fillText(line, 320, (button ? 122 : 220) + i * 58, 550));
    drawCount(presses, button ? 224 : 374);
    if (button) {
      const { x, y, radius } = TV_BUTTON;
      context.shadowColor = '#d72c1b'; context.shadowBlur = 16 + Math.sin(t * 2) * 3;
      const red = context.createRadialGradient(x - 24, y - 28, 5, x, y, radius);
      red.addColorStop(0, '#d66c4f'); red.addColorStop(.44, '#b33224'); red.addColorStop(1, '#65140f');
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = red; context.fill();
      context.shadowBlur = 0; context.strokeStyle = '#e3a17a'; context.lineWidth = 3; context.stroke();
      context.fillStyle = '#fff0d9'; context.font = 'bold 27px monospace'; context.fillText('PRESS', x, y + 2);
      context.fillStyle = '#abbca5'; context.font = '18px monospace'; context.fillText(status, 320, 449, 560);
    }
    context.fillStyle = `rgba(149,170,151,${.04 + Math.sin(t * 4) * .02})`;
    context.fillRect(0, (t * 45) % 480, 640, 28); texture.needsUpdate = true;
  }, drawPhoto(image, presses) {
    context.shadowBlur = 0; context.drawImage(image, 0, 0, 640, 480);
    drawCount(presses, 460, true); texture.needsUpdate = true;
  } };
}
