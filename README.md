# Ronnoco Deal Builder

Internal app for browsing the Ronnoco equipment catalog, building deals, and submitting them to the deal pipeline.
Built on Supabase (catalog project `hthpngozynonzokhbpej`).

## Quick start (local)

```bash
npm install
cp .env.example .env
# Edit .env and paste your VITE_SUPABASE_ANON_KEY
npm run dev
```

Open http://localhost:5173 and sign in.

## Deploy to Netlify

Netlify auto-detects everything from `netlify.toml` at the repo root:

1. New Site → Import from Git → pick this repo
2. Build settings are auto-detected (`npm run build` → `dist/`)
3. Add environment variables in Netlify site settings:
   - `VITE_SUPABASE_URL` = `https://hthpngozynonzokhbpej.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the anon public key from Supabase)
4. Deploy

## Roles

- `admin` — full read/write to equipment, vendors, categories
- `director` — same as admin (for the catalog domain)
- `sales` — read-only catalog access; can generate quotes
- `customer` — sees only their own quotes (no catalog access)

To change a user's role, an admin runs:

```sql
update user_profiles set role = 'admin'
 where user_id = (select id from auth.users where email = '...');
```

## Stack

- React 18 + Vite 5
- Tailwind CSS 3
- Supabase JS client 2
- Deployed via Netlify
