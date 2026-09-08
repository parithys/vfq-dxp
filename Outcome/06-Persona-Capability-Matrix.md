# Persona-Capability Matrix - Vodafone DXP

**Document Version:** 1.0  
**Analysis Date:** August 27, 2026  
**Focus:** Role-Based Access Control (RBAC) & Capability Mapping

---

## Overview

This matrix maps personas (user roles) to their capabilities, defining who can do what, in which contexts, and with what constraints.

---

## Master Persona-to-Capability Mapping

### Template Structure

```
PERSONA: [PERS-XXX] [Persona Name]
├─ Business Function: [Department/Team]
├─ Organizational Level: [Frontline/Supervisor/Manager/Executive]
├─ Primary Channels: [Mobile/Tablet/Desktop/Web]
├─ Customer Types Served: [Consumer/SMB/Enterprise/All]
│
├─ PERMISSIONS ASSIGNED:
│   ├─ PERM-XXX [Permission Name]: [Scope] [Conditions]
│   ├─ PERM-YYY [Permission Name]: [Scope] [Conditions]
│   └─ PERM-ZZZ [Permission Name]: [Scope] [Conditions]
│
├─ JOURNEYS ACCESSIBLE:
│   ├─ UJ-001 [Journey Name]: Can initiate? [Yes/No] Can approve? [Yes/No]
│   ├─ UJ-002 [Journey Name]: Can initiate? [Yes/No] Can approve? [Yes/No]
│   └─ UJ-XXX [Journey Name]: Can initiate? [Yes/No] Can approve? [Yes/No]
│
├─ VIEWS ACCESSIBLE:
│   ├─ VW-001 [View Name]
│   │   ├─ View permission: PERM-XXX
│   │   ├─ Available actions: [ACT-A, ACT-B, ACT-C]
│   │   └─ Conditional visibility: [Conditions]
│   └─ VW-XXX [View Name]: [Similar structure]
│
├─ ACTIONS AVAILABLE:
│   ├─ ACT-XXX [Action]: Required permissions [PERM-A, PERM-B]
│   ├─ ACT-YYY [Action]: Required permissions [PERM-C]
│   └─ ACT-ZZZ [Action]: Required permissions [PERM-D, PERM-E]
│
├─ APPROVAL AUTHORITY:
│   ├─ Can approve orders up to: $[Amount]
│   ├─ Escalation if exceeds: $[Amount] → [Next level]
│   └─ Approval cycle: [Time allowed]
│
├─ DATA ACCESS:
│   ├─ Customer data: [Own leads/All assigned/All/None]
│   ├─ Order data: [Own orders/All assigned/All/Auditable only]
│   ├─ Financial data: [Own/Team/Department/All/None]
│   └─ Confidential data: [Yes/No] [Conditions if yes]
│
├─ OPERATIONAL CONSTRAINTS:
│   ├─ Hours of availability: [24/7 or specific hours]
│   ├─ Geographic restrictions: [Any/Specific regions]
│   ├─ Device restrictions: [Any/Specific devices]
│   ├─ Network restrictions: [Office/VPN/Remote/Any]
│   └─ Approval constraints: [Any conditions?]
│
├─ DELEGATION CAPABILITY:
│   ├─ Can delegate permissions: [Yes/No]
│   ├─ Can delegate for: [List of permissions]
│   └─ Delegation time limit: [Duration]
│
└─ DOCUMENTED CONFLICTS:
    ├─ Permission conflicts: [Any?]
    ├─ Access contradictions: [Any across documents?]
    └─ Capability gaps: [Expected but missing?]
```

---

## Identified Personas (9 Documented)

### PERS-001: Retail Agent (Direct Sales)
**Business Function:** Direct Store Sales  
**Organizational Level:** Frontline  
**Primary Channels:** Tablet, Desktop  
**Customer Types:** Consumer (Prepaid, Postpaid)

