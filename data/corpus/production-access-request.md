---
id: production-access-request
title: Production Access Request
classification: restricted
owner: Security Engineering
updated: 2026-03-10
---

This document explains how Northfield Systems employees request access to production systems, including standing access, just in time (JIT) elevation, required approvals, and the cadence of periodic audit review. Production access of any kind requires completion of Data Handling and Classification training first; see New Hire Onboarding for training deadlines.

## Requesting Access

Submit form PAR-1 through the NSD-SEC queue, specifying the system, the requested permission level (read only, operator, or admin), and a business justification. Requests without a specific business justification are automatically rejected rather than held for clarification, so include enough detail the first time. Standing access requests are reviewed within 2 business days; JIT requests are reviewed within 30 minutes during business hours.

## Just In Time Elevation

Most day to day production work should use JIT elevation rather than standing access. JIT grants are scoped to a specific system and expire automatically after a 4 hour window, after which the engineer must request a new grant. JIT access is requested directly from the access console at access.northfield.internal and requires a linked ticket number from an active incident or change request. There is no stipend or exception process to extend a JIT window; if more time is needed, submit a new request before the current one expires.

## Approval Requirements

| Access Type        | Approvals Required                             |
| ------------------ | ---------------------------------------------- |
| JIT elevation      | 1 approver (service owner or on call lead)     |
| Standing read only | 1 approver (manager)                           |
| Standing operator  | 2 approvers (manager and service owner)        |
| Standing admin     | 2 approvers plus Security Engineering sign off |

Approvers cannot approve their own requests, and a request pending more than 5 business days without action is automatically escalated to the approver's manager.

## Audit Review Cadence

Security Engineering runs a full access review every 90 days, cross referencing every standing grant against current employment status and role. Access holders who no longer need a permission are notified and given 10 business days to justify continued access before it is revoked automatically. Any access granted to someone who has since left Northfield Systems and was not revoked within 24 hours of their offboarding is treated as a security incident and handled under Security Incident Response.

## Related Procedures

Credentials associated with production access, including service account keys, follow their own lifecycle described in the API Key Rotation SOP. Engineers with standing admin access are required to review that document as part of onboarding to their access level.
