"use client";
import { Button } from "@/components/ui/button";

interface InvoicePaginationControlsProps {
  page: number;
  hasNextPage: boolean;
  isLoading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function InvoicePaginationControls({
  page,
  hasNextPage,
  isLoading,
  onPrev,
  onNext,
}: InvoicePaginationControlsProps) {
  const showPrev = page > 1;
  const showNext = hasNextPage;

  if (!showPrev && !showNext) return null;

  return (
    <div className="w-full flex justify-center items-center gap-4 mt-8">
      {showPrev && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-none"
          disabled={isLoading}
          onClick={onPrev}
        >
          Previous
        </Button>
      )}

      <span className="font-mono text-xs text-muted-foreground">Page {page}</span>

      {showNext && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-none"
          disabled={isLoading}
          onClick={onNext}
        >
          {isLoading ? "Loading…" : "Next"}
        </Button>
      )}
    </div>
  );
}
