import { classifyTreeBlock } from "./tree-block-classifier.js";

export const TREE_SEARCH_LIMITS = Object.freeze({
  maxBlocks: 256,
  maxDistance: 32
});

function blockKey(location) {
  return `${Math.floor(location.x)}:${Math.floor(location.y)}:${Math.floor(location.z)}`;
}

// Euclidean distance squared for accurate radius checks
function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
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
    x: Math.floor(startLocation.x),
    y: Math.floor(startLocation.y),
    z: Math.floor(startLocation.z)
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

    if (distanceSq(current, start) > maxDistance * maxDistance) {
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

      if (distanceSq(neighbor, start) > maxDistance * maxDistance) {
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
