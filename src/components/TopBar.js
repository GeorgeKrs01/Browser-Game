"use client";

import Link from "next/link";
import { Menu, Gamepad2, DollarSign, Award, Calendar, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useBalance } from "../contexts/BalanceContext";
import { useExperience } from "../contexts/ExperienceContext";
import toast from "react-hot-toast";

const STORAGE_KEY_DAY = "game-day";
const STORAGE_KEY_DAY_SPEED = "day-speed";
const STORAGE_KEY_INVENTORY_ITEMS = "inventory-items";
const MAX_BACKPACK_CAPACITY = 500; // Maximum number of items

// Day speed presets in milliseconds
const DAY_SPEEDS = {
  normal: 60000,  // 1 minute
  fast: 30000,    // 30 seconds
  faster: 1000,   // 1 second
};

export function TopBar({ isSidebarHidden, onToggleSidebar }) {
  const { balance, resetBalance } = useBalance();
  const { level, experience, XP_PER_LEVEL, resetLevelTo1 } = useExperience();
  const [day, setDay] = useState(1);
  const [isHydrated, setIsHydrated] = useState(false);
  const [daySpeed, setDaySpeed] = useState(DAY_SPEEDS.normal);
  const prevDayRef = useRef(1);
  const prevLevelRef = useRef(null);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [isLevelingUp, setIsLevelingUp] = useState(false);

  // Load day and speed from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    const savedDay = localStorage.getItem(STORAGE_KEY_DAY);
    
    if (savedDay) {
      try {
        setDay(parseInt(savedDay, 10));
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

  // Save day to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_DAY, day.toString());
    }
  }, [day, isHydrated]);

  // Dispatch storage event after day changes (deferred to avoid render issues)
  useEffect(() => {
    if (isHydrated && day !== prevDayRef.current) {
      // Dispatch storage event for same-tab listeners
      setTimeout(() => {
        window.dispatchEvent(new StorageEvent("storage", {
          key: STORAGE_KEY_DAY,
          newValue: day.toString(),
          oldValue: prevDayRef.current.toString(),
        }));
      }, 0);
      prevDayRef.current = day;
    }
  }, [day, isHydrated]);

  // Listen for day speed changes from localStorage
  useEffect(() => {
    if (!isHydrated) return;

    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_DAY_SPEED && e.newValue) {
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
    
    // Also check periodically for same-tab updates
    const interval = setInterval(() => {
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
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [isHydrated, daySpeed]);

  useEffect(() => {
    // Increment day based on configured speed
    const interval = setInterval(() => {
      setDay((prevDay) => {
        const newDay = prevDay + 1;
        // Immediately update localStorage
        localStorage.setItem(STORAGE_KEY_DAY, newDay.toString());
        return newDay;
      });
    }, daySpeed);

    return () => clearInterval(interval);
  }, [daySpeed]);

  // Load inventory count from localStorage
  useEffect(() => {
    if (!isHydrated) return;

    const loadInventoryCount = () => {
      const saved = localStorage.getItem(STORAGE_KEY_INVENTORY_ITEMS);
      if (saved) {
        try {
          const items = JSON.parse(saved);
          setInventoryCount(items.length || 0);
        } catch (e) {
          setInventoryCount(0);
        }
      } else {
        setInventoryCount(0);
      }
    };

    loadInventoryCount();

    // Listen for storage changes
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_INVENTORY_ITEMS) {
        loadInventoryCount();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically for same-tab updates
    const interval = setInterval(loadInventoryCount, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [isHydrated]);

  // Detect level up and trigger animation
  useEffect(() => {
    if (isHydrated) {
      // Only animate if level increased (not on initial load)
      if (prevLevelRef.current !== null && level > prevLevelRef.current) {
        setIsLevelingUp(true);
        // Reset animation state after animation completes
        const timer = setTimeout(() => {
          setIsLevelingUp(false);
        }, 600); // Match animation duration
        prevLevelRef.current = level;
        return () => clearTimeout(timer);
      } else {
        // Initialize or update without animation
        prevLevelRef.current = level;
      }
    }
  }, [level, isHydrated]);

  // Calculate experience progress
  const experienceProgress = (experience % XP_PER_LEVEL) / XP_PER_LEVEL * 100;
  const backpackCapacityPercent = (inventoryCount / MAX_BACKPACK_CAPACITY) * 100;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleSidebar}
            aria-pressed={isSidebarHidden}
            aria-label={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
            title={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
          >
            <Menu size={18} aria-hidden="true" focusable="false" />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Gamepad2 size={20} />
            <Link className="topbar-title" href="/">
              Inventory Game 2
            </Link>
          </div>
        </div>

        <div className="topbar-center">
          <div className={`level-indicator ${isLevelingUp ? 'level-up-animation' : ''}`}>
            <span className="level-number">{level}</span>
          </div>
        </div>

        <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <DollarSign size={18} />
            <span style={{ fontWeight: "600" }}>{balance}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                resetBalance();
                resetLevelTo1();
                toast.success("Balance reset to $2,000 and level reset to 1");
              }}
              aria-label="Reset balance to $2,000"
              title="Reset balance to $2,000"
              style={{ 
                width: "28px", 
                height: "28px",
                marginLeft: "4px"
              }}
            >
              <RotateCcw size={14} aria-hidden="true" focusable="false" />
            </button>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Award size={18} />
            <span>Skills</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={18} />
            <span style={{ fontWeight: "600" }}>Day {day}</span>
          </div>
        </div>
      </div>
      <div className="topbar-progress">
        <div className="progress-bar-container">
          <div className="progress-bar-label">Backpack Capacity Used</div>
          <div className="progress-bar-wrapper">
            <div 
              className="progress-bar-fill capacity-bar"
              style={{ width: `${Math.min(backpackCapacityPercent, 100)}%` }}
            />
          </div>
          <div className="progress-bar-text">
            {inventoryCount} / {MAX_BACKPACK_CAPACITY}
          </div>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-label">Experience</div>
          <div className="progress-bar-wrapper">
            <div 
              className="progress-bar-fill experience-bar"
              style={{ width: `${Math.min(experienceProgress, 100)}%` }}
            />
          </div>
          <div className="progress-bar-text">
            {experience % XP_PER_LEVEL} / {XP_PER_LEVEL}
          </div>
        </div>
      </div>
    </header>
  );
}

