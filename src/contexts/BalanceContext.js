"use client";

import { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY_BALANCE = "game-balance";

const BalanceContext = createContext(null);

export function BalanceProvider({ children }) {
  const [balance, setBalance] = useState(2000);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load balance from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    const savedBalance = localStorage.getItem(STORAGE_KEY_BALANCE);
    
    if (savedBalance) {
      try {
        setBalance(parseInt(savedBalance, 10));
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, []);

  // Save balance to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_BALANCE, balance.toString());
    }
  }, [balance, isHydrated]);

  const deductBalance = (amount) => {
    setBalance((prevBalance) => {
      const newBalance = Math.max(0, prevBalance - amount);
      return newBalance;
    });
  };

  const addBalance = (amount) => {
    setBalance((prevBalance) => prevBalance + amount);
  };

  const resetBalance = () => {
    setBalance(2000);
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY_BALANCE, "2000");
    }
  };

  return (
    <BalanceContext.Provider value={{ balance, deductBalance, addBalance, resetBalance }}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error("useBalance must be used within a BalanceProvider");
  }
  return context;
}
