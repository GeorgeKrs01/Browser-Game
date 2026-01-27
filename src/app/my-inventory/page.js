"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useBalance } from "../../contexts/BalanceContext";
import { useExperience } from "../../contexts/ExperienceContext";
import { XP_REWARDS } from "../../constants/xpRewards";
import { randomPercent, randomPercentRange, randomChance } from "../../utils/rng";
import { calculateDailyPrice, formatPrice, updateAllItemsPriceHistory, cleanupPriceHistory } from "../../utils/pricing";

const STORAGE_KEY_INVENTORY_ITEMS = "inventory-items";
const STORAGE_KEY_DAY = "game-day";
const STORAGE_KEY_LAST_PRICE_UPDATE_DAY = "last-price-update-day";
const STORAGE_KEY_CHECKED_ITEMS = "checked-items";
const STORAGE_KEY_REPAIRED_ITEMS = "repaired-items";
const STORAGE_KEY_DAY_SPEED = "day-speed";
const STORAGE_KEY_SALES_HISTORY = "sales-history";
const MAX_SALES_HISTORY = 20;
const SALES_CAROUSEL_VISIBLE_ICONS = 8; // Number of icons visible in the carousel (adjustable)
const MAX_PRICE_DECREASE_PERCENTAGE = 0.05; // Maximum 5% decrease per day
const MIN_PRICE_DECREASE_PERCENTAGE = 0.00; // Minimum 0% decrease per day
const QUICK_SALE_FLOOR_PRICE_PERCENTAGE = 0.10; // Floor price is 10% of base price for quick sale

// Day speed presets in milliseconds
const DAY_SPEEDS = {
  normal: 60000,  // 1 minute
  fast: 30000,    // 30 seconds
  faster: 1000,   // 1 second
};

/**
 * Calculates the risk-adjusted selling price with volatility
 * Higher risk items have a chance to sell for more OR less (volatility)
 * Lower risk items have more stable prices
 * @param {number} basePrice - The base/stored price of the item
 * @param {number} risk - Risk percentage (0-100)
 * @param {number|null} floorPricePercentage - Optional floor price as percentage of base price (0-1). If null, no floor is applied.
 * @returns {number} - The risk-adjusted selling price
 * 
 * Logic: Risk percentage determines chance of getting a discount
 * - If random < risk: price is reduced (bad outcome)
 * - If random >= risk: price is increased (good outcome)
 * Higher risk = more volatility (bigger swings up or down)
 */
