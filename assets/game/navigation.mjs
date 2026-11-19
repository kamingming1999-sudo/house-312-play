import { canStand, OBSTACLES } from './core.mjs?v=showhome23';

const CELL = .16;
const MIN_X = -4.2, MIN_Z = -4.4;
const COLS = Math.floor(8.4 / CELL) + 1;
const ROWS = Math.floor(15.95 / CELL) + 1;
const CONNECT_RADIUS = CELL * 2.25;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const grids = new Map();
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);

// canStand is a union of axis-aligned areas. Checking between all its boundary
// crossings catches corner clips shorter than the regular sampling interval.
// Keep these area boundaries aligned with core.canStand; furniture comes from
// the shared obstacle list rather than a second copy of the furniture layout.
function collisionBoundaries(radius) {
  return {
    x: [2.32+radius, -4.15 + radius, 4.15 - radius, -.88 + radius, .88 - radius,
      -1.04 - radius, -1.2 - radius, -.6 + radius, -.76 + radius, .76 - radius,
      ...OBSTACLES.flatMap(o => [o.minX - radius, o.maxX + radius])],
    z: [3.70,6.31-radius,-4.4 + radius, 4.4 - radius, 4.05, 11.55 - radius, 5.8 + radius,
      8.95 - radius, 6.3 + radius, 7.9 - radius, 4.33 - radius,
      4.53 + radius, 4.395 - radius, 4.505 + radius,
      ...OBSTACLES.flatMap(o => [o.minZ - radius, o.maxZ + radius])],
  };
}
const bodyBoundaries = collisionBoundaries(.22);
const pointBoundaries = collisionBoundaries(0);

function clearSegment(from, to, doorOpen, radius = .22) {
  const steps = Math.max(1, Math.ceil(distance(from, to) / .035));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!canStand(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, doorOpen, radius)) return false;
  }
  const boundaries = radius === 0 ? pointBoundaries : bodyBoundaries;
  const crossings = [0, 1];
  for (const axis of ['x', 'z']) {
    const delta = to[axis] - from[axis];
    if (!delta) continue;
    for (const boundary of boundaries[axis]) {
      const t = (boundary - from[axis]) / delta;
      if (t > 0 && t < 1) crossings.push(t);
    }
  }
  crossings.sort((a, b) => a - b);
  for (let i = 1; i < crossings.length; i++) {
    const t = (crossings[i - 1] + crossings[i]) / 2;
    if (!canStand(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, doorOpen, radius)) return false;
  }
  return true;
}

function getGrid(doorOpen) {
  const key = Boolean(doorOpen);
  if (grids.has(key)) return grids.get(key);
  const points = Array.from({ length: COLS * ROWS }, (_, id) => ({ x: MIN_X + id % COLS * CELL, z: MIN_Z + Math.floor(id / COLS) * CELL }));
  const free = points.map(p => canStand(p.x, p.z, key));
  const edges = points.map(() => []);
  for (let id = 0; id < points.length; id++) {
    if (!free[id]) continue;
    const col = id % COLS, row = Math.floor(id / COLS);
    for (const [dx, dz] of DIRECTIONS) {
      const x = col + dx, z = row + dz, next = z * COLS + x;
      if (x < 0 || x >= COLS || z < 0 || z >= ROWS || !free[next]) continue;
      // Both orthogonal cells must be clear before taking a diagonal corner.
      if (dx && dz && (!free[row * COLS + x] || !free[z * COLS + col])) continue;
      if (clearSegment(points[id], points[next], key)) edges[id].push(next);
    }
  }
  const components = new Int16Array(points.length).fill(-1);
  let component = 0;
  for (let id = 0; id < points.length; id++) {
    if (!free[id] || components[id] !== -1) continue;
    const queue = [id]; components[id] = component;
    for (let head = 0; head < queue.length; head++) {
      for (const next of edges[queue[head]]) {
        if (components[next] !== -1) continue;
        components[next] = component; queue.push(next);
      }
    }
    component++;
  }
  const grid = { points, free, edges, components };
  grids.set(key, grid);
  return grid;
}

