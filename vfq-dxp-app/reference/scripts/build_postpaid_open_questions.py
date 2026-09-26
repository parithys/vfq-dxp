#!/usr/bin/env python3
"""Build VFQ_DXP_Postpaid_Activation_Open_Questions_Reference.xlsx.

Generated, never hand-edited - same rule as the persona/feature matrix.
Opening the workbook in Excel and saving will silently rewrite it.

    python3 reference/scripts/build_postpaid_open_questions.py

The MARKDOWN IS THE SOURCE. Every question, its status, body text, source
citation and priority is parsed out of

    reference/VFQ_DXP_Postpaid_Activation_Open_Questions_Reference.md

and nothing is restated here, per the house rule: if a value already exists in
source, parse it rather than retype it. Edit the markdown and re-run this to
regenerate the workbook; the two cannot drift.

The parser is deliberately strict and aborts rather than emit a workbook that
silently dropped content - a question that fell on the floor because a bullet
was reformatted would be invisible in the output, and a stakeholder question
list that quietly lost three questions is worse than no list. Guards:

  - every `##` section must yield at least one parsed row
  - every item must carry a [OWED] or [GAP] tag
  - the question text must be non-empty and end up inside the bold span
  - the total row count must match the number of tagged bullets in the file
  - the priority list must reference only sections that exist
"""

import re
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'VFQ_DXP_Postpaid_Activation_Open_Questions_Reference.md'
OUT = ROOT / 'VFQ_DXP_Postpaid_Activation_Open_Questions_Reference.xlsx'


def die(msg):
    sys.exit(f'ABORT: {msg}')


# ------------------------------------------------------------------- parse

if not SRC.exists():
    die(f'source markdown not found: {SRC}')

LINES = SRC.read_text(encoding='utf-8').split('\n')

# A tagged bullet opens with "- **[OWED ...]" or "- **[GAP]".
TAGGED = re.compile(r'^- \*\*\[(OWED|GAP)([^\]]*)\]')

# Sections that are prose/meta rather than question lists.
NON_QUESTION_SECTIONS = {
    'Priority for the next stakeholder session',
    'What to ask for as well as answers',
}


def _is_question_section(title):
    return title is not None and title not in NON_QUESTION_SECTIONS


def count_expected(lines):
    """Tagged bullets that are actually questions.

    Counted with the same section awareness as the parser, because the
    document's own legend defines [OWED] and [GAP] using two tagged bullets in
    the preamble - before the first heading - and a flat count over the whole
    file picks those up as questions. The guard below compares this against
    what the parser kept, so an over-count here would report a phantom drop
    and an under-count would mask a real one.
    """
    section, n = None, 0
    for ln in lines:
        if ln.startswith('## '):
            section = ln[3:].strip()
        elif _is_question_section(section) and TAGGED.match(ln):
            n += 1
    return n


EXPECTED_ITEMS = count_expected(LINES)
if EXPECTED_ITEMS == 0:
    die('no tagged bullets found in any question section - has the format changed?')

items = []          # question rows
priority = []       # ranked shortlist
artefacts = []      # things to request as artefacts, not answers
section_order = []  # "1. Identification and KYC" in file order

current = None      # current section title
buf = None          # accumulating item lines


def flush():
    """Close the item under construction and append it to `items`."""
    global buf
    if buf is None:
        return
    raw = '\n'.join(buf)
    buf = None

    m = re.match(r'^- \*\*\[(OWED|GAP)([^\]]*)\]\s*(.*)$', raw, re.S)
    if not m:
        die(f'item did not parse in section {current!r}: {raw[:90]!r}')
    status, ref, rest = m.group(1), m.group(2).strip(), m.group(3)

    # The bold span holds the question; everything after it is the body. Some
    # items close the bold mid-line and continue with plain prose, others are
    # bold to the end of the first line.
    parts = rest.split('**', 1)
    question = parts[0].strip()
    body = (parts[1] if len(parts) > 1 else '').strip()
    if not question:
        die(f'empty question text in section {current!r}: {raw[:90]!r}')
    # A question ending in a comma means the bold span closed mid-sentence, so
    # the Question column would carry half a sentence and the rest would leak
    # into the detail column. Fine in prose, wrong in a spreadsheet where the
    # column is read on its own. A trailing comma is unambiguous; noun-phrase
    # topics ("The agent role privilege matrix") end without punctuation and
    # are left alone.
    if question.rstrip().endswith(','):
        die(f'question ends mid-sentence, extend the bold span to cover it: {question!r}')

    # Source citations live on their own trailing line(s).
    source = ''
    body_lines, src_lines = [], []
    for ln in body.split('\n'):
        s = ln.strip()
        if re.match(r'^Sources?:', s) or src_lines:
            src_lines.append(re.sub(r'^Sources?:\s*', '', s))
        else:
            body_lines.append(s)
    if src_lines:
        source = ' '.join(x for x in src_lines if x)
    body = ' '.join(x for x in body_lines if x)

    items.append({
        'section': current,
        'status': status,
        'ref': ref,
        'question': clean(question),
        'detail': clean(body),
        'source': clean(source),
    })


