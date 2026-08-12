import { registerBlockBreakListener } from "./modules/block-break-listener.js";

function handleBlockBroken(data) {
  const { player, blockTypeId, location } = data;

  // Temporary test: remove this message after testing.
  player.sendMessage(
    `§7You broke: §e${blockTypeId} §7at §f${location.x}, ${location.y}, ${location.z}`
  );
}

registerBlockBreakListener(handleBlockBroken);