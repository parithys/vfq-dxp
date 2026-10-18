import { Pager as SharedPager } from '../../../components/primitives/Pager';

/** Telesales lists page from 0; the shared Pager counts from 1. */
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <div className="px-5 py-4">
      <SharedPager page={page + 1} pages={pages} onPage={(p) => onChange(p - 1)} />
    </div>
  );
}
