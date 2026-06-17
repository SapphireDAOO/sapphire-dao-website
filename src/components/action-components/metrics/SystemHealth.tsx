"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity } from "lucide-react";
import { useSystemHealth } from "@/hooks/useSystemHealth";

export function SystemHealth() {
  const { items } = useSystemHealth();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono text-foreground">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
