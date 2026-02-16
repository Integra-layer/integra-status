"use client";

import { useEffect, useState } from "react";

interface ProgressRingProps {
  /** 0–100 percentage */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const STATUS_COLOR = {
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-danger)",
} as const;

function getColor(pct: number) {
  if (pct >= 90) return STATUS_COLOR.good;
  if (pct >= 50) return STATUS_COLOR.warn;
  return STATUS_COLOR.bad;
}

export function ProgressRing({
  value,
  size = 32,
  strokeWidth = 3,
  className = "",
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    let rafId: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(eased * value);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;
  const color = getColor(value);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={`${Math.round(value)}% operational`}
      role="img"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth={strokeWidth}
        opacity={0.2}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.3s ease" }}
      />
      {/* Center percentage text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-text"
        fontSize={size * 0.28}
        fontWeight={600}
      >
        {Math.round(animatedValue)}
      </text>
    </svg>
  );
}
