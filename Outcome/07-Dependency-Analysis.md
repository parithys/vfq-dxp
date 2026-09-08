# Dependency & Impact Analysis - Vodafone DXP

**Document Version:** 1.0  
**Analysis Date:** August 27, 2026  
**Focus:** Critical Dependencies, Break-Points & Change Impact Assessment

---

## Overview

This document identifies critical dependencies, potential single points of failure, and provides a framework for assessing the impact of changes to any system component.

---

## Critical Path Dependencies

### Dependency Tree: New Postpaid Activation Journey

```
UJ-001 (New Postpaid Activation)
│
├─ CRITICAL (must complete):
│   ├─ WF-001 (Customer Onboarding) 
│   │   └─ Must complete before: Any order processing
│   │   └─ Break point: If customer data invalid → journey fails
│   │
│   ├─ WF-002 (Credit Evaluation)
│   │   └─ Must complete before: Payment processing
│   │   └─ Break point: If credit service down → manual review required
│   │
│   ├─ WF-003 (Payment Processing)
│   │   └─ Must complete before: Service activation
│   │   └─ Break point: If payment gateway down → no payment collection
│   │
│   ├─ WF-004 (SIM Provisioning)
│   │   └─ Must complete before: Service activation
│   │   └─ Break point: If SIM system down → service cannot activate
│   │
│   └─ WF-005 (Service Activation)
│       └─ Must complete before: Journey completion
│       └─ Break point: If network system down → service not active
│
└─ OPTIONAL (can complete in parallel or skip):
    ├─ WF-008 (Welcome Notification)
    │   └─ Runs async, doesn't block journey
    │   └─ Break point: If fails → notification not sent, journey still succeeds
    │
    └─ WF-009 (CRM Synchronization)
        └─ Runs async, doesn't block journey
        └─ Break point: If fails → data inconsistency (not journey failure)

CRITICAL PATH SEQUENCE:
WF-001 (Customer) → WF-002 (Approval) → WF-003 (Payment) → WF-004 + WF-005 (Provisioning) → Completion

PARALLELIZABLE COMPONENTS:
- WF-004 (SIM) and WF-005 (Service) can run in parallel (both depend on payment completion)
- WF-008, WF-009 can run async (don't block customer experience)

ESTIMATED CRITICAL PATH TIME:
- Sequential: ~15-20 minutes
- Optimized with parallelization: ~8-10 minutes
```

---

## Dependency Matrices

### Workflow Dependency Matrix

```
         │ WF-001 │ WF-002 │ WF-003 │ WF-004 │ WF-005 │ WF-006 │ WF-007 │
─────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
WF-001   │   -    │  ◄─►   │  ◄─    │  ◄─    │  ◄─    │        │        │
WF-002   │  ───►  │   -    │  ◄─    │        │        │        │        │
WF-003   │        │  ───►  │   -    │  ◄─    │  ◄─    │        │        │
WF-004   │  ───►  │        │  ───►  │   -    │  ◄─►   │  ◄─    │        │
WF-005   │  ───►  │        │  ───►  │  ◄─►   │   -    │  ◄─    │        │
WF-006   │        │        │        │  ───►  │  ───►  │   -    │  ◄─    │
WF-007   │        │        │        │        │        │  ───►  │   -    │

LEGEND:
───►  = depends on (must complete first)
◄───  = blocks (must complete before)
◄─►   = bi-directional dependency
-     = self
(blank) = no direct dependency
```

### Integration Dependency Map

```
WF-003 (Payment Processing)
├─ Depends on: INT-005 (Payment Gateway)
│   ├─ Risk: HIGH (if down, no payments collected)
│   ├─ Fallback: Manual payment entry + reconciliation
│   ├─ SLA: 99.5% (known downtime on weekends)
│   └─ Impact: Affects ALL product journeys
│
WF-004 (SIM Provisioning)
├─ Depends on: INT-002 (SIM Management System)
│   ├─ Risk: MEDIUM (provisioning delayed if slow)
│   ├─ Fallback: Manual SIM assignment + async provisioning
│   ├─ SLA: 99.0%
│   └─ Impact: Blocks postpaid/prepaid activations
│
WF-005 (Service Activation)
├─ Depends on: INT-003 (Network System)
│   ├─ Risk: MEDIUM (service unavailable if down)
│   ├─ Fallback: Delayed activation retry (up to 24 hours)
│   ├─ SLA: 99.2%
│   └─ Impact: Service not active for customer
│
WF-009 (CRM Synchronization)
├─ Depends on: INT-001 (CRM System)
│   ├─ Risk: MEDIUM (data inconsistency if failed)
│   ├─ Fallback: Manual reconciliation + batch sync retry
│   ├─ SLA: 99.9%
│   └─ Impact: Customer record may not reflect order
│
└─ Depends on: INT-004 (Billing System)
    ├─ Risk: MEDIUM (billing records missing if failed)
    ├─ Fallback: Manual billing entry + async sync
    ├─ SLA: 99.8%
    └─ Impact: Customer may not be invoiced
```