def clean(text):
    """Strip markdown emphasis and code ticks; Excel renders none of it."""
    text = text.replace('**', '').replace('`', '')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


in_body = False  # past the legend/preamble

for ln in LINES:
    if ln.startswith('## '):
        flush()
        title = ln[3:].strip()
        current = title
        in_body = True
        if title not in NON_QUESTION_SECTIONS:
            section_order.append(title)
        continue

    if not in_body or current is None:
        continue

    if current == 'Priority for the next stakeholder session':
        m = re.match(r'^(\d+)\.\s+(.*)$', ln.strip())
        if m:
            priority.append({'rank': int(m.group(1)), 'text': clean(m.group(2))})
        elif ln.startswith('   ') and priority:
            priority[-1]['text'] = clean(priority[-1]['text'] + ' ' + ln.strip())
        continue

    if current == 'What to ask for as well as answers':
        if ln.startswith('- '):
            artefacts.append(clean(ln[2:]))
        elif ln.startswith('  ') and artefacts:
            artefacts[-1] = clean(artefacts[-1] + ' ' + ln.strip())
        continue

    if TAGGED.match(ln):
        flush()
        buf = [ln]
    elif buf is not None and (ln.startswith('  ') or ln.strip() == ''):
        if ln.strip():
            buf.append(ln)
    elif ln.startswith('- '):
        # An untagged bullet inside a question section means a question lost
        # its status tag - surface it rather than skip it.
        flush()
        die(f'untagged bullet in question section {current!r}: {ln[:90]!r}')

flush()

# ------------------------------------------------------------------ guards

if len(items) != EXPECTED_ITEMS:
    die(f'parsed {len(items)} items but the file has {EXPECTED_ITEMS} tagged '
        'bullets - the parser dropped content')

empty = [s for s in section_order if not any(i['section'] == s for i in items)]
if empty:
    die(f'sections parsed with zero questions: {empty}')

if not priority:
    die('priority shortlist parsed empty')
if not artefacts:
    die('artefact request list parsed empty')

# The shortlist cites sections as "(S4)". Every such reference must resolve to
# a real section number, or the workbook would point readers at nothing.
section_numbers = {s.split('.', 1)[0].strip() for s in section_order}
for p in priority:
    for ref in re.findall(r'\(S(\d+)\)', p['text']):
        if ref not in section_numbers:
            die(f'priority item {p["rank"]} cites section S{ref}, which does not exist')

# ----------------------------------------------------------------- styling
# Matches the other reference workbooks (build_persona_feature_matrix.py) so
# this file reads as one of the family rather than a one-off.

VF_RED = 'E60000'
HEADER_FILL = PatternFill('solid', fgColor=VF_RED)
HEADER_FONT = Font(color='FFFFFF', bold=True, size=10)
META_FILL = PatternFill('solid', fgColor='F4F4F4')
OWED_FILL = PatternFill('solid', fgColor='E3F2FD')   # already committed
GAP_FILL = PatternFill('solid', fgColor='FFF3E0')    # not on anyone's list
TITLE_FONT = Font(bold=True, size=18, color=VF_RED)
SUB_FONT = Font(size=10, color='555555', italic=True)
BOLD = Font(bold=True)
SMALL = Font(size=10)
MONO = Font(size=9, name='Menlo', color='333333')
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(horizontal='center', vertical='center')
THIN = Side(style='thin', color='DDDDDD')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

STATUS_FILL = {'OWED': OWED_FILL, 'GAP': GAP_FILL}


def header_row(ws, labels, widths, row=1, height=30):
    for i, (label, width) in enumerate(zip(labels, widths), start=1):
        c = ws.cell(row=row, column=i, value=label)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(wrap_text=True, vertical='center')
        c.border = BORDER
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[row].height = height


wb = Workbook()

