"""
Reusable helpers for applying the "New Req ID / Updated Requirement Statement /
Updated Acceptance Criteria" correction methodology (established on
VFQ_Mobile_Postpaid_Activation_BRSD_v1.1.xlsx) to other BRSD workbooks,
while preserving 100% of unrelated formatting.

Hard-won rules encoded here:
  - column inserts computed via a monotonic old->new column-index map, which
    automatically gives correct merged-cell extension for free (new_min =
    map[old_min], new_max = map[old_max])
  - data validation / conditional formatting sqref ranges are re-derived
    through the same column map, never left pointing at stale letters
  - row outline/group levels are recomputed from the NEW layout by
    classifying each row's *content* (section header vs body row), never
    left keyed to stale absolute row numbers
  - section/heading fill is re-applied across the FULL row width, not just
    the first column
  - yellow highlight only on cells that actually differ from the source
"""
import copy
import re
import openpyxl
from openpyxl.styles import PatternFill, Font
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.worksheet.cell_range import MultiCellRange
from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.worksheet.datavalidation import DataValidation, DataValidationList

YELLOW = PatternFill(fill_type="solid", start_color="FFFFFF00", end_color="FFFFFF00")
# Header treatment for the 3 columns this correction methodology introduces (New Req ID,
# Updated Requirement Statement, Updated Acceptance Criteria) — an explicit "immediately
# distinguishable from the original columns" requirement, solid yellow fill + black text,
# same yellow PatternFill already used for changed DATA cells so there's only one "this is new/
# changed" colour vocabulary in the whole workbook rather than two unrelated yellows.
NEW_COLUMN_HEADER_FILL = YELLOW


def snap(cell):
    return (cell.value, copy.copy(cell.font), copy.copy(cell.fill),
            copy.copy(cell.border), copy.copy(cell.alignment), cell.number_format)


def paste(cell, snap_tuple, yellow=False):
    value, font, fill, border, alignment, numfmt = snap_tuple
    cell.value = value
    cell.font = font
    cell.border = border
    cell.alignment = alignment
    cell.number_format = numfmt
    cell.fill = YELLOW if yellow else fill
    return cell


_CELL_RE = re.compile(r'^([A-Za-z]+)(\d+)$')
_RANGE_RE = re.compile(r'^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$')


def remap_sqref(sqref_str, old_to_new):
    """Remap every column letter in a (possibly multi-range) sqref string
    through old_to_new (dict: old col index -> new col index). Columns not
    present in old_to_new (e.g. sentinel 1048576-row full-column refs) are
    left untouched."""
    pieces = str(sqref_str).split()
    out = []
    for p in pieces:
        m = _RANGE_RE.match(p)
        if m:
            c1, r1, c2, r2 = m.groups()
            i1, i2 = column_index_from_string(c1), column_index_from_string(c2)
            n1 = old_to_new.get(i1, i1)
            n2 = old_to_new.get(i2, i2)
            out.append(f"{get_column_letter(n1)}{r1}:{get_column_letter(n2)}{r2}")
            continue
        m = _CELL_RE.match(p)
        if m:
            c1, r1 = m.groups()
            i1 = column_index_from_string(c1)
            n1 = old_to_new.get(i1, i1)
            out.append(f"{get_column_letter(n1)}{r1}")
            continue
        out.append(p)  # unrecognised token, leave as-is
    return " ".join(out)