---

## Single Points of Failure

### Critical Components (If Down = Journey Fails)

```
COMPONENT 1: Payment Gateway Integration (INT-005)
├─ Criticality: CRITICAL (blocks ALL payments)
├─ Failure Impact:
│   ├─ No orders can be completed
│   ├─ Revenue collection stops
│   ├─ Customer dissatisfaction high
│   └─ Cascading effect: All downstream workflows blocked
│
├─ Mitigation Current State:
│   ├─ Fallback: Manual payment entry
│   ├─ Workaround: Queue for retry (24-hour window)
│   └─ SLA: 99.5% (gaps exist)
│
├─ Recommendation:
│   ├─ Primary: Redundant payment gateway provider
│   ├─ Secondary: Local payment processing capability
│   └─ Tertiary: Manual payment with post-reconciliation
│
└─ Dependency Count: 13 journeys depend on this

COMPONENT 2: Credit Scoring Service (INT-003)
├─ Criticality: CRITICAL (blocks approvals)
├─ Failure Impact:
│   ├─ Cannot determine credit eligibility
│   ├─ Orders requiring credit review cannot proceed
│   ├─ Affects ~60% of postpaid orders
│   └─ Manual workaround very time-consuming
│
├─ Mitigation Current State:
│   ├─ Fallback: Manual credit assessment (SLA: 4 hours)
│   ├─ Secondary: Use cached credit scores (24-hour old data)
│   └─ SLA: 95% (gap on weekends)
│
├─ Recommendation:
│   ├─ Redundant credit service provider
│   ├─ Local credit decisioning model (ML-based fallback)
│   └─ Service retry queue
│
└─ Dependency Count: 8 journeys depend on this

COMPONENT 3: Network Provisioning System (INT-003)
├─ Criticality: CRITICAL (blocks service activation)
├─ Failure Impact:
│   ├─ Customer cannot use service
│   ├─ Service activation delayed
│   ├─ SLA violations
│   └─ High customer complaints
│
├─ Mitigation Current State:
│   ├─ Fallback: Queue for retry (up to 5 attempts, 24-hour window)
│   ├─ Secondary: Manual activation + async sync
│   └─ SLA: 99.2%
│
├─ Recommendation:
│   ├─ Improve retry logic (exponential backoff)
│   ├─ Secondary network provisioning path
│   └─ Customer notification on retry
│
└─ Dependency Count: 12 journeys depend on this
```

### High-Risk Components (If Down = Major Degradation)

```
COMPONENT 4: CRM System (INT-001)
├─ Criticality: HIGH (data loss risk)
├─ Failure Impact:
│   ├─ Customer records may not be persisted
│   ├─ Order history inconsistent
│   ├─ Duplicate orders possible
│   └─ Data reconciliation required post-recovery
│
├─ Mitigation Current State:
│   ├─ Fallback: Local database + batch sync on recovery
│   ├─ Audit trail: All changes logged locally
│   ├─ Retry: Exponential backoff up to 24 hours
│   └─ SLA: 99.9%
│
└─ Risk Mitigation Level: MEDIUM (mitigation exists)

COMPONENT 5: Billing System (INT-004)
├─ Criticality: HIGH (revenue recognition risk)
├─ Failure Impact:
│   ├─ Invoices not generated
│   ├─ Revenue not recognized
│   ├─ Manual accounting reconciliation required
│   └─ Financial reporting impact
│
├─ Mitigation Current State:
│   ├─ Fallback: Manual invoice generation + batch sync
│   ├─ Retry: Up to 5 times over 24 hours
│   └─ SLA: 99.8%
│
└─ Risk Mitigation Level: MEDIUM-HIGH

COMPONENT 6: Address Validation Service (INT-006)
├─ Criticality: MEDIUM (process can continue without it)
├─ Failure Impact:
│   ├─ Customer address not validated
│   ├─ Potential invalid address in system
│   ├─ Delivery failure risk
│   └─ Manual verification required
│
├─ Mitigation Current State:
│   ├─ Fallback: Manual verification + CSR review
│   ├─ Retry: Up to 3 times
│   └─ SLA: 99.0%
│
└─ Risk Mitigation Level: HIGH (manual fallback exists)
```

---

## Change Impact Framework

### Component Removal Impact Assessment

#### Scenario 1: Remove VW-001 (Customer Data Entry View)

