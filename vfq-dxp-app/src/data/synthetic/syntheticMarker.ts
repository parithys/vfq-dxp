// The one place that says "this is synthetic". Anything the app shows that is NOT customer data -
// demo values derived to fill a field the records have no data for, labelled simulators, sample ID
// cards, "Fetched from Siebel" notes - is marked with this, so it is drawn violet (index.css
// `.demo-only`) and switched off everywhere by one flag.
//
//   SHOW_DEMO_CONTENT   master switch (false: marked content is hidden, demo values read "-")
//   Synthetic<T>        a value that carries `isSynthetic: true`
//   SyntheticValue      (SyntheticValue.tsx) renders a Synthetic value with the violet marker
//   SYNTHETIC_CLASS     the class to put on any other synthetic element (simulators, previews)
// When adding demo-specific UI, use SYNTHETIC_CLASS (or SyntheticValue) - nothing else.

export const SHOW_DEMO_CONTENT = true;

export function applyDemoContentSetting() {
  document.documentElement.classList.toggle('hide-demo', !SHOW_DEMO_CONTENT);
}

/** The CSS class that colours an element violet and lets `hide-demo` hide it (see index.css). */
export const SYNTHETIC_CLASS = 'demo-only';

/** A value that is not customer data. `isSynthetic` is what drives the violet demo colour. */
export interface Synthetic<T> {
  value: T;
  isSynthetic: true;
}

export const synthetic = <T,>(value: T): Synthetic<T> => ({ value, isSynthetic: true });
