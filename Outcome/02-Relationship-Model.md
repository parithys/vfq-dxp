# Relationship Model - Vodafone DXP

**Document Version:** 1.0  
**Analysis Date:** August 27, 2026  
**Status:** Framework Document  

---

## Overview

This document maps all inter-entity connections across the Vodafone Digital Experience Platform, establishing how User Journeys, Workflows, Views, Actions, and Permissions interact to form a cohesive system.

**Relationship Statistics:**
- Total Relationships Identified: [To be populated]
- Relationship Types: [Count]
- Reusable Components: [Count]
- Cross-Functional Workflows: [Count]
- Critical Path Dependencies: [Count]

---

## Table of Contents

1. [Relationship Types & Cardinality](#relationship-types--cardinality)
2. [Entity Relationship Diagram (Conceptual)](#entity-relationship-diagram-conceptual)
3. [Comprehensive Relationship Matrix](#comprehensive-relationship-matrix)
4. [Reusable Components Register](#reusable-components-register)
5. [Cross-Functional Workflows](#cross-functional-workflows)
6. [Dependency Chains](#dependency-chains)
7. [Many-to-Many Relationship Analysis](#many-to-many-relationship-analysis)

---

## 1. Relationship Types & Cardinality

### Relationship Type Definitions

```
RELATIONSHIP TYPES:

Invokes (Journey → Workflow)
- User Journey initiates one or more Workflows
- Example: "New Postpaid Activation" invokes "Customer Onboarding" workflow
- Cardinality: 1:N (One journey can invoke multiple workflows)

Contains (Workflow → Task)
- Workflow consists of sequential or parallel Tasks
- Example: "Order Processing" contains "Validate", "Price", "Confirm"
- Cardinality: 1:N (One workflow contains multiple tasks)

Uses (Workflow → View, Task → View)
- Workflow or Task displays a View to the user
- Example: "Payment Processing" uses "Payment Entry" view
- Cardinality: M:N (Multiple workflows can use same view)

Enables (View → Action)
- View provides UI controls for Actions
- Example: "Order Summary" view enables "Approve", "Reject", "Modify"
- Cardinality: 1:N (One view enables multiple actions)

Requires (Action → Permission)
- Action needs permission to execute
- Example: "Approve Order" requires "Order.Approve" permission
- Cardinality: M:N (Action may need multiple permissions)

Controls (Permission → Persona)
- Permission is granted to Persona
- Example: "Order.Approve" assigned to "Approval Manager"
- Cardinality: M:N (Permission assigned to multiple personas)

Governs (Business Rule → Entity)
- Business rule constrains behavior of entities
- Example: "Credit Check Required" rule applies to "New Customer" orders
- Cardinality: M:N

Triggers (Event → Action, Event → Workflow)
- System event initiates action or workflow
- Example: "Payment.Processed" event triggers "Fulfillment" workflow
- Cardinality: 1:N

Integrates (Workflow → External System)
- Workflow requires integration with external system
- Example: "Service Activation" integrates with "Network Provisioning System"
- Cardinality: M:N
```

### Cardinality Matrix

| Source Entity | Target Entity | Relationship | Cardinality | Strength |
|---------------|---------------|--------------|-------------|----------|
| User Journey | Workflow | Invokes | 1:N | Primary |
| Workflow | Task | Contains | 1:N | Primary |
| Workflow | View | Uses | M:N | Primary |
| View | Action | Enables | 1:N | Primary |
| Action | Permission | Requires | M:N | Secondary |
| Permission | Persona | Controls | M:N | Secondary |
| Workflow | Business Rule | Governs | M:N | Secondary |
| Event | Workflow | Triggers | 1:N | Secondary |
| Workflow | External System | Integrates | M:N | Secondary |

---

## 2. Entity Relationship Diagram (Conceptual)

### High-Level ER Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                       VODAFONE DXP ENTITY MODEL                     │
└─────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │  USER JOURNEY    │
                        │  (Business Goal) │
                        └────────┬─────────┘
                                 │ invokes (1:N)
                                 ▼
                        ┌──────────────────┐
                        │   WORKFLOW       │
                        │  (Business Proc) │
                        └────────┬─────────┘
                                 │ contains (1:N)
                                 │ uses (M:N)
                                 ▼
                    ┌────────────┴────────────┐
                    │                         │
                ┌───▼───┐            ┌──────▼─────┐
                │ TASK  │            │    VIEW    │
                │       │            │  (Screen)  │
                └───────┘            └──────┬─────┘
                                            │ enables (1:N)
                                            ▼
                                     ┌────────────┐
                                     │  ACTION    │
                                     │(User Ops)  │
                                     └────┬───────┘
                                          │ requires (M:N)
                                          ▼
                                   ┌────────────────┐
                                   │  PERMISSION    │
                                   │(Access Rights) │
                                   └────┬───────────┘
                                        │ controls (M:N)
                                        ▼
                                   ┌────────────┐
                                   │  PERSONA   │
                                   │   (Role)   │
                                   └────────────┘

SUPPORTING ENTITIES:
                    ┌──────────────────┐
                    │ BUSINESS RULE    │
                    │(Constraints)     │ ──┬─── governs (M:N) ──► Workflows, Views, Actions
                    └──────────────────┘   │
                                           │
                    ┌──────────────────┐   │
                    │  DECISION POINT  │   │
                    │ (Routing Logic)  │ ──┘
                    └──────────────────┘

    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │    EVENT     │    │ INTEGRATION  │    │ NOTIFICATION │
    │  (Triggers)  │    │  (External)  │    │ (Communication)
    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 3. Comprehensive Relationship Matrix

### Relationship Template

Each relationship entry captures:

```
Relationship ID: REL-XXX
Source Entity: [Type: ID, Name]
Target Entity: [Type: ID, Name]
Relationship Type: [Invokes, Contains, Uses, etc.]
Cardinality: [1:1, 1:N, M:1, M:N]
Strength: [Primary, Secondary, Conditional]
Business Logic: [Conditions governing this relationship]
Evidence Source: [Document proving this relationship]
Bidirectional: [Yes/No - is reverse relationship valid?]
Impact If Removed: [What breaks?]
Notes: [Additional context]
```

### Sample Relationship Entries

**[To be populated from workflow analysis with complete relationships]**

**Example Structure:**

| REL ID | Source | Target | Type | Cardinality | Strength | Business Logic | Impact |
|--------|--------|--------|------|-------------|----------|----------------|--------|
| REL-001 | UJ-001: New Postpaid | WF-001: Customer Onboarding | Invokes | 1:N | Primary | Always invokes unless customer rejected | WF loss blocks journey |
| REL-002 | WF-001: Customer Onboarding | VW-001: Customer Data Entry | Uses | M:N | Primary | Required first step | Flow cannot proceed |
| REL-003 | VW-001: Customer Data Entry | ACT-001: Submit Customer Info | Enables | 1:N | Primary | Action available in view | Action inaccessible |
| REL-004 | ACT-001: Submit Customer Info | PERM-001: Create Customer | Requires | M:N | Primary | All conditions checked | Unauthorized access |
| REL-005 | PERM-001: Create Customer | PERS-001: CSR | Controls | M:N | Primary | Part of CSR role | CSR loses capability |

---

## 4. Reusable Components Register

**Definition:** Views, Actions, Workflows, or other components used across multiple User Journeys.

### High-Reuse Components

#### Customer Data Entry View (VW-001)
```
View Name: Customer Data Entry
Reused In: [Count] Journeys
Usage Frequency: [Very High/High/Medium/Low]
Journeys:
  1. UJ-001: New Postpaid Activation
  2. UJ-002: Pre-to-Post Migration
  3. UJ-003: MNP Activation
  4. UJ-004: Fixed Line Activation
  5. UJ-005: Home Move
  
Variations By Journey:
  - UJ-001: Full form (all fields)
  - UJ-002: Abbreviated (update only)
  - UJ-003: Mobile-optimized variant
  - UJ-004: Phone-specific variant
  - UJ-005: Address-focused variant

Component Configuration:
  - Core Fields: Always shown
  - Conditional Fields: Shown based on journey/persona
  - Validation Rules: Applied per journey
  - Submit Behavior: Varies by target workflow

Optimization Opportunity:
  - Current: Duplicated in multiple views
  - Recommended: Extract as shared component
  - Expected Benefit: Reduce duplicate code, ensure consistency
  - Development Effort: Medium
  - Risk: Low (established patterns)
```

#### Payment Processing Workflow (WF-003)
```
Workflow Name: Payment Processing
Reused By: [Count] Journeys
Usage Frequency: [Very High]
Journeys:
  1. UJ-001: New Postpaid (subscription payment)
  2. UJ-002: Pre-to-Post (deposit)
  3. UJ-004: FWA Installation (equipment charge)
  5. UJ-005: Service Upgrade (price adjustment)

Variations:
  - Amount determination (calculation vs. input)
  - Payment method (card, bank transfer, cash)
  - Approval requirements (auto-approve vs. manual)
  - Integration point (payment gateway differences)

Consolidation Opportunity:
  - Could consolidate 3 similar workflows
  - Estimated duplicate code: 40%
  - Benefit: Single source of truth, easier maintenance
  - Risk: Medium (different business rules per journey)
```

#### Order Approval Workflow (WF-005)
```
Workflow Name: Order Approval
Reused By: [Count] Journeys
Usage Frequency: [High]
Invoked By:
  1. UJ-001: New Postpaid (credit check)
  2. UJ-002: Pre-to-Post (business case review)
  3. UJ-004: FWA Installation (location clearance)

Variations:
  - Approval personnel (CSR Manager, Finance Team, Technical Team)
  - Approval criteria (credit score, revenue impact, technical feasibility)
  - Escalation paths (1-level, 2-level, executive)
  - Timeline (immediate, within 24hrs, within 5 days)

Optimization:
  - Current implementation: Separate approval workflows per journey
  - Recommended: Template-based approval engine
  - Configurable parameters: Approvers, criteria, timeline, escalation
  - Benefit: 50% code reduction, faster approval changes
  - Risk: Low (well-established patterns)
```

### Reusability Metrics

| Component | Type | Reused In # Journeys | Reuse %, Count | Configuration Variants | Consolidation Priority |
|-----------|------|----------------------|-----------------|------------------------|----------------------|
| Customer Data Entry | View | 5 | High (5/13) | 3 | High |
| Payment Processing | Workflow | 4 | High (4/13) | 2 | High |
| Order Approval | Workflow | 3 | Medium (3/13) | 4 | High |
| Address Validation | Action | 6 | Very High (6/13) | 1 | Medium |
| SIM Provisioning | Workflow | 2 | Medium (2/13) | 2 | Medium |
| Device Configuration | Workflow | 2 | Medium (2/13) | 3 | Low |

---

## 5. Cross-Functional Workflows

**Definition:** Workflows that span multiple business functions and are invoked by different journeys.

### Payment Processing Workflow
```
Workflow ID: WF-003
Workflow Name: Payment Processing
Business Functions Involved:
  1. Sales: Determines payment amount
  2. Finance: Validates payment method
  3. Customer Service: Collects payment information
  4. Operations: Reconciles payment
  5. Integration: Communicates with payment gateway

Invoked By Journeys:
  - New Postpaid Activation (subscription charge)
  - Pre-to-Post Migration (deposit/conversion)
  - FWA Installation (equipment + service charge)
  - Service Upgrade (price delta)

Views Used:
  - Payment Method Selection
  - Payment Details Entry
  - Payment Confirmation
  - Receipt Display

Actions Required:
  - Collect Payment Info
  - Validate Card
  - Process Transaction
  - Confirm Payment
  - Generate Receipt

Personas Involved:
  - Customer Service Representative (CSR)
  - Finance Analyst (validation)
  - End Customer (payment provider)

External Integrations:
  - Payment Gateway (Stripe, Square, etc.)
  - Billing System (reconciliation)
  - Notification Service (receipt delivery)

Handoff Points:
  1. Sales → Finance: Payment amount ready
  2. Finance → Operations: Payment processed
  3. Operations → Billing: Update billing system
  4. Billing → Notification: Send receipt
```

### Order Fulfillment Workflow
```
Workflow ID: WF-006
Workflow Name: Order Fulfillment
Business Functions:
  1. Sales: Order creation
  2. Warehouse: Inventory management
  3. Logistics: Shipping
  4. Customer Service: Tracking
  5. Operations: Delivery confirmation

Invoked By: All product journeys
Handoff Complexity: High (5+ function handoffs)
Dependencies: SIM Provisioning, Device Configuration, Service Activation
```

---

## 6. Dependency Chains

### Longest Dependency Path

**Journey: New Postpaid Activation (UJ-001)**

```
UJ-001 (New Postpaid Activation)
  ├─ invokes ──→ WF-001 (Customer Onboarding)
  │   ├─ uses ──→ VW-001 (Customer Data Entry)
  │   │   ├─ enables ──→ ACT-001 (Submit Customer Info)
  │   │   │   ├─ requires ──→ PERM-001 (Create Customer)
  │   │   │   │   └─ controlled by ──→ PERS-001 (CSR)
  │   │   │   └─ requires ──→ PERM-002 (Validate Address)
  │   │   │       └─ controlled by ──→ PERS-002 (System)
  │   │   └─ uses ──→ BR-001 (Customer Eligibility)
  │   │
  │   ├─ contains ──→ Task: Validate Customer
  │   ├─ contains ──→ Task: Check Credit
  │   └─ contains ──→ Task: Issue SIM
  │
  ├─ invokes ──→ WF-002 (Credit Evaluation)
  │   ├─ uses ──→ VW-002 (Credit Review)
  │   │   └─ enables ──→ ACT-002 (Approve/Reject)
  │   │       └─ requires ──→ PERM-003 (Approve Orders)
  │   │           └─ controlled by ──→ PERS-003 (Manager)
  │   └─ governs ──→ BR-002 (Credit Limit Policy)
  │
  ├─ invokes ──→ WF-003 (Payment Processing)
  │   ├─ uses ──→ VW-003 (Payment Entry)
  │   │   └─ enables ──→ ACT-003 (Collect Payment)
  │   └─ integrates ──→ INT-001 (Payment Gateway)
  │
  ├─ invokes ──→ WF-004 (SIM Provisioning)
  │   └─ integrates ──→ INT-002 (SIM Management System)
  │
  ├─ invokes ──→ WF-007 (Service Activation)
  │   └─ integrates ──→ INT-003 (Network System)
  │
  └─ triggers ──→ EVT-001 (Customer Created)
      └─ triggers ──→ WF-008 (Welcome Notification)
          ├─ uses ──→ NOT-001 (Welcome Email)
          └─ uses ──→ NOT-002 (Welcome SMS)
```

**Dependency Chain Metrics:**
- Total depth: 6 levels
- Critical path: UJ-001 → WF-001 → WF-002 → WF-003 → WF-004 → WF-007
- Longest single path: 12 nodes
- Parallel execution possible: Yes (Payment, SIM, Service can run in parallel)
- Potential execution time: Sequential ~15min, Parallel ~8min

### Critical Dependencies (Must Execute in Order)

1. **Customer Data → Credit Check → Approval → Payment → Provisioning**
   - Cannot proceed to next step without previous
   - Example: Cannot activate service until payment received

2. **Order Validation → Fulfillment → Delivery → Completion**
   - Sequential dependency for order processing
   - Example: Cannot mark order complete until delivered

### Optional Dependencies (Can Execute in Parallel or Be Skipped)

1. **Notification Workflows** (can run parallel to fulfillment)
2. **Audit Logging** (parallel process)
3. **Optional Integrations** (when customer selects option)

---

## 7. Many-to-Many Relationship Analysis

### View-to-Workflow Relationships

```
VW-001 (Customer Data Entry) is used by:
  - WF-001 (Customer Onboarding)
  - WF-002 (Account Update)
  - WF-003 (Customer Profile Correction)
  
Multiple Workflows share the same View with different:
  - Field visibility (some fields hidden in WF-003)
  - Validation rules (stricter in WF-001)
  - Submission behavior (async in WF-002, sync in WF-001)
```

### Action-to-Permission Relationships

```
ACT-001 (Approve Order) requires:
  - PERM-001 (Order.Read)
  - PERM-002 (Order.Approve)
  - PERM-003 (Finance.Access)
  
Multiple Permissions must be satisfied before action can execute.
```

### Permission-to-Persona Relationships

```
PERM-001 (Order.Approve) is assigned to:
  - PERS-001 (Order Manager)
  - PERS-002 (Finance Manager)
  - PERS-003 (Executive)
  
Multiple Personas may have same permission.
Overlapping permissions require careful management to prevent conflicts.
```

---

## Relationship Quality Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| All Relationships Documented | 100% | [%] | [On Track/At Risk] |
| Documented Cardinality | 100% | [%] | [On Track/At Risk] |
| Business Logic Specified | 100% | [%] | [On Track/At Risk] |
| Evidence Source Cited | 100% | [%] | [On Track/At Risk] |
| Conflict-Free | 100% | [%] | [On Track/At Risk] |

---

## Next Steps

1. **Validate Relationships:** Cross-reference with source documentation
2. **Identify Missing Relationships:** Look for gaps in mappings
3. **Resolve Conflicts:** Address conflicting relationship definitions
4. **Document Business Logic:** Add condition/rule details to each relationship
5. **Optimize Reusable Components:** Extract and consolidate high-reuse components
6. **Build Visualization:** Create relationship diagrams for stakeholder communication

---

**[This document will be populated with complete relationship data from workflow analysis]**
