---
id: oncall-rotation-handbook
title: Oncall Rotation Handbook
classification: general
owner: Platform Engineering
updated: 2026-01-22
---

This handbook describes how the Platform Engineering on call rotation works: schedule mechanics, the handoff ritual, how to request a swap or override, and how on call compensation is calculated. It complements the Incident Escalation Matrix, which defines what happens once you are paged.

## Rotation Schedule

The rotation runs in weekly shifts starting every Tuesday at 10:00 AM and is managed in Beacon. Each week has a primary and a secondary on call engineer; the secondary is paged automatically if the primary does not acknowledge a page within 5 minutes for a SEV1 or within 15 minutes for a SEV2, matching the timelines in the Incident Escalation Matrix. Engineers typically rotate through primary on call once every 6 to 8 weeks depending on team size.

## Handoff Ritual

Every Tuesday at 10:00 AM, outgoing and incoming primaries hold a 15 minute handoff sync. The outgoing primary walks through any open incidents, pending alerts that were suppressed, and any deploys that shipped in the last 48 hours that could still be causing issues. Handoff notes are logged in the on call channel in Relay so the record persists even if the sync is missed. Skipping the handoff sync without posting written notes is treated as an incomplete handoff and flagged to the team lead.

## Override and Swap Process

Planned swaps require at least 24 hours notice and must be requested through Beacon, where both engineers confirm the swap before it takes effect. Emergency swaps, such as a sudden illness, require only manager notification after the fact but should still be logged in Beacon within 24 hours for payroll accuracy. An engineer may not be on call for more than 2 consecutive weeks without director approval, regardless of volunteer swaps.

## Compensation Policy

Primary on call engineers receive a flat $150 per week stipend, paid regardless of page volume. Any page acknowledged outside normal business hours, before 8:00 AM or after 6:00 PM local time, or any time on a weekend, is compensated at 1.5x the engineer's standard hourly rate for time spent actively working the incident, tracked in 15 minute increments. Secondary on call engineers receive a $50 per week stipend and are compensated at the same 1.5x rate if the primary fails to acknowledge and the page escalates to them.

## Escalation Beyond the Rotation

If neither primary nor secondary acknowledges a SEV1 page within 10 minutes total, Beacon automatically escalates to the Platform Engineering on call manager. This escalation is logged and reviewed in the weekly Platform Engineering sync, and repeated missed pages by the same engineer are addressed directly by their manager rather than through the on call process itself.
