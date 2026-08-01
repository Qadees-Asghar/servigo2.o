# Deploying SERVIGO 2.0 to Vercel

Total time: about ten minutes. You need a Supabase account and a Vercel account,
both of which have free tiers that comfortably run this app.

---

## Step 1 - Create the database

1. Go to https://supabase.com/dashboard and create a new project.
2. Pick a region close to your users and set a strong database password.
3. Wait for provisioning, then open **Project Settings > Database**.
4. Copy two connection strings:
   - **Transaction pooler** (port `6543`) - this becomes `DATABASE_URL`
   - **Session / direct** (port `5432`) - this becomes `DIRECT_URL`

The pooler string is what the serverless functions use. Serverless environments
open and drop connections constantly, and a direct connection would exhaust the
Postgres connection limit within minutes of real traffic.

---

## Step 2 - Apply the schema

Locally, with `.env.local` filled in:

```bash
npm install
npm run db:push
```

Or paste `supabase/migrations/0001_init.sql` into the Supabase SQL Editor and
run it. Either way you should end up with ten tables, five plpgsql functions,
four triggers and two views.

Verify:

```sql
select table_name from information_schema.tables
 where table_schema = 'public' order by 1;
```

---

## Step 3 - Generate your secrets

```bash
# Session signing key
openssl rand -base64 48

# One-time admin setup token
openssl rand -hex 32
```

On Windows PowerShell, if you do not have openssl:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

---

## Step 4 - Push to GitHub

```bash
cd servigo2.o
git init
git add .
git commit -m "SERVIGO 2.0 - Next.js rewrite"
git branch -M main
git remote add origin https://github.com/<your-username>/servigo2.o.git
git push -u origin main
```

Confirm that `.env.local` is **not** in the commit. `.gitignore` already covers
it, but check with `git status` before pushing.

---

## Step 5 - Import into Vercel

1. Go to https://vercel.com/new and import the `servigo2.o` repository.
2. Framework preset: **Next.js**. Leave build and output settings at default.
3. Before clicking Deploy, add these environment variables:

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase pooler string, port 6543 | required |
| `DIRECT_URL` | Supabase direct string, port 5432 | required |
| `AUTH_SECRET` | output of `openssl rand -base64 48` | required, at least 32 chars |
| `ADMIN_EMAILS` | your email, comma separated for several | required |
| `ADMIN_SETUP_TOKEN` | output of `openssl rand -hex 32` | required for first setup only |
| `NEXT_PUBLIC_APP_NAME` | `SERVIGO` | optional |

Apply them to Production, Preview and Development.

4. Deploy.

---

## Step 6 - Claim the administrator account

1. Visit `https://<your-app>.vercel.app/admin/setup`.
2. Paste the `ADMIN_SETUP_TOKEN` value.
3. Fill in your details using an email from `ADMIN_EMAILS`.
4. Choose your own password. It is hashed before it is stored.
5. You land on the admin dashboard.

**Then delete `ADMIN_SETUP_TOKEN` from Vercel and redeploy.** The token cannot be
replayed once the claim is recorded, but removing it eliminates the surface
entirely.

---

## Step 7 - Smoke test

Work through this in order. Each step depends on the one before it.

1. Sign up as a service provider. You should land on the provider dashboard with
   an "awaiting approval" notice, and publishing should be disabled.
2. From the admin dashboard, approve that provider.
3. Back as the provider, publish one service and one time slot inside the next
   seven days.
4. Sign up as a customer in a private window. The service should appear in the
   catalogue with an open slot count.
5. Book the slot. The slot should immediately disappear from availability.
6. As the provider, accept the booking, then mark it complete.
7. As the customer, leave a rating. The provider's average should update.
8. As the admin, confirm the audit log shows the whole chain.

If step 5 fails with a slot availability error, check that the slot date is
within seven days of today. That limit is enforced in the database.

---

## Troubleshooting

**"DATABASE_URL is not set"** - the variable is missing in Vercel, or you set it
only for Production while previewing a branch deploy.

**"too many connections"** - you used the direct string (5432) as `DATABASE_URL`.
Switch it to the pooler (6543).

**"prepared statement already exists"** - same cause. The client sets
`prepare: false` for the pooler, but only when pointed at the pooler.

**Admin setup page says "not configured"** - `ADMIN_EMAILS` or
`ADMIN_SETUP_TOKEN` is missing, or the token is shorter than 16 characters.
Redeploy after adding them; environment changes need a new deployment.

**Login always fails after a working deploy** - `AUTH_SECRET` changed. Every
existing session cookie is now invalid. Sign in again.

**Provider cannot publish anything** - the account is not approved yet. Approve
it from the admin dashboard.

---

## Cost

At the free tiers, this runs at zero cost: Supabase gives 500 MB of Postgres and
Vercel gives 100 GB of bandwidth per month. Realistically this supports a few
thousand bookings a month before you need to think about paying for anything.

---

## Custom domain

In Vercel: **Settings > Domains > Add**. Point the DNS record where Vercel tells
you. HTTPS is issued automatically, and the `secure` cookie flag is already on in
production, so sessions are protected the moment the certificate is live.
