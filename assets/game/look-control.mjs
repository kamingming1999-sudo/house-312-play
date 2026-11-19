const LIMIT = 1.05, DAMPING = 24, EPSILON = 1e-5;
const clampPitch = value => Math.max(-LIMIT, Math.min(LIMIT, value));
const wrap = value => Math.atan2(Math.sin(value), Math.cos(value));
const finite = Number.isFinite;

/** Pure target smoothing: no DOM, velocity, or extrapolated angular momentum.
 * add() accepts pixel deltas plus the current camera yaw/pitch. Pass start:true
 * on the first meaningful drag to discard a previous gesture/scripted target.
 * step() consumes seconds and returns the next yaw/pitch and pending active flag.
 * cancel(yaw,pitch) drops pending movement; reset/cancel callers supply the camera.
 */
export function createLookControl() {
  let targetYaw = 0, targetPitch = 0, ready = false, pending = false;

  function cancel(yaw, pitch) {
    ready = finite(yaw) && finite(pitch);
    targetYaw = ready ? wrap(yaw) : 0;
    targetPitch = ready ? clampPitch(pitch) : 0;
    pending = false;
  }

  function add(dx, dy, options = {}) {
    options ||= {};
    const { yaw, pitch } = options;
    if (!finite(dx) || !finite(dy) || !finite(yaw) || !finite(pitch)) return false;
    if (options.start || !ready || !pending) cancel(yaw, pitch);
    if (dx === 0 && dy === 0) return false;
    const width = finite(options.width) ? Math.max(320, options.width) : 320;
    const height = finite(options.height) ? Math.max(390, options.height) : 390;
    const horizontal = options.touch === true ? 2.2 / width : .0024;
    const vertical = options.touch === true ? 1.5 / height : .0024;
    targetYaw = wrap(targetYaw - dx * horizontal);
    targetPitch = clampPitch(targetPitch - dy * vertical);
    pending = Math.abs(wrap(targetYaw - yaw)) > EPSILON || Math.abs(targetPitch - pitch) > EPSILON;
    return true;
  }

  function step(dt, current = {}) {
    current ||= {};
    const yaw = finite(current.yaw) ? current.yaw : 0;
    const pitch = finite(current.pitch) ? current.pitch : 0;
    if (!finite(current.yaw) || !finite(current.pitch)) {
      cancel(yaw, pitch);
      return { yaw, pitch, active: false };
    }
    if (!ready || !pending || !finite(dt) || dt <= 0) return { yaw, pitch, active: pending };
    const amount = -Math.expm1(-DAMPING * Math.min(dt, .1));
    let nextYaw = wrap(yaw + wrap(targetYaw - yaw) * amount);
    let nextPitch = clampPitch(pitch + (targetPitch - pitch) * amount);
    pending = Math.abs(wrap(targetYaw - nextYaw)) > EPSILON || Math.abs(targetPitch - nextPitch) > EPSILON;
    if (!pending) { nextYaw = targetYaw; nextPitch = targetPitch; }
    return { yaw: nextYaw, pitch: nextPitch, active: pending };
  }

  return { add, step, cancel };
}