function nearby(grid, point, radius) {
  const ids = [];
  const minCol = Math.max(0, Math.ceil((point.x - radius - MIN_X) / CELL));
  const maxCol = Math.min(COLS - 1, Math.floor((point.x + radius - MIN_X) / CELL));
  const minRow = Math.max(0, Math.ceil((point.z - radius - MIN_Z) / CELL));
  const maxRow = Math.min(ROWS - 1, Math.floor((point.z + radius - MIN_Z) / CELL));
  for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
    const id = row * COLS + col;
    if (grid.free[id] && distance(grid.points[id], point) <= radius + 1e-9) ids.push(id);
  }
  return ids;
}

// A small binary heap keeps long hall/kitchen routes inexpensive on phones.
function push(heap, entry) {
  let index = heap.length; heap.push(entry);
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (heap[parent].score <= entry.score) break;
    heap[index] = heap[parent]; index = parent;
  }
  heap[index] = entry;
}
function pop(heap) {
  const first = heap[0], last = heap.pop();
  if (heap.length) {
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
      if (last.score <= heap[child].score) break;
      heap[index] = heap[child]; index = child;
    }
    heap[index] = last;
  }
  return first;
}

function smooth(start, path, doorOpen) {
  const result = [];
  let anchor = start, index = 0;
  while (index < path.length) {
    let next = path.length - 1;
    while (next > index && !clearSegment(anchor, path[next], doorOpen)) next--;
    result.push({ ...path[next] }); anchor = path[next]; index = next + 1;
  }
  return result;
}

function stopShort(start, path, stopDistance) {
  if (!path.length || stopDistance <= 0) return path;
  const goal = path[path.length - 1];
  if (distance(start, goal) <= stopDistance) return [];
  const result = [];
  let from = start;
  for (const to of path) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const ox = from.x - goal.x, oz = from.z - goal.z;
    const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz);
    const c = ox * ox + oz * oz - stopDistance * stopDistance;
    const discriminant = b * b - 4 * a * c;
    if (a > 0 && discriminant >= 0) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= 0 && t <= 1) {
        result.push({ x: from.x + dx * t, z: from.z + dz * t });
        return result;
      }
    }
    result.push(to); from = to;
  }
  return result;
}

/**
 * Returns fresh collision-free waypoints, excluding start; [] means no route or
 * already arrived. Valid goals must be reachable exactly. A floor point too close
 * to a solid edge may snap up to maxSnapDistance (.65 m), without crossing solid
 * geometry. Points inside solid furniture or outside the floor never snap.
 * stopDistance (metres) trims the route at its first entry into a circle around
 * the resolved destination; the full destination must still be reachable.
 */
