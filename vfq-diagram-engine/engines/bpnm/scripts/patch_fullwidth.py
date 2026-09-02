#!/usr/bin/env python3
"""
Patch a bpnm engine (reference/engine_template.html) or any already-generated
bpnm diagram HTML so the SVG canvas always occupies 100% of the horizontal
space available inside .diagram-shell.

Root cause being fixed
----------------------
sizeHost() scaled the diagram to fit the shell's FIXED height only, then set
the <svg> element's width to whatever the content happened to measure at that
scale (`svg.style.width = LY.totalW*s + 2*PAD`). Whenever the model's aspect
ratio was taller-per-unit-width than the shell's, that width came out SMALLER
than the shell, so the canvas ended as a narrow column with dead white space
to its right (svg#svgHost 845.53px inside a much wider shell).

Fix
---
Width-first, aspect-preserving fit:
  sW = width-fill scale,  sH = height-fill scale,  s = max(sW, sH)
so the canvas can never be letterboxed horizontally.
  * wide/flat models  -> sH wins: unchanged behaviour (fills width, overflows,
    shell scrolls horizontally as before)
  * tall/narrow models -> sW wins: fills the width exactly and the shell GROWS
    vertically to keep the aspect ratio (page scrolls, no nested scrollbar, so
    the sticky lane gutter / phase header / legend keep working untouched)
  * pathological aspect ratios are capped at HEIGHT_GROWTH_CAP x the viewport
    budget, and any residual slack is centred rather than dumped on one side.
Shell height is now derived from the live viewport instead of a hard 74vh, and
the legend's real height is reserved so it never forces a scrollbar.
"""
import sys, io

COMMENT_OLD = """/* Height is fixed here (the "maximum available vertical space") and the shell scrolls
   horizontally instead of shrinking the diagram to fit its width — see sizeHost()/fit()
   below, which scale-to-height and let width follow the content. */"""

COMMENT_NEW = """/* The shell's height is a fallback only — sizeHost()/fit() below drive it from the live
   viewport. Sizing is WIDTH-FIRST: scale = max(width-fill, height-fill), so the canvas
   always consumes 100% of the horizontal space available inside this container and can
   never be letterboxed. A wide model still overflows and scrolls horizontally; a tall one
   grows the shell vertically instead of shrinking to fit a fixed height. */"""

CSS_OLD = """.diagram-shell{position:relative;border:1px solid var(--line);border-radius:6px;background:
 repeating-linear-gradient(0deg,#fbfbfb,#fbfbfb 1px,transparent 1px,transparent 28px),var(--panel);
 height:74vh;overflow-x:auto;overflow-y:hidden;box-shadow:var(--shadow)}
#svgHost{height:100%;cursor:grab;display:block}"""

CSS_NEW = """.diagram-shell{position:relative;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:6px;background:
 repeating-linear-gradient(0deg,#fbfbfb,#fbfbfb 1px,transparent 1px,transparent 28px),var(--panel);
 height:74vh;overflow-x:auto;overflow-y:hidden;box-shadow:var(--shadow)}
/* height above is only the pre-JS fallback — sizeHost() drives the real height from the live
   viewport so the shell can grow to keep a width-filled diagram's aspect ratio intact. */
#svgHost{width:100%;height:100%;cursor:grab;display:block}"""

JS_OLD = """const CANVAS_PAD=26;                                // comfortable buffer maintained on every edge
function sizeHost(){const shell=svg.parentElement;const h=shell?shell.clientHeight:0;if(!h)return null;
 const s=(h-2*CANVAS_PAD)/(LY._preLegendTotalH||LY.totalH);   // fit to the shell's available height (fixed
                                                    // by CSS), not width — and NOT counting the legend's
                                                    // export-only extension, since the legend is hidden live
 const w=LY.totalW*s+2*CANVAS_PAD;                 // width follows content at that scale — may exceed the shell's
                                                    // own width, which is fine: the shell scrolls horizontally
                                                    // (overflow-x:auto) instead of the diagram being compressed
 svg.style.width=w+'px';
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);      // 1:1 px space so the vp transform fully controls scaling
 return {w,h,s};}
function fit(){const dim=sizeHost();if(!dim){requestAnimationFrame(fit);return;}
 scale=dim.s;tx=CANVAS_PAD;ty=CANVAS_PAD;apply();}  // inset by the buffer on all sides"""

