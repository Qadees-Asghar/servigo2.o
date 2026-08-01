<div align="center">

# SERVIGO 2.0

### Service booking and management platform, rebuilt for the web

<p>
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white"/>
</p>

</div>

---

## What this is

SERVIGO 1.0 was a C# Windows Forms desktop application backed by SQL Server. It
worked, but it could only ever run on one Windows machine at a time, and it
shipped with an administrator password written into `Program.cs`.

SERVIGO 2.0 is the same product, rebuilt as a web application that deploys to
Vercel in a single push. Every business rule from the desktop version survived
the move. The security model did not, and that was deliberate.

| | SERVIGO 1.0 | SERVIGO 2.0 |
|---|---|---|
| Language | C# | TypeScript |
| UI | Windows Forms | Next.js 15 App Router, React 19 |
| Database | SQL Server (local) | PostgreSQL on Supabase |
| Data access | ADO.NET DAL classes | Typed SQL through `postgres` |
| Session | Static field in memory | Signed JWT in an httpOnly cookie |
| Admin access | Hardcoded seed credentials | Env allowlist plus one-time setup token |
| Hosting | One Windows desktop | Global edge, serverless functions |

---

## The admin access problem, and how it was fixed

The original `Program.cs` contained this:

```csharp
Email        = "admin@servigo.com",
PasswordHash = PasswordHelper.Hash("Admin@123"),
```

Anyone who cloned the repository owned the system. There was no way to change
it without recompiling, and the credentials were identical across every install.

SERVIGO 2.0 replaces that with a runtime bootstrap that keeps secrets out of
source control entirely:

1. **Allowlist.** `ADMIN_EMAILS` holds the only addresses that may ever hold the
   Admin role. It lives in the environment, not the repository.
2. **One-time token.** `ADMIN_SETUP_TOKEN` is a random secret you generate. It
   is compared in constant time so it cannot be guessed byte by byte.
3. **You pick the password.** Visit `/admin/setup`, supply the token, and choose
   a password. It is bcrypt hashed at cost 12 before it reaches the database.
4. **Single use.** The claim is recorded in the `admin_bootstrap` table, which
   has a `CHECK (id = 1)` constraint. A second claim is impossible even if the
   token leaks afterwards.
5. **Public signup cannot escalate.** `/api/auth/signup` explicitly refuses any
   email on the allowlist, so nobody can register their way into the role.
6. **Live re-check.** `requireRole()` re-reads `is_active` and `role_id` from the
   database on every privileged call, so a demoted or suspended user cannot keep
   working off a still-valid cookie.

Once the admin exists, delete `ADMIN_SETUP_TOKEN` from your environment.

---

## Architecture

```text
Browser (React 19, Tailwind v4)
        |
        v
Edge middleware  ->  verifies the session JWT before any page renders
        |
        v
Route handlers (Node runtime)
   validation (zod)  ->  authorisation (requireRole)  ->  SQL
        |
        v
PostgreSQL (Supabase)
   plpgsql functions hold the transactional rules
   triggers write the audit log and refresh provider ratings
   RLS enabled with no permissive policies
```

Authorisation lives in three places on purpose, so no single mistake opens a
hole: the middleware blocks the wrong role from a page, the route handler blocks
the wrong role from the data, and the database refuses invalid states outright.

---

## Business rules preserved from 1.0

Everything below is enforced inside `create_booking()` and
`update_booking_status()` in Postgres, so it holds regardless of which client
calls it.

- A slot must be available at the moment of booking, checked under a row lock.
- Bookings may be made no more than seven days in advance.
- Past slots cannot be booked.
- A customer cannot double-book the same slot.
- Booking a slot locks it; cancelling or rejecting releases it.
- Every status change notifies the affected party.
- Ratings are one per booking and only on completed bookings; the provider's
  average recalculates automatically via trigger.

Added in 2.0: a state machine for status transitions. A provider can only accept
or reject a booking that is Pending, and can only complete one that is Accepted.
The desktop app enforced this by hiding buttons, which is not a permission.

---

## Roles

**Customer.** Browse verified services, book a slot, cancel, rate completed jobs,
read notifications.

**Service provider.** Publish services and availability, accept or reject
requests, mark jobs complete, track rating and completed earnings. Locked until
an administrator approves the account.

**Administrator.** Approve or revoke providers, activate or suspend accounts,
resolve complaints, read the audit trail and platform statistics.

---

## Local development

```bash
git clone https://github.com/<your-username>/servigo2.o.git
cd servigo2.o
npm install
cp .env.example .env.local   # then fill in the values
npm run db:push              # applies supabase/migrations
npm run dev
```

Open http://localhost:3000, then visit `/admin/setup` once to claim the
administrator account.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Vercel and Supabase walkthrough.

---

## Project structure

```text
servigo2.o/
├── scripts/
│   └── apply-migrations.mjs      migration runner
├── supabase/migrations/
│   └── 0001_init.sql             schema, functions, triggers, views, RLS
├── src/
│   ├── middleware.ts             edge session and role gate
│   ├── lib/
│   │   ├── db.ts                 pooled Postgres client, role and status enums
│   │   ├── auth.ts               hashing, login, admin bootstrap, role guards
│   │   ├── session.ts            JWT sign and verify
│   │   ├── validation.ts         zod schemas ported from ValidationHelper.cs
│   │   └── api.ts                consistent JSON envelope and error mapping
│   ├── components/ui.tsx         shared UI primitives
│   └── app/
│       ├── page.tsx              landing
│       ├── login/  signup/       auth pages
│       ├── admin/setup/          one-time admin bootstrap
│       ├── dashboard/            customer, provider, admin
│       └── api/                  route handlers
├── .env.example
└── README.md
```

---

## Security notes

- Passwords: bcrypt, cost 12. Login runs a dummy comparison on unknown emails so
  response time does not reveal which addresses are registered.
- Sessions: HS256 JWT, httpOnly, SameSite lax, secure in production, 8 hour TTL.
- SQL injection: every query uses tagged-template parameter binding.
- Row Level Security is enabled on all tables with no permissive policies, so a
  leaked anon key reads nothing.
- Security headers set in `next.config.ts`: X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy.
- No secret of any kind is committed. `.env.example` documents the shape only.

---

## Credits

Original SERVIGO desktop application by **Qadees Asghar**.
Web rewrite: SERVIGO 2.0.
