import { ArrowUpRight } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border bg-background">
    <div className="flex flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <span>
        © {new Date().getFullYear()} Sapphire DAO. All rights reserved.
      </span>
      <div className="flex items-center gap-4">
        <a
          href="https://status.sapphiredaotesting.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 transition-colors hover:text-foreground"
        >
          Status
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
        <span className="font-mono">Built on Ethereum</span>
      </div>
    </div>
  </footer>
);

export default Footer;
