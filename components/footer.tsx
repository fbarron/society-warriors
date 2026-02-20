"use client";

import { useMemo } from "react";

export default function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);
  return (
    <footer className="w-full py-4 border-t bg-primary text-primary-foreground text-sm mt-auto px-4">
      <div className="grid grid-cols-3 items-center w-full">
        <div />
        <nav className="flex items-center justify-center gap-8">
        <a href="/privacy" className="hover:underline">
          Privacy
        </a>
        <a href="/terms" className="hover:underline">
          Terms
        </a>
        <a href="/contactus" className="hover:underline">
          Contact
        </a>
        </nav>
        <p className="text-right justify-self-end">© {year} Society Warriors. All rights reserved.</p>
      </div>
    </footer>
  );
}
