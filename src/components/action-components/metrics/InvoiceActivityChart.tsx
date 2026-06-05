"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
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
          ) : data.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No invoice activity yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
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
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
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
                <Bar
                  dataKey="website"
                  name="Website"
                  fill="hsl(var(--chart-1))"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="marketplace"
                  name="Marketplace"
                  fill="hsl(var(--chart-2))"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
