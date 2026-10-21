import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Left column 50%, right 29%, the remaining 21% between them, at every
 * width down to a phone. The left column is a size container so
 * its type can scale with it (`cqw`).
 */
export const CheckoutColumns = ({
  left,
  right,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}) => (
  <div className={cn("grid grid-cols-[50%_29%] justify-between", className)}>
    <div className="min-w-0 [container-type:inline-size]">{left}</div>
    <div className="min-w-0">{right}</div>
  </div>
);

export const Eyebrow = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 sm:text-[11px]",
      className,
    )}
  >
    {children}
  </p>
);

const textLinkClass =
  "text-xs text-stone-600 underline-offset-4 transition-colors hover:text-stone-900 hover:underline sm:text-sm";

/** App routes (a leading "/") navigate in place; anything else is a plain link. */
export const TextLink = ({
  href,
  children,
  external = true,
  className,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) =>
  href.startsWith("/") ? (
    <Link href={href} className={cn(textLinkClass, className)}>
      {children}
    </Link>
  ) : (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(textLinkClass, className)}
    >
      {children}
      {external && (
        <ArrowUpRight className="ml-1 inline h-3 w-3 align-[-1px]" />
      )}
    </a>
  );

/** The page frame both payment pages share. */
export const PaymentShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-stone-100 text-stone-900 antialiased">
    <div className="mx-auto max-w-5xl space-y-14 px-4 pb-20 pt-6 sm:space-y-24 sm:px-10 sm:pt-12">
      {children}
    </div>
  </div>
);

export const ShellMessage = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-stone-600 sm:text-base">{children}</p>
);

const StepRail = ({ step, total }: { step: number; total: number }) => (
  <ol
    aria-label={`Step ${step} of ${total}`}
    className="flex shrink-0 flex-col items-center pt-0.5"
  >
    {Array.from({ length: total }, (_, index) => {
      const position = index + 1;
      const state =
        position < step ? "done" : position === step ? "current" : "next";
      return (
        <li key={position} className="flex flex-col items-center">
          {index > 0 && (
            <span
              className={cn(
                "h-8 w-px sm:h-10",
                state === "next" ? "bg-stone-300" : "bg-stone-800",
              )}
            />
          )}
          <span
            className={cn(
              "flex items-center justify-center rounded-full",
              state === "done" && "h-3 w-3 bg-stone-800 text-white",
              state === "current" &&
                "h-2.5 w-2.5 bg-blue-900 ring-4 ring-blue-900/15",
              state === "next" && "h-2 w-2 border border-stone-400",
            )}
          >
            {state === "done" && <Check className="h-2 w-2" strokeWidth={4} />}
          </span>
        </li>
      );
    })}
  </ol>
);

export const CheckoutStep = ({
  step,
  total,
  title,
  icon,
  children,
}: {
  step: number;
  total: number;
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}) => (
  <section className="flex gap-3 sm:gap-8">
    <StepRail step={step} total={total} />
    <div className="min-w-0 flex-1">
      <Eyebrow>
        Step {step} <span className="text-stone-400">/ {total}</span>
      </Eyebrow>
      <h2 className="mt-2 flex items-start gap-2 text-[clamp(1.125rem,9cqw,2.25rem)] leading-[1.1] tracking-[-0.03em] text-stone-900 sm:mt-3">
        {icon}
        <span>{title}</span>
      </h2>
      <div className="mt-3 space-y-4 text-xs leading-relaxed text-stone-600 sm:mt-4 sm:text-[15px]">
        {children}
      </div>
    </div>
  </section>
);

export type StatusTone = "waiting" | "active" | "success" | "warning";

const TONE_DOT: Record<StatusTone, string> = {
  waiting: "bg-stone-400",
  active: "bg-blue-900 animate-pulse",
  success: "bg-emerald-600",
  warning: "bg-amber-500",
};

/** The right column's account of the step on its left. */
export const StatusPanel = ({
  tone,
  title,
  children,
  links,
}: {
  tone: StatusTone;
  title: string;
  children?: ReactNode;
  links?: ReactNode;
}) => (
  <aside className="border-t border-stone-300 pt-3" aria-live="polite">
    <Eyebrow>Status</Eyebrow>
    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-snug text-stone-900 sm:gap-2 sm:text-sm">
      <span
        className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
      />
      {title}
    </p>
    {children && (
      <div className="mt-2 text-[11px] leading-relaxed text-stone-500 sm:text-[13px]">
        {children}
      </div>
    )}
    {links && (
      <div className="mt-3 flex flex-col items-start gap-2">{links}</div>
    )}
  </aside>
);

export const PrimaryButton = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cn(
      "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 disabled:cursor-not-allowed disabled:bg-stone-400 sm:w-auto sm:px-6 sm:text-sm",
      className,
    )}
  />
);
