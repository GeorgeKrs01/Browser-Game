/**
 * Crafting Recipes System
 * 
 * Each recipe defines:
 * - id: Unique identifier
 * - name: Recipe name
 * - description: What the recipe creates
 * - materials: Array of { name, quantity } required items
 * - result: The item that will be created
 * - baseSuccessRate: Base success percentage (0-100)
 * - qualityBonus: How much status affects success rate
 * - unlocked: Whether recipe is available by default
 * - unlockRequirement: Optional requirement to unlock (e.g., "craft_5_items")
 */

export const RECIPES = [
  {
    id: "enchanted_sword",
    name: "Enchanted Sword",
    description: "Combine 3 Iron Swords with a Magic Crystal to create a powerful Enchanted Sword",
    materials: [
      { name: "Iron Sword", quantity: 3 },
      { name: "Magic Crystal", quantity: 1 }
    ],
    result: {
      name: "Enchanted Sword",
      basePrice: 500,
      status: "Legendary",
      risk: 10,
      description: "A powerful sword imbued with magical energy. Crafted with care."
    },
    baseSuccessRate: 70,
    qualityBonus: 15, // Each Legendary material adds 15% success rate
    unlocked: true
  },
  {
    id: "legendary_armor",
    name: "Legendary Armor",
    description: "Combine 2 Dragon Scales with a Phoenix Feather to create Legendary Armor",
    materials: [
      { name: "Dragon Scale", quantity: 2 },
      { name: "Phoenix Feather", quantity: 1 }
    ],
    result: {
      name: "Legendary Armor",
      basePrice: 800,
      status: "Legendary",
      risk: 5,
      description: "Armor forged from the scales of dragons and feathers of phoenixes. Extremely rare."
    },
    baseSuccessRate: 60,
    qualityBonus: 20,
    unlocked: true
  },
  {
    id: "mystic_staff",
    name: "Mystic Staff",
    description: "Combine a Moonlight Staff with a Mystic Orb to enhance it",
    materials: [
      { name: "Moonlight Staff", quantity: 1 },
      { name: "Mystic Orb", quantity: 1 }
    ],
    result: {
      name: "Mystic Staff",
      basePrice: 600,
      status: "Legendary",
      risk: 8,
      description: "An enhanced staff radiating with mystical energy. Crafted by skilled artisans."
    },
    baseSuccessRate: 75,
    qualityBonus: 12,
    unlocked: true
  },
  {
    id: "crystal_weapon",
    name: "Crystal Weapon",
    description: "Combine 2 Crystal Shards with a Thunder Hammer to forge a Crystal Weapon",
    materials: [
      { name: "Crystal Shard", quantity: 2 },
      { name: "Thunder Hammer", quantity: 1 }
    ],
    result: {
      name: "Crystal Weapon",
      basePrice: 450,
      status: "Legendary",
      risk: 12,
      description: "A weapon forged from pure crystal, crackling with thunderous energy."
    },
    baseSuccessRate: 65,
    qualityBonus: 18,
    unlocked: true
  },
  {
    id: "shadow_blade",
    name: "Shadow Blade",
    description: "Combine a Shadow Cloak with a Silver Dagger to create a Shadow Blade",
    materials: [
      { name: "Shadow Cloak", quantity: 1 },
      { name: "Silver Dagger", quantity: 1 }
    ],
    result: {
      name: "Shadow Blade",
      basePrice: 550,
      status: "Legendary",
      risk: 15,
      description: "A blade that moves like shadow itself. Crafted from dark materials."
    },
    baseSuccessRate: 68,
    qualityBonus: 16,
    unlocked: true
  },
  {
    id: "divine_ring",
    name: "Divine Ring",
    description: "Combine an Enchanted Ring with a Sunstone to create a Divine Ring",
    materials: [
      { name: "Enchanted Ring", quantity: 1 },
      { name: "Sunstone", quantity: 1 }
    ],
    result: {
      name: "Divine Ring",
      basePrice: 700,
      status: "Legendary",
      risk: 7,
      description: "A ring blessed with divine power. Radiates warmth and protection."
    },
    baseSuccessRate: 72,
    qualityBonus: 14,
    unlocked: true
  },
  {
    id: "frost_armor",
    name: "Frost Armor",
    description: "Combine a Frost Blade with Titanium Armor to create Frost Armor",
    materials: [
      { name: "Frost Blade", quantity: 1 },
      { name: "Titanium Armor", quantity: 1 }
    ],
    result: {
      name: "Frost Armor",
      basePrice: 650,
      status: "Legendary",
      risk: 9,
      description: "Armor that freezes enemies on contact. Crafted from ice and titanium."
    },
    baseSuccessRate: 70,
    qualityBonus: 15,
    unlocked: true
  },
  {
    id: "chaos_weapon",
    name: "Chaos Weapon",
    description: "Combine a Chaos Wand with an Obsidian Axe to forge a Chaos Weapon",
    materials: [
      { name: "Chaos Wand", quantity: 1 },
      { name: "Obsidian Axe", quantity: 1 }
    ],
    result: {
      name: "Chaos Weapon",
      basePrice: 750,
      status: "Legendary",
      risk: 20,
      description: "A weapon of pure chaos. Unpredictable but devastatingly powerful."
    },
    baseSuccessRate: 55,
    qualityBonus: 25,
    unlocked: false,
    unlockRequirement: "craft_10_items"
  },
  {
    id: "eternal_crown",
    name: "Eternal Crown",
    description: "Combine a Golden Crown with a Life Crystal to create an Eternal Crown",
    materials: [
      { name: "Golden Crown", quantity: 1 },
      { name: "Life Crystal", quantity: 1 }
    ],
    result: {
      name: "Eternal Crown",
      basePrice: 1000,
      status: "Legendary",
      risk: 3,
      description: "A crown that grants eternal life. The ultimate crafting achievement."
    },
    baseSuccessRate: 50,
    qualityBonus: 30,
    unlocked: false,
    unlockRequirement: "craft_20_items"
  },
  {
    id: "void_blade",
    name: "Void Blade",
    description: "Combine a Void Gem with a Phantom Dagger to create a Void Blade",
    materials: [
      { name: "Void Gem", quantity: 1 },
      { name: "Phantom Dagger", quantity: 1 }
    ],
    result: {
      name: "Void Blade",
      basePrice: 900,
      status: "Legendary",
      risk: 25,
      description: "A blade that cuts through reality itself. Handle with extreme caution."
    },
    baseSuccessRate: 45,
    qualityBonus: 35,
    unlocked: false,
    unlockRequirement: "craft_15_items"
  },
  {
    id: "blood_elven_bow",
    name: "Blood Elven Bow",
    description: "Combine a Blood Ruby with an Elven Bow to create a Blood Elven Bow",
    materials: [
      { name: "Blood Ruby", quantity: 1 },
      { name: "Elven Bow", quantity: 1 }
    ],
    result: {
      name: "Blood Elven Bow",
      basePrice: 580,
      status: "Legendary",
      risk: 11,
      description: "An elegant bow infused with the power of blood magic. Crafted by elven masters."
    },
    baseSuccessRate: 73,
    qualityBonus: 17,
    unlocked: true
  }
];

