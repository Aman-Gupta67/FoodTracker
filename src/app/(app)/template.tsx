"use client";

import { motion } from "motion/react";

// template.tsx (unlike layout.tsx) remounts on every navigation within the
// route group, which is exactly what a per-page enter transition needs —
// a subtle fade+rise instead of a hard cut between bottom-tab screens.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
