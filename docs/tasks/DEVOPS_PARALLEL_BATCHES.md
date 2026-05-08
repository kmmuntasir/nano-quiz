# DevOps Parallel Execution Batches

Tasks grouped into batches that can run concurrently with no dependencies between tasks within a batch. Each batch depends only on prior batches completing.

Source file: [`docs/tasks/DEVOPS_TASKS.md`](tasks/DEVOPS_TASKS.md)

---

## DevOps Batches (13 tasks, 7 batches)

### D1: Environment + Database (3 parallel tasks)
| Task | Reference |
|------|-----------|
| T1: Set Up Local Development Environment | [`DEVOPS_TASKS.md:47`](tasks/DEVOPS_TASKS.md#L47) |
| T4: Provision Supabase Project | [`DEVOPS_TASKS.md:125`](tasks/DEVOPS_TASKS.md#L125) |

**Depends on:** None. T1 (local dev) and T4 (Supabase provisioning) are fully independent.

### D2: Git Hooks + Dev Guide + Schema (3 parallel tasks)
| Task | Reference |
|------|-----------|
| T2: Configure Git Hooks | [`DEVOPS_TASKS.md:82`](tasks/DEVOPS_TASKS.md#L82) |
| T3: Create Development Guide | [`DEVOPS_TASKS.md:105`](tasks/DEVOPS_TASKS.md#L105) |
| T5: Run Database Schema | [`DEVOPS_TASKS.md:149`](tasks/DEVOPS_TASKS.md#L149) |

**Depends on:** D1. T2+T3 need T1, T5 needs T4. All three independent of each other.

### D3: CI Pipeline
| Task | Reference |
|------|-----------|
| T6: Set Up GitHub Actions CI | [`DEVOPS_TASKS.md:175`](tasks/DEVOPS_TASKS.md#L175) |

**Depends on:** D2 (T2 — git hooks must exist for CI to validate against).

### D4: Pre-Deploy Validation + Seeding (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T7: Configure Pre-Deployment Validation | [`DEVOPS_TASKS.md:256`](tasks/DEVOPS_TASKS.md#L256) |
| T11: Set Up Data Seeding Pipeline | [`DEVOPS_TASKS.md:405`](tasks/DEVOPS_TASKS.md#L405) |

**Depends on:** D3. T7 needs T6, T11 needs T5 (satisfied in D2). Independent of each other.

### D5: Backend Deployment
| Task | Reference |
|------|-----------|
| T8: Configure Backend Deployment (Render) | [`DEVOPS_TASKS.md:276`](tasks/DEVOPS_TASKS.md#L276) |

**Depends on:** D2 (T5 — schema must be applied) + D4 (T7 — pre-deploy validation). T8 also needs T4+T5 per original deps, both satisfied by D1+D2.

### D6: Frontend Deploy + CORS + Monitoring (3 parallel tasks)
| Task | Reference |
|------|-----------|
| T9: Configure Frontend Deployment (Vercel) | [`DEVOPS_TASKS.md:324`](tasks/DEVOPS_TASKS.md#L324) |
| T10: Verify CORS on Backend | [`DEVOPS_TASKS.md:373`](tasks/DEVOPS_TASKS.md#L373) |
| T12: Set Up Health Checks | [`DEVOPS_TASKS.md:439`](tasks/DEVOPS_TASKS.md#L439) |
| T13: Configure Logging | [`DEVOPS_TASKS.md:471`](tasks/DEVOPS_TASKS.md#L471) |

**Depends on:** D5 (T8 — backend must be deployed). T9 needs T8, T10 needs T8 + Backend T12, T12+T13 need T8. All four independent of each other. Assign 4 devs for max throughput.

**Note:** T10 also requires Backend T12 (CORS middleware implementation). Ensure Backend B4 is complete before T10.

### DevOps Critical Path
```
T1 → T2 → T6 → T7 → T8 → T9
D1    D2    D3    D4    D5    D6
```
6 sequential steps. Total parallel time ≈ 6 task durations. Total serial time ≈ 13 task durations.

---

## Dependency Graph

```
D1: T1 ──┬──► T2 ──────► T6 ──► T7 ──┐
          │                            ├─► T8 ──┬──► T9
          └──► T3                      │        ├──► T10 (also needs Backend T12)
                                        │        ├──► T12
    T4 ──► T5 ──┬──► T11 ◄── D4       │        └──► T13
                 └─────────────────────┘
```

---

## Highest-Parallelism Batches (assign extra devs here)

| Batch | Parallel Tasks | Description |
|-------|---------------|-------------|
| **D2** | 3 tasks | Git hooks, dev guide, DB schema |
| **D6** | 4 tasks | Frontend deploy, CORS verify, health checks, logging |

---

## Cross-Team Dependencies

| DevOps Task | Depends On (Backend) | Depends On (Frontend) |
|-------------|---------------------|----------------------|
| T10: Verify CORS | Backend T12 (CORS middleware) | — |
| T7: Pre-Deploy Validation | — | — |
| T9: Frontend Deploy | — | Frontend T14 (deploy config) |

DevOps batch scheduling should align with:
- **D5** starts after Backend B3 (infrastructure layer) completes
- **D6** starts after Backend B4 (CORS middleware) + Frontend F4 (deploy config) complete
