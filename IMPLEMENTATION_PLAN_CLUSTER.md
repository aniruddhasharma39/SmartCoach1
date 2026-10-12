# Cluster (LC Gate) Module — Implementation Plan

This plan covers four related changes to the **Cluster** module across the backend
(Node.js/Express/Prisma), the web app (React/Vite) and the mobile app (Flutter):

1. **Create Gate** — add cascading **Zone** and **Division** dropdowns (Indian Railways).
2. **Slave/Device evidence** — add **Re-upload**, **View** (mobile) and **Delete**; remove the
   **"Verified"** label from the UI.
3. **Cluster list** — add **Sort** and **Filter** (Zone, Division, Location, Gate Name, LC Number).
4. **Parity** — keep web and mobile UI/features identical and consistent (same fields, labels,
   data source, and behaviour).

The plan is ordered so the backend contract is fixed first, then web, then mobile, then a
consistency pass. Nothing here is implemented yet — this is the agreed plan.

---

## 1. Current-state findings (what exists today)

### Backend
- `backend/prisma/schema.prisma` — `LCGate` has only `name`, `lcNumber`, `locationName`,
  `latitude`, `longitude`. **No zone/division.**
- `backend/src/routes/lcgate.ts`
  - `POST /api/v1/lcgate` accepts `{ name?, lcNumberDigits, locationName, latitude?, longitude? }`.
  - `GET /api/v1/lcgate` returns gates + masters + childDevices + evidences.
  - `DELETE` exists for gate, master and device — but **nothing for evidence**.
- `backend/src/routes/evidence.ts`
  - Only `POST /api/v1/evidence`. Re-posting the same slot creates a **duplicate row**
    (no uniqueness / replace semantics).
  - Watermarks image with Lat/Lng/time, uploads to Cloudinary (local `/uploads` fallback).
- Roles already include `Zone Officer` and `Division Officer` (`prisma/seed.ts`), but the
  `User` model has no zone/division fields (out of scope for now — see §9).

### Web (`web/src/screens/Cluster/ClusterDashboard.tsx`)
- `CreateGateForm` — Name, LC Number, Location, Lat/Lng + GPS. **No zone/division.**
- List view — plain grid of `gate-card`, no sort/filter.
- `EvidenceItem` — shows `🔍 View Photo` link + a green **`Verified`** badge when uploaded.
  **No re-upload and no delete.**
- Gate cards show Location + Master Units only.

### Mobile (`mobile/lib/screens/cluster/`)
- `create_gate_screen.dart` — Location Name, Gate Name, LC Number, Lat/Lng. **No zone/division.**
- `cluster_main_screen.dart` — `ListView` of cards, delete icon per gate. **No sort/filter.**
- `evidence_checklist_screen.dart` — shows a green **`Verified`** chip when done.
  **No view, no re-upload, no delete.**
- `upload_evidence_screen.dart` — camera-only, posts evidence, returns the new row.
- Several screens hardcode `https://lc-platform.onrender.com/...` instead of using `baseUrl`
  from `mobile/lib/config.dart` (a consistency bug to clean up).

### Reference data (zones/divisions)
- Canonical source found at
  `R2P/r2p_app/lib/core/constants/railway_data.dart` — a `Map<Zone, Map<Division, List<City>>>`
  covering **19 zones** and all their divisions. This will be reused as the single source of truth
  and copied into the backend (see §4).

---

## 2. Decisions & assumptions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Zone and Division are **required** on gate creation. | They are the primary filter/sort keys. Existing rows keep `null` and display as `—`. |
| D2 | Zone→Division data is served by the **backend** (`GET /api/v1/lcgate/reference-data`); web & mobile fetch it, with a small local fallback constant. | Guarantees identical data in both clients (parity requirement). |
| D3 | "No Verified in the UI" → **remove the green `Verified`/`Verified` chip entirely**. | The uploaded state is already obvious from the View/Re-upload/Delete actions. |
| D4 | Re-upload **replaces** the existing photo for the same `(masterId, childDeviceId, category)` slot. | Prevents duplicate evidence rows. Implemented server-side in the POST handler + a DELETE endpoint. |
| D5 | Filtering/sorting is **client-side** for now (data is already fully loaded by `GET /lcgate`). | Simplest, keeps both clients identical; backend query params can be added later if data grows. |
| D6 | Web and mobile share the same labels, filter dimensions, sort options, and evidence actions. | Explicit consistency requirement. |

