"use client";

interface FilterTabsProps {
  filters: string[];
  activeFilter: string;
  onSelect: (filter: string) => void;
}

export default function FilterTabs({
  filters,
  activeFilter,
  onSelect,
}: FilterTabsProps) {
  return (
    <div className="relative flex flex-wrap gap-4 border-b border-gray-200 mb-6">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            activeFilter === f ? "text-black" : "text-gray-500 hover:text-black"
          }`}
        >
          {f}

          {activeFilter === f && (
            <span className="absolute left-0 right-0 -bottom-[2px] h-[2px] bg-black rounded-full transition-all duration-300" />
          )}
        </button>
      ))}
    </div>
  );
}
