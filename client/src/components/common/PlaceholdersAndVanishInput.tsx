import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface PlaceholdersAndVanishInputProps {
  placeholders: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  value: string;
  className?: string;
}

export const PlaceholdersAndVanishInput: React.FC<PlaceholdersAndVanishInputProps> = ({
  placeholders,
  onChange,
  onSubmit,
  value,
  className = '',
}) => {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  return (
    <form
      onSubmit={onSubmit}
      className={`relative w-full max-w-md h-11 rounded-2xl liquid-glass border border-white/10 flex items-center px-3.5 focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/20 transition-all ${className}`}
    >
      <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2.5" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholders[currentPlaceholder]}
        className="w-full bg-transparent border-0 text-xs text-white placeholder:text-zinc-500 focus:outline-none font-sans"
      />
    </form>
  );
};