---

## 3. Shared UI contract (both clients)

**Gate fields (create + display):** Zone, Division, Gate Name (optional), LC Number (4 digits),
Location Description, GPS Lat/Lng.

**Filter bar (above the list / Create button):**
- Zone (dropdown: All + 19 zones)
- Division (dropdown: All + divisions of the selected zone; if no zone selected → all divisions)
- Location (text, contains)
- Gate Name (text, contains)
- LC Number (text, contains)
- Clear/Reset filters button

**Sort dropdown:**
- Newest first (default)
- Gate Name A–Z / Z–A
- LC Number ascending
- Zone A–Z
- Location A–Z

**Evidence actions per checklist item (when uploaded):** View photo, Re-upload, Delete.
No "Verified" text anywhere.

---

## 4. Reference data (Zone → Division)

Create `backend/src/lib/railwayData.ts` by porting `RailwayData.data` from
`R2P/.../railway_data.dart` (19 zones). Shape:

```ts
export const RAILWAY_DATA: Record<string, string[]> = {
  "Central Railway": ["Mumbai CST", "Bhusawal", "Pune", "Solapur", "Nagpur CR"],
  "Western Railway": ["Ratlam", "Mumbai Central", "Vadodara", "Ahmedabad", "Rajkot", "Bhavnagar"],
  // ... all 19 zones
};
export const RAILWAY_ZONES = Object.keys(RAILWAY_DATA);
export const divisionsForZone = (zone?: string) => (zone && RAILWAY_DATA[zone]) || [];
```

Expose it via a new endpoint (see §5). Mirror the same map as a fallback constant in:
- `web/src/screens/Cluster/railwayData.ts`
- `mobile/lib/screens/cluster/railway_data.dart`

The clients prefer the API response and fall back to the local constant if the request fails.

---

## 5. Backend changes

### 5.1 Prisma schema (`backend/prisma/schema.prisma`)
```prisma
model LCGate {
  id           Int      @id @default(autoincrement())
  name         String?
  lcNumber     String   @unique
  locationName String
  zone         String?
  division     String?
  latitude     Float?
  longitude    Float?
  // ...
}
```
Apply with `npx prisma db push` (dev) / a migration in production.

### 5.2 `backend/src/routes/lcgate.ts`
1. **Extend `createGateSchema`**
   ```ts
   zone: z.string().min(1),
   division: z.string().min(1),
   ```
   and persist `zone`, `division` in `prisma.lCGate.create`.
2. **Add reference endpoint** (place before any `/:id` routes where relevant):
   ```ts
   // GET /api/v1/lcgate/reference-data  (authenticate)
   // -> { zones: string[], divisionsByZone: Record<string,string[]> }
   ```
3. (Optional, low priority) accept `?zone=&division=&location=&name=&lcNumber=&sort=` query
   params on `GET /` for future server-side filtering. Keep default behaviour unchanged.

### 5.3 `backend/src/routes/evidence.ts`
1. **`DELETE /api/v1/evidence/:id`** (authenticate)
   - 400 invalid id, 404 not found, else delete row.
   - Best-effort delete of the Cloudinary asset and/or the local `uploads/*.jpg` file
     (never fail the request if cleanup fails).
2. **Replace-on-re-upload** in `POST /`
   - Before creating, `deleteMany` where `{ masterId, childDeviceId, category }` and remove the
     old remote/local file. Then create the new row. This makes "Re-upload" idempotent and avoids
     duplicate evidence.
3. Return the created evidence (unchanged shape) so clients can update state.

### 5.4 (Optional) API doc / types
No TypeScript shared types between backend/web exist, so keep the response shape as today.

---

## 6. Web changes (`web/src/screens/Cluster/`)

