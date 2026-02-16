"use client";

import { useEffect, useState } from "react";

interface CelebrationProps {
  /** Whether all endpoints are UP */
  allUp: boolean;
}

const PARTICLE_COUNT = 30;
const COLORS = [
  "#FF6D49", // brand orange
  "#1FC16B", // success green
  "#FFC17A", // brand gold
  "#F34499", // brand pink
  "#335CFF", // info blue
  "#00A186", // brand teal
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function Celebration({ allUp }: CelebrationProps) {
  const [show, setShow] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    if (allUp && !hasShown) {
      setShow(true);
      setHasShown(true);
      const timer = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [allUp, hasShown]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
      aria-hidden="true"
    >
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const color = COLORS[i % COLORS.length];
        const left = randomBetween(5, 95);
        const delay = randomBetween(0, 0.8);
        const duration = randomBetween(1.5, 2.5);
        const size = randomBetween(4, 8);
        const rotation = randomBetween(0, 360);
        const drift = randomBetween(-30, 30);

        return (
          <span
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${left}%`,
              top: "-10px",
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              opacity: 0,
              transform: `rotate(${rotation}deg)`,
              animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
              ["--confetti-drift" as string]: `${drift}px`,
            }}
          />
        );
      })}
    </div>
  );
}
