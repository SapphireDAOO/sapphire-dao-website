import Link from "next/link";
import BrandMark from "./BrandMark";

// Separate from Navigation so the home page doesn't pull in wallet code.
const HomeNavbar = () => (
  <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
    <div className="flex h-16 items-center justify-between gap-3 px-5 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Go to home">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight">Sapphire DAO</span>
      </Link>

      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        aria-label="Open App"
      >
        Open app
      </Link>
    </div>
  </nav>
);

export default HomeNavbar;
