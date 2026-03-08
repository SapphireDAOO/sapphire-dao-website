"use client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InvoiceFilterBarProps {
  noteQuery: string;
  onNoteQueryChange: (value: string) => void;
  walletQuery: string;
  onWalletQueryChange: (wallet: string) => void;
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
}

export function InvoiceFilterBar({
  noteQuery,
  onNoteQueryChange,
  walletQuery,
  onWalletQueryChange,
  selectedDate,
  onDateChange,
}: InvoiceFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex items-center justify-end gap-2 w-full">
        <Input
          placeholder="Search notes"
          value={noteQuery}
          onChange={(e) => onNoteQueryChange(e.target.value)}
          className="w-48"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              {selectedDate
                ? selectedDate.toLocaleDateString()
                : "Filter by Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate ?? undefined}
              onSelect={(date) => onDateChange(date ?? null)}
              className="rounded-md"
            />
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              More Filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-2">
            <DropdownMenuLabel>Filter by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <input
                type="text"
                placeholder="Enter wallet address"
                value={walletQuery}
                className="w-full border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                onChange={(e) => onWalletQueryChange(e.target.value)}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedDate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(null)}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
