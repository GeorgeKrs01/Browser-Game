"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useExperience } from "../../contexts/ExperienceContext";
import { RECIPES, calculateSuccessRate, isRecipeUnlocked } from "../../constants/recipes";
import { XP_REWARDS } from "../../constants/xpRewards";
import { randomChance } from "../../utils/rng";

const STORAGE_KEY_INVENTORY_ITEMS = "inventory-items";
const STORAGE_KEY_CRAFTING_STATS = "crafting-stats";
const STORAGE_KEY_UNLOCKED_RECIPES = "unlocked-recipes";

export default function CraftingPage() {
  const { addExperience } = useExperience();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState(new Map()); // Map of material name -> array of item IDs
  const [isHydrated, setIsHydrated] = useState(false);
  const [craftingStats, setCraftingStats] = useState({ itemsCrafted: 0 });
  const [unlockedRecipes, setUnlockedRecipes] = useState(new Set());

  // Load inventory and stats
  useEffect(() => {
    setIsHydrated(true);
    
    // Load inventory
    const saved = localStorage.getItem(STORAGE_KEY_INVENTORY_ITEMS);
    if (saved) {
      try {
        const items = JSON.parse(saved);
        setInventoryItems(items);
      } catch (e) {
        // Invalid data
      }
    }

    // Load crafting stats
    const savedStats = localStorage.getItem(STORAGE_KEY_CRAFTING_STATS);
    if (savedStats) {
      try {
        const stats = JSON.parse(savedStats);
        setCraftingStats(stats);
      } catch (e) {
        // Invalid data
      }
    }

    // Load unlocked recipes
    const savedUnlocked = localStorage.getItem(STORAGE_KEY_UNLOCKED_RECIPES);
    if (savedUnlocked) {
      try {
        const unlocked = JSON.parse(savedUnlocked);
        setUnlockedRecipes(new Set(unlocked));
      } catch (e) {
        // Invalid data
      }
    }

    // Listen for inventory changes
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_INVENTORY_ITEMS && e.newValue) {
        try {
          const items = JSON.parse(e.newValue);
          setInventoryItems(items);
        } catch (e) {
          // Invalid data
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Get items from inventory by name
  const getItemsByName = (name) => {
    return inventoryItems.filter(item => item.name === name);
  };

  // Check if recipe materials are available
  const checkMaterialsAvailable = (recipe) => {
    for (const material of recipe.materials) {
      const available = getItemsByName(material.name);
      if (available.length < material.quantity) {
        return false;
      }
    }
    return true;
  };

  // Get available recipes (unlocked)
  const availableRecipes = RECIPES.filter(recipe => 
    isRecipeUnlocked(recipe, craftingStats) || unlockedRecipes.has(recipe.id)
  );

  // Sort available recipes: enabled ones (unlocked + all materials available) first
  const sortedAvailableRecipes = [...availableRecipes].sort((a, b) => {
    const aCanCraft = checkMaterialsAvailable(a);
    const bCanCraft = checkMaterialsAvailable(b);
    
    // If one can craft and the other can't, prioritize the one that can craft
    if (aCanCraft && !bCanCraft) return -1;
    if (!aCanCraft && bCanCraft) return 1;
    
    // If both have same status, maintain original order
    return 0;
  });

  // Get locked recipes
  const lockedRecipes = RECIPES.filter(recipe => 
    !isRecipeUnlocked(recipe, craftingStats) && !unlockedRecipes.has(recipe.id)
  );

  // Get selected materials for current recipe
  const getSelectedMaterialsForRecipe = (recipe) => {
    if (!recipe) return [];
    
    const materials = [];
    recipe.materials.forEach(material => {
      const selected = selectedMaterials.get(material.name) || [];
      const items = selected.map(id => inventoryItems.find(item => item.id === id)).filter(Boolean);
      materials.push(...items);
    });
    return materials;
  };

  // Handle material selection
  const handleMaterialClick = (recipe, materialName, item) => {
    if (!recipe) return;

    const materialReq = recipe.materials.find(m => m.name === materialName);
    if (!materialReq) return;

    // Check current state before updating
    setSelectedMaterials(prev => {
      const current = prev.get(materialName) || [];
      
      // Check if item is already selected
      if (current.includes(item.id)) {
        // Deselect
        const next = new Map(prev);
        const updated = current.filter(id => id !== item.id);
        if (updated.length === 0) {
          next.delete(materialName);
        } else {
          next.set(materialName, updated);
        }
        return next;
      } else {
        // Select (but check quantity limit first)
        if (current.length >= materialReq.quantity) {
          // Use setTimeout to defer the toast call to avoid render issues
          setTimeout(() => {
            toast.error(`You can only use ${materialReq.quantity} ${materialName} for this recipe`);
          }, 0);
          return prev; // Don't update state
        }
        
        // Update state
        const next = new Map(prev);
        next.set(materialName, [...current, item.id]);
        return next;
      }
    });
  };

  // Check if recipe is ready to craft
  const isRecipeReady = (recipe) => {
    if (!recipe) return false;
    
    for (const material of recipe.materials) {
      const selected = selectedMaterials.get(material.name) || [];
      if (selected.length !== material.quantity) {
        return false;
      }
    }
    return true;
  };

  // Handle crafting attempt
  const handleCraft = () => {
    if (!selectedRecipe) {
      toast.error("Please select a recipe first");
      return;
    }

    if (!isRecipeReady(selectedRecipe)) {
      toast.error("Please select all required materials");
      return;
    }

    // Get selected material items
    const materials = getSelectedMaterialsForRecipe(selectedRecipe);
    
    // Calculate success rate
    const successRate = calculateSuccessRate(selectedRecipe, materials);

    // Award XP for attempt
    addExperience(XP_REWARDS.CRAFT_FAILURE);

    if (randomChance(successRate)) {
      // Success!
      const result = selectedRecipe.result;
      
      // Create new item with unique ID
      const maxId = inventoryItems.reduce((max, item) => Math.max(max, item.id || 0), 0);
      const newItem = {
        id: maxId + 1,
        name: result.name,
        price: result.basePrice.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }),
        description: result.description,
        status: result.status,
        risk: result.risk,
        crafted: true, // Mark as crafted
      };

      // Remove materials from inventory
      const materialIds = new Set();
      selectedMaterials.forEach((ids) => {
        ids.forEach(id => materialIds.add(id));
      });

      const updatedInventory = inventoryItems.filter(item => !materialIds.has(item.id));
      updatedInventory.push(newItem);

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_INVENTORY_ITEMS, JSON.stringify(updatedInventory));
      setInventoryItems(updatedInventory);

      // Update crafting stats
      const newStats = {
        ...craftingStats,
        itemsCrafted: (craftingStats.itemsCrafted || 0) + 1
      };
      localStorage.setItem(STORAGE_KEY_CRAFTING_STATS, JSON.stringify(newStats));
      setCraftingStats(newStats);

      // Check for recipe unlocks
      const newlyUnlocked = RECIPES.filter(recipe => 
        !unlockedRecipes.has(recipe.id) && 
        isRecipeUnlocked(recipe, newStats)
      );
      
      if (newlyUnlocked.length > 0) {
        const newUnlocked = new Set(unlockedRecipes);
        newlyUnlocked.forEach(recipe => newUnlocked.add(recipe.id));
        setUnlockedRecipes(newUnlocked);
        localStorage.setItem(STORAGE_KEY_UNLOCKED_RECIPES, JSON.stringify([...newUnlocked]));
        
        newlyUnlocked.forEach(recipe => {
          toast.success(`🔓 New recipe unlocked: ${recipe.name}!`, { duration: 5000 });
        });
      }

      // Award success XP
      addExperience(XP_REWARDS.CRAFT_SUCCESS);

      // Clear selection
      setSelectedMaterials(new Map());
      setSelectedRecipe(null);

      toast.success(
        `✨ Successfully crafted ${result.name}! Success rate was ${Math.round(successRate)}%`,
        { duration: 5000 }
      );
    } else {
      // Failure - materials are consumed but no item created
      const materialIds = new Set();
      selectedMaterials.forEach((ids) => {
        ids.forEach(id => materialIds.add(id));
      });

      const updatedInventory = inventoryItems.filter(item => !materialIds.has(item.id));
      localStorage.setItem(STORAGE_KEY_INVENTORY_ITEMS, JSON.stringify(updatedInventory));
      setInventoryItems(updatedInventory);

      // Clear selection
      setSelectedMaterials(new Map());
      setSelectedRecipe(null);

      toast.error(
        `❌ Crafting failed! Success rate was ${Math.round(successRate)}%. Materials were consumed.`,
        { duration: 5000 }
      );
    }
  };

  // Get success rate for current recipe
  const getCurrentSuccessRate = () => {
    if (!selectedRecipe) return 0;
    const materials = getSelectedMaterialsForRecipe(selectedRecipe);
    if (materials.length === 0) return selectedRecipe.baseSuccessRate;
    return calculateSuccessRate(selectedRecipe, materials);
  };

  return (
    <section className="page" style={{ maxWidth: "100%", width: "100%" }}>
      <h1 className="page-title">Crafting</h1>
      <p className="page-subtitle">
        Combine materials to create powerful items. Higher quality materials increase success rate.
      </p>

      <div style={{ 
        display: "flex",
        flexDirection: "row",
        gap: "2rem",
        marginTop: "2rem",
        alignItems: "flex-start"
      }}>
        {/* Recipes Panel */}
        <div style={{ flex: "1 1 60%" }}>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Available Recipes</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", width: "100%" }}>
            {sortedAvailableRecipes.map(recipe => {
              const canCraft = checkMaterialsAvailable(recipe);
              const isSelected = selectedRecipe?.id === recipe.id;
              
              return (
                <div
                  key={recipe.id}
                  onClick={() => {
                    setSelectedRecipe(recipe);
                    setSelectedMaterials(new Map()); // Clear previous selection
                  }}
                  style={{
                    padding: "1rem",
                    border: `2px solid ${isSelected ? "#4a9eff" : canCraft ? "#4a9eff" : "#333"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "rgba(74, 158, 255, 0.1)" : "transparent",
                    transition: "all 0.2s",
                    opacity: canCraft ? 1 : 0.6,
                    boxShadow: canCraft && !isSelected ? "0 0 10px rgba(74, 158, 255, 0.5)" : "none"
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
                    {recipe.name}
                  </div>
                  <div style={{ fontSize: "0.9em", color: "#aaa", marginBottom: "0.5rem" }}>
                    {recipe.description}
                  </div>
                  <div style={{ fontSize: "0.85em", marginTop: "0.5rem" }}>
                    <div>Materials:</div>
                    {recipe.materials.map((mat, idx) => {
                      const available = getItemsByName(mat.name);
                      const hasEnough = available.length >= mat.quantity;
                      return (
                        <div key={idx} style={{ 
                          marginLeft: "1rem",
                          color: hasEnough ? "#4a9eff" : "#ff4444"
                        }}>
                          {mat.quantity}x {mat.name} {hasEnough ? `(${available.length} available)` : `(Need ${mat.quantity}, have ${available.length})`}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ 
                    marginTop: "0.5rem", 
                    fontSize: "0.85em",
                    color: "#888"
                  }}>
                    Base Success: {recipe.baseSuccessRate}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Locked Recipes */}
          {lockedRecipes.length > 0 && (
            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem", opacity: 0.7 }}>
                Locked Recipes
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                {lockedRecipes.map(recipe => (
                  <div
                    key={recipe.id}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid #444",
                      borderRadius: "6px",
                      opacity: 0.5,
                      fontSize: "0.9em"
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>{recipe.name}</div>
                    <div style={{ fontSize: "0.85em", color: "#888", marginTop: "0.25rem" }}>
                      {recipe.unlockRequirement === "craft_5_items" && "Craft 5 items to unlock"}
                      {recipe.unlockRequirement === "craft_10_items" && "Craft 10 items to unlock"}
                      {recipe.unlockRequirement === "craft_15_items" && "Craft 15 items to unlock"}
                      {recipe.unlockRequirement === "craft_20_items" && "Craft 20 items to unlock"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Crafting Panel */}
        <div style={{ flex: "1 1 40%", position: "sticky", top: "2rem" }}>
          {selectedRecipe ? (
            <div style={{
              padding: "1.5rem",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              border: "1px solid #333",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
            }}>
              <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>
                Craft: {selectedRecipe.name}
              </h2>

              <div style={{ 
                padding: "1rem", 
                backgroundColor: "rgba(74, 158, 255, 0.1)",
                borderRadius: "8px",
                marginBottom: "1.5rem"
              }}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Result:</strong> {selectedRecipe.result.name}
                </div>
                <div style={{ fontSize: "0.9em", color: "#aaa" }}>
                  {selectedRecipe.result.description}
                </div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.9em" }}>
                  <div>Status: <span className={`listing-status listing-status-${selectedRecipe.result.status.toLowerCase()}`}>
                    {selectedRecipe.result.status}
                  </span></div>
                  <div>Risk: {selectedRecipe.result.risk}%</div>
                  <div>Base Price: {selectedRecipe.result.basePrice.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}</div>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>Select Materials</h3>
                {selectedRecipe.materials.map((material, idx) => {
                  const available = getItemsByName(material.name);
                  const selected = selectedMaterials.get(material.name) || [];
                  const remaining = material.quantity - selected.length;

                  return (
                    <div key={idx} style={{ marginBottom: "1.5rem" }}>
                      <div style={{ 
                        marginBottom: "0.5rem",
                        fontWeight: "bold"
                      }}>
                        {material.quantity}x {material.name}
                        {remaining > 0 && (
                          <span style={{ color: "#ff4444", marginLeft: "0.5rem" }}>
                            (Need {remaining} more)
                          </span>
                        )}
                        {remaining === 0 && (
                          <span style={{ color: "#4a9eff", marginLeft: "0.5rem" }}>
                            ✓ Complete
                          </span>
                        )}
                      </div>
                      <div style={{ 
                        display: "flex", 
                        flexWrap: "wrap", 
                        gap: "0.5rem" 
                      }}>
                        {available.map(item => {
                          const isSelected = selected.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleMaterialClick(selectedRecipe, material.name, item)}
                              className={`listing-card listing-card-${item.status.toLowerCase()}`}
                              style={{
                                cursor: "pointer",
                                opacity: isSelected ? 1 : 0.7,
                                border: isSelected ? "2px solid #4a9eff" : "1px solid #333",
                                transform: isSelected ? "scale(1.05)" : "scale(1)",
                                transition: "all 0.2s",
                                minWidth: "120px",
                                padding: "0.75rem"
                              }}
                            >
                              <div style={{ fontSize: "0.9em", fontWeight: "bold" }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: "0.8em", marginTop: "0.25rem" }}>
                                <span className={`listing-status listing-status-${item.status.toLowerCase()}`}>
                                  {item.status}
                                </span>
                              </div>
                              {isSelected && (
                                <div style={{ 
                                  marginTop: "0.25rem", 
                                  fontSize: "0.75em",
                                  color: "#4a9eff"
                                }}>
                                  ✓ Selected
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {available.length === 0 && (
                          <div style={{ color: "#ff4444" }}>
                            No {material.name} available in inventory
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ 
                padding: "1rem", 
                backgroundColor: "#1a1a1a",
                borderRadius: "8px",
                marginBottom: "1rem"
              }}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Success Rate:</strong> {Math.round(getCurrentSuccessRate())}%
                </div>
                <div style={{ 
                  width: "100%", 
                  height: "20px", 
                  backgroundColor: "#333",
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginTop: "0.5rem"
                }}>
                  <div style={{
                    width: `${getCurrentSuccessRate()}%`,
                    height: "100%",
                    backgroundColor: getCurrentSuccessRate() > 70 ? "#4a9eff" : getCurrentSuccessRate() > 50 ? "#ffaa00" : "#ff4444",
                    transition: "width 0.3s"
                  }} />
                </div>
              </div>

              <button
                onClick={handleCraft}
                disabled={!isRecipeReady(selectedRecipe)}
                style={{
                  width: "100%",
                  padding: "1rem",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  backgroundColor: isRecipeReady(selectedRecipe) ? "#4a9eff" : "#444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isRecipeReady(selectedRecipe) ? "pointer" : "not-allowed",
                  transition: "all 0.2s"
                }}
              >
                {isRecipeReady(selectedRecipe) ? "Craft Item" : "Select All Materials"}
              </button>
            </div>
          ) : (
            <div style={{ 
              padding: "2rem", 
              textAlign: "center",
              color: "#888"
            }}>
              Select a recipe to begin crafting
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
