# API v0.1

Same-origin JSON API under `/api`. All endpoints except health and login require the session cookie. Mutations require `Content-Type: application/json` and a same-origin request. Cross-site requests are rejected. All business data is company-scoped on the server.

## Endpoints

| Method | Path | Behaviour | Role |
| --- | --- | --- | --- |
| GET | `/health` | Database readiness and app version | Public |
| POST | `/auth/login` | Email/password; set eight-hour session cookie | Public, rate-limited |
| POST | `/auth/logout` | Revoke current session | Signed in |
| GET | `/bootstrap` | Workspace records, current user, metrics inputs, recent job events | Signed in; financial fields filtered |
| POST | `/customers` | Create customer | Admin / manager / estimator |
| PUT | `/customers/:id` | Edit customer | Admin / manager / estimator |
| POST | `/quotes` | Validate and calculate lines; save draft | Admin / manager / estimator |
| GET | `/quotes/:id` | Quote and cost snapshots | Admin / manager / estimator |
| PUT | `/quotes/:id` | Replace draft content; recalculate; rejects non-drafts | Admin / manager / estimator |
| POST | `/quotes/:id/status` | Draft → Sent → Accepted or Declined | Admin / manager / estimator |
| POST | `/quotes/:id/convert` | Accepted quote → order; duplicate calls return existing order | Admin / manager / estimator |
| GET | `/orders/:id` | Order and approved lines | Signed in; financial fields filtered |
| PATCH | `/orders/:id` | Site, PO, deposit flag | Admin / manager / estimator |
| POST | `/orders/:id/jobs` | One job per line; duplicate calls return existing jobs | Admin / manager |
| GET | `/jobs/:id` | Specifications, quantities, job events | Signed in; financial fields filtered |
| PATCH | `/jobs/:id` | Assignment, priority, due date, notes | Admin / manager |
| POST | `/jobs/:id/action` | Validated production transition | Admin / manager / operator; approvals restricted |
| PATCH | `/machines/:id` | Status, reference rate and notes | Admin / manager |
| PUT | `/settings` | Company and estimator/release defaults | Admin |

## Quote creation

```json
{
  "customerId": "customer-1",
  "title": "Reception graphics",
  "dueDate": "2026-10-01",
  "validUntil": "2026-10-10",
  "notes": "Prices exclude VAT.",
  "lines": [{
    "description": "Printed and laminated window graphics",
    "product": "Printed vinyl",
    "width": 1000,
    "height": 700,
    "quantity": 10,
    "rollWidth": 1300,
    "bleed": 3,
    "gap": 5,
    "waste": 12,
    "materialRate": 3.5,
    "inkRate": 1.25,
    "finishingRate": 3,
    "labourHours": 1,
    "labourRate": 40,
    "setup": 15,
    "margin": 70,
    "minimum": 45,
    "rotate": true
  }]
}
```

Dimensions are in mm; monetary rates in EUR, not cents; percentage values are 0–100-style numbers (70 means 70%). Stored header totals are integer cents. Client-provided computed totals are rejected by the strict input schema. Full limits are in `shared/costing.ts`.

## Production actions

```json
{"action":"output","version":3,"good":4,"rejected":1,"note":"Banding on one print"}
```

Actions: `start`, `pause`, `block`, `unblock`, `advance`, `output`, `approve`, `revise`, `materials`, `deliver`.

- `version` is always the current job version returned by GET. It increments after each successful mutation.
- `output` increments good/rejected counts, requires a running or paused Production operation, and requires a reason for rejects.
- `deliver` uses `good` as the incremental fulfilled quantity and cannot exceed produced quantity.
- `block` requires a nonblank note. `unblock` changes a blocked job to Ready; normal release checks still apply to starting it.
- `approve`, `revise` and `materials` require a manager/admin. `materials` toggles readiness.
- `advance` checks stage-specific quantity and release conditions. It advances one fixed-route stage and records an event.

## Errors

Errors return `{"error":"Readable explanation"}`. Common statuses: 400 invalid input, 401 no valid session, 403 role/cross-site restriction, 404 inaccessible record, 409 stale version/state/release conflict, 415 non-JSON mutation, 429 login rate limit. There is no external API token support yet.
