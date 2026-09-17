# Pre-pitch rehearsal checklist

The design deliberately skips a broad automated test suite; this checklist is
what replaces it. Run the whole thing on the real deployed URL, on the machine
and network you will actually present from, the day before.

## The day before

- [ ] `npm test` passes (risk formula + PDF generation).
- [ ] `npm run build` succeeds with no type errors.
- [ ] `npm run seed:snapshot` — refresh the offline fallback so it matches the
      live data, then redeploy. The fallback drifts as the cron job ticks.
- [ ] Confirm the Supabase project is **not paused**. Free-tier projects pause
      after a week of inactivity and take a few minutes to wake — the single
      most likely way this demo fails.
- [ ] Open the deployed URL on the presenting machine and sign in once, so any
      cold start is already paid for.

## Each role

Sign in, load the dashboard, and check the screen is complete before moving on.

- [ ] **Farmer** (`farmer@example.com`) — map draws with the parcel and its four
      zones over satellite imagery; all three map layers switch (soil moisture,
      NDVI, land use); rainfall chart shows bars and the long-term-mean line;
      the four stat tiles and the zone list are populated.
- [ ] **Agronomist** (`agronomist@example.com`) — both trend charts draw four
      lines with the zone name written at the end of each; "View as table"
      opens; prescriptions list one card per zone.
- [ ] **Bank** (`bank@example.com`) — risk score, productivity and indicative
      value all show numbers; the score-composition table's contributions sum to
      the drought-risk figure.

## The report

- [ ] Click **Generate report** on the Bank view **on the deployed site**, not
      just locally. This route depends on files that Next's tracing can drop
      from the serverless bundle, so it can work perfectly on your machine and
      still 502 in production. A PDF should download within a few seconds.
- [ ] Open it. One page, nothing cut off, and the value and risk figures match
      what is on screen.
- [ ] Click it a second time — repeat generation should behave identically.

## Failure drills

- [ ] **Supabase unreachable.** Verified working during the build, but re-run it
      if anything around auth changes. Because `NEXT_PUBLIC_*` values are baked
      in at build time, you have to rebuild to simulate it rather than just
      setting an env var:

      ```bash
      NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.invalid npm run build
      PORT=3100 npm start
      ```

      Keep the same project ref so the session cookie still matches, sign in on
      the real build first, then open `http://localhost:3100/dashboard`.
      Expected: the dashboard renders with "Serving cached snapshot" in the
      header, keeps the role you signed in as, and **Generate report** still
      produces a PDF. It must not bounce to the login page. Rebuild normally
      afterwards.
- [ ] **Report failure.** Confirm the button turns into a visible "Retry report"
      rather than a dead click.
- [ ] **Wrong password.** Inline error, no crash.

## On the day

- [ ] Open the dashboard a few minutes early and leave it up — the live feed
      ticks every two minutes, which is worth pointing out.
- [ ] Have the PDF already downloaded as a backup, in case generating it live
      goes wrong.
- [ ] Be ready to say plainly that the satellite data is simulated for this
      prototype and that vendor integration is the next phase. Do not let anyone
      leave thinking the feeds are live.
