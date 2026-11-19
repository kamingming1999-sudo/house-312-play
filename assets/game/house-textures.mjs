import * as THREE from './vendor/three.module.js';
import { createTextures } from './textures.mjs?v=tvcount1';

export async function createHouseTextures() {
  const textures = createTextures();
  const loader = new THREE.TextureLoader();
  function prepare(texture, repeat = [1, 1]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat); texture.anisotropy = 4; return texture;
  }
  function canvasMap(draw, repeat = [1, 1]) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    draw(canvas.getContext('2d'));
    return prepare(new THREE.CanvasTexture(canvas), repeat);
  }
  const noise = n => (Math.sin(n * 127.1 + 19.7) * 43758.5453 % 1 + 1) % 1;
  // These quiet fallbacks keep the house usable while a photo asset is unavailable.
  // They deliberately avoid a regular high-contrast crosshatch on the upholstery.
  const fabricFallback = canvasMap(c => {
    c.fillStyle = '#817767'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 19000; i++) {
      c.fillStyle = i % 2 ? '#e1dacb16' : '#27251e15';
      c.fillRect(noise(i) * 512, noise(i + 40000) * 512, .5 + noise(i + 2) * 2, 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = noise(i + 30) * 512, y = noise(i + 70) * 512;
      const stain = c.createRadialGradient(x, y, 0, x, y, 20 + noise(i + 400) * 70);
      stain.addColorStop(0, '#29271d15'); stain.addColorStop(1, '#29271d00');
      c.fillStyle = stain; c.fillRect(0, 0, 512, 512);
    }
  }, [1, 1.5]);
  const brickFallback = canvasMap(c => {
    c.fillStyle = '#827768'; c.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) for (let column = -1; column < 5; column++) {
      const n = noise(row * 51 + column * 77);
      c.fillStyle = `rgb(${105 + n * 40},${75 + n * 24},${55 + n * 19})`;
      c.fillRect(column * 128 + row % 2 * 64 + 3, row * 64 + 3, 122, 58);
    }
    for (let i = 0; i < 16000; i++) {
      c.fillStyle = i % 2 ? '#ffffff0d' : '#00000016'; c.fillRect(noise(i) * 512, noise(i + 500) * 512, 2, 2);
    }
  });
  const names = ['wallpaper', 'floor', 'fabric', 'brick'];
  const assets = ['house-wallpaper-v1.webp', 'house-floor-v1.webp', 'house-upholstery-v2.webp', 'house-brick-v2.webp'];
  const [loaded, kitchenArtwork] = await Promise.all([
    Promise.allSettled(assets.map(asset => loader.loadAsync(`assets/game/${asset}`))),
    loader.loadAsync('assets/game/kitchen-scream.png').catch(() => null),
  ]);
  if (kitchenArtwork) {
    kitchenArtwork.colorSpace = THREE.SRGBColorSpace;
    kitchenArtwork.anisotropy = 4;
    textures.kitchenArtwork = kitchenArtwork;
  }
  const fallback = [textures.wallpaper, textures.wood, fabricFallback, brickFallback];
  const repeats = [[3, 1], [4, 4.2], [1, 1.5], [1.35, 1.35]];
  loaded.forEach((result, i) => { textures[names[i]] = prepare(result.status === 'fulfilled' ? result.value : fallback[i], repeats[i]); });
  textures.wood = prepare(textures.floor.clone(), [1, 1]);
  // Bump inputs stay linear; reusing an sRGB color map here exaggerates contrast.
  for (const [bump, source] of [['wallBump', 'wallpaper'], ['woodBump', 'wood'], ['floorBump', 'floor'], ['fabricBump', 'fabric'], ['brickBump', 'brick']]) {
    textures[bump] = textures[source].clone(); textures[bump].colorSpace = THREE.NoColorSpace;
  }
  textures.window = canvasMap(c => {
    const sky = c.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#253b45'); sky.addColorStop(1, '#101a19');
    c.fillStyle = sky; c.fillRect(0, 0, 512, 512); c.strokeStyle = '#090f0f';
    for (let i = 0; i < 14; i++) {
      const x = (i * 137) % 512; c.lineWidth = 3 + i % 7;
      c.beginPath(); c.moveTo(x, 512); c.lineTo(x + 25, 150 - i * 9); c.stroke();
      for (let b = 0; b < 4; b++) { c.beginPath(); c.moveTo(x + 12, 180 + b * 65); c.lineTo(x + (b % 2 ? -60 : 80), 90 + b * 65); c.stroke(); }
    }
    c.lineWidth = 1;
    for (let i = 0; i < 120; i++) {
      const x = i * 193 % 512, y = i * 71 % 512; c.strokeStyle = '#b6d3cb2d';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 10 + i % 20); c.stroke();
    }
    const haze = c.createLinearGradient(0, 0, 0, 512); haze.addColorStop(0, '#adbaa211'); haze.addColorStop(.65, '#78867d00'); haze.addColorStop(1, '#17221e8a');
    c.fillStyle = haze; c.fillRect(0, 0, 512, 512);
  });
  textures.grime = canvasMap(c => {
    for (let i = 0; i < 70; i++) {
      const x = noise(i) * 512, radius = 14 + noise(i + 90) * 90;
      const stain = c.createRadialGradient(x, 505, 0, x, 505, radius);
      stain.addColorStop(0, '#211e17a3'); stain.addColorStop(.6, '#322d203d'); stain.addColorStop(1, '#322d2000');
      c.fillStyle = stain; c.fillRect(x - radius, 505 - radius, radius * 2, radius * 2);
      if (i % 3 === 0) { c.strokeStyle = '#25251c18'; c.lineWidth = 1 + noise(i) * 3; c.beginPath(); c.moveTo(x, 490); c.lineTo(x + 3, 260 + noise(i + 100) * 170); c.stroke(); }
    }
  });
  textures.rain = canvasMap(c => {
    for (let i = 0; i < 95; i++) {
      const x = noise(i) * 512, y = noise(i + 300) * 512;
      c.strokeStyle = `rgba(183,210,211,${.07 + noise(i + 50) * .2})`; c.lineWidth = .7 + noise(i + 60);
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - 1, y + 8, x + 2, y + 14, x - 2, y + 22 + noise(i) * 25); c.stroke();
    }
  });
  // A water-damaged landscape print is almost erased behind its dusty glass.
  textures.landscape = canvasMap(c => {
    c.fillStyle = '#8d8b75'; c.fillRect(0, 0, 512, 512);
    const mist = c.createLinearGradient(0, 0, 0, 512); mist.addColorStop(0, '#b4b09a'); mist.addColorStop(1, '#676c5d');
    c.fillStyle = mist; c.fillRect(12, 12, 488, 488);
    c.fillStyle = '#5a6054'; c.beginPath(); c.moveTo(0, 324); c.lineTo(95, 274); c.lineTo(185, 308); c.lineTo(316, 238); c.lineTo(512, 321); c.lineTo(512, 512); c.lineTo(0, 512); c.fill();
    c.fillStyle = '#51564a'; c.fillRect(294, 299, 93, 68); c.beginPath(); c.moveTo(278, 299); c.lineTo(341, 255); c.lineTo(402, 299); c.fill();
    c.fillStyle = '#92917b'; c.fillRect(327, 321, 16, 46);
    for (let i = 0; i < 5000; i++) { c.fillStyle = i % 3 ? '#c2baa414' : '#20251c0a'; c.fillRect(noise(i) * 512, noise(i + 5000) * 512, 2, 2); }
    const water = c.createRadialGradient(32, 460, 10, 32, 460, 420); water.addColorStop(0, '#3d3b2875'); water.addColorStop(1, '#3d3b2800'); c.fillStyle = water; c.fillRect(0, 0, 512, 512);
  });
  return textures;
}
