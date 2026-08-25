---
id: meeting-room-av-guide
title: Meeting Room AV Guide
classification: general
owner: IT Operations
updated: 2025-09-29
---

This guide covers how to book Northfield Systems meeting rooms, how to start a video bridge call from the room hardware, and how to fix the most common AV failures without opening a ticket. Most AV issues can be resolved in under 2 minutes using the steps below.

## Booking a Room

Rooms are booked through the standard calendar system by adding the room as a resource to a meeting invite. Rooms are named by floor and a sequential number, for example Room 4-12 on the 4th floor. Rooms with video bridge hardware are marked with a camera icon in the room picker; smaller huddle rooms below 4 seats do not include video hardware and are phone only. Recurring holds longer than 4 weeks without a matching calendar event are automatically released back to the pool.

## Starting a Video Bridge Call

Every AV-equipped room runs the Bridgeline system. To start a call, wake the room touch panel and select the scheduled meeting; Bridgeline auto-joins meetings that were booked with a bridge link. For ad hoc calls, select "New Meeting" on the panel, which generates a one time bridge code valid for 4 hours. Remote participants dial in using the room's extension, formatted as 5 digits beginning with 8, shown at the top of the touch panel.

## Common AV Failures and Fixes

| Symptom                     | Likely Cause                         | Fix                                                |
| --------------------------- | ------------------------------------ | -------------------------------------------------- |
| No signal from laptop       | HDMI handshake failure               | Unplug and reseat the HDMI cable, wait 10 seconds  |
| Room camera frozen          | Bridgeline puck needs restart        | Hold the puck's power button 10 seconds to restart |
| No audio from room speakers | Wrong output selected on touch panel | Reselect "Room Speakers" in the panel audio menu   |
| Panel unresponsive          | Panel needs reboot                   | Hold the panel power button 15 seconds             |

If a fix above does not resolve the issue within 2 attempts, open a ticket in the NSD-ITOPS queue with the room number and a description of the symptom; AV tickets are prioritized for same day response between 8:00 AM and 6:00 PM on business days.

## Reporting Persistent Problems

Rooms with the same AV failure reported 3 or more times in a rolling 30 day period are flagged for a hardware inspection rather than continued reactive fixes. If you notice a room is degraded, note the room number and symptom when filing the ticket so recurring issues can be tracked accurately instead of treated as one-off incidents each time.
