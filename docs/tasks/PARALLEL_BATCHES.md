# Parallel Execution Batches

Tasks grouped into batches that can run concurrently with no dependencies between tasks within a batch. Each batch depends only on prior batches completing.

Source files:
- Backend: [`docs/tasks/BACKEND_TASKS.md`](tasks/BACKEND_TASKS.md)
- Frontend: [`docs/tasks/FRONTEND_TASKS.md`](tasks/FRONTEND_TASKS.md)

---

## Backend Batches (18 tasks, 8 batches)

### B1: Project Init
| Task | Reference |
|------|-----------|
| T1: Initialize Node.js Project with TypeScript | [`BACKEND_TASKS.md:45`](tasks/BACKEND_TASKS.md#L45) |

### B2: Environment Config
| Task | Reference |
|------|-----------|
| T2: Configure Environment Variables | [`BACKEND_TASKS.md:92`](tasks/BACKEND_TASKS.md#L92) |

**Depends on:** B1

### B3: Infrastructure Layer (5 parallel tasks)
| Task | Reference |
|------|-----------|
| T3: Set Up PostgreSQL Connection Pool | [`BACKEND_TASKS.md:125`](tasks/BACKEND_TASKS.md#L125) |
| T5: Implement Google OAuth Verification | [`BACKEND_TASKS.md:245`](tasks/BACKEND_TASKS.md#L245) |
| T12: Configure CORS Policy | [`BACKEND_TASKS.md:570`](tasks/BACKEND_TASKS.md#L570) |
| T14: Implement Deadline Check Middleware | [`BACKEND_TASKS.md:607`](tasks/BACKEND_TASKS.md#L607) |
| T15: Set Up Testing Infrastructure | [`BACKEND_TASKS.md:628`](tasks/BACKEND_TASKS.md#L628) |

**Depends on:** B2. All tasks independent — assign 5 devs for max throughput.

### B4: Core Endpoints + Middleware (5 parallel tasks)
| Task | Reference |
|------|-----------|
| T4: Create Seed Script for Loading JSON Questions | [`BACKEND_TASKS.md:170`](tasks/BACKEND_TASKS.md#L170) |
| T6: Implement Onboard Endpoint | [`BACKEND_TASKS.md:281`](tasks/BACKEND_TASKS.md#L281) |
| T7: Implement Quiz Status Endpoint | [`BACKEND_TASKS.md:303`](tasks/BACKEND_TASKS.md#L303) |
| T13: Implement JWT Validation Middleware | [`BACKEND_TASKS.md:588`](tasks/BACKEND_TASKS.md#L588) |
| T18: Security & Leaderboard Integration Tests | [`BACKEND_TASKS.md:721`](tasks/BACKEND_TASKS.md#L721) |

**Depends on:** B3. T4 needs T3, T6/T7/T13 need T5, T18 needs T14+T15. All cross-deps satisfied by B3.

### B5: Quiz Flow + Auth Tests (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T8: Implement Start Quiz Endpoint | [`BACKEND_TASKS.md:372`](tasks/BACKEND_TASKS.md#L372) |
| T16: Auth API Integration Tests | [`BACKEND_TASKS.md:661`](tasks/BACKEND_TASKS.md#L661) |

**Depends on:** B4. T8 needs T7, T16 needs T6+T15. Independent of each other.

### B6: Submit Answer
| Task | Reference |
|------|-----------|
| T9: Implement Get Question Endpoint | [`BACKEND_TASKS.md:424`](tasks/BACKEND_TASKS.md#L424) |

**Depends on:** B5 (T8).

### B7: Score + Complete
| Task | Reference |
|------|-----------|
| T10: Implement Submit Answer Endpoint | [`BACKEND_TASKS.md:480`](tasks/BACKEND_TASKS.md#L480) |

**Depends on:** B6 (T9).

### B8: Leaderboard + Quiz Tests (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T11: Implement Leaderboard Endpoint | [`BACKEND_TASKS.md:535`](tasks/BACKEND_TASKS.md#L535) |
| T17: Quiz API Integration Tests | [`BACKEND_TASKS.md:687`](tasks/BACKEND_TASKS.md#L687) |

**Depends on:** B7 (T10). T11 needs T10, T17 needs T10+T15. Independent of each other.

### Backend Critical Path
```
T1 → T2 → T5 → T7 → T8 → T9 → T10 → T11
B1    B2    B3    B4    B5    B6    B7     B8
```
8 sequential steps. Total parallel time ≈ 8 task durations. Total serial time ≈ 18 task durations.

---

## Frontend Batches (17 tasks, 10 batches)

### F1: Project Init
| Task | Reference |
|------|-----------|
| T1: Initialize React Project with Vite and TypeScript | [`FRONTEND_TASKS.md:51`](tasks/FRONTEND_TASKS.md#L51) |

### F2: Routing
| Task | Reference |
|------|-----------|
| T2: Configure Routing | [`FRONTEND_TASKS.md:95`](tasks/FRONTEND_TASKS.md#L95) |

**Depends on:** F1

### F3: API Client + Test Infra (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T3: Set Up API Client | [`FRONTEND_TASKS.md:126`](tasks/FRONTEND_TASKS.md#L126) |
| T15: Set Up Testing Infrastructure | [`FRONTEND_TASKS.md:507`](tasks/FRONTEND_TASKS.md#L507) |

**Depends on:** F2. Both depend on T2 only, no cross-deps.

### F4: Pages + Error Handling + Deploy (4 parallel tasks)
| Task | Reference |
|------|-----------|
| T4: Implement Login Page with Google OAuth | [`FRONTEND_TASKS.md:190`](tasks/FRONTEND_TASKS.md#L190) |
| T6: Implement Quiz Container | [`FRONTEND_TASKS.md:252`](tasks/FRONTEND_TASKS.md#L252) |
| T13: Error Handling and Edge Cases | [`FRONTEND_TASKS.md:456`](tasks/FRONTEND_TASKS.md#L456) |
| T14: Deployment Configuration | [`FRONTEND_TASKS.md:477`](tasks/FRONTEND_TASKS.md#L477) |

**Depends on:** F3. All depend on T3, no cross-deps. Assign 4 devs for max throughput.

### F5: Onboarding + Start Button (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T5: Implement Onboarding Page | [`FRONTEND_TASKS.md:219`](tasks/FRONTEND_TASKS.md#L219) |
| T7: Implement Start Quiz Button | [`FRONTEND_TASKS.md:294`](tasks/FRONTEND_TASKS.md#L294) |

**Depends on:** F4. T5 needs T4, T7 needs T6. Independent.

### F6: Question Display
| Task | Reference |
|------|-----------|
| T8: Implement Question Display Component | [`FRONTEND_TASKS.md:313`](tasks/FRONTEND_TASKS.md#L313) |

**Depends on:** F5 (T7).

### F7: Answer Submit + Component Tests (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T9: Implement Answer Submission | [`FRONTEND_TASKS.md:350`](tasks/FRONTEND_TASKS.md#L350) |
| T16: Component Unit Tests | [`FRONTEND_TASKS.md:543`](tasks/FRONTEND_TASKS.md#L543) |

**Depends on:** F6. T9 needs T8, T16 needs T8+T15. Independent.

### F8: Completion Screen
| Task | Reference |
|------|-----------|
| T10: Implement Quiz Completion Screen | [`FRONTEND_TASKS.md:374`](tasks/FRONTEND_TASKS.md#L374) |

**Depends on:** F7 (T9).

### F9: Leaderboard + Integration Tests (2 parallel tasks)
| Task | Reference |
|------|-----------|
| T11: Implement Leaderboard Page | [`FRONTEND_TASKS.md:399`](tasks/FRONTEND_TASKS.md#L399) |
| T17: Integration Flow Tests | [`FRONTEND_TASKS.md:564`](tasks/FRONTEND_TASKS.md#L564) |

**Depends on:** F8 (T10). T11 needs T10, T17 needs T10+T15. Independent.

### F10: Auto-Refresh
| Task | Reference |
|------|-----------|
| T12: Implement Auto-Refresh | [`FRONTEND_TASKS.md:436`](tasks/FRONTEND_TASKS.md#L436) |

**Depends on:** F9 (T11).

### Frontend Critical Path
```
T1 → T2 → T3 → T6 → T7 → T8 → T9 → T10 → T11 → T12
F1    F2    F3    F4    F5    F6    F7    F8     F9     F10
```
10 sequential steps. Total parallel time ≈ 10 task durations. Total serial time ≈ 17 task durations.

---

## Highest-Parallelism Batches (assign extra devs here)

| Batch | Parallel Tasks | File |
|-------|---------------|------|
| **B3** | 5 tasks | Backend — DB pool, OAuth, CORS, deadline, test infra |
| **F4** | 4 tasks | Frontend — Login, quiz container, error handling, deploy |
| **B4** | 5 tasks | Backend — Seed, onboard, quiz status, JWT, security tests |
| **F5** | 2 tasks | Frontend — Onboarding, start button |
