"""Generate VFQ_DXP_Persona_Feature_Applicability_Matrix_Reference.xlsx.

Regenerate with: python3 reference/scripts/build_persona_feature_matrix.py
(run from anywhere — paths resolve relative to this script's location.)

This workbook is the SSOT for "which persona can use which implemented
feature". It is GENERATED, never hand-edited — edit this script instead and
re-run, otherwise the next run silently discards manual changes.

Two hard rules keep it trustworthy:

  1. ONLY features actually implemented in the app appear as rows. The
     implemented set is discovered from registerScreen() calls in
     src/modules/*/screens/index.tsx (the same registry the router uses to
     decide built vs <ScreenNotYetBuilt>) plus the hand-maintained
     WORKSPACE_FEATURES list for surfaces that are routed directly in
     router.tsx and so carry no SCR- id.

  2. A tick is only ever written where there is positive evidence — either an
     rbac.json row on a constituent screen, or an explicit persona gate in
     application code (agentPrivilegeEngine.ts and the inline checks that
     reuse its pattern). A blank cell means "no evidence", NOT "denied";
     personaEngine.ts's own comment makes the same distinction. See the
     Legend sheet.

When you add a feature to the app, add it here (MODULE_FEATURES if it
registers SCR- ids, WORKSPACE_FEATURES otherwise) and re-run. ADDING_A_FEATURE
in the Legend sheet spells out the checklist.
"""

import glob
import json
import os
import re
import subprocess

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONF = os.path.join(APP_ROOT, 'public', 'config')
SRC = os.path.join(APP_ROOT, 'src')
OUT = os.path.join(
    APP_ROOT, 'reference', 'VFQ_DXP_Persona_Feature_Applicability_Matrix_Reference.xlsx'
)

TICK = '✓'
RESTRICTED_MARK = 'R'
# rbac.json's own level for "a row exists, but it grants nothing". personaEngine's
# canPerformAction() excludes it from ACTION_LEVELS, so such a screen is listed for
# the persona but permits no action — a third state that is neither access nor
# silence, and is marked separately rather than flattened into either.
DENY_LEVEL = 'Restricted-No-Access'

# ---------------------------------------------------------------- load config

with open(os.path.join(CONF, 'personas.json')) as f:
    PERSONAS = json.load(f)
with open(os.path.join(CONF, 'rbac.json')) as f:
    RBAC = json.load(f)
with open(os.path.join(CONF, 'routes.json')) as f:
    ROUTES = {r['screenId']: r for r in json.load(f)}

PERSONA_IDS = [p['id'] for p in PERSONAS]
PERSONA_BY_ID = {p['id']: p for p in PERSONAS}
ALL_PERSONAS = set(PERSONA_IDS)

# --------------------------------------- implemented screens (from the code)

def discover_implemented():
    """Screen ids passed to registerScreen(), keyed by module directory.

    Picks up both literal registerScreen('SCR-x', ...) calls and the
    WIZARD_SCREEN_IDS-style array + forEach(registerScreen) pattern, since
    every id in these files reaches the registry one way or the other.
    """
    found = {}
    for path in sorted(glob.glob(os.path.join(SRC, 'modules', '*', 'screens', 'index.tsx'))):
        module = path.split(os.sep)[-3]
        found[module] = set(re.findall(r"'(SCR-\d+)'", open(path).read()))
    return found

IMPLEMENTED_BY_MODULE = discover_implemented()
IMPLEMENTED = {sid for ids in IMPLEMENTED_BY_MODULE.values() for sid in ids}

# ------------------------------------------- persona gates encoded in the app
# Mirrors agentPrivilegeEngine.ts and the inline activePersonaId checks that
# follow its pattern. Kept as literal sets (not parsed) so a drift between
# this script and the code is caught by verify_gates() below rather than
# silently producing a wrong matrix.

