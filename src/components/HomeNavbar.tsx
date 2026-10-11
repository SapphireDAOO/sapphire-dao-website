import Link from "next/link";

/**
 * The home page's navbar. Kept apart from Navigation.tsx, which imports
 * RainbowKit and wagmi hooks: the home page links into the app and needs
 * none of the wallet code.
 */
const HomeNavbar = () => (
  <nav className="bg-primary text-white p-4 shadow-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div className="text-xl font-semibold">
        <Link
          href="/"
          className="text-destructive hover:text-gray-200"
          aria-label="Go to home"
        >
          Sapphire DAO
        </Link>
      </div>

      <Link
        href="/dashboard"
        className="bg-destructive text-primary px-4 py-2 rounded-lg shadow-md hover:bg-gray-200 transition"
        aria-label="Open App"
      >
        Open App
      </Link>
    </div>
  </nav>
);

export default HomeNavbar;
