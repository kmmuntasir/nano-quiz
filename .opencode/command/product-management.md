---
description: Turn a list of product issues into complete, end-to-end deliverables documents. Re-run with no args to continue after answering a question batch.
agent: build
---

Load and execute the `product-management` skill. If the user provided an issue list, pass it along as a fresh cycle (start mode); if not, continue the active cycle.

User input: $ARGUMENTS