"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "./ui/button";

type MobileHeaderMenuProps = {
  children: ReactNode;
};

export function MobileHeaderMenu({ children }: MobileHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-haspopup="dialog"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <div
          id={menuId}
          className="fixed left-0 right-0 top-16 border-b border-border bg-primary/45 p-4 text-primary-foreground shadow-lg backdrop-blur-md"
          role="dialog"
          aria-modal="false"
        >
          <nav className="mx-auto mb-3 flex w-full max-w-6xl flex-col items-center gap-2" aria-label="Mobile navigation">
            <Button asChild variant="ghost" className="w-full justify-center text-center" onClick={() => setIsOpen(false)}>
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-center text-center" onClick={() => setIsOpen(false)}>
              <Link href="/communities">Societies</Link>
            </Button>
          </nav>

          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 text-center" onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
