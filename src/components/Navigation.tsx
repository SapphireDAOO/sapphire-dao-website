"use client";

import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "./ui/button";
import { useAccount } from "wagmi";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Navbar component definition
const Navbar = () => {
  const { address, isConnected } = useAccount(); // Retrieve wallet address and connection status
  const { data: allowedAddress } = useGetOwner(); // Fetch the contract owner's address
  const [admin, setAdmin] = useState(false); // State to track if the connected wallet is the admin
  const router = usePathname(); // Get the current route path

  // Effect to check if the connected address matches the admin address
  useEffect(() => {
    if (isConnected && address && allowedAddress) {
      setAdmin(address === allowedAddress); // Set admin status based on address comparison
    }
  }, [isConnected, address, allowedAddress]); // Dependency array for re-evaluation

  return (
    <>
      {/* Main Navbar */}
      <nav className="bg-primary text-white p-4 shadow-md sticky top-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-xl font-semibold">
            <Link href="/" className="text-destructive hover:text-gray-200">
              Sapphire DAO
            </Link>
          </div>

          <div>
            {router === "/" ? (
              <Link
                className="bg-destructive text-primary px-4 py-2 rounded-lg shadow-md hover:bg-gray-200 transition"
                href="/dashboard"
              >
                Open App
              </Link>
            ) : (
              <div className="flex gap-5">
                {admin &&
                  (router === "/admin" ? (
                    <Link
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "hover:text-red-500"
                      )}
                      href="/dashboard"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "hover:text-red-500"
                      )}
                      href="/admin"
                    >
                      ADMIN
                    </Link>
                  ))}
                {/* Admin Navigation Bar - Only visible on `/admin` route */}
                {router.startsWith("/admin") && (
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex gap-5">
                      <Link
                        href="/admin/invoices"
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "hover:text-blue-400"
                        )}
                      >
                        INVOICES
                      </Link>
                    </div>
                  </div>
                )}

                <ConnectKitButton />
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
