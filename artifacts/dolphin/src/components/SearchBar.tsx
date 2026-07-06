import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchResult } from '../services/search/types';
import { nominatimProvider } from '../services/search/nominatim';
import { SearchResults } from './SearchResults';

interface SearchBarProps {
  isFocusedExternally: boolean;
  onBlurExternally: () => void;
  onResultSelect: (result: SearchResult) => void;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

export function SearchBar({ isFocusedExternally, onBlurExternally, onResultSelect }: SearchBarProps) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFocusedExternally && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocusedExternally]);

  const cancelPending = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const clearSearch = useCallback(() => {
    cancelPending();
    setValue('');
    setResults([]);
    setIsSearching(false);
  }, [cancelPending]);

  const handleChange = useCallback((query: string) => {
    setValue(query);
    cancelPending();

    if (query.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const found = await nominatimProvider.search(query, ctrl.signal);
        setResults(found);
      } catch {
        // AbortError or network failure — leave existing results
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }, [cancelPending]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    clearSearch();
    inputRef.current?.blur();
    onResultSelect(result);
  }, [clearSearch, onResultSelect]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleResultSelect(results[0]);
    }
  };

  const showResults = isFocused && (results.length > 0 || (isSearching && value.length >= MIN_QUERY_LENGTH));

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,12px)+72px)] left-[18px] right-[18px] z-30">
      <form onSubmit={handleSubmit} className="relative w-full h-[48px]">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search
            size={18}
            className={`transition-colors duration-200 ${isSearching ? 'text-primary' : 'text-muted-foreground'}`}
          />
        </div>

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlurExternally();
          }}
          placeholder="Waar wil je heen?"
          className="w-full h-full glass-panel rounded-[17px] pl-11 pr-10 text-[15px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-lg transition-all"
          data-testid="input-search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />

        {value.length > 0 && (
          <button
            type="button"
            // onPointerDown prevents the blur before the action fires on mobile
            onPointerDown={(e) => { e.preventDefault(); clearSearch(); }}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Wis zoekopdracht"
          >
            <X size={16} />
          </button>
        )}
      </form>

      {showResults && (
        <SearchResults
          results={results}
          isSearching={isSearching}
          hasQuery={value.length >= MIN_QUERY_LENGTH}
          onSelect={handleResultSelect}
        />
      )}
    </div>
  );
}
