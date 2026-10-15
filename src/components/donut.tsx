"use client";

import { useEffect, useId, useState } from "react";

export type DonutSegment = { label: string; value: number; color: string };

export default function Donut({
  segments,
  size = 200,
  thickness = 26,
  centerValue,
  centerLabel,
  loading = false,
  animate = true,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue: string | number;
  centerLabel?: string;
  loading?: boolean;
  animate?: boolean;
}) {
  const gradientId = useId();
  const [progress, setProgress] = useState(animate ? 0 : 1);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      return;
    }
    if (!animate) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const start = performance.now();
    const duration = 400;
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [segments, loading, animate, centerValue, centerLabel]);

  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;

  if (loading) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-busy="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E8E6E1" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#E8E6E1" />
          </linearGradient>
        </defs>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={thickness}
            strokeDasharray={`${circ * 0.25} ${circ * 0.75}`}
            className="animate-spin origin-center"
            style={{ transformOrigin: `${size / 2}px ${size / 2}px`, animationDuration: "1.2s" }}
          />
        </g>
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#94A3B8"
          className="animate-pulse"
          style={{ fontSize: size * 0.12, fontWeight: 600 }}
        >
          Loading…
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E6E1" strokeWidth={thickness} />
        {segments.map((s, i) => {
          if (s.value <= 0) return null;
          const len = (s.value / total) * circ * progress;
          const el = (
            <circle
              key={`${s.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += (s.value / total) * circ * progress;
          return el;
        })}
      </g>
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1B2A4A"
        style={{ fontSize: size * 0.18, fontWeight: 700 }}
      >
        {centerValue}
      </text>
      {centerLabel && (
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          fill="#64748B"
          style={{ fontSize: size * 0.08, fontWeight: 500 }}
        >
          {centerLabel}
        </text>
      )}
    </svg>
  );
}
