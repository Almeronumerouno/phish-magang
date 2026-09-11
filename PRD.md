# Product Requirements Document (PRD)
## Red Team Simulation Platform (Enterprise Security Awareness)

* **Project Name**: Red Team Simulation Website
* **Document Version**: 2.0.0
* **Date**: September 2026
* **Author / Architect**: JARVIS (Senior Quantitative Fullstack Engineer) for Almer
* **Status**: Phase 2 Complete — Full-Stack with Database Integration
* **Repository**: `C:\CodeKuliah\redteam-simulation`

---

## 1. Executive Summary

### 1.1 Product Vision
The **Red Team Simulation Platform** is an enterprise-grade social engineering and phishing awareness simulation suite designed to measure, train, and strengthen organizational resistance against cyberattacks. By providing controlled phishing simulations, landing page clones, customizable email vectors, and granular telemetry tracking, the platform enables security teams to identify human-factor security vulnerabilities before adversaries exploit them.

### 1.2 Core Objectives
1. **Accurate Risk Telemetry**: Track real-time open rates, click-through rates, credential submissions, and employee reporting rates.
2. **Safe & Controlled Simulations**: Provide high-fidelity cloned websites and landing page templates without exposing employees or systems to actual threats.
3. **Actionable Remediation**: Segment targets by department or risk score, triggering targeted educational interventions for repeated offenders.
4. **Intuitive Operator Experience**: Give security administrators an elegant, distraction-free control console to configure campaigns, SMTP relays, and audience segments.

---

## 2. User Personas & Permissions

| Role | Persona | Responsibilities & Core Tasks |
| :--- | :--- | :--- |
| **Security Administrator** | *John Doe (IT Security Manager)* | Overall platform admin, SMTP profile configuration, campaign creation, and executive reporting. |
| **Red Team Operator** | *Simulation Specialist* | Designing phishing lures, cloning authentic login portals, crafting HTML landing pages, and scheduling dispatch sequences. |
| **Target Recipient** | *Corporate Employee* | Receives simulated emails, interacts with simulated portals, reports suspicious emails or is redirected to awareness training. |
| **Compliance Officer / CISO** | *Executive Stakeholder* | Audits quarterly security posture, department vulnerability metrics, and regulatory compliance (ISO 27001, SOC 2). |

---

## 3. Information Architecture & Sitemap

```
Red Team Simulation Console
├── /login                  [Authentication: Operator Sign In (username + password)]
├── /register               [Provisioning: Operator Registration (username + password)]
├── /dashboard              [Security Awareness Overview: KPI Cards, Timeline Chart, Recent Activity]
├── /campaigns              [Campaigns & Simulations: Active Campaigns, Department Breakdown, Telemetry Ratios, Results Table]
├── /templates              [Landing Pages: Landing Page Management, Site Cloner Engine]
├── /target-groups          [Targets: Audience Directory, Bulk CSV Import, Quick Add, Member Preview]
└── /sending-profiles       [Sending Profiles: SMTP Relays, TLS/SSL Security, Diagnostic Testing]
```

---

## 4. Comprehensive Design System & Color Palette

The design system adheres to a refined, high-contrast, modern enterprise aesthetic extracted directly from the Figma design tokens:

### 4.1 Color Palette Swatches

#### A. Core Neutral & Background Tokens
| Token Name | Hex Code | RGB | Role / Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `#FCF8FA` | `rgb(252, 248, 250)` | Main canvas surface and application background |
| `--header-bg` | `#FCF8FA` | `rgb(252, 248, 250)` | Top App Bar surface |
| `--card-bg` | `#FFFFFF` | `rgb(255, 255, 255)` | Surface color for metric cards, data tables, and modals |
| `--input-bg` | `#F6F3F5` | `rgb(246, 243, 245)` | Background for search bars, text boxes, and dropdowns |
| `--sidebar-bg` | `#111111` | `rgb(17, 17, 17)` | Deep obsidian sidebar navigation surface |
| `--border-color` | `#C6C6CD` | `rgb(198, 198, 205)` | Outlines, table dividers, input borders, and separators |

#### B. Typography Colors
| Token Name | Hex Code | RGB | Role / Usage |
| :--- | :--- | :--- | :--- |
| `--foreground` | `#1B1B1D` | `rgb(27, 27, 29)` | Primary heading text, high-emphasis labels |
| `--body-text` | `#45464D` | `rgb(69, 70, 77)` | Secondary descriptions, subheadings, table cells |
| `--muted-text` | `#6B7280` | `rgb(107, 114, 128)` | Input placeholders, column headers, meta timestamps |
| `--empty-text` | `#999999` | `rgb(153, 153, 153)` | Centered empty state messages ("Halaman masih kosong") |
| `--sidebar-text` | `#A1A1AA` | `rgb(161, 161, 170)` | Inactive sidebar navigation links |
| `--sidebar-active`| `#FFFFFF` | `rgb(255, 255, 255)` | Active navigation link text |

