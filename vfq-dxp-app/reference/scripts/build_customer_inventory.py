#!/usr/bin/env python3
"""Generate reference/outputs/Customer-Inventory.xlsx - the test-customer inventory.

Two kinds of row. "In app - original" rows are PARSED from public/mock-data
(customers.json, identity-documents.json, nas-records.json, ...). "In app -
added" rows are defined in PROPOSED below and written into public/mock-data by
`--seed` (idempotent: existing ids are skipped). Run `--seed` first, then run
without flags to (re)generate the workbook.

Role / feature-grant data is parsed from public/config/personas.json; the demo
password from src/auth/staffIdRoleMap.ts. Nothing is hand-typed twice.

Run:  python3 reference/scripts/build_customer_inventory.py --seed   # once / after editing PROPOSED
      python3 reference/scripts/build_customer_inventory.py          # workbook
"""
import json, re, sys
from datetime import date
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

APP = Path(__file__).resolve().parents[2]
MOCK = APP / "public" / "mock-data"
OUT = APP / "reference" / "outputs" / "Customer-Inventory.xlsx"
AS_OF = date(2026, 10, 2)
SEED_TAG = "Customer-Inventory seed (2026-10-02)"
ORIG, ADDED = "In app - original", "In app - added 2026-10-02"


def load(name):
    return json.loads((MOCK / f"{name}.json").read_text())


customers = {c["customerId"]: c for c in load("customers")}
docs = load("identity-documents")
nas = load("nas-records")
accounts = {a["customerId"]: a for a in load("accounts")}
personas = json.loads((APP / "public/config/personas.json").read_text())
password = re.search(r"DEMO_LOGIN_PASSWORD\s*=\s*'([^']+)'", (APP / "src/auth/staffIdRoleMap.ts").read_text()).group(1)
retiree_ids = set(load("govt-retiree-registry")["retiredIdNumbers"])


def age(dob):
    y, m, d = map(int, dob.split("-"))
    return AS_OF.year - y - ((AS_OF.month, AS_OF.day) < (m, d))


