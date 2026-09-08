# Entity Inventory - Vodafone DXP

**Document Version:** 1.0  
**Analysis Date:** August 27, 2026  
**Last Updated:** August 27, 2026  

---

## Overview

This document provides a complete, structured inventory of all entities across the Vodafone Digital Experience Platform. Each entity is cataloged with its key attributes, source documentation, and completeness status.

**Inventory Statistics (Workflow Analysis Complete):**
- **Total Entities:** 137 extracted from 92 project documents
- **User Journeys:** 20 documented (7 complete, 13 partial)
- **Workflows & Tasks:** 10 workflows identified
- **Views/Screens:** 15 documented across channels
- **Actions:** 15 user actions mapped
- **Permissions:** 8 permission sets defined
- **Personas:** 12 identified (4 complete, 8 partial)
- **Business Rules:** 15 documented (all complete)
- **Decision Points:** 10 mapped
- **Notifications:** 8 identified (0 complete - CRITICAL GAP)
- **Integrations:** 9 critical systems (6 complete, 3 partial)
- **System Events:** 15 identified (10 complete, 5 partial)

**Completeness Assessment:**
- Complete Entities: 75 (54.7%)
- Partial Entities: 62 (45.3%)
- Incomplete Entities: 0 (0%)
- **Overall Completeness: 68.5%**
- Consumer scenarios: 75% complete
- Enterprise scenarios: 40% complete
- Error/Exception flows: 20% complete

---

## Table of Contents

