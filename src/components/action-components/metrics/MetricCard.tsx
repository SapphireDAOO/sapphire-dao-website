"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { formatPercent } from "./formatMetric";

interface MetricCardProps {
  title: string;
  /** Pre-formatted display value (USD / count), or the placeholder dash. */
  value: string;
  /** % change vs. the prior window; null when not computable, undefined while loading. */
  change?: number | null;
  changeLabel?: string;
  icon?: React.ReactNode;
  /** Show a skeleton shimmer while the first snapshot loads. */
  isLoading?: boolean;
  /** When set, shows a clickable affordance + this label (e.g. "View payments"). */
  actionLabel?: string;
}

const trendIcon = (change?: number | null) => {
  if (change === undefined || change === null || change === 0)
    return <Minus className="h-3 w-3" />;
  return change > 0 ? (
    <TrendingUp className="h-3 w-3" />
  ) : (
    <TrendingDown className="h-3 w-3" />
  );
};

const trendColor = (change?: number | null) => {
  if (change === undefined || change === null || change === 0)
    return "text-muted-foreground";
  return change > 0 ? "text-emerald-500" : "text-destructive";
};

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  isLoading = false,
  actionLabel,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "bg-card border-border",
        actionLabel &&
          "cursor-pointer transition-colors group-hover:border-primary/60",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {actionLabel ? (
          <ChevronDown
            aria-hidden
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
          />
        ) : (
          icon && <div className="text-primary">{icon}</div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-2xl font-bold font-mono">{value}</div>
        )}
        {(change !== undefined || changeLabel) && !isLoading && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs mt-1",
              trendColor(change),
            )}
          >
            {trendIcon(change)}
            <span>
              {change !== undefined &&
                change !== null &&
                formatPercent(change)}
              {changeLabel && ` ${changeLabel}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
