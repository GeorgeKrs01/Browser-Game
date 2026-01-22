/**
 * Experience Point (XP) Rewards for Game Actions
 * 
 * This file defines all XP rewards for different actions in the game.
 * All values are in experience points.
 */

export const XP_REWARDS = {
  // Purchase Actions
  PURCHASE_ITEM: 10,              // XP for purchasing an item from listings
  
  // Inventory Actions
  MOVE_TO_INVENTORY: 5,           // XP per item moved to inventory
  CHECK_ITEM_PRICE: 1000,           // XP per item checked for price
  
  // Selling Actions
  QUICK_SALE_ITEM: 20,            // XP per item successfully sold (not lost)
  
  // Crafting Actions
  CRAFT_SUCCESS: 150,             // XP for successfully crafting an item
  CRAFT_FAILURE: 25,              // XP for attempting to craft (even if it fails)
};

/**
 * List of all actions that grant experience and their XP values
 */
export const XP_REWARDS_LIST = [
  {
    action: "Purchase Item",
    description: "Buying an item from the listings page",
    xp: XP_REWARDS.PURCHASE_ITEM,
    location: "Listings Page",
  },
  {
    action: "Move to Inventory",
    description: "Moving purchased items to your inventory",
    xp: XP_REWARDS.MOVE_TO_INVENTORY,
    location: "Listings Page",
    note: "Per item",
  },
  {
    action: "Check Item Price",
    description: "Checking the current price of an item in inventory",
    xp: XP_REWARDS.CHECK_ITEM_PRICE,
    location: "My Inventory Page",
    note: "Per item checked",
  },
  {
    action: "Quick Sale",
    description: "Successfully selling an item from inventory",
    xp: XP_REWARDS.QUICK_SALE_ITEM,
    location: "My Inventory Page",
    note: "Per item sold (items lost due to risk do not grant XP)",
  },
  {
    action: "Craft Success",
    description: "Successfully crafting an item from materials",
    xp: XP_REWARDS.CRAFT_SUCCESS,
    location: "Crafting Page",
    note: "Per successful craft",
  },
  {
    action: "Craft Attempt",
    description: "Attempting to craft an item (even if it fails)",
    xp: XP_REWARDS.CRAFT_FAILURE,
    location: "Crafting Page",
    note: "Per craft attempt",
  },
];