**Permissions:** Initiate journeys, Create lead, Approve order (own), Submit order, Attach documents  
**Journeys Accessible:** UJ-001, UJ-002, UJ-003, UJ-004, UJ-005, UJ-012 (6 journeys, can initiate all)  
**Approval Authority:** Orders up to auto-approve; >$1000 needs Channel Manager  
**Data Access:** Own customers, Own orders, Limited financial data  
**Constraints:** Tablet users only (except FWA desktop support); tablet orders require Channel Manager approval  

---

### PERS-002: Customer Service Representative (CSR)
**Business Function:** Customer Support & Fulfillment  
**Organizational Level:** Frontline  
**Primary Channels:** Desktop, Tablet  
**Customer Types:** Consumer (all segments)

**Permissions:** Process orders, Activate services, Handle exceptions, Update customer data, View all assigned orders  
**Journeys Accessible:** UJ-001, UJ-002, UJ-003, UJ-004, UJ-005, UJ-006, UJ-012 (7 journeys)  
**Approval Authority:** No approval authority (processes approved orders only)  
**Data Access:** All customers (by channel), All orders (operational view), No financial access  
**Constraints:** Desktop-primary; can access tablet for specific journeys; no cross-channel visibility  

---

### PERS-003: Channel Manager (Partner Management)
**Business Function:** Channel & Partner Oversight  
**Organizational Level:** Supervisor  
**Primary Channels:** Desktop, Tablet  
**Customer Types:** Consumer (via tablet partners)

**Permissions:** Approve/Reject orders, Manage channel users, View channel analytics, Override business rules  
**Journeys Accessible:** UJ-001, UJ-013 (Order Approval); can approve all journeys initiated by their partners  
**Approval Authority:** All orders from assigned partners ($0-unlimited); can escalate to Manager  
**Data Access:** Own partner customer data, Own partner orders, Own partner financials (high-level)  
**Constraints:** Partner isolation (P1 Channel Manager cannot see P2 orders); tablet-initiated orders only  

---

### PERS-004: Account Manager (Enterprise Sales)
**Business Function:** Enterprise Sales & Relationship  
**Organizational Level:** Senior/Supervisor  
**Primary Channels:** Desktop, Email  
**Customer Types:** Enterprise (SME, Large, Government)

**Permissions:** Create lead, Manage deal, Submit order, Collect documents, Request approvals, View RFS portal  
**Journeys Accessible:** UJ-014, UJ-015, UJ-017, UJ-018 (4 enterprise journeys); can initiate and manage  
**Approval Authority:** None (submits for Finance approval); can request discount approval escalation  
**Data Access:** Own enterprise accounts, Own deals/pipelines, Customer contacts & org structure  
**Constraints:** Desktop-only; email-based workflows; offline document handling; RFS portal access  

---

### PERS-005: Fulfillment Team Member
**Business Function:** Order Processing & Activation  
**Organizational Level:** Frontline  
**Primary Channels:** Desktop, Backend Systems  
**Customer Types:** Consumer & Enterprise

**Permissions:** Validate orders, Confirm approval, Create accounts, Activate numbers, Process errors  
**Journeys Accessible:** All journeys (as final executor)  
**Approval Authority:** No approval; can reject orders with reason  
**Data Access:** All approved orders, All customer data (read-only), System status data  
**Constraints:** Backend-only access; no customer-facing journey; cannot approve or override  

---

### PERS-006: Finance Approver (Credit Control)
**Business Function:** Credit & Financial Control  
**Organizational Level:** Specialist/Supervisor  
**Primary Channels:** Desktop  
**Customer Types:** Enterprise

**Permissions:** Approve credit, Set credit limits, Approve discounts, Validate documents, Review financials  
**Journeys Accessible:** UJ-014, UJ-015, UJ-016 (enterprise financial workflows)  
**Approval Authority:** Credit decisions up to $50,000; escalate >$50,000 to CFO approval; Discount approval  
**Data Access:** All customer financial data, All orders (approval workflow), All contracts  
**Constraints:** Desktop-only; offline document review; audit trail maintained for all approvals  

