# Frontend Development Rules

## General

This project is a React 18+ with Vite and Tailwind CSS frontend. Follow React official docs and Vite docs as primary references.

### Project Structure

```
frontend/
    src/
        components/     # React components
        hooks/          # Custom React hooks
        pages/          # Page components
        api/            # API client functions
        types/          # TypeScript types
        constants/      # App constants
        utils/          # Utility functions
        contexts/       # React contexts
    index.html
    vite.config.ts
    tailwind.config.js
```

### Component Conventions

- One component per file
- Co-locate test files next to components
- Use explicit prop interfaces
- Use functional components with hooks

### State Management

- Use React Query (TanStack Query) for server state
- Use useState for local component state
- Use React Context for global UI state (theme, auth)

### API Client

Use fetch or axios with proper error handling:

```typescript
async function fetchQuizStatus(): Promise<QuizStatus> {
    const response = await fetch(`${API_BASE_URL}/quiz/status`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`)
    }

    return response.json()
}
```

### Environment Variables

Prefix with `VITE_` for client-side access:

```
VITE_API_BASE_URL=https://your-api.onrender.com/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### Deployment (Frontend)

- Deploy on **Netlify**
- Build command: `npm run build`
- Publish directory: `dist`
- Set environment variables in Netlify dashboard

---

# Backend Development Rules

## General

This project uses Node.js 20+ with Express.js. Follow Express docs as primary reference.

### Project Structure

```
backend/
    src/
        routes/         # API route handlers
        middleware/    # Express middleware
        services/       # Business logic
        models/        # Database models
        utils/         # Utility functions
        index.js      # Entry point
    package.json
```

### Route Conventions

- RESTful naming (`/api/quiz/status`, `/api/quiz/start`)
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return JSON responses

### Middleware

```javascript
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
        return res.status(401).json({ error: 'Missing token' })
    }
    next()
}
```

### Database

Use Supabase PostgreSQL client:

```javascript
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

async function getQuestions(category) {
    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('category', category)
        .limit(10)

    if (error) throw error
    return data
}
```

### Environment Configuration

All config via environment variables:

| Variable | Required | Default |
|---|---|---|
| `PORT` | No | `3000` |
| `FRONTEND_URL` | Yes | — |
| `GOOGLE_CLIENT_ID` | Yes | — |
| `JWT_SECRET` | Yes | — |
| `SUPABASE_DB_URL` | Yes | — |
| `EVENT_DEADLINE_ISO` | No | — |
| `TRACK_PER_QUESTION_TIME` | No | `true` |

### Deployment (Backend)

- Deploy on **Render**
- Build command: `npm install`
- Start command: `node src/index.js`
- Set environment variables in Render dashboard

### Security

- Validate all inputs
- Use parameterized queries (Supabase client handles this)
- No secrets in code — all via environment variables
- CORS configured for specific frontend URL only