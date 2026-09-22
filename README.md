# Church Seating Management Web Application (Usher Pro)

A real-time Church Seating Management system designed to assist church ushers and administrators during live church services. 

> **Note:** This is NOT a ticket booking or seat reservation platform for visitors. Visitors do not book seats in advance. 
> **Usher Workflow:** Visitor arrives → Usher enters number of people → System finds suitable available seats → Usher assigns seats → Seat becomes OCCUPIED.

---

## Features & Modules

1. **Authentication & Role-Based Access Control**:
   - Roles: `Admin`, `Usher`, `Viewer`
   - Instant live role switcher bar for testing & demonstration
2. **Admin Dashboard**:
   - Stat tiles for Total Capacity (~800 seats), Available, Occupied, Reserved, Held, Blocked, and Occupancy Percentage.
3. **Service Management**:
   - Create, edit, start, complete, and switch between scheduled services (e.g. Sunday Morning Service 9:00 AM).
4. **Dynamic Seating Configuration**:
   - Supports ~800 seats dynamically built across Church → Auditorium → Section → Row → Seat.
   - Configurable seat types (`standard`, `vip`, `accessible`, `companion`) and blocked states.
5. **Interactive Live Seating Map**:
   - 2D layout showing Stage, Sections, Rows, Individual Seats, and Status Colors.
   - Statuses: 🟢 `AVAILABLE`, 🔴 `OCCUPIED`, 🟣 `RESERVED`, 🟡 `HELD`, ⚪ `BLOCKED`.
6. **Smart Seat Finder Algorithm**:
   - Input group size (e.g. `4 people`).
   - Prioritizes: 1. Consecutive seats in same row, 2. Same section, 3. Stage proximity.
   - Returns Top 3 options with direct `[ASSIGN SEATS]` and `[HOLD]` actions.
7. **Concurrency & Race Condition Protection**:
   - Database-level row locking (`SELECT ... FOR UPDATE` via Supabase stored procedure `assign_service_seats`) guarantees no two ushers can assign the same seat concurrently.
8. **Temporary Holds & Auto Expiration**:
   - Holds seats temporarily (`AVAILABLE` → `HELD` → `OCCUPIED`).
   - Expired holds auto-release back to `AVAILABLE`.
9. **Admin Reservations & Blocking**:
   - Reserve seat ranges with custom notes (Pastoral Staff, Choir, VIPs).
   - Block damaged seats.
10. **Reports & Audit Activity Log**:
    - Capacity analytics breakdown by section.
    - Audit log recording all seat assignments, holds, releases, reservations, and service state changes with timestamps and user details.
11. **User & Usher Management**:
    - Add staff accounts, modify roles, enable/disable users, and assign ushers to service sections.

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Lucide Icons
- **Database & Backend**: Supabase (PostgreSQL, Supabase Auth, Supabase Realtime, Row Level Security)

---

## Local Development Setup

### 1. Prerequisites
- Node.js v18+ and npm / pnpm / yarn

### 2. Installation
```bash
git clone <repository-url>
cd church-seating-management
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

*(If environment variables are omitted, the application runs seamlessly in offline demo mode with mock data).*

### 4. Supabase Database Migration
To set up your PostgreSQL database in Supabase:
1. Go to your Supabase Project Dashboard → SQL Editor.
2. Copy and execute the migration script located in `supabase/migrations/20260901000000_schema.sql`.
3. This creates all tables (`profiles`, `churches`, `auditoriums`, `sections`, `rows`, `seats`, `services`, `service_seats`, `usher_assignments`, `activity_logs`), indexes, RLS policies, and the stored procedures (`assign_service_seats`, `hold_service_seats`, `release_expired_holds`).

### 5. Running Locally
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Deployment Guide (Vercel)

1. Push your code to GitHub / GitLab / Bitbucket.
2. Import the project into **Vercel** (or Netlify).
3. Set environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel settings.
4. Deploy! Next.js will automatically build and deploy the production application.
