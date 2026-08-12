// Helpers for dropping items and fast leaf cleanup

// Debug flag (toggle at runtime with setDebug(true))
export let DEBUG = false;
export function setDebug(value) { DEBUG = !!value; }

// Heuristic to attempt to produce a matching sapling item id from a leaves block id
function guessSaplingIdFromLeaves(blockId) {
  if (!blockId) return null;
  // common pattern: minecraft:oak_leaves -> minecraft:oak_sapling
  if (blockId.includes('leaves')) return blockId.replace('leaves', 'sapling');
  if (blockId.includes('_leaves')) return blockId.replace('_leaves', '_sapling');
  return null;
}

function rand() {
  return Math.random();
}

// Best-effort spawn/give items for a blockPermutation
export function giveDropsForBlock(player, dimension, blockPerm, amount = 1) {
  try {
    const blockTypeId = blockPerm?.type?.id ?? null;
    if (!blockTypeId) return false;

    if (DEBUG) console.log(`giveDropsForBlock: blockTypeId=${blockTypeId}, hasGetDrops=${typeof blockPerm.getDrops === 'function'}`);

    // try to use a "loot" or block drop API if present on permutation
    if (typeof blockPerm.getDrops === 'function') {
      try {
        const drops = blockPerm.getDrops();
        if (DEBUG) console.log('giveDropsForBlock: drops from getDrops=', drops);
        for (const drop of drops) {
          // drop could be item identifier or ItemStack-like; best-effort: give to player via command
          const itemId = typeof drop === 'string' ? drop : drop.id ?? drop.itemId;
          if (dimension && typeof dimension.runCommand === 'function' && player && player.name) {
            try {
              if (DEBUG) console.log(`giveDropsForBlock: giving ${itemId} x${amount} to ${player.name}`);
              dimension.runCommand(`give "${player.name}" ${itemId} ${amount}`);
            } catch (e) { console.warn(e); }
          }
        }
        return true;
      } catch (e) {
        if (DEBUG) console.warn('giveDropsForBlock: perm.getDrops failed', e);
        // fall through to give heuristic
      }
    }

    // fallback: give the block's own item id to the player
    if (dimension && typeof dimension.runCommand === 'function' && player && player.name) {
      try {
        if (DEBUG) console.log(`giveDropsForBlock: fallback give ${blockTypeId} x${amount} to ${player.name}`);
        dimension.runCommand(`give "${player.name}" ${blockTypeId} ${amount}`);
        return true;
      } catch (e) {
        console.warn('give command failed:', e);
      }
    }

    // last resort: try to spawn item entity at block location if dimension.spawnItem exists (not guaranteed)
  } catch (e) {
    console.warn('giveDropsForBlock error:', e);
  }

  return false;
}

// Conservative default breaker: try to run a setblock command if supported, or call block-level destroy/break methods when available.
// Returns true on success. This is best-effort — to get correct drops/durability you should provide a custom `breakBlock` option.
export function defaultBreakBlock(player, dimension, location) {
  if (DEBUG) console.log('defaultBreakBlock: location=', location);

  try {
    if (!dimension || !location) {
      return false;
    }

    if (typeof dimension.getBlock === 'function') {
      const block = dimension.getBlock(location);
      if (block) {
        if (DEBUG) console.log('defaultBreakBlock: trying block-level API');
        if (typeof block.break === 'function') {
          try {
            block.break();
            return true;
          } catch (e) {
            console.warn('defaultBreakBlock block.break failed:', e);
          }
        }

        if (typeof block.destroy === 'function') {
          try {
            block.destroy();
            return true;
          } catch (e) {
            console.warn('defaultBreakBlock block.destroy failed:', e);
          }
        }
      }
    }

    if (typeof dimension.runCommand === 'function') {
      const cmd = `setblock ${location.x} ${location.y} ${location.z} air 0 replace`;
      try {
        if (DEBUG) console.log('defaultBreakBlock: running command ->', cmd);
        dimension.runCommand(cmd);
        return true;
      } catch (cmdErr) {
        console.warn('defaultBreakBlock runCommand failed:', cmdErr);
      }
    }
  } catch (e) {
    console.warn('defaultBreakBlock error:', e);
  }

  return false;
}

