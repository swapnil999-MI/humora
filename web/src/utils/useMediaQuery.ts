import { useEffect, useState } from 'react';

/** Tablets and small laptops: the section menu becomes a drawer (see RESPONSIVE LAYOUT in index.css). */
export const COMPACT_QUERY = '(max-width: 1100px)';
/** Phones: additionally, the rail becomes a bottom tab bar. */
export const MOBILE_QUERY = '(max-width: 768px)';

/** Tracks a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
