# Feature checklist and acceptance criteria

Status: **v0.1 first working prototype**. No ShopVox Pro parity claim has been made.

| Area | Working in v0.1 | Planned / limitation |
| --- | --- | --- |
| Workspace | Dark responsive layout, overview, global search, attention list, role-aware navigation | Saved views, bulk edits, persistent notifications |
| Customers | Create/edit/search, contact/address, terms, sector, notes, CSV | Multiple contacts and sites as dedicated entities, activities, CRM pipeline |
| Quotes | Multiple lines, saved drafts/editing, send/accept/decline, printable quote, snapshots | Customer approval links, actual email, revisions of sent/accepted quotes, discounts, quantity alternatives |
| Costing | Rectangular roll layout; finished vs consumed area; bleed/gaps/rotation; waste once; material/ink/finishing/labour/setup; margin; minimum price | Dedicated rigid-sheet yield, fabrication, machine-time/overhead allocation, white-layer models, tax, nesting, offcuts, reusable template editor |
| Sales orders | Conversion, immutable approved line snapshots, PO/site/deposit, linked jobs, completion roll-up | Order amendments, cancellations, independent order entry, partial order-line job splitting |
| Production | Kanban/list/operator views, fixed route, task state separate from stage, assignment, timers, partial output, rejects, holds, history, printing, CSV | Configurable parallel routing, batches, linked rework/reprints, barcode generation/scanning |
| Artwork | Manual version metadata, manager approval, approval invalidation and release gate | File upload/storage, previews, customer proofing, automated preflight |
| Equipment | 5 records for actual equipment/workstations, status, notes/rates, assigned queues, exclusive machine running rule | Live telemetry, maintenance schedules, print-mode profiles, capacity calendars |
| Stock | Manual per-job material-readiness gate | Materials catalog, physical roll/sheet ledger, reservations, consumption, offcuts, supplier purchasing |
| Installation | Site text, department stage, delivered/installed quantities | Surveys, measured items/photos, crew/vehicle schedules, sign-off, snagging, partial dispatch packs |
| Finance | Quote/order values, cost/margin snapshots, deposit flag, operational Ready to Invoice stage | No invoice/payment ledger, VAT calculation, exports to accounting, staged/partial invoices, credits |
| Reporting | Current overview, deadline counts, good output m², quantities, activity and CSV | Period-specific productivity, waste/cost reconciliation, failed m² by floor/level, profitability reports |
| Settings | Company, EUR defaults, costing defaults, release gates, audit of changes | Numbering UI, custom fields, branches, permission editor, workflow editor, templates |
| Access | Admin and operator sample accounts; server role/company checks; session revocation | Full eight-role matrix, account management, SSO/MFA, password reset, production hardening |
| Integrations | None; no fake integration controls | ONYX/NAS connector, Microsoft 365/SharePoint, ConnectTeam, accounting, migration imports |
| Ecommerce | Excluded | Not on this project roadmap |

## v0.1 acceptance criteria

- A clean Compose start initializes the schema and sample data automatically. Restart does not reset them. **Configuration included; Docker execution pending.**
- Admin creates and edits a quote, accepts it, converts it to an order and creates linked jobs without re-entering dimensions. **API tests passed.**
- Repeating conversion and job creation returns existing records. **API tests passed.**
- Unapproved artwork, missing materials, required deposits and busy machines block release/start. **API tests passed.**
- Partial production/rejection counts survive edits and cannot exceed good ordered output. Stale duplicate submissions are rejected. **API tests passed.**
- Delivery cannot exceed production. Incomplete output prevents progression beyond Production; incomplete delivery prevents leaving Installation. **API tests passed.**
- Operator responses do not expose costs, rates or quotes, and forbidden actions are rejected by the API. **API tests passed.**
- Data survives close/reopen and idempotent migrations/seed. **Embedded PostgreSQL persistence test passed.**
- Desktop, tablet and phone screens remain usable. **Responsive code included; browser acceptance pending.**

## Next phases

1. Pilot the quote → job workflow on real specifications; agree calculation rules, roles, dispatch route and job split behaviour. Reconcile totals against current quoting.
2. Add artwork storage/proofing and a physical inventory ledger with reservation/consumption concurrency tests.
3. Add product-specific routes, machine capacity planning, maintenance and real material/print mode costing.
4. Add surveys, installation scheduling, fulfilment and an agreed accounting handoff.
5. Verify vendor APIs/licences and implement narrowly scoped integrations. Customer portal follows separately; ecommerce remains excluded.

For any phase, add real persisted behaviour before showing a control as working. Keep this checklist updated before making parity claims.
