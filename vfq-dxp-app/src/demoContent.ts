// Master switch for demo-only content: the labelled simulators and previews that
// exist so the app can be demonstrated (simulated ID scans, outcome previews,
// "Fetched from Siebel" source notes, the SPECIMEN watermark on scanned IDs).
//
// Every such element carries the `demo-only` class, which index.css colours
// violet. Set this to false and a single class on <html> hides all of them.
// When adding demo-specific UI, give it className="demo-only" - nothing else.
export const SHOW_DEMO_CONTENT = true;

export function applyDemoContentSetting() {
  document.documentElement.classList.toggle('hide-demo', !SHOW_DEMO_CONTENT);
}
