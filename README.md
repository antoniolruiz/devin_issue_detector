# GitHub Issues Integration Dashboard

A full-stack dashboard that fetches GitHub issues from any public repository, enriches them with AI-generated metadata, and integrates with the [Devin API](https://docs.devin.ai) for autonomous issue scoping and execution.

![Dashboard Screenshot](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20TypeScript-blue)

## Features

### Issue Triage (Step 1)
- **Repository selector** -- input any `owner/repo`, defaults to `antoniolruiz/devin_demo`
- **AI enrichment** per issue: plain-language summary, complexity (Easy/Medium), impact, confidence score (0-100%), suggested next steps
- **Filters**: category, complexity, status, confidence range
- **Sorts**: confidence, complexity, impact, issue number
- **Expandable rows** with full issue details and GitHub link

### Issue Scoping (Step 2)
- Click "Scope with Devin" on an enriched issue to trigger a Devin API scoping session
- Review the generated action plan: affected files, step-by-step changes, confidence rationale, risks
- **Approve**, **Challenge**, **Modify**, or **Reject** the plan -- all inline, no page navigation

### Autonomous Execution (Step 3)
- Approved plans trigger a Devin execution session that implements the changes and opens a PR
- Dashboard shows execution status, inline diff summary, and any deviations from the plan
- **Accept**, **Request Changes**, or **Reject** the PR directly from the dashboard

## Architecture

```
devin_issue_detector/
├── backend/                  # FastAPI (Python 3.12+)
│   ├── app/
│   │   ├── main.py           # FastAPI app with CORS
│   │   ├── dependencies.py   # Service dependency injection + runtime config
│   │   ├── store.py          # In-memory issue cache
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic models for all data types
│   │   ├── routers/
│   │   │   ├── issues.py     # /api/issues/* -- fetch, enrich, enrich-all
│   │   │   ├── scoping.py    # /api/scoping/* -- start, status, feedback
│   │   │   ├── execution.py  # /api/execution/* -- start, status, PR actions
│   │   │   └── config.py     # /api/config/* -- update keys, check status
│   │   └── services/
│   │       ├── github_service.py  # GitHub API v3 client
│   │       ├── devin_service.py   # Devin API v3beta1 client
│   │       └── ai_service.py     # OpenAI GPT-4o-mini enrichment
│   ├── pyproject.toml
│   └── .env                  # API keys (not committed)
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx           # Main dashboard component
│   │   ├── components/
│   │   │   ├── RepoSelector.tsx   # Repository input + Load Issues button
│   │   │   ├── IssueRow.tsx       # Expandable issue row with enrichment data
│   │   │   ├── IssueFilters.tsx   # Search, category, complexity, status, confidence filters
│   │   │   ├── ConfigPanel.tsx    # API key configuration dropdown
│   │   │   ├── ScopingPanel.tsx   # Scoping session modal with plan review
│   │   │   └── ExecutionPanel.tsx # Execution session modal with PR actions
│   │   ├── services/
│   │   │   └── api.ts        # All backend API calls
│   │   └── types/
│   │       └── index.ts      # TypeScript type definitions
│   ├── .env                  # VITE_API_URL (defaults to http://localhost:8000)
│   └── package.json
└── README.md
```

## Prerequisites

- **Python 3.12+** with [Poetry](https://python-poetry.org/docs/#installation)
- **Node.js 18+** with npm
- **GitHub Token** -- required to avoid API rate limits on public repos; required for private repos
- **OpenAI API Key** -- required for AI enrichment (Step 1)
- **Devin API Token + Org ID** -- required for scoping (Step 2) and execution (Step 3)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/antoniolruiz/devin_issue_detector.git
cd devin_issue_detector
```

### 2. Set up the backend

```bash
cd backend
poetry install
```

Create a `.env` file (or edit the existing one) with your API keys:

```env
GITHUB_TOKEN=ghp_your_github_token
OPENAI_API_KEY=sk-your_openai_key
DEVIN_API_TOKEN=cog_your_devin_token
DEVIN_ORG_ID=org_your_devin_org_id
```

> **Minimum requirement:** Only `GITHUB_TOKEN` is needed to load and browse issues. The other keys enable progressively more features.

Start the backend:

```bash
poetry run fastapi dev app/main.py
```

The API will be running at `http://localhost:8000`. You can view the auto-generated API docs at `http://localhost:8000/docs`.

### 3. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be running at `http://localhost:5173`.

### 4. Use the dashboard

1. Open `http://localhost:5173` in your browser
2. The repository selector is pre-filled with `antoniolruiz/devin_demo` -- click **Load Issues**
3. Browse issues with filters and sorts
4. Click any issue row to expand and see full details
5. Click **Enrich with AI** on an issue to generate a summary, complexity rating, and more (requires OpenAI key)
6. Click **Scope with Devin** to generate an action plan (requires Devin API key)
7. **Approve** the plan to trigger autonomous execution and PR creation

## Runtime Configuration

API keys can also be configured at runtime without restarting the servers:

1. Click the **API Keys** button in the top-right corner of the dashboard
2. Enter your keys in the fields provided
3. Click **Save** -- services are rebuilt immediately

This is useful for trying different keys or configuring the app after startup.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/issues/fetch` | Fetch issues from a GitHub repo |
| `POST` | `/api/issues/enrich` | AI-enrich a single issue |
| `POST` | `/api/issues/enrich-all` | AI-enrich all cached issues for a repo |
| `GET`  | `/api/issues/{owner}/{repo}` | Get cached issues for a repo |
| `POST` | `/api/scoping/start` | Start a Devin scoping session |
| `GET`  | `/api/scoping/status/{session_id}` | Get scoping session status |
| `POST` | `/api/scoping/feedback` | Send feedback on a scoping plan |
| `POST` | `/api/execution/start` | Start a Devin execution session |
| `GET`  | `/api/execution/status/{session_id}` | Get execution session status |
| `POST` | `/api/execution/pr-action` | Accept/reject/request changes on a PR |
| `POST` | `/api/config/update` | Update API keys at runtime |
| `GET`  | `/api/config/status` | Check which services are configured |

## Key Design Decisions

- **In-memory storage**: All issue data and enrichment metadata is stored in memory. Data is lost on backend restart. This is intentional per the spec to prioritize a working end-to-end flow.
- **Dynamic repo targeting**: The target repository is never hardcoded. All GitHub API calls, Devin sessions, and PR operations use whichever repo is currently selected.
- **Cached enrichments**: AI-generated metadata is cached per issue. Re-enriching a previously enriched issue returns the cached result without calling OpenAI again.
- **Human-in-the-loop**: No code changes occur until the user explicitly approves a scoping plan. Every step requires user action.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Pydantic, httpx |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI Components | Radix UI, Lucide icons |
| AI | OpenAI GPT-4o-mini |
| APIs | GitHub REST API v3, Devin API v3beta1 |

## License

This project is provided as-is for demonstration purposes.
