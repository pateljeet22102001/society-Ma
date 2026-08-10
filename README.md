# Society Management Web Application

Modern, responsive society management system built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

Phase 1 includes:

- Login + route protection
- Responsive admin layout (sidebar / drawer)
- Dashboard summaries + charts
- Society / Wings / Flats setup
- Income (Aavak)
- Expenses (Javak)
- Basic Maintenance billing + payments
- Settings
- Reports foundation (PDF/Excel-ready later)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / App | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Charts | Recharts |
| Backend | Next.js Server Actions + Route-ready architecture |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage (`society-assets`) |
| Hosting | Vercel (app) + Supabase (DB/Auth) |

---

## Folder Structure

```text
society/
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/login
│   │   ├── (auth)/forgot-password
│   │   ├── (app)/dashboard
│   │   ├── (app)/society
│   │   ├── (app)/income
│   │   ├── (app)/expenses
│   │   ├── (app)/maintenance
│   │   ├── (app)/reports
│   │   └── (app)/settings
│   ├── components/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── finance/
│   │   ├── layout/
│   │   ├── maintenance/
│   │   ├── settings/
│   │   ├── society/
│   │   └── ui/
│   ├── lib/
│   │   ├── actions/
│   │   ├── queries/
│   │   ├── supabase/
│   │   └── validations/
│   ├── middleware.ts
│   └── types/
├── supabase/schema.sql
├── .env.example
└── README.md
```

---

## 1) Local Installation

### Prerequisites

- Node.js 20+
- npm
- A free Supabase project

### Install dependencies

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill values from Supabase → **Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_NAME=Society Management
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Never put the service role key in frontend env vars.

---

## 2) Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor**
3. Paste and run `supabase/schema.sql`
4. Confirm tables exist: `profiles`, `societies`, `wings`, `flats`, income/expense tables, maintenance tables
5. Go to **Authentication → Users → Add user**
   - Create your admin email/password
6. (Optional) Confirm Storage bucket `society-assets` was created by the SQL script

### Auth redirect URLs

In Supabase Auth settings, add:

- `http://localhost:3000/**`
- `https://your-vercel-domain.vercel.app/**`

---

## 3) Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Recommended first-run flow:

1. Login with the Supabase Auth user
2. Open **Settings** → create Society profile
3. Create wings (auto-generates flats)
4. Add income / expenses
5. Generate maintenance bills and record payments

---

## 4) Vercel Deployment

1. Push this repo to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add the same environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL
5. Deploy

Free-tier tips:

- Keep one society / admin user for Phase 1
- Avoid heavy background jobs
- Use Supabase free DB + Vercel hobby plan

---

## Key Routes

| Route | Purpose |
|---|---|
| `/login` | Authentication |
| `/dashboard` | Summary cards, charts, quick actions |
| `/society` | Society overview |
| `/society/wings` | Wing CRUD + auto flat generation |
| `/society/flats` | Flat CRUD + activate/deactivate |
| `/income` | Income module |
| `/expenses` | Expense module |
| `/maintenance` | Bills, payments, summary |
| `/reports` | Summary reports (export hooks later) |
| `/settings` | Society + maintenance defaults |

---

## Design Notes

- Light professional UI with blue primary accent
- Responsive from 320px mobile to 1920px desktop
- Mobile tables render as cards
- Sidebar becomes a slide-out drawer on small screens
- Touch-friendly buttons and full-width forms on mobile

---

## Phase 2 Ideas

- PDF / Excel export
- Multi-society / role-based access
- SMS / WhatsApp payment reminders
- Receipt printing
- Vendor master
- Complaint / visitor modules

---

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm run start    # run production server
npm run lint     # eslint
```

---

## License

Private project — update as needed.