#### C. Primary & Interactive Tokens
| Token Name | Hex Code | RGB | Role / Usage |
| :--- | :--- | :--- | :--- |
| `--btn-primary` | `#000000` | `rgb(0, 0, 0)` | Primary call-to-action buttons (`+ New Page`, `Clone`) |
| `--btn-primary-text`| `#FFFFFF` | `rgb(255, 255, 255)` | Text inside primary buttons |
| `--btn-hover` | `#1F2937` | `rgb(31, 41, 55)` | Hover state for primary buttons |

#### D. Semantic & Status Tokens
| State | Badge BG | Text / Border | Icon / Indicator | Role / Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Danger / High Risk** | `#FEF2F2` | `#B91C1C` | `#EF4444` | Notification dot, click rates, inactive relays, phishing victims |
| **Success / Safe** | `#DCFCE7` | `#15803D` | `#22C55E` | Completed campaigns, active relays, reported emails |
| **Warning / In Progress** | `#FEF9C3` | `#A16207` | `#EAB308` | Campaigns currently executing, moderate risk segments |
| **Informational** | `#EFF6FF` | `#1D4ED8` | `#3B82F6` | Email links, department filter chips, documentation |

---

### 4.2 Typography System

The platform standardizes on **Inter** (sans-serif) across all viewports:

| Level | Size | Weight | Line Height | Letter Spacing | Element / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display / Page Title** | `36px` | 700 (Bold) | `44px` | `-0.72px` | Primary view titles (e.g., `Landing Page`, `Campaign Reports`) |
| **Section Heading** | `18px` | 600 (SemiBold) | `24px` | `-0.2px` | Card headers, table group titles |
| **Body Standard** | `14px` | 400 (Regular) | `20px` | `0px` | Subtitles, descriptions, standard data table contents |
| **Body Bold** | `14px` | 600 (SemiBold) | `20px` | `0px` | Table row titles, button labels |
| **Small / Caption** | `12px` | 500 (Medium) | `16px` | `+0.12px` | Buttons (`New Page`), badges, sidebar items |
| **Micro / Metric Label** | `11px` | 700 (Bold) | `14px` | `+0.5px` | Stat card uppercase labels, user avatar badge |

---

### 4.3 Layout & Elevation Rules
* **Grid Baseline**: 8pt grid system with 4pt micro-spacing.
* **Header Height**: Fixed `64px` height with border-bottom `1px solid #C6C6CD`.
* **Sidebar Width**: Fixed `220px` width, full viewport height (`h-screen`).
* **Content Padding**: `px-6` (24px) horizontal, `pt-6` (24px) top, `pb-8` (32px) bottom. Max container width: `1440px`.
* **Border Radii**:
  * Buttons & Inputs: `6px` (`rounded-md`).
  * Cards & Containers: `8px` (`rounded-lg`).
  * Status Badges & Avatars: `9999px` (`rounded-full`).
* **Drop Shadow**: `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08)` for primary CTA buttons.

---

## 5. Functional Module Specifications

### Module 1: Dashboard (`/dashboard`)
* **Purpose**: Immediate situational awareness for ongoing and historical phishing campaigns.
* **Key Components**:
  1. **Telemetry KPI Cards**:
     * *Active Campaigns* (Count)
     * *Total Emails Sent* (Formatted Integer)
     * *Emails Opened* (Count & Open Rate %)
     * *Click Rate* (Percentage with trend indicator, e.g., `14.2% ↗ 2.1%`)
  2. **Trend Chart**: "Emails Sent Over Time" with 6-Month (`6M`) and 1-Year (`1Y`) time filters, featuring area gradient fill.
  3. **Recent Activity Table**: Real-time log of campaigns showing Date, Status (`Completed` vs `In Progress`), Sent, Opened, and Clicked metrics.

### Module 2: Campaigns (`/campaigns`)
* **Purpose**: Orchestrate, configure, launch, and analyze red team phishing simulations and organizational security posture.
* **Key Components**:
  1. **Telemetry KPI Cards**:
     * *Total Campaigns Run* (142, trend indicator vs last month)
     * *Overall Open Rate* (48.2%)
     * *Overall Click Rate* (22.7%)
     * *Cred Submission Rate* (8.3%)
  2. **Analytics & Posture Charts**:
     * *Campaign Success by Department* (Eng, HR, Sales, Finance, Exec)
     * *Reporting Rate vs Click Rate* (Smooth dual Bézier splines with quarterly scatter indicators)
  3. **Detailed Campaign Results Table**: Complete campaign audit log with search filtering, recipients, opens, clicks, risk levels (`High`, `Medium`, `Low`), pagination, and pause/resume/delete actions.
  4. **Simulation Launch Modal**: Modal wizard to launch or schedule targeted simulations with template, audience group, and SMTP relay selection.