def insert_columns_and_reorder(
    path, sheet_name, header_row, old_field_cols, new_field_positions,
    new_headers, last_data_col, blocks, overrides, moved, section_style_rows,
    row_classifier, extra_header_rows=(), section_text_col=1, section_num_col=None,
    new_column_fields=None,
):
    """
    path: workbook path (edited in place)
    sheet_name: e.g. '05_Requirements'
    header_row: 1-based row number holding column headers
    old_field_cols: dict field-name -> old 1-based column index (for every
      field that exists in the ORIGINAL sheet, including the 3 that will
      gain an "Updated"/"New" sibling)
    new_field_positions: dict field-name -> new 1-based column index, for
      *every* field in the final layout (old fields shifted + the 3 new ones)
    new_headers: dict field-name -> header text for the final layout
    last_data_col: highest new column index in play (for width/fill purposes)
    blocks: ordered list of ('S', text, style_key, renamed_bool) | ('B',) |
      ('R', row_key) describing the corrected document in final order.
      row_key must be a value present in row_classifier's row map (e.g. the
      original sheet row number, since Req ID is not always unique).
    overrides: dict row_key -> {'reqstmt': str, 'ac': str} (only for rows
      whose corrected text differs from the source)
    moved: set of row_key considered structurally relocated (drives the
      yellow highlight on the New Req ID cell)
    section_style_rows: dict style_key -> source row number to snapshot a
      section-header fill/font/border/alignment style from (e.g.
      {'normal': 5, 'milestone': 78})
    row_classifier: callable(ws, row_number) -> outline level (0/1/2/...)
      for the FINAL layout, used to rebuild row grouping from content
    extra_header_rows: 1-based row numbers above header_row to preserve
      verbatim (title rows etc.) -- their existing fill/merges are kept,
      only extended across the same column range if they already had a
      matching solid fill (rare; usually a no-op for these BRSDs)
    new_column_fields: iterable of field names (a subset of new_field_positions'
      keys) that are genuinely NEW columns this correction introduces -- e.g.
      {'new_reqid', 'updated_reqstmt', 'updated_ac'} -- rather than an existing
      field that merely shifted position. Their header cells get the explicit
      "immediately distinguishable" yellow-fill/black-text treatment instead of
      inheriting the surrounding header row's own style. Defaults to every key
      in new_field_positions that ISN'T also a key in old_field_cols -- correct
      whenever a driver script's field-naming already reflects that distinction
      (an "updated_"/"new_" field with no old-sheet counterpart) -- but can be
      passed explicitly for a workbook whose naming doesn't happen to divide
      that cleanly.

    Returns: (wb, ws, new_id_prefix_seq_map) for further custom post-steps.
    """
    if new_column_fields is None:
        new_column_fields = set(new_field_positions) - set(old_field_cols)
    else:
        new_column_fields = set(new_column_fields)
    wb = openpyxl.load_workbook(path, data_only=False)
    ws = wb[sheet_name]
    orig_max_row = ws.max_row

    # ---- 1. capture everything BEFORE any mutation --------------------
    row_snaps = {}          # row_key (source row number) -> {old_col: snap}
    row_heights = {}        # row_key -> original row height (moves with its content)
    for b in blocks:
        if b[0] == 'R':
            r = b[1]
            row_snaps[r] = {c: snap(ws.cell(row=r, column=c)) for c in old_field_cols.values()}
            row_heights[r] = ws.row_dimensions[r].height if r in ws.row_dimensions else None

    header_snaps = {f: snap(ws.cell(row=header_row, column=c)) for f, c in old_field_cols.items()}
    grey_header_style = header_snaps.get('reqid') or next(iter(header_snaps.values()))

    section_styles = {k: snap(ws.cell(row=r, column=section_text_col)) for k, r in section_style_rows.items()}
    section_heights = {k: (ws.row_dimensions[r].height if r in ws.row_dimensions else None)
                        for k, r in section_style_rows.items()}
    section_num_styles = None
    if section_num_col is not None:
        section_num_styles = {k: snap(ws.cell(row=r, column=section_num_col)) for k, r in section_style_rows.items()}

    title_snaps = {r: {c: snap(ws.cell(row=r, column=c)) for c in range(1, last_data_col - 2)}
                   for r in extra_header_rows}

    old_widths = {get_column_letter(c): d.width for c, d in
                  ((column_index_from_string(k), v) for k, v in ws.column_dimensions.items() if v.width)}

    old_to_new = {}
    for f, oldc in old_field_cols.items():
        old_to_new[oldc] = new_field_positions[f]

    merges_before = [(mc.min_col, mc.min_row, mc.max_col, mc.max_row) for mc in ws.merged_cells.ranges]

    dv_before = [(str(dv.sqref), dv) for dv in ws.data_validations.dataValidation]
    cf_before = [(str(cf.sqref), list(ws.conditional_formatting[cf])) for cf in ws.conditional_formatting]

    # ---- 2. wipe the working area (unmerge first -- MergedCell values are
    #    read-only until the range is unmerged) --------------------------
    for mc in list(ws.merged_cells.ranges):
        ws.unmerge_cells(str(mc))
    # drop every column-width record now (some may span a multi-column range
    # in the source file); finish_formatting() rebuilds them one column at a
    # time with min==max pinned, so nothing can bleed into a neighbour
    for letter in list(ws.column_dimensions.keys()):
        del ws.column_dimensions[letter]
    for r in range(1, orig_max_row + 5):
        for c in range(1, last_data_col + 3):
            cell = ws.cell(row=r, column=c)
            cell.value = None
            cell.fill = PatternFill(fill_type=None)

    # ---- 3. re-write title rows (verbatim, columns untouched in count) --
    for r, colsnap in title_snaps.items():
        for c, sn in colsnap.items():
            paste(ws.cell(row=r, column=c), sn)

    # ---- 4. header row ---------------------------------------------------
    for f, newc in new_field_positions.items():
        base = header_snaps.get(f, grey_header_style)
        text = new_headers.get(f)
        if text is None:
            text = base[0]  # reuse the original header text verbatim
        cell = paste(ws.cell(row=header_row, column=newc), (text,) + base[1:])
        if f in new_column_fields:
            # Explicit "immediately distinguishable from the original columns" requirement:
            # solid yellow fill, black text -- keep every OTHER font property (bold/size/name)
            # from the surrounding header row's own style, only the colour changes, so the new
            # header still reads as part of the same header row rather than a mismatched font.
            base_font = base[1]
            cell.font = Font(name=base_font.name, size=base_font.size, bold=base_font.bold,
                              italic=base_font.italic, underline=base_font.underline,
                              color="FF000000")
            cell.fill = NEW_COLUMN_HEADER_FILL

    # ---- 5. body ------------------------------------------------------
    row = header_row + 1
    seq = 0
    id_field = [f for f in old_field_cols if f == 'reqid'][0]
    seq_prefix_holder = {}
    header_rows_written = []
    section_num = 0

    for b in blocks:
        kind = b[0]
        if kind == 'S':
            _, text, style_key, renamed = b
            base = section_styles[style_key]
            paste(ws.cell(row=row, column=section_text_col), (text,) + base[1:], yellow=renamed)
            section_num += 1
            if section_num_styles is not None:
                numbase = section_num_styles[style_key]
                paste(ws.cell(row=row, column=section_num_col), (section_num,) + numbase[1:])
            if section_heights.get(style_key) is not None:
                ws.row_dimensions[row].height = section_heights[style_key]
            header_rows_written.append(row)
            row += 1
        elif kind == 'B':
            row += 1
        elif kind == 'R':
            rk = b[1]
            data = row_snaps[rk]
            seq += 1
            ov = overrides.get(rk, {})
            for f, oldc in old_field_cols.items():
                paste(ws.cell(row=row, column=new_field_positions[f]), data[oldc])
            if row_heights.get(rk) is not None:
                ws.row_dimensions[row].height = row_heights[rk]
            yield_info = {'row': row, 'seq': seq, 'row_key': rk, 'moved': rk in moved, 'override': ov}
            seq_prefix_holder[rk] = yield_info
            row += 1

    last_row = row - 1
    return (wb, ws, seq_prefix_holder, last_row, old_widths, old_to_new, merges_before,
            dv_before, cf_before, header_rows_written)