---

### PERS-007: Technician (Fixed/FWA)
**Business Function:** Installation & Provisioning  
**Organizational Level:** Frontline  
**Primary Channels:** Tablet, Web Portal  
**Customer Types:** Consumer Fixed Line & FWA

**Permissions:** Check RFS, Confirm installation feasibility, Update service status, Document handover  
**Journeys Accessible:** UJ-007, UJ-008, UJ-018 (installation journeys); can only execute, not initiate  
**Approval Authority:** No approval; can reject if installation impossible  
**Data Access:** Own job assignments, Customer location data, Service configuration  
**Constraints:** Field-based (mobile); limited connectivity expected; offline mode needed  

---

### PERS-008: Chooser (Enterprise Customer)
**Business Function:** Enterprise Account Administration  
**Organizational Level:** Customer/End-user  
**Primary Channels:** Web Self-Care, Mobile App, Email  
**Customer Types:** Enterprise (account-level)

**Permissions:** Submit change requests, Manage end-users, View billing, Submit special requests, Authorize transactions  
**Journeys Accessible:** Limited to self-service journeys (update profile, view billing, submit change requests)  
**Approval Authority:** Within their authorized scope (can authorize employees to use numbers)  
**Data Access:** Own company data, Own billing, Team member list, Service configuration  
**Constraints:** Email-based authentication; specific email must match registered chooser; web/app-only  

---

### PERS-009: Admin/System (Internal)
**Business Function:** System Administration  
**Organizational Level:** Technical/Backend  
**Primary Channels:** Backend Systems, Admin Console  
**Customer Types:** N/A (internal)

**Permissions:** Manage users, Configure systems, Audit data, Override any process, Maintain data integrity  
**Journeys Accessible:** All system-level operations  
**Approval Authority:** Can override any approval  
**Data Access:** All data (unrestricted)  
**Constraints:** Internal-only; full audit trail; change control required  

---

### PERS-010: Telesales Agent (Optional)
**Business Function:** Inbound/Outbound Sales  
**Organizational Level:** Frontline  
**Primary Channels:** Desktop, Phone System  
**Customer Types:** Consumer (Prepaid, Postpaid)

**Permissions:** Create lead, Qualify customer, Offer products, Process simple orders  
**Journeys Accessible:** UJ-001, UJ-004, UJ-006 (can initiate, hand off to fulfillment)  
**Approval Authority:** None  
**Data Access:** All leads (assigned channel), Customer profile  
**Constraints:** Desktop-only; phone integration required; no customer-present authentication (ID scan)  

---

---

## Role-Based Access Control (RBAC) Matrix

### Permission Coverage by Persona

| Persona | Journeys | Workflows | Views | Actions | Approval Authority | Access Level |
|---------|----------|-----------|-------|---------|-------------------|--------------|
| Retail Agent | 6 | 5 | 10 | 14 | Own orders only | Limited |
| CSR | 7 | 6 | 15 | 18 | None | Operational |
| Channel Manager | 2 | 3 | 8 | 10 | Partner orders ($0-∞) | Extended |
| Account Manager | 4 | 4 | 6 | 8 | None (requests approvals) | Extended |
| Fulfillment Team | 13 | 13 | 12 | 15 | None (reject only) | Backend |
| Finance Approver | 3 | 3 | 8 | 6 | Enterprise credit ($50K) | Financial |
| Technician | 3 | 2 | 5 | 7 | None (technical only) | Technical |
| Chooser (Customer) | 1 | 1 | 4 | 4 | Within account scope | Self-Service |
| Admin/System | 13 | 13 | 40 | 80 | Override all | Administrative |

