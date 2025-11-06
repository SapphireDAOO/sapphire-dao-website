"use client";
import { useState } from "react";

interface FilterTabsProps {
  filters: string[];
  onSelect: (filter: string) => void;
}

export default function FilterTabs({ filters, onSelect }: FilterTabsProps) {
  const [active, setActive] = useState("All");

  return (
    <div className="relative flex flex-wrap gap-4 border-b border-gray-200 mb-6">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => {
            setActive(f);
            onSelect(f);
          }}
          className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            active === f ? "text-black" : "text-gray-500 hover:text-black"
          }`}
        >
          {f}

          {active === f && (
            <span className="absolute left-0 right-0 -bottom-[2px] h-[2px] bg-black rounded-full transition-all duration-300" />
          )}
        </button>
      ))}
    </div>
  );
}