NON_AGENT = {
    'PERSONA-009', 'PERSONA-010', 'PERSONA-011',
    'PERSONA-016', 'PERSONA-050', 'PERSONA-052',
}
INTERNAL_AGENTS = ALL_PERSONAS - NON_AGENT                      # isInternalAgentPersona()
BACKOFFICE_PRIVILEGED = {                                        # isBackofficeOrPrivilegedPersona()
    'PERSONA-005', 'PERSONA-019', 'PERSONA-024',
    'PERSONA-044', 'PERSONA-046', 'PERSONA-060',
}
RETAIL_AGENTS = {'PERSONA-001', 'PERSONA-043'}
BACK_OFFICE_AGENTS = {'PERSONA-005', 'PERSONA-044', 'PERSONA-046', 'PERSONA-060'}
AGENT_MANAGERS = {'PERSONA-024'}
QNOMY = RETAIL_AGENTS | AGENT_MANAGERS                           # canSeeQnomyTicketNumber()
CTI = BACK_OFFICE_AGENTS | AGENT_MANAGERS                        # canSeeCtiReferenceNumber()
SUPERVISOR = {'PERSONA-024'}                                     # TaskDetailView ATV-03
TICKET_RESOLVE = {'PERSONA-059', 'PERSONA-024', 'PERSONA-044'}   # TicketDetail canResolve
TICKET_REASSIGN = {'PERSONA-024', 'PERSONA-044'}                 # TicketDetail canReassignQueue

def verify_gates():
    """Fail loudly if agentPrivilegeEngine.ts no longer matches the sets above.

    Cheap guard against the matrix drifting away from the code it claims to
    describe — the whole point of the file is that it can be trusted.
    """
    engine = open(os.path.join(SRC, 'engines', 'agentPrivilegeEngine.ts')).read()
    ticket = open(os.path.join(
        SRC, 'modules', 'trouble-ticketing-complaints', 'screens', 'TicketDetail.tsx')).read()
    problems = []

    def block(text, marker):
        i = text.index(marker)
        return text[i:text.index(']', i)]

    for marker, expected, label in [
        ('const NON_AGENT_PERSONA_IDS', NON_AGENT, 'NON_AGENT_PERSONA_IDS'),
        ('const BACKOFFICE_OR_PRIVILEGED_PERSONA_IDS', BACKOFFICE_PRIVILEGED,
         'BACKOFFICE_OR_PRIVILEGED_PERSONA_IDS'),
        ('const RETAIL_AGENT_PERSONA_IDS', RETAIL_AGENTS, 'RETAIL_AGENT_PERSONA_IDS'),
        ('const BACK_OFFICE_AGENT_PERSONA_IDS', BACK_OFFICE_AGENTS,
         'BACK_OFFICE_AGENT_PERSONA_IDS'),
        ('const AGENT_MANAGER_PERSONA_IDS', AGENT_MANAGERS, 'AGENT_MANAGER_PERSONA_IDS'),
    ]:
        actual = set(re.findall(r'PERSONA-\d+', block(engine, marker)))
        if actual != expected:
            problems.append(f'{label}: code has {sorted(actual)}, script expects {sorted(expected)}')

    for fn, expected, label in [
        ('canResolve', TICKET_RESOLVE, 'TicketDetail canResolve'),
        ('canReassignQueue', TICKET_REASSIGN, 'TicketDetail canReassignQueue'),
    ]:
        line = next(l for l in ticket.splitlines() if f'const {fn} =' in l)
        actual = set(re.findall(r'PERSONA-\d+', line))
        if actual != expected:
            problems.append(f'{label}: code has {sorted(actual)}, script expects {sorted(expected)}')

    if problems:
        raise SystemExit(
            'Persona gates in code no longer match this script:\n  - '
            + '\n  - '.join(problems)
            + '\n\nUpdate the sets at the top of build_persona_feature_matrix.py, then re-run.'
        )

verify_gates()

# ------------------------------------------------------------ feature catalogue
# (feature name, module/area, [screen ids], code-gate set or None, note)
# Screen ids are asserted against IMPLEMENTED below, so a typo or a screen that
# stops being registered surfaces as a build error rather than a silent gap.

