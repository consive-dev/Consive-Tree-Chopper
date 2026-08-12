import { giveDropsForBlock, defaultBreakBlock, setDebug as setDropsDebug } from "./tree-drops.js";

// Debug flag
export let DEBUG = false;
export function setDebug(value) { DEBUG = !!value; setDropsDebug(!!value); }

// Best-effort accurate breaker that tries to produce drops respecting tool & enchantments.
// Context: { tool }
export function accurateBreakBlock(player, dimension, location, context = {}) {
  if (DEBUG) console.log('accurateBreakBlock: start', { location, contextSummary: summarizeContext(context) });
  try {
    const tool = context.tool ?? null;

    // Helper: get block and permutation
    let block = null;
    let perm = null;
    try {
      if (typeof dimension.getBlock === 'function') {
        block = dimension.getBlock(location);
        perm = block?.permutation ?? block?.blockPermutation ?? null;
      }
    } catch (e) {
      console.warn('accurateBreakBlock: cannot read block at', location, e);
    }

    if (DEBUG) console.log('accurateBreakBlock: perm type id =', perm?.type?.id);

    // If the permutation exposes getDrops, try to call it with tool context
    if (perm) {
      try {
        if (typeof perm.getDrops === 'function') {
          // Try common signatures: getDrops(tool) or getDrops({tool})
          let drops = null;
          try { drops = perm.getDrops(tool); } catch (e) { /* ignore */ }
          if (!drops) {
            try { drops = perm.getDrops({ tool }); } catch (e) { /* ignore */ }
          }

          if (DEBUG) console.log('accurateBreakBlock: perm.getDrops returned', drops);

          if (Array.isArray(drops) && drops.length > 0) {
            for (const d of drops) {
              const itemId = typeof d === 'string' ? d : d.id ?? d.itemId;
              if (itemId && dimension && typeof dimension.runCommand === 'function' && player && player.name) {
                try { if (DEBUG) console.log(`accurateBreakBlock: giving ${itemId} x${d.count ?? 1} to ${player.name}`); dimension.runCommand(`give "${player.name}" ${itemId} ${d.count ?? 1}`); } catch (e) { console.warn(e); }
              }
            }

            // Remove the block after giving drops
            return defaultBreakBlock(player, dimension, location);
          }
        }
      } catch (e) {
        console.warn('accurateBreakBlock: perm.getDrops failed', e);
      }
    }

    // Heuristic fallback based on tags
    const hasTag = (t) => typeof perm?.hasTag === 'function' && perm.hasTag(t);
    // Silk touch detection heuristic
    const hasSilkTouch = () => {
      try {
        // common representations
        if (!tool) return false;
        if (tool?.hasEnchantment && typeof tool.hasEnchantment === 'function') return tool.hasEnchantment('silk_touch');
        if (Array.isArray(tool?.enchantments)) return tool.enchantments.some(e => String(e?.id || e?.name).toLowerCase().includes('silk'));
        if (tool?.getComponent) {
          try {
            const ench = tool.getComponent('minecraft:enchantments');
            if (ench && ench.enchantments) return ench.enchantments.some(e => String(e.id ?? e.name).toLowerCase().includes('silk'));
          } catch (e) { /* ignore */ }
        }
        // fallback: inspect type name for shears
        const id = tool?.type?.id ?? tool?.itemId ?? tool?.id ?? '';
        if (typeof id === 'string' && id.toLowerCase().includes('shears')) return true;
      } catch (e) {
        // ignore
      }
      return false;
    };

    const fortuneLevel = () => {
      try {
        if (!tool) return 0;
        if (tool?.getComponent) {
          try {
            const ench = tool.getComponent('minecraft:enchantments');
            if (ench && Array.isArray(ench.enchantments)) {
              const f = ench.enchantments.find(e => String(e?.id ?? e?.name).toLowerCase().includes('fortune'));
              if (f) return f.level ?? 1;
            }
          } catch (e) { /* ignore */ }
        }
        if (Array.isArray(tool?.enchantments)) {
          const f = tool.enchantments.find(e => String(e?.id || e?.name).toLowerCase().includes('fortune'));
          if (f) return f.level ?? 1;
        }
      } catch (e) {}
      return 0;
    };

    // Logs: drop the log item
    if (hasTag('log')) {
      if (DEBUG) console.log('accurateBreakBlock: handling log');
      // give one log block per broken block (Fortune doesn't affect logs)
      giveDropsForBlock(player, dimension, perm, 1);
      // break the block
      defaultBreakBlock(player, dimension, location);
      // apply tool durability if possible
      const dur = tryApplyDurability(player, tool);
      if (DEBUG) console.log('accurateBreakBlock: tryApplyDurability result=', dur);
      return true;
    }

    // Leaves: handle silk touch / sapling/stick chance / shears
    if (hasTag('leaves')) {
      if (DEBUG) console.log('accurateBreakBlock: handling leaves');
      if (hasSilkTouch()) {
        // drop the leaf block itself
        giveDropsForBlock(player, dimension, perm, 1);
      } else {
        // sapling chance base (approx) 0.05
        const saplingChance = 0.05;
        const stickChance = 0.02;
        if (Math.random() < saplingChance) {
          const saplingId = perm?.type?.id?.replace('leaves', 'sapling') ?? 'minecraft:oak_sapling';
          giveDropsForBlock(player, dimension, { type: { id: saplingId } }, 1);
        }
        if (Math.random() < stickChance) {
          if (dimension && typeof dimension.runCommand === 'function' && player && player.name) {
            try { dimension.runCommand(`give "${player.name}" minecraft:stick 1`); } catch (e) { console.warn(e); }
          }
        }
      }

      defaultBreakBlock(player, dimension, location);
      const dur2 = tryApplyDurability(player, tool);
      if (DEBUG) console.log('accurateBreakBlock: tryApplyDurability result=', dur2);
      return true;
    }

    // Fallback: attempt a default drop then break
    // Try giveDropsForBlock using permutation
    if (perm) giveDropsForBlock(player, dimension, perm, 1);
    defaultBreakBlock(player, dimension, location);
    const dur3 = tryApplyDurability(player, tool);
    if (DEBUG) console.log('accurateBreakBlock: tryApplyDurability result=', dur3);
    return true;
  } catch (e) {
    console.error('accurateBreakBlock unexpected error:', e);
    try { return defaultBreakBlock(player, dimension, location); } catch (_) { return false; }
  }
}

