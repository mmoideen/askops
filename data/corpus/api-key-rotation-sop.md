---
id: api-key-rotation-sop
title: API Key Rotation SOP
classification: restricted
owner: Security Engineering
updated: 2026-07-02
---

This SOP defines the rotation schedule for Northfield Systems API keys and service credentials, the dual-write window used to avoid downtime during rotation, how to verify old keys are fully revoked, and the break-glass procedure for emergency rotation. It applies to all service to service credentials, not customer facing API keys, which follow a separate customer controlled policy.

## Rotation Schedule

Standard API keys and service credentials are rotated every 90 days. High-privilege keys, meaning any credential with write access to production data or the ability to provision infrastructure, are rotated every 30 days. Rotation is tracked centrally so that a key approaching its deadline generates an automatic ticket in the NSD-SEC queue 7 days in advance, assigned to the credential's listed owner.

## Dual-Write Window

To avoid an outage during rotation, a new key is generated and deployed alongside the existing key for a dual-write window of 24 to 48 hours, during which both the old and new key remain valid. Services should be updated to use the new key during this window, staged gradually rather than all at once for high traffic services. The dual-write window should never be extended past 48 hours; a rotation that cannot complete within that window indicates a deployment problem that should be treated as its own issue rather than quietly extending the overlap.

## Revocation Verification

Before fully revoking the old key, confirm zero requests have used it for a continuous 1 hour period by checking the credential usage dashboard at access.northfield.internal. If traffic on the old key is still present after the dual-write window, do not revoke on schedule; instead identify the remaining caller first, since revoking a key still in active use causes an outage rather than improving security. Once confirmed idle for 1 hour, revoke the old key and log the rotation as complete in the NSD-SEC ticket.

## Break-Glass Procedure

If a key is suspected to be compromised, the standard 24 to 48 hour dual-write window is skipped entirely. The credential owner or any Security Engineering on call engineer can trigger break-glass rotation, which revokes the old key immediately and issues a new one within minutes, accepting the risk of a brief service disruption in exchange for closing the exposure immediately. Break-glass rotations must be reported to the Security Engineering on call within 1 hour if not performed by them directly, and are automatically treated as a security event under Security Incident Response.

## Related Access Controls

Standing access to systems that can read or generate these credentials follows the approval structure in Production Access Request. Anyone with standing admin access to the credential store is included in the 90 day audit review described there.
