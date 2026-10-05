import type { RefObject } from 'react';
import type { PostpaidPlan } from './postpaidPlanModel';
import { SearchField } from '../../components/primitives/SearchField';

interface PlanSearchBoxProps {
  searchRef: RefObject<HTMLDivElement | null>;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  planSearch: string;
  setPlanSearch: (value: string) => void;
  suggestions: PostpaidPlan[];
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
}

export function PlanSearchBox({
  searchRef,
  searchOpen,
  setSearchOpen,
  planSearch,
  setPlanSearch,
  suggestions,
  selectedProductId,
  onSelectProduct,
}: PlanSearchBoxProps) {
  return (
    <div ref={searchRef} className="relative">
      <SearchField
        aria-label="Search plans by name or price"
        role="combobox"
        aria-expanded={searchOpen}
        aria-controls="plan-search-listbox"
        autoComplete="off"
        placeholder="Search plans by name or price"
        value={planSearch}
        onChange={(e) => {
          setPlanSearch(e.target.value);
          setSearchOpen(true);
        }}
        onFocus={() => setSearchOpen(true)}
      />
      {searchOpen && planSearch.trim() && (
        <ul
          id="plan-search-listbox"
          role="listbox"
          aria-label="Plan suggestions"
          className="absolute z-50 top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-[var(--field-radius)] border border-border-soft bg-bg shadow-raised py-1 divide-y divide-[var(--field-divider)]"
        >
          {suggestions.map((p) => (
            <li
              key={p.productId}
              role="option"
              aria-selected={selectedProductId === p.productId}
              onClick={() => {
                onSelectProduct(p.productId);
                setPlanSearch(p.name);
                setSearchOpen(false);
              }}
              className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface"
            >
              <span className="text-fg text-[length:var(--fs-body)] truncate">{p.name}</span>
              <span className="text-muted text-[length:var(--fs-caption)] shrink-0">QAR {p.mrcQAR}/mo</span>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="px-4 py-2.5 text-muted text-[length:var(--fs-caption)]">No matching plans.</li>
          )}
        </ul>
      )}
    </div>
  );
}
