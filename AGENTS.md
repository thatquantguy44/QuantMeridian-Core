# Repository guidance

QuantMeridian-Core is generated from the QuantMeridian source repository by
`scripts/downstream/build-core.mjs`. Make source and projection changes upstream;
the next sync overwrites edits made only in Core.

Keep securities-finance modules, routes, datasets, services, and guides out of
this public projection. Run the projection build, typecheck, tests, and client
and server builds before syncing. Keep the public secret scan and the Vite
compose-secret filter enabled.
