## Consive's Tree Chopper

A customizable Treecapitator addon for Minecraft Bedrock Edition.

---

### Current Status

**Version:** `0.1.0-dev` (development)
**Namespace:** `csv`

---

### Implemented (what has been done so far)

Core features implemented and modularized into independent files under behavior_pack/scripts/modules:

- Detection and listener
  - module: features/block-break-listener.js
  - Exposes registerBlockBreakListener which forwards playerBreakBlock events to main handler.
  - The listener sends player, blockPermutation, location, dimension and tool.

- Block classification
  - module: modules/tree-block-classifier.js
  - Uses tags: `log` → treated as logs/branches; `wood` → treated as roots; anything else → `none`.
  - Designed to rely on tags (works with Nature's Touch blocks that declare tags).

- Connected-tree finder
  - module: modules/connected-tree-finder.js
  - BFS 6-directional search that returns connected blocks (normalized integer positions).
  - Uses Euclidean distance limit and a maxBlocks cap for safety (exports TREE_SEARCH_LIMITS).

- Chop scheduler (safe, batched breaking)
  - module: modules/connected-tree-chopper.js
  - Schedules breaking jobs processed across world ticks to avoid lag, with configurable batch size and limits.
  - Exposes chopConnectedTreeBlocks(player, connectedBlocks, dimension, options), cancelChopJob(jobId), listActiveChopJobs().

- Drops, leaf cleanup and best-effort breaker
  - module: modules/tree-drops.js
    - defaultBreakBlock: best-effort removal (tries dimension.runCommand('setblock ... air') and block.break/destroy APIs)
    - giveDropsForBlock: best-effort give/drop using permutation.getDrops() or `give` command
    - performLeafCleanup: fast leaf removal pass with sapling/stick heuristics and batch processing

- Accurate breaker with tool handling heuristics
  - module: modules/tree-breaker.js
  - Attempts to call perm.getDrops(tool) when available, detects Silk Touch / Fortune / shears heuristically, gives drops, and tries to apply tool durability using multiple runtime API shapes.

- Integration
  - main.js ties everything: detects broken log, finds connected blocks, schedules a chop job and (by default) triggers leaf cleanup and drop/give handling when complete.
  - Debug logging is enabled by default on startup to help detect runtime API shapes.

- Packaging
  - builds/build.sh creates builds/TreeChopper.mcaddon containing behavior_pack for easy import into Minecraft Bedrock.

---

### How to test (quick)

1. Import builds/TreeChopper.mcaddon into Minecraft Bedrock (open the file or import in Add-Ons). Enable the behavior pack in a world.
2. Enable scripting/experimental features required by your Bedrock runtime.
3. Also enable/import the Nature's Touch resource pack/add-on separately if you want to test its blocks (oak_branch, oak_roots, etc.).
4. Break a bottom log of a tree (e.g., oak_branch). Expected behaviour:
   - Immediate player message showing category and connected-block count.
   - Chopping job runs in batches and removes connected log blocks (if runtime supports command or block APIs).
   - Leaves are removed quickly and saplings/sticks are given by heuristics (best-effort). Logs/saplings are given via command or perm.getDrops where supported.
   - Debug messages are printed to the server/script console on first run.

---

### Limitations / Caveats

- Best-effort approach: Bedrock scripting runtimes differ. The addon uses feature detection and fallbacks (commands, block APIs, perm.getDrops) — some environments may not support all features, so drops or durability may not be perfect.
- Drops/durability: The implementation attempts to mimic vanilla drops and apply tool durability but uses heuristics. For perfect vanilla parity (loot tables, Fortune/Silk Touch exact behaviour, XP), access to the engine loot tables or a server API is required.
- Protections/permissions: No built-in region-protection integration by default. Provide a canBreakBlock callback to chopConnectedTreeBlocks to enforce protections.
- Resource packs: The .mcaddon currently packages only the behavior_pack. If you want Nature's Touch included inside the same package, provide its path and the build script can be updated.

---

### Files of interest

- behavior_pack/manifest.json
- behavior_pack/scripts/main.js
- behavior_pack/scripts/features/block-break-listener.js
- behavior_pack/scripts/modules/tree-block-classifier.js
- behavior_pack/scripts/modules/connected-tree-finder.js
- behavior_pack/scripts/modules/connected-tree-chopper.js
- behavior_pack/scripts/modules/tree-drops.js
- behavior_pack/scripts/modules/tree-breaker.js
- builds/build.sh (creates builds/TreeChopper.mcaddon)

---

### Next recommended steps

- Run the addon in your Bedrock runtime and paste debug logs here so mappings and API handling can be refined for Nature's Touch and your server.
- Optionally include resource pack(s) inside the .mcaddon for a single-file import.
- Add region-protection checks (canBreakBlock) and configuration UI (player settings) if desired.

If you want, I can also add an admin command to toggle debug at runtime or include Nature's Touch into the package — tell me which.