### Module 3: Landing Page & Template Library (`/templates`)
* **Purpose**: Management of phishing landing pages (credential harvesters, awareness training redirects).
* **Key Components**:
  1. **Page Header & Actions**: Direct `+ New Page` modal trigger.
  2. **Default Empty State**: Shows `"Halaman masih kosong"` when no custom page exists.
  3. **Template Library Drawer/Grid**:
     * Built-in lure templates: *Credential Login (Microsoft 365, Google Workspace)*, *Security Alert (IT Notice)*, *Document Shared (SharePoint, OneDrive)*, *Generic Webmail*.
     * Card actions: `Use Template` or `Preview`.

### Module 4: Target Groups (`/target-groups`)
* **Purpose**: Audience directory and segmentation.
* **Key Components**:
  1. **Audience Segmentation**: Organization by department (C-Suite, IT & DevOps, Finance & Accounting, HR, General Staff).
  2. **Bulk CSV Import**: Drag-and-drop file ingestion accepting standard fields: `First Name`, `Last Name`, `Email`, `Department`, `Position`.
  3. **Quick Add Target**: Single-line form to append ad-hoc test accounts without uploading full files.
  4. **Risk Status Indicators**: Color-coded risk matrices per group (Green = resilient, Red = high vulnerability).

### Module 5: Sending Profiles (`/sending-profiles`)
* **Purpose**: SMTP infrastructure management for dispatching simulation emails.
* **Key Components**:
  1. **Relay Configuration Form**:
     * Profile Name (e.g., `Corporate Mailgun`, `AWS SES East`).
     * SMTP Host & Port (e.g., `smtp.company.com:587`).
     * From Address & Custom Display Name (`"IT Helpdesk" <helpdesk@simulation-domain.com>`).
     * Security Protocols: Standard SMTP, TLS, SSL.
  2. **Diagnostic Test Email Utility**: Allows the admin to fire an instantaneous test message to a specified inbox to verify DKIM/SPF delivery and mail headers.
  3. **Profiles Repository Table**: Status badges showing relay health (`Active`, `Failed`, `Not Tested`).

### Module 6: Clone Website (`/clone-website`)
* **Purpose**: Rapidly duplicate public or internal login portals for authorization testing.
* **Key Components**:
  1. **URL Harvester Input**: Input field for target domain (e.g., `https://login.company.com`).
  2. **Engine Action**: Scrapes HTML, inlines CSS assets, strips malicious JavaScript, and converts form targets to the internal listener endpoint.
  3. **Safety Guarantee**: Injects safety headers and disclaimer banners stating: `"THIS IS A SECURITY SIMULATION - NO CREDENTIALS ARE STORED"`.

---

## 6. Implemented Data Architecture

The platform uses **Prisma ORM** with **SQLite** for development. The schema is defined in `prisma/schema.prisma`:

