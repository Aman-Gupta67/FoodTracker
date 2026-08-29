"use client";

import { motion } from "motion/react";

// Hand-rolled SVG ring — no chart library, per CLAUDE.md (Dashboard's trend
// graphs are the one deliberate exception). Over-target renders in
// stone-600, not red: "information, not a scolding."
const SIZE = 128;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({
  consumed,
  target,
}: {
  consumed: number;
  target: number;
}) {
  const remaining = target - consumed;
  const isOver = remaining < 0;
  const ratio = target > 0 ? Math.min(1, consumed / target) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <defs>
          <linearGradient id="calorie-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary-400)" />
            <stop offset="100%" stopColor="var(--color-primary-600)" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary-100)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={isOver ? "var(--color-stone-500)" : "url(#calorie-ring-gradient)"}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeLinecap="round"
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={
            "text-xl font-extrabold tracking-tight " +
            (isOver ? "text-stone-600" : "text-stone-900")
          }
        >
          {Math.round(Math.abs(remaining))}
        </span>
        <span className="text-[10.5px] font-semibold text-stone-500">
          {isOver ? "over" : "kcal left"}
        </span>
      </div>
    </div>
  );
}
