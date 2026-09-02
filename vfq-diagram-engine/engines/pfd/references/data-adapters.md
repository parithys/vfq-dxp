# Dataset input adapters

How an arbitrary dataset becomes a `spec.json` for `scripts/generate.js`. Load this only when the
input is a file (CSV/TSV/JSON/Excel) rather than a described process.

## End-to-end path

```
dataset ──▶ scripts/ingest.js ──▶ spec.json + report.md ──▶ human review ──▶ scripts/generate.js ──▶ out.html
                                                            (edit spec.json)
```

```bash
node scripts/ingest.js data.csv -o spec.json --report report.md \
     --title "…" --subtitle "…"
node scripts/generate.js spec.json out.html 1600      # 1600 (≤6 cols) or 1820 (7)
```

`ingest.js` is dependency-free (own RFC-4180 parser: quoted fields, embedded commas and newlines,
`""` escapes, BOM, CRLF). It reads `.csv`, `.tsv`, `.json`. It writes `<input>.spec.json` when `-o`
is omitted, prints a one-line summary to stderr, and exits non-zero with the headers it saw plus the
synonym sets it tried when it cannot detect a shape.

**The report is not optional reading.** `ingest.js` resolves what the data supports and leaves the
rest unset; the report is the list of what the operator must decide.

## Input shapes (auto-detected)

| Shape | Detected when | Sequence comes from |
|---|---|---|
| Edge list | a source column **and** a target column | topological sort of the edges |
| Node list + order | a **numeric** order column, no source/target | the order column |
| Adjacency / "depends on" | a predecessor column, **no** target column (cells may hold `A;B`, `A,B`, `A|B`) | topological sort of the derived edges |
| Nodes + edges (JSON) | an object with a `nodes`/`steps`/`activities`/`tasks` array **and** an `edges`/`links`/`relationships`/`connections` array | the node order column if present, else topological sort |

A JSON array of row objects is treated as a table and falls through to the same rules.

Every edge that is not a primary chain connector survives as a `loops[]` entry, so no relationship is
dropped: a **back edge** (target ordered earlier) gets a style guess, a **forward skip** gets `plain`.

## Excel

`ingest.js` does **not** read `.xlsx`. Convert first — one CSV per sheet. Both commands below were
run on this machine and work.

```bash
# pandas — every sheet, header on row 1
python3 -c "
import pandas as pd, re
for name, df in pd.read_excel('book.xlsx', sheet_name=None, header=0, dtype=str).items():
    out = re.sub(r'[^A-Za-z0-9]+','-',name).strip('-').lower() + '.csv'
    df.dropna(how='all').to_csv(out, index=False)
    print(out, df.shape)
"

# pandas — one sheet whose header is NOT row 1 (header=N is 0-based:
# a title row + a blank row above the headers ⇒ headers are row 3 ⇒ header=2)
python3 -c "
import pandas as pd
df = pd.read_excel('book.xlsx', sheet_name='Edges (offset)', header=2, dtype=str)
df.dropna(how='all').to_csv('edges-offset.csv', index=False)
"

# openpyxl only (no pandas available) — every sheet, verbatim rows
python3 -c "
import csv, re, openpyxl
wb = openpyxl.load_workbook('book.xlsx', data_only=True)
for ws in wb.worksheets:
    out = re.sub(r'[^A-Za-z0-9]+','-',ws.title).strip('-').lower() + '.csv'
    with open(out,'w',newline='') as f:
        w = csv.writer(f)
        for row in ws.iter_rows(values_only=True):
            if all(c is None for c in row): continue
            w.writerow(['' if c is None else c for c in row])
    print(out)
"
```

`data_only=True` writes cached formula **results**; without it you get formula strings. If the
workbook was never opened in Excel the cache may be empty — recalculate and re-save first.