export function findPath(start, goal, doorOpen, { stopDistance = 0, maxSnapDistance = .65 } = {}) {
  if (!finitePoint(start) || !finitePoint(goal) || !canStand(start.x, start.z, doorOpen)) return [];
  stopDistance = Number.isFinite(stopDistance) ? Math.max(0, stopDistance) : 0;
  maxSnapDistance = Number.isFinite(maxSnapDistance) ? Math.max(0, Math.min(.65, maxSnapDistance)) : .65;
  let target = { x: goal.x, z: goal.z };
  const validGoal = canStand(target.x, target.z, doorOpen);
  if (validGoal && clearSegment(start, target, doorOpen)) {
    return distance(start, target) <= 1e-6 ? [] : stopShort(start, [target], stopDistance);
  }
  if (!validGoal && (!maxSnapDistance || !canStand(target.x, target.z, doorOpen, 0))) return [];
  const grid = getGrid(doorOpen);
  const starts = nearby(grid, start, CONNECT_RADIUS).filter(id => clearSegment(start, grid.points[id], doorOpen));
  if (!starts.length) return [];
  const reachable = new Set(starts.map(id => grid.components[id]));
  if (!validGoal) {
    const candidates = nearby(grid, target, maxSnapDistance)
      .filter(id => reachable.has(grid.components[id]) && clearSegment(grid.points[id], target, doorOpen, 0))
      .sort((a, b) => distance(grid.points[a], target) - distance(grid.points[b], target));
    if (!candidates.length) return [];
    const safe = grid.points[candidates[0]];
    // Refine the snapped point toward the floor tap instead of leaving a grid-size gap.
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) {
      const t = (lo + hi) / 2;
      const point = { x: safe.x + (target.x - safe.x) * t, z: safe.z + (target.z - safe.z) * t };
      if (clearSegment(safe, point, doorOpen)) lo = t;
      else hi = t;
    }
    target = { x: safe.x + (target.x - safe.x) * lo, z: safe.z + (target.z - safe.z) * lo };
  }
  const goals = new Set(nearby(grid, target, CONNECT_RADIUS)
    .filter(id => reachable.has(grid.components[id]) && clearSegment(grid.points[id], target, doorOpen)));
  if (!goals.size) return [];
  const costs = new Float64Array(grid.points.length).fill(Infinity);
  const parents = new Int32Array(grid.points.length).fill(-1);
  const heap = [];
  for (const id of starts) {
    costs[id] = distance(start, grid.points[id]);
    push(heap, { id, cost: costs[id], score: costs[id] + distance(grid.points[id], target) });
  }
  let best = -1, bestCost = Infinity;
  while (heap.length) {
    const current = pop(heap), id = current.id;
    if (current.cost !== costs[id]) continue;
    if (current.score >= bestCost) break;
    if (goals.has(id)) {
      best = id; bestCost = costs[id] + distance(grid.points[id], target);
    }
    for (const next of grid.edges[id]) {
      const cost = costs[id] + distance(grid.points[id], grid.points[next]);
      if (cost >= costs[next]) continue;
      costs[next] = cost; parents[next] = id;
      push(heap, { id: next, cost, score: cost + distance(grid.points[next], target) });
    }
  }
  if (best < 0) return [];
  const path = [];
  for (let id = best; id !== -1; id = parents[id]) path.push(grid.points[id]);
  path.reverse(); path.push(target);
  return stopShort(start, smooth(start, path, doorOpen), stopDistance);
}

/**
 * Moves position.x/z and consumes reached waypoints from path in place. Preserves
 * position.y. dt is seconds and speed is metres/second. Every travelled segment
 * is checked again against the current door state, including long frames.
 * Returns {done,moved,blocked}; a newly blocked/invalid path is cleared.
 */
export function stepPath(position, path, dt, doorOpen, speed = 1.5) {
  let moved = false;
  if (!Array.isArray(path)) return { done: true, moved, blocked: false };
  if (!finitePoint(position) || !canStand(position.x, position.z, doorOpen)) {
    path.length = 0; return { done: true, moved, blocked: true };
  }
  let budget = Number.isFinite(dt) && Number.isFinite(speed) ? Math.max(0, dt) * Math.max(0, speed) : 0;
  while (path.length) {
    const target = path[0];
    if (!finitePoint(target)) { path.length = 0; return { done: true, moved, blocked: true }; }
    const length = distance(position, target);
    if (length < 1e-6) { path.shift(); continue; }
    if (budget <= 0) break;
    const amount = Math.min(budget, length) / length;
    const next = { x: position.x + (target.x - position.x) * amount, z: position.z + (target.z - position.z) * amount };
    if (!clearSegment(position, next, doorOpen)) { path.length = 0; return { done: true, moved, blocked: true }; }
    position.x = next.x; position.z = next.z; moved = true;
    budget -= Math.min(budget, length);
    if (amount === 1) path.shift();
  }
  return { done: path.length === 0, moved, blocked: false };
}
