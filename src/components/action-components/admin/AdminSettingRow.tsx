"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

interface AdminSettingRowProps {
  label: string;
  inputId: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  onAction: () => void;
  loadingKey: string;
  isLoading: string | boolean | undefined;
  buttonText: string;
  description: string;
}

const AdminSettingRow = ({
  label,
  inputId,
  inputProps,
  onAction,
  loadingKey,
  isLoading,
  buttonText,
  description,
}: AdminSettingRowProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={inputId}>{label}</Label>
    <div className="flex gap-2">
      <Input
        id={inputId}
        aria-describedby={`${inputId}Description`}
        className="w-full"
        {...inputProps}
      />
      <Button
        onClick={onAction}
        disabled={isLoading === loadingKey}
        aria-busy={isLoading === loadingKey}
      >
        {isLoading === loadingKey ? (
          <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
        ) : (
          buttonText
        )}
      </Button>
    </div>
    <p id={`${inputId}Description`} className="text-sm text-muted-foreground">
      {description}
    </p>
  </div>
);

export default AdminSettingRow;