MODULE_FEATURES = [
    ('New Fixed Line guided wizard', 'Fixed Line / Fibre',
     ['SCR-043', 'SCR-045', 'SCR-046', 'SCR-048', 'SCR-050', 'SCR-058'], None,
     'Contact, Address, Plan, Number Selection, CAF/Attachments + e-signature preview modal'),
    ('New FWA / 5G Home guided wizard', 'FWA / 5G Home',
     ['SCR-077', 'SCR-078', 'SCR-079', 'SCR-080', 'SCR-082', 'SCR-084', 'SCR-085'], None,
     'Tile/home entry, Contact, Address, Plan, Number Selection, CAF modal, Activity comments'),
    ('FWA serial number check (Dual Play)', 'FWA / 5G Home',
     ['SCR-093'], None, 'Device serial / SIM-CPE scan verification'),
    ('New Postpaid Connection wizard', 'Mobile Postpaid',
     ['SCR-037', 'SCR-154', 'SCR-155', 'SCR-156', 'SCR-157', 'SCR-158', 'SCR-159',
      'SCR-160', 'SCR-161', 'SCR-162'], None,
     'Single-scroll flow: Contact, Address, Billing, Number, SIM Serial, Catalog/Plan, '
     'Payment, CAF, Activity'),
    ('New Prepaid (Tablet) wizard', 'Mobile Prepaid',
     ['SCR-190', 'SCR-191', 'SCR-192'], None,
     'Contact/ID capture, Number Selection, SIM Serial'),
    ('MNP process choice gate', 'MNP / FNP Porting',
     ['SCR-120'], None, 'Postpaid vs Prepaid choice entered before the port-in wizard'),
    ('MNP Port-In guided wizard', 'MNP / FNP Porting',
     ['SCR-121', 'SCR-122', 'SCR-123', 'SCR-124', 'SCR-125', 'SCR-126', 'SCR-127',
      'SCR-129', 'SCR-132', 'SCR-133', 'SCR-134'], None,
     'Contact, Address, Billing, SIM Serial, Plan, Donor Details, Donor Attachment, CAF, '
     'Line Items, Addon & Discount, Activity'),
    ('Lead list views (My / Created / Team / All / Contact)', 'Lead Management',
     ['SCR-142', 'SCR-143', 'SCR-144', 'SCR-147', 'SCR-150'], None,
     'Five scoped views onto the same lead list component'),
    ('Lead detail + lead actions', 'Lead Management',
     ['SCR-141', 'SCR-145', 'SCR-146', 'SCR-148', 'SCR-149'], None,
     'Detail view plus Reject, Owner reassignment, Description edit, CallBack date/time'),
    ('My Sales Orders queue', 'Order Management',
     ['SCR-059'], None, 'Agent-facing order queue incl. pending-approval orders'),
    ('Order Approval Queue', 'Order Management',
     ['SCR-060', 'SCR-197'], None, 'Desktop + tablet order activities queue'),
    ('Order approval detail + approve/reject', 'Order Management',
     ['SCR-061', 'SCR-062', 'SCR-063'], None,
     'Attachments / Order Details / Activities / Agents Details tabs, with approve and reject modals'),
    ('Pre-to-Post migration wizard', 'Pre-to-Post Migration',
     ['SCR-177', 'SCR-180'], None, 'Postpaid contact step + Base Management wizard'),
    ('Migration offer tab', 'Pre-to-Post Migration',
     ['SCR-179'], None, 'Complex Asset List applet'),
    ('Bulk jobs / bulk processing dashboard', 'Pre-to-Post Migration',
     ['SCR-183'], None, 'TM Bulk Batch List applet'),
    ('Connection details popup', 'Pre-to-Post Migration',
     ['SCR-075'], None, None),
    ('Number Management Portal', 'SIM / Number Management',
     ['SCR-024'], None, 'Number inventory browse / reserve'),
    ('SIM swap queue', 'SIM / Number Management',
     ['SCR-196'], None, 'Order tasks tab for SIM swap approvals'),
    ('Global search screen', 'SIM / Number Management',
     ['SCR-195'], None, 'Full-page search results surface'),
    ('Tickets dashboard', 'Trouble Ticketing / Complaints',
     ['SCR-211'], None, 'Queue counts and ticket list'),
    ('Ticket detail — view & public notes', 'Trouble Ticketing / Complaints',
     ['SCR-029', 'SCR-210'], None, 'Ticket homepage + detail with public notes and bell notifications'),
    ('Ticket detail — resolve ticket', 'Trouble Ticketing / Complaints',
     ['SCR-029', 'SCR-210'], TICKET_RESOLVE, 'Code-gated: TicketDetail.tsx canResolve'),
    ('Ticket detail — reassign queue', 'Trouble Ticketing / Complaints',
     ['SCR-029', 'SCR-210'], TICKET_REASSIGN, 'Code-gated: TicketDetail.tsx canReassignQueue'),
    ('Passport-to-QID update wizard', 'Identity / Customer Management',
     ['SCR-151'], None, 'ID document renewal capture'),
    ('Enterprise account creation', 'Enterprise / IoT / B2B',
     ['SCR-007'], None, None),
    ('Bulk adjustment portal', 'Enterprise / IoT / B2B',
     ['SCR-001'], None, 'DXP target-state bulk adjustment'),
]

