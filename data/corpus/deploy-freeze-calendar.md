---
id: deploy-freeze-calendar
title: Deploy Freeze Calendar
classification: general
owner: Platform Engineering
updated: 2026-06-30
---

This document defines Northfield Systems standing deploy freeze windows, the process for requesting an exception, and the criteria that qualify a change as an emergency deploy during a freeze. It applies to all production services, not only the customer facing platform.

## Standing Freeze Windows

The primary freeze window runs from December 15 through January 2 each year, covering the holiday period when on call staffing is reduced and customer support volume patterns are less predictable. A second freeze applies during major sales events, announced by Platform Engineering leadership at least 3 weeks in advance each time, typically covering a 5 to 7 day window around the event. Freeze windows are published in the shared engineering calendar and mirrored in the #team-platform-eng channel.

## What Counts as a Freeze

During a freeze, no changes to production configuration, database schema, or application code are permitted through the normal deploy pipeline, including changes considered low risk. Feature flag changes that do not touch code are generally allowed but should still be logged in the NSD-PLAT queue for visibility. Infrastructure scaling changes needed to handle freeze period traffic, such as increasing instance counts, are allowed since they do not modify application behavior.

## Exception Process

Teams that believe they need an exception during a freeze must submit a request through the NSD-PLAT queue at least 5 business days before the intended deploy, describing the change and the business reason it cannot wait until the freeze lifts. Exceptions require sign off from a Platform Engineering director. Exceptions are reviewed weekly during freeze periods, and same week approval is not guaranteed, so teams should plan around the freeze rather than assume an exception will be granted.

## Emergency Deploy Criteria

An emergency deploy during a freeze is permitted only to resolve a declared SEV1 or SEV2 incident as defined in the Incident Escalation Matrix. The Incident Commander for that incident must sign off on the emergency deploy, and the on call Platform Engineering lead is notified regardless of whether they are the one deploying. Emergency deploys are logged with a link to the incident and reviewed in the next business day's engineering sync to confirm the change was scoped tightly to the fix and did not bundle unrelated work.

## Coordination With On Call

Because freeze periods often overlap with reduced staffing, the on call schedule described in the Oncall Rotation Handbook is reviewed before each freeze window to confirm adequate primary and secondary coverage; gaps identified during this review are filled with volunteer coverage requests sent at least 2 weeks ahead of the freeze start date.
