import { useState, useRef, useEffect, useId, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTooltipGroup } from './TooltipContext';

type Placement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  /** The tooltip copy — a label (1-5 words), not documentation. */
  content: ReactNode;
  /** A single interactive element: icon button, control, chip, etc. */
  children: ReactElement;
  /** Default "right" — matches sidebar/toolbar icon-row convention. */
  placement?: Placement;
  /** Skip wrapping when the control already has a visible, permanent label. */
  disabled?: boolean;
}

const VIEWPORT_MARGIN = 8;

// Portal-rendered hover/focus tooltip — see .claude/skills/hover-tooltip.
// Never nested inline (would get clipped by ancestor overflow:hidden), never
// a native title="" (inconsistent OS-level delay, no touch support).
export function Tooltip({ content, children, placement = 'right', disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [resolvedPlacement, setResolvedPlacement] = useState<Placement>(placement);
  const [wraps, setWraps] = useState(false);

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const group = useTooltipGroup();

  const computePosition = (place: Placement) => {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const tw = tooltipRect?.width ?? 0;
    const th = tooltipRect?.height ?? 0;
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tooltip-offset') || '8', 10);

    const positions: Record<Placement, { top: number; left: number }> = {
      right: { top: triggerRect.top + triggerRect.height / 2 - th / 2, left: triggerRect.right + offset },
      left: { top: triggerRect.top + triggerRect.height / 2 - th / 2, left: triggerRect.left - tw - offset },
      top: { top: triggerRect.top - th - offset, left: triggerRect.left + triggerRect.width / 2 - tw / 2 },
      bottom: { top: triggerRect.bottom + offset, left: triggerRect.left + triggerRect.width / 2 - tw / 2 },
    };

    return { pos: positions[place], tw, th };
  };

  // Collision-aware placement: flip if the preferred side would clip the
  // viewport. Runs after first paint once the tooltip has real dimensions.
  useEffect(() => {
    if (!visible) return;

    const result = computePosition(placement);
    if (!result) return;
    let { pos, tw, th } = result;
    let finalPlacement = placement;

    const overflowsRight = pos.left + tw > window.innerWidth - VIEWPORT_MARGIN;
    const overflowsLeft = pos.left < VIEWPORT_MARGIN;
    const overflowsBottom = pos.top + th > window.innerHeight - VIEWPORT_MARGIN;
    const overflowsTop = pos.top < VIEWPORT_MARGIN;

    if (placement === 'right' && overflowsRight) finalPlacement = 'left';
    if (placement === 'left' && overflowsLeft) finalPlacement = 'right';
    if (placement === 'top' && overflowsTop) finalPlacement = 'bottom';
    if (placement === 'bottom' && overflowsBottom) finalPlacement = 'top';

    if (finalPlacement !== placement) {
      const flipped = computePosition(finalPlacement);
      if (flipped) pos = flipped.pos;
    }

    pos.left = Math.min(Math.max(pos.left, VIEWPORT_MARGIN), window.innerWidth - tw - VIEWPORT_MARGIN);
    pos.top = Math.min(Math.max(pos.top, VIEWPORT_MARGIN), window.innerHeight - th - VIEWPORT_MARGIN);

    setResolvedPlacement(finalPlacement);
    setCoords(pos);

    const maxWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tooltip-max-width') || '240', 10);
    setWraps(tw >= maxWidth - 1);
  }, [visible, placement]);

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const handleShow = () => {
    if (disabled || !content) return;
    clearTimers();

    const isGroupActive = group?.isGroupActive();
    const delayVar = isGroupActive ? '--tooltip-show-delay-grouped' : '--tooltip-show-delay';
    const delay = parseInt(getComputedStyle(document.documentElement).getPropertyValue(delayVar) || '0', 10);

    showTimer.current = setTimeout(() => {
      setVisible(true);
      group?.activateGroup();
    }, delay);
  };

  const handleHide = () => {
    clearTimers();
    const delay = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tooltip-hide-delay') || '0', 10);
    hideTimer.current = setTimeout(() => setVisible(false), delay);
  };

  // Escape dismisses without moving the pointer or losing focus (WCAG 1.4.13).
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const reposition = () => {
      const result = computePosition(resolvedPlacement);
      if (result) setCoords(result.pos);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, resolvedPlacement]);

  useEffect(() => clearTimers, []);

  if (!isValidElement(children)) return children;
  if (disabled) return children;

  const childProps = children.props as Record<string, unknown>;
  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      const childRef = (children as unknown as { ref?: unknown }).ref;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') (childRef as { current: HTMLElement | null }).current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      (childProps.onMouseEnter as ((e: React.MouseEvent) => void) | undefined)?.(e);
      handleShow();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      (childProps.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e);
      handleHide();
    },
    onFocus: (e: React.FocusEvent) => {
      (childProps.onFocus as ((e: React.FocusEvent) => void) | undefined)?.(e);
      handleShow();
    },
    onBlur: (e: React.FocusEvent) => {
      (childProps.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(e);
      handleHide();
    },
    'aria-describedby': visible ? id : undefined,
  });

  return (
    <>
      {trigger}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            data-placement={resolvedPlacement}
            data-state={coords ? 'visible' : 'positioning'}
            className={`tooltip-surface${wraps ? ' tooltip-surface--wrap' : ''}`}
            style={coords ? { top: coords.top, left: coords.left } : { top: -9999, left: -9999 }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
