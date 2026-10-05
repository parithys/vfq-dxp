import { useEffect, useRef } from 'react';

export function useStepFocus(currentIndex: number) {
  // Focus management: put the cursor in the first field the agent must fill to
  // get past this step - on arrival as well as on every step change, so a
  // walk-in journey starts typing rather than starts hunting.
  //
  // "Mandatory" is resolved from the rendered panel, not from the step
  // definition: `isValid` is an opaque predicate over the draft values, so it
  // can say whether the step passes but not which control is responsible. The
  // first EMPTY editable control in DOM order is that control in practice -
  // DOM order is the visual sequence the agent reads, which is what "the first
  // required field in the sequence" means. Fields already carrying a value
  // (a resumed draft, an MOI-prefilled name) are skipped, so returning to a
  // half-finished step lands on the first thing still outstanding.
  //
  // Radios are INCLUDED: on a step like Plan & Add-ons the mandatory decision
  // IS the radio group, and focusing a radio neither selects it nor blocks
  // anything - arrow keys then walk the options, which is the behaviour you
  // want. Excluded deliberately: [readonly] (the MOI-fetched email, "not
  // editable"), [disabled], hidden inputs, and type=checkbox, which in these
  // journeys is always an optional flag ("B2B2C order") and never the thing
  // gating Continue. Button-group choices (ID Type) are excluded too - they
  // arrive pre-selected, so they are not what is outstanding.
  //
  // Falls back to the step heading when a step has no editable field at all -
  // review, confirmation and summary steps - which preserves the previous
  // behaviour where it still matters: a screen-reader user hears the new step
  // title rather than silence.
  //
  // A single attempt one frame after the step change is NOT enough, which cost
  // two steps before this was observed: Address and Plan & Add-ons build their
  // fields from data they fetch, so at that frame the panel held no focusable
  // control at all. Address ended with focus on <body> - nothing focused, the
  // cursor simply lost - and Plan & Add-ons fell through to the heading while
  // its plan radios were still in flight. So the first attempt runs on the
  // next frame and a MutationObserver keeps watching the panel, claiming the
  // first field the moment it mounts.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = stepPanelRef.current;
    if (!panel) return;
    let observer: MutationObserver | undefined;
    // The element THIS effect focused, as opposed to one the agent chose.
    // Without the distinction the "don't steal focus" check below tore the
    // observer down on its own success: it focused Zone, the next mutation saw
    // a real control focused, concluded the agent had taken over and stopped
    // watching - so when Zone was disabled a moment later nothing was left to
    // recover the lost cursor.
    let ours: HTMLElement | null = null;

    const tryFocus = () => {
      const active = document.activeElement;
      const candidates = [
        ...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([readonly]):not([disabled]):not([data-no-autofocus]),'
          + ' select:not([disabled]):not([data-no-autofocus]), textarea:not([readonly]):not([disabled]):not([data-no-autofocus])'
        ),
        // offsetParent is null for anything display:none - a step that renders
        // a collapsed branch must not pull focus into the hidden half.
      ].filter((el) => el.offsetParent !== null);
      // "Still outstanding" is per control type: a text/select control is
      // outstanding while its value is empty, but a radio always carries a
      // non-empty `value` attribute, so for one the question is whether its
      // GROUP has a selection yet. Without this split a radio could never
      // look outstanding and an unanswered plan choice would rank below an
      // already-filled text field.
      const outstanding = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
        if (el instanceof HTMLInputElement && el.type === 'radio') {
          return el.name
            ? !panel.querySelector(`input[type="radio"][name="${el.name}"]:checked`)
            : !el.checked;
        }
        return !el.value;
      };
      // Leave the agent alone once they are in a control of their own
      // choosing, and stop watching for the rest of the step.
      const agentOwnsFocus =
        active
        && active !== document.body
        && active !== stepHeadingRef.current
        && active !== ours;
      if (agentOwnsFocus) {
        observer?.disconnect();
        return;
      }
      // Already sitting in a field that is still editable - typing, most
      // likely. Don't reshuffle, but keep watching in case it gets disabled.
      if (active === ours && candidates.some((c) => c === ours)) return;

      const target = candidates.find(outstanding) ?? candidates[0];
      // No focusable field (all disabled, or a review step): the heading, so
      // the step is still announced and focus is never left on <body>.
      const next = target ?? stepHeadingRef.current;
      if (next && next !== active) {
        next.focus();
        ours = next;
      }
    };

    // setTimeout, not requestAnimationFrame: this only needs to run after the
    // step's own initial render has settled, which a macrotask gives it, and
    // rAF does not fire at all while the document is hidden - so a journey
    // opened in a background tab would never have had its first field focused.
    // Focus needs no paint, so there is nothing rAF buys here.
    const firstAttempt = setTimeout(tryFocus, 0);
    observer = new MutationObserver(tryFocus);
    // `attributes` matters as much as `childList`, and is what a first pass
    // missed. On the Address step all four inputs mount empty and enabled, so
    // Zone takes focus; the MOI address lookup then resolves and marks the
    // address fetched-from-MOI, which DISABLES all four. A browser blurs a
    // focused element the moment it becomes disabled, so focus landed on
    // <body> and the cursor was simply lost. Watching the disabled attribute
    // re-runs the choice, which correctly finds no field left to fill and
    // falls back to the heading.
    observer.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
    // Bounded: stop watching rather than sit armed for the life of the step,
    // which would let a much later re-render (a lookup result, a validation
    // message) move the cursor long after the agent has oriented themselves.
    const stopWatching = setTimeout(() => observer?.disconnect(), 4000);

    return () => {
      clearTimeout(firstAttempt);
      clearTimeout(stopWatching);
      observer?.disconnect();
    };
  }, [currentIndex]);
  return { stepHeadingRef, stepPanelRef };
}