**Key Findings:**
- Retail Agents: Limited journey access (tablet-only), require Channel Manager approval for orders >$1000
- CSR/Fulfillment: No approval authority; dependent on upstream validation
- Channel Managers: Isolated partner access (P1 cannot see P2); fraud control mechanism
- Finance Approvers: Critical bottleneck for enterprise deals; $50K approval threshold
- Technicians: Field-only access; no customer data visibility; offline mode needed
- Customers (Choosers): Severely limited; email-based access only; no real-time journey access

### Permission-to-Persona Mapping

**[To be populated from workflow analysis]**

#### Sample: Create Customer Permission

```
PERMISSION: PERM-001 Create Customer

ASSIGNED TO:
├─ PERS-001: Retail Agent (CSR)
│   ├─ Scope: Own leads + assigned prospects
│   ├─ Conditions: During business hours (9am-6pm) only
│   ├─ Approval Required: No (self-service)
│   └─ Audit Trail: Full logging enabled
│
├─ PERS-002: Customer Service Representative
│   ├─ Scope: All customers
│   ├─ Conditions: None
│   ├─ Approval Required: No
│   └─ Audit Trail: Full logging enabled
│
├─ PERS-003: Fulfillment Team
│   ├─ Scope: None (cannot create)
│   ├─ Reason: "Order fulfillment only, no customer creation"
│   └─ Alternative: Must request CSR/Manager
│
├─ PERS-004: Manager
│   ├─ Scope: All customers + team members' customers
│   ├─ Conditions: None
│   ├─ Approval Required: No
│   ├─ Override Capability: Yes (can create on behalf)
│   └─ Audit Trail: Full logging enabled
│
└─ PERS-005: System Administrator
    ├─ Scope: All customers (bulk creation)
    ├─ Conditions: None
    ├─ Approval Required: No
    ├─ Admin Functions: Batch import, data correction
    └─ Audit Trail: Full logging enabled

TOTAL ASSIGNED: 4 personas
NOT ASSIGNED: PERS-006 (Customer) - Cannot create own record
CONFLICT CHECK: None identified
```

---

## Journey Accessibility Matrix

### Which Personas Can Initiate Which Journeys?

| Journey | CSR | Manager | Executive | Tech | Admin | Customer | Status |
|---------|-----|---------|-----------|------|-------|----------|--------|
| UJ-001: New Postpaid | ✓ | ✓ | ✓ |  | ✓ | ✓ (Self) | Complete |
| UJ-002: Pre-to-Post | ✓ | ✓ | ✓ |  | ✓ |  | Complete |
| UJ-003: MNP | ✓ | ✓ | ✓ |  | ✓ | ✓ (Self) | Complete |
| UJ-004: FWA Install | ✓ | ✓ | ✓ | ✓ | ✓ |  | Complete |
| UJ-005: Fixed Line | ✓ | ✓ | ✓ |  | ✓ |  | Complete |
| UJ-006: Service Upgrade |  |  |  |  |  | ✓ (Self) | Gap: No agent access |
| UJ-007: Home Move |  |  |  |  |  | ✓ (Self) | Gap: No agent access |
| UJ-008: Cancellation | ✓ | ✓ | ✓ |  | ✓ | ✓ (Self) | Complete |

**Gap Analysis:**
- UJ-006 & UJ-007: Customer self-service only, no agent-assisted option
- Recommendation: Add agent capability for overflow/assisted scenarios

---

## Action-to-Permission Matrix

### Which Permissions Are Required to Execute Which Actions?

**[To be populated from workflow analysis]**

#### Sample: Order Approval Action

