# SimpleSign

A lightweight, self-hosted document signing platform. Upload a PDF, add signers, share unique links — no signer account required. Signatures are drawn or typed in the browser, placed on the document, and merged into a final PDF using pdf-lib.

---

## Screenshots

| Sign in | Dashboard |
|---|---|
| ![Sign in](docs/screenshots/01-login.png) | ![Dashboard](docs/screenshots/02-dashbaord.png) |

**Signing page — draw or type your signature, then click to place it on the document**

![Signing page](docs/screenshots/03-sign.png)

---

## Features

### For document owners
- **Register / log in** with email and password (Supabase Auth)
- **Upload PDFs** up to 50 MB via drag-and-drop or file picker
- **Add multiple signers** — name, email, and optional signing order
- **Ordered signing** — enforce a sequence so signer 2 cannot sign until signer 1 completes
- **Share signing links** — each signer gets a unique UUID token URL; no signer account needed
- **Dashboard** — lists all documents with live status badges (Draft → Sent → In Progress → Completed)
- **Document detail page** — per-signer status, signed/opened timestamps, copy link button
- **Download completed PDF** — signed URL to the final merged document
- **Delete documents** — removes database records and both storage files

### For signers
- **No login required** — signers open their unique link directly
- **Draw or type signature** — freehand canvas drawing or styled italic text
- **Place anywhere** — click any page to stamp the signature; drag to reposition before submitting
- **Multi-page support** — scroll through all pages and place signatures on any page
- **Ordered signing guard** — signer sees a "waiting for prior signer" screen if they arrive out of order
- **Already-signed guard** — duplicate submissions are rejected with a clear message

### Completion
- When all signers have submitted, the backend automatically embeds all signatures into the original PDF using pdf-lib and stores the final document in Supabase Storage
- Signature coordinates are stored as page fractions (0.0–1.0), making placement resolution-independent across any screen size

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14 (App Router, TypeScript) |
| Backend framework | Express 4 (TypeScript) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage |
| PDF rendering (browser) | react-pdf v10 + pdfjs-dist v5 |
| PDF generation (server) | pdf-lib v1.17 |
| Signature canvas | react-signature-canvas |
| Styling | Tailwind CSS v3 |
| Containers | Docker multi-stage builds + Docker Compose |
| Monorepo | npm workspaces |

---

## Project Structure

```
simplesign/
├── apps/
│   ├── api/                        # Express + TypeScript backend (port 4000)
│   │   └── src/
│   │       ├── config/env.ts       # Zod-validated environment variables
│   │       ├── lib/supabase.ts     # Anon client (JWT validation) + admin client (DB/storage)
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT → supabase.auth.getUser()
│   │       │   └── errorHandler.ts
│   │       ├── routes/             # Express routers
│   │       ├── controllers/        # Request/response handlers
│   │       ├── services/
│   │       │   ├── document.service.ts
│   │       │   ├── signing.service.ts  # Session validation, ordered signing, completion detection
│   │       │   └── pdf.service.ts      # pdf-lib merge + Storage upload
│   │       └── types/index.ts
│   │
│   └── web/                        # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── (auth)/         # Login + register pages
│           │   ├── dashboard/      # Document list, upload wizard, document detail
│           │   └── sign/[token]/   # Public signing page (no auth)
│           ├── lib/
│           │   ├── api.ts          # Typed fetch wrapper → backend
│           │   ├── auth.ts         # getAccessToken() helper
│           │   └── supabase.ts     # Browser Supabase client (auth only)
│           └── hooks/useAuth.ts
│
├── supabase/schema.sql             # Full database schema — run once in Supabase SQL Editor
├── docker-compose.yml
└── package.json                    # Root npm workspaces + dev scripts
```

---

## API Reference

All authenticated routes require `Authorization: Bearer <supabase-jwt>`.

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Liveness probe — returns `{ status: "ok" }` |

