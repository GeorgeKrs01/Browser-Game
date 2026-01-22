"use client";

import { useEffect, useState } from "react";
import * as RadixProgress from "@radix-ui/react-progress";
import { Circle } from "rc-progress";

const customProgressExamples = [
  { label: "Wooden Sword Durability", value: 5, variant: "thin" },
  { label: "Iron Sword Durability", value: 20, variant: "chunky" },
  { label: "Steel Sword Durability", value: 40, variant: "striped" },
  { label: "Legendary Sword Durability", value: 65, variant: "glow" },
  { label: "Backpack Capacity Used", value: 80, variant: "danger" },
];

const libraryProgressExamples = [
  { label: "Gold Pouch Capacity (Radix)", value: 30, type: "radix" },
  { label: "Health Potion Stock (Radix)", value: 55, type: "radix" },
  { label: "Mana Potion Stock (Radix)", value: 70, type: "radix" },
  { label: "Arrow Quiver Fill (Circle)", value: 90, type: "circle" },
  { label: "Gem Collection Progress (Circle)", value: 100, type: "circle" },
];

const allExamples = [
  ...customProgressExamples.map((item, index) => ({
    ...item,
    id: `custom-${index}`,
  })),
  ...libraryProgressExamples.map((item, index) => ({
    ...item,
    id: `lib-${index}`,
  })),
];

function CustomProgressRow({ label, value, variant }) {
  return (
    <div className={`progress-row progress-row-${variant}`}>
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-value">{Math.round(value)}%</span>
      </div>
      <div className={`progress-bar progress-bar-${variant}`}>
        <div
          className={`progress-bar-fill progress-bar-fill-${variant}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function RadixProgressRow({ label, value }) {
  return (
    <div className="progress-row progress-row-radix">
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-value">{Math.round(value)}%</span>
      </div>
      <RadixProgress.Root
        className="radix-progress-root"
        value={value}
        max={100}
      >
        <RadixProgress.Indicator
          className="radix-progress-indicator"
          style={{ transform: `translateX(-${100 - value}%)` }}
        />
      </RadixProgress.Root>
    </div>
  );
}

function CircleProgressRow({ label, value }) {
  return (
    <div className="progress-row progress-row-circle">
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-value">{Math.round(value)}%</span>
      </div>
      <div className="circle-progress-wrapper">
        <Circle
          percent={Math.round(value)}
          strokeWidth={10}
          trailWidth={10}
          strokeColor={value === 100 ? "#22c55e" : "#3b82f6"}
          trailColor="rgba(148, 163, 184, 0.25)"
          strokeLinecap="round"
        />
        <div className="circle-progress-text">{Math.round(value)}%</div>
      </div>
    </div>
  );
}

export function ProgressBarsDemo() {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      allExamples.map((item) => [
        item.id,
        {
          value: item.value,
          waitUntil: null,
        },
      ]),
    ),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setValues((prev) => {
        const now = Date.now();
        const next = { ...prev };

        for (const item of allExamples) {
          const current = prev[item.id] ?? {
            value: item.value,
            waitUntil: null,
          };

          // Still waiting at 100%
          if (current.waitUntil && now < current.waitUntil) {
            next[item.id] = current;
            continue;
          }

          // Finished waiting: reset to 1% and continue animating
          if (current.waitUntil && now >= current.waitUntil) {
            next[item.id] = { value: 1, waitUntil: null };
            continue;
          }

          // Hit 100%: start a 2s wait
          if (current.value >= 100) {
            next[item.id] = {
              value: 100,
              waitUntil: now + 2000,
            };
            continue;
          }

          // Normal increment
          next[item.id] = {
            value: Math.min(current.value + 0.5, 100),
            waitUntil: null,
          };
        }

        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p className="page-subtitle">
        Progress bar examples using custom CSS and libraries.
      </p>

      <h2 className="page-subtitle" style={{ marginTop: 24 }}>
        Custom CSS progress bars
      </h2>
      <div className="progress-list">
        {customProgressExamples.map((item, index) => {
          const id = `custom-${index}`;
          const value = values[id]?.value ?? item.value;

          return (
            <CustomProgressRow
              key={item.label}
              label={item.label}
              value={value}
              variant={item.variant}
            />
          );
        })}
      </div>

      <h2 className="page-subtitle" style={{ marginTop: 24 }}>
        Library-based progress bars
      </h2>
      <div className="progress-list">
        {libraryProgressExamples.map((item, index) => {
          const id = `lib-${index}`;
          const value = values[id]?.value ?? item.value;

          return item.type === "radix" ? (
            <RadixProgressRow
              key={item.label}
              label={item.label}
              value={value}
            />
          ) : (
            <CircleProgressRow
              key={item.label}
              label={item.label}
              value={value}
            />
          );
        })}
      </div>
    </>
  );
}

