"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Fuel } from "lucide-react";
import { useGasTracker } from "@/hooks/useGasTracker";

export function GasTracker() {
  const { tiles, isLoading, error } = useGasTracker();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Fuel className="h-4 w-4 text-primary" />
          Gas Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-lg bg-secondary/50 p-3">
                <div className="mb-1 text-xs text-muted-foreground">
                  {tile.label}
                </div>
                {isLoading ? (
                  <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  <>
                    <div className="font-mono font-medium">{tile.value}</div>
                    {tile.usd && (
                      <div className="text-xs text-muted-foreground">
                        {tile.usd}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
