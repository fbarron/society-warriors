import Link from 'next/link';
import Image from 'next/image';
import { Button } from './ui/button';

export default function Header() {
  return (
    <header className="w-full flex items-center justify-between px-6 py-4 border-b bg-primary text-primary-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Image src="/favicon.svg" alt="Favicon" width={50} height={50} />
        </Link>
        <span className="font-bold text-lg">Pirate Society</span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/auth/login">
          <Button className="bg-[hsl(var(--login-btn))] text-primary-foreground hover:bg-secondary border border-border">Login</Button>
        </Link>
        <Link href="/auth/signup">
          <Button className="bg-[hsl(var(--signup-btn))] text-primary-foreground hover:bg-secondary border border-border">Sign Up</Button>
        </Link>
      </div>
    </header>
  );
}
