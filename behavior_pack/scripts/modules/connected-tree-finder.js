import { classifyTreeBlock } from "./tree-block-classifier.js";

export const TREE_SEARCH_LIMITS = Object.freeze({
  maxBlocks: 256,
  maxDistance: 32
});

function blockKey(location) {
  return `${location.x}:${location.y}:${location.z}`;
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

function isTreeLikeBlock(block) {
  if (!block || !block.permutation) {
    return false;
  }

  return classifyTreeBlock(block.permutation) !== "none";
}

export function findConnectedTreeBlocks(startLocation, dimension, options = {}) {
  const maxBlocks = options.maxBlocks ?? TREE_SEARCH_LIMITS.maxBlocks;
  const maxDistance = options.maxDistance ?? TREE_SEARCH_LIMITS.maxDistance;

  if (!startLocation || !dimension) {
    return [];
  }

  const start = {
    x: startLocation.x,
    y: startLocation.y,
    z: startLocation.z
  };

  const queue = [start];
  const visited = new Set();
  const connected = [];

  while (queue.length > 0 && connected.length < maxBlocks) {
    const current = queue.shift();
    const currentKey = blockKey(current);

    if (visited.has(currentKey)) {
      continue;
    }

    visited.add(currentKey);

    if (manhattanDistance(current, start) > maxDistance) {
      continue;
    }

    let currentBlock;

    try {
      currentBlock = dimension.getBlock(current);
    } catch {
      continue;
    }

    if (!isTreeLikeBlock(currentBlock)) {
      continue;
    }

    connected.push({
      x: current.x,
      y: current.y,
      z: current.z,
      category: classifyTreeBlock(currentBlock.permutation)
    });

    const neighbors = [
      { x: current.x + 1, y: current.y, z: current.z },
      { x: current.x - 1, y: current.y, z: current.z },
      { x: current.x, y: current.y + 1, z: current.z },
      { x: current.x, y: current.y - 1, z: current.z },
      { x: current.x, y: current.y, z: current.z + 1 },
      { x: current.x, y: current.y, z: current.z - 1 }
    ];

    for (const neighbor of neighbors) {
      const neighborKey = blockKey(neighbor);

      if (visited.has(neighborKey)) {
        continue;
      }

      if (manhattanDistance(neighbor, start) > maxDistance) {
        continue;
      }

      let neighborBlock;

      try {
        neighborBlock = dimension.getBlock(neighbor);
      } catch {
        continue;
      }

      if (isTreeLikeBlock(neighborBlock) && !visited.has(neighborKey)) {
        queue.push(neighbor);
      }
    }
  }

  return connected;
}
