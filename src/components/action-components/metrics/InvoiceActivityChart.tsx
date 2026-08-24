"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { InvoiceActivityPoint } from "@/services/metrics/types";

// The design fixes this card to a rolling 7-day view.
const WINDOW_DAYS = 7;

const dayLabel = (timestampSeconds: number): string =>
  new Date(timestampSeconds * 1000).toLocaleDateString("en-US", {
    weekday: "short",
  });

interface InvoiceActivityChartProps {
  /** Daily invoice-paid activity split by processor, oldest → newest. */
  series: InvoiceActivityPoint[];
  isLoading?: boolean;
}

export function InvoiceActivityChart({
  series,
  isLoading = false,
}: InvoiceActivityChartProps) {
  const data = useMemo(
    () =>
      series.slice(-WINDOW_DAYS).map((point) => ({
        day: dayLabel(point.timestamp),
        website: point.website,
        marketplace: point.marketplace,
      })),
    [series],
  );

  // The series is zero-filled to a full window, so "no data" means every
  // point is zero rather than an empty array.
  const hasActivity = data.some(
    (point) => point.website > 0 || point.marketplace > 0,
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Invoice Activity (7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          {isLoading ? (
            <div className="h-full w-full animate-pulse rounded-md bg-muted" />
          ) : !hasActivity ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No invoice activity yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorWebsite" x1="0" y1="0" x2="0" y2="1">
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
                  <linearGradient
                    id="colorMarketplace"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--card-foreground))",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "10px" }}
                  formatter={(value) => (
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>
                      {value}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="website"
                  name="Website"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWebsite)"
                />
                <Area
                  type="monotone"
                  dataKey="marketplace"
                  name="Marketplace"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMarketplace)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
