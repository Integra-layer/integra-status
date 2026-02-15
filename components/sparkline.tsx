"use client";

import { useEffect, useRef, useState, useMemo } from "react";

interface SparklineProps {
  data: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  className = "",
}: SparklineProps) {
  const pathRef = useRef<SVGPolylineElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number | null;
  } | null>(null);

  // Compute points from data
  const { points, maxVal } = useMemo(() => {
    const validValues = data.filter((v): v is number => v !== null);
    const max = validValues.length > 0 ? Math.max(...validValues) : 1;
    const min = 0;
    const range = max - min || 1;

    const padding = 2;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    const pts = data.map((value, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * plotWidth;
      const normalized = value !== null ? (value - min) / range : 0;
      // Invert Y: SVG y=0 is top
      const y = padding + plotHeight * (1 - normalized);
      return { x, y, value };
    });

    return { points: pts, maxVal: max };
  }, [data, width, height]);

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Compute stroke color: green for low, gradient to amber for high
  const strokeColor = useMemo(() => {
    const validValues = data.filter((v): v is number => v !== null);
    if (validValues.length === 0) return "var(--color-success)";
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    // If avg response time is above 500ms, shift toward amber
    const ratio = Math.min(avg / 1000, 1);
    if (ratio < 0.3) return "var(--color-success)";
    if (ratio < 0.7) return "var(--color-warning)";
    return "var(--color-danger)";
  }, [data]);

  // Measure path length after mount
  useEffect(() => {
    if (pathRef.current) {
      // polyline doesn't have getTotalLength, compute manually
      let len = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        len += Math.sqrt(dx * dx + dy * dy);
      }
      setPathLength(len);
    }
  }, [points]);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = mouseX * scaleX;

    // Find closest point
    let closest = points[0];
    let closestDist = Infinity;
    for (const p of points) {
      const dist = Math.abs(p.x - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = p;
      }
    }

    setTooltip({ x: closest.x, y: closest.y, value: closest.value });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="Response time trend"
        className="overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Baseline (zero) */}
        <line
          x1={2}
          y1={height - 2}
          x2={width - 2}
          y2={height - 2}
          stroke="var(--color-gray-200)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />

        {/* Main sparkline */}
        <polyline
          ref={pathRef}
          className="sparkline-path"
          points={polylinePoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            pathLength > 0
              ? {
                  strokeDasharray: pathLength,
                  strokeDashoffset: 0,
                  willChange: "stroke-dashoffset",
                  animation: `sparkline-draw 800ms ease-out`,
                  ["--sparkline-length" as string]: pathLength,
                }
              : undefined
          }
        />

        {/* Hover indicator */}
        {tooltip && (
          <>
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r={3}
              fill={strokeColor}
              stroke="white"
              strokeWidth={1.5}
            />
          </>
        )}
      </svg>

      {/* Floating tooltip pill */}
      {tooltip && tooltip.value !== null && (
        <div
          className="pointer-events-none absolute -top-8 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white shadow-md dark:bg-gray-100 dark:text-gray-900"
          style={{ left: `${(tooltip.x / width) * 100}%` }}
        >
          {tooltip.value}ms
        </div>
      )}
    </div>
  );
}