```prisma
model User {
  id                     Int              @id @default(autoincrement())
  username               String           @unique
  hash                   String
  apiKey                 String?          @unique
  roleId                 Int              @default(1)
  passwordChangeRequired Boolean          @default(false)
  lastLogin              DateTime?
  accountLocked          Boolean          @default(false)
  groups                 Group[]
  templates              Template[]
  pages                  LandingPage[]
  profiles               SendingProfile[]
  campaigns              Campaign[]
  results                Result[]
}

model Group {
  id           Int           @id @default(autoincrement())
  userId       Int?
  name         String
  modifiedDate DateTime      @default(now())
  user         User?         @relation(fields: [userId], references: [id])
  targets      GroupTarget[]
  campaigns    Campaign[]
}

model Target {
  id         Int           @id @default(autoincrement())
  firstName  String?
  lastName   String?
  email      String
  position   String?
  department String?
  groups     GroupTarget[]
}

model GroupTarget {
  groupId  Int
  targetId Int
  group    Group  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  target   Target @relation(fields: [targetId], references: [id], onDelete: Cascade)
  @@id([groupId, targetId])
}

model Template {
  id             Int       @id @default(autoincrement())
  userId         Int?
  name           String
  subject        String?
  text           String?
  html           String?
  modifiedDate   DateTime  @default(now())
  envelopeSender String?
  user           User?     @relation(fields: [userId], references: [id])
  campaigns      Campaign[]
}

model LandingPage {
  id                 Int        @id @default(autoincrement())
  userId             Int?
  name               String
  html               String?
  modifiedDate       DateTime   @default(now())
  captureCredentials Boolean    @default(false)
  capturePasswords   Boolean    @default(false)
  redirectUrl        String?
  user               User?      @relation(fields: [userId], references: [id])
  campaigns          Campaign[]
  @@map("pages")
}

model SendingProfile {
  id               Int        @id @default(autoincrement())
  userId           Int?
  interfaceType    String?    @default("SMTP")
  name             String
  host             String?
  username         String?
  password         String?
  fromAddress      String?
  modifiedDate     DateTime   @default(now())
  ignoreCertErrors Boolean    @default(false)
  user             User?      @relation(fields: [userId], references: [id])
  campaigns        Campaign[]
  @@map("smtp")
}

model Campaign {
  id            Int             @id @default(autoincrement())
  userId        Int?
  name          String
  createdDate   DateTime        @default(now())
  completedDate DateTime?
  templateId    Int?
  pageId        Int?
  status        String          @default("In_Progress")
  url           String?
  smtpId        Int?
  launchDate    DateTime?
  sendByDate    DateTime?
  groupId       Int?
  user          User?           @relation(fields: [userId], references: [id])
  template      Template?       @relation(fields: [templateId], references: [id])
  page          LandingPage?    @relation(fields: [pageId], references: [id])
  profile       SendingProfile? @relation(fields: [smtpId], references: [id])
  group         Group?          @relation(fields: [groupId], references: [id])
  results       Result[]
  events        SimEvent[]
}

model Result {
  id           Int       @id @default(autoincrement())
  campaignId   Int
  userId       Int?
  rId          String    @unique
  email        String?
  firstName    String?
  lastName     String?
  status       String    @default("Scheduled")
  ip           String?
  latitude     Float?
  longitude    Float?
  position     String?
  sendDate     DateTime?
  reported     Boolean   @default(false)
  modifiedDate DateTime  @default(now())
  campaign     Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  user         User?     @relation(fields: [userId], references: [id])
}

model SimEvent {
  id         Int      @id @default(autoincrement())
  campaignId Int
  email      String?
  time       DateTime @default(now())
  message    String?
  details    String?
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  @@map("events")
}
```

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user (username + password) |
| `POST` | `/api/auth/login` | Login, returns session cookie |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `GET` | `/api/dashboard` | Aggregated stats + recent campaigns |
| `GET/POST` | `/api/campaigns` | List all campaigns / Create campaign |
| `PATCH/DELETE` | `/api/campaigns/[id]` | Update status / Delete campaign |
| `GET/POST` | `/api/pages` | List landing pages / Create landing page |
| `GET/POST` | `/api/groups` | List target groups / Create group |
| `GET` | `/api/groups/[id]/targets` | List targets in a group |
| `GET/POST` | `/api/sending-profiles` | List SMTP profiles / Create profile |

---

## 7. Security, Privacy & Safety Principles

1. **Zero Raw Credential Capture**: When an employee enters passwords on a cloned landing page, the payload MUST NEVER be stored in plain text or persistent storage. The server records only a boolean flag (`submitted_credentials: true`) and immediately redirects the user to an educational landing page.
2. **Safe-listing & Headers**: Simulated emails must contain custom headers (e.g., `X-Simulation-Notice: RedTeamPlatform`) allowing security gateways to differentiate simulations from actual attacks.
3. **No Punitive Culture**: Telemetry is designed for educational remediation and coaching, not workplace disciplinary penalties.

---

## 8. Implementation Roadmap

* [x] **Phase 1: High-Fidelity UI Baseline (Completed)**
  * Next.js 16 + TypeScript + Tailwind CSS App Router setup.
  * Sidebar layout, TopAppBar, PageHeader, EmptyState, DataTable components.
  * All pages built matching Figma specs (`/dashboard`, `/campaigns`, `/templates`, `/target-groups`, `/sending-profiles`, `/clone-website`).
  * Compiled with 0 errors.
* [x] **Phase 2 & 3: Full-Stack Integration (Completed)**
  * SQLite database with Prisma ORM (`@prisma/client`).
  * Complete REST API layer for all entities (`/api/dashboard`, `/api/campaigns`, `/api/pages`, `/api/groups`, `/api/sending-profiles`).
  * Real-time UI hydration from database using `useEffect` + `fetch`.
  * Proper empty states implementations when no data exists.
  * Basic session authentication (cookie-based HMAC).
* [ ] **Phase 4: Active Simulation Engine**
  * Local state storage (Zustand / React Context) for adding target groups, switching templates, and launching mock campaigns.
  * Interactive modal dialogs for CSV uploads and New Page creation.
  * Real SMTP dispatch queue (BullMQ + Redis).
  * Webhook listener for open pixels (`/api/track/open.png`) and click redirects (`/api/track/click`).
* [ ] **Phase 5: Enterprise Integrations**
  * Microsoft Entra ID / Google Workspace SCIM sync for automated employee onboarding.
  * Automated awareness micro-trainings triggered upon phishing link clicks.