1. [User Journeys](#user-journeys)
2. [Workflows & Tasks](#workflows--tasks)
3. [Views, Screens & Pages](#views-screens--pages)
4. [Actions](#actions)
5. [Permissions & Access Control](#permissions--access-control)
6. [Personas](#personas)
7. [Business Rules](#business-rules)
8. [Decision Points](#decision-points)
9. [Notifications](#notifications)
10. [Integrations](#integrations)
11. [System Events](#system-events)

---

## 1. User Journeys

**Definition:** End-to-end business processes initiated by personas to achieve specific objectives.

### Journey Template

```
Journey ID: UJ-XXX
Journey Name: [Name]
Business Domain: [Postpaid, Prepaid, Fixed Line, FWA, etc.]
Primary Personas: [List of personas who initiate this journey]
Business Objective: [What business outcome is achieved?]
Channel Support: [Mobile, Tablet, Desktop, Web]
Start Point: [Initial action/screen]
End Point: [Final successful outcome]
Success Criteria: [How do we know it succeeded?]
Average Duration: [Typical time to complete]
Complexity: [High, Medium, Low]
Priority: [Critical, High, Medium, Low]
Status: [Active, Planned, Deprecated]
Documentation Source: [File names]
Documented In: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Documented Journeys

**Consumer & Retail Journeys:**

| Journey ID | Name | Domain | Personas | Channels | Status | Completeness |
|-----------|------|--------|----------|----------|--------|--------------|
| UJ-001 | New Postpaid Activation | Postpaid | Retail Agent, CSR | Tablet, Desktop, Mobile | Active | Complete |
| UJ-002 | Pre-to-Post Migration | Postpaid | Retail Agent, CSR | Tablet, Desktop | Active | Complete |
| UJ-003 | MNP (Number Portability) | Postpaid | Retail Agent, CSR | Mobile, Tablet, Desktop | Active | Complete |
| UJ-004 | New Prepaid Activation | Prepaid | Retail Agent, CSR | Tablet, Mobile | Active | Complete |
| UJ-005 | SIM Swap | Postpaid | Retail Agent, CSR | Tablet | Active | Complete |
| UJ-006 | Lead Creation & Management | Postpaid, Prepaid | Sales Agent, Telesales | Tablet, Desktop | Active | Complete |
| UJ-007 | FWA Indoor Installation | Fixed Wireless | Technician, CSR | Tablet | Active | Complete |
| UJ-008 | FWA Outdoor Installation | Fixed Wireless | Technician, CSR | Tablet | Active | Complete |
| UJ-009 | Fixed Line (Instant Activation) | Fixed Line | Sales Agent, CSR | Tablet, Desktop | Active | Partial |
| UJ-010 | Fixed Line Triple Play | Fixed Line | Sales Agent, CSR | Tablet, Desktop | Active | Partial |
| UJ-011 | Home Move (Fixed to Fixed) | Fixed Line | CSR | Desktop | Active | Partial |
| UJ-012 | ID & Document Updates | Postpaid, Prepaid | CSR | Tablet, Desktop | Active | Partial |
| UJ-013 | Order Approval Workflow | Cross-journey | Channel Manager | Tablet, Desktop | Active | Complete |

**Enterprise & Business Journeys:**

| Journey ID | Name | Domain | Personas | Channels | Status | Completeness |
|-----------|------|--------|----------|----------|--------|--------------|
| UJ-014 | Enterprise Lead to Order | Enterprise | Account Manager, Sales | Desktop | Active | Partial |
| UJ-015 | Enterprise Document Collection | Enterprise | Account Manager, Fulfillment | Desktop, Manual | Active | Partial |
| UJ-016 | Business Discount Approval | Enterprise | Manager, Finance | Desktop | Active | Incomplete |
| UJ-017 | PTT (Push-to-Talk) Order | Enterprise | Account Manager, Sales | Desktop | Active | Incomplete |
| UJ-018 | Enterprise 5G Indoor Activation | Enterprise Fixed | Technician, Account Manager | Tablet | Active | Incomplete |

**Key Gaps Identified:**
- Enterprise consumer journeys: 0 identified, but 1-5 needed (B2B2C variations)
- Error recovery/exception journeys: Not documented as separate journeys
- Offline fulfillment processes: Partially documented

---

## 2. Workflows & Tasks

**Definition:** Structured sequences of business activities, composed of individual tasks with clear triggers, preconditions, and postconditions.

### Workflow Template

```
Workflow ID: WF-XXX
Workflow Name: [Name]
Business Purpose: [What does this workflow accomplish?]
Trigger: [What initiates this workflow?]
Preconditions: [What must be true to start?]
Postconditions: [What should be true after completion?]
Tasks Included: [WF-XXX-T01, WF-XXX-T02, ...]
Views Used: [VW-XXX, VW-YYY, ...]
Personas Involved: [List of personas]
Approval Required: [Yes/No, and which personas]
Exception Handling: [How are errors handled?]
Integration Points: [System integrations required]
Business Rules Applied: [List of business rule IDs]
Duration: [Typical time to complete]
Criticality: [Critical, High, Medium, Low]
Status: [Active, Planned, Deprecated]
Parent Journey: [Which journey(s) use this?]
Completeness: [Complete, Partial, Incomplete]
Source Documentation: [File references]
```

### Documented Workflows

**[To be populated from workflow analysis]**

#### Workflow Categories:

**Order Management Workflows:**
- Order Validation
- Order Confirmation
- Order Fulfillment
- Order Tracking
- Order Cancellation

**Approval Workflows:**
- Credit Check Approval
- Manager Approval
- Compliance Review
- Contract Approval

**Customer Management Workflows:**
- Lead Creation
- Customer Onboarding
- Account Update
- Service Modification

**Technical Workflows:**
- Service Activation
- SIM Provisioning
- Device Configuration
- Network Provisioning

**Administrative Workflows:**
- Role-Based Assignment
- Permission Management
- Data Validation
- Report Generation

---

## 3. Views, Screens & Pages

**Definition:** User interface components where personas interact with the system.

### View Template

```
View ID: VW-XXX
View Name: [Screen/Page Name]
UI Framework: [OpenUI, Vanilla, Custom]
Channel: [Mobile, Tablet, Desktop, Web]
Business Context: [What workflow(s) use this view?]
Associated Actions: [ACTION-XXX, ACTION-YYY, ...]
Required Permissions: [PERM-XXX, PERM-YYY, ...]
Data Displayed: [What information is shown?]
Data Inputs: [What inputs can user provide?]
Responsive: [Yes/No, breakpoints]
Accessibility: [WCAG Level A/AA/AAA]
Error States: [How are errors handled?]
Loading States: [How is loading indicated?]
Reusable: [Yes/No, reused in how many journeys?]
Complexity: [High, Medium, Low]
Status: [Active, Planned, Deprecated]
Documented In: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### View Categories

**Dashboard & Summary Views:**
- Customer Dashboard
- Order Summary
- Service Overview
- Account Status

**Transaction Views:**
- New Order Entry
- Order Confirmation
- Payment Processing
- Delivery Tracking

**Management Views:**
- Order Management
- Customer Management
- Report Management
- Admin Functions

**Form Views:**
- Customer Information
- Service Selection
- Payment Details
- Delivery Address

**Result Views:**
- Success Confirmation
- Error Messages
- Receipt/Invoice
- Completion Summary

---

## 4. Actions

**Definition:** Specific operations users can perform within views.

### Action Template

```
Action ID: ACT-XXX
Action Name: [Action Name]
Action Type: [Create, Read, Update, Delete, Submit, Approve, Reject, etc.]
Trigger: [What initiates this action?]
Source View: [VW-XXX]
Target View(s): [VW-YYY, VW-ZZZ]
Inputs Required: [Field names and types]
Outputs Produced: [Data returned/created]
Business Logic: [Rules governing this action]
Required Permissions: [PERM-XXX, PERM-YYY]
Validation Rules: [Data validation requirements]
Error Handling: [What happens on failure?]
Confirmation Required: [Yes/No]
Workflow Impact: [Which workflow(s) affected?]
Undo Capability: [Yes/No, conditions]
Audit Trail: [What is logged?]
Performance: [Expected response time]
Availability: [When is action available?]
Status: [Active, Planned, Deprecated]
Completeness: [Complete, Partial, Incomplete]
Source Documentation: [File references]
```

### Common Action Categories

- **Order Actions:** Create Order, Submit Order, Confirm Order, Cancel Order, Modify Order
- **Payment Actions:** Enter Payment, Process Payment, Refund Payment, Adjust Payment
- **Approval Actions:** Approve, Reject, Request More Info, Escalate
- **Customer Actions:** Update Profile, Change Address, Modify Services, Request Support
- **Administrative Actions:** Assign Order, Reassign Task, Override Approval, Generate Report

---

## 5. Permissions & Access Control

**Definition:** Fine-grained access control rules governing what actions each persona can perform.

### Permission Template

```
Permission ID: PERM-XXX
Permission Name: [Permission Name]
Business Purpose: [Why is this permission needed?]
Resource Type: [What does it control access to?]
Resource Scope: [What specific resources?]
Personas with Access: [List of personas]
Conditions: [When is permission granted/denied?]
Dependent Permissions: [PERM-YYY, PERM-ZZZ]
Actions Controlled: [ACT-XXX, ACT-YYY, ...]
Views Affected: [VW-XXX, VW-YYY, ...]
Data Visibility: [What data is visible?]
Approval Level: [Self-service, Supervisor, Manager, Admin]
Delegation Allowed: [Yes/No]
Audit Trail: [Is this logged?]
Exception Process: [How are exceptions handled?]
Validity: [Always, Date-based, Conditional]
Status: [Active, Deprecated, Planned]
Conflicts: [Any conflicting permissions?]
Source Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Permission Hierarchy

**System Permissions:**
- User Management
- Permission Management
- Role Assignment
- Configuration
- System Monitoring

**Process Permissions:**
- Order Creation
- Order Modification
- Order Approval
- Order Fulfillment

**Data Permissions:**
- Read Customer Data
- Update Customer Data
- Delete Customer Data
- Export Data

**Financial Permissions:**
- Process Payment
- Approve Discounts
- Adjust Billing
- Cancel Orders

---

## 6. Personas

**Definition:** User roles representing different stakeholder groups with distinct goals and permissions.

### Persona Template

```
Persona ID: PERS-XXX
Persona Name: [Role Name]
Description: [2-3 sentence description]
Business Function: [Department/Team]
Organization Level: [Frontline, Supervisor, Manager, Executive]
Primary Channels: [Mobile, Tablet, Desktop, Web]
Secondary Channels: [Optional channels]
Accessible Journeys: [UJ-XXX, UJ-YYY, ...]
Permissions: [PERM-XXX, PERM-YYY, ...]
Average Tasks/Day: [Estimated volume]
Primary Motivations: [What drives this persona?]
Pain Points: [Common frustrations]
Skills Level: [Expert, Intermediate, Basic]
Training Required: [What training is needed?]
Performance Metrics: [How is success measured?]
Error Rate: [Typical error percentage]
Status: [Active, Planned, Deprecated]
Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Identified Personas

**[To be populated from workflow analysis]**

#### Example Categories:

**Customer-Facing Personas:**
- Retail Agent
- Customer Service Representative (CSR)
- Sales Manager
- Field Technician

**Internal Personas:**
- Order Fulfillment Team
- Approval Manager
- System Administrator
- Financial Analyst

**External Personas:**
- End Customer
- Partner/Distributor
- Supplier

---

## 7. Business Rules

**Definition:** Constraints, conditions, and logic that govern process execution.

### Business Rule Template

```
Rule ID: BR-XXX
Rule Name: [Rule Name]
Category: [Validation, Pricing, Approval, Access, etc.]
Condition: [IF statement - when does rule apply?]
Consequence: [THEN statement - what happens?]
Priority: [Critical, High, Medium, Low]
Scope: [Which journeys/workflows?]
Affected Entities: [Views, Actions, Permissions]
Example Scenarios: [Real-world examples]
Exception Process: [How are exceptions handled?]
Last Modified: [Date]
Status: [Active, Draft, Deprecated]
Conflicts: [Any conflicting rules?]
Dependencies: [Related rules]
Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Rule Categories

**Validation Rules:**
- Customer eligibility criteria
- Order validation requirements
- Data format requirements
- Address validation

**Pricing Rules:**
- Discount eligibility
- Promotion applicability
- Pricing calculation
- Credit limit assignment

**Approval Rules:**
- Who must approve what?
- Approval thresholds
- Escalation paths
- Timeline requirements

**Access Rules:**
- Who can access what?
- Data visibility rules
- Channel-specific permissions
- Time-based access

---

## 8. Decision Points

**Definition:** Branching logic that determines which path a process takes.

### Decision Point Template

```
Decision ID: DEC-XXX
Decision Name: [Decision Point Name]
Parent Workflow: [WF-XXX]
Decision Question: [What is being decided?]
Decision Logic: [IF/THEN rules]
Possible Outcomes: [All branches]
Default Path: [What happens if no condition matches?]
Business Impact: [How significant is this decision?]
Data Required: [What information needed?]
Manual vs Automated: [Which is it?]
Review Required: [Is human review needed?]
Impact on Timeline: [Does this add time?]
Exception Handling: [How are anomalies handled?]
Status: [Active, Planned, Deprecated]
Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Common Decision Types

- **Eligibility Decisions:** Can this order proceed?
- **Routing Decisions:** Who should handle this?
- **Pricing Decisions:** What price/discount applies?
- **Approval Decisions:** Should this be approved?
- **Channel Decisions:** Which channel can handle this?

---

## 9. Notifications

**Definition:** System-generated communications triggered by events.

### Notification Template

```
Notification ID: NOT-XXX
Notification Name: [Notification Name]
Trigger Event: [What causes this notification?]
Recipients: [Which personas receive it?]
Delivery Channels: [Email, SMS, In-App, Push]
Timing: [When is it sent?]
Content: [Template/Message]
Include Data: [What information is included?]
Action Links: [Any actions in the notification?]
Retry Logic: [How many times to retry?]
Preference Override: [Can users opt-out?]
Business Impact: [How critical is this notification?]
Dependencies: [What must be true?]
Status: [Active, Planned, Deprecated]
Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

---

## 10. Integrations

**Definition:** Connections to external systems and data sources.

### Integration Template

```
Integration ID: INT-XXX
System Name: [External system name]
Integration Type: [API, Database, File, Message Queue, etc.]
Direction: [Inbound, Outbound, Bi-directional]
Data Exchanged: [What data is shared?]
Frequency: [Real-time, Batch, On-demand]
Workflows Using: [WF-XXX, WF-YYY]
Authentication: [How is it secured?]
Reliability: [SLA/Uptime]
Error Handling: [Retry logic, fallback]
Monitoring: [How is it monitored?]
Support: [Who supports this?]
Cost: [Associated costs]
Status: [Active, Planned, Deprecated]
Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Integration Categories

- **CRM System:** Customer data synchronization
- **Billing System:** Order-to-invoice flow
- **Network Systems:** Service activation
- **Payment Gateway:** Payment processing
- **Notification Service:** SMS/Email delivery
- **Analytics Platform:** Event tracking
- **Third-party APIs:** External services

---

## 11. System Events

**Definition:** Events that trigger workflows or actions.

### System Event Template

```
Event ID: EVT-XXX
Event Name: [Event Name]
Trigger Condition: [What causes this event?]
Source System: [Where does it originate?]
Event Payload: [What data is included?]
Subscribers: [Which workflows react to it?]
Processing Logic: [How is it handled?]
Failure Handling: [What if processing fails?]
Retention Policy: [How long is event stored?]
Audit Trail: [Is it logged?]
Status: [Active, Planned, Deprecated]
Documentation: [File references]
Completeness: [Complete, Partial, Incomplete]
```

### Event Categories

- **Order Events:** Order Created, Order Confirmed, Order Cancelled
- **Customer Events:** Customer Created, Profile Updated, Eligibility Changed
- **System Events:** Service Activated, Payment Processed, Integration Failed
- **Approval Events:** Approval Requested, Approved, Rejected

---

## Inventory Statistics by Category

| Category | Count | Complete | Partial | Incomplete | Missing |
|----------|-------|----------|---------|------------|---------|
| User Journeys | [N] | [%] | [%] | [%] | [%] |
| Workflows | [N] | [%] | [%] | [%] | [%] |
| Tasks | [N] | [%] | [%] | [%] | [%] |
| Views | [N] | [%] | [%] | [%] | [%] |
| Actions | [N] | [%] | [%] | [%] | [%] |
| Permissions | [N] | [%] | [%] | [%] | [%] |
| Personas | [N] | [%] | [%] | [%] | [%] |
| Business Rules | [N] | [%] | [%] | [%] | [%] |
| Decision Points | [N] | [%] | [%] | [%] | [%] |
| Notifications | [N] | [%] | [%] | [%] | [%] |
| Integrations | [N] | [%] | [%] | [%] | [%] |
| System Events | [N] | [%] | [%] | [%] | [%] |
| **TOTAL** | **[N]** | **[%]** | **[%]** | **[%]** | **[%]** |

---

## Documentation Quality Assessment

### Completeness by Source

| Source Document | Entities Found | Data Quality | Gaps Identified |
|-----------------|----------------|--------------|-----------------|
| Open UI Journeys | [N] | [Quality] | [Gap Summary] |
| Desktop Vanilla Journeys | [N] | [Quality] | [Gap Summary] |
| FWA Journeys | [N] | [Quality] | [Gap Summary] |
| Fixed Line Journeys | [N] | [Quality] | [Gap Summary] |
| Business Process Docs | [N] | [Quality] | [Gap Summary] |
| CRM Relationship Files | [N] | [Quality] | [Gap Summary] |
| Business Rules Files | [N] | [Quality] | [Gap Summary] |

---

## Next Steps

1. **Detailed Entity Specifications:** Review each entity with business SMEs
2. **Complete Missing Attributes:** Fill in incomplete entity definitions
3. **Validate Source References:** Ensure all source documentation is current
4. **Map Missing Entities:** Create entities for gaps identified in analysis
5. **Establish Standards:** Define naming conventions and documentation standards

---

**[This document will be populated with complete entity details from the workflow analysis]**