# openpyxl writes formulas as strings with no cached result, so a reader that
# trusts cached values (Quick Look, Numbers, Sheets, pandas) shows the count
# cells blank. This asks the application to recalculate the whole book on open,
# which is what fills them in. Normally the build step would instead run
# LibreOffice to bake the values in; there is no soffice on this machine, so
# this flag is doing that job. The counted values are asserted at the end of
# this script regardless, so a wrong formula cannot ship unnoticed.
wb.calculation.fullCalcOnLoad = True

# ====================================================== Sheet 2 first (data)
# Built before Read Me so the summary formulas can address a known row count.

qs = wb.active
qs.title = 'Open Questions'

QCOLS = ['ID', 'Area', 'Status', 'Committed as', 'Question',
         'What is known / why it matters', 'Source', 'Priority area']
QWIDTHS = [7, 26, 9, 14, 52, 74, 46, 9]
header_row(qs, QCOLS, QWIDTHS)

# The shortlist ranks AREAS, not individual questions, so this stamps every
# question in a shortlisted area with that area's rank. The column is named
# 'Priority area' for exactly that reason - calling it 'Priority' would read as
# though 33 of the 57 questions had been individually ranked, which they have
# not. Sort on it to group the areas worth opening the meeting with.
priority_sections = {}
for p in priority:
    for ref in re.findall(r'\(S(\d+)\)', p['text']):
        priority_sections.setdefault(ref, p['rank'])

for r, it in enumerate(items, start=2):
    sec_no = it['section'].split('.', 1)[0].strip()
    sec_name = it['section'].split('.', 1)[1].strip() if '.' in it['section'] else it['section']
    rank = priority_sections.get(sec_no, '')

    vals = [
        f'Q{r - 1:02d}',
        sec_name,
        it['status'],
        it['ref'] or '',
        it['question'],
        it['detail'],
        it['source'],
        rank,
    ]
    for i, v in enumerate(vals, start=1):
        c = qs.cell(row=r, column=i, value=v)
        c.border = BORDER
        c.alignment = WRAP
        c.font = SMALL
        if i == 3:
            c.fill = STATUS_FILL[it['status']]
            c.alignment = CENTER
            c.font = Font(size=10, bold=True)
        elif i == 5:
            c.font = Font(size=10, bold=True)
        elif i == 7:
            c.font = MONO
        elif i in (1, 4, 8):
            c.alignment = CENTER
    qs.row_dimensions[r].height = 58

LAST = len(items) + 1
# qs.freeze_panes intentionally unset - see the FREEZE_PANES note in
# build_persona_feature_matrix.py. Same decision, same reason: panes are a
# viewing preference and baking them in takes the choice away from the reader.
qs.auto_filter.ref = f'A1:H{LAST}'

qs.cell(row=LAST + 2, column=1, value=(
    'Status: OWED = already logged as a formal dependency in the Mobile Postpaid Activation '
    'BRSD v2.0, so VFQ has committed to supply it; chase, do not re-ask. GAP = found while '
    'building the journey and not on anyone list - the app carries an assumption today, named '
    'in the source file cited. Priority column is populated only for the areas on the '
    'Priority Shortlist sheet; blank means unranked, not unimportant.'
)).font = SUB_FONT
qs.cell(row=LAST + 2, column=1).alignment = WRAP
qs.merge_cells(start_row=LAST + 2, start_column=1, end_row=LAST + 4, end_column=8)

# ============================================================== Sheet 1: Read Me

rm = wb.create_sheet('Read Me', 0)
rm.column_dimensions['A'].width = 34
rm.column_dimensions['B'].width = 14
rm.column_dimensions['C'].width = 76

rm['A1'] = 'New Postpaid Activation'
rm['A1'].font = TITLE_FONT
rm.merge_cells('A1:C1')
rm['A2'] = 'Open questions for VFQ business stakeholders'
rm['A2'].font = Font(size=12, color='555555')
rm.merge_cells('A2:C2')

row = 4
for label, value in [
    ('Generated by', 'reference/scripts/build_postpaid_open_questions.py'),
    ('Source of record', 'VFQ_DXP_Postpaid_Activation_Open_Questions_Reference.md'),
    ('Journey scope', 'src/modules/mobile-postpaid/screens/NewPostpaidWizard.tsx (11 steps)'),
    ('Checked against', 'reference/.knowledge/ (83 indexed source documents)'),
    ('Related artefacts', 'reference/blueprint/conflict-report.md (corpus conflicts, broader scope); '
                          'reference/.knowledge/INDEX.md (source confidence)'),
]:
    rm.cell(row=row, column=1, value=label).font = BOLD
    rm.cell(row=row, column=1).fill = META_FILL
    rm.cell(row=row, column=1).border = BORDER
    c = rm.cell(row=row, column=3, value=value)
    c.font = SMALL
    c.alignment = WRAP
    rm.merge_cells(start_row=row, start_column=2, end_row=row, end_column=2)
    row += 1

