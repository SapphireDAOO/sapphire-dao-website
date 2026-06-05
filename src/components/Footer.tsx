const Footer = () => (
  <footer className="border-t border-white/10 bg-primary text-white">
    <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
      <span>
        © {new Date().getFullYear()} Sapphire DAO. All rights reserved.
      </span>
      <span>Built on Base</span>
    </div>
  </footer>
);

export default Footer;
