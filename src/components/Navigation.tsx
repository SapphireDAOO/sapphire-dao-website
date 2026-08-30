"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Coins,
  FileText,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAccess } from "@/hooks/useAdminAccess";

/**
 * The admin-only pages, grouped behind one nav entry. Each carries a line of
 * its own: four terse labels give no clue which page holds what, and these are
 * pages an admin reaches for rarely.
 */
const ADMIN_LINKS = [
  {
    label: "Controls",
    path: "/controls",
    description: "Protocol settings and emergency pause",
    Icon: SlidersHorizontal,
  },
  {
    label: "Invoices",
    path: "/invoices",
    description: "Every invoice across both processors",
    Icon: FileText,
  },
  {
    label: "Multisig",
    path: "/multisig",
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

/** A single nav link: uniform typography, subtle hover, animated active underline. */
const NavLink = ({
  label,
  active = false,
  onClick,
  ariaLabel,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-current={active ? "page" : undefined}
    className={cn(
      "relative rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      active
        ? "text-white"
        : "text-white/60 hover:text-white hover:bg-white/10",
    )}
  >
    {label}
    <span
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 origin-center rounded-full bg-blue-400 transition-transform duration-200",
        active ? "scale-x-100" : "scale-x-0",
      )}
    />
  </button>
);

// Long enough to cross the gap between the trigger and the menu without the
// menu closing under the pointer.
const HOVER_CLOSE_DELAY_MS = 150;

/** The admin group: reads as a NavLink until opened, then lists the section. */
const AdminMenu = ({
  activePath,
  onSelect,
}: {
  activePath: string;
  onSelect: (path: string) => void;
}) => {
  const active = ADMIN_LINKS.some((link) => link.path === activePath);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => cancelClose, [cancelClose]);

  // Touch fires pointerenter on tap as well, which would race the tap-to-open
  // toggle and leave the menu flickering shut. Those keep the click path.
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

  // Radix drives this on click, Escape, outside-click and item select; a
  // pending hover-close would otherwise reopen or re-close after those.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      cancelClose();
      setOpen(next);
    },
    [cancelClose],
  );

  return (
    // `modal` would make the rest of the page inert and hide the scrollbar
    // while the menu is up, which is wrong for something a pointer opens in
    // passing.
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger
        aria-label="Open admin menu"
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        className={cn(
          "group relative flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          "data-[state=open]:bg-white/10 data-[state=open]:text-white",
          active
            ? "text-white"
            : "text-white/60 hover:text-white hover:bg-white/10",
        )}
      >
        Admin
        <ChevronDown
          className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 origin-center rounded-full bg-blue-400 transition-transform duration-200",
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

        {ADMIN_LINKS.map(({ label, path, description, Icon }) => {
          const isActive = activePath === path;

          return (
            <DropdownMenuItem
              key={path}
              onSelect={() => onSelect(path)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative cursor-pointer items-start gap-3 rounded-md px-2.5 py-2",
                isActive && "bg-accent",
              )}
            >
              {/* Echoes the navbar's underline, so "you are here" reads the
                  same whether the menu is open or shut. */}
              <span
                className={cn(
                  "pointer-events-none absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-blue-500 transition-opacity duration-200",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                  isActive
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
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
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Navbar = () => {
  const { isAllowed: canAccessAdmin } = useAdminAccess();
  const pathname = usePathname();
  const navigator = useRouter();

  const goTo = useCallback(
    (path: string) => {
      navigator.push(path);
    },
    [navigator],
  );

  // `trailingSlash: true` makes usePathname return e.g. "/controls/", so strip
  // the trailing slash before comparing.
  const path = useMemo(
    () => (pathname ?? "/").replace(/\/+$/, "") || "/",
    [pathname],
  );

  const isHome = path === "/";
  const isMetrics = path === "/metrics";
  const isAdminSection = ADMIN_LINKS.some((link) => link.path === path);

  return (
    <>
      {/* Main Navbar */}
      <nav className="bg-primary text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-xl font-semibold">
            <button
              type="button"
              onClick={() => goTo("/")}
              className="text-destructive hover:text-gray-200"
              aria-label="Go to home"
            >
              Sapphire DAO
            </button>
          </div>

          <div>
            {isHome ? (
              <button
                type="button"
                className="bg-destructive text-primary px-4 py-2 rounded-lg shadow-md hover:bg-gray-200 transition"
                onClick={() => goTo("/dashboard")}
                aria-label="Open App"
              >
                Open App
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                {isAdminSection ? (
                  <>
                    {/* Return out of the admin section. */}
                    <NavLink
                      label="Dashboard"
                      ariaLabel="Return to dashboard"
                      onClick={() => goTo("/dashboard")}
                    />
                    <NavLink
                      label="Metrics"
                      ariaLabel="Go to metrics"
                      onClick={() => goTo("/metrics")}
                    />
                    {canAccessAdmin && (
                      <AdminMenu activePath={path} onSelect={goTo} />
                    )}
                  </>
                ) : (
                  <>
                    {isMetrics ? (
                      <NavLink
                        label="Dashboard"
                        ariaLabel="Go to dashboard"
                        onClick={() => goTo("/dashboard")}
                      />
                    ) : (
                      <NavLink
                        label="Metrics"
                        ariaLabel="Go to metrics"
                        onClick={() => goTo("/metrics")}
                      />
                    )}
                    {canAccessAdmin && (
                      <AdminMenu activePath={path} onSelect={goTo} />
                    )}
                  </>
                )}
                <div className="ml-2">
                  <ConnectButton chainStatus="icon" showBalance={false} />
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
