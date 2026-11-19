import * as THREE from './vendor/three.module.js';

// A strike starts on an outward sweep of the hand. The held gaze moves the
// first strike forward on the same clock as the occasional distant squalls.
export function createCourtyardStorm(group, skyTexture) {
  const light = new THREE.PointLight(0xc4d8ff, 0, 9, 2);
  light.name = 'Lightning across the opposite facade';
  light.position.set(-3.1, 5.55, -8.15);
  group.add(light);

  const plate = new THREE.MeshBasicMaterial({
    map: skyTexture, color: 0xffffff, fog: false, transparent: true, opacity: 0, depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(22, 14.7), plate);
  sky.name = 'Storm clouds beyond the roofline';
  sky.position.set(.25, 12, -18.2);
  sky.raycast = () => {};
  group.add(sky);

  // The dark glass immediately beside her catches a cropped, dim reflection.
  // The pane sits behind its stone jambs and physical centre bar.
  const reflectionMaterial = plate.clone();
  reflectionMaterial.color.setHex(0xabc6e1);
  const reflection = new THREE.Mesh(new THREE.PlaneGeometry(.85, 1.27), reflectionMaterial);
  reflection.name = 'Storm reflected in upstairs glass';
  reflection.position.set(-3.18, 4.18, -11.456);
  const uv = reflection.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, .82 - .53 * uv.getX(i), .12 + .79 * uv.getY(i));
  reflection.raycast = () => {};
  group.add(reflection);

  const intervals = [11.7, 15.3, 9.6, 17.2];
  const peaks = [.90, .61, 1, .72];
  let clock, nextStrike, lastStrike, thunderAt, count, peak, level, noticed;
  function illuminate(power) {
    level = power;
    light.intensity = power * 134;
    sky.visible = reflection.visible = Boolean(skyTexture) && power > .003;
    plate.opacity = Math.min(1, power * 1.15);
    reflectionMaterial.opacity = power * .70;
  }
  function reset() {
    clock = 0; nextStrike = 5.8; lastStrike = thunderAt = -Infinity;
    count = 0; peak = 0; noticed = false;
    illuminate(0);
  }
  function cueNextWave() {
    nextStrike = Math.max(lastStrike + 2.5, Math.min(nextStrike, clock + .06));
  }
  function advance(dt, weather, reducedMotion) {
    if (!weather) {
      if (clock || level) reset();
      return 0;
    }
    clock += dt;
    if (!noticed && weather.stare >= .38) {
      noticed = true;
      cueNextWave();
    }
    if (clock >= nextStrike && !weather.behind &&
        (weather.angle >= .13 || !weather.womanVisible || reducedMotion)) {
      lastStrike = clock;
      const side = count % 2 ? -1 : 1;
      sky.scale.x = reflection.scale.x = side;
      sky.position.x = .25 + Math.sin(count * 1.85) * 2.2;
      peak = peaks[count % peaks.length];
      nextStrike = clock + intervals[count % intervals.length];
      thunderAt = clock + 1.07 + (1 - peak) * 1.65;
      count++;
    }
    const age = clock - lastStrike;
    // One blue-white exposure with a short attack and a soft cloud afterglow.
    const pulse = THREE.MathUtils.smoothstep(age, 0, .105) * (1 - THREE.MathUtils.smoothstep(age, .19, 1.03));
    illuminate(reducedMotion ? 0 : peak * pulse);
    if (thunderAt !== -Infinity && clock >= thunderAt) {
      thunderAt = -Infinity;
      return peak;
    }
    return 0;
  }
  reset();
  return {advance, reset, cueNextWave, get level() { return level; }};
}
