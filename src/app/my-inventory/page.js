"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useBalance } from "../../contexts/BalanceContext";
import { useExperience } from "../../contexts/ExperienceContext";
import { XP_REWARDS } from "../../constants/xpRewards";
import { randomPercent, randomPercentRange, randomChance } from "../../utils/rng";

const STORAGE_KEY_INVENTORY_ITEMS = "inventory-items";
const STORAGE_KEY_DAY = "game-day";
const STORAGE_KEY_LAST_PRICE_UPDATE_DAY = "last-price-update-day";
const STORAGE_KEY_CHECKED_ITEMS = "checked-items";
const STORAGE_KEY_REPAIRED_ITEMS = "repaired-items";
const STORAGE_KEY_DAY_SPEED = "day-speed";
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

  // Load inventory items from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    const saved = localStorage.getItem(STORAGE_KEY_INVENTORY_ITEMS);
    let loadedItems = [];
    if (saved) {
      try {
        loadedItems = JSON.parse(saved);
        setInventoryItems(loadedItems);
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

  // Monitor day changes and decrease prices when a new day occurs
  useEffect(() => {
    if (!isHydrated) return;

    // Get last processed day
    const lastUpdateDayStr = localStorage.getItem(STORAGE_KEY_LAST_PRICE_UPDATE_DAY);
    const lastUpdateDay = lastUpdateDayStr ? parseInt(lastUpdateDayStr, 10) : null;

    // If it's a new day and we haven't processed it yet
    if (lastUpdateDay === null || currentDay > lastUpdateDay) {
      // Decrease prices for all inventory items
      setInventoryItems((prevItems) => {
        if (prevItems.length === 0) {
          // Still update last processed day even if no items
          localStorage.setItem(STORAGE_KEY_LAST_PRICE_UPDATE_DAY, currentDay.toString());
          return prevItems;
        }

        const updatedItems = prevItems.map((item) => {
          const currentPrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
          
          // Generate a random decrease percentage between 0% and 5% for this item
          // Each item gets a different random percentage each day
          const randomDecreasePercent = randomPercentRange(
            MIN_PRICE_DECREASE_PERCENTAGE,
            MAX_PRICE_DECREASE_PERCENTAGE
          );
          
          const newPrice = Math.max(1, Math.round(currentPrice * (1 - randomDecreasePercent)));
          
          const newPriceFormatted = newPrice.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          });

          return {
            ...item,
            price: newPriceFormatted,
          };
        });

        // Update last processed day
        localStorage.setItem(STORAGE_KEY_LAST_PRICE_UPDATE_DAY, currentDay.toString());
        return updatedItems;
      });
    }
  }, [isHydrated, currentDay]);

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
      toast.error("Please select items to repair.");
      return;
    }
    
    // Get selected items
    const selectedItems = inventoryItems.filter((item) =>
      selectedItemIds.has(item.id)
    );
    
    // Filter out Legendary items (cannot be repaired)
    const legendaryItems = selectedItems.filter(item => item.status === "Legendary");
    const repairableItems = selectedItems.filter(item => item.status !== "Legendary");
    
    // Filter out items that have already been repaired
    const alreadyRepairedItems = repairableItems.filter(item => repairedItemIds.has(item.id));
    const unrepairedItems = repairableItems.filter(item => !repairedItemIds.has(item.id));
    
    if (legendaryItems.length > 0) {
      toast.error("Legendary items cannot be repaired.", { duration: 3000 });
    }
    
    if (alreadyRepairedItems.length > 0) {
      toast.error("Some items have already been repaired and cannot be repaired again.", { duration: 3000 });
    }
    
    if (unrepairedItems.length === 0) {
      if (legendaryItems.length > 0 || alreadyRepairedItems.length > 0) {
        setSelectedItemIds(new Set());
      } else {
        toast.error("Please select items to repair.");
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
          // Item is insured, refund the item cost
          const itemPrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
          totalRefund += itemPrice;
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
        toast.error(
          `💥 ${failedRepairs.length} item(s) destroyed during repair! ${totalRefund > 0 ? `Insurance refunded ${refundFormatted}.` : ""}`,
          { duration: 5000 }
        );
      } else {
        toast.error(
          `💥 ${failedRepairs.length} item(s) destroyed during repair!`,
          { duration: 5000 }
        );
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
      const basePrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
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
    const xpGained = successfulItemIds.length * XP_REWARDS.CHECK_ITEM_PRICE;
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
              
              // Update item status and price
              setInventoryItems((prevItems) => {
                return prevItems.map((item) => {
                  if (item.id === itemId) {
                    return {
                      ...item,
                      status: upgrade.newStatus,
                      price: upgrade.newPriceFormatted,
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
    
    // Show success toast
    if (successfulRepairs.length > 0) {
      toast.success(
        `✨ ${successfulRepairs.length} item(s) successfully repaired and upgraded!`,
        { duration: 3000 }
      );
    }
  };

  const handleInsure = () => {
    if (selectedItemIds.size === 0) {
      toast.error("Please select items to insure.");
      return;
    }
    
    // Get selected items
    const selectedItems = inventoryItems.filter((item) =>
      selectedItemIds.has(item.id)
    );
    
    // Filter out Legendary items (cannot be insured)
    const legendaryItems = selectedItems.filter(item => item.status === "Legendary");
    const insurableItems = selectedItems.filter(item => item.status !== "Legendary");
    
    if (legendaryItems.length > 0) {
      toast.error("Legendary items cannot be insured.", { duration: 3000 });
    }
    
    if (insurableItems.length === 0) {
      if (legendaryItems.length > 0) {
        setSelectedItemIds(new Set());
      } else {
        toast.error("Please select items to insure.");
      }
      return;
    }
    
    // Filter out items that have already been insured
    const uninsuredItemIds = insurableItems
      .filter((item) => !insuredItemIds.has(item.id))
      .map((item) => item.id);
    
    if (uninsuredItemIds.length === 0) {
      toast.error("All selected items have already been insured.");
      return;
    }
    
    if (uninsuredItemIds.length < insurableItems.length) {
      toast(`Only insuring ${uninsuredItemIds.length} uninsured item(s).`, { duration: 2000 });
    }
    
    // Get the items to insure
    const itemsToInsure = inventoryItems.filter((item) =>
      uninsuredItemIds.includes(item.id)
    );
    
    // Calculate total insurance cost (scales with risk: lower risk = lower cost, higher risk = higher cost)
    // Formula: baseCost (10%) + risk adjustment
    // Higher risk items cost more to insure (up to 60% at 100% risk)
    // Lower risk items cost less to insure (down to 10% at 0% risk)
    const totalCost = itemsToInsure.reduce((sum, item) => {
      const itemPrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
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
      toast.error(`Insufficient balance! Insurance costs ${totalCostFormatted} but you only have ${balance.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })}.`);
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
    
    const totalCostFormatted = totalCost.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    
    toast.success(`${uninsuredItemIds.length} item(s) insured for ${totalCostFormatted}!`);
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
    
    toast.success("Days reset to Day 1");
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
      
      toast.success(`Day speed set to ${speedName}`);
    }
  };

  const handleQuickSale = () => {
    if (selectedItemIds.size === 0) {
      toast.error("Please select items to sell.");
      return;
    }
    
    const selectedItems = inventoryItems.filter((item) =>
      selectedItemIds.has(item.id)
    );
    
    // Process sale immediately
    const itemsSold = [];
    const itemsLost = [];
    
    selectedItems.forEach((item) => {
      if (shouldLoseItem(item.risk)) {
        itemsLost.push(item);
      } else {
        itemsSold.push(item);
      }
    });
    
    // Calculate money gained from sold items (with risk adjustment and floor price)
    const moneyGained = itemsSold.reduce((sum, item) => {
      const basePrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      const sellingPrice = calculateRiskAdjustedSellingPrice(basePrice, item.risk, QUICK_SALE_FLOOR_PRICE_PERCENTAGE);
      return sum + sellingPrice;
    }, 0);
    
    // Calculate money lost from lost items
    const moneyLost = itemsLost.reduce((sum, item) => {
      const price = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
      return sum + price;
    }, 0);
    
    // Add balance for successfully sold items
    if (moneyGained > 0) {
      addBalance(moneyGained);
    }
    
    // Award experience for successfully sold items (not lost items)
    const xpGained = itemsSold.length * XP_REWARDS.QUICK_SALE_ITEM;
    if (xpGained > 0) {
      addExperience(xpGained);
    }
    
    // Remove all selected items (both sold and lost)
    setInventoryItems((prev) =>
      prev.filter((item) => !selectedItemIds.has(item.id))
    );
    setSelectedItemIds(new Set());
    
    // Show toast notification with net result
    const moneyGainedFormatted = moneyGained.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    
    const moneyLostFormatted = moneyLost.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    
    if (moneyGained > 0 && moneyLost > 0) {
      // Both gained and lost money
      const netAmount = moneyGained - moneyLost;
      const netFormatted = Math.abs(netAmount).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
      
      if (netAmount > 0) {
        toast.success(
          `💰 Gained ${moneyGainedFormatted} (lost ${moneyLostFormatted} items). Net: +${netFormatted}`,
          { duration: 10000 }
        );
      } else if (netAmount < 0) {
        toast.error(
          `💸 Lost ${moneyLostFormatted} worth of items. Gained ${moneyGainedFormatted}. Net: -${netFormatted}`,
          { duration: 10000 }
        );
      } else {
        toast(
          `⚖️ Gained ${moneyGainedFormatted} and lost ${moneyLostFormatted}. Net: $0`,
          { duration: 10000 }
        );
      }
    } else if (moneyGained > 0) {
      // Only gained money
      toast.success(
        `💰 Gained ${moneyGainedFormatted} from selling ${itemsSold.length} item(s)!`,
        { duration: 10000 }
      );
    } else if (moneyLost > 0) {
      // Only lost money
      toast.error(
        `💸 Lost ${moneyLostFormatted} worth of items! No payment received.`,
        { duration: 10000 }
      );
    } else {
      // No items selected (shouldn't happen, but handle edge case)
      toast.error("No items were processed.", { duration: 10000 });
    }
  };

  return (
    <section className="page">
      <h1 className="page-title">My Inventory</h1>
      <p className="page-subtitle">
        {inventoryItems.length === 0
          ? "Your inventory is empty. Select items from listings to add them here."
          : `You have ${inventoryItems.length} item${inventoryItems.length === 1 ? "" : "s"} in your inventory.`}
      </p>

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
        <div className="listings-display">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              gap: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              {selectedItemIds.size > 0 && (
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.8 }}>
                  {selectedItemIds.size} item{selectedItemIds.size === 1 ? "" : "s"} selected
                </p>
              )}
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
                  const itemsToInsure = inventoryItems.filter((item) =>
                    uninsuredSelectedItems.includes(item.id)
                  );
                  insuranceCost = itemsToInsure.reduce((sum, item) => {
                    const itemPrice = parseFloat(item.price.replace(/[^0-9.-]+/g, ""));
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
          <div className="listings-display-grid">
            {inventoryItems.map((item, index) => {
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
      )}
    </section>
  );
}
