---
id: slack-usage-guidelines
title: Team Chat Usage Guidelines
classification: general
owner: People Ops
updated: 2025-10-21
---

This document covers how Northfield Systems uses its Relay team chat platform, including channel naming conventions, rules for sharing sensitive data, message retention, and how external guests are added and removed. These guidelines apply to every workspace channel, not only ones marked as official team channels.

## Channel Naming Conventions

Channels follow a prefix convention so the channel directory stays searchable as the company grows. Team channels use #team-name, such as #team-platform-eng. Project channels use #proj-name and should be archived within 30 days of the project's completion. Social and non work channels use #social-name, such as #social-hiking. Channels that do not follow this convention are subject to being renamed by IT Operations without notice, since unnamed channels make it difficult for new hires to find the right place to ask questions; see New Hire Onboarding for which channels are required in the first week.

## Data Sharing Rules

Customer personal data, including names, contact details, and account identifiers, must never be pasted into a public or team channel. Discussions that require referencing customer data should happen in a restricted channel with membership limited to people who need it for their role, and even then, prefer linking to the source system over pasting raw data directly into chat. Credentials, API keys, and anything that looks like a secret must never be posted in any channel, including restricted ones or direct messages; if a secret is accidentally posted, treat it as compromised and rotate it immediately following the API Key Rotation SOP rather than simply deleting the message.

## Retention

Messages across all channels, including direct messages, are retained for 2 years by default before automated deletion. This retention period is a company wide setting and cannot be changed at the individual channel level. A legal hold issued under Security Incident Response suspends deletion entirely for the affected accounts and channels until the hold is released, regardless of how much time has passed since a message was sent.

## External Guests

External collaborators, such as vendor contacts working on an active project, may be invited into specific channels by a Northfield employee acting as their sponsor. Guest access is scoped to the channels explicitly listed on the invite and expires automatically after 90 days unless the sponsor renews it. Sponsors are responsible for removing a guest immediately if the underlying business relationship ends before the 90 day expiration; failing to do so promptly is treated as a data handling issue and may be referred to Security Engineering.

## Getting Help

Questions about channel setup or guest access that are not answered here can be filed in the NSD-ITOPS queue. For questions about whether specific data is appropriate to share in chat, check with Security Engineering before posting rather than after.
