import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { Button } from './ui/button';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';
import { NotificationsDropdown } from './notifications-dropdown';
import { MobileHeaderMenu } from './mobile-header-menu';

function HeaderAuthFallback() {
  return (
    <>
      <Link href="/auth/login">
        <Button className="bg-[hsl(var(--login-btn))] text-primary-foreground hover:bg-secondary border border-border">Login</Button>
      </Link>
      <Link href="/auth/signup">
        <Button className="bg-[hsl(var(--signup-btn))] text-primary-foreground hover:bg-secondary border border-border">Sign Up</Button>
      </Link>
    </>
  );
}

async function HeaderAuthActions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <HeaderAuthFallback />;
  }

  return (
    <>
      <Link href="/protected">
        <Button className="bg-[hsl(var(--login-btn))] text-primary-foreground hover:bg-secondary border border-border">
          Feed
        </Button>
      </Link>
      <Link href="/protected/posts">
        <Button className="bg-[hsl(var(--login-btn))] text-primary-foreground hover:bg-secondary border border-border">
          Chat
        </Button>
      </Link>
      <Link href="/profile">
        <Button className="bg-[hsl(var(--signup-btn))] text-primary-foreground hover:bg-secondary border border-border">
          Profile
        </Button>
      </Link>
      <LogoutButton />
    </>
  );
}

function MobileHeaderAuthFallback() {
  return (
    <>
      <Link href="/auth/login">
        <Button className="w-32 justify-center bg-[hsl(var(--login-btn))] text-primary-foreground hover:bg-secondary border border-border">Login</Button>
      </Link>
      <Link href="/auth/signup">
        <Button className="w-32 justify-center bg-[hsl(var(--signup-btn))] text-primary-foreground hover:bg-secondary border border-border">Sign Up</Button>
      </Link>
    </>
  );
}

async function MobileHeaderAuthActions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <MobileHeaderAuthFallback />;
  }

  const mobileActionButtonClass =
    'w-32 justify-center bg-[hsl(var(--login-btn))] text-primary-foreground hover:bg-secondary border border-border';

  return (
    <>
      <Link href="/protected">
        <Button className={mobileActionButtonClass}>Feed</Button>
      </Link>
      <Link href="/protected/posts">
        <Button className={mobileActionButtonClass}>Chat</Button>
      </Link>
      <Link href="/profile">
        <Button className={mobileActionButtonClass}>Profile</Button>
      </Link>
      <LogoutButton className={mobileActionButtonClass} />
    </>
  );
}

export default function Header() {

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-primary/95 text-primary-foreground shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="hidden w-full items-center justify-between md:flex">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-secondary/30">
              <Image src="/favicon.svg" alt="Society Warriors" width={38} height={38} />
              <span className="text-base font-bold tracking-tight md:text-lg">Society Warriors</span>
            </Link>

            <nav className="flex items-center gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link href="/">Home</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/communities">Societies</Link>
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <Suspense fallback={<HeaderAuthFallback />}>
              <HeaderAuthActions />
            </Suspense>
          </div>
        </div>

        <div className="flex w-full items-center justify-between md:hidden">
          <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-secondary/30">
            <Image src="/favicon.svg" alt="Society Warriors" width={38} height={38} />
            <span className="text-base font-bold tracking-tight">Society Warriors</span>
          </Link>

          <div className="flex items-center gap-1">
            <NotificationsDropdown />
            <MobileHeaderMenu>
              <Suspense fallback={<MobileHeaderAuthFallback />}>
                <MobileHeaderAuthActions />
              </Suspense>
            </MobileHeaderMenu>
          </div>
        </div>
      </div>
    </header>
  );
}