"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useBalance } from "../../contexts/BalanceContext";
import { useExperience } from "../../contexts/ExperienceContext";
import { XP_REWARDS } from "../../constants/xpRewards";
import { randomChance, randomElement, randomInt, randomIntRange } from "../../utils/rng";

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

function createListings() {
  // Use a fixed seed so server and client produce the same shuffle
  const shuffledNames = shuffleArray(ITEM_NAMES, 12345);
  return Array.from({ length: 100 }, (_, index) => {
    const id = index + 1;
    const status = STATUSES[index % STATUSES.length];
    const risk = 15 + (index * 3) % 66; // 15–80% range

    // Calculate base price
    const basePrice = 10 + id * 3;
    
    // Apply risk adjustment to get final price
    const adjustedPrice = calculateRiskAdjustedPrice(basePrice, risk);

    return {
      id,
      name: shuffledNames[index % shuffledNames.length],
      price: adjustedPrice.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
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

function createAdditionalListings() {
  // Use a different seed for the second carousel to get different random items
  const shuffledNames = shuffleArray(ITEM_NAMES, 67890);
  return Array.from({ length: 50 }, (_, index) => {
    const id = 100 + index + 1; // Start from 101
    const status = STATUSES[(index * 7) % STATUSES.length]; // Different pattern
    const risk = 15 + (index * 5) % 66; // 15–80% range

    // Calculate base price
    const basePrice = 15 + id * 4;
    
    // Apply risk adjustment to get final price
    const adjustedPrice = calculateRiskAdjustedPrice(basePrice, risk);

    return {
      id,
      name: shuffledNames[index % shuffledNames.length],
      price: adjustedPrice.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
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
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [removingCardIds, setRemovingCardIds] = useState(new Set());
  const [removedCardIds, setRemovedCardIds] = useState(new Set());
  const [removedCards, setRemovedCards] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [extraListingRows, setExtraListingRows] = useState([]);

  // Generate listings deterministically (same on server and client)
  // Using seeded shuffle ensures server and client produce identical results
  const listings = useMemo(() => createListings(), []);
  const additionalListings = useMemo(() => createAdditionalListings(), []);

  // Track next unique ID for dynamically added listings
  const [nextDynamicId, setNextDynamicId] = useState(() => {
    const all = [...listings, ...additionalListings];
    const maxId = all.reduce((max, item) => Math.max(max, item.id), 0);
    return maxId + 1;
  });

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
        }
      }
    } catch {
      // Ignore malformed localStorage data
    }
  }, []);

  // Persist UI state (card size + extra rows) whenever it changes
  useEffect(() => {
    if (!isHydrated) return;

    const payload = {
      listingSize,
      extraListingRows,
      nextDynamicId,
    };

    try {
      localStorage.setItem(STORAGE_KEY_LISTINGS_UI, JSON.stringify(payload));
    } catch {
      // Ignore write errors (e.g., storage full)
    }
  }, [listingSize, extraListingRows, nextDynamicId, isHydrated]);

  const handleCardClick = (listing) => {
    if (removedCardIds.has(listing.id) || removingCardIds.has(listing.id)) return;

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
    toast.success(`Purchased ${listing.name} for ${listing.price}!`);

    // Add to selected
    setSelectedCardIds((prev) => new Set([...prev, listing.id]));

    // After 1 second, start removing
    setTimeout(() => {
      setRemovingCardIds((prev) => new Set([...prev, listing.id]));
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        next.delete(listing.id);
        return next;
      });

      // After fade animation completes, remove from carousel and add to display
      setTimeout(() => {
        setRemovedCardIds((prev) => new Set([...prev, listing.id]));
        setRemovingCardIds((prev) => {
          const next = new Set(prev);
          next.delete(listing.id);
          return next;
        });
        setRemovedCards((prev) => {
          // Check if card already exists to prevent duplicates
          if (prev.some((card) => card.id === listing.id)) {
            return prev;
          }
          return [...prev, listing];
        });
      }, 500); // Match CSS transition duration
    }, 1000);
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
    const itemsWithUniqueIds = itemsToAdd.map((item, index) => ({
      ...item,
      id: maxId + index + 1, // Assign unique ID to each item
    }));
    
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
        const basePrice = 10 + id * 3 + randomInt(50);
        const adjustedPrice = calculateRiskAdjustedPrice(basePrice, risk);

        return {
          id,
          name: ITEM_NAMES[nameIndex],
          price: adjustedPrice.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }),
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

  const carouselListings = useMemo(() => {
    if (listings.length === 0) return [];
    return [...listings, ...listings].filter(
      (listing) => !removedCardIds.has(listing.id)
    );
  }, [listings, removedCardIds]);

  const carouselListingsFast = useMemo(() => {
    if (additionalListings.length === 0) return [];
    return [...additionalListings, ...additionalListings].filter(
      (listing) => !removedCardIds.has(listing.id)
    );
  }, [additionalListings, removedCardIds]);

  return (
    <section className={`page listings-size-${listingSize}`}>
      <h1 className="page-title">Listings</h1>
      <p className="page-subtitle">
        Browse 100 market listings with status and risk profile.
      </p>

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
            const isSelected = selectedCardIds.has(listing.id);
            const isRemoving = removingCardIds.has(listing.id);

            return (
              <article
                key={`${listing.id}-${index}`}
                className={`listing-card listing-card-${listing.status.toLowerCase()} ${
                  isSelected ? "listing-card-selected" : ""
                      } ${isRemoving ? "listing-card-removing" : ""} listing-card-animated`}
                onClick={() => handleCardClick(listing)}
                style={{
                  cursor: isRemoving ? "default" : "pointer",
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
                .filter((listing) => !removedCardIds.has(listing.id))
                .map((listing) => {
                  const isSelected = selectedCardIds.has(listing.id);
                  const isRemoving = removingCardIds.has(listing.id);

                  return (
                    <article
                      key={`extra-${listing.id}`}
                      className={`listing-card listing-card-${listing.status.toLowerCase()} ${
                        isSelected ? "listing-card-selected" : ""
                      } ${isRemoving ? "listing-card-removing" : ""}`}
                      onClick={() => handleCardClick(listing)}
                      style={{
                        cursor: isRemoving ? "default" : "pointer",
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
            const isSelected = selectedCardIds.has(listing.id);
            const isRemoving = removingCardIds.has(listing.id);

            return (
              <article
                key={`fast-${listing.id}-${index}`}
                className={`listing-card listing-card-${listing.status.toLowerCase()} ${
                  isSelected ? "listing-card-selected" : ""
                } ${isRemoving ? "listing-card-removing" : ""}`}
                onClick={() => handleCardClick(listing)}
                style={{
                  cursor: isRemoving ? "default" : "pointer",
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
                onClick={() => handleRemoveCard(listing)}
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
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