# Surfaces routed directly in router.tsx. These carry no SCR- id, so RBAC
# cannot speak to them; applicability comes from a code gate or is absent.
WORKSPACE_FEATURES = [
    ('Staff-ID + SSO login', 'Authentication', None,
     'Staff ID resolves persona via staffIdRoleMap.ts; 7 of 66 personas are reachable'),
    ('Agent dashboard', 'Dashboard', None,
     'KPI tiles, My Tasks counters, quick actions, recently viewed customers'),
    ('Customer search', 'Customer Search', None,
     'Search by mobile, QID, customer/account number, name, email, service ID'),
    ('Customer 360 — view (all sections)', 'Customer 360', None,
     'Profile, Contacts, Addresses, Mobile, Fibre & Home, Enterprise, Billing, Orders, '
     'Tickets, Interactions, Communications, Documents, Notifications, Bulk Notes, '
     'Consent & Preferences, Products & Assets, Account Hierarchy, Recent Activities'),
    ('Customer 360 — edit customer records', 'Customer 360', INTERNAL_AGENTS,
     'Code-gated: canEditCustomerRecords() — contact, address and billing-profile edits (BR-02)'),
    ('Customer 360 — bell notification banner', 'Customer 360', INTERNAL_AGENTS,
     'Code-gated: isInternalAgentPersona()'),
    ('Billing account page + invoice actions', 'Customer 360', INTERNAL_AGENTS,
     'Code-gated: canEditCustomerRecords() on InvoiceActions'),
    ('Sales workspace', 'Sales', None, 'Module/journey launcher'),
    ('Support workspace', 'Support', None, 'Module/journey launcher'),
    ('Orders workspace', 'Orders', None, 'Module/journey launcher'),
    ('Task list', 'Tasks', None, 'Filterable agent task queue'),
    ('Task detail', 'Tasks', None, 'Task detail with comments and status'),
    ('Task detail — assign to team member', 'Tasks', SUPERVISOR,
     'Code-gated: TaskDetailView.tsx isSupervisor (ATV-03)'),
    ('Agent profile — view', 'Agent Profile', None, 'Read-only identity, team, responsibilities'),
    ('Agent profile — edit (password / MFA)', 'Agent Profile', INTERNAL_AGENTS,
     'Code-gated: isInternalAgentPersona() (APM-01/05/08, BR-01/BR-02)'),
    ('Administration — personas & RBAC viewer', 'Administration', None,
     'Read-only browse of all 66 personas and their RBAC entries'),
    ('Administration — bell notification config', 'Administration', BACKOFFICE_PRIVILEGED,
     'Code-gated: isBackofficeOrPrivilegedPersona() (BIN-01, BNT-04, BR-03)'),
    ('Administration — bulk notes config', 'Administration', BACKOFFICE_PRIVILEGED,
     'Code-gated: isBackofficeOrPrivilegedPersona() (BIN-01, BNT-04, BR-03)'),
    ('Global search (header)', 'Navigation', None,
     'Cross-entity search over modules, screens, leads, orders, tickets'),
    ('Session reference — Qnomy ticket number', 'Navigation', QNOMY,
     'Code-gated: canSeeQnomyTicketNumber() — retail agents and their managers'),
    ('Session reference — CTI reference number', 'Navigation', CTI,
     'Code-gated: canSeeCtiReferenceNumber() — back-office agents and their managers'),
    ('Persona switcher', 'Navigation', None, 'Demo "login-as" affordance, not a security boundary'),
    ('Breadcrumbs + back navigation', 'Navigation', None, None),
    ('Dark / light theme toggle', 'Navigation', None, None),
]

# ------------------------------------------------- resolve applicability

