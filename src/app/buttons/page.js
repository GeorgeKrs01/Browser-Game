"use client";

import { useEffect, useState } from "react";

const BUTTON_COUNT = 10;
const TICK_MS = 100;
const INCREMENT = 0.5; // percent per tick
const START_VALUES = [5, 20, 40, 60, 80, 15, 35, 50, 70, 90];

export default function ButtonsPage() {
  const [values, setValues] = useState(
    () =>
      Array.from({ length: BUTTON_COUNT }, (_, index) => ({
        value: START_VALUES[index] ?? 0,
        waitUntil: null,
      })),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setValues((prev) => {
        const now = Date.now();

        return prev.map((item, index) => {
          const startValue = START_VALUES[index] ?? 0;
          const current = item ?? { value: startValue, waitUntil: null };

          // Still waiting at 100%
          if (current.waitUntil && now < current.waitUntil) {
            return current;
          }

          // Finished waiting: reset to low value (1%)
          if (current.waitUntil && now >= current.waitUntil) {
            return { value: 1, waitUntil: null };
          }

          // Hit 100%: start a 2s wait
          if (current.value >= 100) {
            return {
              value: 100,
              waitUntil: now + 2000,
            };
          }

          // Normal increment
          return {
            value: Math.min(current.value + INCREMENT, 100),
            waitUntil: null,
          };
        });
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="page">
      <h1 className="page-title">Buttons</h1>
      <p className="page-subtitle">
        Ten custom buttons that fill up by 0.5% every 100ms.
      </p>

      <div className="buttons-grid">
        {values.map((item, index) => {
          const value = item?.value ?? START_VALUES[index] ?? 0;
          const variants = [
            "button-ice",
            "button-fire",
            "button-poison",
            "button-arcane",
            "button-shadow",
            "button-holy",
            "button-nature",
            "button-stone",
            "button-lightning",
            "button-void",
          ];

          const variant = variants[index] ?? "button-ice";
          const iconVariants = [
            "icon-ice",
            "icon-fire",
            "icon-poison",
            "icon-arcane",
            "icon-shadow",
            "icon-holy",
            "icon-nature",
            "icon-stone",
            "icon-lightning",
            "icon-void",
          ];

          const iconVariant = iconVariants[index] ?? "icon-ice";

          return (
            <button
              key={index}
              type="button"
              className={`fill-button ${variant}`}
            >
              <span
                className="fill-button-fill"
                style={{ width: `${value}%` }}
              />
              <span className="fill-button-content">
                <span className="fill-button-left">
                  <span className={`fill-button-icon ${iconVariant}`} />
                  <span className="fill-button-label">
                    {index + 1}.{" "}
                    {{
                      0: "Frost Shard",
                      1: "Flame Rune",
                      2: "Venom Vial",
                      3: "Arcane Sigil",
                      4: "Shadow Dagger",
                      5: "Holy Relic",
                      6: "Nature Seed",
                      7: "Stone Token",
                      8: "Storm Charge",
                      9: "Void Crystal",
                    }[index]}
                  </span>
                </span>
                <span className="fill-button-value">
                  {value.toFixed(1)}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

