"use client";

import { useMemo } from "react";

type MiniSparklineProps = {
  data: number[];
  width: number;
  height: number;
};

export function MiniSparkline({ data, width, height }: MiniSparklineProps) {
  const { polylinePoints, strokeColor, areaPoints } = useMemo(() => {
    const max = Math.max(...data, 1);
    const padding = 1;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;

    const pts = data.map((value, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * plotW;
      const y = padding + plotH * (1 - value / max);
      return { x, y };
    });

    const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const ratio = Math.min(avg / 1000, 1);
    const color =
      ratio < 0.3
        ? "var(--color-success)"
        : ratio < 0.7
          ? "var(--color-warning)"
          : "var(--color-danger)";

    const lastX = pts[pts.length - 1]?.x ?? width;
    const firstX = pts[0]?.x ?? 0;
    const bottom = height - 1;
    const area = `${polyline} ${lastX},${bottom} ${firstX},${bottom}`;

    return { polylinePoints: polyline, strokeColor: color, areaPoints: area };
  }, [data, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="flex-shrink-0 opacity-70"
      aria-hidden="true"
    >
      <polygon points={areaPoints} fill={strokeColor} opacity={0.1} />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
