/**
 * Daily Price Fluctuation System
 * Provides deterministic daily price calculations for items
 */

/**
 * Seeded random number generator for deterministic price fluctuations
 * @param {number} seed - Seed value
 * @returns {Function} Random number generator function
 */
function seededRandom(seed) {
  let value = seed;
  return function() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Generates a unique seed for an item based on its properties
 * @param {number|string} itemId - Unique item identifier
 * @param {string} itemName - Item name
 * @param {number} basePrice - Base price of the item
 * @returns {number} Unique seed value
 */
function generateItemSeed(itemId, itemName, basePrice) {
  // Combine item properties to create a unique seed
  const idHash = typeof itemId === 'string' 
    ? itemId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : itemId;
  
  const nameHash = itemName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const priceHash = Math.floor(basePrice);
  
  // Combine all hashes to create a unique seed
  return (idHash * 1000000 + nameHash * 1000 + priceHash) % 1000000;
}

/**
 * Calculates the daily price for an item based on its base price and current day
 * Prices fluctuate deterministically - same item on same day will always have the same price
 * @param {number} basePrice - The base/purchase price of the item
 * @param {number} currentDay - Current game day
 * @param {number|string} itemId - Unique item identifier
 * @param {string} itemName - Item name
 * @param {number} fluctuationRange - Maximum percentage fluctuation (0-1), default 0.15 (15%)
 * @returns {number} The daily price for the item
 */
export function calculateDailyPrice(basePrice, currentDay, itemId, itemName, fluctuationRange = 0.15) {
  if (!basePrice || basePrice <= 0) return 1;
  if (!currentDay || currentDay < 1) return basePrice;
  
  // Generate unique seed for this item
  const itemSeed = generateItemSeed(itemId, itemName, basePrice);
  
  // Create a seeded random generator using item seed + day
  // This ensures same item on same day = same price, but different days = different prices
  const daySeed = itemSeed + (currentDay * 7919); // 7919 is a prime number for better distribution
  const random = seededRandom(daySeed);
  
  // Generate multiple random values for more complex fluctuation pattern
  const r1 = random();
  const r2 = random();
  const r3 = random();
  
  // Create a smooth fluctuation pattern using sine wave + noise
  // This creates more natural price movements
  const dayCycle = Math.sin((currentDay + r1 * 10) * 0.1) * 0.5 + 0.5; // 0 to 1
  const noise = (r2 - 0.5) * 0.2; // -0.1 to 0.1
  const trend = (r3 - 0.5) * 0.3; // -0.15 to 0.15
  
  // Combine patterns: cycle + noise + trend
  const fluctuation = (dayCycle * fluctuationRange) + (noise * fluctuationRange) + (trend * fluctuationRange * 0.5);
  
  // Calculate final price: basePrice * (1 + fluctuation)
  // Fluctuation ranges from -fluctuationRange to +fluctuationRange
  const priceMultiplier = 1 + (fluctuation - fluctuationRange / 2);
  const dailyPrice = Math.max(1, Math.round(basePrice * priceMultiplier));
  
  return dailyPrice;
}

/**
 * Formats a price number as currency string
 * @param {number} price - Price value
 * @returns {string} Formatted price string (e.g., "$1,234")
 */
export function formatPrice(price) {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * Calculates and formats the daily price for an item
 * Convenience function that combines calculateDailyPrice and formatPrice
 * @param {number} basePrice - The base/purchase price of the item
 * @param {number} currentDay - Current game day
 * @param {number|string} itemId - Unique item identifier
 * @param {string} itemName - Item name
 * @param {number} fluctuationRange - Maximum percentage fluctuation (0-1), default 0.15 (15%)
 * @returns {string} Formatted daily price string
 */
export function getDailyPriceFormatted(basePrice, currentDay, itemId, itemName, fluctuationRange = 0.15) {
  const dailyPrice = calculateDailyPrice(basePrice, currentDay, itemId, itemName, fluctuationRange);
  return formatPrice(dailyPrice);
}

/**
 * Price History Management
 * Tracks price history for items, keeping only the last 10 days
 */

const STORAGE_KEY_PRICE_HISTORY = "item-price-history";
const MAX_HISTORY_DAYS = 10;

/**
 * Loads price history from localStorage
 * @returns {Object} Map of itemId -> array of {day, price} entries
 */
export function loadPriceHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PRICE_HISTORY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // Invalid data, return empty object
  }
  return {};
}

/**
 * Saves price history to localStorage
 * @param {Object} priceHistory - Map of itemId -> array of {day, price} entries
 */
export function savePriceHistory(priceHistory) {
  try {
    localStorage.setItem(STORAGE_KEY_PRICE_HISTORY, JSON.stringify(priceHistory));
  } catch (e) {
    // Storage full or other error, ignore
  }
}

/**
 * Updates price history for an item, keeping only the last 10 days
 * @param {number|string} itemId - Unique item identifier
 * @param {number} day - Current game day
 * @param {number} price - Current price for this day
 * @param {number} maxDays - Maximum number of days to keep (default: 10)
 */
export function updatePriceHistory(itemId, day, price, maxDays = MAX_HISTORY_DAYS) {
  const priceHistory = loadPriceHistory();
  
  // Initialize array if it doesn't exist
  if (!priceHistory[itemId]) {
    priceHistory[itemId] = [];
  }
  
  // Add or update the price for this day
  const existingIndex = priceHistory[itemId].findIndex(entry => entry.day === day);
  if (existingIndex >= 0) {
    // Update existing entry
    priceHistory[itemId][existingIndex].price = price;
  } else {
    // Add new entry
    priceHistory[itemId].push({ day, price });
  }
  
  // Sort by day (ascending)
  priceHistory[itemId].sort((a, b) => a.day - b.day);
  
  // Keep only the last maxDays entries
  if (priceHistory[itemId].length > maxDays) {
    priceHistory[itemId] = priceHistory[itemId].slice(-maxDays);
  }
  
  savePriceHistory(priceHistory);
}

/**
 * Gets price history for an item
 * @param {number|string} itemId - Unique item identifier
 * @returns {Array} Array of {day, price} entries (up to 10 days)
 */
export function getPriceHistory(itemId) {
  const priceHistory = loadPriceHistory();
  return priceHistory[itemId] || [];
}

/**
 * Updates price history for all items in inventory when day changes
 * @param {Array} items - Array of inventory items with basePrice, id, and name
 * @param {number} currentDay - Current game day
 */
export function updateAllItemsPriceHistory(items, currentDay) {
  items.forEach((item) => {
    const basePrice = item.basePrice || parseFloat((item.price || "0").replace(/[^0-9.-]+/g, ""));
    if (basePrice > 0) {
      const dailyPrice = calculateDailyPrice(
        basePrice,
        currentDay,
        item.id,
        item.name || "Unknown Item"
      );
      updatePriceHistory(item.id, currentDay, dailyPrice);
    }
  });
}

/**
 * Cleans up price history for items that no longer exist in inventory
 * @param {Array} currentItems - Array of current inventory items
 */
export function cleanupPriceHistory(currentItems) {
  const priceHistory = loadPriceHistory();
  const currentItemIds = new Set(currentItems.map(item => String(item.id)));
  
  // Remove history for items that no longer exist
  Object.keys(priceHistory).forEach(itemId => {
    if (!currentItemIds.has(itemId)) {
      delete priceHistory[itemId];
    }
  });
  
  savePriceHistory(priceHistory);
}
