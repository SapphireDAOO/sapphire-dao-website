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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { VolumeSeriesPoint } from "@/services/metrics/types";
import { formatUsd } from "./formatMetric";

// Windows the volume series can be viewed over. Capped at 60 days because the
// snapshot query pulls 60 days of daily buckets.
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

interface VolumeChartProps {
  /** Cumulative USD total-volume series, oldest → newest. */
  series: VolumeSeriesPoint[];
  isLoading?: boolean;
}

export function VolumeChart({ series, isLoading = false }: VolumeChartProps) {
  const [activeDays, setActiveDays] = useState<number>(30);

  // Last `activeDays` points, shaped for recharts.
  const data = useMemo(
    () =>
      series.slice(-activeDays).map((point) => ({
        date: dayLabel(point.timestamp),
        volume: point.volumeUsd,
      })),
    [series, activeDays],
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
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
        <div className="h-[280px] w-full">
          {isLoading ? (
            <div className="h-full w-full animate-pulse rounded-md bg-muted" />
          ) : data.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No volume data for this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
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
                  formatter={(value: number) => [formatUsd(value), "Total Volume"]}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  name="Total Volume"
                  stroke="hsl(var(--chart-1))"
                  fillOpacity={1}
                  fill="url(#colorVolume)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