def finish_formatting(ws, last_row, last_data_col, old_widths, new_field_positions,
                       old_to_new, merges_before, dv_before, cf_before,
                       width_overrides, row_classifier, freeze_panes=None,
                       zoom=None, tab_color=None, default_row_height=None,
                       old_field_cols=None, width_pairs=None):
    """Second pass: widths, merges, DV/CF retarget, outline levels, view props.

    old_field_cols: dict field-name -> old 1-based column index, same dict
      passed to insert_columns_and_reorder(). Required (non-None) to get the
      New/Updated column width-pairing behaviour below; omit only for callers
      that don't need it.
    width_pairs: dict new-field-name -> old-field-name, whose ORIGINAL width
      (from old_widths) is copied onto the new field's column so the two sit
      side-by-side at identical widths (e.g. 'new_reqid' -> 'reqid',
      'updated_reqstmt' -> 'reqstmt', 'updated_ac' -> 'ac'). Defaults to
      auto-deriving every pair from the "new_"/"updated_" field-naming
      convention (a new field whose name minus that prefix matches an
      old-sheet field) -- pass explicitly only for a workbook whose naming
      doesn't divide that cleanly. A field also present in width_overrides
      keeps the override instead (override always wins)."""
    def set_width(col_idx, width):
        letter = get_column_letter(col_idx)
        dim = ws.column_dimensions[letter]
        dim.width = width
        # pin min==max==this column only -- ColumnDimension can otherwise
        # carry a stale multi-column span (from openpyxl auto-vivifying a
        # range) that silently applies this same width to a neighbour too
        dim.min = dim.max = col_idx

    # carry EVERY existing column's width to its new position first (widths
    # keyed by old letter don't move on their own just because content was
    # written into a different new column)
    for old_letter, width in old_widths.items():
        if width is None:
            continue
        old_idx = column_index_from_string(old_letter)
        new_idx = old_to_new.get(old_idx)
        if new_idx:
            set_width(new_idx, width)
    # pair each New/Updated column's width to its original counterpart (Req
    # ID <-> New Req ID, Requirement Statement <-> Updated Requirement
    # Statement, Acceptance Criteria <-> Updated Acceptance Criteria) so the
    # two line up for side-by-side comparison -- applied BEFORE overrides so
    # an explicit width_overrides entry still wins for either side of a pair.
    if old_field_cols is not None:
        if width_pairs is None:
            width_pairs = {}
            for f in new_field_positions:
                if f in old_field_cols:
                    continue
                for prefix in ('new_', 'updated_'):
                    if f.startswith(prefix) and f[len(prefix):] in old_field_cols:
                        width_pairs[f] = f[len(prefix):]
                        break
        for new_f, old_f in width_pairs.items():
            if new_f not in new_field_positions or old_f not in old_field_cols:
                continue
            old_letter = get_column_letter(old_field_cols[old_f])
            width = old_widths.get(old_letter)
            if width is not None:
                set_width(new_field_positions[new_f], width)

    # then apply explicit overrides for the 3 newly-inserted columns (and any
    # deliberate resize of an existing one) -- always wins over both the
    # carried-forward width above and the New/Updated pairing above
    for f, newc in new_field_positions.items():
        if f in width_overrides:
            set_width(newc, width_overrides[f])

    for min_c, min_r, max_c, max_r in merges_before:
        new_min_c = old_to_new.get(min_c, min_c)
        new_max_c = old_to_new.get(max_c, max_c)
        ws.merge_cells(start_row=min_r, start_column=new_min_c, end_row=max_r, end_column=new_max_c)

    # clear first -- these DVs are still attached to ws from before the wipe
    # (the wipe step never touches data_validations), so without this the
    # old, now-stale sqrefs (pointing at pre-shift columns) survive
    # alongside the newly remapped ones, leaving duplicate/conflicting
    # dropdown rules on whatever content now occupies those old columns.
    ws.data_validations = DataValidationList()
    for old_sqref, dv in dv_before:
        new_dv = DataValidation(type=dv.type, formula1=dv.formula1, formula2=dv.formula2,
                                 allow_blank=dv.allowBlank, showDropDown=dv.showDropDown,
                                 showInputMessage=dv.showInputMessage, showErrorMessage=dv.showErrorMessage,
                                 errorTitle=dv.errorTitle, error=dv.error,
                                 promptTitle=dv.promptTitle, prompt=dv.prompt)
        new_dv.sqref = MultiCellRange(remap_sqref(old_sqref, old_to_new))
        ws.add_data_validation(new_dv)

    ws.conditional_formatting = ConditionalFormattingList()
    for old_sqref, rules in cf_before:
        new_sqref = remap_sqref(old_sqref, old_to_new)
        for rule in rules:
            ws.conditional_formatting.add(new_sqref, rule)

    for r in range(1, last_row + 1):
        ws.row_dimensions[r].outlineLevel = row_classifier(ws, r)

    if freeze_panes:
        ws.freeze_panes = freeze_panes
    if zoom:
        ws.sheet_view.zoomScale = zoom
    if tab_color:
        ws.sheet_properties.tabColor = tab_color
    if default_row_height:
        ws.sheet_format.defaultRowHeight = default_row_height


def extend_header_banner(ws, last_data_col, header_rows, header_text_col=1):
    """Extend each given section/title row's solid fill (currently only on
    header_text_col) across the full table width, matching v1.1's pattern
    of a full-width colour banner rather than a one-cell sliver.

    header_rows: explicit set/list of row numbers that are genuine section
    or title rows -- NOT inferred from "column 1 has a solid fill", since in
    some of these workbooks column 1 is also the Req ID column, and a
    yellow-highlighted Req ID cell would otherwise be misread as a header
    banner and smeared across the whole data row."""
    header_rows = set(header_rows)
    for r in header_rows:
        anchor = ws.cell(row=r, column=header_text_col)
        if anchor.fill.patternType != 'solid':
            continue
        fill = copy.copy(anchor.fill)
        for c in range(header_text_col + 1, last_data_col + 1):
            ws.cell(row=r, column=c).fill = fill
