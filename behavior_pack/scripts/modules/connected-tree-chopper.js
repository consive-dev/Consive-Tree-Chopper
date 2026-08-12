import { world } from "@minecraft/server";

// Defaults for chopping to avoid server lag and abuse
export const TREE_CHOP_LIMITS = Object.freeze({
  // how many blocks to break total
  maxBlocks: 256,
  // how many blocks to attempt per tick
  batchSize: 24,
  // maximum euclidean distance from origin
  maxDistance: 32
});

// Processing queue shared in module. Each job: { id, player, dimension, queue: [{x,y,z,category}], options, progress }
const activeJobs = new Map();
let tickSubscription = null;

function startTickProcessor() {
  if (tickSubscription) return;

  tickSubscription = world.events.tick.subscribe(() => {
    if (activeJobs.size === 0) return;

    for (const [jobId, job] of activeJobs) {
      const { queue, options } = job;
      if (!queue || queue.length === 0) {
        // finish job
        try { options.onComplete?.(job); } catch (e) { console.error(e); }
        activeJobs.delete(jobId);
        continue;
      }

      const batchSize = options.batchSize ?? TREE_CHOP_LIMITS.batchSize;
      const toProcess = Math.min(batchSize, queue.length);

      for (let i = 0; i < toProcess; i += 1) {
        const target = queue.shift();
        try {
          if (options.canBreakBlock && !options.canBreakBlock(job.player, target)) {
            // skip this block (permission/protection)
            job.progress = (job.progress ?? 0) + 1;
            continue;
          }

          const ok = options.breakBlock
            ? options.breakBlock(job.player, job.dimension, target)
            : defaultBreakBlock(job.player, job.dimension, target);

          try { options.onBreak?.(job.player, target, ok); } catch (e) { console.error(e); }
        } catch (err) {
          console.error("Error breaking block:", err);
        } finally {
          // Count this attempt (broken or skipped)
          job.progress = (job.progress ?? 0) + 1;
        }
      }

      // if job exceeded maxBlocks safety, abort remaining
      if (job.progress !== undefined && job.progress >= (options.maxBlocks ?? TREE_CHOP_LIMITS.maxBlocks)) {
        try { options.onAbort?.(job, 'maxBlocksReached'); } catch (e) { console.error(e); }
        activeJobs.delete(jobId);
      }
    }
  });
}

function stopTickProcessorIfIdle() {
  if (activeJobs.size === 0 && tickSubscription) {
    world.events.tick.unsubscribe(tickSubscription);
    tickSubscription = null;
  }
}

// Conservative default breaker: try to run a setblock command if supported, or call block-level destroy/break methods when available.
// Returns true on success. This is best-effort — to get correct drops/durability you should provide a custom `breakBlock` option.
function defaultBreakBlock(player, dimension, location) {
  try {
    // Prefer using the command API if available (many runtimes expose runCommand)
    if (dimension && typeof dimension.runCommand === 'function') {
      const cmd = `setblock ${location.x} ${location.y} ${location.z} air 0 replace`;
      try {
        dimension.runCommand(cmd);
      } catch (cmdErr) {
        // Some runtimes may throw; continue to try block API
        console.warn("defaultBreakBlock runCommand failed:", cmdErr);
      }

      // Try to invoke block-level API afterwards to allow engine to process drops if such an API exists
      try {
        if (typeof dimension.getBlock === 'function') {
          const block = dimension.getBlock(location);
          if (block) {
            if (typeof block.break === 'function') {
              block.break();
              return true;
            }
            if (typeof block.destroy === 'function') {
              block.destroy();
              return true;
            }
            // Some implementations expose setPermutation or setType — avoid forcing these since they don't drop items
          }
        }
      } catch (e) {
        // ignore and consider the setblock above as success
      }

      // If we reached here, at least setblock was attempted
      return true;
    }
  } catch (e) {
    console.warn("defaultBreakBlock error:", e);
  }

  // If command API not present, try block-level API directly
  try {
    if (typeof dimension.getBlock === 'function') {
      const block = dimension.getBlock(location);
      if (block) {
        if (typeof block.break === 'function') {
          block.break();
          return true;
        }
        if (typeof block.destroy === 'function') {
          block.destroy();
          return true;
        }
      }
    }
  } catch (e) {
    console.warn("defaultBreakBlock block API failed:", e);
  }

  // No safe mechanism found to break-and-drop; return false so caller may fallback or handle drops separately.
  return false;
}

// Export defaultBreakBlock so callers (main.js) can reuse the module's best-effort breaker if desired
export { defaultBreakBlock };

// Utility: euclidean distance squared
function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// Public API
// - player: player who initiated chop (can be used for permissions/messages)
// - connectedBlocks: array of {x,y,z,category} as returned by findConnectedTreeBlocks
// - dimension: Dimension object
// - options: {
//     maxBlocks, batchSize, maxDistance, canBreakBlock(player, loc) => boolean,
//     breakBlock(player, dimension, loc) => boolean, onBreak(player, loc, ok), onComplete(job), onAbort(job, reason)
// }
// Returns: jobId string
export function chopConnectedTreeBlocks(player, connectedBlocks, dimension, options = {}) {
  // basic validation
  if (!player) throw new Error("player is required");
  if (!dimension) throw new Error("dimension is required");
  if (!Array.isArray(connectedBlocks) || connectedBlocks.length === 0) return null;

  const maxBlocks = options.maxBlocks ?? TREE_CHOP_LIMITS.maxBlocks;
  const maxDistance = options.maxDistance ?? TREE_CHOP_LIMITS.maxDistance;

  // origin is the first block (usually the broken block)
  const origin = { x: Math.floor(connectedBlocks[0].x), y: Math.floor(connectedBlocks[0].y), z: Math.floor(connectedBlocks[0].z) };

  // filter and cap blocks by euclidean distance and maxBlocks
  const allowed = [];
  for (const b of connectedBlocks) {
    if (!b || typeof b.x !== 'number') continue;
    const loc = { x: Math.floor(b.x), y: Math.floor(b.y), z: Math.floor(b.z) };
    if (distanceSq(origin, loc) > maxDistance * maxDistance) continue;
    allowed.push({ x: loc.x, y: loc.y, z: loc.z, category: b.category });
    if (allowed.length >= maxBlocks) break;
  }

  if (allowed.length === 0) return null;

  const jobId = `${player.name ?? player.id ?? 'player'}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
  const job = {
    id: jobId,
    player,
    dimension,
    queue: allowed,
    options: {
      maxBlocks,
      batchSize: options.batchSize ?? TREE_CHOP_LIMITS.batchSize,
      maxDistance,
      canBreakBlock: options.canBreakBlock,
      breakBlock: options.breakBlock,
      onBreak: options.onBreak,
      onComplete: options.onComplete,
      onAbort: options.onAbort
    },
    progress: 0
  };

  activeJobs.set(jobId, job);
  startTickProcessor();

  return jobId;
}

export function cancelChopJob(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return false;
  activeJobs.delete(jobId);
  stopTickProcessorIfIdle();
  return true;
}

export function listActiveChopJobs() {
  return Array.from(activeJobs.values()).map((j) => ({ id: j.id, playerName: j.player?.name, remaining: j.queue.length }));
}