```
ACTION: ACT-010 Approve Order

PREREQUISITES:
├─ User must have PERM-010 (Approve Orders)
├─ User must have PERM-011 (Access Credit System)
├─ User must have PERM-003 (View Customer Data)
└─ User's approval limit must be >= Order amount

AVAILABLE TO PERSONAS:
├─ PERS-003: Order Manager
│   ├─ Approval limit: $5,000
│   ├─ Escalation: >$5,000 → Executive
│   └─ Conditions: None
│
├─ PERS-004: Finance Manager
│   ├─ Approval limit: $10,000
│   ├─ Escalation: >$10,000 → Executive
│   └─ Conditions: None
│
└─ PERS-005: Executive
    ├─ Approval limit: Unlimited
    ├─ Escalation: Board approval for >$100K
    └─ Conditions: None

CONFLICT CHECK: None (clear hierarchy)
COVERAGE: 100% of approval scenarios covered
```

---

## View-to-Persona Visibility Matrix

### Which Personas See Which Views?

| View | CSR | Manager | Executive | Customer | Admin | Channel | Status |
|------|-----|---------|-----------|----------|-------|---------|--------|
| VW-001: Customer Data Entry | ✓ | ✓ | ✓ | ✓ | ✓ | All | Complete |
| VW-002: Credit Review | ✓ | ✓ | ✓ |  | ✓ | Desktop | Gap: Tech user missing |
| VW-003: Payment Entry | ✓ | ✓ |  | ✓ | ✓ | All | Complete |
| VW-004: Fulfillment Queue | ✓ | ✓ | ✓ |  | ✓ | Tablet | Complete |
| VW-005: Order History | ✓ | ✓ | ✓ | ✓ (Own) | ✓ | All | Complete |
| VW-006: Analytics Dashboard |  | ✓ | ✓ |  | ✓ | Desktop | Complete |
| VW-007: Admin Config |  |  |  |  | ✓ | Desktop | Complete |

**Observations:**
- Admin has access to all views (expected)
- Customer access limited to own data (privacy correct)
- Tech users missing from Credit Review (should be added?)

---

## Persona-Specific Capability Profiles

### Profile 1: Customer Service Representative (CSR)

```
PERSONA: PERS-001 - Retail Agent / Customer Service Representative

Role Definition:
├─ Business Function: Customer-Facing Sales & Support
├─ Organizational Level: Frontline
├─ Primary Channels: Tablet, Desktop
├─ Customer Types: All (Consumer, SMB)
│
├─ PERMISSIONS ASSIGNED:
│   ├─ PERM-001 Create Customer
│   ├─ PERM-002 Validate Address
│   ├─ PERM-003 View Customer Data
│   ├─ PERM-004 Update Customer Profile
│   ├─ PERM-005 Create Order
│   ├─ PERM-006 View Order Status
│   ├─ PERM-007 Search Orders
│   ├─ PERM-008 Cancel Order (Own orders < 24hrs only)
│   ├─ PERM-009 Send Order to Approval
│   ├─ PERM-015 Send Notification
│   ├─ PERM-016 View Reports (Personal only)
│   └─ PERM-017 Audit Trail Access
│
├─ CAPABILITY SUMMARY:
│   ├─ Can initiate: 7 journeys
│   ├─ Can approve: None (except own tasks <$100)
│   ├─ Can escalate: All (to Manager)
│   ├─ Can cancel: Own orders <24hrs
│   ├─ Can view: Own customer records + assigned leads
│   └─ Can modify: Customer data (supervised by Manager)
│
├─ APPROVAL AUTHORITY:
│   ├─ Approval limit: $0 (cannot approve orders)
│   ├─ Can route to: Manager/Executive
│   └─ Can escalate: All cases
│
├─ DATA ACCESS:
│   ├─ Customer data: Own leads + assigned accounts
│   ├─ Order data: Own orders + assigned accounts
│   ├─ Financial data: Summary only (no pricing details)
│   ├─ Confidential data: None
│   └─ Audit trail: Can view own actions
│
├─ OPERATIONAL CONSTRAINTS:
│   ├─ Availability: Business hours (9am-6pm, IST)
│   ├─ Devices: Tablet (primary), Desktop (secondary)
│   ├─ Network: Office + VPN (no remote access)
│   ├─ Concurrent sessions: 1 (single device)
│   └─ Session timeout: 30 minutes (auto-logout)
│
├─ TYPICAL WORKFLOW:
│   1. Customer approaches retail counter
│   2. CSR searches for customer / creates new record
│   3. CSR fills customer details (with validation)
│   4. CSR selects service/product
│   5. CSR submits order for approval
│   6. CSR tracks approval status
│   7. CSR notifies customer of status
│   8. CSR routes to fulfillment if approved
│
├─ COMMON PAIN POINTS:
│   ├─ Cannot approve orders (must route to Manager)
│   ├─ Cannot override validations
│   ├─ Cannot access customer history before creation
│   └─ Cannot generate complex reports
│
└─ TRAINING REQUIREMENTS:
    ├─ Core systems: CRM, Order Management, Payment
    ├─ Processes: Customer onboarding, Order creation, Order tracking
    ├─ Compliance: Privacy policy, Data handling, Escalation procedures
    ├─ Duration: 5 days (initial) + 2 days (quarterly refresher)
    └─ Certification: Required before system access
```

