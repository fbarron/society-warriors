"use client";

import { useMemo } from "react";

export default function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);
  return (
    <footer className="w-full text-center py-4 border-t bg-primary text-primary-foreground text-sm mt-auto">
      © {year} Pirate Society. All rights reserved.
    </footer>
  );
}
