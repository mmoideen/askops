---
id: backup-restore-runbook
title: Backup Restore Runbook
classification: restricted
owner: Platform Engineering
updated: 2026-02-27
---

This runbook documents Northfield Systems backup schedules, retention periods, the step by step restore procedure with recovery time and recovery point targets, and the quarterly restore test process. It applies to the primary production database cluster and its associated object storage.

## Backup Schedule

Full backups run nightly at 1:00 AM in the primary region, us-northfield-1. Incremental backups run every 4 hours throughout the day, capturing changes since the last full or incremental backup. Backups are replicated to the secondary region, us-northfield-2, within 30 minutes of completion to protect against a full regional failure.

## Retention

| Data Type | Retention Period |
|---|---|
| Standard production data | 35 days |
| Financial systems data | 1 year |
| Pre-deletion snapshots | 7 days |

Retention timers reset on the schedule above unless a legal hold is in effect, in which case the rules in Security Incident Response take priority over these defaults.

## Restore Procedure

1. Confirm the restore request through the NSD-PLAT queue and identify the target restore point.
2. Provision a restore target instance in an isolated network segment, never directly onto the production cluster.
3. Restore the selected full backup, then replay incrementals up to the requested point in time.
4. Run the data integrity checksum script and compare row counts against the pre-incident baseline.
5. Cut over traffic only after Platform Engineering lead sign off.

Recovery Time Objective (RTO) for the primary database cluster is 4 hours from the start of a declared restore. Recovery Point Objective (RPO) is 1 hour, meaning no more than 1 hour of committed data should be lost in a worst case restore using the most recent incremental backup.

## Quarterly Restore Test

On the first Thursday of each quarter, Platform Engineering performs a full restore test into an isolated environment to validate that backups are actually restorable, not just that the backup job reported success. Results, including the actual time taken to reach a queryable state, are logged and compared against the 4 hour RTO target. Any test that misses the RTO target by more than 30 minutes triggers a review of the backup and restore tooling before the next quarter.

## When to Use This Runbook

Use this runbook for planned restores and for data recovery after an application level bug causes bad writes. For a full primary database outage requiring a live cutover to a replica, follow the Database Failover Procedure instead, which is optimized for speed rather than point in time recovery; the two procedures are related but not interchangeable.