unknown = sorted(
    {s for _, _, ids, _, _ in MODULE_FEATURES for s in ids} - IMPLEMENTED
)
if unknown:
    raise SystemExit(
        f'MODULE_FEATURES references screen ids that are not registered in the app: {unknown}\n'
        'Either the screen was removed or the id is a typo — fix MODULE_FEATURES and re-run.'
    )

rows = []

for name, area, ids, gate, note in MODULE_FEATURES:
    rbac_rows = [x for x in RBAC if x['screenId'] in ids]
    if gate is not None:
        personas, restricted = set(gate), set()
        basis = 'Code gate'
    else:
        granting = {x['personaId'] for x in rbac_rows if x['permissionLevel'] != DENY_LEVEL}
        denying = {x['personaId'] for x in rbac_rows if x['permissionLevel'] == DENY_LEVEL}
        # A persona holding both a granting and a denying row across this feature's
        # screens is treated as granted — the denial applies to one screen, not the
        # whole capability. The row-level refs still carry both for audit.
        personas, restricted = granting, denying - granting
        basis = 'RBAC evidence' if (personas or restricted) else 'Not persona-gated'
    levels = sorted({x['permissionLevel'] for x in rbac_rows
                     if x['personaId'] in personas and x['permissionLevel'] != DENY_LEVEL})
    refs = ', '.join(sorted(x['id'] for x in rbac_rows
                            if x['personaId'] in personas | restricted))
    rows.append({
        'area': area, 'feature': name, 'screens': ', '.join(sorted(ids)),
        'basis': basis, 'note': note or '', 'personas': personas,
        'restricted': restricted, 'levels': ', '.join(levels), 'refs': refs,
    })

for name, area, gate, note in WORKSPACE_FEATURES:
    personas = set(gate) if gate is not None else set()
    rows.append({
        'area': area, 'feature': name, 'screens': '—  (routed directly)',
        'basis': 'Code gate' if gate is not None else 'Not persona-gated',
        'note': note or '', 'personas': personas, 'restricted': set(),
        'levels': '', 'refs': '',
    })

for i, r in enumerate(rows, start=1):
    r['id'] = f'FEAT-{i:03d}'

# --------------------------------------------------------------- styling

VF_RED = 'E60000'
HEADER_FILL = PatternFill('solid', fgColor=VF_RED)
HEADER_FONT = Font(color='FFFFFF', bold=True, size=10)
LOGIN_FILL = PatternFill('solid', fgColor='7B1FA2')
META_FILL = PatternFill('solid', fgColor='F4F4F4')
TICK_FILL = PatternFill('solid', fgColor='E8F5E9')
RESTRICTED_FILL = PatternFill('solid', fgColor='FFF3E0')
GATE_FILL = PatternFill('solid', fgColor='FFF6DC')
TITLE_FONT = Font(bold=True, size=18, color=VF_RED)
SUB_FONT = Font(size=10, color='555555', italic=True)
BOLD = Font(bold=True)
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(horizontal='center', vertical='center')
THIN = Side(style='thin', color='DDDDDD')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

LOGIN_REACHABLE = {
    'PERSONA-001': 'VFQ12341', 'PERSONA-019': 'VFQ12342', 'PERSONA-005': 'VFQ12343',
    'PERSONA-041': 'VFQ12344', 'PERSONA-002': 'VFQ12345', 'PERSONA-025': 'VFQ12346',
    'PERSONA-008': 'VFQ12347',
}

wb = Workbook()

# ============================================================ Sheet 1: matrix
ws = wb.active
ws.title = 'Applicability Matrix'

META = [
    ('Feature ID', 11), ('Module / Area', 22), ('Feature', 40),
    ('Screen IDs', 26), ('Applicability basis', 17), ('Permission level(s) granted', 20),
    ('Notes', 52),
]
NMETA = len(META)

# Row 1 = persona names (per spec: each persona is a column in the first row).
# Row 2 = persona id + staff id, so a tick is traceable to a config record.
for i, (label, width) in enumerate(META, start=1):
    ws.cell(row=1, column=i, value=label)
    ws.column_dimensions[get_column_letter(i)].width = width

