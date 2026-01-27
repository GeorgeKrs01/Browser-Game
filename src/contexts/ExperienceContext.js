"use client";

import { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY_LEVEL = "game-level";
const STORAGE_KEY_EXPERIENCE = "game-experience";
const XP_PER_LEVEL = 1000; // Experience needed per level

const ExperienceContext = createContext(null);

export function ExperienceProvider({ children }) {
  const [level, setLevel] = useState(2);
  const [experience, setExperience] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load level and experience from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    const savedLevel = localStorage.getItem(STORAGE_KEY_LEVEL);
    const savedExp = localStorage.getItem(STORAGE_KEY_EXPERIENCE);
    
    if (savedLevel) {
      try {
        setLevel(parseInt(savedLevel, 10));
      } catch (e) {
        // Invalid data, ignore
      }
    }

    if (savedExp) {
      try {
        setExperience(parseInt(savedExp, 10));
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, []);

  // Save level and experience to localStorage whenever they change (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_LEVEL, level.toString());
      localStorage.setItem(STORAGE_KEY_EXPERIENCE, experience.toString());
    }
  }, [level, experience, isHydrated]);

  // Check for level up when experience changes
  useEffect(() => {
    if (!isHydrated) return;

    const currentLevelXP = experience % XP_PER_LEVEL;
    const newLevel = Math.floor(experience / XP_PER_LEVEL) + 2; // Start at level 2

    if (newLevel > level) {
      setLevel(newLevel);
      // Dispatch storage event for other tabs/components
      window.dispatchEvent(new StorageEvent("storage", {
        key: STORAGE_KEY_LEVEL,
        newValue: newLevel.toString(),
      }));
    }
  }, [experience, isHydrated, level]);

  const addExperience = (amount) => {
    if (amount <= 0) return;
    setExperience((prevExp) => {
      const newExp = prevExp + amount;
      // Immediately update localStorage
      if (isHydrated) {
        localStorage.setItem(STORAGE_KEY_EXPERIENCE, newExp.toString());
      }
      return newExp;
    });
  };

  const resetExperience = () => {
    setLevel(2);
    setExperience(0);
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_LEVEL, "2");
      localStorage.setItem(STORAGE_KEY_EXPERIENCE, "0");
    }
  };

  const resetLevelTo1 = () => {
    // Set level first, then experience to -1000 so the formula calculates: Math.floor(-1000 / 1000) + 2 = -1 + 2 = 1
    // The useEffect only increases level, so setting level to 1 manually ensures it stays at 1
    setLevel(1);
    setExperience(-1000);
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_LEVEL, "1");
      localStorage.setItem(STORAGE_KEY_EXPERIENCE, "-1000");
    }
  };

  return (
    <ExperienceContext.Provider value={{ 
      level, 
      experience, 
      addExperience, 
      resetExperience,
      resetLevelTo1,
      XP_PER_LEVEL 
    }}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error("useExperience must be used within an ExperienceProvider");
  }
  return context;
}
