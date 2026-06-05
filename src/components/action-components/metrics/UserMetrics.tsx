"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, UserPlus, UserCheck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserMetrics as UserMetricsData } from "@/services/metrics/types";
import { formatCount, formatPercent, METRIC_PLACEHOLDER } from "./formatMetric";

interface UserMetricsProps {
  data?: UserMetricsData;
  isLoading?: boolean;
}

const changeColor = (change?: number | null) => {
  if (change === undefined || change === null || change === 0)
    return "text-muted-foreground";
  return change > 0 ? "text-emerald-500" : "text-destructive";
};

export function UserMetrics({ data, isLoading = false }: UserMetricsProps) {
  const tiles = [
    {
      label: "New Creators (7d)",
      icon: <UserPlus className="h-4 w-4" />,
      value: data?.newCreators.value,
      change: data?.newCreators.changePct,
    },
    {
      label: "New Payers (7d)",
      icon: <UserCheck className="h-4 w-4" />,
      value: data?.newPayers.value,
      change: data?.newPayers.changePct,
    },
    {
      label: "Active Users (24h)",
      icon: <Activity className="h-4 w-4" />,
      value: data?.activeUsers.value,
      change: data?.activeUsers.changePct,
    },
    {
      label: "Total Users",
      icon: <Users className="h-4 w-4" />,
      value: data?.totalUsers,
      change: undefined,
    },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" />
          User Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg bg-secondary/50 p-3">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                {tile.icon}
                <span className="text-xs">{tile.label}</span>
              </div>
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-bold">
                    {tile.value !== undefined
                      ? formatCount(tile.value)
                      : METRIC_PLACEHOLDER}
                  </span>
                  {tile.change !== undefined && tile.change !== null && (
                    <span className={cn("text-xs", changeColor(tile.change))}>
                      {formatPercent(tile.change)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