### Documents
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/documents` | JWT | List documents owned by the caller |
| POST | `/api/documents` | JWT | Upload a PDF (`multipart/form-data`, field: `file`) |
| GET | `/api/documents/:id` | JWT | Get document details + signers |
| DELETE | `/api/documents/:id` | JWT | Delete document, signers, and storage files |
| POST | `/api/documents/:id/signers` | JWT | Add signers `{ signers: [{ name, email, sign_order }] }` |
| POST | `/api/documents/:id/send` | JWT | Set status → `sent`, activates signing links |
| GET | `/api/documents/:id/download` | JWT | Returns a 1-hour signed URL for the completed PDF |

### Signing (public — no JWT)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/sign/:token` | None | Validate token; returns session, signer info, and a signed PDF URL |
| POST | `/api/sign/:token` | None | Submit signature placements `{ placements: [...] }` |

**Placement object:**
```json
{
  "page_number": 1,
  "x": 0.1,
  "y": 0.75,
  "width": 0.25,
  "height": 0.06,
  "signature_data_url": "data:image/png;base64,..."
}
```
All coordinates are fractions of the page dimensions (0.0–1.0).

---

## Database Schema

### Tables

**`documents`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `owner_id` | UUID | References `auth.users` |
| `title` | TEXT | Filename shown in dashboard |
| `status` | enum | `draft` → `sent` → `in_progress` → `completed` |
| `storage_path` | TEXT | Path in `documents` storage bucket |
| `final_path` | TEXT | Path in `completed-documents` bucket (set on completion) |
| `page_count` | INTEGER | Page count of the original PDF |

**`signers`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `document_id` | UUID | References `documents` |
| `name` / `email` | TEXT | Signer identity |
| `sign_order` | INTEGER | 1 = unordered; higher values enforce sequence |
| `status` | enum | `pending` → `opened` → `signed` |
| `token` | UUID | Unique signing link token |
| `signed_at` / `opened_at` | TIMESTAMPTZ | Audit timestamps |

**`signature_placements`**
| Column | Type | Notes |
|---|---|---|
| `signer_id` / `document_id` | UUID | Foreign keys |
| `page_number` | INTEGER | 1-indexed page |
| `x`, `y`, `width`, `height` | NUMERIC | Fractional page coordinates |
| `signature_data_url` | TEXT | Base64 PNG data URI |

### Storage Buckets
| Bucket | Path pattern | Access |
|---|---|---|
| `documents` | `{owner_id}/{doc_id}/original.pdf` | Private — backend generates signed URLs |
| `completed-documents` | `{owner_id}/{doc_id}/final.pdf` | Private — backend generates signed URLs |

---

## Local Development

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Run the database schema

In your Supabase dashboard → **SQL Editor**, paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql).

### 2. Configure environment variables

**`apps/api/.env`**
```env
PORT=4000
NODE_ENV=development
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FRONTEND_URL=http://localhost:3000
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run both services

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

---

## Docker

### Prerequisites
- Docker Desktop (or Docker Engine + Compose)
- A `.env` file at the repo root with the two `NEXT_PUBLIC_*` variables (used as Docker build args):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Build and start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

The API container waits for the health check to pass before the web container starts.

### Architecture notes
- Both containers are built from the **monorepo root** as the Docker context so they share the root `package.json` and `package-lock.json`
- The web image uses Next.js **standalone output** with `outputFileTracingRoot` pointing to the monorepo root, which ensures `next` itself is bundled into the standalone directory
- The PDF.js worker (`pdf.worker.min.mjs`) is copied from `node_modules` into `apps/web/public/` during the Docker build and served as a static file

---

## Security Notes

- The **`SUPABASE_SERVICE_ROLE_KEY`** is only ever present in the API container's environment — it is never sent to the browser
- RLS is enabled on all tables; the backend bypasses it using the service role key and enforces ownership in the service layer
- JWT validation on authenticated routes uses `supabase.auth.getUser(token)` — tokens are verified server-side, not just decoded
- Signing links are single-use UUIDs — already-signed tokens are rejected with HTTP 409
