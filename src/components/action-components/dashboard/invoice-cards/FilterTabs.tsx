"use client";

import { InfoTip } from "@/components/ui/info-tip";

interface FilterTabsProps {
  filters: string[];
  activeFilter: string;
  onSelect: (filter: string) => void;
  /** What each status means, shown from an info button beside it. */
  descriptions?: Record<string, string>;
}

export default function FilterTabs({
  filters,
  activeFilter,
  onSelect,
  descriptions,
}: FilterTabsProps) {
  return (
    <div className="relative flex flex-wrap gap-4 border-b border-gray-200 mb-6">
      {filters.map((f) => {
        const meaning = descriptions?.[f];
        return (
          <div key={f} className="relative flex items-center">
            <button
              onClick={() => onSelect(f)}
              className={`py-2 text-sm font-medium transition-colors duration-200 ${
                meaning ? "pl-4 pr-1" : "px-4"
              } ${
                activeFilter === f
                  ? "text-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              {f}
            </button>

            {meaning && (
              <InfoTip
                label={`What ${f.toLowerCase()} means`}
                className="mr-2 text-gray-400"
              >
                {meaning}
              </InfoTip>
            )}

            {activeFilter === f && (
              <span className="absolute left-0 right-0 -bottom-[2px] h-[2px] bg-black rounded-full transition-all duration-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}