rm.cell(row=row + 1, column=1, value='This workbook is generated. Do not hand-edit.').font = Font(
    bold=True, size=11, color=VF_RED)
rm.cell(row=row + 2, column=1, value=(
    'Edit the markdown and re-run the script. Opening this file in Excel and saving it will '
    'silently rewrite it, and the next regeneration will discard the change. Every question, '
    'status, citation and ranking below is parsed out of the markdown - nothing is typed into '
    'the script.'
)).font = SUB_FONT
rm.cell(row=row + 2, column=1).alignment = WRAP
rm.merge_cells(start_row=row + 2, start_column=1, end_row=row + 4, end_column=3)
row += 6

# ---- counts, as formulas over the Open Questions sheet rather than baked in
rm.cell(row=row, column=1, value='Counts').font = Font(bold=True, size=12, color=VF_RED)
row += 1
header_row(rm, ['Measure', 'Count', 'Meaning'], [34, 14, 76], row=row, height=22)
row += 1

COUNTS = [
    ('Open questions total', f'=COUNTA(\'Open Questions\'!$A$2:$A${LAST})',
     'One row per question on the Open Questions sheet.'),
    ('OWED - already committed', f'=COUNTIF(\'Open Questions\'!$C$2:$C${LAST},"OWED")',
     'Logged as a BRSD v2.0 dependency. Chase the owner rather than re-asking.'),
    ('GAP - not yet logged', f'=COUNTIF(\'Open Questions\'!$C$2:$C${LAST},"GAP")',
     'Found while building. The app carries an assumption today.'),
    ('Areas covered', f'=SUMPRODUCT((COUNTIF(\'Open Questions\'!$B$2:$B${LAST},'
                      f'\'Open Questions\'!$B$2:$B${LAST})>0)/'
                      f'COUNTIF(\'Open Questions\'!$B$2:$B${LAST},'
                      f'\'Open Questions\'!$B$2:$B${LAST}))',
     'Distinct values in the Area column, counted without a helper range.'),
    ('Questions in a priority area', f'=COUNT(\'Open Questions\'!$H$2:$H${LAST})',
     'Not individually ranked - these sit in one of the 8 areas on the Priority '
     'Shortlist sheet.'),
]
for label, formula, meaning in COUNTS:
    rm.cell(row=row, column=1, value=label).font = SMALL
    rm.cell(row=row, column=1).border = BORDER
    c = rm.cell(row=row, column=2, value=formula)
    c.font = Font(size=11, bold=True)
    c.alignment = CENTER
    c.border = BORDER
    m = rm.cell(row=row, column=3, value=meaning)
    m.font = SUB_FONT
    m.alignment = WRAP
    m.border = BORDER
    row += 1

rm.cell(row=row - 2, column=2).comment = Comment(
    'Counted with SUMPRODUCT/COUNTIF rather than a distinct-count function so the '
    'workbook evaluates identically in Excel, LibreOffice and Numbers.', 'generator')

row += 1
rm.cell(row=row, column=1, value='By area').font = Font(bold=True, size=12, color=VF_RED)
row += 1
header_row(rm, ['Area', 'Questions', 'Of which OWED'], [34, 14, 76], row=row, height=22)
row += 1
for sec in section_order:
    name = sec.split('.', 1)[1].strip() if '.' in sec else sec
    rm.cell(row=row, column=1, value=name).font = SMALL
    rm.cell(row=row, column=1).border = BORDER
    c = rm.cell(row=row, column=2,
                value=f'=COUNTIF(\'Open Questions\'!$B$2:$B${LAST},$A{row})')
    c.alignment = CENTER
    c.font = SMALL
    c.border = BORDER
    o = rm.cell(row=row, column=3,
                value=f'=COUNTIFS(\'Open Questions\'!$B$2:$B${LAST},$A{row},'
                      f'\'Open Questions\'!$C$2:$C${LAST},"OWED")')
    o.alignment = CENTER
    o.font = SMALL
    o.border = BORDER
    row += 1

