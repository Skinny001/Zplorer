'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onSearch(q);
    setQuery('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search block height or hash..."
        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        autoFocus
      />
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
      >
        Go
      </button>
    </form>
  );
}