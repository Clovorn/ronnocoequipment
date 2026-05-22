# Ronnoco Equipment Catalog Dashboard

Internal dashboard for browsing, searching, and managing the Ronnoco equipment catalog.
Built on Supabase (catalog project `hthpngozynonzokhbpej`).

## Quick start (local)

```bash
npm install
cp .env.example .env
# Edit .env and paste your VITE_SUPABASE_ANON_KEY from
# https://supabase.com/dashboard/project/hthpngozynonzokhbpej/settings/api
npm run dev
```

Open http://localhost:5173 and sign in with the admin credentials you set up
in the Supabase auth dashboard.

## Deploy to Netlify

1. Push this repo to GitHub
2. In Netlify: New Site → Import from GitHub → pick this repo
3. Build settings auto-detected from `netlify.toml`
4. Add the two environment variables in Netlify's site settings:
   - `VITE_SUPABASE_URL` = `https://hthpngozynonzokhbpej.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the anon public key from Supabase)
5. Deploy

## Roles

- `admin` — full read/write access to all equipment, vendors, categories.
- `director` — same as admin (for the catalog domain).
- `sales` — read-only catalog access; can generate quotes.
- `customer` — sees only their own quotes (no catalog access).

To change a user's role, an admin runs:

```sql
update user_profiles set role = 'admin'
 where user_id = (select id from auth.users where email = '...');
```

## Stack

- React 18 + Vite
- Tailwind CSS 3
- Supabase JS client 2
- Deployed via Netlify