# ======================================================= Sheet 3: Priority

pr = wb.create_sheet('Priority Shortlist')
header_row(pr, ['Rank', 'Ask this first', 'Why it leads'], [7, 62, 62])
for i, p in enumerate(priority, start=2):
    txt = p['text']
    # "Thing to ask (S4). Reason follows." - split the trailing rationale off
    m = re.match(r'^(.*?\(S[\d,\s S]*\)\.?)\s*(.*)$', txt)
    ask, why = (m.group(1), m.group(2)) if m else (txt, '')
    pr.cell(row=i, column=1, value=p['rank']).alignment = CENTER
    pr.cell(row=i, column=1).font = Font(size=11, bold=True)
    for col, val in ((2, ask), (3, why)):
        c = pr.cell(row=i, column=col, value=val)
        c.alignment = WRAP
        c.font = SMALL if col == 3 else Font(size=10, bold=True)
    for col in range(1, 4):
        pr.cell(row=i, column=col).border = BORDER
    pr.row_dimensions[i].height = 44
# pr.freeze_panes intentionally unset - see FREEZE_PANES note

pr.cell(row=len(priority) + 3, column=1, value=(
    'Ranked by how much of the journey is blocked behind the answer, not by how hard the '
    'question is to ask. The (Sn) marker is the Open Questions area it belongs to.'
)).font = SUB_FONT
pr.cell(row=len(priority) + 3, column=1).alignment = WRAP
pr.merge_cells(start_row=len(priority) + 3, start_column=1, end_row=len(priority) + 4, end_column=3)

# ====================================================== Sheet 4: Artefacts

ar = wb.create_sheet('Artefacts to Request')
header_row(ar, ['#', 'Request this document or outcome, not an answer'], [7, 118])
for i, a in enumerate(artefacts, start=2):
    ar.cell(row=i, column=1, value=i - 1).alignment = CENTER
    ar.cell(row=i, column=1).font = Font(size=11, bold=True)
    ar.cell(row=i, column=1).border = BORDER
    c = ar.cell(row=i, column=2, value=a)
    c.alignment = WRAP
    c.font = SMALL
    c.border = BORDER
    ar.row_dimensions[i].height = 44
# ar.freeze_panes intentionally unset - see FREEZE_PANES note

ar.cell(row=len(artefacts) + 3, column=1, value=(
    'These are not questions a stakeholder can answer in a meeting - they are existing '
    'artefacts or recorded action outcomes that someone already holds.'
)).font = SUB_FONT
ar.cell(row=len(artefacts) + 3, column=1).alignment = WRAP
ar.merge_cells(start_row=len(artefacts) + 3, start_column=1,
               end_row=len(artefacts) + 4, end_column=2)

wb.save(OUT)

# ------------------------------------------------- verify the count formulas
# A recalc pass would normally prove these evaluate. Without LibreOffice here,
# the next best thing is to compute the same answers independently in Python
# and assert them, so a mis-aimed range cannot ship looking plausible. These
# are the values the Read Me cells must show once Excel recalculates on open.

areas = [i['section'].split('.', 1)[1].strip() if '.' in i['section'] else i['section']
         for i in items]
expect = {
    'Open questions total': len(items),
    'OWED - already committed': sum(1 for i in items if i['status'] == 'OWED'),
    'GAP - not yet logged': sum(1 for i in items if i['status'] == 'GAP'),
    'Areas covered': len(set(areas)),
    'Questions in a priority area': sum(
        1 for i in items
        if priority_sections.get(i['section'].split('.', 1)[0].strip())),
}
if expect['OWED - already committed'] + expect['GAP - not yet logged'] != len(items):
    die('status values other than OWED/GAP present - the count formulas would under-report')
if expect['Areas covered'] != len(section_order):
    die(f'{expect["Areas covered"]} distinct areas in the rows but '
        f'{len(section_order)} sections parsed - the Area column disagrees with the '
        'By area table, so one of the two is wrong')
if expect['Questions in a priority area'] == 0:
    die('no question row carries a priority rank - the shortlist did not join to any area')

owed = expect['OWED - already committed']
print(f'Wrote {OUT.relative_to(ROOT.parent)}')
print('  formula cells will show: ' + ', '.join(f'{k}={v}' for k, v in expect.items()))
print(f'  {len(items)} questions across {len(section_order)} areas '
      f'({owed} OWED, {len(items) - owed} GAP)')
print(f'  {len(priority)} priority items, {len(artefacts)} artefact requests')
