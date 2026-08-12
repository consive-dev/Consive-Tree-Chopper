import { registerBlockBreakListener } from "./modules/block-break-listener.js";
import { classifyTreeBlock } from "./modules/tree-block-classifier.js";

function handleBlockBroken(data) {
  const { player } = data;

  const treeBlockCategory = classifyTreeBlock(data.blockPermutation);

  if (treeBlockCategory === "none") {
    return;
  }

  player.sendMessage(`§aTree block detected: §e${treeBlockCategory}`);
}

registerBlockBreakListener(handleBlockBroken);