# --------------------------------------------------------------------------
# Scenario annotations for the SEEDED records (keyed by customerId / NAS id).
# Only scenario text lives here - every data field comes from the JSON.
# --------------------------------------------------------------------------
SEED = {
    "CUST-1001": dict(cat="1 Qatari postpaid", scen="Qatari, 1 active postpaid line, existing customer (loyalty-eligible). Registry-retiree ID. Has a pending disconnection penalty (PEN-8101) and a ported-in line (MNP-11003).",
        disc="Loyalty (existing customer); Retired (scan ID 28456701234 is in the govt retiree registry)", mnp="Port-in history MNP-11003 (QTEL, postpaid); port-out POUT-17001 accepted",
        journeys="New Postpaid (add 2nd line); Customer 360; commitment-penalty view; port-out", expected="Eligibility: all 7 checks pass. Line cap: 1/5 (Qatari). Loyalty -15% offered on Red plans. Retired check passes only on the scan ID, not the customers.json QID.",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
    "CUST-1002": dict(cat="3 Discounts & eligibility", scen="Nepalese expat on a Passport, sponsored by Acme Trading (B2B2C employee). NOT HRN (Nepal is not on the VFQ list - was HRN before 2026-10-02). 1 postpaid + 1 prepaid; partially barred (overdue); promise-to-pay active.",
        disc="B2B2C (employer Acme Trading Qatar W.L.L., CONT-3001, plan Postpaid Extra Promotion)", mnp="MNP-11002 port-in submitted to NPASS; port-out POUT-17002 auto-rejected (name mismatch, code 4)",
        journeys="New Connection (B2B2C route); MNP; Customer 360 barring view", expected="Passport -> exception-routed to CBM approval (ID Type check). No HRN advance (non-HRN; credit limit 1,000). Prepaid cap 2 (has 1: pass-at-edge). B2B2C order -> Submitted for Approval, Proof of Employment mandatory (BR-169/263).",
        jk=["workspace.customer-search", "mnp.port-in-wizard"]),
    "CUST-1003": dict(cat="5 Existing - no mobile line", scen="Qatari with a GigaHome fixed-line account only (0 mobile lines). Existing customer, two draft orders, FNP port-in in progress.",
        disc="Loyalty (existing customer)", mnp="FNP-12001 (Ooredoo donor validation); POUT-17003 FNP conditional accept",
        journeys="New Postpaid for an existing fixed-line customer; Fixed Line; FNP", expected="Identifies as EXISTING customer even with 0 active lines. All eligibility checks pass.",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
    "CUST-1004": dict(cat="6 Eligibility gates", scen="Qatari, collections-blacklisted (outstanding dues above threshold). Postpaid blocked, prepaid still offered.",
        disc="None", mnp="MNP-11002 donor conditional-accept (billed due over QAR 100)", journeys="New Postpaid (soft-stop); New Prepaid; MNP",
        expected="Collections Check = soft-stop: 'Postpaid cannot be issued. Prepaid is available on this QID.' (BR-113: blacklist only, never the balance).",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
    "CUST-2001": dict(cat="3 Discounts & eligibility", scen="Enterprise employer contact (Acme Trading), EBU segment, 'Other ID'. Owns the FWA 5G order and the B2B2C employer account.",
        disc="N/A - this is the employer, not a sponsored consumer", mnp="FNP-12002 conditional acceptance (QAR 245.50 due)", journeys="Enterprise / Business Care; FWA; Customer 360",
        expected="Other ID is exception-routed. Penalty PEN-8102 blocksNewConnection=true -> Deals Check hard-stop on new connections.",
        jk=["workspace.customer-search", "workspace.customer360-view"]),
    "CUST-1005": dict(cat="2 Expat postpaid (GCC)", scen="Emirati (GCC ID), 2 postpaid + 2 prepaid lines.",
        disc="None", mnp="-", journeys="New Postpaid; New Prepaid", expected="GCC ID is exception-routed (CBM approval). Postpaid: non-Qatari with 2 lines -> BR-288 cap reached -> approval task. Prepaid: GCC cap 2, has 2 -> blocked (BR-347).",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
    "CUST-1006": dict(cat="6 Eligibility gates", scen="French diplomat, Diplomatic ID EXPIRED 2025-08-31, security-blacklisted.",
        disc="None", mnp="-", journeys="Any new connection", expected="ID Validity hard-stop (expired) AND Security Check hard-stop. No agent override.",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
    "CUST-9001": dict(cat="6 Eligibility gates", scen="QA test user, Qatari, age 16 (under 18). Holds both a QID and a Passport document.",
        disc="None", mnp="-", journeys="Any new connection", expected="Age Check = HARD STOP for an under-18 applicant (2026-10-02): the connection cannot proceed.",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
    "CUST-1007": dict(cat="6 Eligibility gates", scen="Swedish resident whose customers.json idType is QID but whose only document is a valid Diplomatic ID (to 2030-04-30).",
        disc="None", mnp="-", journeys="New Postpaid", expected="Document type governs: Diplomatic ID is exception-routed to CBM approval.",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard"]),
}
SEED_NAS = {
    "NAS-7001": dict(cat="4 New customer / MNP", scen="NOT a Vodafone customer (NAS identity record only). Qatari, valid QID. Canonical 'new customer' + port-in-as-new-connection candidate.",
        disc="None until becoming a customer", mnp="Port-in candidate from Ooredoo/QTEL", journeys="New Postpaid; Port-In as New Connection; New Prepaid",
        expected="Contact step shows masked NAS email; ID lookup resolves with no customerId -> NOT an existing customer.",
        jk=["workspace.customer-search", "postpaid.new-postpaid-wizard", "mnp.port-in-wizard"]),
}

# --------------------------------------------------------------------------
# Customer names: (first, middle, last). Middle = EVERY name between the first
# and the family name (may be several), per VFQ's naming convention. `name` in
# the data is always " ".join of the three. Single source for the app data
# (applied by --seed) and for the workbook.
# --------------------------------------------------------------------------
NAMES = {
    # original demo customers
    "CUST-1001": ("Ahmed", "Abdulla Hassan", "Al-Sulaiti"),
    "CUST-1002": ("Bimal", "Bahadur", "Thapa"),
    "CUST-1003": ("Fatima", "Saud Hamad", "Al-Kuwari"),
    "CUST-1004": ("Mohammed", "Rashid Khalid", "Al-Emadi"),
    "CUST-2001": ("Layla", "Hassan Ibrahim", "Al-Naimi"),
    "CUST-1005": ("Khalid", "Saeed Rashid", "Al-Mazrouei"),
    "CUST-1006": ("Sophie", "Marie", "Laurent"),
    "CUST-9001": ("Rashid", "Nasser Hamad", "Al-Naimi"),
    "CUST-1007": ("Henrik", "Lars", "Lindqvist"),
    "NAS-7001": ("Noora", "Abdulrahman Saeed", "Al-Mannai"),
    # added by the inventory
    "CUST-3001": ("Hamad", "Jassim Hamad", "Al-Thani"),
    "CUST-3002": ("Maryem", "Rashid Hamad Jassim", "Al-Kuwari"),
    "CUST-3003": ("Jassim", "Rashid Nasser", "Al-Marri"),
    "CUST-3004": ("Faisal", "Mansoor Khalid Abdullah", "Al-Marri"),
    "CUST-3011": ("Rajesh", "Kumar", "Pillai"),
    "CUST-3012": ("Maria", "Cristina Santos", "Reyes"),
    "CUST-3013": ("Ahmed", "Fathy Ibrahim", "El-Sayed"),
    "CUST-3014": ("Sunil", "Chandana Kumara", "Perera"),
    "CUST-3015": ("Hasan", "Mahmoud Ali", "Al-Khatib"),
    "CUST-3016": ("Wei", "Ming", "Chen"),
    "CUST-3017": ("Peter", "Kamau", "Mwangi"),
    "CUST-3021": ("Salma", "Nasser Khalifa", "Al-Kuwari"),
    "CUST-3022": ("Abdullah", "Khalid Mansoor", "Al-Kuwari"),
    "CUST-3023": ("Hussain", "Ali Mubarak", "Al-Dosari"),
    "CUST-3024": ("Nasser", "Mohammed Saad", "Al-Hajri"),
    "CUST-3025": ("Priya", "Suresh", "Nair"),
    "CUST-3026": ("Imran", "Ahmed Khan", "Qureshi"),
    "CUST-3027": ("Fahad", "Saeed Ali", "Al-Ansari"),
    "CUST-3028": ("Karim", "Elias Youssef", "Haddad"),
    "CUST-3029": ("Fatima", "Hassan Ali", "Al-Marri"),
    "CUST-3031": ("Dina", "Abdulaziz Khalid", "Al-Mahmoud"),
    "CUST-3032": ("Lakshmi", "Venkat", "Iyer"),
    "CUST-3033": ("Tariq", "Mahmood Aziz", "Malik"),
    "CUST-3041": ("Omar", "Samer Khalil", "Al-Hamwi"),
    "CUST-3042": ("Nadia", "Hany Farouk", "Mansour"),
    "CUST-3043": ("Ravi", "Shankar", "Menon"),
    "CUST-3044": ("Saeed", "Abdullah Nasser", "Al-Mohannadi"),
    "CUST-3045": ("Eva", "Maria", "Mueller"),
    "CUST-3046": ("Bilal", "Ahmed Raza", "Siddiqui"),
    "CUST-3051": ("Tamer", "Mahmoud Hosni", "Abdelaziz"),
    "CUST-3052": ("Aisha", "Mohammed", "Al-Suwaidi"),
    "CUST-3053": ("Faisal", "Hamad Saud", "Al-Rumaihi"),
    "CUST-3054": ("Zainab", "Ibrahim Khalid", "Al-Hashemi"),
    "CUST-3061": ("Mizanur", "Abdul Karim", "Rahman"),
    "CUST-3062": ("Samuel", "Okello", "Mugisha"),
    "CUST-3063": ("Zahid", "Mehmood", "Butt"),
    "CUST-3064": ("Kyaw", "Zin", "Htet"),
    "CUST-3068": ("Sokha", "Vannak", "Chea"),
    "CUST-3069": ("Khamla", "Somphone", "Vongsa"),
    "CUST-3070": ("Sipho", "Themba", "Dlamini"),
    "CUST-3071": ("Khalifa", "Abdullah Saeed", "Al-Mohannadi"),
    "CUST-3072": ("Rohan", "Vikram", "Mehta"),
    "CUST-3073": ("Walid", "Nabil Hassan", "Al-Zoubi"),
    "CUST-3065": ("Abdulrahman", "Jassim Hamad", "Al-Kubaisi"),
    "CUST-3066": ("Maha", "Rashid Saeed", "Al-Ghanim"),
    "CUST-3067": ("Mohamed", "Nabil Ibrahim", "Soliman"),
    "NAS-7002": ("Yousef", "Khalifa Hamad", "Al-Khulaifi"),
    "NAS-7003": ("Anil", "Ramesh", "Sharma"),
    "NAS-7004": ("Mustafa", "Salem Ali", "Al-Baker"),
}
# Non-customer-table people that are still customer-side contacts. Keyed by
# (file, old full name) -> (first, middle, last).
CONTACT_NAMES = {
    "Mariam Al-Sulaiti": ("Mariam", "Khalid Saeed", "Al-Sulaiti"),          # customer-contacts CTC-4002
    "Mohammed Al-Kubaisi": ("Mohammed", "Rashid Ali", "Al-Kubaisi"),       # authorised-contacts
    "Aisha Al-Sulaiti": ("Aisha", "Abdulla Saeed", "Al-Sulaiti"),
    "Rashid Al-Marri": ("Rashid", "Saud Hamad", "Al-Marri"),               # authorised contact + billing contact BILL-7004
    "Ahmed Al-Kuwari": ("Ahmed", "Saud Hamad", "Al-Kuwari"),               # gigahome acceptance forms
    "Fatima Al-Sulaiti": ("Fatima", "Ali Rashid", "Al-Sulaiti"),
    "Rashid Al-Mannai": ("Rashid", "Khalid Saeed", "Al-Mannai"),
    "Ahmed Hassan Al-Sulaiti": ("Ahmed", "Hassan Khalid", "Al-Sulaiti"),   # MNP application form
    "Layla Mahmoud": ("Layla", "Mahmoud Ibrahim", "Saleh"),
}


def full(t):
    return " ".join(t)


# --------------------------------------------------------------------------
# PROPOSED customers. Synthetic IDs/phones, checked below for collisions.
# --------------------------------------------------------------------------
def P(cid, name, nat, grp, idt, idn, exp, dob, sex, seg, lang, pp, pre, cat, scen, disc, mnp, journeys, expected, *,
      bl="", hrn=False, emp="", status="Customer (Siebel)", jk=None, req="", extra="", sub=""):
    return dict(cid=cid, name=name, nat=nat, grp=grp, idt=idt, idn=idn, exp=exp, dob=dob, sex=sex, seg=seg, lang=lang, pp=pp, pre=pre,
                cat=cat, scen=scen, disc=disc, mnp=mnp, journeys=journeys, expected=expected, bl=bl, hrn=hrn, emp=emp, status=status,
                jk=jk or ["workspace.customer-search", "postpaid.new-postpaid-wizard"], req=req, extra=extra, sub=sub)

PP = ["workspace.customer-search", "postpaid.new-postpaid-wizard"]
PRE = ["workspace.customer-search", "prepaid.new-prepaid-tablet-wizard"]
MNP = ["workspace.customer-search", "mnp.port-in-wizard"]
C360 = ["workspace.customer-search", "workspace.customer360-view"]

PROPOSED = [
    # ---- 1. Qatari postpaid line counts
    P("CUST-3001", "Hamad Al-Thani", "Qatari", "Qatari", "QID", "27911063400001", "2030-03-31", "1979-11-06", "Male", "Consumer", "Arabic", 2, 0, "1 Qatari postpaid",
      "Qatari with 2 active postpaid lines.", "Loyalty (existing)", "-", "New Postpaid (3rd line); Customer 360",
      "Qatari cap is 5 postpaid lines: 2/5 -> Active Lines passes, no line-cap approval. The 2+ postpaid credit-control warning (VAL-375/BR-266) still applies.",
      jk=PP, req="Qatari 2 lines"),
    P("CUST-3002", "Mariam Al-Naimi", "Qatari", "Qatari", "QID", "28203063400002", "2030-08-31", "1982-03-14", "Female", "Consumer", "Arabic", 5, 0, "1 Qatari postpaid",
      "Qatari with 5 active postpaid lines = AT the Qatari cap.", "Loyalty (existing)", "-",
      "New Postpaid (6th line); Order Approval Queue; Customer 360",
      "Cap of 5 reached -> Active Lines = approval-routing; the 6th line proceeds only once approved. Enforced by BR-288 (message 'Qatari cap of 5 postpaid mobile lines reached (5 active)').",
      jk=PP, req="Qatari 5 lines (at cap)"),
    P("CUST-3004", "Khalifa Al-Attiyah", "Qatari", "Qatari", "QID", "27705063400004", "2030-06-30", "1977-05-09", "Male", "Consumer", "Arabic", 6, 0, "1 Qatari postpaid",
      "Qatari with 6 active postpaid lines; the 6th was obtained through workflow approval (approved order on file).", "Loyalty (existing)", "-",
      "New Postpaid (7th line); Order Approval Queue",
      "Over the cap of 5 -> approval-routing again for any further line. Same BR-288 path as CUST-3002.",
      jk=PP, req="Qatari 6 lines (approved above cap)"),
    P("CUST-3003", "Jassim Al-Marri", "Qatari", "Qatari", "QID", "29005063400003", "2029-12-31", "1990-05-20", "Male", "Consumer", "English", 0, 2, "1 Qatari postpaid",
      "Qatari with prepaid lines only (2 prepaid, 0 postpaid) - candidate for prepaid-to-postpaid migration.", "Prepaid Welcome (-10% on Red 25/50/100)", "-", "Pre-to-Post Migration; New Postpaid",
      "Existing customer. Qatari -> no prepaid cap (BR-347). Eligible for migration journey.",
      jk=["workspace.customer-search", "migration.pre-to-post-wizard"], req="Qatari prepaid-only"),
    # ---- 2. Expat postpaid line counts
    P("CUST-3011", "Rajesh Kumar", "Indian", "Expat (QID)", "QID", "28508035600011", "2029-09-30", "1985-08-02", "Male", "Consumer", "English", 1, 0, "2 Expat postpaid",
      "Expat QID holder with 1 active postpaid line.", "Loyalty (existing)", "-", "New Postpaid (2nd line)",
      "BR-288: 1/2 postpaid lines used -> Active Lines check passes (message '1/2 ... used').", jk=PP, req="Expat 1 line"),
    P("CUST-3012", "Maria Santos", "Filipino", "Expat (QID)", "QID", "29112060800012", "2030-01-31", "1991-02-27", "Female", "Consumer", "English", 2, 0, "2 Expat postpaid",
      "Expat QID holder with 2 active postpaid lines (AT the expat cap of 2).", "Loyalty (existing)", "-", "New Postpaid (3rd line)",
      "Expat cap of 2 reached (BR-288) -> Active Lines = approval-routing: 'An approval task has been raised'. Order proceeds once approved. No in-journey override (BR-111).", jk=PP, req="Expat 2 lines"),
    P("CUST-3013", "Ahmed Fathy", "Egyptian", "Expat (QID)", "QID", "28409081800013", "2029-06-30", "1984-09-09", "Male", "Consumer", "Arabic", 3, 0, "2 Expat postpaid",
      "Expat QID holder with 3 active postpaid lines; the 3rd was granted through workflow approval (approval-granted order on file).", "Loyalty (existing)", "-", "New Postpaid (4th line); Order Approval Queue",
      "Cap exceeded (3 >= 2) -> approval-routing again; credit-control warning shown. Approver role per approval-matrix: Back Office Fulfilment Agent.", jk=PP, req="Expat 3 lines + approval"),
    P("CUST-3014", "Sunil Perera", "Sri Lankan", "Expat (QID)", "QID", "28710014400014", "2030-05-31", "1987-10-11", "Male", "Consumer", "English", 2, 3, "2 Expat postpaid",
      "Expat QID with 2 postpaid + 3 prepaid = 5 combined mobile lines (system technical cap).", "Loyalty (existing)", "-", "New Prepaid; New Postpaid",
      "Prepaid: BR-347 QID cap 5 combined reached -> blocked. Postpaid: BR-288 cap reached -> approval.", jk=PRE, req="Expat combined 5-line cap"),
    P("CUST-3015", "Hasan Mahmoud", "Jordanian", "Expat (QID)", "QID", "28806040000015", "2029-11-30", "1988-06-21", "Male", "Consumer", "Arabic", 1, 1, "2 Expat postpaid",
      "Expat QID, 1 postpaid + 1 prepaid; clean boundary customer (3 lines of headroom on combined cap).", "Loyalty (existing)", "-", "New Prepaid; New Postpaid",
      "Both caps pass: 2/5 combined; 1/2 postpaid.", jk=PRE, req="Expat mixed lines"),
    P("CUST-3016", "Chen Wei", "Chinese", "Expat (Passport)", "Passport", "E58321097", "2031-02-28", "1993-12-30", "Male", "Consumer", "English", 0, 2, "2 Expat postpaid",
      "Expat Passport holder (no QID), 2 prepaid lines = Passport prepaid cap.", "None", "-", "New Prepaid (blocked); New Connection",
      "Passport is not offered for New Postpaid; Prepaid cap 2 reached -> blocked (BR-347); BR-108 limits Passport-only expats to prepaid.", jk=PRE, req="Expat passport at prepaid cap"),
    P("CUST-3017", "Ali Reza", "Iranian", "Expat (QID)", "QID", "28904036400017", "2029-10-31", "1989-04-03", "Male", "Consumer (HRN)", "English", 0, 0, "2 Expat postpaid",
      "High-risk-nationality expat on a valid QID, no lines yet - HRN advance and QAR 50 credit limit apply.", "None", "-", "New Postpaid",
      "HRN: 'Customer needs to pay advance payment of QR 100' (BR-187/VAL-360); credit limit 50 (BR-076); order sub-type HRN.", hrn=True, jk=PP, req="HRN customer"),
    # ---- 3. Discounts & eligibility
    P("CUST-3021", "Salma Al-Kuwari", "Qatari", "Qatari", "QID", "27610063400021", "2030-04-30", "1976-10-22", "Female", "Consumer", "Arabic", 1, 0, "3 Discounts & eligibility",
      "Qatari with a MADA card, 1 active postpaid line. MADA-eligible on Postpaid Red 350 (PROD-104).", "MADA (-10%, ADO-7112) + Loyalty (-15%) - max ONE discount per order", "-", "New Postpaid; New Connection (customer type = MADA)",
      "MADA/B2B2C discount requires a supporting ID AND proof document (MADA card/reference number). Plan change retires the discount. Loyalty and MADA are mutually exclusive on one order.", jk=PP, req="MADA eligible",
      extra="MADA reference no. for the proof field: MADA-2026-0041021"),
    P("CUST-3022", "Abdullah Al-Sada", "Qatari", "Qatari", "QID", "27409063400022", "2030-09-30", "1974-07-15", "Male", "Consumer", "Arabic", 1, 0, "3 Discounts & eligibility",
      "Retired Qatari - ID is in the govt retiree registry (needs a registry entry).", "Retired (validated against govt registry)", "-", "New Connection (customer type = Retired)",
      "Office-ID scan -> ID number sent to registry -> 'Retired status validated with the government system.' Step valid only when the check passes.", jk=PP, req="Retired person discount",
      extra="Add ID 27409063400022 to govt-retiree-registry.json"),
    P("CUST-3023", "Hussain Al-Dosari", "Qatari", "Qatari", "QID", "27307063400023", "2029-08-31", "1973-01-30", "Male", "Consumer", "Arabic", 1, 0, "3 Discounts & eligibility",
      "Qatari aged 53 claiming retirement but NOT in the registry - negative control.", "Retired (claimed) -> FAILS validation", "-", "New Connection (customer type = Retired)",
      "'This ID number could not be validated as a retired customer with the government system.' Journey cannot continue on the Retired path.", jk=PP, req="Retired - validation failure"),
    P("CUST-3024", "Nasser Al-Hajri", "Qatari", "Qatari", "QID", "28105063400024", "2030-02-28", "1981-12-09", "Male", "Consumer", "English", 2, 0, "3 Discounts & eligibility",
      "Qatari holding BOTH a MADA card and a sponsoring employer (Gulf Logistics W.L.L.): eligible for MADA and B2B2C. 2 postpaid lines.", "MADA (ADO-7112) AND B2B2C (ADO-7113) - one per order; plan decides (Red 350 -> MADA, Red 500 -> B2B2C)", "-",
      "New Postpaid on Red 350 then Red 500", "Combination test: each discount exists only on its own plan; switching plan retires the other. B2B2C route -> manager approval + Proof of Employment.", emp="Gulf Logistics W.L.L.", jk=PP, req="MADA + B2B2C both eligible"),
    P("CUST-3025", "Priya Nair", "Indian", "Expat (QID)", "QID", "29302035600025", "2030-06-30", "1993-02-14", "Female", "Consumer", "English", 1, 0, "3 Discounts & eligibility",
      "Expat employee sponsored by Gulf Logistics W.L.L. (B2B2C), 1 postpaid line, no pre-existing Special Management flag.", "B2B2C (-10% on Red 500, ADO-7113)", "-", "New Postpaid; FWA; Fixed Line",
      "BR-264: B2B2C on an account WITHOUT Special Management completes automatically. Proof of Employment + CAF mandatory.", emp="Gulf Logistics W.L.L.", jk=PP, req="B2B2C type discount"),
    P("CUST-3026", "Imran Qureshi", "Pakistani", "Expat (QID)", "QID", "28707058600026", "2029-12-31", "1987-07-07", "Male", "Consumer", "English", 1, 0, "3 Discounts & eligibility",
      "B2B2C employee whose account ALREADY carries a Special Management value.", "B2B2C", "-", "New Postpaid; FWA", "Account carries Special Management (stored on the account). INTENDED per BR-265: prompt 'The Account has already Special Management field value. Do you still want to continue the journey without B2B2C?'. The app has no such prompt yet (Open Questions Q7); BR-266: Pending approval.",
      emp="Doha Contracting Co.", jk=PP, req="B2B2C + Special Management"),
    P("CUST-3027", "Fahad Al-Ansari", "Qatari", "Qatari", "QID", "26904063400027", "2031-01-31", "1969-04-25", "Male", "Consumer", "Arabic", 1, 0, "3 Discounts & eligibility",
      "Retired Qatari who also holds a MADA card (registry-listed).", "Retired AND MADA - pick one customer type per journey", "-", "New Connection (Retired path, then MADA path)",
      "Customer-type step is single-choice (None/B2B2C/Retired/MADA): run twice to confirm each path validates independently.", jk=PP, req="Retired + MADA",
      extra="Add ID 26904063400027 to govt-retiree-registry.json"),
    P("CUST-3028", "Karim Haddad", "Lebanese", "Expat (QID)", "QID", "28404042200028", "2029-07-31", "1984-11-12", "Male", "Consumer", "English", 1, 1, "3 Discounts & eligibility",
      "Existing expat customer, long tenure, eligible for 6-month retention/loyalty discount; also holds a prepaid line.", "Loyalty (-15%) on Red 350/500/Unlimited/Extra; Prepaid Welcome", "-", "New Postpaid; Retention journey",
      "Loyalty applies to existing Vodafone customers (ADO-7105..7108). NOTE: the app does not gate Loyalty on customer history - it is offered on the plan (Open Questions Q4).", jk=PP, req="Existing customer further discount"),
    P("CUST-3029", "Reem Al-Obaidly", "Qatari", "Qatari", "QID", "29506063400029", "2030-10-31", "1995-06-01", "Female", "Consumer", "Arabic", 0, 0, "3 Discounts & eligibility",
      "Control: Qatari existing-customer record with NO discount entitlement, no lines.", "None", "-", "New Postpaid", "Standard price, no discount offered as eligible. Baseline for pricing assertions.", jk=PP, req="No-discount control"),
    # ---- 4. New customer / MNP
    P("NAS-7002", "Yousef Al-Khulaifi", "Qatari", "Qatari", "QID", "29207063400101", "2030-07-31", "1992-07-19", "Male", "Consumer", "Arabic", 0, 0, "4 New customer / MNP",
      "NEW Qatari customer (NAS only) porting a postpaid number from Ooredoo.", "None", "MNP postpaid port-in, donor Ooredoo, clean path", "Port-In as New Connection (MNP)",
      "Resolves via NAS, no customerId. Port-in order raised with NPASS; SMS action window 2h (extendable 24h).", status="New (NAS record only)", jk=MNP, req="New customer MNP"),
    P("NAS-7003", "Anil Sharma", "Indian", "Expat (QID)", "QID", "29108035600102", "2030-03-31", "1991-08-08", "Male", "Consumer", "English", 0, 0, "4 New customer / MNP",
      "NEW expat QID customer (NAS only), porting a PREPAID number from QTEL/Ooredoo.", "Prepaid Welcome (-10%)", "MNP prepaid port-in", "New Prepaid; Port-In as New Connection",
      "New customer; prepaid path ignores B2B2C (NewMnpWizard).", status="New (NAS record only)", jk=MNP, req="New expat MNP"),
    P("NAS-7004", "Mustafa Al-Baker", "Qatari", "Qatari", "QID", "28909063400103", "2030-09-30", "1989-09-03", "Male", "Consumer", "Arabic", 0, 0, "4 New customer / MNP",
      "NEW customer whose port-in will be auto-rejected: name on the donor line does not match the QID (NPASS reject code 4).", "None", "MNP port-in - rejection path", "Port-In as New Connection",
      "Mirrors POUT-17002: customerNameMatch=false -> auto-rejected. Test rejection handling and re-submission.", status="New (NAS record only)", jk=MNP, req="MNP rejection"),
    P("CUST-3031", "Dina Al-Mahmoud", "Qatari", "Qatari", "QID", "28603063400031", "2030-12-31", "1986-03-23", "Female", "Consumer", "Arabic", 1, 0, "4 New customer / MNP",
      "EXISTING customer porting a SECOND number in from another operator (postpaid), conditional-accept path: donor dues over QAR 100.", "Loyalty (existing)", "MNP port-in with donor conditional acceptance (billed due > QAR 100, clearance window)", "MNP Port-In",
      "Mirrors MNP-11002: conditionalAcceptanceTriggered=true; order waits for dues clearance.", jk=MNP, req="Existing customer MNP / conditional accept"),
    P("CUST-3032", "Lakshmi Iyer", "Indian", "Expat (Passport)", "Passport", "Z4455671", "2030-11-30", "1992-01-17", "Female", "Consumer", "English", 0, 2, "4 New customer / MNP",
      "Expat Passport holder switching TWO prepaid numbers (multi-number switch) from Ooredoo - mirrors MNP-FORM-90005-01.", "None", "MNP multi-number prepaid port-in (2 numbers)", "MNP Port-In (Multi Number)",
      "Multi Number switching table with both numbers on the same Passport; Passport cap 2 prepaid.", jk=MNP, req="MNP multi-number passport"),
    P("CUST-3033", "Tariq Aziz", "Pakistani", "Expat (QID)", "QID", "28605058600033", "2029-10-31", "1986-05-12", "Male", "Consumer", "English", 1, 0, "4 New customer / MNP",
      "B2B2C employee (Doha Contracting Co.) porting a postpaid number in - MNP + B2B2C combined.", "B2B2C", "MNP postpaid port-in, B2B2C", "MNP Port-In (B2B2C route)",
      "NewMnpWizard: orderSubType B2B2C, status 'Submitted for Approval'; MNP category approver = Sales Manager (approval-matrix).", emp="Doha Contracting Co.", jk=MNP, req="MNP + B2B2C"),
    # ---- 6. Eligibility gates
    P("CUST-3041", "Omar Khalil", "Syrian", "Expat (QID)", "QID", "28808076000041", "2025-12-31", "1988-08-30", "Male", "Consumer", "Arabic", 1, 0, "6 Eligibility gates",
      "Expat whose QID EXPIRED on 2025-12-31.", "None", "-", "Any new connection", "ID Validity hard-stop: 'This ID expired on 31/12/2025. Please request a valid, unexpired ID to continue.'", jk=PP, req="Expired ID"),
    P("CUST-3042", "Nadia Farouk", "Egyptian", "Expat (QID)", "QID", "29210081800042", "", "1992-10-10", "Female", "Consumer", "Arabic", 0, 0, "6 Eligibility gates",
      "Expat whose identity document has NO expiry date on file.", "None", "-", "Any new connection", "ID Validity = approval-routing (manual validity check). Not a pass - the app never confirms an ID it cannot verify.", jk=PP, req="No expiry on file"),
    P("CUST-3043", "Ravi Menon", "Indian", "Expat (QID)", "QID", "28912035600043", "2030-04-30", "1989-12-15", "Male", "Consumer", "English", 0, 0, "6 Eligibility gates",
      "Expat on the corporate SECURITY blacklist.", "None", "-", "Any new connection", "Security Check hard-stop; interaction ends at the counter (no prepaid fallback).", bl="security", jk=PP, req="Security blacklist (expat)"),
    P("CUST-3044", "Saeed Al-Mohannadi", "Qatari", "Qatari", "QID", "30806063400044", "2031-03-31", "2008-06-01", "Male", "Consumer", "Arabic", 0, 0, "6 Eligibility gates",
      "Qatari aged 18 (turned 18 on 2026-06-01) - age boundary.", "None", "-", "New Postpaid", "Age Check passes at 18 ('Customer's age is 18 years'); under 18 is a hard stop.", jk=PP, req="Age boundary"),
    P("CUST-3045", "Eva Muller", "German", "Diplomatic", "Diplomatic ID", "DIP-QA-005100", "2030-12-31", "1980-03-18", "Female", "Consumer", "English", 0, 0, "6 Eligibility gates",
      "German diplomat, valid Diplomatic ID, clean record.", "None", "-", "New Postpaid", "Diplomatic ID is exception-routed -> CBM approval workflow; no other block.", jk=PP, req="Diplomatic ID (valid)"),
    P("CUST-3046", "Bilal Siddiqui", "Pakistani", "Expat (QID)", "QID", "28311058600046", "2030-02-28", "1983-11-11", "Male", "Consumer", "English", 1, 0, "6 Eligibility gates",
      "Expat with a collections blacklist (dues) - postpaid blocked, prepaid available.", "None", "-", "New Postpaid (soft-stop); New Prepaid", "Collections Check soft-stop (same shape as CUST-1004 for an expat).", bl="collections", jk=PP, req="Collections blacklist (expat)"),
    # ---- 7. Existing-service journeys
    P("CUST-3051", "Tamer Hosni", "Egyptian", "Expat (QID)", "QID", "28506081800051", "2030-05-31", "1985-06-06", "Male", "Consumer", "Arabic", 1, 0, "7 Existing-service journeys",
      "Existing postpaid customer needing a SIM swap (lost SIM - chargeable) and an eSIM line.", "None", "-", "SIM Swap queue; Customer 360 Mobile section", "BR-056: Lost SIM is chargeable; eSIM-to-eSIM free; damaged SIM free. ID verification adds a third MOI-match step.",
      jk=["workspace.customer-search", "numbers.sim-swap-queue"], req="SIM swap"),
    P("CUST-3052", "Sara Al-Qahtani", "Qatari", "Qatari", "QID", "28707063400052", "2030-08-31", "1987-07-25", "Female", "Consumer", "Arabic", 1, 0, "7 Existing-service journeys",
      "Postpaid customer with a device instalment (Galaxy S24, 12 months) and 8 months of the 12-month lock-in completed.", "Loyalty (existing)", "-", "Customer 360; Disconnection / penalty view; Device Installment",
      "Lock-in not complete -> disconnection fee = QR 80 x remaining months (lock-in rule in ruleEngine.ts).", jk=C360, req="Lock-in penalty / device installment"),
    P("CUST-3053", "Faisal Al-Rumaihi", "Qatari", "Qatari", "QID", "28808063400053", "2030-03-31", "1988-08-19", "Male", "Consumer", "Arabic", 1, 0, "7 Existing-service journeys",
      "Qatari with a GigaHome 5G FWA outdoor line plus 1 postpaid line (cross-sell target).", "Loyalty (existing)", "-", "FWA; Fixed Line; Customer 360", "Existing multi-product customer; FWA appointment booking and serial-number check apply.",
      jk=["workspace.customer-search", "fwa.new-fwa-wizard"], req="FWA / multi-product"),
    P("CUST-3054", "Zainab Al-Hashemi", "Qatari", "Qatari", "QID", "29108063400054", "2030-11-30", "1991-08-14", "Female", "Premium", "English", 3, 1, "7 Existing-service journeys",
      "Premium-segment Qatari with multi-SIM / iWatch lines; high-value retention target.", "Loyalty (existing)", "-", "Retention; Customer 360; Multi-SIM", "Premium Agent / Retention Agent journeys; multi-SIM sequence numbers and monthly fees apply.", jk=C360, req="Premium / retention"),
    # ---- 8. Risk class (HRN) and ID-class additions
    P("CUST-3061", "Mizanur Rahman", "Bangladeshi", "Expat (Passport)", "Passport", "BN7721045", "2031-04-30", "1990-03-08", "Male", "Consumer (HRN)", "English", 0, 2, "8 HRN & ID classes",
      "HRN expat on a Passport with 2 prepaid lines = Passport prepaid cap.", "None", "-", "New Prepaid (blocked); New Connection",
      "Prepaid cap 2 reached (BR-347) -> blocked; Passport is exception-routed to CBM approval; HRN QAR 100 advance and credit limit 50 would also apply. Passport is not offered for New Postpaid.",
      hrn=True, jk=PRE, req="HRN passport at prepaid cap", extra="Nationality chosen for realism - the app reads only the HRN flag, not a nationality list."),
    P("CUST-3062", "Dipak Rai", "Nepalese", "Expat (QID)", "QID", "29207052400062", "2030-09-30", "1992-07-04", "Male", "Consumer (HRN)", "English", 1, 0, "8 HRN & ID classes",
      "HRN expat sponsored by Gulf Logistics W.L.L. (HRN + B2B2C), 1 postpaid line.", "B2B2C (-10% on Red 500)", "-", "New Postpaid; FWA; Fixed Line",
      "Both apply: HRN advance QAR 100 AND B2B2C route (Submitted for Approval, Proof of Employment mandatory). B2B2C wins the order sub-type (orderSubType = B2B2C).",
      hrn=True, emp="Gulf Logistics W.L.L.", jk=PP, req="HRN + B2B2C"),
    P("CUST-3063", "Waleed Al-Qahtani", "Saudi", "GCC", "GCC ID", "784199012345632", "2030-01-31", "1990-09-21", "Male", "Consumer (HRN)", "Arabic", 0, 1, "8 HRN & ID classes",
      "EDGE CASE: GCC ID holder carrying the HRN flag, to prove the app reads the flag independent of ID type. Unlikely in production (GCC ID holders are GCC citizens).", "None", "-", "New Prepaid; New Connection",
      "GCC ID exception-routed; HRN advance QAR 100 still required; prepaid cap 2 (1/2 used).", hrn=True, jk=PRE, req="HRN on GCC ID"),
    P("CUST-3064", "Osman Idris", "Sudanese", "Expat (QID)", "QID", "28809072900064", "2029-11-30", "1988-09-12", "Male", "Consumer (HRN)", "Arabic", 2, 0, "8 HRN & ID classes",
      "HRN expat QID with 2 postpaid lines (AT the expat cap).", "Loyalty (existing)", "-", "New Postpaid (3rd line)",
      "Two independent gates: expat cap of 2 -> approval task, AND HRN QAR 100 advance. Both must clear.", hrn=True, jk=PP, req="HRN at expat line cap"),
    P("CUST-3065", "Abdulrahman Al-Kubaisi", "Qatari", "Qatari (Sawfa)", "QID", "28402063400065", "2030-05-31", "1984-02-17", "Male", "Consumer", "Arabic", 1, 2, "8 HRN & ID classes",
      "Qatari in the Sawfa category (BR-347: no prepaid restriction). 1 postpaid + 2 prepaid.", "Loyalty (existing)", "-", "New Prepaid; New Postpaid",
      "No prepaid cap; postpaid 1/5. DATA ONLY: the app stores customerSubType but does not branch on Sawfa - Qatari rules already apply (Open Questions Q9).", jk=PRE, req="Sawfa", sub="Sawfa"),
    P("CUST-3066", "Maha Al-Ghanim", "Qatari", "Qatari (Sawfa Plus)", "QID", "28704063400066", "2030-07-31", "1987-04-26", "Female", "Consumer", "Arabic", 0, 7, "8 HRN & ID classes",
      "Qatari in the Sawfa Plus category with 7 prepaid lines - well past any expat cap.", "Prepaid Welcome (-10%)", "-", "New Prepaid",
      "Qatari: prepaid cap not applied (BR-347), so an 8th prepaid line passes. DATA ONLY for the Sawfa Plus label (Q9).", jk=PRE, req="Sawfa Plus", sub="Sawfa Plus"),
    P("CUST-3067", "Mohamed Nabil", "Egyptian", "Expat (Other ID)", "Other ID", "RES-8812045", "2030-03-31", "1986-12-20", "Male", "Consumer", "Arabic", 1, 0, "8 HRN & ID classes",
      "Expat holding a resident-permit style 'Other ID' (no QID), 1 postpaid line.", "Loyalty (existing)", "-", "Customer 360; New Postpaid",
      "Other ID is exception-routed to CBM approval. NOTE: the ID-type selector does not offer 'Other ID', so find this customer by Mobile/name in Customer Search, not by ID scan.",
      jk=PP, req="Other ID", extra="Look up via Customer Search (mobile/name); the ID selector has no Other ID option."),
]

# HRN is DERIVED from nationality (VFQ list, 2026-10-02). The set is parsed from
# the app's own rule so the workbook cannot disagree with the code.
_hrn_src = (APP / "src/engines/ruleEngine.ts").read_text()
HRN_SET = set(re.findall(r"'([a-z]+)'", _hrn_src[_hrn_src.index("const HRN_NATIONALITIES"):_hrn_src.index("export function isHrnNationality")]))


def is_hrn(nationality):
    return bool(nationality) and nationality.strip().lower() in HRN_SET


PROPOSED += [
    P("CUST-3068", "x", "Cambodian", "Expat (QID)", "QID", "29506011600068", "2030-02-28", "1995-06-14", "Male", "Consumer", "English", 0, 0, "8 HRN & ID classes",
      "Cambodian expat on a valid QID, no lines - HRN nationality coverage.", "None", "-", "New Postpaid", "HRN (Cambodia is on the list): QAR 100 advance and credit limit 50.", req="HRN Cambodia"),
    P("CUST-3069", "x", "Laotian", "Expat (QID)", "QID", "28910041800069", "2029-12-31", "1989-10-02", "Female", "Consumer", "English", 0, 0, "8 HRN & ID classes",
      "Laotian expat on a valid QID, no lines - HRN nationality coverage.", "None", "-", "New Postpaid", "HRN (Laos is on the list): QAR 100 advance and credit limit 50.", req="HRN Laos"),
    P("CUST-3070", "x", "Swazi", "Expat (QID)", "QID", "29103074800070", "2030-08-31", "1991-03-19", "Male", "Consumer", "English", 0, 0, "8 HRN & ID classes",
      "Swazi (Eswatini) expat on a valid QID, no lines - HRN nationality coverage.", "None", "-", "New Postpaid", "HRN (Eswatini is on the list): QAR 100 advance and credit limit 50.", req="HRN Eswatini"),
    # ---- 9. Number reservations
    P("CUST-3071", "x", "Qatari", "Qatari", "QID", "27801063400071", "2031-06-30", "1978-01-14", "Male", "Consumer", "Arabic", 1, 0, "9 Reserved numbers",
      "Qatari with TWO numbers reserved for them (+97433001001 at 09:15 and +97455610140 at 14:35 on 04 Oct 2026), both held by the Retail Sales demo login.", "Loyalty (existing)", "-", "New Postpaid (Number Selection)",
      "Number Selection opens on the Reserved Numbers tab. Both holds show their reservation date and time, newest first, and the most recent (+97455610140, 14:35) is selected by default.", jk=PP, req="Two reserved numbers"),
    # ---- 6b. Eligibility gates added 2026-10-04 - the two outcomes no customer could reach
    P("CUST-3072", "x", "Indian", "Expat (QID)", "QID", "28504042200072", "2030-09-30", "1985-04-04", "Male", "Consumer", "English", 5, 0, "6 Eligibility gates",
      "Indian expat on a valid QID already holding 5 active postpaid lines - the expat absolute maximum.", "None", "-", "New Postpaid",
      "Active Lines HARD STOP (BR-288): 'Expat maximum of 5 postpaid mobile lines reached (5 active)'. Every other check passes; the order cannot proceed (no approval route, unlike the Qatari 5+ case).",
      jk=PP, req="Expat line-cap hard stop (5/5)"),
    P("CUST-3073", "x", "Jordanian", "Expat (QID)", "QID", "28509034500073", "2030-06-30", "1985-09-03", "Male", "Consumer", "Arabic", 1, 0, "6 Eligibility gates",
      "Expat flagged on the collections blacklist but owing QAR 0 (no unpaid bill on file) - the flag alone is not a block.", "None", "-", "New Postpaid",
      "Collections Check PASSES ('No collections block on this account'): a collections block needs an outstanding balance above QAR 0 (VFQ business, 2026-10-02). Contrast CUST-3046, same flag with an unpaid bill -> soft-stop.",
      bl="collections", jk=PP, req="Collections flag, zero balance"),
]

# Scenario rewrites forced by the nationality rule (the nationalities originally
# picked for these rows are not on the list).
OVERRIDES = {
    "CUST-3017": dict(nat="Kenyan", scen="HRN expat (Kenyan) on a valid QID, no lines yet - HRN advance and credit limit 50 apply."),
    "CUST-3062": dict(nat="Ugandan", scen="HRN expat (Ugandan) sponsored by Gulf Logistics W.L.L. (HRN + B2B2C), 1 postpaid line."),
    "CUST-3064": dict(nat="Myanmar", scen="HRN expat (Myanmar) QID with 2 postpaid lines (AT the expat cap)."),
    "CUST-3063": dict(nat="Pakistani", grp="Expat (Other ID)", idt="Other ID", idn="RES-9930471",
                      scen="HRN expat (Pakistani) holding an 'Other ID' (resident permit) with 1 prepaid line - HRN together with an exception-routed ID type.",
                      journeys="New Prepaid; Customer Search", expected="Other ID exception-routed to CBM approval; HRN QAR 100 advance still required; prepaid cap not an expat-QID cap. Find by mobile/name - the ID selector has no Other ID option.",
                      req="HRN on Other ID", extra="Look up via Customer Search (mobile/name); the ID selector has no Other ID option."),
}
for _p in PROPOSED:
    _p.update(OVERRIDES.get(_p["cid"], {}))
    _p["hrn"] = is_hrn(_p["nat"])
    if _p["hrn"] and _p["seg"] == "Consumer":
        _p["seg"] = "Consumer (HRN)"
    if not _p["hrn"] and _p["seg"] == "Consumer (HRN)":
        _p["seg"] = "Consumer"
    if _p["hrn"] and "HRN" not in _p["scen"]:
        _p["scen"] += " HRN: nationality is on the VFQ list -> QAR 100 advance, credit limit 50."

for _p in PROPOSED:
    _p["first"], _p["middle"], _p["last"] = NAMES[_p["cid"]]
    _p["name"] = full(NAMES[_p["cid"]])

# --------------------------------------------------------------------------
# --seed : write the PROPOSED customers into public/mock-data (idempotent)
# --------------------------------------------------------------------------
def apply_hrn(rd, wr):
    """Make hrnAdvancePaymentRequired / segment / credit limits agree with nationality for every customer."""
    cust = rd("customers")
    hrn_of = {}
    for c in cust:
        h = is_hrn(c.get("nationality"))
        hrn_of[c["customerId"]] = h
        if h:
            c["hrnAdvancePaymentRequired"] = True
            if c.get("segment") == "Consumer":
                c["segment"] = "Consumer (HRN)"
        else:
            c.pop("hrnAdvancePaymentRequired", None)
            if c.get("segment") == "Consumer (HRN)":
                c["segment"] = "Consumer"
    wr("customers", cust)
    acct = {a["accountId"]: a["customerId"] for a in rd("accounts")}
    bp = rd("billing-profiles")
    for b in bp:
        cid = acct.get(b["accountId"])
        if cid is None or cid not in hrn_of:
            continue
        if hrn_of[cid]:
            b["creditLimitQAR"] = 50; b["hrnAdvancePaymentQAR"] = 100
        elif b.get("hrnAdvancePaymentQAR") is not None or SEED_TAG in str(b.get("_note", "")):
            b.pop("hrnAdvancePaymentQAR", None); b["creditLimitQAR"] = 1000
    wr("billing-profiles", bp)
    crl = rd("credit-limits")
    for r in crl:
        cid = r.get("customerId")
        if cid in hrn_of:
            r["isHrn"] = hrn_of[cid]
            if not hrn_of[cid] and r.get("creditLimitQar") == 50:
                r["creditLimitQar"] = 1000; r["customerSegment"] = "Expat New Account"
    wr("credit-limits", crl)


def benefits_from(disc):
    """Structured benefit eligibility parsed from a customer's 'Discount eligibility' note (the workbook column).

    Tokens: retired | mada | b2b2c | loyalty | prepaid-welcome. 'Retired (claimed) -> FAILS validation' still lists
    `retired`: the customer claims it and the government-registry check in the journey decides. An employer row
    ('N/A - this is the employer...') carries no benefit.
    """
    d = (disc or "")
    if d.startswith("N/A") or d.startswith("None"):
        return []
    out = []
    for token, needle in (("retired", "Retired"), ("mada", "MADA"), ("b2b2c", "B2B2C"), ("loyalty", "Loyalty"), ("prepaid-welcome", "Prepaid Welcome")):
        if needle in d:
            out.append(token)
    return out


def apply_benefits(rd, wr):
    """Write `benefitEligibility` (see benefits_from) onto every customer, so the app reads it instead of parsing free text."""
    disc_of = {cid: s["disc"] for cid, s in SEED.items()}
    disc_of.update({p["cid"]: p["disc"] for p in PROPOSED})
    cust = rd("customers")
    for c in cust:
        if c["customerId"] in disc_of:
            c["benefitEligibility"] = benefits_from(disc_of[c["customerId"]])
    wr("customers", cust)


def refresh_seeded(rd, wr):
    """Re-sync records THIS script created (tagged SEED_TAG) with PROPOSED - so a changed nationality/ID flows through."""
    by = {p["cid"]: p for p in PROPOSED}
    cust = rd("customers")
    for c in cust:
        p = by.get(c["customerId"])
        if p and SEED_TAG in str(c.get("_note", "")):
            c.update({"nationality": p["nat"], "idType": p["idt"], "qid": p["idn"], "segment": p["seg"],
                      "email": f"{full(NAMES[p['cid']]).lower().replace(' ', '.').replace('-', '')}@example.qa"})
    wr("customers", cust)
    docs_ = rd("identity-documents")
    for d in docs_:
        p = by.get(d["customerId"])
        if p and SEED_TAG in str(d.get("_note", "")):
            d["documentType"], d["documentNumber"] = p["idt"], p["idn"]
            d["validationPath"] = "MOI Validation" if p["idt"] == "QID" else "Capture/Validate Details"
            d.pop("issuingCountry", None)
            if p["idt"] == "Passport":
                d["issuingCountry"] = p["nat"]
            elif p["idt"] == "Other ID":
                d["issuingCountry"] = "Qatar"
    wr("identity-documents", docs_)
    # Billing-profile contact email follows the customer's (it is what an existing customer's email now comes from).
    emails = {c["customerId"]: c["email"] for c in cust}
    acct_cust = {x["billingProfileId"]: x["customerId"] for x in rd("accounts")}
    bps = rd("billing-profiles")
    for b in bps:
        cid = acct_cust.get(b["billingProfileId"])
        if cid in by and SEED_TAG in str(b.get("_note", "")):
            b["billingContactEmail"] = emails[cid]
    wr("billing-profiles", bps)


def apply_names(rd, wr):
    """Set first/middle/last + composed `name` on EVERY customer/NAS record in NAMES, then carry the new names through every file that repeats them."""
    def with_parts(rec, t):
        out = {}
        for k, v in rec.items():
            if k in ("firstName", "middleName", "lastName"):
                continue
            out[k] = v
            if k == "name":
                out["firstName"], out["middleName"], out["lastName"] = t
        out["name"] = full(t)
        return out

    cust = rd("customers"); old = {c["customerId"]: c["name"] for c in cust}
    wr("customers", [with_parts(c, NAMES[c["customerId"]]) if c["customerId"] in NAMES else c for c in cust])
    nas_ = rd("nas-records")
    wr("nas-records", [with_parts(n, NAMES[n["nasRecordId"]]) if n["nasRecordId"] in NAMES else n for n in nas_])

    cc = rd("customer-contacts"); out = []
    for r in cc:
        t = CONTACT_NAMES.get(f"{r['firstName']} {r['lastName']}") or next(
            (NAMES[r["customerId"]] for _ in [0] if r["customerId"] in NAMES and NAMES[r["customerId"]][0] == r["firstName"] and NAMES[r["customerId"]][2] == r["lastName"]), None)
        if t:
            r = {k: v for k, v in r.items() if k not in ("middleName",)}
            new = {}
            for k, v in r.items():
                new[k] = t[0] if k == "firstName" else t[2] if k == "lastName" else v
                if k == "firstName":
                    new["middleName"] = t[1]
            r = new
        out.append(r)
    wr("customer-contacts", out)

    acct = {a["accountId"]: a["customerId"] for a in rd("accounts")}
    bp = rd("billing-profiles")
    for b in bp:
        cid = acct.get(b["accountId"])
        if cid in NAMES and old.get(cid):
            for k in ("name", "billingContactName"):
                if isinstance(b.get(k), str) and b[k].startswith(old[cid]):
                    b[k] = full(NAMES[cid]) + b[k][len(old[cid]):]
        if b.get("billingContactName") in CONTACT_NAMES:
            b["billingContactName"] = full(CONTACT_NAMES[b["billingContactName"]])
    wr("billing-profiles", bp)

    for fname, key in (("contacts-b2b2c", None), ("authorised-contacts", "name"), ("gigahome-acceptance-forms", "customerName"), ("mnp-application-forms", "applicantName")):
        data = rd(fname)
        for r in data:
            if fname == "contacts-b2b2c":
                if r.get("employeeCustomerId") in NAMES:
                    r["employeeName"] = full(NAMES[r["employeeCustomerId"]])
            elif r.get(key) in CONTACT_NAMES:
                r[key] = full(CONTACT_NAMES[r[key]])
        wr(fname, data)


def seed():
    def rd(n): return json.loads((MOCK / f"{n}.json").read_text())
    def wr(n, d): (MOCK / f"{n}.json").write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    added = {}

    def add(name, key, recs):
        data = rd(name)
        have = {r.get(key) for r in data}
        new = [r for r in recs if r[key] not in have]
        if new:
            wr(name, data + new)
        added[name] = len(new)

    custs, ndocs, nrecs, accts, bills, orders, aprs, conts, retire = [], [], [], [], [], [], [], [], []
    employers = {}
    n_doc, n_acc, n_bill, n_ord, n_cont, n_apr = 5601, 5601, 7101, 91001, 3101, 3401
    tpl = rd("billing-profiles")[0]
    for i, p in enumerate(PROPOSED):
        email = f"{p['name'].lower().replace(' ', '.').replace('-', '')}@example.qa"
        ph = f"+974{55513001 + i}"
        if p["status"].startswith("New"):
            nrecs.append({"_note": SEED_TAG, "nasRecordId": p["cid"], "documentType": p["idt"], "documentNumber": p["idn"], "expiryDate": p["exp"],
                          "name": p["name"], "firstName": p["first"], "middleName": p["middle"], "lastName": p["last"], "dob": p["dob"], "nationality": p["nat"], "gender": p["sex"], "email": email})
            continue
        c = {"_note": SEED_TAG, "customerId": p["cid"], "qid": p["idn"], "idType": p["idt"], "name": p["name"],
             "firstName": p["first"], "middleName": p["middle"], "lastName": p["last"], "dob": p["dob"], "nationality": p["nat"],
             "segment": p["seg"], "email": email, "phone": ph, "preferredLanguage": p["lang"], "blacklisted": bool(p["bl"]),
             "moiValidationStatus": "Verified", "activePostpaidLines": p["pp"], "activePrepaidLines": p["pre"], "age": age(p["dob"]), "gender": p["sex"]}
        if p["pp"] or p["pre"]:
            c["lineType"] = "Postpaid" if p["pp"] else "Prepaid"
        if p["bl"]:
            c["blacklistCategory"] = p["bl"]
            c["blacklistReason"] = "Outstanding dues > threshold" if p["bl"] == "collections" else "Security restriction on new connections"
        if p.get("sub"):
            c["customerSubType"] = p["sub"]
        if p["hrn"]:
            c["hrnAdvancePaymentRequired"] = True
        if p["emp"]:
            c["companyName"] = p["emp"]
            employers.setdefault(p["emp"], None)
        custs.append(c)
        d = {"_note": SEED_TAG, "identityDocumentId": f"IDD-{n_doc}", "customerId": p["cid"], "documentType": p["idt"], "documentNumber": p["idn"]}
        if p["exp"]:
            d["expiryDate"] = p["exp"]
        d.update({"validationPath": "MOI Validation" if p["idt"] == "QID" else "Capture/Validate Details", "status": "Validated", "scanCompleted": True,
                  "scannedAt": "2026-09-30T10:00:00+03:00", "docStatus": "Active", "uploadDateTime": "2026-09-30T10:00:00+03:00", "serviceReference": p["cid"]})
        if p["idt"] == "Passport":
            d["issuingCountry"] = p["nat"]
        ndocs.append(d); n_doc += 1
        if "Retired" in p["disc"] and "FAILS" not in p["disc"]:
            retire.append(p["idn"])
        if p["pp"] or p["pre"]:
            aid, bid = f"ACC-{n_acc}", f"BILL-{n_bill}"
            n_acc += 1; n_bill += 1
            acct = {"_note": SEED_TAG, "accountId": aid, "customerId": p["cid"], "accountType": "Consumer Mobile Postpaid" if p["pp"] else "Consumer Mobile Prepaid",
                    "status": "Active", "billingProfileId": bid, "barringStatus": "Not Barred", "barringType": None, "barringReason": None}
            if p["cid"] == "CUST-3026":
                acct["specialManagement"] = "B2B2C Consumer"
            accts.append(acct)
            b = {k: v for k, v in tpl.items() if not k.startswith("_")}
            b.update({"_note": SEED_TAG, "billingProfileId": bid, "accountId": aid, "name": f"{p['name']} - Personal", "autoPayStatus": "Not Enrolled",
                      "billingContactName": p["name"], "billingContactPhone": ph, "billingContactEmail": email,
                      "billingLanguage": p["lang"], "paymentMethod": "Invoice", "creditLimitQAR": 50 if p["hrn"] else 1000, "billingAddress": "Doha, Qatar"})
            bills.append(b)
            if p["cid"] in ("CUST-3004", "CUST-3013"):
                oid = f"ORD-{n_ord}"; n_ord += 1
                orders.append({"_note": SEED_TAG, "orderId": oid, "orderType": "New Postpaid Activation", "orderSubType": "Consumer", "status": "Complete",
                               "customerId": p["cid"], "accountId": aid, "billingProfileId": bid, "productIds": ["PROD-100"], "totalQAR": 250, "mrcTotalQAR": 250,
                               "nrcTotalQAR": 0, "approvalStatus": "Approved", "createdBy": "USR-1101", "sourceChannel": "Retail Store"})
                aprs.append({"_note": SEED_TAG, "activityId": f"APR-{n_apr}", "orderId": oid, "approvalStatus": "Approved", "activityStatus": "Done", "owner": "USR-1103",
                             "channel": "Retail Store", "type": "Order Approval", "topic": "New Connection", "subTopic": "Postpaid Mobile", "area": "Sales",
                             "journeyName": "New Postpaid Connection", "mobileNumber": ph, "serviceAccount": f"SA-{n_apr}",
                             "orderApprovalStatus": "Approved", "orderCreatedDate": "2026-09-15"})
                n_apr += 1
        if p["emp"]:
            conts.append({"_note": SEED_TAG, "contactId": f"CONT-{n_cont}", "employer": p["emp"], "employeeName": p["name"], "employeeQid": p["idn"], "b2b2cEligible": True,
                          "planEligibility": "Postpaid Red 500 Promotion", "employeeCustomerId": p["cid"]})
            n_cont += 1
    ent = rd("enterprise-accounts")
    names = {e["name"] for e in ent}
    new_emp = []
    for k, emp in enumerate(sorted(employers)):
        if emp in names:
            continue
        new_emp.append({"_note": SEED_TAG, "enterpriseAccountId": f"ENT-ACC-82{k + 1:02d}", "level": "parent", "name": emp, "crType": "Commercial Registration",
                        "crId": f"CR-7{k + 1}1005", "crNumber": f"CR-7{k + 1}1005", "agentId": "AGT-2201", "businessType": "B2B2C", "creditLimit": None,
                        "creditLimitNeedsFinanceApproval": True, "parentAccountId": None, "contactsOnly": False})
    for c in conts:
        c["employerAccountId"] = next((e["enterpriseAccountId"] for e in ent + new_emp if e["name"] == c["employer"]), None)
    add("customers", "customerId", custs); add("identity-documents", "identityDocumentId", ndocs); add("nas-records", "nasRecordId", nrecs)
    add("accounts", "accountId", accts); add("billing-profiles", "billingProfileId", bills); add("orders", "orderId", orders)
    add("order-approvals", "activityId", aprs); add("contacts-b2b2c", "contactId", conts); add("enterprise-accounts", "enterpriseAccountId", new_emp)
    acc = {a["customerId"]: a["accountId"] for a in rd("accounts")}
    add("device-installments", "id", [{"_note": SEED_TAG, "id": "DOI-3101", "accountId": acc["CUST-3052"], "qid": "28707063400052", "deviceName": "Samsung Galaxy S24",
        "devicePriceQar": 3200, "downPaymentQar": 500, "installmentMonths": 12, "monthlyInstallmentQar": 225, "eligibilityListMembership": "Eligible",
        "qcbCreditCheckStatus": "Passed", "stockReservationStatus": "Reserved", "accountStanding": "Good Standing", "status": "Approved",
        "colourOptions": ["Onyx Black"], "storageOptions": ["128 GB", "256 GB"], "catalogStockStatus": "In Stock", "catalogStockNote": "In stock - same-day store pickup", "tradeInBonusQar": None}])
    add("commitment-penalties", "penaltyId", [{"_note": SEED_TAG, "penaltyId": "PEN-8201", "accountId": acc["CUST-3052"], "customerId": "CUST-3052", "actionType": "disconnection",
        "calculatedValue": 320, "currency": "QAR", "valueStoredPersistently": False, "calculationSource": "guided journey - disconnection (8 of 12 lock-in months done)",
        "orderId": None, "quoteRequiresOrder": True, "calculatedAt": "2026-09-30T10:15:00+03:00", "status": "Pending", "blocksNewConnection": False}])
    # Two reservations for CUST-3071 (made at different times); the picker shows the time and selects the newest.
    nums = rd("numbers")
    for n_ in nums:
        if n_.get("msisdn") == "+97433001001":
            n_["reservedAt"] = "2026-10-04T09:15:00+03:00"
            n_["reservedForQid"] = "27801063400071"
    wr("numbers", nums)
    add("numbers", "msisdn", [{"_note": SEED_TAG, "msisdn": "+97455610140", "category": "Free", "status": "Reserved", "reservedBy": "Fatima Al-Kuwari", "priceQAR": 0, "reservedAt": "2026-10-04T14:35:00+03:00", "reservedForQid": "27801063400071"}])
    add("sims", "simSerial", [{"_note": SEED_TAG, "simSerial": "8974412009900130001", "iccid": "8974412009900130001", "type": "Physical", "stockStatus": "Issued", "swapStatus": "Original"},
                              {"_note": SEED_TAG, "simSerial": "8974412009900130002", "iccid": "8974412009900130002", "type": "Printed eSIM", "stockStatus": "Issued", "swapStatus": "Original"}])
    # Every customer needs a contact record (Customer 360 Contact Information, billing contact
    # picker) and cross-sales offers keyed to it, or the New Connection Offers step shows
    # "No cross-sales offer available". Two postpaid offers each; existing records untouched.
    all_c = rd("customers")
    docs_by = {}
    for d in rd("identity-documents"):
        docs_by.setdefault(d["customerId"], []).append(d)
    have_contact = {c["customerId"] for c in rd("customer-contacts")}
    new_contacts, new_offers = [], []
    for c in all_c:
        cid = c["customerId"]
        if cid in have_contact:
            continue
        own = docs_by.get(cid, [])
        d = next((x for x in own if x["documentType"] == "QID"), own[0] if own else None)
        ctc = f"CTC-{cid}"
        new_contacts.append({"_note": SEED_TAG, "contactRecordId": ctc, "customerId": cid, "firstName": c.get("firstName", ""), "middleName": c.get("middleName", ""),
                             "lastName": c.get("lastName", ""), "idType": d["documentType"] if d else c.get("idType", ""), "idNumber": d["documentNumber"] if d else c.get("qid", ""),
                             "idExpirationDate": d.get("expiryDate") if d else None, "nationality": c["nationality"], "dob": c["dob"], "gender": c.get("gender", ""),
                             "preferredLanguage": c.get("preferredLanguage", "English"), "cellNumber": c.get("phone", ""), "workPhone": None, "employerEmail": None})
        for n, (name, prod, rent, desc) in enumerate([
            ("Postpaid Red 500 Welcome Offer", "PROD-105", 500, "Open a new Postpaid Red 500 line with the welcome bundle"),
            ("Postpaid Red 350 Switch-On Offer", "PROD-104", 350, "Open a new Postpaid Red 350 line with a free first-month add-on"),
        ], 1):
            new_offers.append({"_note": SEED_TAG, "offerId": f"OFR-{cid}-{n}", "offerType": "Cross Sell", "offerName": name, "monthlyRental": rent, "offerDescription": desc,
                               "campaignCode": "CMP-NEW-0930", "priorityCode": f"P{n}", "serviceIdentifier": c.get("phone", ""), "status": "Offered", "treatmentCode": f"TRT-0{n}",
                               "channel": "Guided Journey", "promotionId": f"PROMO-90{n}5", "price": rent, "addOnMonthly": 0, "linkedProductIds": [prod], "contactId": ctc,
                               "serviceJourney": "new-postpaid"})
    # An unpaid bill is what turns the collections flag into a Collections Check soft-stop: the
    # eligibility step sums every non-Paid bill for the customer and a QAR 0 balance does not block.
    # (CUST-3073 deliberately has none.) Without these, CUST-1004 / CUST-3046 passed the check.
    add("bills", "billId", [
        {"_note": SEED_TAG, "billId": f"BILL-91{n:02d}", "type": "bill", "accountId": acc.get(cid), "customerId": cid, "billPeriod": "2026-08",
         "totalAmount": amt, "status": "overdue", "dueDate": "2026-09-14", "isTaxInvoice": True,
         "note": "Overdue balance seeded so the Collections Check soft-stop is reachable for this collections-blacklisted customer."}
        for n, (cid, amt) in enumerate([("CUST-1004", 450.0), ("CUST-3046", 310.5)], 1)
    ])
    add("customer-contacts", "contactRecordId", new_contacts)
    add("cross-sales-offers", "offerId", new_offers)
    reg = rd("govt-retiree-registry")
    reg["retiredIdNumbers"] = sorted(set(reg["retiredIdNumbers"]) | set(retire))
    wr("govt-retiree-registry", reg)
    refresh_seeded(rd, wr)
    apply_names(rd, wr)
    apply_hrn(rd, wr)
    apply_benefits(rd, wr)
    print("seeded:", {k: v for k, v in added.items() if v}, "| retiree registry now", len(reg["retiredIdNumbers"]))


if "--seed" in sys.argv:
    seed()
    sys.exit(0)


# --------------------------------------------------------------------------
# Assemble rows
# --------------------------------------------------------------------------
HDR = ["Test ID", "Customer / NAS ID", "Status in app", "Category", "Full name", "First name", "Middle name(s)", "Last name", "Nationality", "Nationality group", "ID type", "ID number (use for lookup)",
       "ID expiry", "Date of birth", "Age", "Gender", "Segment", "Language", "Mobile", "Postpaid lines", "Prepaid lines", "Total mobile lines",
       "Blacklist", "Risk class", "Employer (B2B2C)", "Discount eligibility", "MNP / porting", "Scenario", "Journeys to run", "Expected outcome", "Roles that can run the primary journey", "Seed notes / evidence"]
rows = []
roles_feat = {r["staffId"]: {f["key"] for f in r["features"]} for r in personas}


def roles_for(jk):
    return ", ".join(sid for sid, fs in roles_feat.items() if all(k in fs for k in jk))


doc_by_cust = {}
for d in docs:
    doc_by_cust.setdefault(d["customerId"], []).append(d)
used_phones = set()

PROP_IDS = {p["cid"] for p in PROPOSED}
for cid, c in customers.items():
    if cid in PROP_IDS:
        continue
    a = SEED[cid]
    ds = doc_by_cust.get(cid, [])
    # prefer the document the app's lookup resolves on; list all if several
    # Same document order for type, number and expiry, so the three columns line up one-to-one.
    idt = " / ".join(d["documentType"] for d in ds) or c.get("idType", "")
    idn = " / ".join(d["documentNumber"] for d in ds) or c.get("qid", "")
    exp = " / ".join(d.get("expiryDate", "") for d in ds)
    nat = c["nationality"]
    grp = "Qatari" if nat == "Qatari" else ("GCC" if c.get("idType") == "GCC ID" else "Expat")
    bl = (c.get("blacklistCategory") or "") if c.get("blacklisted") else ""
    note = []
    if c.get("qid") and c["qid"] not in idn:
        note.append(f"customers.json qid {c['qid']} differs from the identity-document number(s); the app looks up by the document number.")
    if c.get("qid") in retiree_ids or any(d["documentNumber"] in retiree_ids for d in ds):
        note.append("An ID of this customer is in govt-retiree-registry.json.")
    note.append("Original demo data: customers.json" + (", identity-documents.json" if ds else ""))
    used_phones.add(c.get("phone"))
    rows.append(["", cid, ORIG, a["cat"], c["name"], c.get("firstName", ""), c.get("middleName", ""), c.get("lastName", ""), nat, grp, idt, idn, exp, c.get("dob", ""), age(c["dob"]) if c.get("dob") else "", c.get("gender", ""),
                 c.get("segment", ""), c.get("preferredLanguage", ""), c.get("phone", ""), c.get("activePostpaidLines", ""), c.get("activePrepaidLines", ""),
                 (c.get("activePostpaidLines", 0) + c.get("activePrepaidLines", 0)) if "activePostpaidLines" in c else "",
                 bl or ("(blacklisted)" if c.get("blacklisted") else "No"), "HRN" if is_hrn(c.get("nationality")) else "Standard", c.get("companyName", ""),
                 a["disc"], a["mnp"], a["scen"], a["journeys"], a["expected"], roles_for(a["jk"]), " ".join(note)])
for n in nas:
    if n["nasRecordId"] in PROP_IDS:
        continue
    a = SEED_NAS[n["nasRecordId"]]
    rows.append(["", n["nasRecordId"], ORIG + " (NAS only)", a["cat"], n["name"], n.get("firstName", ""), n.get("middleName", ""), n.get("lastName", ""), n["nationality"], "Qatari" if n["nationality"] == "Qatari" else "Expat", n["documentType"],
                 n["documentNumber"], n["expiryDate"], n["dob"], age(n["dob"]), n["gender"], "Not a customer", "", "", 0, 0, 0, "No", "HRN" if is_hrn(n["nationality"]) else "Standard", "", a["disc"], a["mnp"],
                 a["scen"], a["journeys"], a["expected"], roles_for(a["jk"]), "Original demo data: nas-records.json (no customers.json row)"])

for i, p in enumerate(PROPOSED):
    ph = f"+974{55513001 + i}"
    new = p["status"].startswith("New")
    rows.append(["", p["cid"], ADDED, p["cat"], p["name"], p["first"], p["middle"], p["last"], p["nat"], p["grp"], p["idt"], p["idn"], p["exp"], p["dob"], age(p["dob"]), p["sex"],
                 "Not a customer" if new else p["seg"], p["lang"], "" if new else ph, "" if new else p["pp"], "" if new else p["pre"], 0 if new else p["pp"] + p["pre"],
                 p["bl"] or "No", "HRN" if p["hrn"] else "Standard", p["emp"], p["disc"], p["mnp"], p["scen"], p["journeys"], p["expected"], roles_for(p["jk"]),
                 ("Synthetic record. " + p["extra"]).strip()])

# collision check (only meaningful before --seed has written the records)
blob = "".join(f.read_text() for f in MOCK.glob("*.json"))
if SEED_TAG not in blob:
    for r in rows:
        if r[2] == ADDED:
            for v in (r[HDR.index("ID number (use for lookup)")], r[HDR.index("Mobile")]):
                if v and v in blob:
                    sys.exit(f"ABORT: synthetic value {v} for {r[1]} already exists in mock-data")
ids = [r[1] for r in rows]
if len(ids) != len(set(ids)):
    sys.exit("ABORT: duplicate customer ids")
rows.sort(key=lambda r: (r[3], r[1]))
for i, r in enumerate(rows, 1):
    r[0] = f"TC-{i:03d}"

# --------------------------------------------------------------------------
# Workbook
# --------------------------------------------------------------------------
RED, DARK = "E60000", "262626"
hfont = Font(bold=True, color="FFFFFF", name="Calibri")
hfill = PatternFill("solid", fgColor=RED)
thin = Side(style="thin", color="D9D9D9")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
FILL_SEEDED = PatternFill("solid", fgColor="E8F5E9")
FILL_PROP = PatternFill("solid", fgColor="FFF8E1")


def sheet(wb, title, header, data, widths=None, first=False, wrap_cols=()):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append(header)
    for r in data:
        ws.append(r)
    for c in ws[1]:
        c.font, c.fill, c.border = hfont, hfill, border
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.border = border
            c.alignment = Alignment(wrap_text=True, vertical="top")
    for i, h in enumerate(header, 1):
        ws.column_dimensions[get_column_letter(i)].width = (widths or {}).get(h, min(max(len(str(h)) + 2, 12), 28))
    ws.freeze_panes = "E2" if len(header) > 6 else "A2"
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_view.zoomScale = 90
    return ws


wb = Workbook()

# README
n_seed = sum(r[2].startswith(ORIG) for r in rows)
n_prop = len(rows) - n_seed
readme = [
    ["Vodafone Qatar DXP - Customer Inventory (test data)"],
    [f"Generated {AS_OF.isoformat()} by reference/scripts/build_customer_inventory.py. Do not hand-edit; change the script and re-run."],
    [""],
    [f"{len(rows)} test customers, ALL loaded in the running app: {n_seed} original demo records and {n_prop} added on 2026-10-02 by this script's --seed step (see 'Seeded Records')."],
    ["Original rows are parsed from public/mock-data. Added rows have synthetic IDs, phones and QIDs, checked not to collide with any existing record before seeding."],
    [""],
    ["How to use"],
    ["1. Sign in with any Staff ID on the 'Roles & Login' sheet (one shared demo password)."],
    ["2. Look the customer up by the value in 'ID number (use for lookup)' or by the Mobile number (Customer Search / ID Lookup step)."],
    ["3. Run the 'Journeys to run' and compare against 'Expected outcome'. 'Roles that can run the primary journey' lists the Staff IDs granted the feature."],
    ["4. 'Scenario Coverage' maps each requested scenario to its test customers."],
    [""],
    ["Colour key (Customers sheet)"],
    ["Green row = original demo data.   Amber row = added by the 2026-10-02 seed."],
    [""],
    ["Basis of the 'Expected outcome' column"],
    ["Rules implemented in src/engines/ruleEngine.ts (BR-113, BR-288, BR-347), src/engines/eligibilityEngine.ts (7 checks), and the BRSD rules in public/config/business-rules.json (BR-108/110/111/169/187/264/265/266). Where the app and the requirement disagree, the row says so and the item is on 'Open Questions'."],
    ["Discount eligibility is mostly AGENT-VALIDATED in the app, not computed from customer data: MADA and B2B2C need a supporting ID + proof document; Retired is checked against a DEMO government registry; Loyalty is offered on the plan. See 'Open Questions'."],
]
ws = wb.active; ws.title = "README"
for r in readme:
    ws.append(r)
ws.column_dimensions["A"].width = 150
ws["A1"].font = Font(bold=True, size=16, color=RED)
for r in (7, 13, 16):
    ws.cell(r, 1).font = Font(bold=True)
for row in ws.iter_rows():
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical="top")

# Customers
W = {"Test ID": 9, "Customer / NAS ID": 13, "Status in app": 16, "Category": 22, "Full name": 34, "First name": 13, "Middle name(s)": 24, "Last name": 14, "Nationality": 12, "Nationality group": 14, "ID type": 14,
     "ID number (use for lookup)": 24, "ID expiry": 12, "Date of birth": 12, "Age": 6, "Gender": 8, "Segment": 14, "Language": 10, "Mobile": 14,
     "Postpaid lines": 9, "Prepaid lines": 9, "Total mobile lines": 9, "Blacklist": 11, "Risk class": 11, "Employer (B2B2C)": 20, "Discount eligibility": 34, "MNP / porting": 30,
     "Scenario": 50, "Journeys to run": 32, "Expected outcome": 60, "Roles that can run the primary journey": 34, "Seed notes / evidence": 40}
ws = sheet(wb, "Customers", HDR, rows, W)
for row in ws.iter_rows(min_row=2):
    f = FILL_SEEDED if str(row[2].value).startswith(ORIG) else FILL_PROP
    for c in row[:4]:
        c.fill = f

# Scenario coverage
tc = {r[1]: r[0] for r in rows}
reqmap = {}
for p in PROPOSED:
    if p["req"]:
        reqmap.setdefault(p["req"], []).append(p["cid"])
cov = [
    ("Qatari - single active postpaid line", "Requested", ["CUST-1001"]),
    ("Qatari - 2 active postpaid lines", "Requested", reqmap["Qatari 2 lines"]),
    ("Qatari - 5 lines (at cap); 6th line needs approval", "Requested", reqmap["Qatari 5 lines (at cap)"] + reqmap["Qatari 6 lines (approved above cap)"]),
    ("Expat - 1 postpaid line", "Requested", reqmap["Expat 1 line"]),
    ("Expat - 2 postpaid lines", "Requested", reqmap["Expat 2 lines"]),
    ("Expat - 3 active lines (3rd obtained via approval; cap 2)", "Requested", reqmap["Expat 3 lines + approval"]),
    ("Existing customer eligible for further (loyalty) discounts", "Requested", ["CUST-1001", "CUST-1003"] + reqmap["Existing customer further discount"]),
    ("Customer with two reserved numbers (reservation time, newest selected by default)", "Added", reqmap["Two reserved numbers"]),
    ("MADA discount eligible", "Requested", reqmap["MADA eligible"] + ["CUST-3024 (MADA or B2B2C, by plan)", "CUST-3027 (Retired or MADA, one per journey)"]),
    ("Retired-person discount eligible", "Requested", ["CUST-1001 (via scan ID)"] + reqmap["Retired person discount"] + reqmap["Retired + MADA"]),
    ("Retired - validation FAILS (negative)", "Added", reqmap["Retired - validation failure"]),
    ("B2B2C type discount", "Requested", ["CUST-1002"] + reqmap["B2B2C type discount"]),
    ("Both MADA and B2B2C eligible", "Requested", reqmap["MADA + B2B2C both eligible"]),
    ("B2B2C with pre-existing Special Management", "Added", reqmap["B2B2C + Special Management"]),
    ("New customer (not in Siebel)", "Requested", ["NAS-7001", "NAS-7002", "NAS-7003", "NAS-7004"]),
    ("Mobile Number Portability - new customer", "Requested", ["NAS-7001", "NAS-7002", "NAS-7003"]),
    ("MNP - existing customer / conditional accept", "Added", ["CUST-1004 (seeded MNP-11002)"] + reqmap["Existing customer MNP / conditional accept"]),
    ("MNP - rejection (name mismatch)", "Added", reqmap["MNP rejection"]),
    ("MNP - multi-number (Passport)", "Added", reqmap["MNP multi-number passport"]),
    ("MNP + B2B2C", "Added", reqmap["MNP + B2B2C"]),
    ("Port-out / FNP", "Added", ["CUST-1001 (POUT-17001)", "CUST-1002 (POUT-17002)", "CUST-1003 (POUT-17003, FNP-12001)"]),
    ("HRN customer (QR 100 advance)", "Added", ["CUST-1002"] + reqmap["HRN customer"] + reqmap["HRN passport at prepaid cap"] + reqmap["HRN on Other ID"]),
    ("HRN combined with B2B2C / with expat line cap", "Added", reqmap["HRN + B2B2C"] + reqmap["HRN at expat line cap"]),
    ("HRN nationality list coverage (each listed country)", "Added", ["CUST-3026 (Pakistan)", "CUST-3061 (Bangladesh)", "CUST-3068 (Cambodia)", "CUST-3064 (Myanmar)", "CUST-3069 (Laos)", "CUST-3017 (Kenya)", "CUST-3062 (Uganda)", "CUST-3070 (Eswatini)"]),
    ("Sawfa / Sawfa Plus (Qatari categories)", "Added", reqmap["Sawfa"] + reqmap["Sawfa Plus"]),
    ("Other ID (resident-permit style)", "Added", ["CUST-2001"] + reqmap["Other ID"]),
    ("Expat combined 5-line cap / Passport prepaid cap / GCC cap", "Added", ["CUST-1005"] + reqmap["Expat combined 5-line cap"] + reqmap["Expat passport at prepaid cap"]),
    ("Blacklist - collections (soft stop) / security (hard stop)", "Added", ["CUST-1004", "CUST-1006"] + reqmap["Collections blacklist (expat)"] + reqmap["Security blacklist (expat)"]),
    ("ID problems - expired / no expiry / under 18 / age 18", "Added", ["CUST-1006", "CUST-9001"] + reqmap["Expired ID"] + reqmap["No expiry on file"] + reqmap["Age boundary"]),
    ("Expat 5-line absolute maximum (Active Lines hard stop)", "Added", reqmap["Expat line-cap hard stop (5/5)"]),
    ("Collections flag with QAR 0 balance (not a block)", "Added", reqmap["Collections flag, zero balance"]),
    ("Exception-routed ID types (Passport / GCC / Diplomatic / Other)", "Added", ["CUST-1002", "CUST-1005", "CUST-1007", "CUST-2001"] + reqmap["Diplomatic ID (valid)"]),
    ("Prepaid-only customer / pre-to-post migration", "Added", reqmap["Qatari prepaid-only"]),
    ("SIM swap / lock-in penalty / device instalment / FWA / premium", "Added", reqmap["SIM swap"] + reqmap["Lock-in penalty / device installment"] + reqmap["FWA / multi-product"] + reqmap["Premium / retention"]),
]
covrows = []
for s, origin, ids_ in cov:
    refs = []
    for x in ids_:
        base = x.split(" ")[0]
        refs.append(f"{tc[base]} ({x})" if base in tc else x)
    covrows.append([s, origin, len(ids_), "; ".join(refs)])
sheet(wb, "Scenario Coverage", ["Scenario", "Requested / Added", "# customers", "Test customers"], covrows, {"Scenario": 55, "Requested / Added": 14, "# customers": 11, "Test customers": 110})

# Eligibility coverage: one row per outcome each of the eligibility checks can produce
# (src/engines/eligibilityEngine.ts), with the customers that actually trigger it. The customer lists were
# produced by running the real evaluateEligibilityChecks + BR-288/BR-347 over every customers.json record
# against its identity document (as the Eligibility step does) on 2026-10-04 - not inferred from scenario
# text. Re-derive them after changing eligibility rules or customer data. Postpaid journey unless noted.
ELIG = [
    ("ID Validity", "Hard stop", "ID expired", ["CUST-1006", "CUST-3041"]),
    ("ID Validity", "Approval routing", "No expiry date on file", ["CUST-3042"]),
    ("Age Check", "Hard stop", "Under 18", ["CUST-9001"]),
    ("ID Type", "Approval routing", "Passport / GCC ID / Other ID", ["CUST-1002", "CUST-1005", "CUST-2001", "CUST-3016", "CUST-3032", "CUST-3061", "CUST-3063", "CUST-3067"]),
    ("Collections Check", "Soft stop", "Collections flag AND unpaid balance above QAR 0", ["CUST-1004", "CUST-3046"]),
    ("Collections Check", "Pass (flag, QAR 0 owed)", "Collections flag but nothing owed - not a block", ["CUST-3073"]),
    ("Security Check", "Hard stop", "Security blacklist", ["CUST-1006", "CUST-3043"]),
    ("Blacklist Check (unclassified)", "Hard stop", "Blacklisted with no category - NO CUSTOMER (see Open Questions Q10)", []),
    ("Deals Check", "Hard stop", "Penalty with blocksNewConnection", ["CUST-2001"]),
    ("Active Lines", "Approval routing", "Qatari at 5 / expat at 2-4 postpaid lines", ["CUST-3002", "CUST-3004", "CUST-3012", "CUST-3013", "CUST-3014", "CUST-1005", "CUST-3064"]),
    ("Active Lines", "Hard stop", "Expat at the 5-line maximum", ["CUST-3072"]),
    ("Active Lines (prepaid journey)", "Approval routing", "Passport/GCC at 2 prepaid, or expat QID at 5 combined", ["CUST-1005", "CUST-3014", "CUST-3016", "CUST-3032", "CUST-3061", "CUST-3072"]),
    ("HRN upfront payment", "Advisory (QAR 100 advance)", "HRN nationality", ["CUST-3017", "CUST-3026", "CUST-3033", "CUST-3046", "CUST-3061", "CUST-3062", "CUST-3063", "CUST-3064", "CUST-3068", "CUST-3069", "CUST-3070"]),
    ("All checks pass", "Pass", "Clean run, no approval", ["CUST-1001", "CUST-1003", "CUST-3001", "CUST-3011"]),
]
_hx = {h: i for i, h in enumerate(HDR)}
_rowby = {r[_hx["Customer / NAS ID"]]: r for r in rows}
def _lookup_id(cid):
    return _rowby[cid][_hx["ID number (use for lookup)"]]
erows = []
for chk, outc, trig, ids_ in ELIG:
    # The ID to type into Customer Search (the "ID number (use for lookup)" column), not the TC-### label.
    erows.append([chk, outc, trig, len(ids_), "; ".join(f"{_lookup_id(i)} ({i})" for i in ids_) or "-"])
sheet(wb, "Eligibility Coverage", ["Eligibility check", "Outcome", "Triggered by", "# customers", "Test customers"], erows, {"Eligibility check": 30, "Outcome": 26, "Triggered by": 52, "# customers": 11, "Test customers": 110})

# Retired / MADA quick reference: the QID to look up for each customer-type discount case, read from the
# Customers rows above so it can never drift from them.
_ix = {h: i for i, h in enumerate(HDR)}
_by_id = {r[_ix["Customer / NAS ID"]]: r for r in rows}
RM = [
    ("Retired - validation PASSES", "CUST-3022", "Office-ID scan -> ID sent to the retiree registry -> 'Retired status validated with the government'."),
    ("Retired - validation PASSES (registry holds the scan ID)", "CUST-1001", "The scan ID is in the registry; the customer-record QID differs."),
    ("Retired - validation FAILS", "CUST-3023", "'This ID number could not be validated as a retired customer with the government system.'"),
    ("MADA - agent validated", "CUST-3021", "Supporting ID and proof document required. MADA -10% and Loyalty -15% both apply: only one discount per order."),
    ("MADA or B2B2C - the plan decides", "CUST-3024", "Red 350 gives MADA, Red 500 gives B2B2C; switching plan retires the other."),
    ("Retired or MADA - one per journey", "CUST-3027", "The customer-type step is single choice: run twice to confirm each path."),
]
rm_rows = []
for case, cid, note in RM:
    r = _by_id.get(cid)
    if r:
        rm_rows.append([case, str(r[_ix["ID number (use for lookup)"]]), r[_ix["Full name"]], cid, note])
sheet(wb, "Retired & MADA QIDs", ["Case", "QID to look up", "Customer", "Customer ID", "What to expect"], rm_rows, {"Case": 48, "QID to look up": 18, "Customer": 38, "Customer ID": 12, "What to expect": 100})

# Eligibility coverage: which test customer lands on each outcome of the seven matrix checks.
# Parsed from the same data the app reads, applying the rules in src/engines/eligibilityEngine.ts and
# BR-288 (src/engines/ruleEngine.ts) - nothing is hand-assigned. A blank outcome row (no customer) is a
# coverage gap and is written as such.
_bills = load("bills")
_pens = load("commitment-penalties")
_owed = {}
for _b in _bills:
    if _b.get("status") != "Paid":
        _owed[_b["customerId"]] = _owed.get(_b["customerId"], 0) + (_b.get("totalAmount") or 0)
_blockers = {_x["customerId"] for _x in _pens if _x.get("blocksNewConnection")}
EXC_IDS = {"Passport", "GCC ID", "Other ID"}
_cov = {}


def _hit(check, outcome, cid, why):
    _cov.setdefault((check, outcome), []).append((cid, why))


for _cid, _c in customers.items():
    _d = (doc_by_cust.get(_cid) or [{}])[0]
    _ex = _d.get("expiryDate")
    if not _ex:
        _hit("ID Validity", "Approval routing", _cid, "No expiry date on file - manual validity check")
    elif _ex < AS_OF.isoformat():
        _hit("ID Validity", "Hard stop", _cid, f"ID expired {_ex}")
    else:
        _hit("ID Validity", "Pass", _cid, f"Valid through {_ex}")
    _a = age(_c["dob"]) if _c.get("dob") else None
    if _a is not None and _a < 18:
        _hit("Age Check", "Hard stop", _cid, f"Age {_a} (under 18)")
    elif _a == 18:
        _hit("Age Check", "Pass", _cid, "Age 18 - boundary, passes")
    if (_d.get("documentType") or _c.get("idType")) in EXC_IDS:
        _hit("ID Type", "Approval routing", _cid, f"{_d.get('documentType') or _c.get('idType')} is exception-routed to CBM approval")
    if _c.get("blacklisted"):
        _cat = _c.get("blacklistCategory")
        if _cat == "collections":
            if _owed.get(_cid, 0) > 0:
                _hit("Collections Check", "Soft stop", _cid, f"Collections flag with QAR {_owed[_cid]:g} outstanding - postpaid blocked, prepaid offered")
            else:
                _hit("Collections Check", "Pass", _cid, "Collections flag but QAR 0 owed - the flag alone does not block")
        elif _cat == "security":
            _hit("Security Check", "Hard stop", _cid, "Corporate security blacklist - no further action at the counter")
        else:
            _hit("Blacklist Check (unclassified)", "Hard stop", _cid, "Blacklisted with no category recorded")
    if _cid in _blockers:
        _hit("Deals Check", "Hard stop", _cid, "A pending deal/penalty blocks new connections")
    _n = _c.get("activePostpaidLines") or 0
    _q = _c["nationality"] == "Qatari"
    if _q and _n >= 5:
        _hit("Active Lines", "Approval routing", _cid, f"Qatari at/over the 5-line cap ({_n} active) - no maximum")
    elif not _q and _n >= 5:
        _hit("Active Lines", "Hard stop", _cid, f"Expat absolute maximum of 5 reached ({_n} active)")
    elif not _q and _n >= 2:
        _hit("Active Lines", "Approval routing", _cid, f"Expat cap of 2 reached ({_n} active)")
    if is_hrn(_c["nationality"]):
        _hit("HRN advance payment", "Advisory only", _cid, f"{_c['nationality']} is on the HRN list - QAR 100 advance required")

_clean = [c for c in customers if c in {"CUST-1001", "CUST-3001"}]
_cov_order = [
    ("ID Validity", "Hard stop"), ("ID Validity", "Approval routing"), ("Age Check", "Hard stop"), ("Age Check", "Pass"),
    ("ID Type", "Approval routing"), ("Collections Check", "Soft stop"), ("Collections Check", "Pass"), ("Security Check", "Hard stop"),
    ("Deals Check", "Hard stop"), ("Active Lines", "Approval routing"), ("Active Lines", "Hard stop"), ("HRN advance payment", "Advisory only"),
]
cov_rows = []
for _chk, _out in _cov_order:
    _hits = _cov.get((_chk, _out), [])
    if not _hits:
        cov_rows.append([_chk, _out, "-", "-", "-", "-", "-", "GAP - no customer reaches this outcome"])
    for _cid, _why in _hits:
        _r = _by_id.get(_cid)
        if _r:
            cov_rows.append([_chk, _out, _r[_ix["Test ID"]], _cid, _r[_ix["Full name"]], _r[_ix["ID type"]], str(_r[_ix["ID number (use for lookup)"]]), _why])
sheet(wb, "Eligibility Coverage", ["Eligibility check", "Outcome", "Test ID", "Customer ID", "Customer", "ID type", "ID number (use for lookup)", "Why it lands here"], cov_rows,
      {"Eligibility check": 30, "Outcome": 18, "Test ID": 9, "Customer ID": 12, "Customer": 38, "ID type": 16, "ID number (use for lookup)": 26, "Why it lands here": 80})

# Seed spec
spec = []
for p in PROPOSED:
    t = tc[p["cid"]]
    if p["status"].startswith("New"):
        spec.append([t, p["cid"], "nas-records.json", f"Add NAS record: documentType QID, documentNumber {p['idn']}, expiryDate {p['exp']}, name '{p['name']}', dob {p['dob']}, nationality {p['nat']}, gender {p['sex']}, email."])
        continue
    spec.append([t, p["cid"], "customers.json", f"Add customer {p['cid']}: name '{p['name']}', idType {'QID' if p['idt']=='QID' else p['idt']}, nationality {p['nat']}, dob {p['dob']}, activePostpaidLines {p['pp']}, activePrepaidLines {p['pre']}"
                 + (f", blacklisted true + blacklistCategory '{p['bl']}' + blacklistReason" if p["bl"] else "") + (", hrnAdvancePaymentRequired true" if p["hrn"] else "") + (f", companyName '{p['emp']}'" if p["emp"] else "") + "."])
    spec.append([t, p["cid"], "identity-documents.json", f"Add {p['idt']} {p['idn']} " + (f"expiring {p['exp']}" if p["exp"] else "with NO expiryDate field (to trigger the no-expiry check)") + ", docStatus Active, status Validated."])
    if "Retired" in p["disc"] and "FAILS" not in p["disc"]:
        spec.append([t, p["cid"], "govt-retiree-registry.json", f"Add {p['idn']} to retiredIdNumbers."])
    if p["emp"]:
        spec.append([t, p["cid"], "contacts-b2b2c.json", f"Add contact linking employee to employer '{p['emp']}' (b2b2cEligible true); add employer to enterprise-accounts.json if absent."])
    if "Special Management" in p["scen"]:
        spec.append([t, p["cid"], "accounts.json", "Set the account's Special Management value so BR-265 fires."])
    if p["pp"] >= 3 and "approval" in p["scen"]:
        spec.append([t, p["cid"], "orders.json / order-approvals.json", "Add the approved order (and approval row) that granted the earlier line, so Order history shows the workflow approval."])
    if "MNP" in p["cat"]:
        spec.append([t, p["cid"], "mnp-portin-orders.json", "Add a port-in order shaped as the scenario describes (donor, status, conditionalAcceptanceTriggered / rejectionReasonCode)."])
    if p["cid"] in ("CUST-3052",):
        spec.append([t, p["cid"], "device-installments.json / commitment-penalties.json", "Add a 12-month Galaxy S24 instalment and a lock-in with 8 months completed."])
    if p["cid"] == "CUST-3051":
        spec.append([t, p["cid"], "sims.json", "Add the customer's issued physical SIM and an eSIM."])
sheet(wb, "Seeded Records", ["Test ID", "Customer ID", "File (public/mock-data/)", "Records to add"], spec, {"Test ID": 9, "Customer ID": 12, "File (public/mock-data/)": 32, "Records to add": 130})

# Roles & Login
rl = [[r["staffId"], r["name"], r["group"], r["businessUnitLabel"], r["approach"], r["channel"], password] for r in personas]
sheet(wb, "Roles & Login", ["Staff ID", "Role", "Persona group", "Business unit", "Approach", "Channel", "Demo password"], rl,
      {"Staff ID": 11, "Role": 36, "Persona group": 38, "Business unit": 20, "Approach": 14, "Channel": 24, "Demo password": 16})

# Journey access
JK = [("workspace.customer-search", "Customer Search"), ("workspace.customer360-view", "Customer 360"), ("postpaid.new-postpaid-wizard", "New Postpaid"),
      ("prepaid.new-prepaid-tablet-wizard", "New Prepaid"), ("mnp.process-choice", "MNP process choice"), ("mnp.port-in-wizard", "MNP / FNP port-in"),
      ("numbers.sim-swap-queue", "SIM swap queue"), ("migration.pre-to-post-wizard", "Pre-to-post migration"), ("fwa.new-fwa-wizard", "New FWA"),
      ("fixedline.new-fixed-line-wizard", "New Fixed Line"), ("orders.approval-queue", "Order approval queue"), ("orders.my-sales-orders", "My sales orders")]
ja = []
for r in personas:
    lv = {f["key"]: f["level"] for f in r["features"]}
    ja.append([r["staffId"], r["name"]] + [lv.get(k, "") for k, _ in JK])
ws = sheet(wb, "Journey Access by Role", ["Staff ID", "Role"] + [l for _, l in JK], ja, {"Staff ID": 11, "Role": 36})
ws.cell(len(ja) + 3, 1, "Source: public/config/personas.json feature grants. A level means the role is GRANTED the feature - whether the screen is built is tracked in VFQ_DXP_Persona_Feature_Applicability_Matrix_Reference.xlsx. Blank = deliberately not granted.")

# Open questions
oq = [
    ["Q1", "Qatari line cap of 5", "DECIDED and IMPLEMENTED 2026-10-02: Qatari max 5 active postpaid lines, expat max 2; exceeding either routes to approval. ruleEngine.ts BR-288 now enforces both. business-rules.json BR-110 (source-corpus text, 'unlimited for nationals') was left as recorded evidence and is superseded for postpaid.", "None for the app. Reconcile the BR-110 text if the rule catalogue should match.", "CUST-3001, 3002, 3004"],
    ["Q2", "Expat 3-line customer", "Expat cap of 2 means the 3rd line already needed approval. CUST-3012 (2 lines) tests the trigger; CUST-3013 (3 lines) models the post-approval state and re-triggers approval for a 4th.", "None - consistent with the decided rule.", "CUST-3012, CUST-3013"],
    ["Q3", "MADA eligibility source", "DECIDED: MADA stays agent-validated. The agent selects MADA and supplies a card/reference number plus proof document; no registry lookup. The MADA reference number in this inventory is invented.", "None.", "CUST-3021, 3024, 3027"],
    ["Q4", "Loyalty / 'eligible for further discounts'", "Loyalty -15% (ADO-7105..7108) is offered on the plan regardless of customer history; no eligibility check against tenure or line count exists.", "Define the eligibility criterion; then add a flag so 'eligible' vs 'not eligible' customers differ (CUST-3029 is the control).", "CUST-1001, 3028, 3029"],
    ["Q5", "Retired-person registry is a DEMO stand-in", "govt-retiree-registry.json is explicitly an assumption, not in the source corpus.", "Replace with the real service contract when known.", "CUST-3022, 3023, 3027"],
    ["Q6", "CUST-1001 has two different QIDs", "customers.json qid 28512345678 vs identity-documents 28456701234 (both are in the retiree registry). The app resolves by the document number.", "Reconcile in the seed data; also note a 41-year-old being a registered retiree.", "CUST-1001"],
    ["Q7", "Seed gaps - what was NOT modelled", "Seeding added customers, ID documents, accounts, billing profiles, employers, B2B2C links, retiree registry IDs, approval-history orders, one device instalment/penalty and SIMs. NOT seeded: port-in orders (MNP rows are journey-driven), FWA/multi-SIM assets. The Special Management flag is stored on the account but the app has no BR-265 prompt that reads it.", "Build the BR-265 prompt, or seed the missing assets, if those journeys need data on first open.", "CUST-3026, 3053, 3054"],
    ["Q9", "HRN list and Sawfa behaviour", "DECIDED 2026-10-02: HRN = nationality is Pakistan, Bangladesh, Cambodia, Myanmar, Laos, Kenya, Uganda or Eswatini; every other nationality is not HRN. Implemented in ruleEngine.ts (isHrnNationality), read by the eligibility gate and Customer 360 billing; this workbook parses the same list. CUST-1002 (Nepalese) therefore stopped being HRN; his historical order ORD-90002 still carries the HRN sub-type/hold. Sawfa / Sawfa Plus are stored as customerSubType but the app has no logic for them (Qatari rules already give them no cap).", "Provide any Sawfa-specific rule (BR-347 names them). Decide whether ORD-90002's HRN history should be cleared.", "CUST-1002, 3017, 3026, 3033, 3046, 3061-3064, 3068-3070, 3065, 3066"],
    ["Q10", "Unclassified blacklist has no test customer", "eligibilityEngine.ts hard-stops a blacklisted customer whose blacklistCategory is neither 'collections' nor 'security' (check id blacklist-unclassified). Every blacklisted customer in the data carries a category, so no inventory customer can reach that row. Left unseeded: whether this state can occur in real data is not evidenced.", "Confirm whether real records can be blacklisted without a category; if so, seed one.", "-"],
    ["Q8", "MADA and B2B2C are one-per-order", "ADO-7112 (MADA) is bound to PROD-104 and ADO-7113 (B2B2C) to PROD-105; the UI allows ONE discount per order and a plan change retires it. A customer 'eligible for both' can use only one at a time.", "Confirm that stacking is not required.", "CUST-3024"],
]
sheet(wb, "Open Questions", ["#", "Topic", "Finding", "Needs", "Affected customers"], oq, {"#": 5, "Topic": 38, "Finding": 80, "Needs": 60, "Affected customers": 24})

OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print(f"wrote {OUT} - {len(rows)} customers ({n_seed} original, {n_prop} added)")
