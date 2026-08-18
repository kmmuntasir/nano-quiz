---
description: End-to-end ticket handler. From a ticket file, sync from origin/main, create the ticket branch, create an implementation plan, break it into tasks, orchestrate implementation with per-task commits, then verify and report. Use when the user wants one ticket handled start-to-finish.
agent: build
---

Load and execute the `handle-ticket` skill with the provided ticket file path.

Ticket file: $ARGUMENTS