---
id: laptop-provisioning
title: Laptop Provisioning
classification: general
owner: IT Operations
updated: 2025-12-04
---

This guide describes the hardware tiers available to Northfield Systems employees, the imaging and enrollment process, expected shipping timelines, and the return process at offboarding. Hiring managers select a tier when submitting a new hire request; see New Hire Onboarding for the request deadline.

## Hardware Tiers

| Tier | Name                    | Typical Role                     | Specs                   |
| ---- | ----------------------- | -------------------------------- | ----------------------- |
| 1    | Standard                | Most business roles              | 16GB RAM, 512GB storage |
| 2    | Developer               | Software engineers               | 32GB RAM, 1TB storage   |
| 3    | Engineering Workstation | ML and data infrastructure roles | 64GB RAM, 2TB storage   |

Tier changes after initial issuance require director approval and are handled as an exception request through the NSD-ITOPS queue rather than a standard order.

## Imaging Process

Every laptop is imaged from the current golden image before shipment, which takes approximately 45 minutes per device. Imaging installs the base operating system, endpoint protection, and DeviceGuard MDM enrollment, and applies the security baseline required before the device can connect to GlobalConnect. Devices are never shipped unimaged, including loaner units.

## MDM Enrollment

DeviceGuard enrollment happens automatically as part of imaging and re-confirms itself the first time the device connects to the internet after unboxing. Enrollment enforces disk encryption, a minimum 8 character screen lock passcode, and automatic security patching. A device that fails to check in with DeviceGuard for 21 consecutive days has its access to internal systems automatically suspended until it reconnects and re-verifies compliance.

## Shipping Timelines

Domestic shipments ship within 2 business days of the order being placed and typically arrive within 5 to 7 business days. International shipments take 10 to 14 business days due to customs processing and are only available to approved international locations; confirm eligibility with People Ops before ordering if the employee's work location has recently changed. Expedited shipping is available for an additional cost and requires director approval.

## Return Process

Departing employees must return their laptop within 10 business days of their last day of employment. IT Operations provides a prepaid shipping label; devices should be shipped to Northfield Systems Asset Recovery, 100 Foundry Way, and not to any individual employee's attention. Devices not returned within 30 days are treated as unreturned company property and referred to People Ops and Finance Operations for further action, which may include a payroll deduction where permitted by local law.
