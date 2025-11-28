"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname, useRouter } from "next/navigation";
import { buttonVariants } from "./ui/button";
import { useAccount } from "wagmi";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useEffect, useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// Navbar component definition
const Navbar = () => {
  const { address, isConnected } = useAccount(); // Retrieve wallet address and connection status
  const { data: allowedAddress } = useGetOwner(); // Fetch the contract owner's address
  const [admin, setAdmin] = useState(false); // State to track if the connected wallet is the admin
  const router = usePathname(); // Get the current route path
  const navigator = useRouter();

  // Effect to check if the connected address matches the admin address
  useEffect(() => {
    if (isConnected && address && allowedAddress) {
      setAdmin(address === allowedAddress); // Set admin status based on address comparison
    }
  }, [isConnected, address, allowedAddress]); // Dependency array for re-evaluation

  const goTo = useCallback((path: string) => {
    // Try client-side navigation first, then hard reload as fallback (helps on mobile Safari)
    navigator.push(path);
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  }, [navigator]);

  const isHome = useMemo(() => router === "/", [router]);

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
                {admin &&
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
                {/* Admin Navigation Bar - Only visible on `/admin` route */}
                {router.startsWith("/admin") && (
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex gap-5">
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "hover:text-blue-400"
                        )}
                        onClick={() => goTo("/invoices")}
                        aria-label="Go to invoices"
                      >
                        INVOICES
                      </button>
                    </div>
                  </div>
                )}

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