/**
 * Calculate success rate based on material quality
 * @param {Object} recipe - The recipe being crafted
 * @param {Array} materials - Array of items being used as materials
 * @returns {number} Success rate (0-100)
 */
export function calculateSuccessRate(recipe, materials) {
  let successRate = recipe.baseSuccessRate;
  
  // Count quality bonuses from materials
  materials.forEach(material => {
    if (material.status === "Legendary") {
      successRate += recipe.qualityBonus;
    } else if (material.status === "New") {
      successRate += recipe.qualityBonus * 0.5; // Half bonus for New items
    } else if (material.status === "Used") {
      successRate += recipe.qualityBonus * 0.25; // Quarter bonus for Used items
    }
    // Damaged and Cursed items don't add bonus (or could subtract)
  });
  
  // Cap success rate at 95% (never 100% to keep some risk)
  return Math.min(95, Math.max(5, successRate));
}

/**
 * Check if a recipe is unlocked
 * @param {Object} recipe - The recipe to check
 * @param {Object} stats - Player stats (e.g., { itemsCrafted: 10 })
 * @returns {boolean}
 */
export function isRecipeUnlocked(recipe, stats = {}) {
  if (recipe.unlocked) return true;
  
  if (recipe.unlockRequirement) {
    if (recipe.unlockRequirement === "craft_5_items") {
      return (stats.itemsCrafted || 0) >= 5;
    } else if (recipe.unlockRequirement === "craft_10_items") {
      return (stats.itemsCrafted || 0) >= 10;
    } else if (recipe.unlockRequirement === "craft_15_items") {
      return (stats.itemsCrafted || 0) >= 15;
    } else if (recipe.unlockRequirement === "craft_20_items") {
      return (stats.itemsCrafted || 0) >= 20;
    }
  }
  
  return false;
}
