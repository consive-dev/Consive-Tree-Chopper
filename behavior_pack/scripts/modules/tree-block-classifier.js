export function classifyTreeBlock(blockPermutation) {
  if (blockPermutation.hasTag("log")) {
    return "log";
  }

  if (blockPermutation.hasTag("wood")) {
    return "root";
  }

  return "none";
}

export function isTreeBlock(blockPermutation) {
  return classifyTreeBlock(blockPermutation) !== "none";
}