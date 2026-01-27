"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import { useBalance } from "../../contexts/BalanceContext";
import { useExperience } from "../../contexts/ExperienceContext";
import { XP_REWARDS } from "../../constants/xpRewards";
import { randomChance, randomElement, randomInt, randomIntRange } from "../../utils/rng";
import { calculateDailyPrice, formatPrice, getPriceHistory } from "../../utils/pricing";

const STATUSES = ["Legendary", "Rare", "Uncommon", "Common", "Damaged"];

/**
 * Calculates the adjusted price based on risk level
 * Risk represents the probability of losing the item, so higher risk = lower price
 * @param {number} basePrice - The base price of the item
 * @param {number} risk - Risk percentage (0-100), represents chance of losing the item
 * @returns {number} - The adjusted price based on risk
 * 
 * Formula: Price = Base Price × (1 - risk/100 × discountFactor)
 * Higher risk items are cheaper because they're more likely to be lost
 */
function calculateRiskAdjustedPrice(basePrice, risk) {
  // Normalize risk to 0-1 range
  const normalizedRisk = risk / 100;
  
  // Discount factor: how much the price is reduced per unit of risk
  // At 100% risk, price is reduced by 60% (so multiplier = 0.4)
  // At 0% risk, price stays at base (multiplier = 1.0)
  const discountFactor = 0.6; // Maximum discount at 100% risk
  const riskMultiplier = 1 - (normalizedRisk * discountFactor);
  
  // Calculate adjusted price
  const adjustedPrice = basePrice * riskMultiplier;
  
  // Ensure minimum price of 1
  return Math.max(1, Math.round(adjustedPrice));
}

/**
 * Checks if an item should be lost based on its risk level
 * @param {number} risk - Risk percentage (0-100)
 * @returns {boolean} - True if the item should be lost
 */
function shouldLoseItem(risk) {
  // Item is lost if random chance is less than risk percentage
  return randomChance(risk);
}

const ITEM_NAMES = [
  "Ancient Scroll", "Crystal Shard", "Iron Sword", "Magic Potion", "Dragon Scale",
  "Enchanted Ring", "Shadow Cloak", "Phoenix Feather", "Mystic Orb", "Thunder Hammer",
  "Frost Blade", "Void Gem", "Sunstone", "Moonlight Staff", "Blood Ruby",
  "Silver Dagger", "Golden Crown", "Platinum Shield", "Emerald Amulet", "Sapphire Necklace",
  "Obsidian Axe", "Titanium Armor", "Ethereal Bow", "Chaos Wand", "Lightning Spear",
  "Fire Gauntlets", "Ice Crown", "Storm Boots", "Earth Hammer", "Wind Cloak",
  "Demon Horn", "Angel Wing", "Vampire Fang", "Werewolf Claw", "Dragon Tooth",
  "Unicorn Horn", "Griffin Feather", "Basilisk Scale", "Hydra Venom", "Cerberus Collar",
  "Mystic Tome", "Arcane Rune", "Blessed Charm", "Cursed Idol", "Sacred Relic",
  "Forbidden Scroll", "Lost Artifact", "Ancient Key", "Sealed Chest", "Mysterious Map",
  "Crystal Ball", "Magic Mirror", "Enchanted Book", "Spell Tome", "Ritual Dagger",
  "Necromancer Staff", "Paladin Sword", "Rogue Blade", "Mage Robe", "Warrior Helm",
  "Elven Bow", "Dwarven Axe", "Orcish Club", "Goblin Dagger", "Troll Hide",
  "Giant Club", "Fairy Dust", "Pixie Wing", "Gnome Hat", "Elf Boots",
  "Dragon Egg", "Phoenix Heart", "Griffin Talon", "Basilisk Eye", "Hydra Head",
  "Cerberus Chain", "Minotaur Horn", "Medusa Gaze", "Siren Song", "Banshee Wail",
  "Wraith Cloak", "Ghost Blade", "Specter Shroud", "Phantom Dagger", "Spirit Orb",
  "Soul Gem", "Life Crystal", "Death Scythe", "Time Hourglass", "Space Portal",
  "Reality Anchor", "Dream Catcher", "Nightmare Blade", "Hope Beacon", "Despair Mask",
  "Chaos Crystal", "Order Seal", "Balance Scale", "Fate Coin", "Destiny Card"
];

const STORAGE_KEY_INVENTORY_ITEMS = "inventory-items";
const STORAGE_KEY_LISTINGS_UI = "listings-ui-state";
const STORAGE_KEY_DAY = "game-day";
const MAX_BACKPACK_CAPACITY = 500; // Maximum number of items