### 6.1 `ClusterDashboard.tsx` — `CreateGateForm`
- Fetch `reference-data` on mount (fallback to `railwayData.ts`).
- Add **Zone** `<select>` (required) and **Division** `<select>` (required, disabled until zone
  chosen, options = divisions of selected zone). Reset division when zone changes.
- Send `zone` and `division` in the POST body.

### 6.2 `ClusterDashboard.tsx` — list view (sort & filter)
- Add local state: `filterZone`, `filterDivision`, `filterLocation`, `filterName`, `filterLc`,
  `sortBy`.
- Add a filter/sort toolbar **above the list and Create button**:
  - two `<select>`s (Zone, Division), three text inputs (Location, Gate Name, LC Number),
    one sort `<select>`, one Reset button.
- Derive `visibleGates` via `useMemo`:
  1. filter by each selected/entered dimension (case-insensitive `includes`), then
  2. sort per `sortBy`.
- Render `visibleGates`; show the existing empty state when the *filtered* list is empty
  (distinct message from "no gates at all").
- Show **Zone / Division** on each gate card (new rows in the card body) so the filter is
  meaningful and consistent with mobile.

### 6.3 `ClusterDashboard.tsx` — evidence (`EvidenceItem` / `CentralizedEvidenceUpload`)
- Remove the **`Verified`** badge.
- When `isDone`, render three actions:
  - **View** — keep the existing "View Photo" link (opens full URL in a new tab).
  - **Re-upload** — a hidden `<input type=file>` that re-POSTs (server replaces the slot).
  - **Delete** — confirm, then `DELETE /api/v1/evidence/:id`.
- Refresh flow: `CentralizedEvidenceUpload` currently receives a `master` snapshot held in
  `GateDetailView`. After delete/re-upload, call a shared `onRefresh()` that re-runs
  `fetchGates()` **and** re-derives `uploadingEvidenceFor` from the updated `selectedGate`
  (so the checklist reflects the new evidence). Simplest robust approach: lift the "selected
  master id" instead of the master object, and look it up from the refreshed `gate.masters`.
- Show a small photo thumbnail next to the item when uploaded (nice-to-have, keep parity with mobile).

### 6.4 `ClusterDashboard.css`
- Add styles for the filter toolbar (`.cluster-toolbar`, `.filter-row`) and the evidence
  action group (`.evidence-actions`, `.evidence-thumb`). Reuse existing tokens
  (`--surface`, `--border`, `--primary`, `--danger`).

---

## 7. Mobile changes (`mobile/lib/screens/cluster/`)

### 7.1 `create_gate_screen.dart`
- Fetch `GET $baseUrl/lcgate/reference-data` (fallback to `railway_data.dart`).
- Add `DropdownButtonFormField` for **Zone** (required) and **Division**
  (required, disabled until zone selected; rebuild options on zone change; clear division).
- Include `zone` / `division` in the POST body.
- Replace the hardcoded `https://lc-platform.onrender.com/...` URL with `$baseUrl/...`
  (import `../../config.dart`).

### 7.2 `cluster_main_screen.dart` — sort & filter
- Add a search field + a "Filter" action in the `AppBar` (or a collapsible panel above the list):
  - Zone dropdown, Division dropdown (cascading), Location text, Gate Name text, LC number text.
  - Sort dropdown (Newest / Name A–Z / Name Z–A / LC ascending / Zone A–Z / Location A–Z).
  - Reset action.
- Keep a `_filteredGates` getter applying the same filter+sort logic as web (case-insensitive
  `contains`, same default sort).
- Show **Zone / Division** on each card.
- Bottom-sheet (`showModalBottomSheet`) is the recommended filter UI on mobile for a clean layout.

### 7.3 `evidence_checklist_screen.dart`
- Remove the green **`Verified`** `Chip`.
- When `isDone`, render an action row: **View**, **Re-upload**, **Delete** (icons/buttons).
- **View**: new `_viewPhoto(evidence)` → open `evidence['imageUrl']` full-screen
  (`showDialog` + `InteractiveViewer`/`Image.network`). Prefix local `/uploads/...` URLs with the
  server host (derive from `baseUrl`).
