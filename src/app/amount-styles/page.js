"use client";

import { 
  ArrowUp, 
  TrendingUp, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowUpCircle, 
  ArrowUpSquare,
  CircleArrowUp,
  MoveUp,
  ChevronsUp,
  ArrowUpNarrowWide
} from "lucide-react";
import { Line } from "rc-progress";

export default function AmountStylesPage() {
  // Sample amounts for display
  const sampleAmounts = [1, 1, 2, 1, 51, 2, 2, 6, 15, 3];

  const cardStyles = [
    {
      name: "Style 1: Classic Green",
      description: "Solid green background with rounded corners",
      component: (index) => (
        <div key={index} className="amount-card amount-card-1">
          <ArrowUp className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 2: Glassmorphism",
      description: "Frosted glass effect with backdrop blur",
      component: (index) => (
        <div key={index} className="amount-card amount-card-2">
          <ArrowUpCircle className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 3: Gradient Green",
      description: "Gradient green background",
      component: (index) => (
        <div key={index} className="amount-card amount-card-3">
          <TrendingUp className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 4: Neumorphism",
      description: "Soft shadow depth effect",
      component: (index) => (
        <div key={index} className="amount-card amount-card-4">
          <ArrowUpSquare className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 5: Bordered Card",
      description: "Clean border with subtle background",
      component: (index) => (
        <div key={index} className="amount-card amount-card-5">
          <ChevronUp className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 6: RC Progress Style",
      description: "Using rc-progress library styling",
      component: (index) => (
        <div key={index} className="amount-card amount-card-6">
          <div className="amount-card-progress-wrapper">
            <Line
              percent={(sampleAmounts[index] / 100) * 100}
              strokeWidth={2}
              trailWidth={2}
              strokeColor="#22c55e"
              trailColor="rgba(255,255,255,0.1)"
              style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
            />
          </div>
          <CircleArrowUp className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 7: Shimmer Effect",
      description: "Animated shimmer overlay",
      component: (index) => (
        <div key={index} className="amount-card amount-card-7">
          <ArrowUpRight className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 8: Material Design",
      description: "Material Design elevation",
      component: (index) => (
        <div key={index} className="amount-card amount-card-8">
          <MoveUp className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 9: Glow Effect",
      description: "Glowing border and shadow",
      component: (index) => (
        <div key={index} className="amount-card amount-card-9">
          <ChevronsUp className="amount-card-icon" size={20} />
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
    {
      name: "Style 10: Lucide Icons Style",
      description: "Using lucide-react with custom styling",
      component: (index) => (
        <div key={index} className="amount-card amount-card-10">
          <div className="amount-card-icon-wrapper">
            <ArrowUpNarrowWide className="amount-card-icon" size={22} strokeWidth={2.5} />
          </div>
          <div className="amount-card-value">${sampleAmounts[index]}</div>
        </div>
      ),
    },
  ];

  return (
    <section className="page">
      <h1 className="page-title">Amount Card Styles</h1>
      <p className="page-subtitle">
        Ten different styles for amount cards with arrows, perfect for carousels. Five custom styles and five using libraries.
      </p>

      <div className="amount-styles-grid">
        {cardStyles.map((style, index) => (
          <div key={index} className="amount-style-card">
            <div className="amount-style-header">
              <h3 className="amount-style-name">{style.name}</h3>
              <p className="amount-style-description">{style.description}</p>
            </div>
            <div className="amount-style-preview">
              {style.component(index)}
            </div>
          </div>
        ))}
      </div>

      {/* Carousel Preview Section */}
      <div className="amount-carousel-section">
        <h2 className="amount-carousel-title">Carousel Preview</h2>
        <div className="amount-carousel-container">
          <div className="amount-carousel-row">
            {cardStyles.map((style, index) => (
              <div key={index} className="amount-carousel-item">
                {style.component(index)}
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {cardStyles.map((style, index) => (
              <div key={`duplicate-${index}`} className="amount-carousel-item">
                {style.component(index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
