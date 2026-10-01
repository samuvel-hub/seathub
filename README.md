# SeatHub — Modern Seating, Event & Live Attendance Management Platform

SeatHub is a full-stack **MERN** (**MongoDB**, **Express.js**, **React.js**, and **Node.js**) application engineered for managing events, designing custom multi-section seating layouts, processing self-service guest reservations, and monitoring live attendee check-ins in real time.

Built for colleges, universities, corporate conferences, auditoriums, cultural festivals, seminars, and religious/community venues.

---

## 📑 Table of Contents

- [Overview & Workflow](#-overview--workflow)
- [System Architecture & Tech Stack](#-system-architecture--tech-stack)
- [Core Features & Modules](#-core-features--modules)
  - [1. Event & Organization Management](#1-event--organization-management)
  - [2. Two-Stage Admin Bookings & Attendance Tracking](#2-two-stage-admin-bookings--attendance-tracking)
  - [3. Dynamic 2D Seating Layout Engine](#3-dynamic-2d-seating-layout-engine)
  - [4. Guest Booking Portal & QR Passes](#4-guest-booking-portal--qr-passes)
  - [5. Smart Consecutive Seat Finder (Usher Pro)](#5-smart-consecutive-seat-finder-usher-pro)
  - [6. Role-Based Access Control (RBAC) & Audit Logs](#6-role-based-access-control-rbac--audit-logs)
- [Data Models & Schema Design](#-data-models--schema-design)
- [REST API Reference](#-rest-api-reference)
- [Validation & Business Rules](#-validation--business-rules)
- [Local Setup & Installation](#-local-setup--installation)
- [Project Directory Structure](#-project-directory-structure)

---

## 🎯 Overview & Workflow

SeatHub handles the entire lifecycle of venue seating and event attendance:

```
[Admin Creates Event]
        │
        ▼
[Configure Seating Layout] ──▶ (Center, Left Wing, Right Wing, Balcony)
        │
        ▼
[Set Event Active] ──────────▶ (Activates Live Booking & Attendance)
        │
 ┌──────┴─────────────────────────────────┐
 │                                        │
 ▼                                        ▼
[Guest Portal / QR Link]        [Admin / Usher Operations]
 - Pick exact seat               - Two-stage bookings/attendance monitor
 - Form validation (Name/Phone)  - Smart consecutive seat finder
 - Instant red OCCUPIED lock     - At-Venue attendance tracking
 - Digital QR pass download      - Manual seat assignment & release
```

---

## 🛠️ System Architecture & Tech Stack

- **Frontend**:
  - **React 18** with **Vite**: Rapid, modular single-page architecture.
  - **Tailwind CSS**: Modern UI with consistent color tokens, badges, and responsive grids.
  - **React Router 6**: Client-side routing with role-guarded routes.
  - **Context API (`AuthContext`, `SeatingContext`)**: Centralized auth and seating state with auto-polling.
- **Backend**:
  - **Node.js** & **Express.js**: RESTful service layer with JWT authentication middleware.
  - **MongoDB** & **Mongoose**: Document database utilizing atomic update operations (`findOneAndUpdate`) to guarantee zero race conditions during concurrent bookings.
  - **Time & State Engine**: Native time validator supporting 12h AM/PM and 24h formats with automatic event state transitions.

---

## 🌟 Core Features & Modules

### 1. Event & Organization Management
- **Multi-Tenant Scoping**: All events, seating maps, and bookings are isolated per organization (`organizationId`). Users from one organization cannot view or modify another organization's events.
- **Category Templates & Custom Stages**: Select from predefined categories (*College / Academic*, *Fest / Cultural*, *Seminar / Conference*, *Workshop*, *Meeting*, *Church / Religious*, *Community*, *Other*) with intelligent stage label suggestions (e.g., `AUDITORIUM STAGE`, `PRESENTER PODIUM`, `MAIN STAGE`).
- **Flexible Timing**: Configure Start Date, End Date, Start Time, and End Time with validation ensuring End Time occurs strictly after Start Time.
- **Direct Event Activation**:
  - **`Set Active`** (Emerald green): Instantly activates the event into the live `STARTED` state, regardless of whether the scheduled time is past or future.
  - **`Deactivate`** (Amber): Deactivates the event and resets it back to inactive.
  - An organization-level mutex ensures only **one** event is active per organization at any time.

---

### 2. Two-Stage Admin Bookings & Attendance Tracking

Clicking the **`👥 Bookings`** button on an event opens an intelligent modal that dynamically switches its display based on whether the event is upcoming or live:

#### Stage A: Pre-Event Mode (Before Event Starts / Upcoming)
Tailored for organizers managing pre-registrations:
- **Summary Cards**:
  - `TOTAL SEATS`: Total seating capacity.
  - `AVAILABLE`: Total unbooked seats.
  - `OCCUPIED`: Total reserved/booked seats.
- **Booked Guests Table**:
  - Columns: `Guest Name` | `Guest ID` | `Phone Number` | `Booked Seat` (e.g. `CENTER-A1`) | `Booking Status` (`● Available` / `● Occupied`) | `Booking Time` | `Action`.
  - **Quick Release**: Organizers can click `Release Seat` to cancel a booking and return the seat to available.
  - **Filters**: Quickly filter by `All Seats`, `Available Seats`, or `Occupied Seats`.

#### Stage B: Live Event Mode (When Event is Active / Started)
Tailored for live check-in and attendee monitoring during the actual event:
- **Summary Cards**:
  - `TOTAL SEATS`: Total venue capacity.
  - `● AVAILABLE` (Emerald Green): Available unbooked seats.
  - `● OCCUPIED` (Red): Booked/occupied seats.
  - `● AT VENUE` (Blue): Number of attendees physically checked in at the venue.
  - *Clutter Removed*: Statuses like `On the Way`, `Not Attending`, and `No Update` are eliminated for a clean operational view.
- **Live Seating & Attendance Table**:
  - Displays all seats across sections with columns: `Guest Name`, `Seat`, `Booking Status` (`● Available` / `● Occupied`), `Attendance` (`🟢 At Venue` / `-`), and `Action`.
  - Filter dropdown offers: `All Seats`, `Available`, `Occupied`, and `🟢 At Venue`.
  - Real-time search by guest name, mobile number, guest ID, or seat label.

---

### 3. Dynamic 2D Seating Layout Engine
- **Section-Based Architecture**: Configure multiple distinct sections (Center Section, Left Wing, Right Wing, Balcony) with independent rows and seat counts.
- **Unified Color Palette**:
  - 🟢 `AVAILABLE` (Emerald Green): Free seat ready for selection.
  - 🔴 `OCCUPIED` (Red): Booked seat; click to view occupant details or release.
  - 🟣 `RESERVED` (Purple): Held for VIPs, staff, or faculty.
  - ⚪ `BLOCKED` (Gray): Inactive/broken seat unavailable for booking.
- **Seat Conflict Protection**: Modifying layout rows or sections checks for existing bookings. Destructive layout changes that would delete occupied seats are blocked with a warning dialog.

---

### 4. Guest Booking Portal & QR Passes
- **Direct Access via Event ID or QR Code**: Guests access the portal at `/guest?event=EVENT_ID` or by scanning the generated event QR code.
- **Interactive Floor Plan**: Attendees click any available green seat to select it. The seat immediately turns red (`Occupied`) upon booking confirmation.
- **Strict Input Validation**:
  - **Name**: Must contain at least two alphabetic characters (rejects numeric or random symbols).
  - **Mobile Number**: Strictly enforces standard Indian and international formats (10 to 13 digits starting with 7, 8, or 9; accepts `0`, `91`, or `+91` prefixes).
- **Downloadable Digital QR Pass**: Upon booking, guests receive an instant modal displaying their seat number, attendee name, guest ID, and an encrypted QR code for venue entrance scanning.

---

### 5. Smart Consecutive Seat Finder (Usher Pro)
- Designed for venue ushers when groups arrive together:
  - Input group size (e.g., 4 people).
  - The algorithm searches available seats and prioritizes:
    1. Consecutive seats in the exact same row.
    2. Seats in the same section.
    3. Proximity to the stage.
  - Returns top 3 recommendations with direct one-click `[Assign Seats]` or `[Hold]` actions.

---

### 6. Role-Based Access Control (RBAC) & Audit Logs
- **Roles**:
  - `admin`: Full event creation, seating design, user administration, manual assignment, and report exports.
  - `usher`: Access to live seating map, consecutive seat finder, and live attendance check-in.
  - `viewer` / `guest`: Read-only map viewing and self-service booking.
- **Audit Activity Log**: Records every operational action (`Event Created`, `Seat Occupied`, `Seat Released`, `Layout Updated`, `Event Started`, `Event Ended`) with admin user name, event ID, organization, and timestamp.

---

## 🗄️ Data Models & Schema Design

| Model | Key Fields | Description |
|---|---|---|
| **`User`** | `name`, `email`, `password`, `role`, `organization`, `organizationId` | User accounts with bcrypt hashed passwords and RBAC roles. |
| **`Service` / `Event`** | `name`, `eventId`, `category`, `type`, `startDate`, `endDate`, `startTime`, `endTime`, `stageLabel`, `seatingLayoutType`, `status`, `isActive`, `eventState`, `manuallyActivated`, `organization` | Core event definitions with layout config and lifecycle states. |
| **`Seat`** | `seatId`, `seatNo`, `serviceId`, `eventId`, `section`, `sectionCode`, `row`, `number`, `status`, `assignedName`, `assignedId` | Individual venue seats mapped to 2D coordinates and booking status. |
| **`Booking`** | `eventId`, `seatNo`, `seatId`, `name`, `guestId`, `phone`, `status`, `attendanceStatus`, `formData`, `createdAt` | Confirmed guest reservations and check-in attendance state. |
| **`Registration`** | `eventId`, `fullName`, `idNumber`, `status`, `seatId`, `seatNo` | Attendee intake records for events with manual admin seat allocation. |
| **`ActivityLog`** | `action`, `userId`, `userName`, `details`, `eventId`, `organization`, `createdAt` | Immutable security audit trail recording all platform events. |

---

## 📡 REST API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/login` — Authenticate user and return JWT bearer token.
- `GET /api/auth/me` — Retrieve current authenticated user profile.

### Events & Services (`/api/events` or `/api/services`)
- `GET /api/events` — List all events belonging to the user's organization.
- `GET /api/events/:eventId` — Public/Admin fetch single event by eventId or ObjectId.
- `POST /api/events` — Create a new event and initialize its seating grid.
- `PATCH /api/events/:id` — Update event details or toggle active state (`isActive: true/false`).
- `PUT /api/events/:id/layout` — Synchronize seating layout sections, rows, and seats.
- `POST /api/events/:id/start` — Manually start event (triggers `STARTED` state).
- `POST /api/events/:id/end` — Manually end event (triggers `ENDED` state).
- `DELETE /api/events/:id` — Delete event and its associated seats.

### Seating (`/api/seats`)
- `GET /api/seats?eventId=:id` — Fetch all seats with live status for an event.
- `PATCH /api/seats/:id` — Update individual seat status (`available`, `occupied`, `reserved`, `blocked`).
- `POST /api/seats/assign` — Manually assign a seat to a registered attendee.
- `POST /api/seats/sections` — Add a new section to an event.
- `PATCH /api/seats/sections` — Rename an existing section.
- `DELETE /api/seats/sections` — Remove a section and its unbooked seats.
- `POST /api/seats/rows` — Add rows to a section.
- `DELETE /api/seats/rows` — Delete a row from a section.

### Bookings & Attendance (`/api/bookings`)
- `POST /api/bookings` — Atomic guest seat reservation with name & phone validation.
- `GET /api/bookings/:eventId/overview` — Fetch comprehensive two-stage booking & attendance overview.
- `POST /api/bookings/:id/attendance` — Update attendee check-in status (`At Venue`).
- `DELETE /api/bookings/:id` — Cancel a booking and release the seat.

### Activity Logs (`/api/activity`)
- `GET /api/activity` — Retrieve organization audit logs with filtering.

---

## 🛡️ Validation & Business Rules

1. **Active Event Priority**:
   - When an admin clicks **`Set Active`**, the event immediately becomes `Active` (`eventState = 'STARTED'`).
   - Manual activation takes precedence over scheduled start/end dates, allowing past or ongoing events to be activated for testing or live usage.
2. **Phone Number Formats**:
   - `10 digits`: Starting with `7`, `8`, or `9` (e.g. `9876543210`).
   - `11 digits`: Starting with `0` followed by `7`, `8`, or `9` (e.g. `09876543210`).
   - `12 digits`: Starting with `91` followed by `7`, `8`, or `9` (e.g. `919876543210`).
   - `13 digits`: Starting with `+91` followed by `7`, `8`, or `9` (e.g. `+919876543210`).
3. **Seat Concurrency Protection**:
   - Guest reservations execute atomic `findOneAndUpdate({ seatNo, status: 'available' })` queries. If two attendees attempt to reserve the same seat simultaneously, only the first request succeeds; the second receives a conflict response.

---

## 💻 Local Setup & Installation

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9 or higher)
- **MongoDB** running locally on port `27017` or a MongoDB Atlas URI

### 2. Environment Variables

Create `.env` in `backend/`:
```env
MONGO_URI=mongodb://localhost:27017/church-seating
JWT_SECRET=church_seating_secret_key_2024
PORT=5000
```

Create `.env` in `frontend/`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Installation & Seeding

```bash
# Clone the repository
git clone <repository-url>
cd seathub-seating-management

# Install backend dependencies & seed default admin
cd backend
npm install
npm run seed

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Running the Application

Open two terminal windows:

```bash
# Terminal 1: Backend Server (runs on http://localhost:5000)
cd backend
npm run dev

# Terminal 2: Frontend Web Client (runs on http://localhost:5173)
cd frontend
npm run dev
```

### 5. Default Credentials

- **URL**: `http://localhost:5173/login`
- **Email**: `admin@church.com`
- **Password**: `admin123`
- **Role**: `admin` (Grace Church)

---

## 📁 Project Directory Structure

```
seathub-seating-management/
├── backend/
│   ├── middleware/
│   │   └── auth.js             # JWT verification & RBAC guard
│   ├── models/
│   │   ├── ActivityLog.js      # Audit trail schema
│   │   ├── Booking.js          # Guest reservation schema
│   │   ├── Registration.js     # External intake schema
│   │   ├── Seat.js             # Physical seat schema
│   │   ├── Service.js          # Event/Service definition schema
│   │   └── User.js             # User account schema
│   ├── routes/
│   │   ├── activity.js         # Audit log endpoints
│   │   ├── auth.js             # Authentication endpoints
│   │   ├── bookingRoutes.js    # Reservations & overview endpoints
│   │   ├── eventRoutes.js      # Event lifecycle & layout endpoints
│   │   ├── registrations.js    # Registration intake endpoints
│   │   ├── seatRoutes.js       # Seat & section management endpoints
│   │   └── users.js            # User administration endpoints
│   ├── utils/
│   │   └── timeValidator.js    # 12h/24h time validation & state engine
│   ├── seed.js                 # Database clean & seed script
│   └── server.js               # Express application bootstrap
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── api.js          # Configured Axios instance with auth interceptor
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   └── AdminBookingsModal.jsx  # Two-stage booking/attendance modal
│   │   │   ├── common/
│   │   │   │   └── QrCodeModal.jsx         # Event QR display modal
│   │   │   ├── layout/
│   │   │   │   ├── Layout.jsx              # Main responsive app frame
│   │   │   │   ├── Navbar.jsx              # Header bar with user profile
│   │   │   │   └── Sidebar.jsx             # Navigation sidebar
│   │   │   └── seating/
│   │   │       ├── DynamicSeatingMap.jsx   # 2D interactive seating floor plan
│   │   │       └── SeatDetailsModal.jsx    # Admin seat inspector & modifier
│   │   ├── context/
│   │   │   ├── AuthContext.jsx             # User login, logout, profile state
│   │   │   └── SeatingContext.jsx          # Events, seats, layout operations
│   │   ├── pages/
│   │   │   ├── Activity.jsx                # Audit log viewer
│   │   │   ├── Dashboard.jsx               # Quick stats & overview
│   │   │   ├── FindSeats.jsx               # Usher consecutive seat finder
│   │   │   ├── GuestPage.jsx               # Public self-service booking portal
│   │   │   ├── Login.jsx                   # Sign-in page
│   │   │   ├── Reports.jsx                 # Occupancy breakdown & export
│   │   │   ├── SeatingMapPage.jsx          # Seating map editor & live view
│   │   │   ├── Services.jsx                # Event list & creation modal
│   │   │   └── Users.jsx                   # User role management
│   │   ├── utils/
│   │   │   └── timeValidator.js            # Client-side time range validator
│   │   ├── App.jsx                         # App routes & role protection
│   │   └── main.jsx                        # React root entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 📄 License

This software is proprietary and confidential. Developed for SeatHub Seating Management Platform. All rights reserved.
