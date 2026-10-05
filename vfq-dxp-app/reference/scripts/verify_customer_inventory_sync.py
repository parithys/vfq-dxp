#!/usr/bin/env python3
"""Checks that reference/outputs/Customer-Inventory.xlsx and the app's mock data agree.

The workbook is the test-data contract: every customer on its 'Customers' sheet must be
findable in the running app (public/mock-data) with the same details, and every customer the
app can find must be on the sheet. Exits 1 and prints each difference when they drift.

    python3 reference/scripts/verify_customer_inventory_sync.py
"""
import json, sys
from pathlib import Path
import openpyxl

APP = Path(__file__).resolve().parents[2]
MOCK = APP / "public/mock-data"
XLSX = APP / "reference/outputs/Customer-Inventory.xlsx"


def load(n):
    return json.loads((MOCK / f"{n}.json").read_text())


customers = {c["customerId"]: c for c in load("customers")}
docs = {}
for d in load("identity-documents"):
    docs.setdefault(d["customerId"], []).append(d)
contacts = {}
for c in load("customer-contacts"):
    # A customer can have several contact records (a second contact person); the customer's own
    # is the one carrying their first name.
    contacts.setdefault(c["customerId"], []).append(c)
nas = {n["nasRecordId"]: n for n in load("nas-records")}

ws = openpyxl.load_workbook(XLSX, data_only=True)["Customers"]
header = [c.value for c in ws[1]]
rows = [dict(zip(header, [c.value for c in r])) for r in ws.iter_rows(min_row=2) if r[0].value]

problems = []


def check(cid, field, expected, actual):
    if str(expected if expected is not None else "").strip() != str(actual if actual is not None else "").strip():
        problems.append(f"{cid}  {field}: workbook={expected!r}  app={actual!r}")


seen = set()
for r in rows:
    cid = r["Customer / NAS ID"]
    seen.add(cid)
    if cid in nas:
        # A person who is not yet a customer: the app finds them through NAS, not customers.json.
        n = nas[cid]
        check(cid, "name", r["Full name"], n["name"])
        check(cid, "ID number", r["ID number (use for lookup)"], n["documentNumber"])
        check(cid, "ID expiry", r["ID expiry"], n.get("expiryDate"))
        continue
    c = customers.get(cid)
    if not c:
        problems.append(f"{cid}  on the workbook but not in the app (customers.json)")
        continue
    ct = next((x for x in contacts.get(cid, []) if x.get("firstName") == c.get("firstName")), {})
    check(cid, "name", r["Full name"], c["name"])
    check(cid, "first name", r["First name"], c.get("firstName"))
    check(cid, "middle name(s)", r["Middle name(s)"], c.get("middleName"))
    check(cid, "last name", r["Last name"], c.get("lastName"))
    check(cid, "nationality", r["Nationality"], c["nationality"])
    check(cid, "segment", r["Segment"], c["segment"])
    check(cid, "date of birth", r["Date of birth"], c.get("dob"))
    check(cid, "mobile", r["Mobile"], c.get("phone"))
    check(cid, "gender", r["Gender"], ct.get("gender"))
    check(cid, "language", r["Language"], ct.get("preferredLanguage"))
    # The lookup value must resolve to this customer through an identity document.
    wanted = str(r["ID number (use for lookup)"])
    wanted_any = [w.strip() for w in wanted.split(" / ")]  # a customer may list several documents
    match = [d for d in docs.get(cid, []) if str(d["documentNumber"]) in wanted_any]
    if len(match) < len(wanted_any):
        have = ", ".join(str(d["documentNumber"]) for d in docs.get(cid, [])) or "none"
        problems.append(f"{cid}  ID number {wanted} is not fully an identity document of this customer (app has: {have})")
    else:
        types = [t.strip() for t in str(r["ID type"]).split(" / ")]
        expiries = [e.strip() for e in ("" if r["ID expiry"] is None else str(r["ID expiry"])).split(" / ")]
        for i, w in enumerate(wanted_any):
            d = next(d for d in match if str(d["documentNumber"]) == w)
            check(cid, f"ID type ({w})", types[min(i, len(types) - 1)], d["documentType"])
            check(cid, f"ID expiry ({w})", expiries[min(i, len(expiries) - 1)], d.get("expiryDate"))

for cid in customers:
    if cid not in seen:
        problems.append(f"{cid}  in the app (customers.json) but missing from the workbook")

print(f"{len(rows)} workbook customers, {len(customers)} app customers")
if problems:
    print(f"\n{len(problems)} difference(s):")
    print("\n".join(problems))
    sys.exit(1)
print("In sync.")
