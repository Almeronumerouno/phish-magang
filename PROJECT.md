# Project: Email Templates (GoPhish v0.12.1 Reverse-Engineered for phish-magang)

## Architecture
phish-magang is a Next.js 16.3.4 (App Router) + React 19 + Tailwind CSS v4 web application with Prisma ORM 6.19.3 and SQLite (`dev.db`).
The Email Templates feature integrates with the existing phish-magang architecture:
- **Data Layer**: SQLite database accessed via Prisma ORM. `model Template` in `prisma/schema.prisma` represents Email Templates (referenced by `Campaign.templateId`), with child relational `model Attachment` for uploaded email attachments.
- **Backend API Layer**: Next.js App Router route handlers under `src/app/api/email-templates/` and `src/app/api/import/email/`.
- **Parsing & Transformation Engine**: Pure TypeScript MIME parser in `src/lib/mime-parser.ts` handling RFC 2822/2047 headers, multipart/alternative/mixed boundary traversal, quoted-printable/base64 decoding, DOM/regex link rewriting (`<a href="...">` -> `<a href="{{.URL}}">`), and tracking image insertion/stripping (`{{.Tracker}}</body>`).
- **Frontend Presentation Layer**: App Router page at `src/app/email-templates/page.tsx`, adhering to the PRD dark obsidian palette (`#111111`), crisp zinc borders (`border-zinc-800`), GoPhish teal accents (`#1ABB9C`), red danger triggers (`#d9534f`), tabbed plaintext/HTML/preview editors, quick insertion tags, dynamic attachment file manager, and modal dialogs.
- **Navigation Layer**: `src/components/layout/Sidebar.tsx` and `AppShell.tsx` cleanly distinguishing Email Templates (`/email-templates`, `Mail`) from Landing Pages (`/templates`, `Globe`).
- **Testing & Quality Assurance Layer**: Playwright E2E and visual regression test suite + TypeScript compile-time verification (`tsc --noEmit`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Prisma Schema Attachment Model | Add `Attachment` model and `attachments Attachment[]` to `Template` in `prisma/schema.prisma` | M1 | Survey |
| F02 | DB Schema Push / Migration | Execute `npx prisma db push` to create `attachments` table without data loss | M1 | Survey |
| F03 | List Email Templates API | `GET /api/email-templates` returns array of templates with metadata and attachment count | M1 | Survey |
| F04 | Create Email Template API | `POST /api/email-templates` validates unique name, creates template and nested attachments | M1 | Survey |
| F05 | Get Email Template Detail API | `GET /api/email-templates/[id]` returns single template including full attachment payloads | M1 | Survey |
| F06 | Update Email Template API | `PUT /api/email-templates/[id]` updates fields and updates/replaces attachments | M1 | Survey |
| F07 | Delete Email Template API | `DELETE /api/email-templates/[id]` removes template and cascades attachment deletion | M1 | Survey |
| F08 | Pure TS MIME Parser | `src/lib/mime-parser.ts` parsing RFC 2822/2047, multipart text/plain and text/html | M1 | Survey |
| F09 | Import Email API Endpoint | `POST /api/import/email` (and alias `/api/email-templates/import`) extracting Subject, Text, HTML | M1 | Survey |
| F10 | Link Conversion Logic | Rewrites all `<a href="...">` to `<a href="{{.URL}}">` when `convert_links: true` | M1 | Survey |
| F11 | Tracking Image Management | Inject `{{.Tracker}}</body>` on save when checked; strip `{{.Tracker}}</body>` when unchecked | M1 | Survey |
| F12 | Navigation Alignment | Update `Sidebar.tsx` with Email Templates (`/email-templates`) and Landing Pages (`/templates`) | M2 | Survey |
| F13 | AppShell Auth Protection | Add `/email-templates` to `PROTECTED_PREFIXES` in `AppShell.tsx` | M2 | Survey |
| F14 | Landing Pages Title Alignment | Update `src/app/templates/page.tsx` title to `Landing Pages` | M2 | Survey |
| F15 | Email Templates Page Layout | `src/app/email-templates/page.tsx` with header, stats/counts, and search filter | M2 | Survey |
| F16 | Email Templates Main Table | Responsive table displaying Name, Modified Date, and Action buttons | M2 | Survey |
| F17 | New / Edit Template Modal | Modal with Name, Envelope Sender, Subject, Tabbed Editor, Tracking Checkbox | M2 | Survey |
| F18 | Tabbed Editor & Live Preview | Text (plaintext) vs HTML (code) tabs + Live Preview sandbox iframe | M2 | Survey |
| F19 | Quick Insertion Tags Toolbar | Clickable chips inserting `{{.URL}}`, `{{.Tracker}}`, `{{.FirstName}}`, etc. at cursor | M2 | Survey |
| F20 | Attachment Manager in UI | HTML5 file picker, base64 encoding, mime-type icon resolution, and remove button | M2 | Survey |
| F21 | Import Email Sub-modal | Overlay modal with raw MIME textarea, link conversion checkbox, and import action | M2 | Survey |
| F22 | Copy Template Feature | Duplicate existing template with `"Copy of "` prefix and clone attachments | M2 | Survey |
| F23 | Custom Delete Dialog | Confirmation dialog before deleting an email template | M2 | Survey |
| F24 | E2E Testing Suite (Tiers 1-4) | Comprehensive requirement-driven opaque-box test runner & tests | M-TEST | Survey |
| F25 | Visual Testing & TypeScript Check | Playwright visual snapshots (Table, Modal, Import Sub-modal) + `tsc --noEmit` clean | M3 | Survey |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Testing Track | Requirement-driven test harness, runner, and test suite (Tiers 1-4), publish `TEST_INFRA.md` & `TEST_READY.md` | none | DONE |
| M1 | Backend Email Templates Engine | Prisma schema update, db push, CRUD API (`/api/email-templates`), pure TS MIME parser (`src/lib/mime-parser.ts`), Import API (`/api/import/email`), and tracking image logic | none | DONE |
| M2 | Frontend Email Templates Page & Navigation | `Sidebar.tsx`, `AppShell.tsx`, `templates/page.tsx` rename, and complete `/email-templates/page.tsx` UI | M1 | DONE |
| M3 | Final Milestone: E2E Verification & Hardening | Phase 1: 100% E2E tests pass + Playwright visual snapshots + `tsc --noEmit`. Phase 2: Adversarial coverage hardening (Tier 5). | M-TEST, M2 | DONE |

---

## Interface Contracts

### 1. Database Model (`prisma/schema.prisma`)
```prisma
model Template {
  id             Int          @id @default(autoincrement())
  userId         Int?
  name           String
  subject        String?
  text           String?
  html           String?
  modifiedDate   DateTime     @default(now())
  envelopeSender String?      @map("envelope_sender")
  user           User?        @relation(fields: [userId], references: [id])
  campaigns      Campaign[]
  attachments    Attachment[]

  @@map("templates")
}

model Attachment {
  id         Int      @id @default(autoincrement())
  templateId Int      @map("template_id")
  name       String
  content    String   // Base64 payload without data URI scheme
  type       String   // MIME type
  template   Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@map("attachments")
}
```

### 2. Backend REST API Endpoints
- `GET /api/email-templates`: Returns `Template[]` with `attachments: { id, name, type }[]` (excluding heavy base64).
- `POST /api/email-templates`: Body `{ name, subject?, envelope_sender?, text?, html?, attachments? }`.
- `GET /api/email-templates/[id]`: Returns single `Template` with full attachments (including `content` base64).
- `PUT /api/email-templates/[id]`: Updates template, upserts/replaces attachments, updates `modifiedDate`.
- `DELETE /api/email-templates/[id]`: Deletes template (attachments cascaded).
- `POST /api/import/email`: Body `{ content: string, convert_links: boolean }`. Returns `{ subject: string, text: string, html: string }`.

### 3. Navigation & Route Alignment
- `/email-templates`: Email Templates (Icon: `Mail`, Label: "Email Templates").
- `/templates`: Landing Pages (Icon: `Globe`, Label: "Landing Pages", Page Title: "Landing Pages").

---

## Code Layout
- `prisma/schema.prisma`: Prisma schema definition.
- `src/lib/mime-parser.ts`: MIME parsing, RFC 2822 header unfolding, RFC 2047 decoding, body extraction, link conversion.
- `src/app/api/email-templates/route.ts`: List & Create API handlers.
- `src/app/api/email-templates/[id]/route.ts`: Detail, Update & Delete API handlers.
- `src/app/api/import/email/route.ts`: Raw email import handler.
- `src/components/layout/Sidebar.tsx`: Navigation menu links and icons.
- `src/components/layout/AppShell.tsx`: Authentication routing prefixes.
- `src/app/templates/page.tsx`: Existing landing pages (title rename).
- `src/app/email-templates/page.tsx`: Comprehensive Email Templates UI page.
- `tests/e2e/email-templates.spec.ts`: Playwright visual & E2E tests.