### Profile 2: Order Manager / Approval Manager

```
PERSONA: PERS-003 - Order Manager

Role Definition:
├─ Business Function: Order Approval & Quality Oversight
├─ Organizational Level: Supervisor/Team Lead
├─ Primary Channels: Desktop (primary), Tablet (secondary)
├─ Customer Types: All
│
├─ PERMISSIONS ASSIGNED:
│   ├─ [All CSR permissions]
│   ├─ PERM-010 Approve Orders (up to $5,000)
│   ├─ PERM-011 Access Credit System
│   ├─ PERM-012 Escalate Orders
│   ├─ PERM-013 Override Approval
│   ├─ PERM-014 View Approval History
│   ├─ PERM-018 Manage Team
│   ├─ PERM-019 View Team Reports
│   ├─ PERM-020 Audit Trail (Team)
│   └─ PERM-021 Delegate Approval
│
├─ APPROVAL AUTHORITY:
│   ├─ Approval limit: $5,000
│   ├─ Escalation for: $5,000 - $100,000 → Executive
│   ├─ Can override: Credit decisions (with logging)
│   ├─ Approval cycle: 24-hour SLA
│   └─ Delegation: Can delegate to other managers
│
├─ DATA ACCESS:
│   ├─ Customer data: All (team + others)
│   ├─ Order data: All
│   ├─ Financial data: Full (approval authority)
│   ├─ Confidential data: Business rules (not personal customer info)
│   └─ Audit trail: All team member actions
│
├─ OPERATIONAL CONSTRAINTS:
│   ├─ Availability: Business hours + 2 hours after hours
│   ├─ Network: Office + full VPN access (remote allowed)
│   ├─ Concurrent sessions: 3 (multiple devices)
│   └─ Session timeout: 60 minutes
│
└─ TYPICAL WORKFLOW:
    1. Monitor approval queue
    2. Review orders (customer, amount, credit, risk)
    3. Make approval decision
    4. Escalate if needed
    5. Override if justified
    6. Notify CSR of decision
```

### Profile 3: System Administrator

```
PERSONA: PERS-005 - System Administrator

Role Definition:
├─ Business Function: System Operations & Support
├─ Organizational Level: Administrator
├─ Primary Channels: Desktop
├─ Customer Types: N/A (no direct customer interaction)
│
├─ PERMISSIONS ASSIGNED:
│   ├─ All permissions (PERM-001 through PERM-050+)
│   ├─ User Management
│   ├─ Permission Management
│   ├─ Role Assignment
│   ├─ System Configuration
│   ├─ Integration Management
│   ├─ Audit & Compliance
│   ├─ Backup & Recovery
│   └─ Performance Monitoring
│
├─ CAPABILITY SUMMARY:
│   ├─ Can access: All system features
│   ├─ Can modify: Any entity, business rule, configuration
│   ├─ Can create: Users, roles, permissions
│   ├─ Can delete: Any data (with retention policy)
│   ├─ Can override: All approval workflows
│   └─ Can bypass: Validation rules (audit trail required)
│
└─ OPERATIONAL CONSTRAINTS:
    ├─ Availability: 24/7 on-call
    ├─ Network: Secure VPN + Multi-factor authentication (MFA)
    ├─ Concurrent sessions: Unlimited
    ├─ Session timeout: No automatic logout
    ├─ Logging: All actions fully audited
    └─ Approval required: For dangerous operations (system-wide changes)
```