```
COMPONENT: VW-001 (Customer Data Entry View)

IMMEDIATE IMPACT:
├─ Workflows Blocked: WF-001 (Customer Onboarding)
├─ Actions Unavailable: ACT-001 (Submit Customer Info)
├─ Permissions Unused: PERM-001, PERM-002
└─ Personas Affected: All (CSR, Manager, Executive, Customer)

CASCADING IMPACT:
├─ Journeys Blocked: 8+ journeys cannot start
│   ├─ UJ-001 (New Postpaid) - BLOCKED
│   ├─ UJ-002 (Pre-to-Post) - BLOCKED
│   ├─ UJ-003 (MNP) - BLOCKED
│   └─ ... [6 more journeys]
│
├─ Revenue Impact: Estimated $[X]M/day (if removed)
├─ Customer Impact: Cannot onboard new customers
├─ Process Impact: Manual fallback to paper-based forms
└─ Operational Impact: 100% of sales staff unable to create orders

REPLACEMENT OPTIONS:
├─ Use VW-002 (Customer Profile - different purpose)
├─ Use VW-003 (Customer Update - suboptimal for new customer)
├─ Create alternative view: ~2-3 weeks development
└─ Recommended: DO NOT REMOVE (critical component)

SEVERITY: CRITICAL (journey-blocking)
DECISION: Keep and maintain
```

#### Scenario 2: Remove WF-002 (Credit Evaluation Workflow)

```
COMPONENT: WF-002 (Credit Evaluation Workflow)

IMMEDIATE IMPACT:
├─ Decision Point DEC-002: No longer enforced (auto-approve default?)
├─ Actions Unavailable: ACT-010 (Approve/Reject)
├─ Permissions Unused: PERM-010, PERM-011
└─ Personas Affected: Managers, Executives (approval authority)

CASCADING IMPACT:
├─ Journeys Affected: 8 journeys with approval gates
│   ├─ Orders will bypass approval (major risk)
│   ├─ Credit limit not enforced
│   ├─ Approval manager loses authority
│   └─ Compliance violations likely
│
├─ Business Risk:
│   ├─ Credit risk: High-risk orders may pass
│   ├─ Financial risk: Bad debt increases
│   ├─ Compliance risk: Approvals not documented
│   └─ Regulatory risk: Audit findings expected
│
└─ Operational Impact:
    ├─ Manager role becomes meaningless
    ├─ Accountability lost
    └─ Process control removed

REPLACEMENT OPTIONS:
├─ None - approval is mandatory per policy
├─ Alternative: Implement auto-approval with scoring
└─ Not feasible - approval required by policy

SEVERITY: CRITICAL (compliance/policy-blocking)
DECISION: MUST KEEP (non-negotiable)
```

#### Scenario 3: Remove PERM-001 (Create Customer Permission)

```
COMPONENT: PERM-001 (Create Customer Permission)

IMMEDIATE IMPACT:
├─ Action ACT-001 becomes inaccessible
├─ Personas Losing Permission: CSR, Manager, Admin
├─ Workflow WF-001: Cannot be completed
└─ View VW-001: Action button disabled

CASCADING IMPACT:
├─ Journeys Blocked: 8+ (all start with customer creation)
├─ Customer onboarding stops
├─ No new customers can be created
├─ Sales revenue stops

REPLACEMENT OPTIONS:
├─ Reassign permission to different personas? (not feasible)
├─ Use different permission? (would need to create PERM-002b)
└─ No viable alternative

SEVERITY: CRITICAL
DECISION: MUST KEEP
```

#### Scenario 4: Remove VW-010 (Payment Method Selector)

```
COMPONENT: VW-010 (Payment Method Selector)

IMMEDIATE IMPACT:
├─ Workflow WF-003: Can still execute (uses VW-011, VW-012)
├─ View VW-010: Removed from UI
├─ Alternative: Payment method auto-selected from customer profile

CASCADING IMPACT:
├─ Journeys Affected: 4 journeys that use WF-003
│   ├─ UJ-001: Customer loses ability to choose payment method
│   ├─ UJ-002: Same impact
│   ├─ UJ-004: Same impact
│   └─ UJ-005: Same impact
│
├─ User Experience Impact:
│   ├─ Customer forced into single payment method
│   ├─ Flexibility reduced
│   ├─ Dissatisfaction possible
│   └─ Cart abandonment risk increases
│
└─ Business Impact: Conversion rate may decrease

REPLACEMENT OPTIONS:
├─ Keep only card payment (most common)
├─ Use payment method from previous order
├─ Prompt for method only if needed
└─ Acceptable: Customer experience degrades but viable

SEVERITY: MEDIUM (experience-impacting, not journey-blocking)
DECISION: Consider consolidation (merge methods into VW-011)
EFFORT: Low - UI change only
TIMELINE: 1 week
```

---

## Change Impact Assessment Template