// Best-effort durability application: tries multiple API shapes; logs if can't apply.
function tryApplyDurability(player, tool) {
  try {
    if (!player || !tool) return false;

    // 1) If tool has modify/damage API
    if (typeof tool.setDamage === 'function' && typeof tool.getDamage === 'function') {
      const current = tool.getDamage();
      tool.setDamage(current + 1);
      return true;
    }

    // 2) Common ItemStack shapes
    if (typeof tool.damage === 'number') {
      tool.damage += 1;
      return true;
    }

    if (typeof tool.setComponent === 'function') {
      try {
        const enchComp = tool.getComponent('minecraft:durability');
        if (enchComp && typeof enchComp.damage === 'number') {
          enchComp.damage += 1;
          tool.setComponent('minecraft:durability', enchComp);
          return true;
        }
      } catch (e) { /* ignore */ }
    }

    // 3) Try to modify the player's held item in inventory if possible
    if (player && typeof player.getComponent === 'function') {
      try {
        const inv = player.getComponent('minecraft:inventory');
        if (inv && inv.container && typeof inv.container.getItem === 'function' && typeof inv.container.setItem === 'function') {
          // attempt to find selected slot heuristically
          const slotIndex = player.selectedSlot ?? inv.container.selectedSlot ?? null;
          const held = (slotIndex !== null) ? inv.container.getItem(slotIndex) : null;
          if (held && typeof held.damage === 'number') {
            held.damage += 1;
            inv.container.setItem(slotIndex, held);
            return true;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // cannot apply durability reliably; log and return false
    console.warn('tryApplyDurability: could not apply durability — runtime API missing or unsupported');
    return false;
  } catch (e) {
    console.warn('tryApplyDurability error:', e);
    return false;
  }
}

function summarizeContext(ctx) {
  try {
    if (!ctx) return null;
    const tool = ctx.tool ?? null;
    const toolSummary = tool ? { id: tool?.type?.id ?? tool?.id ?? tool?.itemId ?? null, enchantments: tool?.enchantments ? tool.enchantments : (tool?.getComponent ? '(component)' : null) } : null;
    return { tool: toolSummary };
  } catch (e) { return null; }
}