- **Re-upload**: push `UploadEvidenceScreen` again (same slot); on success replace the existing
  evidence entry (by `id`/category/childDeviceId) rather than appending a duplicate.
- **Delete**: confirm dialog → `DELETE $baseUrl/evidence/:id` → remove from `evidences`.

### 7.4 `upload_evidence_screen.dart`
- Accept an optional `existingImageUrl` to preview a previously uploaded photo.
- Use `$baseUrl` instead of the hardcoded URL.
- Optionally allow **gallery** as well as camera (`ImageSource.gallery`) for re-upload.
- Return the created/replaced evidence object (already does on 201).

### 7.5 `railway_data.dart` (new)
- Dart port of the zone→division map (same content as backend/reference endpoint fallback).

### 7.6 URL/config cleanup (parity)
- Replace remaining hardcoded `https://lc-platform.onrender.com/...` occurrences in
  `gate_detail_screen.dart`, `create_master_screen.dart`, `upload_evidence_screen.dart`,
  `create_gate_screen.dart` with `$baseUrl` from `config.dart`.

---

## 8. File-by-file change list

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `zone`, `division` to `LCGate` |
| `backend/src/lib/railwayData.ts` | **New** — zone→division map (ported from R2P) |
| `backend/src/routes/lcgate.ts` | Schema + create fields; `GET /reference-data` |
| `backend/src/routes/evidence.ts` | `DELETE /:id`; replace-on-re-upload |
| `web/src/screens/Cluster/railwayData.ts` | **New** — fallback constant |
| `web/src/screens/Cluster/ClusterDashboard.tsx` | Zone/Division in create; filter+sort toolbar; evidence view/re-upload/delete; remove "Verified"; show zone/division on cards |
| `web/src/screens/Cluster/ClusterDashboard.css` | Toolbar + evidence-action styles |
| `mobile/lib/screens/cluster/railway_data.dart` | **New** — fallback constant |
| `mobile/lib/screens/cluster/create_gate_screen.dart` | Zone/Division dropdowns; `$baseUrl` |
| `mobile/lib/screens/cluster/cluster_main_screen.dart` | Filter+sort UI; show zone/division; `$baseUrl` |
| `mobile/lib/screens/cluster/evidence_checklist_screen.dart` | Remove "Verified"; view/re-upload/delete |
| `mobile/lib/screens/cluster/upload_evidence_screen.dart` | Re-upload support; `$baseUrl` |
| `mobile/lib/screens/cluster/gate_detail_screen.dart` | `$baseUrl` cleanup |
| `mobile/lib/screens/cluster/create_master_screen.dart` | `$baseUrl` cleanup |

---

## 9. Out of scope / future (flagged)

- Auto-filling Zone/Division from the logged-in user's role (`Zone Officer` / `Division Officer`)
  and adding `zone`/`division` to the `User` model — not requested, but a natural follow-up.
- Converting zone/division into normalized DB tables with FK constraints (strings are enough now).
- Server-side filtering/pagination (implemented client-side per D5).
- Zone/Division columns on existing rows: backfill requires manual input; show `—` meanwhile.

---

## 10. Verification / test plan

**Backend**
- `npx prisma db push` succeeds; `POST /lcgate` with zone+division persists them.
- `GET /lcgate/reference-data` returns the expected 19 zones and their divisions.
- `DELETE /evidence/:id` removes the row (and best-effort file); 404 for missing id.
- Re-POST the same slot → exactly one evidence row remains (no duplicates).

**Web** (`npm run build` / `npm run dev`)
- Create a gate with zone+division; card shows them.
- Filter by each dimension and combine them; sort each option; reset works.
- Evidence: view / re-upload / delete all work and refresh; **no "Verified"** text anywhere.

**Mobile** (`flutter analyze`, `flutter run`)
- Same create/filter/sort/evidence flows as web.
- Photo viewer opens; re-upload replaces (no duplicate); delete refreshes; no "Verified" chip.

**Parity check** (manual)
- Same labels, same filter dimensions, same sort list, same evidence actions on both clients.
