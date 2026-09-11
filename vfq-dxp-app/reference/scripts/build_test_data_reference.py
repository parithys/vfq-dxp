import json
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Regenerate with: python3 reference/scripts/build_test_data_reference.py
# (run from anywhere — paths are resolved relative to this script's location,
# i.e. <repo>/vfq-dxp-app/reference/scripts/../.. )
APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(APP_ROOT, 'public', 'mock-data')
CONF = os.path.join(APP_ROOT, 'public', 'config')

def load(name, base=DATA):
    with open(f'{base}/{name}.json') as f:
        return json.load(f)

wb = Workbook()

HEADER_FILL = PatternFill('solid', fgColor='E60000')
HEADER_FONT = Font(color='FFFFFF', bold=True)
TITLE_FONT = Font(bold=True, size=16, color='E60000')
SUBTITLE_FONT = Font(size=11, color='555555', italic=True)
NOTE_FONT = Font(size=10, color='7A5C00')
NOTE_FILL = PatternFill('solid', fgColor='FFF6DC')
WRAP = Alignment(wrap_text=True, vertical='top')
THIN = Side(style='thin', color='DDDDDD')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

def style_header(ws, row, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = 28

def write_table(ws, start_row, headers, rows, col_widths=None):
    for i, h in enumerate(headers, start=1):
        ws.cell(row=start_row, column=i, value=h)
    style_header(ws, start_row, len(headers))
    for r, row_data in enumerate(rows, start=start_row + 1):
        for c, val in enumerate(row_data, start=1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.alignment = WRAP
            cell.border = BORDER
        ws.row_dimensions[r].height = 30
    if col_widths:
        for i, w in enumerate(col_widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=start_row + 1, column=1).coordinate

def title_block(ws, title, subtitle, note=None):
    ws['A1'] = title
    ws['A1'].font = TITLE_FONT
    ws.merge_cells('A1:F1')
    ws['A2'] = subtitle
    ws['A2'].font = SUBTITLE_FONT
    ws.merge_cells('A2:F2')
    row = 4
    if note:
        ws.cell(row=row, column=1, value=note)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
        cell = ws.cell(row=row, column=1)
        cell.font = NOTE_FONT
        cell.fill = NOTE_FILL
        cell.alignment = WRAP
        ws.row_dimensions[row].height = 45
        row += 2
    return row

# ---------------------------------------------------------------------------
# Sheet 0: Overview
# ---------------------------------------------------------------------------
ws = wb.active
ws.title = 'Start Here'
ws['A1'] = 'VFQ DXP — Test Data Reference'
ws['A1'].font = Font(bold=True, size=20, color='E60000')
ws.merge_cells('A1:D1')
ws['A2'] = 'Every value below is real seed data from public/mock-data and public/config — nothing here is invented. Use it to log in and exercise each screen.'
ws['A2'].font = SUBTITLE_FONT
ws.merge_cells('A2:D2')

overview_rows = [
    ('Login Credentials', 'Staff ID + password to sign in, and which agent identity each one resolves to.'),
    ('Customer Search', 'Every value that matches on the Customer Search page — mobile, QID, customer #, account #, name, email, service ID.'),
    ('Accounts & Services', 'Account IDs and Service IDs behind each customer, for the account-number / service-ID search fields.'),
    ('Orders & Approval Queue', 'Existing orders, how to generate a fresh one that lands in the Approval Queue, the approval matrix, and reject reasons.'),
    ('Agent Task View', 'Seeded tasks and which agent identity each is assigned to, for testing per-agent task scoping.'),
    ('Trouble Tickets', 'Seeded tickets for the Support workspace.'),
    ('Bell Notifications', 'Seeded notifications per customer, for the Customer 360 banner and Administration config screen.'),
    ('Bulk Notes', 'Seeded bulk notes and the accounts they were posted against.'),
    ('Leads (Sales)', 'Seeded leads for the Sales workspace.'),
    ('Postpaid Plans & Discounts', 'The RED plan tiers and eligible discounts shown on the New Postpaid Activation wizard\'s redesigned Plan & Add-ons step.'),
    ('Number Selection', 'Seeded MSISDN inventory plus how to test the Manual MSISDN Entry card\'s valid/blocked/malformed paths.'),
    ('Verification Codes', 'The demo password and OTP/verification code used everywhere a code is required (password reset, MFA, change password).'),
]
r = 4
ws.cell(row=r, column=1, value='Sheet').font = Font(bold=True)
ws.cell(row=r, column=2, value='What it covers').font = Font(bold=True)
style_header(ws, r, 2)
for i, (name, desc) in enumerate(overview_rows, start=r + 1):
    ws.cell(row=i, column=1, value=name).border = BORDER
    d = ws.cell(row=i, column=2, value=desc)
    d.border = BORDER
    d.alignment = WRAP
    ws.row_dimensions[i].height = 30
ws.column_dimensions['A'].width = 26
ws.column_dimensions['B'].width = 95

# ---------------------------------------------------------------------------
# Sheet 1: Login Credentials
# ---------------------------------------------------------------------------
ws = wb.create_sheet('Login Credentials')
note = ('Password is the SAME for every Staff ID: Vodafone@123 (placeholder — real VFQ credentials are not confirmed, '
        'see D-02/OI-AGN-04). "Resulting agent identity" is who you actually become after login (name/job title/team) — '
        'it is looked up from users-agents.json by matching keywords in the persona name, NOT the Staff ID itself, so two '
        'Staff IDs can log you in as the same person. VFQ12343 and VFQ12344 both match on the word "Manager" and both '
        'resolve to Rachel Thompson — this is a real quirk of the matching logic (src/engines/agentProfileEngine.ts), not a typo here.')
row = title_block(ws, 'Login Credentials', 'src/auth/staffIdRoleMap.ts + src/engines/agentProfileEngine.ts', note)

login_rows = [
    ('VFQ12341', 'Vodafone@123', 'Retail Agent', 'Fatima Al-Kuwari', 'Sales Agent', 'Retail Sales', 'USR-1101', 'Default frontline agent. Use for: Customer Search, Task View as an agent with assigned tasks, claiming un-role-gated approval items.'),
    ('VFQ12342', 'Vodafone@123', 'Back Office / Fulfilment', 'Omar Hassan', 'Back Office Fulfilment Agent', 'Order Fulfilment', 'USR-1102', 'Use for: approving "New Postpaid Activation" B2B2C orders (approval matrix requires this exact role).'),
    ('VFQ12343', 'Vodafone@123', 'Manager / Approver', 'Rachel Thompson', 'Sales Manager', 'Sales Management', 'USR-1103', 'Use for: approving "MNP Postpaid Port-In" orders (approval matrix requires this exact role); assigning tasks to team members (supervisor-only action).'),
    ('VFQ12344', 'Vodafone@123', 'Enterprise Account Manager', 'Rachel Thompson', 'Sales Manager', 'Sales Management', 'USR-1103', 'Resolves to the SAME identity as VFQ12343 (see note above) — role label shown at login differs, but the signed-in agent is identical.'),
    ('VFQ12345', 'Vodafone@123', 'Field Technician', 'Fatima Al-Kuwari', 'Sales Agent', 'Retail Sales', 'USR-1101', 'Falls back to the default agent — no seeded field-technician identity exists in users-agents.json.'),
    ('VFQ12346', 'Vodafone@123', 'IT Operations', 'Fatima Al-Kuwari', 'Sales Agent', 'Retail Sales', 'USR-1101', 'Falls back to the default agent — no seeded IT-ops identity exists in users-agents.json.'),
    ('anything else', 'any value', '—', '—', '—', '—', '—', 'Login is rejected with "Staff ID not recognised." — only the 6 Staff IDs above are recognised.'),
    ('any of the above', 'wrong password', '—', '—', '—', '—', '—', 'Login is rejected with "Incorrect password." — use this to test the login failure state.'),
]
write_table(ws, row,
    ['Staff ID', 'Password', 'Role label shown at login', 'Resulting agent name', 'Resulting job title', 'Resulting team', 'Resulting userId', 'What to test with it'],
    login_rows,
    [16, 14, 24, 20, 26, 18, 16, 60])

# ---------------------------------------------------------------------------
# Sheet 2: Customer Search
# ---------------------------------------------------------------------------
customers = load('customers')
ws = wb.create_sheet('Customer Search')
note = ('Customer Search matches on: Mobile, QID/Passport, Customer #, Name, and Email directly against the fields below '
        '(partial, case-insensitive match — typing part of a value works, e.g. "28512" matches Ahmed\'s mobile). '
        'Account # and Service ID are matched separately — see the "Accounts & Services" sheet for those values. '
        '(src/engines/customer360Engine.ts)')
row = title_block(ws, 'Customer Search', 'public/mock-data/customers.json', note)

cust_rows = []
for c in customers:
    cust_rows.append((
        c.get('customerId'), c.get('qid'), c.get('idType'), c.get('name'), c.get('phone'), c.get('email'),
        c.get('segment'), 'Yes' if c.get('blacklisted') else 'No',
        'Yes' if c.get('hrnAdvancePaymentRequired') else 'No',
    ))
# Notes per interesting customer
special_notes = {
    'CUST-1001': 'Plain consumer, no special flags — baseline happy-path customer.',
    'CUST-1002': 'HRN customer (High Risk Nationality) — triggers the advance-payment eligibility gate and routes new postpaid orders to the Approval Queue.',
    'CUST-1003': 'Plain consumer with an existing Fixed Line (GigaHome) account — has an installed asset/Service ID.',
    'CUST-1004': 'Blacklisted = true — use to test the blacklist rejection path in the eligibility gate.',
    'CUST-2001': 'Enterprise (EBU) contact — has both a parent and a sub-account.',
    'CUST-1005': 'Consumer with a UAE passport-style QID, no seeded account/orders.',
    'CUST-1006': 'Diplomatic ID holder, no seeded account/orders.',
    'CUST-9001': 'Generic QA test user, no seeded account/orders.',
}
headers = ['Customer ID', 'QID / Passport', 'ID Type', 'Name', 'Mobile', 'Email', 'Segment', 'Blacklisted?', 'HRN advance payment required?', 'Notes']
rows_with_notes = []
for r_, c in zip(cust_rows, customers):
    rows_with_notes.append(r_ + (special_notes.get(c.get('customerId'), ''),))
write_table(ws, row, headers, rows_with_notes, [14, 20, 12, 24, 16, 30, 18, 14, 14, 60])

# ---------------------------------------------------------------------------
# Sheet 3: Accounts & Services
# ---------------------------------------------------------------------------
accounts = load('accounts')
assets = load('installed-assets')
ws = wb.create_sheet('Accounts & Services')
note = ('"Account #" and "Service ID" are two more Customer Search fields — try these values there too. Only the '
        'customers/accounts listed here have a seeded account; the rest (CUST-1004/1005/1006/9001) have none.')
row = title_block(ws, 'Accounts & Services', 'public/mock-data/accounts.json + installed-assets.json', note)

acc_by_id = {a['accountId']: a for a in accounts}
asset_by_acc = {}
for a in assets:
    asset_by_acc.setdefault(a['accountId'], []).append(a)

acc_rows = []
for a in accounts:
    svc = asset_by_acc.get(a['accountId'], [])
    svc_ids = ', '.join(s.get('serviceId', '') for s in svc) or '—'
    svc_desc = ', '.join(s.get('productServiceName', '') for s in svc) or '—'
    acc_rows.append((a.get('accountId'), a.get('customerId'), a.get('accountType'), a.get('status'), svc_ids, svc_desc))

write_table(ws, row,
    ['Account #', 'Customer ID', 'Account Type', 'Status', 'Service ID(s)', 'Service description'],
    acc_rows, [14, 14, 30, 12, 18, 34])

# ---------------------------------------------------------------------------
# Sheet 4: Orders & Approval Queue
# ---------------------------------------------------------------------------
orders = load('orders')
reject_reasons = load('reject-reasons')
matrix = json.load(open(f'{CONF}/approval-matrix.json'))
ws = wb.create_sheet('Orders & Approval Queue')
note = ('The Approval Queue is EMPTY by default — none of the 5 seeded orders are in "Submitted for Approval" status. '
        'To populate it: run the New Postpaid Activation, New Fixed Line, New FWA, or MNP Port-In wizard (Sales workspace) '
        'and tick the "B2B2C order" checkbox on the contact step — all four wizards now write an order-type string that '
        'matches an approval-matrix category (New Postpaid Activation / New Fixed Line Activation / New FWA Postpaid '
        'Outdoor Order / MNP Postpaid Port-In), so the role gate applies to all of them. Note the two seeded historical '
        'orders ORD-90003/ORD-90004 use slightly different order-type strings ("New FWA 5G Outdoor Activation" / "New '
        'Fixed Line - Triple Play") than the matrix — that is harmless since both are already Complete/Open and never '
        're-enter the approval flow, but do not use those exact strings as a template if you are hand-editing an order '
        'into "Submitted for Approval" for testing; use the wizard-created strings shown in the matrix below instead. '
        'For MNP specifically: only a B2B2C Port-In goes to approval — a Consumer/HRN Port-In (the evidenced UJ-069 case) '
        'still lands in status "Pending" as before, since that reflects a real port request awaiting the donor operator, '
        'not a B2B2C order awaiting manager sign-off. Also: CUST-1002 (HRN) will trigger the advance-payment gate on the '
        'New Postpaid wizard, which independently sets the order to Submitted for Approval regardless of the B2B2C '
        'checkbox.')
row = title_block(ws, 'Orders & Approval Queue', 'public/mock-data/orders.json + public/config/approval-matrix.json', note)

order_rows = [(o.get('orderId'), o.get('orderType'), o.get('orderSubType'), o.get('status'), o.get('approvalStatus'), o.get('customerId')) for o in orders]
row = write_table(ws, row,
    ['Order #', 'Order Type', 'Sub-Type', 'Status', 'Approval Status', 'Customer ID'],
    order_rows, [14, 26, 14, 14, 20, 14]) or row

next_row = row + len(order_rows) + 3
ws.cell(row=next_row, column=1, value='Configured Approval Matrix (AAV-01)').font = Font(bold=True, size=13, color='E60000')
next_row += 1
ws.cell(row=next_row, column=1, value='Placeholder mapping — the BRSD does not specify real category/role content; see public/config/approval-matrix.json for the source.').font = NOTE_FONT
next_row += 2
matrix_rows = [(m['category'], m['requiredRole']) for m in matrix]
write_table(ws, next_row, ['Order Category', 'Role required to approve'], matrix_rows, [30, 30])

next_row2 = next_row + len(matrix_rows) + 3
ws.cell(row=next_row2, column=1, value='Reject Reasons').font = Font(bold=True, size=13, color='E60000')
next_row2 += 2
reason_rows = [(r_.get('reasonCode'), r_.get('reasonLabel')) for r_ in reject_reasons]
write_table(ws, next_row2, ['Reason Code', 'Reason Label'], reason_rows, [22, 44])

# ---------------------------------------------------------------------------
# Sheet 5: Agent Task View
# ---------------------------------------------------------------------------
tasks = load('tasks')
ws = wb.create_sheet('Agent Task View')
note = ('Tasks with no assigned agent (blank below) are visible to every logged-in agent. Tasks assigned to a specific '
        'userId are ONLY visible to that agent — log in as USR-1101 (Fatima, Staff ID VFQ12341) vs USR-1102 (Omar, '
        'VFQ12342) to see the difference (ATV-02 per-agent scoping). Log in as VFQ12343/12344 (Rachel, Sales Manager) to '
        'test assigning an unassigned task to a team member — that control only appears for the Manager persona.')
row = title_block(ws, 'Agent Task View', 'public/mock-data/tasks.json', note)
task_rows = [(t.get('taskId'), t.get('taskName'), t.get('taskType'), t.get('taskStatus'), 'Yes' if t.get('priorityFlag') else 'No', t.get('assignedAgentId') or '(unassigned — visible to everyone)') for t in tasks]
write_table(ws, row,
    ['Task ID', 'Task Name', 'Type', 'Status', 'Priority?', 'Assigned to (userId)'],
    task_rows, [14, 34, 14, 14, 12, 34])

# ---------------------------------------------------------------------------
# Sheet 6: Trouble Tickets
# ---------------------------------------------------------------------------
tickets = load('trouble-tickets')
ws = wb.create_sheet('Trouble Tickets')
row = title_block(ws, 'Trouble Tickets', 'public/mock-data/trouble-tickets.json',
                   'Support workspace — open TT-40001 for CUST-1001 to test an open ticket, TT-40002 for a resolved one.')
ticket_rows = [(t.get('ticketId'), t.get('customerId'), t.get('status'), t.get('category'), t.get('actualIssue', ''), t.get('priority', ''), t.get('queue', '')) for t in tickets]
write_table(ws, row, ['Ticket ID', 'Customer ID', 'Status', 'Category', 'Issue', 'Priority', 'Queue'], ticket_rows, [14, 14, 14, 22, 30, 12, 18])

# ---------------------------------------------------------------------------
# Sheet 7: Bell Notifications
# ---------------------------------------------------------------------------
bells = load('bell-notifications')
ws = wb.create_sheet('Bell Notifications')
note = ('Open Customer 360 for the Customer IDs below to see the banner (Published + not yet expired only — Drafts and '
        'already-expired ones are hidden from the agent-facing banner, only visible on the Administration > Bell '
        'Notifications config screen). BELL-8004 is already past its expiry date and will show as "Expired" there.')
row = title_block(ws, 'Bell Notifications', 'public/mock-data/bell-notifications.json', note)
bell_rows = [(b.get('notificationId'), b.get('customerId'), b.get('status'), b.get('expiresAt') or '—', b.get('message', '')) for b in bells]
write_table(ws, row, ['Notification ID', 'Customer ID', 'Status', 'Expires At', 'Message'], bell_rows, [16, 14, 12, 26, 55])

# ---------------------------------------------------------------------------
# Sheet 8: Bulk Notes
# ---------------------------------------------------------------------------
notes = load('bulk-notes')
ws = wb.create_sheet('Bulk Notes')
row = title_block(ws, 'Bulk Notes', 'public/mock-data/bulk-notes.json',
                   'Open any account listed below in Customer 360 > Bulk Notes tab to see the note.')
note_rows = [(n.get('noteId'), ', '.join(n.get('accountIds', [])), n.get('postedAt'), n.get('content', '')) for n in notes]
write_table(ws, row, ['Note ID', 'Posted to Account(s)', 'Posted At', 'Content'], note_rows, [14, 30, 22, 60])

# ---------------------------------------------------------------------------
# Sheet 9: Leads
# ---------------------------------------------------------------------------
leads = load('leads')
ws = wb.create_sheet('Leads (Sales)')
row = title_block(ws, 'Leads (Sales workspace)', 'public/mock-data/leads.json', None)
lead_rows = [(l.get('leadId'), l.get('serviceNeeded'), l.get('status'), l.get('ownerId'), l.get('mobileNumber') or '—', l.get('callbackDate') or '—') for l in leads]
write_table(ws, row, ['Lead ID', 'Service Needed', 'Status', 'Owner (agent ID)', 'Mobile', 'Callback Date'], lead_rows, [14, 18, 20, 20, 18, 16])

# ---------------------------------------------------------------------------
# Sheet: New Postpaid Plans & Discounts
# ---------------------------------------------------------------------------
products = load('products')
addons_discounts = load('addons-discounts')
ws = wb.create_sheet('Postpaid Plans & Discounts')
note = ('Redesigned "Plan & Add-ons" step (New Postpaid Activation wizard only — Fixed Line/FWA/MNP/Pre-to-Post still use '
        'the original single-column ProductPlanStep and are unaffected). Plan names follow the evidenced "Postpaid Red '
        '<price> Promotion" naming family (Pre-to-Post guided-journey Plan step); the specific data/speed values per '
        'tier are representative demo catalogue entries, same as the rest of products.json. Discounts reuse the '
        'Loyalty Discount concept/rate already evidenced in addons-discounts.json (ADO-7103) rather than inventing new '
        'discount types.')
row = title_block(ws, 'Postpaid Plans & Discounts', 'public/mock-data/products.json + addons-discounts.json', note)
plan_rows = [
    (p.get('productId'), p.get('name'), p.get('mrcQAR'), p.get('dataAllowanceGB') or 'Unlimited', p.get('minutesAllowance'),
     p.get('speedTier'), 'Yes' if p.get('popular') else '')
    for p in products if p.get('type') == 'Postpaid Plan'
]
row = write_table(ws, row, ['Product ID', 'Plan Name', 'MRC (QAR)', 'Data', 'Voice', 'Speed', 'Popular?'], plan_rows, [12, 32, 12, 14, 20, 16, 12]) or row

next_row = row + len(plan_rows) + 3
ws.cell(row=next_row, column=1, value='Eligible Discounts (per plan)').font = Font(bold=True, size=13, color='E60000')
next_row += 2
disc_rows = [(d.get('addonDiscountId'), d.get('planId'), d.get('name'), f"{round(d.get('price', 0) * 100)}%", d.get('description')) for d in addons_discounts if d.get('category') == 'Discount']
write_table(ws, next_row, ['Discount ID', 'Applies to Product ID', 'Name', 'Rate', 'Description'], disc_rows, [14, 18, 20, 10, 44])

# ---------------------------------------------------------------------------
# Sheet 10: Verification Codes
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Sheet: Number Selection
# ---------------------------------------------------------------------------
numbers = load('numbers')
ws = wb.create_sheet('Number Selection')
note = ('The Number Selection step (New Postpaid/Fixed Line/FWA wizards) also has a "Manual MSISDN Entry" card below '
        'the grid for reserving any MSISDN not in the seeded inventory below — type a full +974-prefixed 8-digit '
        'number (e.g. +974 3300 9999) and click "Reserve Custom Number". To test its rejection paths: type '
        '+97433001003 (seeded as Blocked below) to see the "already blocked" error, or an incomplete/malformed number '
        'to see the format error.')
row = title_block(ws, 'Number Selection', 'public/mock-data/numbers.json', note)
number_rows = [(n.get('msisdn'), n.get('category'), n.get('status'), n.get('priceQAR'), n.get('valueTier') or '—') for n in numbers]
write_table(ws, row, ['MSISDN', 'Category', 'Status', 'Price (QAR)', 'Value Tier'], number_rows, [18, 12, 14, 14, 14])

# ---------------------------------------------------------------------------
# Sheet 10: Verification Codes
# ---------------------------------------------------------------------------
ws = wb.create_sheet('Verification Codes')
note = ('These are placeholder demo values (the BRSD leaves the real password policy and OTP mechanism open — '
        'OI-AGN-04/05/06, D-02) — they are not real VFQ credentials, just what this mock build checks against.')
row = title_block(ws, 'Passwords & Verification Codes', 'src/auth/staffIdRoleMap.ts, src/auth/ForgotPasswordFlow.tsx, src/workspace/profile/AgentProfileWorkspace.tsx', note)
code_rows = [
    ('Login password', 'Vodafone@123', 'Same for every Staff ID on the Login screen.'),
    ('Forgot Password — verification code', '123456', 'Sent after entering a Staff ID in the Forgot Password flow.'),
    ('Change Password (Agent Profile) — verification code', '123456', 'Required alongside current password to change password from the Profile screen.'),
    ('Enable MFA — verification code', '123456', 'Required to confirm enabling MFA from the Profile screen.'),
    ('New password policy', '(free text, min 8 chars, ≥1 letter, ≥1 number)', 'Applies to both Forgot Password reset and in-session Change Password.'),
]
write_table(ws, row, ['Where it is used', 'Value to enter', 'Notes'], code_rows, [42, 40, 55])

for name in wb.sheetnames:
    wb[name].sheet_view.showGridLines = False

out_path = os.path.join(APP_ROOT, 'reference', 'VFQ_DXP_Test_Data_Reference.xlsx')
wb.save(out_path)
print('Saved:', out_path)
