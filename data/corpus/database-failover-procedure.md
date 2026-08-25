---
id: database-failover-procedure
title: Database Failover Procedure
classification: restricted
owner: Platform Engineering
updated: 2026-03-25
---

This procedure covers how to perform a manual failover of the primary Northfield Systems database cluster to a standby replica, including the health checks to run first, replication lag verification, and the rollback steps if the failover does not succeed. This is a high risk operation and should only be performed by an engineer with standing or JIT operator access, following sign off from the Incident Commander when performed during an active incident.

## When to Fail Over

Failover is appropriate when the primary database instance is unresponsive, when hardware failure is confirmed, or when a SEV1 incident traced to the primary instance cannot be resolved in place within the RTO target defined in the Backup Restore Runbook. Failover is not a substitute for a restore; if the issue is data corruption rather than instance unavailability, follow the Backup Restore Runbook instead, since failing over to a replica that has already applied the corrupting writes does not fix anything.

## Pre-Failover Health Checks

1. Confirm the standby replica's status shows "streaming" and not "catching up" in the replication dashboard.
2. Verify replication lag is under the 10 second threshold; failing over with higher lag risks losing recent committed transactions.
3. Confirm the replica has passed its most recent automated health check, which runs every 30 seconds against all cluster members.
4. Notify the incident channel before proceeding if this failover is happening during a declared incident.

## Manual Failover Steps

1. Place the primary into maintenance mode to stop accepting new writes, if the primary is still reachable.
2. Promote the standby replica to primary using the cluster management console at db-admin.northfield.internal.
3. Update the connection string in the configuration service to point application traffic at the newly promoted instance.
4. Monitor application error rates for 10 minutes; a spike above 2 percent error rate indicates the cutover did not fully propagate.
5. Confirm the old primary is either rejoined as a new replica or fully decommissioned, never left running independently, to avoid a split brain scenario.

## Rollback

If the newly promoted primary shows data integrity problems within the first 10 minutes, revert application traffic to the original primary within 15 minutes of detecting the problem, provided it is still healthy and was not the source of the original failure. A failover that requires rollback must be treated as a SEV1 under the Incident Escalation Matrix regardless of customer impact, since a failed failover indicates a gap in the underlying health checks that needs urgent review.

## Post-Failover Review

Every failover, successful or not, is reviewed within 2 business days to confirm replication lag stayed within target and to update the runbook if any step did not match reality during the actual event.
