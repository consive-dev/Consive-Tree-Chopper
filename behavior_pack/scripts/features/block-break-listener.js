import { world } from "@minecraft/server";

export function registerBlockBreakListener(onBlockBroken) {
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    const blockBreakData = {
      player: event.player,
      blockTypeId: event.brokenBlockPermutation.type.id,
      location: event.block.location,
      dimension: event.dimension,
      tool: event.itemStackBeforeBreak
    };

    onBlockBroken(blockBreakData);
  });
}