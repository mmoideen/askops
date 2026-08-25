---
id: security-incident-response
title: Security Incident Response
classification: restricted
owner: Security Engineering
updated: 2026-04-05
---

This document defines how Northfield Systems responds to confirmed or suspected security incidents, covering the detect, contain, eradicate, and recover phases, evidence handling requirements, communication rules, and legal hold procedures. It applies whenever unauthorized access, data exposure, or malicious activity is suspected, and takes precedence over the standard Incident Escalation Matrix once a security event is confirmed.

## Detect

Security events are identified through automated alerting, the Phishing Reporting Guide submission pipeline, or direct reports from employees. Any employee who suspects a security incident, such as unexpected account activity or an unfamiliar process running on their laptop, should open a ticket in the NSD-SEC queue marked urgent and simultaneously notify the Security Engineering on call through Beacon rather than waiting for a response.

## Contain

Containment actions are approved by the Security Engineering incident lead and may include revoking active sessions, disabling an account, isolating a host from the network, or rotating credentials associated with the affected system. Containment steps for production credentials follow the break-glass path described in the API Key Rotation SOP when standard rotation would be too slow.

## Eradicate and Recover

Eradication removes the root cause, such as a malicious script or a compromised credential, and recovery restores affected systems to normal operation. Recovery for database systems follows the restore procedures in the Backup Restore Runbook when data integrity is in question rather than simply trusting the live system. A system is not considered recovered until Security Engineering confirms no indicators of compromise remain for a minimum monitoring period of 72 hours.

## Evidence Handling

All evidence, including logs, forensic disk images, and memory captures, is logged in a chain of custody record noting who collected it, when, and where it is stored. Evidence is stored in the restricted forensic vault, access to which is limited to the Security Engineering incident response team and logged separately from standard production access logs. Evidence is never modified in place; investigators work from copies only.

## Communications and Legal Hold

No details about a suspected or confirmed security incident may be shared externally, including with vendors or affected customers, without joint approval from Legal and Communications. Internally, incident details are shared only in the dedicated incident channel, never in general Relay channels. A legal hold, once issued by General Counsel, suspends normal data retention and deletion schedules for all relevant systems and records until Legal formally releases the hold; this overrides the standard retention periods described elsewhere, including in the Team Chat Usage Guidelines.