for j, pid in enumerate(PERSONA_IDS):
    col = NMETA + 1 + j
    ws.cell(row=1, column=col, value=PERSONA_BY_ID[pid]['name'])
    staff = LOGIN_REACHABLE.get(pid)
    ws.cell(row=2, column=col, value=f'{pid} · {staff}' if staff else pid)
    ws.column_dimensions[get_column_letter(col)].width = 5.5

for col in range(1, NMETA + len(PERSONA_IDS) + 1):
    for row in (1, 2):
        c = ws.cell(row=row, column=col)
        c.border = BORDER
        if col > NMETA:
            c.fill = LOGIN_FILL if PERSONA_IDS[col - NMETA - 1] in LOGIN_REACHABLE else HEADER_FILL
            c.font = HEADER_FONT
            c.alignment = Alignment(text_rotation=90, horizontal='center', vertical='bottom',
                                    wrap_text=False)
        else:
            c.fill = HEADER_FILL
            c.font = HEADER_FONT
            c.alignment = Alignment(wrap_text=True, vertical='bottom')
ws.row_dimensions[1].height = 210
ws.row_dimensions[2].height = 64

for r, row in enumerate(rows, start=3):
    vals = [row['id'], row['area'], row['feature'], row['screens'],
            row['basis'], row['levels'], row['note']]
    for i, v in enumerate(vals, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.alignment = WRAP
        c.border = BORDER
        c.font = Font(size=10)
        if i == 1:
            c.font = Font(size=10, bold=True)
        if row['basis'] == 'Code gate' and i == 5:
            c.fill = GATE_FILL
        elif i <= NMETA:
            c.fill = META_FILL
    for j, pid in enumerate(PERSONA_IDS):
        c = ws.cell(row=r, column=NMETA + 1 + j)
        c.border = BORDER
        c.alignment = CENTER
        if pid in row['personas']:
            c.value = TICK
            c.fill = TICK_FILL
            c.font = Font(size=11, bold=True, color='1B5E20')
        elif pid in row['restricted']:
            c.value = RESTRICTED_MARK
            c.fill = RESTRICTED_FILL
            c.font = Font(size=10, bold=True, color='8A5400')
    ws.row_dimensions[r].height = 30

ws.freeze_panes = ws.cell(row=3, column=NMETA + 1).coordinate
ws.auto_filter.ref = f'A2:{get_column_letter(NMETA)}{len(rows) + 2}'

# ============================================================ Sheet 2: legend
ls = wb.create_sheet('Legend & Method')
ls.column_dimensions['A'].width = 30
ls.column_dimensions['B'].width = 108

ls['A1'] = 'Persona × Feature Applicability Matrix'
ls['A1'].font = TITLE_FONT
ls['A2'] = ('SSOT for which persona can use which IMPLEMENTED feature of the VFQ DXP app. '
            'Generated from source — do not hand-edit.')
ls['A2'].font = SUB_FONT

r = 4

def section(title):
    global r
    ls.cell(row=r, column=1, value=title).font = Font(bold=True, size=13, color=VF_RED)
    r += 1

def kv(k, v):
    global r
    ls.cell(row=r, column=1, value=k).font = BOLD
    ls.cell(row=r, column=1).alignment = WRAP
    ls.cell(row=r, column=2, value=v).alignment = WRAP
    ls.row_dimensions[r].height = max(15, 14 * (len(v) // 95 + 1))
    r += 1

section('How to read a cell')
kv(TICK, 'APPLICABLE. This persona has positive, traceable evidence of access to this feature — '
         'either an rbac.json row on one of the feature\'s screens, or an explicit persona gate '
         'in application code. The "Applicability basis" column says which.')
kv(RESTRICTED_MARK, 'RESTRICTED. An rbac.json row exists for this persona, but its permission '
                    f'level is "{DENY_LEVEL}" with no allowed actions — the screen is listed for '
                    'the persona while permitting nothing on it (personaEngine\'s '
                    'canPerformAction() excludes that level from ACTION_LEVELS, so every action '
                    'check fails). Read it as "in scope but scoped down", not as full access. '
                    'Today this is only PERSONA-052 (Offshore Retailer / Channel Partner), '
                    'limited to its own orders and leads and explicitly excluded from org-wide '
                    'lead visibility — see RBAC-122/123/124.')
kv('(blank)', 'NO EVIDENCE — not a denial. The source corpus simply never established whether '
              'this persona uses this feature, and the app does not gate it. Do not read a blank '
              'cell as "this persona is blocked"; read it as "unknown / unstated". '
              'personaEngine.ts makes the same distinction, and deliberately treats absence as '
              '"not evidenced" rather than as "allow".')
r += 1

section('Applicability basis values')
kv('RBAC evidence', 'At least one row in public/config/rbac.json grants this persona access to a '
                    'screen belonging to this feature. Permission level(s) are shown alongside, '
                    'and the exact RBAC row ids are on the Feature Inventory sheet.')
kv('Code gate', 'Applicability is enforced in application code, not in rbac.json — see '
                'src/engines/agentPrivilegeEngine.ts and the inline activePersonaId checks in '
                'TicketDetail.tsx / TaskDetailView.tsx. These gates are grounded in personas.json '
                'name/type text because no confirmed privilege matrix exists (open items '
                'OI-AGN-06/11/13).')
kv('Not persona-gated', 'The feature is implemented but no RBAC row and no code gate references '
                        'any persona. At runtime any signed-in persona reaches it. Left blank '
                        'across the row rather than ticked for all 66, so the sheet never asserts '
                        'access the corpus did not establish.')
r += 1

section('Column headers')
kv('Row 1', 'Persona name, one per column, from public/config/personas.json.')
kv('Row 2', 'Persona id, plus the demo Staff ID where the persona is reachable at login.')
kv('Purple headers', f'The {len(LOGIN_REACHABLE)} personas reachable at login today via '
                     'staffIdRoleMap.ts. The other 59 are catalogued but cannot currently be '
                     'signed in as.')
r += 1

section('Scope')
kv('Features included', f'{len(rows)} implemented features '
                        f'({len(MODULE_FEATURES)} module features with registered screens, '
                        f'{len(WORKSPACE_FEATURES)} directly-routed workspace surfaces).')
kv('Screens covered', f'{len(IMPLEMENTED)} screen ids are registered via registerScreen() and so '
                      f'are genuinely built. routes.json catalogues {len(ROUTES)} screens in '
                      f'total; the remaining {len(ROUTES) - len(IMPLEMENTED)} fall back to '
                      '<ScreenNotYetBuilt> and are EXCLUDED from this matrix by design.')
kv('Personas included', f'All {len(PERSONA_IDS)} personas from personas.json. '
                        f'{len([1 for row in rows for p in row["personas"]]) and ""}'
                        'Columns with no ticks anywhere are expected: most personas hold no RBAC '
                        'row against an implemented feature.')
r += 1

section('ADDING_A_FEATURE — keeping this file the SSOT')
kv('1. Edit the script', 'reference/scripts/build_persona_feature_matrix.py. Add the feature to '
                         'MODULE_FEATURES if it registers SCR- ids, or WORKSPACE_FEATURES if it is '
                         'routed directly in router.tsx.')
kv('2. Set applicability', 'Pass a persona set only if code actually gates the feature. Otherwise '
                           'pass None and let rbac.json decide — never hand-tick a cell.')
kv('3. Regenerate', 'python3 reference/scripts/build_persona_feature_matrix.py')
kv('4. Never hand-edit the .xlsx', 'The next regeneration overwrites it. The script is the '
                                   'source; the workbook is the artefact.')
kv('Drift guard', 'The script re-reads the persona gate sets out of agentPrivilegeEngine.ts and '
                  'TicketDetail.tsx on every run and aborts if they no longer match its own '
                  'constants, so a code change cannot silently invalidate this matrix. It also '
                  'aborts if MODULE_FEATURES references a screen id that is no longer registered.')

# ============================================== Sheet 3: feature inventory
fs = wb.create_sheet('Feature Inventory')
inv_headers = ['Feature ID', 'Module / Area', 'Feature', 'Screen IDs', 'Applicability basis',
               'Personas with access', 'Personas restricted', 'Permission level(s) granted',
               'RBAC row refs', 'Notes']
widths = [11, 22, 40, 30, 17, 19, 18, 20, 34, 56]
for i, (h, w) in enumerate(zip(inv_headers, widths), start=1):
    c = fs.cell(row=1, column=i, value=h)
    c.fill = HEADER_FILL
    c.font = HEADER_FONT
    c.alignment = Alignment(wrap_text=True, vertical='center')
    c.border = BORDER
    fs.column_dimensions[get_column_letter(i)].width = w
fs.row_dimensions[1].height = 30

for r2, row in enumerate(rows, start=2):
    vals = [row['id'], row['area'], row['feature'], row['screens'], row['basis'],
            len(row['personas']), len(row['restricted']) or '', row['levels'],
            row['refs'], row['note']]
    for i, v in enumerate(vals, start=1):
        c = fs.cell(row=r2, column=i, value=v)
        c.alignment = WRAP if i not in (6, 7) else CENTER
        c.border = BORDER
        c.font = Font(size=10)
fs.freeze_panes = 'A2'
fs.auto_filter.ref = f'A1:J{len(rows) + 1}'

# ============================================== Sheet 4: persona coverage
ps = wb.create_sheet('Persona Coverage')
p_headers = ['Persona ID', 'Persona name', 'Type', 'Login Staff ID', 'Features applicable',
             'Features restricted', 'Has any RBAC row', 'Notes']
p_widths = [13, 62, 34, 14, 19, 19, 16, 46]
for i, (h, w) in enumerate(zip(p_headers, p_widths), start=1):
    c = ps.cell(row=1, column=i, value=h)
    c.fill = HEADER_FILL
    c.font = HEADER_FONT
    c.alignment = Alignment(wrap_text=True, vertical='center')
    c.border = BORDER
    ps.column_dimensions[get_column_letter(i)].width = w
ps.row_dimensions[1].height = 30

rbac_personas = {x['personaId'] for x in RBAC}
NO_RBAC_AT_ALL = {'PERSONA-013', 'PERSONA-045', 'PERSONA-053', 'PERSONA-054', 'PERSONA-055'}

for r3, pid in enumerate(PERSONA_IDS, start=2):
    p = PERSONA_BY_ID[pid]
    n = sum(1 for row in rows if pid in row['personas'])
    nr = sum(1 for row in rows if pid in row['restricted'])
    note = ''
    if pid in NO_RBAC_AT_ALL:
        note = 'No RBAC entries anywhere — tracked as an open item (RBAC-OI-*) in rbac-matrix.md'
    elif pid in NON_AGENT:
        note = 'Not an internal VFQ agent — excluded from agent-profile / customer-edit gates'
    vals = [pid, p['name'], p['type'], LOGIN_REACHABLE.get(pid, ''), n, nr or '',
            'Yes' if pid in rbac_personas else 'No', note]
    for i, v in enumerate(vals, start=1):
        c = ps.cell(row=r3, column=i, value=v)
        c.alignment = WRAP if i in (2, 3, 8) else CENTER
        c.border = BORDER
        c.font = Font(size=10)
        if i == 4 and v:
            c.fill = PatternFill('solid', fgColor='EDE7F6')
            c.font = Font(size=10, bold=True)
ps.freeze_panes = 'A2'
ps.auto_filter.ref = f'A1:H{len(PERSONA_IDS) + 1}'

# ------------------------------------------------------------------- provenance
try:
    sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=APP_ROOT,
                         capture_output=True, text=True).stdout.strip() or 'unknown'
except Exception:
    sha = 'unknown'
ls.cell(row=r + 1, column=1, value='Generated from commit').font = BOLD
ls.cell(row=r + 1, column=2,
        value=f'{sha} — regenerate with: python3 reference/scripts/build_persona_feature_matrix.py')

wb.save(OUT)

ticks = sum(len(row['personas']) for row in rows)
marks = sum(len(row['restricted']) for row in rows)
gated = sum(1 for row in rows if row['personas'] or row['restricted'])
print(f'Wrote {OUT}')
print(f'  features: {len(rows)}  (module {len(MODULE_FEATURES)} / workspace {len(WORKSPACE_FEATURES)})')
print(f'  personas: {len(PERSONA_IDS)} columns, {len(LOGIN_REACHABLE)} login-reachable')
print(f'  {TICK} applicable: {ticks}   {RESTRICTED_MARK} restricted: {marks}')
print(f'  features with evidence: {gated}; without: {len(rows) - gated}')
print(f'  implemented screens: {len(IMPLEMENTED)} of {len(ROUTES)} catalogued')
