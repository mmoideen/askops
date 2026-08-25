---
id: incident-escalation-matrix
title: Incident Escalation Matrix
classification: restricted
owner: Platform Engineering
updated: 2026-02-18
---

This document defines Northfield Systems severity levels for production incidents, who must be paged at each level, escalation timelines, and the thresholds that trigger executive communication. It applies to every service owned by Platform Engineering and any service integrated with the customer facing platform. All engineers on the on call rotation are expected to know these thresholds without looking them up during an active incident.

## Severity Definitions

| Severity | Definition                                                           | Example                                       |
| -------- | -------------------------------------------------------------------- | --------------------------------------------- |
| SEV1     | Full outage or data loss affecting all customers                     | Checkout API returning 500s platform wide     |
| SEV2     | Major degradation affecting a subset of customers or a core workflow | Search latency above 8 seconds for one region |
| SEV3     | Minor impact, workaround available                                   | Non critical report export delayed            |
| SEV4     | Cosmetic or low impact issue                                         | Broken tooltip in an internal dashboard       |

## Paging and Timelines

SEV1 requires paging the Incident Commander (IC) within 5 minutes of detection through the Beacon paging system, and the on call Platform Engineer must acknowledge within 5 minutes or the page automatically escalates to the secondary on call. A dedicated incident channel is created in Relay within 10 minutes.

SEV2 requires paging within 15 minutes and acknowledgment within 15 minutes. SEV3 does not page; a ticket is filed in the NSD-PLAT queue and triaged within 4 business hours. SEV4 issues are logged to the backlog and reviewed at the next weekly triage, with no same day action required.

## Roles During an Incident

Every SEV1 or SEV2 incident requires three roles: the Incident Commander, who owns decisions and status updates; a Communications Lead, who drafts customer and internal updates; and a Scribe, who maintains the timeline in the incident document. The IC role rotates independently from the on call engineering rotation described in the Oncall Rotation Handbook; IC coverage is a separate schedule maintained by Platform Engineering leads.

## Executive Communication Thresholds

Any SEV1 incident triggers automatic notification to the VP of Engineering and the Chief Operating Officer within 30 minutes of declaration, sent by the Communications Lead through the executive Relay channel. SEV2 incidents that remain unresolved after 2 hours also trigger executive notification. SEV3 and SEV4 incidents never require executive notification regardless of duration. Customer facing status page updates are required for SEV1 within 15 minutes of declaration and for SEV2 within 45 minutes.

## Related Runbooks

For incidents involving the primary database cluster, follow the Database Failover Procedure in parallel with this matrix; failover decisions still require IC sign off. If evidence of unauthorized access is found during triage, stop and immediately follow Security Incident Response instead of continuing standard incident handling, since evidence handling rules differ significantly once a security event is suspected.
