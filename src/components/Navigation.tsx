"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname, useRouter } from "next/navigation";
import { buttonVariants } from "./ui/button";
import { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const Navbar = () => {
  const { isAllowed: canAccessAdmin } = useAdminAccess();
  const router = usePathname();
  const navigator = useRouter();

  const goTo = useCallback((path: string) => {
    navigator.push(path);
  }, [navigator]);

  const isHome = useMemo(() => router === "/", [router]);
  const isAdminSection = useMemo(
    () => router === "/admin" || router === "/invoices",
    [router],
  );

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
              <div className="flex gap-5">
                {canAccessAdmin &&
                  (router === "/admin" ? (
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "hover:text-red-500"
                      )}
                      onClick={() => goTo("/dashboard")}
                      aria-label="Go to dashboard"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "hover:text-red-500"
                      )}
                      onClick={() => goTo("/admin")}
                      aria-label="Go to admin"
                    >
                      ADMIN
                    </button>
                  ))}
                {canAccessAdmin && isAdminSection && (
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex gap-5">
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "hover:text-blue-400",
                          router === "/invoices" && "text-blue-400"
                        )}
                        onClick={() => goTo("/invoices")}
                        aria-label="Go to invoices"
                      >
                        INVOICES
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "hover:text-blue-400",
                    router === "/multisig" && "text-blue-400"
                  )}
                  onClick={() => goTo("/multisig")}
                  aria-label="Go to multisig"
                >
                  MULTISIG
                </button>
                <ConnectButton chainStatus="icon" showBalance={false} />
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
