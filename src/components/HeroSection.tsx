/** @jsxImportSource react */
"use client";

import { ArrowUpRight, Book, Github } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

const HeroSection = () => {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center px-5 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Invoicing and escrow on Ethereum
        </span>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
          Welcome to Sapphire DAO
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Sapphire DAO is a platform on the Ethereum blockchain used for paying
          for goods and services. This payment system makes use of
          cryptocurrency as a medium of transaction.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="https://sapphiredao.gitbook.io/sapphiredao-docs"
            className={cn(buttonVariants({ variant: "default" }), "h-10")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Book />
            Documentation
            <ArrowUpRight />
          </Link>
          <Link
            href="https://github.com/SapphireDAOO"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 border-primary bg-transparent text-primary hover:bg-primary/5 hover:text-primary",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github />
            GitHub
            <ArrowUpRight />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