JS_NEW = """/* ---- responsive width-first sizing -------------------------------------------------
   The canvas must always consume 100% of the horizontal space inside .diagram-shell.
   The previous implementation fitted to the shell's fixed height ONLY and then let the
   <svg> element's width fall out of that scale, so any model whose aspect ratio was
   taller-per-unit-width than the shell rendered as a narrow column with dead white space
   beside it. Sizing is now driven by BOTH axes:

       sW = (availW - 2*PAD_X) / totalW      // scale that makes the content span the full width
       sH = (availH - 2*PAD_Y) / contentH    // scale that makes the content span the full height
       s  = max(sW, sH)                      // whichever fills its axis LAST — never letterboxed

   * A wide/flat model keeps its previous behaviour exactly (sH wins, the content overflows
     horizontally and the shell scrolls) — it already used the full width.
   * A tall/narrow model now takes sW: the diagram spans the entire width and the SHELL grows
     vertically to preserve the aspect ratio, rather than the diagram shrinking to fit a fixed
     height. Growing the shell (page scroll) instead of adding overflow-y keeps the sticky lane
     gutter, phase header and legend working unchanged — they pin against the shell's scrollport
     and would drift out of alignment if a second, vertical scroll axis were introduced here.
   * Growth is capped at HEIGHT_GROWTH_CAP x the viewport budget so a pathological aspect ratio
     can't produce an endless page; past the cap it reverts to a height fit and any leftover
     horizontal slack is CENTRED, so slack is never dumped entirely on one side.
   Aspect ratio is preserved in every branch: one uniform `scale`, no independent x/y stretch. */
const PAD_X=14, PAD_Y=22;                           // buffer kept on each edge (x trimmed: the
                                                    // horizontal axis is the scarce one here)
const CANVAS_PAD=PAD_X;                             // back-compat alias
const SHELL_MIN_H=340;                              // never collapse the canvas below usable height
const HEIGHT_GROWTH_CAP=1.75;                       // max shell height as a multiple of the viewport budget
function viewportBudget(shell){                     // usable height from the shell's top edge to the
                                                    // bottom of the viewport, measured live so the canvas
                                                    // is responsive to window size instead of a fixed vh
 const free=window.innerHeight-shell.getBoundingClientRect().top-24;   // 24px breathing room below
 return Math.max(SHELL_MIN_H,Math.round(free));}
function sizeHost(){
 const shell=svg.parentElement; if(!shell) return null;
 const availW=shell.clientWidth; if(!availW) return null;
 const contentW=LY.totalW;
 const contentH=LY._preLegendTotalH||LY.totalH;     // live view excludes the export-only legend extension
 const legendEl=document.getElementById('legendBar');
 const legendH=legendEl?legendEl.offsetHeight:0;    // reserved so the sticky legend never forces a scrollbar
 const budget=viewportBudget(shell);
 const sW=(availW-2*PAD_X)/contentW;
 const sH=(budget-legendH-2*PAD_Y)/contentH;
 let s=Math.max(sW,sH);                             // fill whichever axis is the binding constraint
 let shellH=Math.round(contentH*s+2*PAD_Y+legendH);
 const capH=Math.round(budget*HEIGHT_GROWTH_CAP);
 if(shellH>capH){s=(capH-legendH-2*PAD_Y)/contentH; shellH=capH;}   // pathological ratio guard
 shellH=Math.max(shellH,SHELL_MIN_H);
 shell.style.height=shellH+'px';
 const drawnW=contentW*s, drawnH=contentH*s;
 const w=Math.max(availW,Math.round(drawnW+2*PAD_X));    // >= the shell: 100% of the horizontal space
 const h=Math.max(shellH-legendH,Math.round(drawnH+2*PAD_Y));
 svg.style.width=w+'px'; svg.style.height=h+'px';
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);       // 1:1 px space so the vp transform fully controls scaling
 return {w,h,s,offX:Math.max(PAD_X,(w-drawnW)/2),offY:Math.max(PAD_Y,(h-drawnH)/2)};}
function fit(){const dim=sizeHost();if(!dim){requestAnimationFrame(fit);return;}
 scale=dim.s;tx=dim.offX;ty=dim.offY;apply();}      // centred within whatever slack remains"""

import re

# Tolerant fallbacks: match the two regions structurally, so a generated file whose
# whitespace/comments drifted from the reference template still patches cleanly.
CSS_RE = re.compile(r"\.diagram-shell\{position:relative;.*?#svgHost\{[^}]*\}", re.S)
JS_RE  = re.compile(r"const CANVAS_PAD=26;.*?scale=dim\.s;tx=CANVAS_PAD;ty=CANVAS_PAD;apply\(\);\}[^\n]*", re.S)

def _sub(src, exact_old, exact_new, rx, label):
    if exact_old in src:
        return src.replace(exact_old, exact_new, 1), 'exact'
    m = rx.search(src)
    if m:
        return src[:m.start()] + exact_new + src[m.end():], 'regex'
    raise KeyError(label)

def patch(path, backup=True):
    src = io.open(path, encoding='utf-8').read()
    if 'HEIGHT_GROWTH_CAP' in src:
        print('  already patched -> %s' % path); return True
    try:
        src, how_css = _sub(src, CSS_OLD, CSS_NEW, CSS_RE, 'css')
        src, how_js  = _sub(src, JS_OLD,  JS_NEW,  JS_RE,  'js')
        if COMMENT_OLD in src:                       # cosmetic: keep the CSS note truthful
            src = src.replace(COMMENT_OLD, COMMENT_NEW, 1)
    except KeyError as e:
        print('  FAILED (%s block not found) -> %s' % (e.args[0], path)); return False
    if backup:
        io.open(path + '.bak', 'w', encoding='utf-8').write(io.open(path, encoding='utf-8').read())
    io.open(path, 'w', encoding='utf-8').write(src)
    print('  patched (css:%s js:%s) -> %s' % (how_css, how_js, path)); return True

if __name__ == '__main__':
    ok = all([patch(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