function calculateRiskAdjustedSellingPrice(basePrice, risk, floorPricePercentage = null) {
  // Generate random number between 0-100
  const random = randomPercent();
  
  // Risk determines the chance of getting a discount vs premium
  // Higher risk = higher chance of discount, lower chance of premium
  const getsDiscount = random < risk;
  
  let sellingPrice;
  
  if (getsDiscount) {
    // Bad outcome: price is reduced
    // Higher risk = bigger discount (up to 30% off at 100% risk)
    const discountPercent = (risk / 100) * 0.30; // Max 30% discount
    const multiplier = 1 - discountPercent;
    sellingPrice = Math.max(1, Math.round(basePrice * multiplier));
  } else {
    // Good outcome: price is increased
    // Lower risk = bigger premium (up to 50% bonus at 0% risk)
    const premiumPercent = ((100 - risk) / 100) * 0.50; // Max 50% premium
    const multiplier = 1 + premiumPercent;
    sellingPrice = Math.max(1, Math.round(basePrice * multiplier));
  }
  
  // Apply floor price if specified (for quick sale)
  if (floorPricePercentage !== null) {
    const floorPrice = Math.round(basePrice * floorPricePercentage);
    sellingPrice = Math.max(sellingPrice, floorPrice);
  }
  
  return sellingPrice;
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

export default function MyInventoryPage() {
  const { balance, addBalance, deductBalance } = useBalance();
  const { addExperience } = useExperience();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDay, setCurrentDay] = useState(1);
  const [checkingItems, setCheckingItems] = useState(new Map()); // Map of itemId -> progress (0-100)
  const [priceAnimations, setPriceAnimations] = useState(new Map()); // Map of itemId -> 'green' | 'red' | null
  const [checkedItemIds, setCheckedItemIds] = useState(new Set()); // Set of itemIds that have been checked
  const [oldPrices, setOldPrices] = useState(new Map()); // Map of itemId -> oldPriceFormatted (for displaying old price after check)
  const [insuredItemIds, setInsuredItemIds] = useState(new Set()); // Set of itemIds that have been insured
  const [repairedItemIds, setRepairedItemIds] = useState(new Set()); // Set of itemIds that have been repaired
  const [daySpeed, setDaySpeed] = useState(DAY_SPEEDS.normal);
  const [selectedItemForGraph, setSelectedItemForGraph] = useState(null);
  const [salesHistory, setSalesHistory] = useState([]); // Array of sales history entries
  const [newTransactionIds, setNewTransactionIds] = useState(new Set()); // Track newly added transactions for animation

  // Load inventory items from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    const saved = localStorage.getItem(STORAGE_KEY_INVENTORY_ITEMS);
    let loadedItems = [];
    if (saved) {
      try {
        loadedItems = JSON.parse(saved);
        // Migrate old items: if basePrice doesn't exist, extract it from price
        const migratedItems = loadedItems.map((item) => {
          if (!item.basePrice) {
            // Extract basePrice from current price (for backward compatibility)
            const currentPrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
            return {
              ...item,
              basePrice: currentPrice,
            };
          }
          return item;
        });
        setInventoryItems(migratedItems);
      } catch (e) {
        // Invalid data, ignore
      }
    }

    // Load current day
    const currentDayStr = localStorage.getItem(STORAGE_KEY_DAY);
    if (currentDayStr) {
      try {
        setCurrentDay(parseInt(currentDayStr, 10));
      } catch (e) {
        // Invalid data, ignore
      }
    }

    // Initialize last price update day if not set
    const lastUpdateDayStr = localStorage.getItem(STORAGE_KEY_LAST_PRICE_UPDATE_DAY);
    if (currentDayStr && !lastUpdateDayStr) {
      localStorage.setItem(STORAGE_KEY_LAST_PRICE_UPDATE_DAY, currentDayStr);
    }

    // Load checked items (only for items that exist in current inventory)
    const savedCheckedItems = localStorage.getItem(STORAGE_KEY_CHECKED_ITEMS);
    if (savedCheckedItems) {
      try {
        const checkedIds = JSON.parse(savedCheckedItems);
        // Filter to only include IDs that exist in current inventory
        const currentItemIds = new Set(loadedItems.map(item => item.id));
        const filteredCheckedIds = checkedIds.filter(id => currentItemIds.has(id));
        setCheckedItemIds(new Set(filteredCheckedIds));
      } catch (e) {
        // Invalid data, ignore
      }
    }

    // Load repaired items (only for items that exist in current inventory)
    const savedRepairedItems = localStorage.getItem(STORAGE_KEY_REPAIRED_ITEMS);
    if (savedRepairedItems) {
      try {
        const repairedIds = JSON.parse(savedRepairedItems);
        // Filter to only include IDs that exist in current inventory
        const currentItemIds = new Set(loadedItems.map(item => item.id));
        const filteredRepairedIds = repairedIds.filter(id => currentItemIds.has(id));
        setRepairedItemIds(new Set(filteredRepairedIds));
      } catch (e) {
        // Invalid data, ignore
      }
    }

    // Load day speed
    const savedSpeed = localStorage.getItem(STORAGE_KEY_DAY_SPEED);
    if (savedSpeed) {
      try {
        const speed = parseInt(savedSpeed, 10);
        if (speed > 0) {
          setDaySpeed(speed);
        }
      } catch (e) {
        // Invalid data, ignore
      }
    }

    // Load sales history
    const savedSalesHistory = localStorage.getItem(STORAGE_KEY_SALES_HISTORY);
    if (savedSalesHistory) {
      try {
        const history = JSON.parse(savedSalesHistory);
        if (Array.isArray(history)) {
          // Filter and validate entries, ensuring all have required properties
          const validHistory = history
            .filter(sale => 
              sale && 
              typeof sale.profit === 'number' && 
              typeof sale.amount === 'number' && 
              !isNaN(sale.profit) && 
              !isNaN(sale.amount)
            )
            .map(sale => ({
              profit: sale.profit,
              amount: Math.abs(sale.profit || 0),
              timestamp: sale.timestamp || Date.now(),
            }))
            .slice(-MAX_SALES_HISTORY);
          setSalesHistory(validHistory);
        }
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, []);

  // Sync day from localStorage periodically and listen for storage events
  useEffect(() => {
    if (!isHydrated) return;

    const syncDay = () => {
      const currentDayStr = localStorage.getItem(STORAGE_KEY_DAY);
      if (currentDayStr) {
        try {
          const day = parseInt(currentDayStr, 10);
          if (!isNaN(day)) {
            setCurrentDay(day);
          }
        } catch (e) {
          // Invalid data, ignore
        }
      }
    };

    const syncDaySpeed = () => {
      const savedSpeed = localStorage.getItem(STORAGE_KEY_DAY_SPEED);
      if (savedSpeed) {
        try {
          const speed = parseInt(savedSpeed, 10);
          if (speed > 0 && speed !== daySpeed) {
            setDaySpeed(speed);
          }
        } catch (e) {
          // Invalid data, ignore
        }
      }
    };

    // Sync immediately
    syncDay();
    syncDaySpeed();

    // Listen for storage events (when day or speed changes in other tabs/components)
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
      } else if (e.key === STORAGE_KEY_DAY_SPEED && e.newValue) {
        try {
          const speed = parseInt(e.newValue, 10);
          if (speed > 0) {
            setDaySpeed(speed);
          }
        } catch (e) {
          // Invalid data, ignore
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also check periodically (in case storage events don't fire for same-tab updates)
    const interval = setInterval(() => {
      syncDay();
      syncDaySpeed();
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [isHydrated, daySpeed]);

  // Save inventory items to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_INVENTORY_ITEMS, JSON.stringify(inventoryItems));
    }
  }, [inventoryItems, isHydrated]);

  // Clean up checked items that no longer exist in inventory
  useEffect(() => {
    if (isHydrated) {
      if (inventoryItems.length === 0) {
        // Clear all checked items if inventory is empty
        setCheckedItemIds(new Set());
        setOldPrices(new Map());
        setRepairedItemIds(new Set());
      } else {
        // Filter checked items to only include IDs that exist in current inventory
        const currentItemIds = new Set(inventoryItems.map(item => item.id));
        setCheckedItemIds((prev) => {
          const filtered = new Set();
          prev.forEach((id) => {
            if (currentItemIds.has(id)) {
              filtered.add(id);
            }
          });
          return filtered;
        });
        // Also clean up old prices for items that no longer exist
        setOldPrices((prev) => {
          const filtered = new Map();
          prev.forEach((price, id) => {
            if (currentItemIds.has(id)) {
              filtered.set(id, price);
            }
          });
          return filtered;
        });
        // Clean up repaired items that no longer exist
        setRepairedItemIds((prev) => {
          const filtered = new Set();
          prev.forEach((id) => {
            if (currentItemIds.has(id)) {
              filtered.add(id);
            }
          });
          return filtered;
        });
      }
    }
  }, [inventoryItems, isHydrated]);

  // Save checked items to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_CHECKED_ITEMS, JSON.stringify(Array.from(checkedItemIds)));
    }
  }, [checkedItemIds, isHydrated]);

  // Save repaired items to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_REPAIRED_ITEMS, JSON.stringify(Array.from(repairedItemIds)));
    }
  }, [repairedItemIds, isHydrated]);

  // Save sales history to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_SALES_HISTORY, JSON.stringify(salesHistory));
    }
  }, [salesHistory, isHydrated]);

  // Calculate daily prices for inventory items based on current day
  // This creates a memoized version of items with daily fluctuating prices
  const itemsWithDailyPrices = useMemo(() => {
    if (!isHydrated) return [];
    if (inventoryItems.length === 0) return [];
    
    return inventoryItems.map((item) => {
      // Get basePrice (should exist after migration, but fallback to current price)
      const basePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      
      // Calculate daily price based on current day
      const dailyPrice = calculateDailyPrice(
        basePrice,
        currentDay,
        item.id,
        item.name || "Unknown Item"
      );
      
      return {
        ...item,
        basePrice: basePrice, // Ensure basePrice is set
        price: formatPrice(dailyPrice), // Update price to daily price
        dailyPrice: dailyPrice, // Store numeric value for calculations
      };
    });
  }, [inventoryItems, currentDay, isHydrated]);

  // Track price history when day changes or when items are added
  useEffect(() => {
    if (!isHydrated || inventoryItems.length === 0) return;
    
    // Update price history for all items when day changes or when new items are added
    updateAllItemsPriceHistory(inventoryItems, currentDay);
  }, [currentDay, inventoryItems, isHydrated]);

  // Clean up price history for items that no longer exist
  useEffect(() => {
    if (!isHydrated) return;
    
    cleanupPriceHistory(inventoryItems);
  }, [inventoryItems, isHydrated]);

  const handleItemClick = (itemId) => {
    // Allow selecting items even if they've been checked (for selling)
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    
    // Set selected item for graph
    const item = itemsWithDailyPrices.find(i => i.id === itemId);
    if (item) {
      setSelectedItemForGraph(item);
    }
  };

  /**
   * Gets the next status tier for an item
   * Progression: Damaged -> Common -> Uncommon -> Rare -> Legendary
   * @param {string} currentStatus - Current status of the item
   * @returns {string|null} - Next status tier, or null if already at max (Legendary)
   */
  function getNextStatus(currentStatus) {
    const statusProgression = ["Damaged", "Common", "Uncommon", "Rare", "Legendary"];
    const currentIndex = statusProgression.indexOf(currentStatus);
    
    if (currentIndex === -1 || currentIndex === statusProgression.length - 1) {
      return null; // Already at max or invalid status
    }
    
    return statusProgression[currentIndex + 1];
  }

  const handleCheck = () => {
    if (selectedItemIds.size === 0) {
      return;
    }
    
    // Get selected items from inventoryItems (for state updates)
    const selectedItems = inventoryItems.filter((item) =>
      selectedItemIds.has(item.id)
    );
    
    // Filter out Legendary items (cannot be repaired)
    const legendaryItems = selectedItems.filter(item => item.status === "Legendary");
    const repairableItems = selectedItems.filter(item => item.status !== "Legendary");
    
    // Filter out items that have already been repaired
    const alreadyRepairedItems = repairableItems.filter(item => repairedItemIds.has(item.id));
    const unrepairedItems = repairableItems.filter(item => !repairedItemIds.has(item.id));
    
    if (unrepairedItems.length === 0) {
      if (legendaryItems.length > 0 || alreadyRepairedItems.length > 0) {
        setSelectedItemIds(new Set());
      }
      return;
    }
    
    // Deselect all items immediately
    setSelectedItemIds(new Set());
    
    // Check which items succeed or fail during repair
    // Success: random > risk (item is upgraded)
    // Failure: random <= risk (item is destroyed)
    const successfulRepairs = [];
    const failedRepairs = [];
    
    unrepairedItems.forEach((item) => {
      // Repair succeeds if random chance is greater than risk
      // Repair fails if random chance is less than or equal to risk
      if (!randomChance(item.risk)) {
        // Repair succeeds - item will be upgraded
        successfulRepairs.push(item);
      } else {
        // Repair fails - item will be destroyed
        failedRepairs.push(item);
      }
    });
    
    // Handle failed repairs: remove from inventory and refund if insured
    if (failedRepairs.length > 0) {
      let totalRefund = 0;
      const failedItemIds = failedRepairs.map(item => item.id);
      
      failedRepairs.forEach((item) => {
        if (insuredItemIds.has(item.id)) {
          // Item is insured, refund the item cost (use basePrice for refund)
          const basePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
          totalRefund += basePrice;
        }
      });
      
      // Remove failed items from inventory
      setInventoryItems((prev) =>
        prev.filter((item) => !failedItemIds.includes(item.id))
      );
      
      // Remove from checked items, insured items, and repaired items if they were there
      setCheckedItemIds((prev) => {
        const next = new Set(prev);
        failedItemIds.forEach((id) => next.delete(id));
        return next;
      });
      setInsuredItemIds((prev) => {
        const next = new Set(prev);
        failedItemIds.forEach((id) => next.delete(id));
        return next;
      });
      setRepairedItemIds((prev) => {
        const next = new Set(prev);
        failedItemIds.forEach((id) => next.delete(id));
        return next;
      });
      
      // Refund insured items
      if (totalRefund > 0) {
        addBalance(totalRefund);
        const refundFormatted = totalRefund.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
      }
    }
    
    // If all repairs failed, stop here
    if (successfulRepairs.length === 0) {
      return;
    }
    
    // Store old prices and statuses for successful repairs
    const oldPricesMap = new Map();
    const statusUpgrades = new Map(); // Map of itemId -> { newStatus, newPrice, newPriceFormatted }
    const successfulItemIds = successfulRepairs.map(item => item.id);
    
    successfulRepairs.forEach((item) => {
      // Use basePrice if available, otherwise extract from price
      const basePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      oldPricesMap.set(item.id, basePrice);
      
      // Get next status tier
      const nextStatus = getNextStatus(item.status);
      if (nextStatus) {
        // Increase price by 25% on successful repair
        const newPrice = Math.round(basePrice * 1.25);
        const newPriceFormatted = newPrice.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
        
        statusUpgrades.set(item.id, {
          newStatus: nextStatus,
          newPrice: newPrice,
          newPriceFormatted: newPriceFormatted,
          oldPriceFormatted: item.price, // Store the old formatted price for display
        });
      }
    });
    
    // Start repair animation for successful repairs
    const REPAIR_DURATION_MS = 1000; // 1 second
    const UPDATE_INTERVAL_MS = 50; // Update every 50ms for smooth animation
    const progressIncrement = (UPDATE_INTERVAL_MS / REPAIR_DURATION_MS) * 100;

    // Award experience for successful repairs
    const xpGained = successfulItemIds.length * XP_REWARDS.QUICK_SALE_ITEM;
    if (xpGained > 0) {
      addExperience(xpGained);
    }
    
    // Initialize all successful repairs at 0% progress
    setCheckingItems((prev) => {
      const next = new Map(prev);
      successfulItemIds.forEach((id) => {
        next.set(id, 0);
      });
      return next;
    });
    
    // Animate progress for each successful repair
    successfulItemIds.forEach((itemId) => {
      let currentProgress = 0;
      
      const progressInterval = setInterval(() => {
        currentProgress += progressIncrement;
        
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(progressInterval);
          
          // Update progress to 100%
          setCheckingItems((prev) => {
            const next = new Map(prev);
            next.set(itemId, 100);
            return next;
          });
          
          // After a brief delay, apply status upgrade and price increase
          setTimeout(() => {
            const upgrade = statusUpgrades.get(itemId);
            const oldPrice = oldPricesMap.get(itemId);
            
            if (upgrade) {
              // Store formatted old price for display (only after price is about to change)
              if (upgrade.oldPriceFormatted) {
                setOldPrices((prev) => {
                  const next = new Map(prev);
                  next.set(itemId, upgrade.oldPriceFormatted);
                  return next;
                });
              }
              
              // Mark as checked (only after price is about to change)
              setCheckedItemIds((prev) => {
                const next = new Set(prev);
                next.add(itemId);
                return next;
              });
              
              // Mark as repaired (item can only be repaired once)
              setRepairedItemIds((prev) => {
                const next = new Set(prev);
                next.add(itemId);
                return next;
              });
              
              // Trigger green animation for successful upgrade
              setPriceAnimations((prev) => {
                const next = new Map(prev);
                next.set(itemId, 'green');
                return next;
              });
              
              // Update item status and basePrice (daily price will be recalculated)
              setInventoryItems((prevItems) => {
                return prevItems.map((item) => {
                  if (item.id === itemId) {
                    return {
                      ...item,
                      status: upgrade.newStatus,
                      basePrice: upgrade.newPrice, // Update basePrice, not formatted price
                    };
                  }
                  return item;
                });
              });
              
              // Remove animation after duration
              setTimeout(() => {
                setPriceAnimations((prev) => {
                  const next = new Map(prev);
                  next.delete(itemId);
                  return next;
                });
              }, 2000); // Animation duration - 2 seconds
            }
            
            // Remove from checking state
            setCheckingItems((prev) => {
              const next = new Map(prev);
              next.delete(itemId);
              return next;
            });
          }, 200); // Small delay to show 100% completion
        } else {
          // Update progress
          setCheckingItems((prev) => {
            const next = new Map(prev);
            next.set(itemId, currentProgress);
            return next;
          });
        }
      }, UPDATE_INTERVAL_MS);
    });
  };

  const handleInsure = () => {
    if (selectedItemIds.size === 0) {
      return;
    }
    
    // Get selected items from itemsWithDailyPrices (for current price calculations)
    const selectedItems = itemsWithDailyPrices.filter((item) =>
      selectedItemIds.has(item.id)
    );
    
    // Filter out Legendary items (cannot be insured)
    const legendaryItems = selectedItems.filter(item => item.status === "Legendary");
    const insurableItems = selectedItems.filter(item => item.status !== "Legendary");
    
    if (insurableItems.length === 0) {
      if (legendaryItems.length > 0) {
        setSelectedItemIds(new Set());
      }
      return;
    }
    
    // Filter out items that have already been insured
    const uninsuredItemIds = insurableItems
      .filter((item) => !insuredItemIds.has(item.id))
      .map((item) => item.id);
    
    if (uninsuredItemIds.length === 0) {
      return;
    }
    
    // Get the items to insure from itemsWithDailyPrices (for current price calculations)
    const itemsToInsure = itemsWithDailyPrices.filter((item) =>
      uninsuredItemIds.includes(item.id)
    );
    
    // Calculate total insurance cost (scales with risk: lower risk = lower cost, higher risk = higher cost)
    // Formula: baseCost (10%) + risk adjustment
    // Higher risk items cost more to insure (up to 60% at 100% risk)
    // Lower risk items cost less to insure (down to 10% at 0% risk)
    const totalCost = itemsToInsure.reduce((sum, item) => {
      // Use dailyPrice for insurance cost calculation
      const itemPrice = item.dailyPrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      // Base cost: 10% of item value
      // Risk adjustment: add 0.5% per 1% of risk
      // Range: 10% (0% risk) to 60% (100% risk)
      const basePercentage = 0.10; // 10% base
      const riskAdjustment = item.risk * 0.005; // 0.5% per risk point
      const insurancePercentage = basePercentage + riskAdjustment;
      const insuranceCost = Math.round(itemPrice * insurancePercentage);
      return sum + insuranceCost;
    }, 0);
    
    // Check if player has enough balance
    if (balance < totalCost) {
      const totalCostFormatted = totalCost.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
      return;
    }
    
    // Deduct balance
    deductBalance(totalCost);
    
    // Mark items as insured
    setInsuredItemIds((prev) => {
      const next = new Set(prev);
      uninsuredItemIds.forEach((id) => {
        next.add(id);
      });
      return next;
    });
    
    // Deselect all items
    setSelectedItemIds(new Set());
  };

  const handleResetDays = () => {
    // Reset day to 1
    localStorage.setItem(STORAGE_KEY_DAY, "1");
    setCurrentDay(1);
    
    // Reset last price update day
    localStorage.setItem(STORAGE_KEY_LAST_PRICE_UPDATE_DAY, "1");
    
    // Trigger storage event for other tabs/components
    window.dispatchEvent(new StorageEvent("storage", {
      key: STORAGE_KEY_DAY,
      newValue: "1",
    }));
    
  };

  const handleSetDaySpeed = (speedName) => {
    const speed = DAY_SPEEDS[speedName];
    if (speed) {
      localStorage.setItem(STORAGE_KEY_DAY_SPEED, speed.toString());
      setDaySpeed(speed);
      
      // Trigger storage event for other tabs/components
      window.dispatchEvent(new StorageEvent("storage", {
        key: STORAGE_KEY_DAY_SPEED,
        newValue: speed.toString(),
      }));
      
    }
  };

  const handleQuickSale = () => {
    if (selectedItemIds.size === 0) {
      return;
    }
    
    // Use itemsWithDailyPrices to get items with their daily prices for accurate calculations
    const selectedItems = itemsWithDailyPrices.filter((item) =>
      selectedItemIds.has(item.id)
    );
    
    // All items are sold - no items are lost in quick sale
    // Always receive the full market price (dailyPrice) for each item
    const itemsSold = selectedItems;
    
    // Calculate money gained from sold items (always use full market price)
    const moneyGained = itemsSold.reduce((sum, item) => {
      // Always use the full market price (dailyPrice) - no risk adjustment
      const marketPrice = item.dailyPrice || item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      return sum + marketPrice;
    }, 0);
    
    // Calculate total margin: sale_price - (purchase_price + insurance_cost)
    const totalMargin = itemsSold.reduce((sum, item) => {
      // Get purchase price (basePrice is the original purchase price)
      const purchasePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      
      // Calculate insurance cost if item was insured
      let insuranceCost = 0;
      if (insuredItemIds.has(item.id)) {
        // Use the same formula as handleInsure, but use basePrice (purchase price) for consistency
        const basePercentage = 0.10; // 10% base
        const riskAdjustment = item.risk * 0.005; // 0.5% per risk point
        const insurancePercentage = basePercentage + riskAdjustment;
        insuranceCost = Math.round(purchasePrice * insurancePercentage);
      }
      
      // Always use the full market price (dailyPrice) - no risk adjustment
      const marketPrice = item.dailyPrice || item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      
      // Margin = sale_price - (purchase_price + insurance_cost)
      const margin = marketPrice - (purchasePrice + insuranceCost);
      return sum + margin;
    }, 0);
    
    // Add balance for sold items (always receive full market price)
    if (moneyGained > 0) {
      addBalance(moneyGained);
    }
    
    // Award experience for sold items
    const xpGained = itemsSold.length * XP_REWARDS.QUICK_SALE_ITEM;
    if (xpGained > 0) {
      addExperience(xpGained);
    }
    
    // Record sales history for sold items
    if (itemsSold.length > 0) {
      const baseTimestamp = Date.now();
      const newSales = itemsSold.map((item, index) => {
        // Always use the full market price (dailyPrice) - no risk adjustment
        const marketPrice = item.dailyPrice || item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
        const purchasePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
        const profit = marketPrice - purchasePrice;
        
        return {
          profit: profit,
          amount: Math.abs(profit),
          timestamp: baseTimestamp + index, // Ensure unique timestamps even for simultaneous sales
        };
      });
      
      // Add new sales to history and keep only last MAX_SALES_HISTORY entries
      setSalesHistory((prev) => {
        const updated = [...prev, ...newSales];
        const final = updated.slice(-MAX_SALES_HISTORY);
        
        // Mark new transactions for animation
        const newIds = new Set(newSales.map(sale => sale.timestamp));
        setNewTransactionIds(newIds);
        
        // Clear animation class after animation completes
        setTimeout(() => {
          setNewTransactionIds(new Set());
        }, 600); // Match animation duration
        
        return final;
      });
    }
    
    // Remove all selected items
    setInventoryItems((prev) =>
      prev.filter((item) => !selectedItemIds.has(item.id))
    );
    setSelectedItemIds(new Set());
    
    // Show individual notifications for each transaction
    itemsSold.forEach((item) => {
      // Get purchase price (basePrice is the original purchase price)
      const purchasePrice = item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      
      // Calculate insurance cost if item was insured
      let insuranceCost = 0;
      if (insuredItemIds.has(item.id)) {
        // Use the same formula as handleInsure, but use basePrice (purchase price) for consistency
        const basePercentage = 0.10; // 10% base
        const riskAdjustment = item.risk * 0.005; // 0.5% per risk point
        const insurancePercentage = basePercentage + riskAdjustment;
        insuranceCost = Math.round(purchasePrice * insurancePercentage);
      }
      
      // Always use the full market price (dailyPrice) - no risk adjustment
      const marketPrice = item.dailyPrice || item.basePrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      
      // Margin = sale_price - (purchase_price + insurance_cost)
      const margin = marketPrice - (purchasePrice + insuranceCost);
      
      const marginFormatted = margin.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
      
      const marketPriceFormatted = marketPrice.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
      
    });
  };

  const handleSelectAll = () => {
    if (inventoryItems.length === 0) {
      return;
    }
    
    // If all items are selected, deselect all
    // Otherwise, select all items
    const allItemIds = new Set(inventoryItems.map(item => item.id));
    const allSelected = inventoryItems.length > 0 && 
      inventoryItems.every(item => selectedItemIds.has(item.id));
    
    if (allSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(allItemIds);
    }
  };

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

  return (
    <section className="page inventory-page">
      <h1 className="page-title">My Inventory</h1>
      <p className="page-subtitle">
        {inventoryItems.length === 0
          ? "Your inventory is empty. Select items from listings to add them here."
          : `You have ${inventoryItems.length} item${inventoryItems.length === 1 ? "" : "s"} in your inventory.`}
      </p>

      {/* Sales History Icons */}
      {salesHistory.length > 0 && (() => {
        // Filter out invalid entries and ensure all have required properties
        const validSales = salesHistory.filter(sale => 
          sale && 
          typeof sale.profit === 'number' && 
          typeof sale.amount === 'number' && 
          !isNaN(sale.profit) && 
          !isNaN(sale.amount)
        );
        
        if (validSales.length === 0) return null;
        
        // Show only the last N transactions (most recent)
        const recentSales = validSales.slice(-SALES_CAROUSEL_VISIBLE_ICONS);
        const iconGap = 8;
        
        return (
          <div 
            style={{
              marginTop: "1rem",
              marginBottom: "1rem",
              width: "100%",
              maxWidth: "100%",
              position: "relative",
              overflowX: "auto",
            }}
          >
            <div 
              style={{
                display: "flex",
                gap: `${iconGap}px`,
                alignItems: "flex-end",
                width: "max-content",
                position: "relative",
              }}
            >
              {recentSales.map((sale, index) => {
                const isProfit = sale.profit >= 0;
                
                // Ensure amount is a valid number
                const amount = typeof sale.amount === 'number' && !isNaN(sale.amount) && sale.amount >= 0 ? sale.amount : 0;
                const isZeroAmount = amount === 0 || sale.profit === 0;
                
                // Calculate opacity gradient from right (1.0) to left (0.3)
                const totalItems = recentSales.length;
                const progress = index / (totalItems - 1 || 1); // 0 (left) to 1 (right)
                const opacity = 0.3 + (progress * 0.7); // Fade from 0.3 (left) to 1.0 (right)
                
                const isNewTransaction = sale.timestamp && newTransactionIds.has(sale.timestamp);
                
                // Determine colors based on amount
                const borderColor = isZeroAmount ? "#6b7280" : (isProfit ? "#22c55e" : "#ef4444");
                const backgroundColor = isZeroAmount ? "rgba(107, 114, 128, 0.1)" : (isProfit ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)");
                const boxShadowColor = isZeroAmount ? "rgba(107, 114, 128, 0.2)" : (isProfit ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)");
                const textColor = isZeroAmount ? "#6b7280" : (isProfit ? "#22c55e" : "#ef4444");
                
                return (
                  <div
                    key={`sale-${sale.timestamp || index}-${index}`}
                    className={`amount-card amount-card-5 ${isNewTransaction ? 'transaction-new' : ''}`}
                    style={{
                      height: "auto",
                      minHeight: "36px",
                      minWidth: "fit-content",
                      width: "auto",
                      flexShrink: 0,
                      flexDirection: "row",
                      gap: "6px",
                      padding: "4px 12px",
                      borderColor: borderColor,
                      background: backgroundColor,
                      boxShadow: `0 2px 8px ${boxShadowColor}`,
                      opacity: opacity,
                      transition: "opacity 0.3s ease",
                    }}
                    title={`${isProfit ? "Profit" : "Loss"}: ${formatPrice(amount)}`}
                  >
                    {!isZeroAmount && (
                      isProfit ? (
                        <ChevronUp className="amount-card-icon" size={18} style={{ color: textColor, flexShrink: 0 }} />
                      ) : (
                        <ChevronDown className="amount-card-icon" size={18} style={{ color: textColor, flexShrink: 0 }} />
                      )
                    )}
                    <div className="amount-card-value" style={{ 
                      color: textColor,
                      fontSize: "13px",
                      fontWeight: "600",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                    }}>
                      {formatPrice(amount)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Gradient overlay for smooth fade */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: "100px",
                background: `linear-gradient(to right, var(--background), transparent)`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          </div>
        );
      })()}

      <div style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "1rem",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <button
          onClick={handleResetDays}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#e74c3c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: "500",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#c0392b";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#e74c3c";
          }}
        >
          Reset Days
        </button>
        
        <div style={{ 
          display: "flex", 
          gap: "0.5rem",
          alignItems: "center",
          marginLeft: "0.5rem"
        }}>
          <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>Day Speed:</span>
          <button
            onClick={() => handleSetDaySpeed("normal")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: daySpeed === DAY_SPEEDS.normal ? "#4a90e2" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "500",
              opacity: daySpeed === DAY_SPEEDS.normal ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
              if (daySpeed !== DAY_SPEEDS.normal) {
                e.target.style.backgroundColor = "#999";
              }
            }}
            onMouseLeave={(e) => {
              if (daySpeed !== DAY_SPEEDS.normal) {
                e.target.style.backgroundColor = "#ccc";
              }
            }}
          >
            Normal
          </button>
          <button
            onClick={() => handleSetDaySpeed("fast")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: daySpeed === DAY_SPEEDS.fast ? "#4a90e2" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "500",
              opacity: daySpeed === DAY_SPEEDS.fast ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
              if (daySpeed !== DAY_SPEEDS.fast) {
                e.target.style.backgroundColor = "#999";
              }
            }}
            onMouseLeave={(e) => {
              if (daySpeed !== DAY_SPEEDS.fast) {
                e.target.style.backgroundColor = "#ccc";
              }
            }}
          >
            Fast
          </button>
          <button
            onClick={() => handleSetDaySpeed("faster")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: daySpeed === DAY_SPEEDS.faster ? "#4a90e2" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "500",
              opacity: daySpeed === DAY_SPEEDS.faster ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
              if (daySpeed !== DAY_SPEEDS.faster) {
                e.target.style.backgroundColor = "#999";
              }
            }}
            onMouseLeave={(e) => {
              if (daySpeed !== DAY_SPEEDS.faster) {
                e.target.style.backgroundColor = "#ccc";
              }
            }}
          >
            Faster
          </button>
        </div>
      </div>

      {inventoryItems.length > 0 && (
        <div className="listings-layout">
          <div className="listings-container" style={{
            border: "1px solid color-mix(in oklab, var(--foreground) 12%, transparent)",
            borderRadius: "14px",
            padding: "20px",
            background: "color-mix(in oklab, var(--background) 96%, transparent)",
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto"
          }}>
            {/* Buttons section - above the line */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                gap: "1rem",
              }}
            >
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem" }}>
              {selectedItemIds.size > 0 && (
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.8 }}>
                  {selectedItemIds.size} item{selectedItemIds.size === 1 ? "" : "s"} selected
                </p>
              )}
              <button
                onClick={handleSelectAll}
                disabled={inventoryItems.length === 0}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: inventoryItems.length === 0 ? "#ccc" : "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: inventoryItems.length === 0 ? "not-allowed" : "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  opacity: inventoryItems.length === 0 ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (inventoryItems.length > 0) {
                    e.target.style.backgroundColor = "#4b5563";
                  }
                }}
                onMouseLeave={(e) => {
                  if (inventoryItems.length > 0) {
                    e.target.style.backgroundColor = "#6b7280";
                  }
                }}
              >
                {inventoryItems.length > 0 && 
                 inventoryItems.every(item => selectedItemIds.has(item.id))
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(() => {
                // Get selected items
                const selectedItems = inventoryItems.filter((item) =>
                  selectedItemIds.has(item.id)
                );
                
                // Filter out Legendary items (cannot be insured)
                const insurableSelectedItems = selectedItems.filter(
                  (item) => item.status !== "Legendary"
                );
                
                // Check if all insurable selected items have already been insured
                const uninsuredSelectedItems = insurableSelectedItems
                  .filter((item) => !insuredItemIds.has(item.id))
                  .map((item) => item.id);
                const allSelectedInsured = selectedItemIds.size > 0 && uninsuredSelectedItems.length === 0;
                const allSelectedLegendary = selectedItemIds.size > 0 && insurableSelectedItems.length === 0;
                const isInsureButtonDisabled = selectedItemIds.size === 0 || allSelectedInsured || allSelectedLegendary;
                
                // Calculate insurance cost for uninsured selected items (scales with risk)
                let insuranceCost = 0;
                if (uninsuredSelectedItems.length > 0) {
                  const itemsToInsure = itemsWithDailyPrices.filter((item) =>
                    uninsuredSelectedItems.includes(item.id)
                  );
                  insuranceCost = itemsToInsure.reduce((sum, item) => {
                    // Use dailyPrice for insurance cost calculation
                    const itemPrice = item.dailyPrice || parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
                    // Base cost: 10% of item value
                    // Risk adjustment: add 0.5% per 1% of risk
                    // Range: 10% (0% risk) to 60% (100% risk)
                    const basePercentage = 0.10; // 10% base
                    const riskAdjustment = item.risk * 0.005; // 0.5% per risk point
                    const insurancePercentage = basePercentage + riskAdjustment;
                    const cost = Math.round(itemPrice * insurancePercentage);
                    return sum + cost;
                  }, 0);
                }
                
                const costFormatted = insuranceCost > 0 
                  ? insuranceCost.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    })
                  : "";
                
                return (
                  <button
                    onClick={handleInsure}
                    disabled={isInsureButtonDisabled}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: isInsureButtonDisabled ? "#ccc" : "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isInsureButtonDisabled ? "not-allowed" : "pointer",
                      fontSize: "0.9rem",
                      fontWeight: "500",
                      opacity: isInsureButtonDisabled ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isInsureButtonDisabled) {
                        e.target.style.backgroundColor = "#059669";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isInsureButtonDisabled) {
                        e.target.style.backgroundColor = "#10b981";
                      }
                    }}
                  >
                    Insure{costFormatted ? ` (${costFormatted})` : ""}
                  </button>
                );
              })()}
              {(() => {
                // Check if all selected items are Legendary (cannot be repaired) or already repaired
                const selectedItems = inventoryItems.filter((item) =>
                  selectedItemIds.has(item.id)
                );
                const repairableSelectedItems = selectedItems.filter(
                  (item) => item.status !== "Legendary"
                );
                const unrepairedSelectedItems = repairableSelectedItems.filter(
                  (item) => !repairedItemIds.has(item.id)
                );
                const allSelectedLegendary = selectedItemIds.size > 0 && repairableSelectedItems.length === 0;
                const allSelectedRepaired = selectedItemIds.size > 0 && repairableSelectedItems.length > 0 && unrepairedSelectedItems.length === 0;
                const isButtonDisabled = selectedItemIds.size === 0 || allSelectedLegendary || allSelectedRepaired;
                
                return (
                  <button
                    onClick={handleCheck}
                    disabled={isButtonDisabled}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: isButtonDisabled ? "#ccc" : "#4a90e2",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isButtonDisabled ? "not-allowed" : "pointer",
                      fontSize: "0.9rem",
                      fontWeight: "500",
                      opacity: isButtonDisabled ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isButtonDisabled) {
                        e.target.style.backgroundColor = "#357abd";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isButtonDisabled) {
                        e.target.style.backgroundColor = "#4a90e2";
                      }
                    }}
                  >
                    Repair
                  </button>
                );
              })()}
              <button
                onClick={handleQuickSale}
                disabled={selectedItemIds.size === 0}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor:
                    selectedItemIds.size === 0 ? "#ccc" : "#e74c3c",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor:
                    selectedItemIds.size === 0 ? "not-allowed" : "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  opacity: selectedItemIds.size === 0 ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (selectedItemIds.size > 0) {
                    e.target.style.backgroundColor = "#c0392b";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedItemIds.size > 0) {
                    e.target.style.backgroundColor = "#e74c3c";
                  }
                }}
              >
                Quick Sale
              </button>
            </div>
            </div>

            {/* Inventory items grid - below the line */}
            <div className="listings-display" style={{ marginTop: "20px" }}>
              <div className="listings-display-grid">
            {itemsWithDailyPrices.map((item, index) => {
              const isSelected = selectedItemIds.has(item.id);
              const checkProgress = checkingItems.get(item.id);
              const isChecking = checkProgress !== undefined;
              const priceAnimation = priceAnimations.get(item.id);
              const isChecked = checkedItemIds.has(item.id);
              const oldPriceFormatted = oldPrices.get(item.id);
              
              // Determine price color and styles based on animation
              let priceColor = undefined;
              let priceBackground = undefined;
              let priceScale = undefined;
              let priceShadow = undefined;
              
              if (priceAnimation === 'green') {
                priceColor = '#16a34a'; // brighter green
                priceBackground = 'rgba(34, 197, 94, 0.15)'; // light green background
                priceScale = '1.15'; // scale up
                priceShadow = '0 0 12px rgba(34, 197, 94, 0.6)'; // green glow
              } else if (priceAnimation === 'red') {
                priceColor = '#dc2626'; // brighter red
                priceBackground = 'rgba(239, 68, 68, 0.15)'; // light red background
                priceScale = '1.15'; // scale up
                priceShadow = '0 0 12px rgba(239, 68, 68, 0.6)'; // red glow
              } else if (priceAnimation === 'grey') {
                priceColor = '#6b7280'; // grey
                priceBackground = 'rgba(107, 114, 128, 0.15)'; // light grey background
                priceScale = '1.15'; // scale up
                priceShadow = '0 0 12px rgba(107, 114, 128, 0.6)'; // grey glow
              }
              
              // Determine new price color for checked items (after animation)
              let newPriceColor = undefined;
              if (isChecked && !priceAnimation && oldPriceFormatted) {
                const oldPriceNum = parseFloat(oldPriceFormatted.replace(/[^0-9.-]+/g, ""));
                const newPriceNum = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
                // Use lighter color closer to white for all price changes
                newPriceColor = 'rgba(255, 255, 255, 0.85)';
              }
              
              return (
                <article
                  key={`inventory-${item.id}-${index}`}
                  className={`listing-card listing-card-${item.status.toLowerCase()} ${
                    isSelected ? "listing-card-selected" : ""
                  }`}
                  onClick={() => !isChecking && handleItemClick(item.id)}
                  style={{ 
                    cursor: isChecking ? "not-allowed" : "pointer",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: isChecked ? "none" : undefined
                  }}
                >
                {isChecking && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${checkProgress}%`,
                      zIndex: 0,
                      borderRadius: "inherit",
                      background: "linear-gradient(90deg, #6366f1, #a855f7, #e879f9)"
                    }}
                  />
                )}
                
                <div style={{ position: "relative", zIndex: 1 }}>
                  <header className="listing-card-header">
                    <div className="listing-card-title">{item.name}</div>
                    <div 
                      className="listing-card-price"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '2px',
                        minHeight: '2.2em' // Always reserve space for both old and new price to prevent height jump
                      }}
                    >
                      {isChecked && oldPriceFormatted ? (
                        <>
                          <span
                            style={{
                              fontSize: '0.85em',
                              opacity: 0.7,
                              textDecoration: 'line-through',
                              color: '#6b7280',
                              height: '1em',
                              lineHeight: '1em',
                              visibility: 'visible'
                            }}
                          >
                            {oldPriceFormatted}
                          </span>
                          <span
                            style={{
                              ...(priceColor && { color: priceColor }),
                              ...(priceBackground && { 
                                backgroundColor: priceBackground,
                                padding: '2px 6px',
                                borderRadius: '8px',
                                display: 'inline-block'
                              }),
                              ...(priceScale && { transform: `scale(${priceScale})` }),
                              ...(priceShadow && { textShadow: priceShadow }),
                              ...(newPriceColor && !priceColor && { color: newPriceColor }),
                              transition: 'all 0.3s ease-out',
                              fontWeight: (priceColor || newPriceColor) ? '700' : undefined,
                              height: '1.2em',
                              lineHeight: '1.2em'
                            }}
                          >
                            {item.price}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            style={{
                              fontSize: '0.85em',
                              height: '1em',
                              lineHeight: '1em',
                              visibility: 'hidden' // Reserve space but keep it hidden
                            }}
                          >
                            {item.price}
                          </span>
                          <span
                            style={{
                              ...(priceColor && { color: priceColor }),
                              ...(priceBackground && { 
                                backgroundColor: priceBackground,
                                padding: '2px 6px',
                                borderRadius: '8px',
                                display: 'inline-block'
                              }),
                              ...(priceScale && { transform: `scale(${priceScale})` }),
                              ...(priceShadow && { textShadow: priceShadow }),
                              transition: 'all 0.3s ease-out',
                              fontWeight: priceColor ? '700' : undefined,
                              height: '1.2em',
                              lineHeight: '1.2em'
                            }}
                          >
                            {item.price}
                          </span>
                        </>
                      )}
                    </div>
                  </header>

                  <p className="listing-card-description">{item.description}</p>

                  <div className="listing-card-meta">
                    <span
                      className={`listing-status listing-status-${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                    <span className="listing-risk-label">{item.risk}% risk</span>
                  </div>

                  <div className="listing-risk-bar" aria-hidden="true">
                    <div
                      className="listing-risk-bar-fill"
                      style={{ width: `${item.risk}%` }}
                    />
                  </div>
                </div>
              </article>
              );
            })}
            </div>
          </div>
          </div>

          {/* Price Graph Panel */}
          {selectedItemForGraph && (
            <div className="inventory-sidebar" style={{
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
      )}
    </section>
  );
}
