"use client";

import { useState } from "react";

interface FilterTabsProps {
  filters: string[];
  onSelect: (filter: string) => void;
}

export default function FilterTabs({ filters, onSelect }: FilterTabsProps) {
  const [active, setActive] = useState("All");

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-6">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => {
            setActive(f);
            onSelect(f);
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            active === f
              ? "text-black border-black"
              : "text-gray-700 border-transparent hover:text-black hover:border-black"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
