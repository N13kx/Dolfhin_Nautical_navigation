import { MapPin } from 'lucide-react';
import type { SearchResult } from '../services/search/types';

interface SearchResultsProps {
  results: SearchResult[];
  isSearching: boolean;
  hasQuery: boolean;
  onSelect: (result: SearchResult) => void;
}

export function SearchResults({ results, isSearching, hasQuery, onSelect }: SearchResultsProps) {
  return (
    <div className="mt-2 glass-panel rounded-[17px] overflow-hidden shadow-xl border border-white/10">
      {isSearching && results.length === 0 && (
        <div className="px-4 py-3 text-muted-foreground text-[14px] flex items-center gap-3">
          <div className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
          Zoeken...
        </div>
      )}

      {!isSearching && hasQuery && results.length === 0 && (
        <div className="px-4 py-3 text-muted-foreground text-[14px]">
          Geen resultaten gevonden.
        </div>
      )}

      {results.map((result, index) => (
        <button
          key={result.id}
          // onPointerDown + preventDefault keeps input focus on mobile so blur
          // doesn't fire before the selection is processed
          onPointerDown={(e) => { e.preventDefault(); onSelect(result); }}
          className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors text-left ${
            index < results.length - 1 ? 'border-b border-white/5' : ''
          }`}
        >
          <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-foreground font-medium text-[14px] leading-tight truncate">
              {result.name}
            </div>
            <div className="text-muted-foreground text-[12px] leading-tight mt-0.5 truncate">
              {result.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
