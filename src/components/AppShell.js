"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { BalanceProvider } from "../contexts/BalanceContext";
import { ExperienceProvider } from "../contexts/ExperienceContext";

export function AppShell({ children }) {
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

  function toggleSidebar() {
    setIsSidebarHidden((v) => !v);
  }

  return (
    <BalanceProvider>
      <ExperienceProvider>
        <div className="app-shell">
        <TopBar
          isSidebarHidden={isSidebarHidden}
          onToggleSidebar={toggleSidebar}
        />
        <div className={`app-body ${isSidebarHidden ? "is-collapsed" : ""}`}>
          <Sidebar isHidden={isSidebarHidden} />
          <main className="app-main">{children}</main>
        </div>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#333",
              color: "#fff",
              fontSize: "0.85rem",
              padding: "0.5rem 0.75rem",
              maxWidth: "400px",
            },
            success: {
              duration: 3000,
              style: {
                fontSize: "0.85rem",
                padding: "0.5rem 0.75rem",
                maxWidth: "400px",
              },
              iconTheme: {
                primary: "#4ade80",
                secondary: "#fff",
              },
            },
            error: {
              duration: 4000,
              style: {
                fontSize: "0.85rem",
                padding: "0.5rem 0.75rem",
                maxWidth: "400px",
              },
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
            },
          }}
        />
      </div>
      </ExperienceProvider>
    </BalanceProvider>
  );
}