A nodes sheet and an edges sheet become two CSVs. Run `ingest.js` on the **edges** CSV (node
attributes on an edge row describe that row's source node), or hand-merge them into one JSON object
with `nodes` and `edges` arrays to keep every node attribute.

## Column synonym table

Headers are lowercased with non-alphanumerics stripped (`Depends On`, `depends_on`, `DependsOn` all
become `dependson`). Matching runs **exact for every field first**, then fuzzy (header *contains* a
synonym), so `Source Data` reads as `input`, not `source`. Extend `SYNONYMS` in `scripts/ingest.js`
and this table together.

| Field | Synonyms |
|---|---|
| `id` | id, key, code, ref, nodeid, stepid, activityid, uid, identifier — **plus** any `<Entity> ID` header (`Task ID`, `case_id`, `caseId`) |
| `title` | title, name, step, activity, task, process, stage, label, node, stepname, activityname |
| `role` | role, actor, owner, responsible, performer, team, department, raci, accountable, system, lane, swimlane, assignee |
| `type` | type, kind, category, mode, automation, channel, execution, nodetype, steptype, classification |
| `desc` | description, detail, details, notes, summary, purpose, what, comment, comments, remarks |
| `source` | source, from, predecessor, prev, previous, upstream, parent, dependson, dependency, dependencies, inputfrom, sourceid, fromid |
| `target` | target, to, successor, next, downstream, child, outputto, targetid, toid, nextstep |
| `verb` | verb, action, payload, data, artifact, message, label, edge, relationship, via, carries, edgelabel, transition |
| `order` | order, seq, sequence, step, stepno, no, num, index, rank, position, sortorder, serial |
| `decision` | decision, gate, condition, criteria, checkpoint, approval, isdecision, gateway |
| `input` | input, inputs, sourcedata, consumes, inputdata |
| `output` | output, outputs, result, results, produces, deliverable, outputdata |
| `meaning` | meaning, purpose, why, rationale, businessmeaning, explanation, significance |

Two synonyms are deliberately shared and disambiguated by context:

- **`step`** is both a title and an order synonym. It becomes `order` only if the column is
  numeric-ish (≥70 % of values short and containing a digit); otherwise it is the title.
- **`label`** is both a title and a verb synonym. In an edge table the verb claims it; in a node
  table the title does.

## Semantic type (`kind`) inference

Precedence (§2.1). Stop at the first hit:

1. **type/kind column** → token table below.
2. **role/actor column** → same token table.
3. **unset** — and the node is listed in the report's *Unresolved* table with the reason.

| `kind` | Tokens (whole word first, then substring) |
|---|---|
| `manual` (emerald 👤) | human, manual, person, people, user, reviewer, review, approver, approval, analyst, committee, owner, staff, team, manager, officer, board, operator, clerk, specialist, lead, director, head, coordinator, department, admin, governance, council, auditor, consultant, representative, desk, office, controller, supervisor, inspector, assessor, author, editor, chief, vp, panel |
| `automated` (violet ⚡) | system, auto, automated, automation, batch, job, engine, model, script, rule(s), service, bot, algorithm, pipeline, platform, application, software, database, datastore, warehouse, scheduler, daemon, compute, ml, ai |
| `integration` (amber 🔗) | api, integration, webhook, event, interface, feed, sync, message, queue, topic, bus, stream, connector, endpoint, ftp, sftp, edi, rest, soap, mq, kafka, broker, gateway, channel, contract, handoff |

Also detected: **terminals** (a type value saying start/begin/end/complete/finish/terminal, or a
first/last row whose *entire* title is such a word), **decisions** (a truthy decision/gate column, a
type value saying decision/gate/condition/checkpoint, or ≥2 outgoing edges carrying yes/no-ish
verbs), and **loop styles** from the edge verb: reject/fail/error/exception → `exception`;
rework/revise/return/amend/resubmit/retry → `revision`; monitor/refresh/recur/repeat/cycle →
`cycle`; otherwise `plain`.

### Why the title is never used

**The title says what a step is about; the type says who or what performs it.** They are independent,
and the same token flips type with context (§2.1: a governance body node is manual, the identically
named aggregation capability node is automated). A title like "Automated Reconciliation" may be a
person operating a tool; "Manual Review Queue" may be a queue on the wire. Title matching does not
produce a slightly-wrong colour — it produces a **confidently** wrong one that no reviewer questions,
because the box reads exactly like the word in it. An unset `kind` is visible and correctable; a
wrong one is neither.

## Ambiguity protocol

`ingest.js` never fills a gap by guessing:

- A missing title falls back to the row's **id**; missing both aborts, naming the row number.
- `cards.ioTable` is emitted only when all three of input/output/meaning exist (§9.1). Otherwise the
  card is omitted, not fabricated. `example` is always left out so `generate.js` derives it from the
  leading terms.
- Description text is wrapped at word boundaries into the **3 lines × ~30 chars** the box holds
  (§3.1, §4.1); anything past line 3 is printed verbatim in the report, never silently dropped.
- Ids are slugified from the id column (or `n1, n2…` by row order), de-duplicated with `-2`, `-3`.

**An unset `kind` is a correct, safe output — not a failure.** Three nodes with no `kind` mean the
dataset genuinely did not say who performs them; the report names all three and the operator answers
in seconds. Suppressing that question would ship a diagram whose semantic colour — the one thing the
standard treats as normative meaning — is fiction.

Before running `generate.js`, work the report's **Review before generating** checklist:

1. every **unresolved `kind`** — set it in the spec, or add the token to `TYPE_TOKENS` and re-run;
2. **synthesised Start/Complete terminals** — keep or delete (they appear only when the data has none);
3. **implicit connectors** — consecutive nodes with no edge behind them (sequence, not data);
4. **loop styles** — each is a keyword guess;
5. **decisions** — diamond text, yes/no branch labels, whether a rejected branch needs a `no` terminal;
6. **description overflow** — shorten the source text or accept the loss.

## Worked example

`requests.csv` (6 rows):

```csv
Seq,Step ID,Activity,Owner,Type,Notes
1,R1,Register Request,Service Desk,human,Capture the request and assign a reference
2,R2,Validate Payload,Validation Service,automated,Check schema and mandatory fields
3,R3,Enrich Record,Reference API,integration,Attach master-data attributes
4,R4,Approval Gate,Approval Board,decision,Approve or return for revision
5,R5,Fulfil Request,Fulfilment Engine,automated,Execute the requested change
6,R6,Notify Requester,Notification Webhook,integration,Send the outcome to the requester
```

```bash
node scripts/ingest.js requests.csv -o spec.json --report report.md \
     --title "Request Handling" --subtitle "Intake to notification"
# ingest: shape=node list with a sequence column; nodes=6; edges=0; loops=0;
#         ioTable=0; unresolved kinds=0
```

Resulting fragment (`Seq`→order, `Step ID`→id, `Activity`→title, `Owner`→role, `Type`→type,
`Notes`→desc; `R4`'s type value makes it a diamond, and no `kind` is emitted for it):

```json
{ "type": "start", "label": "Start" },
{ "type": "step", "id": "r1", "kind": "manual", "role": "👤 Service Desk",
  "title": "Register Request",
  "desc": ["Capture the request and assign", "a reference"] },
{ "type": "step", "id": "r2", "kind": "automated", "role": "⚡ Validation Service",
  "title": "Validate Payload", "desc": ["Check schema and mandatory", "fields"] },
{ "type": "decision", "id": "r4", "title": "Approval Gate" }
```

The report flags the synthesised terminals and the sequence-implied connectors; the operator adds the
`no` branch on `r4` by hand, then generates.

## Known limitations

- No `.xlsx`, `.xls`, or Google Sheets reader — convert to CSV first (above).
- On an edge list, only the **source** node of a row inherits that row's role/type/desc columns; a
  node that is never a source keeps only its title. Use the nodes+edges JSON shape to avoid this.
- A decision's `no` terminal (`no: {label}`) is never synthesised — branch labels are set, the
  terminal is an authoring decision.
- Parallel branches are linearised: the flow array is a single chain, and everything off it becomes a
  `loops[]` entry. Genuinely concurrent lanes need hand-authoring (SKILL.md path B).


## Non-English and domain-specific vocabularies (r6)

The type vocabularies and column synonyms in `ingest.js` are **defaults, not rules**. They decide a
node's semantic type, and therefore its colour — so an English-only word list silently mis-resolves any
other language. A German table whose actors are `Sachbearbeiter` (a person) and `Pruefsystem` (a system)
matched nothing and every node came back unresolved; worse, the run failed at shape detection because
`Schritt` and `Vorgaenger` are not in `SYNONYMS`.

Supply your own with `--vocab`. Keys merge over the defaults, so a file need only carry what it changes:

```bash
node scripts/ingest.js daten.csv -o spec.json --vocab vocab-de.json
```

```json
{
  "headers": { "title": ["schritt"], "role": ["verantwortlicher"], "source": ["vorgaenger"] },
  "kind": {
    "manual":      ["sachbearbeiter", "pruefer", "genehmiger"],
    "automated":   ["pruefsystem", "automatik"],
    "integration": ["schnittstelle"]
  },
  "terminal": { "start": ["anfang"], "end": ["ende", "abschluss"] },
  "decision": ["entscheidung"],
  "nullTokens": ["keine"]
}
```

`headers` extends the column synonyms; the rest extend the inference vocabularies. The same mechanism
covers a domain whose words break the English defaults — where "Board" is a system, or "Engine" is a team.

**The adapter emits content, not presentation.** `role` is written verbatim, without a glyph prefix:
baking `👤` into the dataset makes it unremovable without editing the data, and it renders differently on
every platform. The renderer decides the glyph.

An unresolved `kind` remains a correct, reported outcome. A vocabulary widens what can be resolved; it
never licenses a guess.
