import { registerBlockBreakListener } from "./modules/block-break-listener.js";
import { classifyTreeBlock } from "./modules/tree-block-classifier.js";
import { findConnectedTreeBlocks, TREE_SEARCH_LIMITS } from "./modules/connected-tree-finder.js";

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
}

registerBlockBreakListener(handleBlockBroken);