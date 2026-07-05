import { useState, useRef, useEffect, FormEvent } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearchSubmit: () => void;
  isFocusedExternally: boolean;
  onBlurExternally: () => void;
}

export function SearchBar({ onSearchSubmit, isFocusedExternally, onBlurExternally }: SearchBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocusedExternally && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocusedExternally]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearchSubmit();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,12px)+72px)] left-[18px] right-[18px] z-30">
      <form onSubmit={handleSubmit} className="relative w-full h-[48px]">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search size={18} className="text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onBlurExternally}
          placeholder="Waar wil je heen?"
          className="w-full h-full glass-panel rounded-[17px] pl-11 pr-4 text-[15px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-lg transition-all"
          data-testid="input-search"
        />
      </form>
    </div>
  );
}