---

## Permission Overlap Analysis

### Personas with Similar Capabilities

```
OVERLAP GROUP 1: Managers & Executives (Approval Authority)
├─ Shared permissions: PERM-010, PERM-011, PERM-012, PERM-014
├─ Key difference: Approval limit ($5K vs. Unlimited)
├─ Risk: Similar authority could lead to duplicate approvals
└─ Mitigation: Audit trail differentiates levels

OVERLAP GROUP 2: CSR & Manager (Customer Operations)
├─ Shared permissions: PERM-001, PERM-002, PERM-003, PERM-004, PERM-005
├─ Key difference: Manager can approve (CSR cannot)
├─ Risk: CSR could escalate unnecessarily
└─ Mitigation: Training on appropriate use

OVERLAP GROUP 3: Manager & Admin (System Access)
├─ Shared permissions: PERM-018, PERM-019, PERM-020
├─ Key difference: Admin has technical access (Manager has operational)
├─ Risk: None (different contexts)
└─ Note: Complement each other
```

---

## Permission Conflicts & Resolutions

### Conflict 1: CSR Approval Authority

**Conflict Description:**
- Document A: "CSR can approve orders up to $500"
- Document B: "CSR cannot approve orders"
- Document C: "CSR can approve with manager review"

**Root Cause:** Unclear role definition for different customer segments

**Resolution:**
- CSR: Can submit orders only (no approval authority)
- CSR + Manager Review: New permission tier "Provisional Approval" (Manager reviews before execution)
- Manager: Can approve orders up to $5,000

**Implementation:** Update all three source documents

### Conflict 2: Data Visibility Inconsistency

**Conflict Description:**
- "CSR can view customer financial history"
- "CSR cannot access financial data"

**Root Cause:** Unclear distinction between "customer history" and "financial data"

**Resolution:**
- Customer history: Invoice/order history (CSR can view)
- Financial data: Pricing, discounts, cost details (CSR cannot view)

**Implementation:** Add glossary definitions + update permission descriptions

---

## Capability Assessment

### Coverage by Function

| Function | CSR | Manager | Executive | Tech | Admin | Customer | Coverage |
|----------|-----|---------|-----------|------|-------|----------|----------|
| Order Creation | ✓ | ✓ | ✓ |  | ✓ | ✓ (Self) | 100% |
| Order Approval | | ✓ | ✓ |  | ✓ | | 75% (Gap: No tech approval) |
| Payment Processing | ✓ | ✓ | ✓ |  | ✓ | ✓ (Own) | 100% |
| SIM Provisioning |  | ✓ | ✓ | ✓ | ✓ | | 80% |
| Service Activation |  | ✓ | ✓ | ✓ | ✓ | | 80% |
| Fulfillment |  | ✓ | ✓ | ✓ | ✓ | | 80% (Gap: No CSR tracking) |
| Reporting | ✓ (Limited) | ✓ | ✓ |  | ✓ | ✓ (Own) | 100% |

---

## Next Steps

1. **Validate Personas:** Confirm all identified personas with business SMEs
2. **Resolve Conflicts:** Address permission conflicts identified above
3. **Audit Coverage:** Ensure all journey initiation scenarios are covered
4. **Document Constraints:** Formalize operational constraints per persona
5. **Test Access Control:** Validate RBAC implementation matches matrix

---

**[Complete persona profiles and capability matrices will be populated from workflow analysis]**
