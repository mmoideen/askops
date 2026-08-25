---
id: vendor-security-review
title: Vendor Security Review
classification: restricted
owner: Security Engineering
updated: 2026-01-08
---

This document describes how Security Engineering evaluates third party vendors before Northfield Systems shares data with them or integrates their software, covering the intake questionnaire, how vendors are mapped to data classification levels, risk tiering, and how often each tier is re-reviewed. No vendor may receive Northfield data or system access until this review is complete, regardless of contract urgency.

## Starting a Review

Any employee sourcing a new vendor that will touch Northfield data or connect to internal systems must file an intake request in the NSD-SEC queue before signing a contract or providing any data for a trial. Finance Operations will not process a vendor payment without a completed review reference number attached to the purchase request.

## Intake Questionnaire

The intake questionnaire covers 45 questions across data handling practices, encryption at rest and in transit, subprocessor disclosure, incident notification commitments, and prior security certifications. Vendors are expected to complete the questionnaire within 10 business days; Security Engineering does not proceed with a risk assessment on a partially completed questionnaire. Questionnaire responses are stored alongside the vendor record and reviewed again at each re-review cycle rather than assumed to still be accurate.

## Data Classification Mapping

| Classification | Description | Example |
|---|---|---|
| Public | No restriction on sharing | Marketing material |
| Internal | Northfield internal use only | Internal process docs |
| Confidential | Sensitive business data | Financial forecasts |
| Restricted | Regulated or high sensitivity data | Customer personal data |

Every vendor engagement is mapped to the highest classification of data it will touch, and the review depth scales accordingly; a vendor touching Restricted data undergoes additional scrutiny on encryption and subprocessor chains beyond the standard questionnaire.

## Risk Tiers and Re-Review Cadence

| Tier | Criteria | Re-Review Cadence |
|---|---|---|
| Tier 1 | Touches Restricted data or core infrastructure | Annual |
| Tier 2 | Touches Confidential data | Every 18 months |
| Tier 3 | Touches only Internal or Public data | Every 24 months |

A vendor's tier can change if their access scope changes; any request to expand a vendor's access beyond what was originally reviewed requires a new intake request rather than an informal approval, even if the vendor relationship is already active and trusted.

## Ongoing Monitoring

Security Engineering maintains a vendor registry cross referenced against active production access grants, similar in spirit to the audit review described in Production Access Request. A vendor that misses a scheduled re-review by more than 30 days has its access suspended until the review is completed, regardless of how critical the integration is to day to day operations.
