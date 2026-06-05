"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
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
}: MetricCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-primary">{icon}</div>}
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
