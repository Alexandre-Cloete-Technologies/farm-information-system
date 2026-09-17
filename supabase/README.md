# Database

`migrations/` mirrors what is applied to the Supabase project, in order. It is
the whole database: schema, RLS policies, reporting views, seed data and the
demo accounts. Nothing lives only in the dashboard.

Applied via the Supabase MCP tooling rather than the CLI, so there is no
`config.toml` here yet. To take over with the CLI:

```bash
npx supabase link --project-ref <your-ref>
npx supabase migration list          # confirm these match what is applied
```

To stand the database up somewhere new — a second Supabase project, or a
self-hosted Postgres — run the files in filename order. They are ordinary SQL
and assume only `pgcrypto`, `pg_cron` and Supabase's `auth` schema.

A couple of the migrations correct earlier ones (the rainfall reseed, the
parcel shift, the auth token-column fix). They are kept as-is rather than
squashed so the applied state and this directory stay identical.

`20260917185847_seed_demo_accounts.sql` writes directly into `auth.users`. That
is fine for three throwaway demo logins, but real users should be created
through the Auth API.