```
COMPONENT CHANGE IMPACT ASSESSMENT

Component Name: [Entity being changed]
Change Type: [Remove/Modify/Add/Consolidate]
Change Description: [Specific change]

STEP 1: Identify Direct Dependencies
├─ Which workflows use this component? [List]
├─ Which views reference it? [List]
├─ Which actions enable it? [List]
└─ Which permissions control it? [List]

STEP 2: Identify Upstream Dependencies
├─ Which journeys invoke affected workflows? [List]
├─ Which personas need this component? [List]
└─ Which business processes depend on it? [List]

STEP 3: Assess Impact Severity
├─ Journey-blocking? [Yes/No] → If yes, CRITICAL
├─ Approval-blocking? [Yes/No] → If yes, CRITICAL
├─ Integration-critical? [Yes/No] → If yes, CRITICAL
├─ High-volume usage? [Yes/No] → If yes, HIGH
├─ Persona-specific? [Yes/No] → If yes, MEDIUM
└─ Optional/alternate path exists? [Yes/No] → If yes, LOW

STEP 4: Determine Fallback Options
├─ Alternative workflow? [Yes/No]
├─ Alternative view? [Yes/No]
├─ Alternative permission? [Yes/No]
└─ Manual workaround? [Yes/No - feasibility]

STEP 5: Calculate Risk Level
├─ Removal Risk = (# journeys affected) × (severity) × (no fallback)
├─ Integration Risk = (# integrations affected) × (criticality)
├─ Operational Risk = (personas affected) × (criticality)
└─ Total Risk Score = [Calculation]

STEP 6: Create Mitigation Plan
├─ Pre-change validation: [What must be tested?]
├─ Change execution: [Phased rollout strategy]
├─ Post-change monitoring: [Metrics to track]
└─ Rollback plan: [How to revert if needed]

RECOMMENDATION: [Keep/Change/Remove/Consolidate]
TIMELINE: [Estimated effort]
STAKEHOLDER APPROVAL REQUIRED: [Yes/No]
```

---

## Critical Path Analysis

### Longest Dependency Chain: New Postpaid Activation

```
CRITICAL PATH (Sequential):
1. UJ-001 initiated by CSR
2. WF-001 (Customer Onboarding) - ~2 minutes
3. WF-002 (Credit Evaluation) - ~3 minutes  
4. WF-003 (Payment Processing) - ~2 minutes
5. WF-004 (SIM Provisioning) - ~5 minutes [PARALLEL to WF-005]
6. WF-005 (Service Activation) - ~5 minutes [PARALLEL to WF-004]
7. WF-006 (Fulfillment) - ~1 minute

CRITICAL PATH MILESTONES:
├─ Start: Customer data collection begins
├─ Milestone 1: Customer created (WF-001 complete) - 2 min
├─ Milestone 2: Order approved (WF-002 complete) - 5 min
├─ Milestone 3: Payment confirmed (WF-003 complete) - 7 min
├─ Milestone 4: Service provisioned (WF-004+WF-005 complete) - 12 min
├─ Milestone 5: Fulfillment initiated (WF-006 start) - 12 min
└─ End: Customer can use service (WF-006 complete) - 13 min

OPTIMIZATION OPPORTUNITIES:
├─ Parallelize WF-004 & WF-005: Saves ~5 minutes
├─ Async fulfillment: Doesn't block journey completion
├─ Pre-population: Reduce customer data entry time
└─ Potential end-to-end time: 8 minutes (optimized)
```

---

## Recommendation Framework

### Decision Matrix for Component Changes

```
When making changes to platform components, use this matrix:

                    ┌─────────────────────────────────┐
                    │  CRITICAL IMPACT ON JOURNEY?    │
                    │  YES ──────── NO                │
         ┌──────────┼─────────────────────────────────┤
         │ YES      │  CRITICAL   │  CRITICAL       │
         │ Fallback │  (Must keep,│ (Consolidate or │
         │ Exists?  │  may        │  improve        │
         │          │  optimize)  │  fallback)      │
         ├──────────┼─────────────────────────────────┤
         │ NO       │  DO NOT     │  REMOVE or      │
         │ Fallback │  REMOVE     │ CONSOLIDATE     │
         │ Exists?  │  (Policy    │ (Low risk)      │
         │          │  blocking)  │                 │
         └──────────┴─────────────────────────────────┘
```

---

## Next Steps

1. **Validate Critical Components:** Confirm single points of failure with operations
2. **Improve Mitigation:** Enhance fallback procedures for critical components
3. **Establish Monitoring:** Alert on dependency failures before customer impact
4. **Plan Redundancy:** Implement backup for critical integrations
5. **Document Runbooks:** Create procedures for handling failures
6. **Test Failover:** Regular drills for critical scenarios

---

**[Detailed dependency analysis populated from workflow results]**