// Seeded random number generator for deterministic shuffling
function seededRandom(seed) {
  let value = seed;
  return function() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

// Deterministic shuffle function using a seed
function shuffleArray(array, seed = 12345) {
  const shuffled = [...array];
  const random = seededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createListings(currentDay = 1) {
  // Use a fixed seed so server and client produce the same shuffle
  const shuffledNames = shuffleArray(ITEM_NAMES, 12345);
  return Array.from({ length: 100 }, (_, index) => {
    const id = index + 1;
    const status = STATUSES[index % STATUSES.length];
    const risk = 15 + (index * 3) % 66; // 15–80% range

    // Calculate base price (reduced by ~80%)
    const basePrice = (10 + id * 3) * 0.2;
    
    // Apply risk adjustment to get base price
    const riskAdjustedBasePrice = calculateRiskAdjustedPrice(basePrice, risk);
    
    // Calculate daily fluctuating price
    const itemName = shuffledNames[index % shuffledNames.length];
    const dailyPrice = calculateDailyPrice(riskAdjustedBasePrice, currentDay, id, itemName);

    return {
      id,
      name: itemName,
      basePrice: riskAdjustedBasePrice, // Store base price for inventory
      price: formatPrice(dailyPrice),
      description:
        status === "Legendary"
          ? "High value loot with rare bonuses."
          : status === "Damaged"
            ? "Unstable item with unpredictable effects."
            : "Standard inventory item available on the market.",
      status,
      risk,
    };
  });
}

function createAdditionalListings(currentDay = 1) {
  // Use a different seed for the second carousel to get different random items
  const shuffledNames = shuffleArray(ITEM_NAMES, 67890);
  return Array.from({ length: 50 }, (_, index) => {
    const id = 100 + index + 1; // Start from 101
    const status = STATUSES[(index * 7) % STATUSES.length]; // Different pattern
    const risk = 15 + (index * 5) % 66; // 15–80% range

    // Calculate base price (reduced by ~80%)
    const basePrice = (15 + id * 4) * 0.2;
    
    // Apply risk adjustment to get base price
    const riskAdjustedBasePrice = calculateRiskAdjustedPrice(basePrice, risk);
    
    // Calculate daily fluctuating price
    const itemName = shuffledNames[index % shuffledNames.length];
    const dailyPrice = calculateDailyPrice(riskAdjustedBasePrice, currentDay, id, itemName);

    return {
      id,
      name: itemName,
      basePrice: riskAdjustedBasePrice, // Store base price for inventory
      price: formatPrice(dailyPrice),
      description:
        status === "Legendary"
          ? "High value loot with rare bonuses."
          : status === "Damaged"
            ? "Unstable item with unpredictable effects."
            : "Standard inventory item available on the market.",
      status,
      risk,
    };
  });
}

export default function ListingsPage() {
  // Initialize with empty state to match server-side rendering
  const { balance, deductBalance, addBalance } = useBalance();
  const { addExperience } = useExperience();
  const [listingSize, setListingSize] = useState("md"); // sm | md | lg
  const [removedCardIds, setRemovedCardIds] = useState(new Set());
  const [removedCards, setRemovedCards] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [extraListingRows, setExtraListingRows] = useState([]);
  const [currentDay, setCurrentDay] = useState(1);
  const [selectedItemForGraph, setSelectedItemForGraph] = useState(null);
  
  // Filter state
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [riskMin, setRiskMin] = useState("");
  const [riskMax, setRiskMax] = useState("");

  // Load current day from localStorage
  useEffect(() => {
    const savedDay = localStorage.getItem(STORAGE_KEY_DAY);
    if (savedDay) {
      try {
        setCurrentDay(parseInt(savedDay, 10));
      } catch (e) {
        // Invalid data, ignore
      }
    }

    // Listen for day changes
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_DAY && e.newValue) {
        try {
          const day = parseInt(e.newValue, 10);
          if (!isNaN(day)) {
            setCurrentDay(day);
          }
        } catch (e) {
          // Invalid data, ignore
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically (in case storage events don't fire for same-tab updates)
    const interval = setInterval(() => {
      const savedDay = localStorage.getItem(STORAGE_KEY_DAY);
      if (savedDay) {
        try {
          const day = parseInt(savedDay, 10);
          if (!isNaN(day) && day !== currentDay) {
            setCurrentDay(day);
          }
        } catch (e) {
          // Invalid data, ignore
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [currentDay]);

  // Generate listings deterministically (same on server and client)
  // Using seeded shuffle ensures server and client produce identical results
  // Recalculate when day changes to update prices
  const listings = useMemo(() => createListings(currentDay), [currentDay]);
  const additionalListings = useMemo(() => createAdditionalListings(currentDay), [currentDay]);

  // Track next unique ID for dynamically added listings
  const [nextDynamicId, setNextDynamicId] = useState(() => {
    const all = [...listings, ...additionalListings];
    const maxId = all.reduce((max, item) => Math.max(max, item.id), 0);
    return maxId + 1;
  });

  // Create stable string representation of removedCardIds for dependency tracking
  const removedCardIdsKey = useMemo(() => {
    return Array.from(removedCardIds).sort().join(',');
  }, [removedCardIds]);

  // Mark as hydrated and restore UI state from localStorage
  useEffect(() => {
    setIsHydrated(true);

    try {
      const saved = localStorage.getItem(STORAGE_KEY_LISTINGS_UI);
      if (saved) {
        const parsed = JSON.parse(saved);

        if (parsed && typeof parsed === "object") {
          if (parsed.listingSize === "xs" || parsed.listingSize === "sm" || parsed.listingSize === "md") {
            setListingSize(parsed.listingSize);
          }
          if (Array.isArray(parsed.extraListingRows)) {
            setExtraListingRows(parsed.extraListingRows);
          }
          if (typeof parsed.nextDynamicId === "number" && parsed.nextDynamicId > 0) {
            setNextDynamicId(parsed.nextDynamicId);
          }
          // Restore selected listings
          if (Array.isArray(parsed.removedCards)) {
            setRemovedCards(parsed.removedCards);
          }
          // Restore removed card IDs (convert array back to Set)
          if (Array.isArray(parsed.removedCardIds)) {
            setRemovedCardIds(new Set(parsed.removedCardIds));
          }
        }
      }
    } catch {
      // Ignore malformed localStorage data
    }
  }, []);

  // Persist UI state (card size + extra rows + selected listings) whenever it changes
  useEffect(() => {
    if (!isHydrated) return;

    const payload = {
      listingSize,
      extraListingRows,
      nextDynamicId,
      removedCards,
      removedCardIds: Array.from(removedCardIds), // Convert Set to Array for JSON serialization
    };

    try {
      localStorage.setItem(STORAGE_KEY_LISTINGS_UI, JSON.stringify(payload));
    } catch {
      // Ignore write errors (e.g., storage full)
    }
  }, [listingSize, extraListingRows, nextDynamicId, removedCards, removedCardIdsKey, isHydrated]);

  const handleCardClick = (listing) => {
    // Always set selected item for price graph when clicked
    setSelectedItemForGraph(listing);

    // If item is already removed, just show the graph
    if (removedCardIds.has(listing.id)) return;

    // Extract price from listing (format: "$1,234")
    const price = parseFloat(listing.price.replace(/[^0-9.-]+/g, ""));
    
    // Check if player has enough balance
    if (balance < price) {
      toast.error(`Insufficient balance! You need ${listing.price} but only have ${balance.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })}.`);
      return;
    }

    // Deduct balance immediately when item is picked
    deductBalance(price);
    // Award experience for purchase
    addExperience(XP_REWARDS.PURCHASE_ITEM);

    // Immediately remove from carousel and add to display (no animation)
    setRemovedCardIds((prev) => new Set([...prev, listing.id]));
    setRemovedCards((prev) => {
      // Check if card already exists to prevent duplicates
      if (prev.some((card) => card.id === listing.id)) {
        return prev;
      }
      return [...prev, listing];
    });
  };

  const handleRemoveCard = (listing) => {
    // Extract price from listing (format: "$1,234")
    const price = parseFloat(listing.price.replace(/[^0-9.-]+/g, ""));
    
    // Refund the balance when removing from selected listings
    addBalance(price);
    
    // Remove from selected listings display only
    // Keep it in removedCardIds so it doesn't reappear in carousel
    setRemovedCards((prev) => prev.filter((card) => card.id !== listing.id));
    toast.success(`Removed ${listing.name} and refunded ${listing.price}`);
  };

  const handleViewItemGraph = (listing) => {
    // Set selected item for price graph without purchasing
    setSelectedItemForGraph(listing);
  };

  const handleMoveToInventory = () => {
    if (removedCards.length === 0) {
      toast.error("No items selected to move to inventory");
      return;
    }
    
    // Load existing inventory items
    const existingInventory = isHydrated 
      ? (() => {
          try {
            const saved = localStorage.getItem(STORAGE_KEY_INVENTORY_ITEMS);
            return saved ? JSON.parse(saved) : [];
          } catch (e) {
            return [];
          }
        })()
      : [];
    
    // Check if inventory is at capacity
    const currentCount = existingInventory.length;
    if (currentCount >= MAX_BACKPACK_CAPACITY) {
      toast.error(`Inventory is full (${MAX_BACKPACK_CAPACITY}/${MAX_BACKPACK_CAPACITY}). Cannot add more items.`);
      return;
    }
    
    // Calculate how many items can be added
    const availableSpace = MAX_BACKPACK_CAPACITY - currentCount;
    const itemsToAdd = removedCards.slice(0, availableSpace);
    
    // Check if all items can fit
    if (removedCards.length > availableSpace) {
      toast.error(`Only ${availableSpace} item${availableSpace === 1 ? "" : "s"} can be added. Inventory is at ${currentCount}/${MAX_BACKPACK_CAPACITY} capacity.`);
      return;
    }
    
    // Generate unique IDs for each item being added
    const maxId = existingInventory.reduce((max, item) => Math.max(max, item.id || 0), 0);
    const itemsWithUniqueIds = itemsToAdd.map((item, index) => {
      const newId = maxId + index + 1;
      // Store basePrice for daily price calculation
      // If basePrice doesn't exist, extract it from the current price
      const basePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      return {
        ...item,
        id: newId, // Assign unique ID to each item
        basePrice: basePrice, // Store base price for daily fluctuations
        // Keep the current price as the purchase price, but it will be recalculated daily in inventory
      };
    });
    
    // Add all selected cards to inventory
    const updatedInventory = [...existingInventory, ...itemsWithUniqueIds];
    
    // Save to localStorage
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_INVENTORY_ITEMS, JSON.stringify(updatedInventory));
    }
    
    // Award experience for moving items to inventory
    const xpGained = itemsToAdd.length * XP_REWARDS.MOVE_TO_INVENTORY;
    addExperience(xpGained);
    
    // Clear selected listings
    setRemovedCards([]);
    toast.success(`Moved ${itemsToAdd.length} item${itemsToAdd.length === 1 ? "" : "s"} to inventory!`);
  };

  const handleAddListingsRow = () => {
    const ROW_LENGTH = 10;

    setExtraListingRows((prevRows) => {
      const newRow = Array.from({ length: ROW_LENGTH }, (_, index) => {
        const id = nextDynamicId + index;

        const status = randomElement(STATUSES);
        const risk = randomIntRange(15, 80); // 15–80% range

        const nameIndex = randomInt(ITEM_NAMES.length);
        const basePrice = (10 + id * 3 + randomInt(50)) * 0.2;
        const riskAdjustedBasePrice = calculateRiskAdjustedPrice(basePrice, risk);
        
        // Calculate daily fluctuating price
        const itemName = ITEM_NAMES[nameIndex];
        const dailyPrice = calculateDailyPrice(riskAdjustedBasePrice, currentDay, id, itemName);

        return {
          id,
          name: itemName,
          basePrice: riskAdjustedBasePrice, // Store base price for inventory
          price: formatPrice(dailyPrice),
          description:
            status === "Legendary"
              ? "High value loot with rare bonuses."
              : status === "Damaged"
                ? "Unstable item with unpredictable effects."
                : "Standard inventory item available on the market.",
          status,
          risk,
        };
      });

      return [...prevRows, newRow];
    });

    setNextDynamicId((prev) => prev + ROW_LENGTH);
  };

  const handleRemoveLastListingsRow = () => {
    setExtraListingRows((prevRows) => {
      if (prevRows.length === 0) return prevRows;

      const rowsCopy = [...prevRows];
      rowsCopy.pop();
      return rowsCopy;
    });
  };

  // Helper function to parse price from formatted string
  const parsePrice = (priceString) => {
    return parseFloat(priceString.replace(/[^0-9.-]+/g, ""));
  };

  // Filter function to check if a listing matches the current filters
  const matchesFilters = useCallback((listing) => {
    const price = parsePrice(listing.price);
    const risk = listing.risk;

    // Check price filters
    if (priceMin !== "" && price < parseFloat(priceMin)) return false;
    if (priceMax !== "" && price > parseFloat(priceMax)) return false;

    // Check risk filters
    if (riskMin !== "" && risk < parseFloat(riskMin)) return false;
    if (riskMax !== "" && risk > parseFloat(riskMax)) return false;

    return true;
  }, [priceMin, priceMax, riskMin, riskMax]);

  // Generate price history for the last 10 days for a given item
  const generatePriceHistory = (item, days = 10) => {
    if (!item) return [];
    
    const basePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
    if (!basePrice || basePrice <= 0) return [];
    
    const history = [];
    const startDay = Math.max(1, currentDay - days + 1);
    
    for (let day = startDay; day <= currentDay; day++) {
      const price = calculateDailyPrice(basePrice, day, item.id, item.name);
      history.push({ day, price });
    }
    
    return history;
  };

  // Simple line chart component for price history
  const PriceHistoryChart = ({ data, itemName }) => {
    if (!data || data.length === 0) {
      return (
        <div style={{ 
          padding: "20px", 
          textAlign: "center", 
          color: "color-mix(in oklab, var(--foreground) 50%, transparent)",
          fontSize: "13px"
        }}>
          No price history available
        </div>
      );
    }

    const width = 300;
    const height = 150;
    const padding = { top: 10, right: 10, bottom: 30, left: 25 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const prices = data.map(d => d.price);
    const rawMinPrice = Math.min(...prices);
    const rawMaxPrice = Math.max(...prices);
    const rawPriceRange = rawMaxPrice - rawMinPrice || 1;
    
    // Add padding (15% on each side) to give the graph breathing room
    const paddingPercent = 0.15;
    const paddingAmount = rawPriceRange * paddingPercent;
    const minPrice = rawMinPrice - paddingAmount;
    const maxPrice = rawMaxPrice + paddingAmount;
    const priceRange = maxPrice - minPrice || 1; // Avoid division by zero

    // Normalize prices to chart coordinates
    const points = data.map((d, index) => {
      const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.price - minPrice) / priceRange) * chartHeight;
      return { x, y, day: d.day, price: d.price };
    });

    // Create smooth curve path using cubic Bézier curves
    const createSmoothPath = (points) => {
      if (points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
      if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
      
      let path = `M ${points[0].x} ${points[0].y}`;
      
      // Use cubic Bézier curves for smooth interpolation
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        // Calculate control points for smooth curve
        const tension = 0.3; // Controls curve smoothness (0 = straight, 1 = very curved)
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        
        // Use smooth curve for all segments except the last one
        if (i < points.length - 2) {
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        } else {
          // Last segment: ensure it ends at the last point
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
      }
      
      return path;
    };

    const pathData = createSmoothPath(points);

    // Create area path (for gradient fill) - need to follow the smooth curve
    const areaPath = `${pathData} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    // Generate nice, evenly spaced price values for grid lines
    // Ensures between 4 and 6 ticks
    const generateNiceTicks = (min, max) => {
      const range = max - min;
      if (range === 0) return [min];
      
      // Try different target counts to get between 4-6 ticks
      const targetCounts = [5, 6, 4]; // Prefer 5, then 6, then 4
      
      for (const targetCount of targetCounts) {
        const roughStep = range / (targetCount - 1);
        
        // Calculate a nice round step size
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalizedStep = roughStep / magnitude;
        let niceStep;
        
        if (normalizedStep <= 1) niceStep = 1 * magnitude;
        else if (normalizedStep <= 2) niceStep = 2 * magnitude;
        else if (normalizedStep <= 5) niceStep = 5 * magnitude;
        else niceStep = 10 * magnitude;
        
        // Round min and max to nice values
        const niceMin = Math.floor(min / niceStep) * niceStep;
        const niceMax = Math.ceil(max / niceStep) * niceStep;
        
        // Generate ticks
        const ticks = [];
        for (let value = niceMin; value <= niceMax + niceStep * 0.001; value += niceStep) {
          ticks.push(value);
        }
        
        // Check if we have between 4 and 6 ticks
        if (ticks.length >= 4 && ticks.length <= 6) {
          return ticks;
        }
      }
      
      // Fallback: if we couldn't get 4-6, return the last attempt
      const roughStep = range / 4;
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
      const normalizedStep = roughStep / magnitude;
      let niceStep;
      
      if (normalizedStep <= 1) niceStep = 1 * magnitude;
      else if (normalizedStep <= 2) niceStep = 2 * magnitude;
      else if (normalizedStep <= 5) niceStep = 5 * magnitude;
      else niceStep = 10 * magnitude;
      
      const niceMin = Math.floor(min / niceStep) * niceStep;
      const niceMax = Math.ceil(max / niceStep) * niceStep;
      
      const ticks = [];
      for (let value = niceMin; value <= niceMax + niceStep * 0.001; value += niceStep) {
        ticks.push(value);
      }
      
      return ticks;
    };

    const gridTicks = generateNiceTicks(minPrice, maxPrice);

    return (
      <div style={{ marginTop: "16px" }}>
        <div style={{ 
          fontSize: "12px", 
          fontWeight: "600", 
          marginBottom: "8px", 
          textTransform: "uppercase", 
          letterSpacing: "0.05em", 
          color: "color-mix(in oklab, var(--foreground) 50%, transparent)" 
        }}>
          Price History (Last 10 Days)
        </div>
        <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--foreground)" }}>
          {itemName}
        </div>
        <svg width={width} height={height} style={{ display: "block" }}>
          <defs>
            <linearGradient id={`priceGradient-${itemName.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a90e2" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4a90e2" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {(() => {
            const displayedLabels = new Set();
            return gridTicks.map((price) => {
              // Only show grid lines that are within the visible range (with padding)
              if (price < minPrice || price > maxPrice) return null;
              
              const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
              const roundedPrice = Math.round(price);
              const formattedPrice = formatPrice(roundedPrice);
              
              // Skip if we've already displayed this rounded price value
              if (displayedLabels.has(roundedPrice)) {
                return (
                  <g key={price}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="rgba(128, 128, 128, 0.15)"
                      strokeWidth="1"
                    />
                  </g>
                );
              }
              
              displayedLabels.add(roundedPrice);
              return (
                <g key={price}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(128, 128, 128, 0.15)"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="rgba(128, 128, 128, 0.6)"
                  >
                    {formattedPrice}
                  </text>
                </g>
              );
            });
          })()}

          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#priceGradient-${itemName.replace(/\s+/g, '-')})`}
          />

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#4a90e2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="3"
                fill="#4a90e2"
                stroke="var(--background)"
                strokeWidth="2"
              />
              {/* Day labels */}
              {index % Math.ceil(data.length / 5) === 0 || index === data.length - 1 ? (
                <text
                  x={point.x}
                  y={height - padding.bottom + 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(128, 128, 128, 0.7)"
                >
                  {point.day}
                </text>
              ) : null}
            </g>
          ))}
          
          {/* Days label */}
          <text
            x={width / 2}
            y={height - padding.bottom + 25}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(128, 128, 128, 0.7)"
            fontWeight="500"
          >
            Days
          </text>
        </svg>
      </div>
    );
  };

  const carouselListings = useMemo(() => {
    if (listings.length === 0) return [];
    return [...listings, ...listings].filter(
      (listing) => !removedCardIds.has(listing.id) && matchesFilters(listing)
    );
  }, [listings, removedCardIds, matchesFilters]);

  const carouselListingsFast = useMemo(() => {
    if (additionalListings.length === 0) return [];
    return [...additionalListings, ...additionalListings].filter(
      (listing) => !removedCardIds.has(listing.id) && matchesFilters(listing)
    );
  }, [additionalListings, removedCardIds, matchesFilters]);

  return (
    <section className={`page listings-size-${listingSize}`}>
      <h1 className="page-title">Listings</h1>
    

      <div className="listings-layout">
        {/* Listings Container */}
        <div style={{
          border: "1px solid color-mix(in oklab, var(--foreground) 12%, transparent)",
          borderRadius: "14px",
          padding: "20px",
          background: "color-mix(in oklab, var(--background) 96%, transparent)",
          maxHeight: "calc(100vh - 200px)",
          overflowY: "auto"
        }}>
          {/* Filters Section */}
          <div style={{ 
            marginBottom: "16px", 
            padding: "16px", 
            background: "color-mix(in oklab, var(--background) 98%, transparent)",
            borderRadius: "10px",
            border: "1px solid color-mix(in oklab, var(--foreground) 8%, transparent)"
          }}>
            <div style={{ 
              fontSize: "0.9rem", 
              fontWeight: "600", 
              marginBottom: "12px",
              color: "var(--foreground)",
              opacity: 0.9
            }}>
              Filters
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Price Range Filters */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "140px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7, fontWeight: "500" }}>Price Range</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    style={{
                      width: "70px",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid color-mix(in oklab, var(--foreground) 18%, transparent)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                    }}
                  />
                  <span style={{ opacity: 0.5 }}>—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    style={{
                      width: "70px",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid color-mix(in oklab, var(--foreground) 18%, transparent)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>
              
              {/* Risk Range Filters */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "140px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7, fontWeight: "500" }}>Risk Range (%)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="number"
                    placeholder="Min"
                    min="0"
                    max="100"
                    value={riskMin}
                    onChange={(e) => setRiskMin(e.target.value)}
                    style={{
                      width: "70px",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid color-mix(in oklab, var(--foreground) 18%, transparent)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                    }}
                  />
                  <span style={{ opacity: 0.5 }}>—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    min="0"
                    max="100"
                    value={riskMax}
                    onChange={(e) => setRiskMax(e.target.value)}
                    style={{
                      width: "70px",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px",
                      border: "1px solid color-mix(in oklab, var(--foreground) 18%, transparent)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              {/* Quick Filters */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7, fontWeight: "500" }}>Quick Filters</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => {
                      setPriceMax("100");
                      setPriceMin("");
                      setRiskMin("");
                      setRiskMax("");
                    }}
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid color-mix(in oklab, #4a90e2 50%, transparent)",
                      background: priceMax === "100" && priceMin === ""
                        ? "color-mix(in oklab, #4a90e2 20%, var(--background) 90%)"
                        : "color-mix(in oklab, var(--background) 94%, transparent)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: "500",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!(priceMax === "100" && priceMin === "")) {
                        e.currentTarget.style.background = "color-mix(in oklab, #4a90e2 12%, var(--background) 92%)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(priceMax === "100" && priceMin === "")) {
                        e.currentTarget.style.background = "color-mix(in oklab, var(--background) 94%, transparent)";
                      }
                    }}
                  >
                    Under $100
                  </button>
                  <button
                    onClick={() => {
                      setRiskMax("30");
                      setRiskMin("");
                      setPriceMin("");
                      setPriceMax("");
                    }}
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid color-mix(in oklab, #22c55e 50%, transparent)",
                      background: riskMax === "30" && riskMin === ""
                        ? "color-mix(in oklab, #22c55e 20%, var(--background) 90%)"
                        : "color-mix(in oklab, var(--background) 94%, transparent)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: "500",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!(riskMax === "30" && riskMin === "")) {
                        e.currentTarget.style.background = "color-mix(in oklab, #22c55e 12%, var(--background) 92%)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(riskMax === "30" && riskMin === "")) {
                        e.currentTarget.style.background = "color-mix(in oklab, var(--background) 94%, transparent)";
                      }
                    }}
                  >
                    Low Risk
                  </button>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(priceMin !== "" || priceMax !== "" || riskMin !== "" || riskMax !== "") && (
                <button
                  onClick={() => {
                    setPriceMin("");
                    setPriceMax("");
                    setRiskMin("");
                    setRiskMax("");
                  }}
                  style={{
                    padding: "0.4rem 0.8rem",
                    borderRadius: "6px",
                    border: "1px solid color-mix(in oklab, var(--foreground) 18%, transparent)",
                    background: "color-mix(in oklab, var(--background) 94%, transparent)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "500",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "color-mix(in oklab, var(--foreground) 8%, var(--background) 92%)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "color-mix(in oklab, var(--background) 94%, transparent)";
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        <span style={{ alignSelf: "center", opacity: 0.8, fontSize: "0.95rem" }}>Card size:</span>
        {["xs", "sm", "md"].map((size) => (
          <button
            key={size}
            onClick={() => setListingSize(size)}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid color-mix(in oklab, var(--foreground) 18%, transparent)",
              background: listingSize === size
                ? "color-mix(in oklab, var(--foreground) 12%, var(--background) 90%)"
                : "color-mix(in oklab, var(--background) 94%, transparent)",
              color: "var(--foreground)",
              cursor: "pointer",
              fontWeight: 600,
              opacity: listingSize === size ? 1 : 0.8,
              transition: "all 0.15s ease",
            }}
          >
            {size.toUpperCase()}
          </button>
        ))}
        <button
          onClick={handleAddListingsRow}
          style={{
            padding: "0.45rem 0.85rem",
            borderRadius: "8px",
            border: "1px solid color-mix(in oklab, #22c55e 60%, transparent)",
            boxShadow:
              "0 0 0 1px color-mix(in oklab, #22c55e 35%, transparent), 0 0 12px rgba(34, 197, 94, 0.4)",
            background: "color-mix(in oklab, #22c55e 18%, var(--background) 90%)",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 600,
            opacity: 0.98,
            transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
            marginLeft: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
            e.currentTarget.style.boxShadow =
              "0 0 0 1px color-mix(in oklab, #22c55e 45%, transparent), 0 0 18px rgba(34, 197, 94, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow =
              "0 0 0 1px color-mix(in oklab, #22c55e 35%, transparent), 0 0 12px rgba(34, 197, 94, 0.4)";
          }}
        >
          Add Listings Row
        </button>
        <button
          onClick={handleRemoveLastListingsRow}
          style={{
            padding: "0.45rem 0.85rem",
            borderRadius: "8px",
            border: "1px solid color-mix(in oklab, #ef4444 55%, transparent)",
            boxShadow:
              "0 0 0 1px color-mix(in oklab, #ef4444 30%, transparent), 0 0 10px rgba(239, 68, 68, 0.4)",
            background: "color-mix(in oklab, #ef4444 16%, var(--background) 92%)",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 600,
            opacity: 0.96,
            transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
            e.currentTarget.style.boxShadow =
              "0 0 0 1px color-mix(in oklab, #ef4444 40%, transparent), 0 0 14px rgba(239, 68, 68, 0.55)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow =
              "0 0 0 1px color-mix(in oklab, #ef4444 30%, transparent), 0 0 10px rgba(239, 68, 68, 0.4)";
          }}
        >
          Remove Row
        </button>
      </div>

      <div className="listings-carousel" aria-label="Listings carousel">
        <div className="listings-row">
          {carouselListings.map((listing, index) => {
            const isRemoved = removedCardIds.has(listing.id);

            return (
              <article
                key={`${listing.id}-${index}`}
                className={`listing-card listing-card-${listing.status.toLowerCase()} listing-card-animated`}
                onClick={() => handleCardClick(listing)}
                style={{
                  cursor: isRemoved ? "default" : "pointer",
                  animationDelay: `${index * 40}ms`,
                }}
              >
                <header className="listing-card-header">
                  <div className="listing-card-title">{listing.name}</div>
                  <div className="listing-card-price">{listing.price}</div>
                </header>

                <p className="listing-card-description">{listing.description}</p>

                <div className="listing-card-meta">
                  <span
                    className={`listing-status listing-status-${listing.status.toLowerCase()}`}
                  >
                    {listing.status}
                  </span>
                  <span className="listing-risk-label">{listing.risk}% risk</span>
                </div>

                <div className="listing-risk-bar" aria-hidden="true">
                  <div
                    className="listing-risk-bar-fill"
                    style={{ width: `${listing.risk}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {extraListingRows.length > 0 && (
        <div className="listings-carousel" aria-label="Extra listings rows">
          {extraListingRows.map((row, rowIndex) => (
            <div key={`extra-row-${rowIndex}`} className="listings-row">
              {row
                .filter((listing) => !removedCardIds.has(listing.id) && matchesFilters(listing))
                .map((listing) => {
                  const isRemoved = removedCardIds.has(listing.id);

                  return (
                    <article
                      key={`extra-${listing.id}`}
                      className={`listing-card listing-card-${listing.status.toLowerCase()}`}
                      onClick={() => handleCardClick(listing)}
                      style={{
                        cursor: isRemoved ? "default" : "pointer",
                      }}
                    >
                      <header className="listing-card-header">
                        <div className="listing-card-title">{listing.name}</div>
                        <div className="listing-card-price">{listing.price}</div>
                      </header>

                      <p className="listing-card-description">{listing.description}</p>

                      <div className="listing-card-meta">
                        <span
                          className={`listing-status listing-status-${listing.status.toLowerCase()}`}
                        >
                          {listing.status}
                        </span>
                        <span className="listing-risk-label">{listing.risk}% risk</span>
                      </div>

                      <div className="listing-risk-bar" aria-hidden="true">
                        <div
                          className="listing-risk-bar-fill"
                          style={{ width: `${listing.risk}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
            </div>
          ))}
        </div>
      )}

      <div className="listings-carousel" aria-label="Fast listings carousel">
        <div className="listings-row listings-row-fast">
          {carouselListingsFast.map((listing, index) => {
            const isRemoved = removedCardIds.has(listing.id);

            return (
              <article
                key={`fast-${listing.id}-${index}`}
                className={`listing-card listing-card-${listing.status.toLowerCase()}`}
                onClick={() => handleCardClick(listing)}
                style={{
                  cursor: isRemoved ? "default" : "pointer",
                }}
              >
                <header className="listing-card-header">
                  <div className="listing-card-title">{listing.name}</div>
                  <div className="listing-card-price">{listing.price}</div>
                </header>

                <p className="listing-card-description">{listing.description}</p>

                <div className="listing-card-meta">
                  <span
                    className={`listing-status listing-status-${listing.status.toLowerCase()}`}
                  >
                    {listing.status}
                  </span>
                  <span className="listing-risk-label">{listing.risk}% risk</span>
                </div>

                <div className="listing-risk-bar" aria-hidden="true">
                  <div
                    className="listing-risk-bar-fill"
                    style={{ width: `${listing.risk}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {removedCards.length > 0 && (
        <div className="listings-display">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 className="listings-display-title">Selected Listings</h2>
            <button
              onClick={handleMoveToInventory}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#4a90e2",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#357abd";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#4a90e2";
              }}
            >
              Move to Inventory
            </button>
          </div>
          <div className="listings-display-grid">
            {removedCards.map((listing, index) => (
              <article
                key={`display-${listing.id}-${index}`}
                className={`listing-card listing-card-${listing.status.toLowerCase()}`}
                onClick={() => handleViewItemGraph(listing)}
                style={{ cursor: "pointer" }}
              >
                <header className="listing-card-header">
                  <div className="listing-card-title">{listing.name}</div>
                  <div className="listing-card-price">{listing.price}</div>
                </header>

                <p className="listing-card-description">{listing.description}</p>

                <div className="listing-card-meta">
                  <span
                    className={`listing-status listing-status-${listing.status.toLowerCase()}`}
                  >
                    {listing.status}
                  </span>
                  <span className="listing-risk-label">{listing.risk}% risk</span>
                </div>

                <div className="listing-risk-bar" aria-hidden="true">
                  <div
                    className="listing-risk-bar-fill"
                    style={{ width: `${listing.risk}%` }}
                  />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCard(listing);
                    // Clear graph if removing the selected item
                    if (selectedItemForGraph?.id === listing.id) {
                      setSelectedItemForGraph(null);
                    }
                  }}
                  style={{
                    marginTop: "12px",
                    padding: "0.5rem 1rem",
                    width: "100%",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "#dc2626";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "#ef4444";
                  }}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
        </div>

        {/* Price Graph Panel */}
        {selectedItemForGraph && (
          <div style={{
            border: "1px solid color-mix(in oklab, var(--foreground) 12%, transparent)",
            borderRadius: "14px",
            padding: "20px",
            background: "color-mix(in oklab, var(--background) 96%, transparent)",
            position: "sticky",
            top: "24px"
          }}>
            <PriceHistoryChart 
              data={generatePriceHistory(selectedItemForGraph)} 
              itemName={selectedItemForGraph.name}
            />
          </div>
        )}
      </div>
    </section>
  );
}

