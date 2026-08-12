import { registerBlockBreakListener } from "./modules/block-break-listener.js";
import { classifyTreeBlock } from "./modules/tree-block-classifier.js";
import { findConnectedTreeBlocks, TREE_SEARCH_LIMITS } from "./modules/connected-tree-finder.js";
import { chopConnectedTreeBlocks } from "./modules/connected-tree-chopper.js";
import { setDebug as setTreeBreakerDebug } from "./modules/tree-breaker.js";

// Enable debug logs on first run to help diagnose runtime API shapes and drops
setTreeBreakerDebug(true);

function handleBlockBroken(data) {
  const { player, location, dimension } = data;

  const treeBlockCategory = classifyTreeBlock(data.blockPermutation);

  if (treeBlockCategory === "none") {
    return;
  }

  const connectedTreeBlocks = findConnectedTreeBlocks(location, dimension, {
    maxBlocks: TREE_SEARCH_LIMITS.maxBlocks,
    maxDistance: TREE_SEARCH_LIMITS.maxDistance
  });

  player.sendMessage(
    `§aTree block detected: §e${treeBlockCategory} §7(${connectedTreeBlocks.length} connected blocks)`
  );

  // Start chopping job using conservative defaults. The module will batch the work across ticks.
  chopConnectedTreeBlocks(player, connectedTreeBlocks, dimension, {
    tool: data.tool,
    maxBlocks: TREE_SEARCH_LIMITS.maxBlocks,
    maxDistance: TREE_SEARCH_LIMITS.maxDistance,
    batchSize: 24,
    // Basic permission hook — customize to check region protection / player perms
    canBreakBlock: (player, loc) => true,
    // Use module's defaultBreakBlock by omitting breakBlock, or provide a custom breaker here.
    onBreak: (player, loc, ok) => {
      // optional: play particle/sound or track drops; left empty to keep simple
    },
    onComplete: (job) => {
      const count = job.progress ?? 0;
      try { job.player.sendMessage(`§aTree chopped: §e${count} §ablocks`); } catch (e) { console.error(e); }
    },
    onAbort: (job, reason) => {
      try { job.player.sendMessage(`§cTree chop aborted: ${reason}`); } catch (e) { console.error(e); }
    }
  });
}

registerBlockBreakListener(handleBlockBroken);