// Remove nearby leaves fast and spawn drops similar to vanilla
export function performLeafCleanup(player, dimension, origin, options = {}) {
  const maxDistance = options.maxDistance ?? 32;
  const batchSize = options.batchSize ?? 64;
  const maxLeaves = options.maxLeaves ?? 1024;

  if (DEBUG) console.log(`performLeafCleanup: origin=${origin.x},${origin.y},${origin.z} maxDistance=${maxDistance} batchSize=${batchSize}`);

  const visited = new Set();
  const queue = [ { x: origin.x, y: origin.y, z: origin.z } ];
  const leaves = [];

  while (queue.length > 0 && leaves.length < maxLeaves) {
    const cur = queue.shift();
    const key = `${Math.floor(cur.x)}:${Math.floor(cur.y)}:${Math.floor(cur.z)}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const dx = cur.x - origin.x;
    const dy = cur.y - origin.y;
    const dz = cur.z - origin.z;
    if (dx*dx + dy*dy + dz*dz > maxDistance*maxDistance) continue;

    let block;
    try {
      if (typeof dimension.getBlock === 'function') {
        block = dimension.getBlock(cur);
      }
    } catch (e) {
      continue;
    }

    const perm = block?.permutation ?? block?.blockPermutation ?? null;
    if (perm && typeof perm.hasTag === 'function' && perm.hasTag('leaves')) {
      if (DEBUG) console.log(`performLeafCleanup: found leaf at ${cur.x},${cur.y},${cur.z} id=${perm?.type?.id}`);
      leaves.push({ loc: { x: Math.floor(cur.x), y: Math.floor(cur.y), z: Math.floor(cur.z) }, perm });
    }

    // expand neighbors (within a cube) to catch leaf clusters
    const neighbors = [
      { x: cur.x+1, y: cur.y, z: cur.z }, { x: cur.x-1, y: cur.y, z: cur.z },
      { x: cur.x, y: cur.y+1, z: cur.z }, { x: cur.x, y: cur.y-1, z: cur.z },
      { x: cur.x, y: cur.y, z: cur.z+1 }, { x: cur.x, y: cur.y, z: cur.z-1 }
    ];

    for (const n of neighbors) queue.push(n);
  }

  if (DEBUG) console.log(`performLeafCleanup: collected ${leaves.length} leaves`);

  // Process leaves in batches quickly
  let processed = 0;
  while (leaves.length > 0 && processed < maxLeaves) {
    const batch = leaves.splice(0, batchSize);
    for (const leaf of batch) {
      const loc = leaf.loc;
      const perm = leaf.perm;

      // Drop logic similar to vanilla — best-effort heuristics
      // Sapling chance ~5% (0.05), stick chance ~2% (0.02)
      const saplingChance = 0.05;
      const stickChance = 0.02;

      // Guess sapling id
      const blockTypeId = perm?.type?.id ?? null;
      const saplingId = guessSaplingIdFromLeaves(blockTypeId) ?? 'minecraft:oak_sapling';

      // Attempt sapling drop
      if (rand() < saplingChance) {
        if (DEBUG) console.log(`performLeafCleanup: dropping sapling ${saplingId} at ${loc.x},${loc.y},${loc.z}`);
        giveDropsForBlock(player, dimension, { type: { id: saplingId } }, 1);
      }

      // Attempt stick drop
      if (rand() < stickChance) {
        if (dimension && typeof dimension.runCommand === 'function' && player && player.name) {
          if (DEBUG) console.log(`performLeafCleanup: dropping stick to ${player.name}`);
          try { dimension.runCommand(`give "${player.name}" minecraft:stick 1`); } catch (e) { console.warn(e); }
        }
      }

      // Remove the leaf block quickly
      try {
        if (dimension && typeof dimension.runCommand === 'function') {
          if (DEBUG) console.log(`performLeafCleanup: removing leaf at ${loc.x},${loc.y},${loc.z} via setblock`);
          dimension.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air 0 replace`);
        } else if (typeof dimension.getBlock === 'function') {
          const b = dimension.getBlock(loc);
          if (b && typeof b.destroy === 'function') {
            if (DEBUG) console.log('performLeafCleanup: removing leaf via destroy()');
            b.destroy();
          } else if (b && typeof b.break === 'function') {
            if (DEBUG) console.log('performLeafCleanup: removing leaf via break()');
            b.break();
          }
        }
      } catch (e) {
        console.warn('failed to remove leaf block:', e);
      }

      processed += 1;
      if (processed >= maxLeaves) break;
    }
  }

  if (DEBUG) console.log(`performLeafCleanup: processed ${processed} leaves`);
}
