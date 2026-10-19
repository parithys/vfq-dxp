# Connection Eligibility & Approval Rule Engine

`src/domain/eligibility/` decides, for each activation request, whether it is **allowed**, **allowed with approvals** or **blocked**, and explains why.
It is a pure, deterministic function: no I/O, no clock of its own (the caller passes one), no application imports. Counts and pending orders are supplied by the caller.
Every number lives in a versioned rule configuration; every decision names the version it used.

```ts
import { evaluateEligibility, evaluateCart, ruleConfigV1 } from '.../domain/eligibility';
const decision = evaluateEligibility(request, ruleConfigV1, () => new Date());
```

**Status: not wired into the journeys.** The existing in-app checks (`src/engines/eligibilityEngine.ts`, rules BR-288 / BR-347 in `public/config/business-rules.json`) are unchanged, and this module changes no behaviour until something calls it. Two of the existing rules disagree with this rule set - see *Differences from the rules in the app today*.

## Files

| File | Role |
|---|---|
| `types.ts` | Contracts: request, decision, `RuleConfig` |
| `reasonCodes.ts` | Stable reason codes, approval order, agent-facing messages |
| `config/eligibility.rules.v1.ts` | Rule set 1.0.0 - the only place thresholds live |
| `config/schema.ts` | `validateRuleConfig` / `assertValidRuleConfig` |
| `config/pendingConfirmations.ts` | The alternative reading of each TBC key (data) |
| `rules/overall.ts` `postpaid.ts` `prepaid.ts` `fixedFwa.ts` `passport.ts` `exceptions.ts` | One module per rule group |
| `engine.ts` | `evaluateEligibility`, `evaluateCart`, `validateRequest`, `resolveSegment`, `countLines` |
| `index.ts` | Public surface |

