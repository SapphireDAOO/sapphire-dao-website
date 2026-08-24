"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/hooks/useAdminAccess";

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

  // `trailingSlash: true` makes usePathname return e.g. "/admin/", so strip the
  // trailing slash before comparing.
  const path = useMemo(
    () => (pathname ?? "/").replace(/\/+$/, "") || "/",
    [pathname],
  );

  const isHome = path === "/";
  const isMetrics = path === "/metrics";
  const isAdminSection =
    path === "/admin" || path === "/invoices" || path === "/multisig";

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
                      <>
                        <NavLink
                          label="Invoices"
                          ariaLabel="Go to invoices"
                          active={path === "/invoices"}
                          onClick={() => goTo("/invoices")}
                        />
                        <NavLink
                          label="Admin"
                          ariaLabel="Go to admin"
                          active={path === "/admin"}
                          onClick={() => goTo("/admin")}
                        />
                        <NavLink
                          label="Multisig"
                          ariaLabel="Go to multisig"
                          active={path === "/multisig"}
                          onClick={() => goTo("/multisig")}
                        />
                      </>
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
                      <>
                        <NavLink
                          label="Admin"
                          ariaLabel="Go to admin"
                          onClick={() => goTo("/admin")}
                        />
                        <NavLink
                          label="Multisig"
                          ariaLabel="Go to multisig"
                          onClick={() => goTo("/multisig")}
                        />
                      </>
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
