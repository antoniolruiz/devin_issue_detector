import { Search, SlidersHorizontal } from "lucide-react";
import type { FilterState, SortField, SortDirection } from "../types";

interface IssueFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  categories: string[];
}

export function IssueFilters({
  filters,
  onFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  categories,
}: IssueFiltersProps) {
  const update = (partial: Partial<FilterState>) => {
    onFilterChange({ ...filters, ...partial });
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search issues..."
          className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Filters</span>
        </div>

        {/* Category filter */}
        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Complexity filter */}
        <select
          value={filters.complexity}
          onChange={(e) => update({ complexity: e.target.value })}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Complexity</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
        </select>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>

        {/* Confidence range */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Confidence</span>
          <input
            type="number"
            min={0}
            max={100}
            value={filters.confidenceMin}
            onChange={(e) => update({ confidenceMin: Number(e.target.value) })}
            className="w-14 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          />
          <span>-</span>
          <input
            type="number"
            min={0}
            max={100}
            value={filters.confidenceMax}
            onChange={(e) => update({ confidenceMax: Number(e.target.value) })}
            className="w-14 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-400">Sort by</span>
          {(["confidence", "complexity", "impact", "number"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortField === field
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
              }`}
            >
              {field === "confidence" ? "Confidence" : field === "complexity" ? "Complexity" : field === "impact" ? "Impact" : "#"}
              {sortField === field && (sortDirection === "asc" ? " ↑" : " ↓")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
