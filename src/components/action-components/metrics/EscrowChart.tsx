"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { EscrowSeriesPoint } from "@/services/metrics/types";
import { formatUsd } from "./formatMetric";

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "60D", days: 60 },
] as const;

const dayLabel = (timestampSeconds: number): string =>
  new Date(timestampSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

interface EscrowChartProps {
  /** Daily running escrow-balance series, oldest → newest. */
  series: EscrowSeriesPoint[];
  isLoading?: boolean;
}

export function EscrowChart({ series, isLoading = false }: EscrowChartProps) {
  const [activeDays, setActiveDays] = useState<number>(30);

  // Points within the last `activeDays` days (filter by timestamp, not count —
  // the series only has points for days with escrow movement).
  const data = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - activeDays * 86400;
    return series
      .filter((point) => point.timestamp >= cutoff)
      .map((point) => ({
        date: dayLabel(point.timestamp),
        balance: point.balanceUsd,
      }));
  }, [series, activeDays]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.days}
              variant={activeDays === range.days ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveDays(range.days)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          {isLoading ? (
            <div className="h-full w-full animate-pulse rounded-md bg-muted" />
          ) : data.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No escrow data for this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  tickFormatter={(value: number) => formatUsd(value)}
                  width={56}
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--card-foreground))",
                  }}
                  formatter={(value: number) => [formatUsd(value), "Balance"]}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