Tests: `tests/eligibilityRules.test.mjs` (the repository's runner is `node:test` through `tests/harness.mjs`; Vitest and Zod are not used because the repository has no such dependencies).

## Rules

| ID | Segment | Rule |
|---|---|---|
| OE-01 | Expatriate | Prepaid + postpaid combined may not exceed `expatriate.mobileTotalMax`. Blocks; no approval overrides it. Skipped for a migration. |
| OE-02 | Qatari | No overall mobile limit (`qatari.mobileTotalMax` = null). |
| OE-03 | Both | Fixed/FWA is excluded from the overall mobile limit, and the reverse. |
| PP-01 / PP-02 | Expatriate | Postpaid ordinal up to `postpaid.freeUpTo`: allow. Up to `creditControlUpTo`: `CREDIT_CONTROL`. |
| PP-03 | Expatriate | Ordinal beyond `creditControlUpTo`: block (defensive; OE-01 normally acts first). |
| PP-04 / PP-05 | Qatari | Up to `postpaid.freeUpTo`: allow. Beyond: `CREDIT_CONTROL`; blocked only if `postpaid.max` is set. |
| PR-01 | Expatriate | Prepaid up to `prepaid.max`, no approval (OE-01 also applies). |
| PR-02 | Qatari | No approval; blocked only at `qatari.prepaid.max` (TBC: null or 10). |
| FX-01 / FX-02 | Expatriate | Fixed/FWA ordinal up to `fixedFwa.freeUpTo`: allow. Beyond: `CREDIT_CONTROL`; blocked only if `max` is set. |
| FX-03 / FX-04 | Qatari | Same, with `qatari.fixedFwa` (TBC maximum: null or 10). |
| FX-05 | Both | Fixed/FWA never affects mobile eligibility and is never affected by it. |
| PB-01 | Passport | Every postpaid activation on a passport: `BAU`. |
| PB-02 | Passport | Postpaid ordinal from `creditControlFromOrdinal` to `creditControlUpTo`: also `CREDIT_CONTROL`. |
| PB-03 | Passport | OE-01 applies to passport customers (it is OE-01 itself). |
| XC-01 | Both | Approvals stack as a set: de-duplicated, ordered `BAU`, `CREDIT_CONTROL`, `EXCEPTION_UNDER_18`; the first rule to ask for a type is the one named. |
| XC-02 | Both | Age below `exceptions.under18.ageThreshold` adds `EXCEPTION_UNDER_18`. |
| XC-03 | Both | Hard blocks are evaluated before approvals; a blocked request returns none. |

The **ordinal** is the position the requested line would take among lines of its type: existing count of that type + 1.

## Evaluation order

1. Validate the input -> `BLOCK` `INPUT_INVALID`.
2. Resolve the segment (`segmentResolution`: `NATIONALITY` or `ID_TYPE`) -> unresolvable (missing or malformed nationality) `BLOCK` `PROFILE_UNRESOLVED`.
3. Count the lines: existing lines whose status is in `countedStatuses`, plus lines reserved by `pendingOrders` when `includePendingOrders`.
4. Hard-cap gate: OE-01, then the postpaid, prepaid and Fixed/FWA maxima (PP-03, PR-01/02, FX max) -> `BLOCK` with the reason code.
5. Approvals from the type rule (PP / PR / FX) using the ordinal.
6. Passport rule (PB-01/02), if `passportBauRule.enabled`.
7. Exception rule (XC-02).
8. Union and de-duplicate (XC-01).
9. No approvals -> `ALLOW`; otherwise `ALLOW_WITH_APPROVAL`.

A **migration** (`PREPAID_TO_POSTPAID_MIGRATION`, requested type postpaid) leaves the mobile total unchanged, so OE-01 is skipped; the postpaid thresholds apply to the new postpaid ordinal; `migration.approvalThresholdsApply` is always listed. It needs a prepaid line to migrate (else `INPUT_INVALID`).

`evaluateCart` evaluates the requests in order; each line that is not blocked counts toward the next (its `countsAfter` is the next `countsBefore`). Every request carries the customer's lines as they were before the cart; the engine adds the earlier cart lines itself.

## `rulesEvaluated`

Every rule, always in the same order (`OE-01` ... `XC-03`): `PASS` (applied, no effect), `TRIGGERED` (added an approval, or de-duplicated one), `BLOCKED`, `SKIPPED` (not applicable, or not reached because an earlier rule blocked). An invalid or unresolved request reports an empty list.

## Open confirmations (`pendingConfirmations`)

A key is listed on a decision only when it **influenced** that decision: the engine evaluates the request again with the key read the other way (`config/pendingConfirmations.ts`) and lists the key if the outcome, the approvals or the block change. `migration.approvalThresholdsApply` is listed on every migration.

| Key | Current default | Other reading tried | Business owner | Sign-off |
|---|---|---|---|---|
| `qatari.prepaid.max` | `null` (unlimited) | 10 | _to be assigned_ | _pending_ |
| `qatari.fixedFwa.max` | `null` (unlimited) | 10 | _to be assigned_ | _pending_ |
| `passportBauRule.enabled` | `true` | `false` | _to be assigned_ | _pending_ |
| `segmentResolution` | `NATIONALITY` | `ID_TYPE` | _to be assigned_ | _pending_ |
| `countedStatuses` | `ACTIVE, SUSPENDED, BARRED, PENDING_ACTIVATION` | `ACTIVE` only | _to be assigned_ | _pending_ |
| `migration.approvalThresholdsApply` | postpaid thresholds apply to a migration | - (always listed) | _to be assigned_ | _pending_ |

## Versioning a configuration

1. Copy `config/eligibility.rules.v1.ts` to `eligibility.rules.vN.ts`; change `version`.
2. Change only the numbers or flags there. `validateRuleConfig` rejects negative or non-integer thresholds, a free allowance above its maximum, and structural mistakes; `evaluateEligibility` throws on an invalid configuration.
3. Pass the new config to the engine. Decisions carry `ruleSetVersion`, so a stored decision can always be tied to the rules that produced it. Keep the old file: past decisions remain explainable.

A guard test (`tests/eligibilityRules.test.mjs`) fails if a number other than 0 and 1 (used for counting) appears in the rule logic, and if the module imports anything outside itself.

## Reason codes

`INPUT_INVALID`, `PROFILE_UNRESOLVED`, `ELIG_MOBILE_TOTAL_CAP_REACHED`, `ELIG_POSTPAID_CAP_REACHED`, `ELIG_PREPAID_CAP_REACHED`, `ELIG_FIXED_FWA_CAP_REACHED`, `APPR_CC_POSTPAID_THRESHOLD`, `APPR_CC_FIXED_FWA_THRESHOLD`, `APPR_BAU_PASSPORT_POSTPAID`, `APPR_CC_PASSPORT_POSTPAID_THRESHOLD`, `APPR_EXCEPTION_UNDER_18`. Codes are stable; messages are agent-facing and carry the counts.

## Differences from the rules in the app today

| In the app (`business-rules.json`) | In this rule set |
|---|---|
| BR-288: an expatriate QID holder is capped at **two** postpaid lines (confidence high; the system "technically permits five"). | PP-01/02: the 3rd to 5th postpaid line is **allowed with Credit Control approval**. |
| BR-347: a passport or GCC ID holder may have **2** prepaid connections; a Qatari has no restriction; an expatriate with a QID may hold 5 mobile in total. | PR-01: an expatriate may hold up to 5 prepaid, no approval, whatever the ID; there is no GCC ID type in the contracts (`IdType` is `QID` or `PASSPORT`). |

Nothing reconciles these automatically. Decide which source is authoritative before wiring the engine into a journey.

## Assumptions beyond the specification

- A migration with no prepaid line to migrate, or one that does not request a postpaid line, is `INPUT_INVALID`.
- A malformed (not two-letter) nationality is `PROFILE_UNRESOLVED`, not `INPUT_INVALID`.
- Passport rule PB-01/02 also applies to a migration onto postpaid (it is a postpaid activation).
- When two rules ask for the same approval, the first in derivation order (type rule, then passport, then exception) is the one named in `approvals`; the others show in `rulesEvaluated`.
- In a cart, a migration removes the first counted prepaid line of the customer and adds a postpaid one.
