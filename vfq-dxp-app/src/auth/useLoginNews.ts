import { useEffect, useState } from 'react';
import { appPath } from '../lib/basePath';

// The sign-in screen's "Latest Updates": the newest items of the Vodafone Qatar news page
// (https://www.vodafone.qa/en/investor-relations/news), read from public/news/news.json. That file and its banner
// images are written by scripts/sync-news.mjs (npm run sync:news, also run before dev and build) - never edited by hand.
export interface NewsItem {
  id: number;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  /** The article's own page on vodafone.qa. */
  url: string;
  /** The banner, served from this app (/news/...). */
  image: string;
}

const isItem = (x: unknown): x is NewsItem => {
  const n = x as Partial<NewsItem> | null;
  return Boolean(n && n.title && n.date && n.url && n.image);
};

/** The synced news, newest first. `items` stays empty (so nothing is drawn) if the file is missing or unreadable. */
export function useLoginNews(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(appPath('/news/news.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items?: unknown[] }) => {
        if (!cancelled) setItems((d.items ?? []).filter(isItem));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return items;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** "2026-08-29" -> "29 Aug 2026". */
export const formatNewsDate = (iso: string) => DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`));
