# LBFC Volunteer Scheduling App — Setup & Deployment Guide

## What This App Does

A web app for the Long Beach Food Coalition to manage volunteer shift scheduling:

- **Volunteers** sign up with an invite code, then browse a calendar of available shifts and sign up with one click
- **Admins** (you) create shifts, manage invite codes, and see who's signed up
- **Email confirmations** go to both the volunteer and the scheduling coordinator
- **Google Calendar** integration — volunteers can add shifts directly to their calendar

---

## Quick Start (Local Development)

### 1. Install Node.js
Download from [nodejs.org](https://nodejs.org/) (version 18 or higher).

### 2. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### 3. Set up environment variables
Copy the example file:
```
cp .env.example .env.local
```
Edit `.env.local` with your coordinator email.

### 4. Start the app
```
npm run dev
```
Open http://localhost:3000 in your browser.

### 5. First-time setup
Go to http://localhost:3000/setup to create your admin account. You'll receive 5 invite codes to share with your first volunteers.

---

## Deploying Online (Free)

### Option A: Vercel (Recommended — Easiest)

1. Create a free account at [vercel.com](https://vercel.com)
2. Push this code to a GitHub repository
3. In Vercel, click "New Project" → Import your GitHub repo
4. Add environment variables in Vercel's dashboard:
   - `SESSION_SECRET` = a random string (use a password generator)
   - `COORDINATOR_EMAIL` = your email
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for email — see below)
5. Deploy!

**Important:** The JSON file database works for small scale, but Vercel's serverless functions don't have persistent file storage. For production on Vercel, you'll want to swap to a hosted database like [Supabase](https://supabase.com) (free tier) or [PlanetScale](https://planetscale.com). I can help with that migration when you're ready.

### Option B: Railway (Persistent Storage)

[Railway](https://railway.app) supports persistent file storage, so the JSON database works out of the box:
1. Create a free account
2. Connect your GitHub repo
3. Add the same environment variables
4. Deploy

### Option C: Render

Similar to Railway — [render.com](https://render.com) has a free tier with persistent disk.

---

## Setting Up Email Notifications

For emails to actually send (not just log to console), you need SMTP credentials.

### Free options:

**Resend (recommended)**
1. Sign up at [resend.com](https://resend.com) (free for 100 emails/day)
2. Get your API key
3. Set in `.env.local`:
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=your-api-key
FROM_EMAIL=noreply@yourdomain.com
```

**Gmail**
1. Enable 2FA on your Google account
2. Generate an App Password (Google Account → Security → App Passwords)
3. Set in `.env.local`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## How It Works

### For You (Admin)
1. Log in and go to the Admin panel
2. Create shifts with: title, date/time, location, pickup notes, # of volunteer slots
3. Generate invite codes and share them with approved volunteers
4. View who's signed up for each shift in the admin dashboard

### For Volunteers
1. Receive an invite code from you
2. Sign up at your app URL with their name, email, phone, and the invite code
3. Browse the calendar and click any green shift to sign up
4. Receive an email confirmation with shift details and a Google Calendar button
5. Can cancel their signup if needed

---

## Project Structure

```
src/
  app/
    page.js          — Landing page
    login/           — Login page
    signup/          — Volunteer signup (with invite code)
    dashboard/       — Calendar view (main volunteer page)
    admin/           — Admin panel (shifts, volunteers, invite codes)
    setup/           — First-time admin setup
    api/             — All API routes
      auth/          — Login, signup, session, logout
      shifts/        — Get shifts, sign up/cancel
      admin/shifts/  — Create, edit, delete shifts (admin)
      invite-codes/  — Generate and list invite codes (admin)
      setup/         — First-time setup
  lib/
    db.js            — Database layer (JSON file)
    auth.js          — Session management
    email.js         — Email notifications
  components/
    Calendar.js      — Monthly calendar view
    ShiftModal.js    — Shift details popup
    Navbar.js        — Top navigation
data/
  db.json            — Database file (auto-created)
```

---

## Need Help?

Reach out anytime — I can help with:
- Migrating to a proper database for larger scale
- Custom branding/design updates
- Adding features (recurring shifts, volunteer hours tracking, etc.)
- Setting up your domain name
