---
id: vpn-setup-guide
title: VPN Setup Guide
classification: general
owner: IT Operations
updated: 2025-11-03
---

This guide explains how to install and configure the GlobalConnect VPN client for connecting to the Northfield Systems internal network, including split tunnel behavior, multi factor enrollment, and fixes for the most common connection failures. Every employee and contractor with access to internal systems is required to use GlobalConnect rather than any personal remote access tool.

## Installing GlobalConnect

1. Download the GlobalConnect installer from software.northfield.internal using your NorthID credentials.
2. Run the installer and accept the default install path. Administrator rights on the laptop are not required for standard installs.
3. Launch GlobalConnect and enter your Northfield email address (yourname@northfield.example) when prompted for the connection profile.
4. Select the gateway closest to your primary work location: vpn1.northfield.internal for the east region or vpn2.northfield.internal for the west region.
5. Complete first time MFA enrollment as described below before attempting to connect.

GlobalConnect negotiates over TLS on port 443 by default. On networks that block 443 for non browser traffic, common on hotel and airport Wi-Fi, the client automatically falls back to port 8443 after two failed handshake attempts. If both ports are blocked, connect using the LTE hotspot fallback documented in the Service Desk knowledge base.

## Split Tunnel Rules

GlobalConnect uses split tunneling, not full tunneling. Only traffic destined for Northfield internal ranges is routed through the encrypted tunnel: the 10.0.0.0/8 address space and any hostname ending in .internal. General web browsing, video calls, and personal traffic route directly over your local internet connection and never touch Northfield infrastructure. This keeps latency low for non work traffic but means you must stay connected to GlobalConnect for the full session when working with internal tools, since a dropped tunnel silently stops routing internal requests rather than reconnecting automatically.

## MFA Enrollment

Northfield requires MFA on every VPN session through the NorthAuth mobile app. To enroll, visit identity.northfield.internal, sign in with your NorthID password, and scan the QR code with NorthAuth installed on your personal or company phone. Each connection attempt sends a push notification that expires after 60 seconds. If you do not have a smartphone, request a hardware token from the Service Desk queue NSD-ITOPS; hardware tokens ship within 3 business days.

## Troubleshooting

| Error Code | Meaning | Fix |
|---|---|---|
| VPN-1045 | Authentication timeout | Retry; confirm system clock is accurate |
| VPN-1090 | Split tunnel policy fetch failed | Restart GlobalConnect, reconnect |
| VPN-2210 | MFA push expired | Approve the push within 60 seconds |
| VPN-3005 | Gateway unreachable | Try the alternate gateway or port 8443 |

After 3 consecutive failed handshake attempts, GlobalConnect enforces a 15 minute account level lockout to protect against credential stuffing. This is expected behavior, not a bug; wait out the lockout rather than repeatedly retrying.

## Getting Help

Open a ticket in the NSD-ITOPS queue for connection issues that persist after following this guide, and include the error code shown in the client. New hires should complete VPN setup during their first week; see New Hire Onboarding for the full first week checklist. If you cannot sign in to identity.northfield.internal at all, start with the Password Reset SOP before troubleshooting VPN specifically, since most enrollment failures trace back to an expired NorthID password.
