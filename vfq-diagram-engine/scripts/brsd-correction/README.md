# BRSD correction methodology

This is the reusable process for adding **New Req ID**, **Updated Requirement
Statement**, and **Updated Acceptance Criteria** columns to a BRSD workbook's
Requirements sheet — the step that `/extract-bpmn-swimlane` must run, in
place, on any BRSD workbook that doesn't already have these columns, before
it extracts data. It was developed and validated against 5 structurally
different BRSD workbooks (Mobile Postpaid — the reference — plus Agent 360,
Trouble Ticket, Fibre, and BillFormatter).

`brsd_correct_lib.py` in this folder is the reusable openpyxl helper. It is
**not** a one-shot script you run as-is — every BRSD has a different column
layout, section structure, and set of sequencing defects, so each workbook
needs its own small driver script written against this library (see "Driver
script pattern" below). Budget real analysis time for the business-logic
part; the library only handles the mechanical column-insert / reorder /
formatting-fidelity part.

## When to run this

Check the Requirements sheet's header row for `New Req ID`, `Updated
Requirement Statement`, and `Updated Acceptance Criteria` (or `Acceptance
Criteria` as a brand-new column, if the workbook never had one). If all
three are already present, **skip this whole process** — the workbook is
already corrected, re-running it would re-analyze already-good data and
risk re-highlighting or re-shuffling rows unnecessarily. Only run it for a
genuinely new/uncorrected BRSD.

## Step 1 — business-analyst review (do this by reading the workbook, not by guessing)

Read the `Requirements`, `Business_Rules`, and `Integrations` sheets only
(sheet names vary slightly by workbook — match by content). Identify:

- **Sequencing/dependency issues**: a step referencing or depending on
  another step that appears later in the sheet (e.g. a validation gate
  listed before the fields it validates; an action listed before the
  criteria/config/admin rule that governs it; a trigger listed after the
  thing it triggers).
- **Missing transitions or gaps**: a referenced state, capability, or
  system with no corresponding requirement row; a requirement whose
  Business Rule Ref/Integration Ref points at something not defined
  anywhere in scope.
- **Logical inconsistencies**: a requirement statement that contradicts its
  own Acceptance Criteria or the Business Rule it cites (e.g. differing
  claims about *when* something happens); a requirement ID reused for two
  different requirements; a requirement statement that's a garbled
  placeholder or a self-referential stub (e.g. "Reuse TT-001-ESC-02"
  instead of stating what the system does).
- **Duplicate content**: near-verbatim repeated blocks (can span dozens of
  rows) — flag with an override note, do not silently delete without
  saying so, since removing content outright is a business decision, not
  an extraction one.

For each defect, decide the corrected row order and, where the requirement
statement itself is broken/contradictory/placeholder, author a replacement.
Otherwise the "Updated Requirement Statement" column just carries the
original text forward unchanged (not highlighted, since nothing changed).

For **Acceptance Criteria**: if the sheet already has an AC column, only
populate "Updated Acceptance Criteria" where you're improving/fixing it —
leave the rest carried over, unhighlighted. If the sheet has **no** AC
column at all (e.g. BillFormatter), author Given/When/Then-style AC for
every requirement row from its Requirement Details/Business Rules text —
in that case every single populated cell counts as "newly populated" and
should be yellow-highlighted, matching the same convention used elsewhere.

## Step 2 — mechanical correction via `brsd_correct_lib.py`

Write a one-off driver script (see pattern below) that:

1. Defines `OLD` (every existing field → its 1-based column index) and
   `NEW` (every field, including the 3 new ones, → its final column index).
   Insert **New Req ID** immediately after the existing Req ID/Requirement
   ID column, **Updated Requirement Statement** immediately after the
   existing Requirement Statement/Requirement Details column, and
   **Updated/Acceptance Criteria** immediately after the existing
   Acceptance Criteria column (or, if none exists, immediately after the
   last relevant free-text column, e.g. Business Rules).
2. Defines `BLOCKS`: an ordered list of `('S', title, style_key, renamed)`
   section headers and `('R', row_number)` requirement rows, in the
   corrected final order. `renamed=True` only if you're renaming/renumbering
   an existing section (highlights it yellow).
3. Defines `MOVED`: the set of original row numbers that were structurally
   relocated (drives the yellow highlight on their New Req ID cell only).
4. Defines `OVERRIDE`: `{row_number: {'reqstmt': ..., 'ac': ...}}` for rows
   whose corrected text differs from source (drives yellow highlight on
   just that cell).
5. Calls `insert_columns_and_reorder(...)`, then populates New Req ID /
   Updated Requirement Statement / Updated Acceptance Criteria per row
   (sequential ID scheme like `{PREFIX}_SEQ_{seq:03d}`, matching the
   workbook's own existing ID-prefix convention), then calls
   `finish_formatting(...)` and `extend_header_banner(...)`, then saves.
   `insert_columns_and_reorder` gives each of the 3 new column headers a
   yellow-fill/black-text style automatically (`new_column_fields`, derived
   from field naming unless overridden). Pass `old_field_cols=OLD` through to
   `finish_formatting` so it likewise auto-pairs each new column's width to
   its original counterpart (Req ID↔New Req ID, Requirement Statement↔Updated
   Requirement Statement, Acceptance Criteria↔Updated Acceptance Criteria) —
   both are driven by the same `new_`/`updated_` field-naming convention, so
   no per-driver-script boilerplate is needed unless a workbook's field names
   don't follow it (pass `new_column_fields=`/`width_pairs=` explicitly then).

See the 4 existing driver scripts referenced in this project's git history
/ prior session transcripts for concrete examples across different column
layouts (a plain Req-ID-first layout, a section-title-in-column-B layout
with a separate SlNo column, etc.) — `insert_columns_and_reorder` accepts
`section_text_col` / `section_num_col` overrides for the latter case.

**Always back up the original file first** (`cp` to a scratch location)
before running a driver script — these are in-place edits to the user's
source-of-truth workbook.

## Step 3 — exhaustive verification (do not skip)

After running the driver script, verify:

- **Zero value diffs** on every sheet *other than* Requirements, vs. the
  backup.
- **New Req ID** column: every populated value unique, sequential, no gaps.
- **Yellow cell count** matches your design exactly (New Req ID cells only
  for rows in `MOVED`; Updated Requirement Statement cells only for rows in
  `OVERRIDE` with a `reqstmt` key; Updated Acceptance Criteria cells for
  every row if the AC column is brand new, or only for rows in `OVERRIDE`
  with an `ac` key if it already existed).
- **Column widths**: every `ColumnDimension` has `min == max` (no bleed
  onto a neighbouring column). Each new column's width matches its original
  counterpart's width exactly (New Req ID = Req ID, Updated Requirement
  Statement = Requirement Statement, Updated Acceptance Criteria =
  Acceptance Criteria) for side-by-side comparison.
- **New column headers**: New Req ID, Updated Requirement Statement, and
  Updated Acceptance Criteria header cells have solid yellow fill and black
  text, distinct from the surrounding header row's own style.
- **Data validation / conditional formatting**: after `finish_formatting`
  remaps DV/CF ranges through the old→new column map, confirm there are
  **no leftover stale entries** still pointing at pre-shift column
  letters — `finish_formatting` clears `ws.data_validations` before
  re-adding the remapped list for exactly this reason (conditional
  formatting was already handled this way; this was a real bug found and
  fixed during the BillFormatter correction — verify it hasn't
  regressed by listing `ws.data_validations.dataValidation` after the run
  and checking every sqref uses only current-layout column letters).
- **Merged cells** and **section header banners** (full row-width fill,
  not just the first cell) match the original's visual convention.

Only once all of the above check out is the workbook ready for
`/extract-bpmn-swimlane` to proceed to actual data extraction.
