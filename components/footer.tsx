"use client";

import { useMemo } from "react";

export default function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);
  return (
    <footer className="w-full py-4 border-t bg-primary text-primary-foreground text-sm mt-auto px-4">
      <div className="grid w-full grid-cols-1 items-center gap-3 md:grid-cols-3 md:gap-0">
        <div className="hidden md:block" />
        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
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
        <p className="text-center md:justify-self-end md:text-right">© {year} Society Warriors. All rights reserved.</p>
      </div>
    </footer>
  );
}
