"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Coins,
  FileText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BrandMark from "@/components/BrandMark";
import ConnectWalletButton from "@/components/wallet/ConnectWalletButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useSignIn } from "@/components/SignInProvider";

const ADMIN_LINKS = [
  {
    label: "Invoices",
    path: "/invoices",
    description: "Every invoice across both processors",
    Icon: FileText,
  },
  {
    label: "Governance",
    path: "/governance",
    description: "Propose, sign and execute transactions",
    Icon: Users,
  },
  {
    label: "Fee Activities",
    path: "/fee-activities",
    description: "Collected fees and recent sweeps",
    Icon: Coins,
  },
] as const;

const NavLink = ({
  label,
  active = false,
  href,
  ariaLabel,
}: {
  label: string;
  active?: boolean;
  href: string;
  ariaLabel: string;
}) => (
  <Link
    href={href}
    aria-label={ariaLabel}
    aria-current={active ? "page" : undefined}
    className={cn(
      "relative px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      active
        ? "text-primary"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {label}
    <span
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-0.5 h-0.5 origin-center bg-primary transition-transform duration-200",
        active ? "scale-x-100" : "scale-x-0",
      )}
    />
  </Link>
);

const HOVER_CLOSE_DELAY_MS = 150;

const AdminMenu = ({
  activePath,
  links,
}: {
  activePath: string;
  links: typeof ADMIN_LINKS[number][];
}) => {
  const active = links.some((link) => link.path === activePath);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => cancelClose, [cancelClose]);

  // Touch fires pointerenter on tap too,
  // which would race the tap-to-open toggle.
  const handleEnter = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelClose();
      setOpen(true);
    },
    [cancelClose],
  );

  const handleLeave = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelClose();
      closeTimer.current = setTimeout(
        () => setOpen(false),
        HOVER_CLOSE_DELAY_MS,
      );
    },
    [cancelClose],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      cancelClose();
      setOpen(next);
    },
    [cancelClose],
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger
        aria-label="Open admin menu"
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        className={cn(
          "group relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          "data-[state=open]:text-foreground",
          active
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Admin
        <ChevronDown
          className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-x-3 bottom-0.5 h-0.5 origin-center bg-primary transition-transform duration-200",
            active ? "scale-x-100" : "scale-x-0",
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 p-1.5"
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
      >
        <DropdownMenuLabel className="px-2.5 pb-1 pt-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {links.map(({ label, path, description, Icon }) => {
          const isActive = activePath === path;

          return (
            <DropdownMenuItem
              key={path}
              asChild
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative cursor-pointer items-start gap-3 px-2.5 py-2",
                isActive && "bg-accent",
              )}
            >
              <Link href={path}>
                <span
                  className={cn(
                    "pointer-events-none absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 bg-primary transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-transparent bg-muted text-muted-foreground group-focus:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">{label}</span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {description}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Navbar = () => {
  const { isAllowed: canAccessAdmin, canAccessGovernance } = useAdminAccess();
  const isSignedIn = useSignIn().status === "signedIn";
  const pathname = usePathname();

  // `trailingSlash: true` makes usePathname end in "/".
  const path = useMemo(
    () => (pathname ?? "/").replace(/\/+$/, "") || "/",
    [pathname],
  );

  // The emergency pauser isn't an admin but
  // needs the governance page's pause control.
  const adminLinks = useMemo(() => {
    if (canAccessAdmin) return [...ADMIN_LINKS];
    if (canAccessGovernance) {
      return ADMIN_LINKS.filter((link) => link.path === "/governance");
    }
    return [];
  }, [canAccessAdmin, canAccessGovernance]);

  const isMetrics = path === "/metrics";
  const isAdminSection = ADMIN_LINKS.some((link) => link.path === path);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Go to home"
          >
            <BrandMark />
          </Link>

          <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
            {isSignedIn && (isAdminSection ? (
              <>
                <NavLink
                  label="Dashboard"
                  ariaLabel="Return to dashboard"
                  href="/dashboard"
                />
                <NavLink
                  label="Metrics"
                  ariaLabel="Go to metrics"
                  href="/metrics"
                />
              </>
            ) : isMetrics ? (
              <NavLink
                label="Dashboard"
                ariaLabel="Go to dashboard"
                href="/dashboard"
              />
            ) : (
              <NavLink
                label="Metrics"
                ariaLabel="Go to metrics"
                href="/metrics"
              />
            ))}
            {isSignedIn && adminLinks.length > 0 && (
              <AdminMenu activePath={path} links={adminLinks} />
            )}
            <div className="ml-1 sm:ml-2">
              <ConnectWalletButton className="h-9" />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
