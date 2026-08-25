---
id: phishing-reporting-guide
title: Phishing Reporting Guide
classification: general
owner: IT Operations
updated: 2026-04-22
---

This guide explains how to report a suspected phishing email at Northfield Systems using the PhishAlert button, what happens after a report is submitted, and recent phishing patterns employees should watch for. Reporting quickly matters more than being certain; when in doubt, report it.

## How to Report

Every Northfield employee's email client includes the PhishAlert button in the toolbar. Select the suspicious message and click PhishAlert; this forwards the message with its full headers to Security Engineering and removes it from your inbox automatically, so you do not need to also forward it manually or reply to the sender. If the PhishAlert button is missing after a recent laptop reimage, open a ticket in the NSD-ITOPS queue rather than manually forwarding the email, since manual forwarding strips the header information Security Engineering needs to trace the source.

## What Happens After Reporting

Security Engineering triages every PhishAlert submission within 1 business hour during normal working hours, and within 4 hours for reports submitted overnight or on weekends. If a report is confirmed as phishing, the message is automatically quarantined from every mailbox in the organization that received it, not only the reporter's, typically within 30 minutes of confirmation. Employees who reported a confirmed phishing email receive a brief acknowledgment; employees who are found to have clicked a link or entered credentials in a confirmed phishing email are contacted directly by Security Engineering to walk through remediation steps, including a mandatory NorthID password reset following the Password Reset SOP.

## Recent Example Patterns

Recent confirmed phishing campaigns targeting Northfield employees have included messages impersonating the IT Service Desk asking employees to verify their NorthID password through a link to a lookalike domain rather than identity.northfield.internal. Another recurring pattern impersonates a senior executive requesting the urgent purchase of gift cards, sent from a lookalike display name rather than a real @northfield.example address; Finance Operations never requests gift card purchases through email under any circumstance. A third pattern uses a fake shipping notification referencing a laptop delivery, timed to arrive around when new hires are expecting hardware described in Laptop Provisioning.

## If You Are Not Sure

Reporting a legitimate email by mistake causes no harm and takes seconds; Security Engineering would rather triage a false positive than miss a real report. Do not click links or open attachments while deciding whether to report, and never enter your NorthID password into a page reached by clicking a link in an email, even if the page looks identical to the real sign in page. All employees complete Security Awareness 101 covering phishing recognition during their first week; see New Hire Onboarding for the training deadline.
