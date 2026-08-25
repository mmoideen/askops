---
id: password-reset-sop
title: Password Reset SOP
classification: general
owner: IT Operations
updated: 2025-10-07
---

This SOP covers how Northfield Systems employees reset a forgotten or expired NorthID password, both through self-service and with Service Desk assistance, along with identity verification steps and lockout thresholds. NorthID is the single sign-on identity used for email, VPN, and most internal tools.

## Self-Service Reset

Employees who remember their current password but need to change it, or who set up security questions in advance, can reset at identity.northfield.internal without contacting the Service Desk. Self-service reset requires answering 2 of 3 pre-configured security questions and approving a NorthAuth push notification. The new password takes effect immediately across all connected systems, including GlobalConnect, though an active VPN session must be manually reconnected to pick up the new credential.

## Helpdesk-Assisted Reset

If self-service is unavailable, for example after a phone upgrade that removed NorthAuth enrollment, open a ticket in the NSD-ITOPS queue or call the Service Desk directly. The Service Desk agent verifies identity using the employee ID number plus one additional factor: either a callback to the phone number on file in the HR system, or live video confirmation with a photo ID against the employee's badge photo. Verification over chat or email alone is never accepted, even if the request appears to come from a manager on the employee's behalf.

## Identity Verification Steps

1. Confirm employee ID and full legal name against the HR system record.
2. Confirm one additional factor: callback or video plus photo ID.
3. Issue a temporary password valid for 24 hours only.
4. Require the employee to set a permanent password and re-enroll NorthAuth at first login.

Temporary passwords are never communicated over Relay or personal email; they are read aloud during a verified call or shown during a verified video session only.

## Lockout Thresholds

NorthID locks an account for 30 minutes after 5 consecutive failed password attempts. After 10 consecutive failed attempts within a 24 hour period, the account requires manual helpdesk unlock even after the 30 minute window passes, as a protection against sustained credential stuffing attempts. Repeated lockouts across multiple days on the same account are flagged to Security Engineering for review.

## Related Guidance

Most VPN enrollment failures documented in the VPN Setup Guide trace back to an expired or locked NorthID password rather than a GlobalConnect problem itself, so confirm your NorthID login works at identity.northfield.internal before opening a separate VPN ticket.
