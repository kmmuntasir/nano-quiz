# DevOps Task Breakdown Documentation

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Development Environment](#phase-1-development-environment)
3. [Phase 2: Database Setup](#phase-2-database-setup)
4. [Phase 3: Continuous Integration](#phase-3-continuous-integration)
5. [Phase 4: Deployment](#phase-4-deployment)
6. [Phase 5: Monitoring](#phase-5-monitoring)
7. [Dependencies Matrix](#dependencies-matrix)

---

## Overview

This document outlines the complete DevOps task breakdown for deploying and operating the OpenQuiz application.

| Component | Service | Description |
|-----------|---------|-------------|
| Frontend | Netlify | React.js (Vite) static site |
| Backend | Render | Node.js/Express REST API |
| Database | Supabase | PostgreSQL database |
| Authentication | Google OAuth | Google OAuth 2.0 |

### Reference: PRD Sections

- **3.1** Tech Stack
- **3.2** CORS Policy
- **4** Plug-n-Play Configuration
- **8** Environment Variables

### Phase Summary

| Phase | # Tasks | Description |
|-------|--------|------------|
| 1 | 3 | Local dev environment setup |
| 2 | 2 | Database provisioning and schema |
| 3 | 2 | CI/CD pipelines |
| 4 | 4 | Deployment configuration |
| 5 | 2 | Monitoring and logging |

---

## Phase 1: Development Environment

### T1: Set Up Local Development Environment

**Description:**

Configure the local development environment for running both frontend and backend locally with hot reload.

**Dependencies:**

- None

**Acceptance Criteria:**

- [ ] Backend runs with `npm run dev` (port 3000)
- [ ] Frontend runs with `npm run dev` (port 5173)
- [ ] Frontend can communicate with Backend
- [ ] Environment variables documented in `.env.example`
- [ ] Root `.gitignore` exists and excludes `node_modules/`, `dist/`, `.env`, `.env.local`, and OS files (`.DS_Store`, `Thumbs.db`)

**Implementation:**

Run both services locally with hot reload:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Both projects use `tsx` (backend) and Vite (frontend) for hot reload out of the box.

---

### T2: Configure Git Hooks

**Description:**

Set up Git hooks for code quality checks before commits.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] Pre-commit hook runs linting
- [ ] Pre-commit hook runs type checking
- [ ] Commits fail if checks fail

**Tools:**

- `lint-staged` for running checks on staged files
- ESLint for JavaScript/TypeScript linting
- TypeScript compiler (`tsc --noEmit`) for type checking

---

### T3: Create Development Guide

**Description:**

Create a comprehensive development guide for contributors.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] README.md with setup instructions
- [ ] .env.example files for both frontend and backend
- [ ] Database schema file location documented

---

## Phase 2: Database Setup

### T4: Provision Supabase Project

**Description:**

Create and configure the Supabase PostgreSQL database.

**Dependencies:**

- None (PRD requirement)

**Acceptance Criteria:**

- [ ] Supabase project created
- [ ] Database URL obtained (`SUPABASE_DB_URL`)
- [ ] Connection tested from backend

**Implementation Notes:**

- Create project at https://supabase.com
- Retrieve connection string from Settings → Database
- Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

---

### T5: Run Database Schema

**Description:**

Apply the database schema to Supabase using the SQL file.

**Dependencies:**

- T4

**Acceptance Criteria:**

- [ ] Schema applied via SQL editor or migration
- [ ] All 3 tables created (users, questions, user_sessions)
- [ ] Indexes created
- [ ] Schema verified

**Methods:**

1. **Supabase SQL Editor:** Copy-paste `docs/data/schema.sql`
2. **Migration tool:** Use Supabase CLI
3. **Backend script:** Run schema via Node.js on first deploy

---

## Phase 3: Continuous Integration

### T6: Set Up GitHub Actions CI

**Description:**

Configure GitHub Actions for automated testing on pull requests.

**Dependencies:**

- T2

**Acceptance Criteria:**

- [ ] Workflow runs on push to `main` and PRs
- [ ] Installs dependencies
- [ ] Runs linting
- [ ] Runs type checking
- [ ] Runs tests (if any)

**Workflow File:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install backend dependencies
        run: |
          cd backend
          npm ci

      - name: Backend lint
        run: cd backend && npm run lint

      - name: Backend type check
        run: cd backend && npm run typecheck

      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci

      - name: Frontend lint
        run: cd frontend && npm run lint

      - name: Frontend type check
        run: cd frontend && npm run typecheck

      - name: Frontend build
        run: cd frontend && npm run build
```

---

### T7: Configure Pre-Deployment Validation

**Description:**

Add validation checks before deployment.

**Dependencies:**

- T6

**Acceptance Criteria:**

- [ ] Build must succeed before deployment
- [ ] Environment variables validated
- [ ] Database schema version checked

---

## Phase 4: Deployment

### T8: Configure Backend Deployment (Render)

**Description:**

Configure Render for backend deployment with automatic deploys from git.

**Dependencies:**

- T4, T5

**Acceptance Criteria:**

- [ ] Render service created (Web Service)
- [ ] Connected to GitHub repository
- [ ] Environment variables configured
- [ ] Auto-deploy enabled on push to main
- [ ] Health check endpoint returns 200

**Render Configuration:**

| Setting | Value |
|---------|-------|
| Environment | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free (testing) / Standard (production) |

**Note:** The backend uses TypeScript. The build command must compile TS to JS (`tsc` or `tsx` bundle) before `npm start` runs the compiled output. Ensure `package.json` has:
- `"build": "tsc"` (or equivalent bundler command)
- `"start": "node dist/index.js"` (pointing to compiled output, NOT `tsx`)

Using `tsx` in production is possible but not recommended — it adds startup overhead and hides type errors that the build step would catch.

**Environment Variables (Render):**

```
PORT=3000
FRONTEND_URL=https://your-app.netlify.app
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
RESTRICT_DOMAIN=exabyting.com
JWT_SECRET=super_secret_string
SUPABASE_DB_URL=postgresql://...
EVENT_DEADLINE_ISO=2024-12-31T23:59:59Z
```

---

### T9: Configure Frontend Deployment (Netlify)

**Description:**

Configure Netlify for frontend deployment with automatic deploys from git.

**Dependencies:**

- T8

**Acceptance Criteria:**

- [ ] Netlify site created
- [ ] Connected to GitHub repository
- [ ] Build settings configured
- [ ] Environment variables configured
- [ ] Auto-deploy enabled on push to main

**Netlify Configuration:**

| Setting | Value |
|---------|-------|
| Build Command | npm run build |
| Publish Directory | dist |
| Base Directory | frontend |

**netlify.toml:**

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Environment Variables (Netlify):**

```
VITE_API_BASE_URL=https://your-api.onrender.com/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

---

### T10: Verify CORS on Backend

**Description:**

Verify that Backend CORS is properly configured to accept only the Netlify frontend URL. **Note:** The actual CORS middleware implementation is handled in Backend T13 (Security phase). This task verifies the deployment configuration is correct.

**Dependencies:**

- T8, Backend T13

**Acceptance Criteria:**

- [ ] Backend CORS allows Frontend URL
- [ ] Other origins rejected
- [ ] Preflight requests handled

**Implementation:**

```typescript
// src/middleware/cors.ts
import cors from 'cors';

const frontendUrl = process.env.FRONTEND_URL;

app.use(cors({
  origin: frontendUrl,
  credentials: true,
}));
```

---

### T11: Set Up Data Seeding Pipeline

**Description:**

Configure the data seeding process for populating questions.

**Dependencies:**

- T5

**Acceptance Criteria:**

- [ ] Questions JSON files in `/data` directory
- [ ] `npm run seed` works locally
- [ ] Seeding script can be run on Render (via seed command or exec)

**Directory Structure:**

```
docs/
├── data/
│   └── schema.sql          # Canonical schema
├── tasks/
│   └── ...
└── PRD.md
backend/
├── data/
│   ├── faq_questions.json
│   └── trivia_questions.json
└── package.json
```

---

## Phase 5: Monitoring

### T12: Set Up Health Checks

**Description:**

Configure health check endpoints for monitoring.

**Dependencies:**

- T8

**Acceptance Criteria:**

- [ ] Backend health endpoint: `GET /health` returns 200
- [ ] Database connection check
- [ ] Render health check configured

**Implementation:**

```typescript
// src/routes/health.ts
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});
```

---

### T13: Configure Logging

**Description:**

Configure application logging for debugging and monitoring.

**Dependencies:**

- T8

**Acceptance Criteria:**

- [ ] Request logging enabled
- [ ] Error logging configured
- [ ] Logs accessible in Render dashboard

**Implementation:**

```typescript
// Morgan or pino logging
import morgan from 'morgan';
app.use(morgan('combined'));
```

---

## Dependencies Matrix

```
T1  ─────► T2 ─────► T3
        │            │
        │            ├────────► T6 ─────► T7
        │            │
        └────────────┼─────────────────────► T4 ─────► T5 ─────► T8 ─────► T10 ─────► T12 ─────► T13
                     │                                              │
                     │                                              ├────────► T9 ─────► T11
                     │                                              │
                     └──────────────────────────────────────────────┘
```

**Legend:**

- `A ─────► B` means A must complete before B can start

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Deployment Flow                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Developer pushes to main                                      │
│           ↓                                                         │
│  2. GitHub Actions CI runs (T6)                                   │
│           ↓                                                         │
│  3. If CI passes:                                                 │
│           ├── Backend auto-deploys to Render (T8)                   │
│           │         ↓                                              │
│           │    Health check passes (T12)                             │
│           │         ↓                                              │
│           │    Seeding runs (T11) ←───────────── Manual/triggered     │
│           │                                                       │
│           └── Frontend auto-deploys to Netlify (T9)                    │
│                    ↓                                              │
│               CORS configured (T10)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Summary

### Backend (.env)

| Variable | Required | Example |
|----------|----------|----------|
| PORT | Yes | 3000 |
| FRONTEND_URL | Yes | https://app.netlify.app |
| GOOGLE_CLIENT_ID | Yes | xxx.apps.googleusercontent.com |
| RESTRICT_DOMAIN | No | exabyting.com |
| JWT_SECRET | Yes | random_string |
| SUPABASE_DB_URL | Yes | postgresql://... |
| EVENT_DEADLINE_ISO | Yes | 2024-12-31T23:59:59Z |

### Frontend (.env)

| Variable | Required | Example |
|----------|----------|----------|
| VITE_API_BASE_URL | Yes | https://api.onrender.com/api |
| VITE_GOOGLE_CLIENT_ID | Yes | xxx.apps.googleusercontent.com |

---

## Service Comparison

| Feature | Render (Backend) | Netlify (Frontend) |
|---------|-----------------|-------------------|
| Free tier | Yes | Yes |
| Auto-deploy | Yes | Yes |
| Custom domain | Yes | Yes |
| SSL | Automatic | Automatic |
| CI/CD | Git-based | Git-based |
| Environment variables | Dashboard | Dashboard |
| Health checks | Yes | Yes |

---

## Troubleshooting Guide

| Issue | Solution |
|-------|---------|
| CORS error | Verify FRONTEND_URL matches exactly |
| Database connection failed | Check SUPABASE_DB_URL |
| 403 on quiz endpoints | Check EVENT_DEADLINE_ISO |
| OAuth not working | Verify GOOGLE_CLIENT_ID |
| Build failed | Check build commands |