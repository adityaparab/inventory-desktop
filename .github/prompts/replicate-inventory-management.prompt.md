---
mode: agent
description: Replicate the target inventory-management web app as a Tauri desktop app in this repository
---

# Replicate target repo functionality in this Tauri app

Analyze `bokyabhau/inventory-management` as the source of truth and replicate its functionality in this repository as a Tauri desktop app.

## Primary goal

Build the desktop version in:

- `src` for the React frontend
- `src-tauri` for the Rust backend

Do **not** implement the target repo as a web app. Convert it into a desktop architecture.

## Scope

Preserve the same:

- feature set
- screen structure
- route layout
- dark MUI look and feel
- data model
- user workflows

Ignore the current root `client` and `server` product behavior except where small pieces can be safely reused. The real target is parity with `bokyabhau/inventory-management` in `src` and `src-tauri`.

## Functional parity to implement

Replicate these areas:

- Data Entry
- Records
- Reports
- Parts
- Rejections
- Preferences

## UI requirements

Keep the same overall desktop experience:

- top app bar titled `Inventory Management`
- left side navigation
- main content area with routes/screens for:
  - Data Entry
  - Records
  - Reports
  - Parts
  - Rejections
  - Preferences

Preserve a visually similar dark Material UI style, forms, dialogs, tables, charts, and interactions.

## Backend requirements

Replace the target repo's NestJS HTTP API with Rust Tauri commands while keeping MongoDB persistence.

Reuse the existing embedded/local MongoDB startup and configuration approach already present in `src-tauri` if possible.

Expose Tauri commands for:

- parts: create, list, get, update, delete
- rejections: create, list, get, update, delete
- preferences: create, list, get by name, update by name, delete by name
- data entries: create, list, get, update, delete, filter

## Business rules to preserve

- part and rejection names normalized to title case
- unique names for parts, rejections, and preferences where applicable
- `totalRejections` computed from rejection items
- filtering behavior aligned with the target repo
- warning and danger thresholds loaded from preferences

## Data model to preserve

### Part

- `id`
- `name`

### Rejection

- `id`
- `name`

### Preference

- `id`
- `name`
- `value`

### DataEntry

- `id`
- `date`
- `shift` as `Day | Night`
- `inspectorName`
- `part`
- `numberOfParts`
- `rejections[]` with `reason` and `numberOfRejections`
- `totalRejections`
- `lotNumber`
- timestamps

## Frontend behavior to preserve

### Data Entry

- date picker
- shift auto-default based on current time
- part selector
- rejection selector with add/remove chips
- submit and reset actions
- validation behavior matching the target repo

### Records

- full table of entries
- filters for part, inspector, date/time range, load number range, and rejection percentage range
- expandable rows with rejection breakdown
- edit dialog
- delete action
- threshold-based row coloring using preference values

### Reports

- filtering by parts and date/time
- summary totals
- rejection breakdown table
- filtered records table
- Excel export with per-part sheets and threshold-based coloring

### Parts and Rejections

- create, edit, delete simple named entities

### Preferences

- create, edit, delete name/value pairs
- support `warningPercentage` and `dangerPercentage`

## Important implementation notes

- Replace `/api/...` fetch calls with a frontend client layer that invokes Tauri commands.
- Keep a query/cache abstraction similar to the target repo.
- Bring in the frontend dependencies needed for parity, including:
  - MUI
  - React Router
  - TanStack Query
  - Dayjs
  - Recharts
  - ExcelJS
- Preserve behavior defaults used in the target repo for warning and danger thresholds when preferences are missing.

## Suggested implementation order

1. Establish shared Rust data models and Mongo collections.
2. Implement Tauri commands for Parts, Rejections, and Preferences.
3. Implement Tauri commands for DataEntry CRUD and filtering.
4. Port the app shell, routes, and dark theme into `src`.
5. Port Parts, Rejections, and Preferences screens.
6. Port the Data Entry screen.
7. Port the Records screen.
8. Port the Reports screen and Excel export.
9. Validate behavior against the target repo screen by screen.

## Acceptance criteria

- A desktop Tauri app in this repo reproduces the target repo's user-visible functionality.
- UI flow, labels, route structure, and visual feel are very close to the target repo.
- MongoDB-backed persistence works locally inside the Tauri app.
- The implementation does not depend on the old `client` and `server` runtime for core functionality.
