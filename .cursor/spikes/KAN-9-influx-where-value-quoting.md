# KAN-9 spike: Influx WHERE value quoting ignores field types

**Issue:** KAN-9 — Influx query builder WHERE clauses ignore field types when quoting values  
**Upstream:** grafana/grafana#94472 (auto-closed stale); open PR grafana/grafana#127890  
**Scope:** Plan only — no product fix in this PR  
**Tree status:** On current `main`, the InfluxDB core plugin and `pkg/tsdb/influxdb` were removed (#129602). Analysis below uses the last in-tree revision that still contained the code: `b7f5816d321` (parent of the removal).

Related tickets (orthogonal):

- **KAN-6** — identifier / dotted-name quoting (FROM / measurement names).
- **KAN-8** — identifier quoting in SQL `WHERE` for LIKE/`contains` (`quoteSqlWhereIdentifiers` on branch `agent/KAN-8-contains-filter-quoting`). That helper quotes **names**, not **values**.

---

## 1. Where WHERE-clause value rendering happens

Builder InfluxQL is rendered in **two places** that must stay consistent:

### Backend (authoritative for proxy / Explore executed query)

| Piece | Path (pre-removal) | Role |
| --- | --- | --- |
| Entry | `Query.renderWhereClause()` | Joins tag conditions into `WHERE ...` |
| Value quoting | `renderTags()` in `pkg/tsdb/influxdb/models/query.go` | Decides quotes per operator |
| Model | `Tag` in `pkg/tsdb/influxdb/models/models.go` | `Key`, `Operator`, `Value`, `Condition` only — **no type field** |
| Parser | `parseTags()` in `model_parser.go` | Reads those four JSON fields only |

Current `renderTags` quoting rules (verified at `b7f5816d321`, including existing unit tests in `query_test.go`):

| Operator | Quoting today |
| --- | --- |
| `=~` / `!~` | Pass-through (regex) |
| `<` / `>` / `>=` / `<=` | **Unquoted** (after stripping regex wrappers) |
| `=` / `!=` / `<>` / default | **Always single-quoted** |
| `Is` / `Is Not` | Rewrite to `=` / `!=`, then **infer type from the literal** (bool / number / string). Tags (`::tag`) always quoted |

So the upstream empty-result repro (`WHERE fieldstring::field != 10` with unquoted `10`) matches the **`Is` / `Is Not` literal-inference path**, not default `!=` (which always quotes). Existing tests already lock that in:

- `Is` + `123` → `"key" = 123` (unquoted)
- `Is Not` + `true` → `"key" != true`
- `=` + `10001` → `"key" = '10001'` (always quoted)

Numeric/boolean **fields** with default `=` / `!=` are therefore over-quoted today (`'42'`), while string fields with `Is`/`Is Not` (or comparison operators) on numeric-looking literals are under-quoted. Looking at the value alone cannot resolve string-vs-number; the builder needs field type metadata.

### Frontend (preview / legacy client-side render)

| Piece | Path (pre-removal) | Role |
| --- | --- | --- |
| Visual editor tags UI | `.../influxql/visual/TagsSection.tsx` | Edits `InfluxQueryTag` — no type |
| Client render | `InfluxQueryModel.renderTagCondition()` in `influx_query_model.ts` | Same operator-based quoting as Go (`Is*` → literal inference; `<`/`>` unquoted; else quote) |
| Metadata WHERE helper | `renderTagCondition()` in `influxql_query_builder.ts` | Used for `SHOW ...` metadata queries; quotes without field type |
| Tag type | `InfluxQueryTag` in `types.ts` | `key`, `operator?`, `condition?`, `value` — **no `dataType`** |

`VisualInfluxQLEditor` loads keys via `getFieldKeys()` and maps them to `"${field}::field"` strings only — no types attached when building the WHERE key picker.

### FlightSQL / RAQB path (separate surface)

`public/app/plugins/datasource/influxdb/fsql/sqlUtil.ts` builds SQL from react-awesome-query-builder `whereString`. That path has **identifier** quoting issues (KAN-8), not the InfluxQL `::field` value-typing bug. Do not conflate the two; a value-typing fix for InfluxQL does not automatically fix RAQB literals.

---

## 2. Is field type metadata available at render time?

**Fetched, then discarded — not available on the tag model today.**

1. The visual editor loads field names via `getFieldKeys()` → metadata query type `FIELDS` → `SHOW FIELD KEYS FROM <measurement>`.
2. InfluxDB returns two columns: `fieldKey`, `fieldType` (string / float / integer / unsigned / boolean). Response-parser tests even fixture both columns.
3. `response_parser.ts` treats `SHOW FIELD KEYS` as “value first” (`isValueFirst`) and keeps **only** `value[0]` (the key). `fieldType` is dropped; `getFieldKeys` returns `Promise<string[]>`.
4. `VisualInfluxQLEditor` maps keys to `"${field}::field"` for the WHERE key picker — name only.
5. Neither frontend `InfluxQueryTag` nor backend `Tag` carries a type, so `renderTags` / `renderTagCondition` cannot consult it.

So: metadata is one query away and already issued for the key picker, but the type column is never retained or threaded into the query JSON.

---

## 3. Concrete failing-test ideas

Prefer table-driven Go tests on `renderTags` (and mirrored TS tests on `renderTagCondition`) once the plugin tree exists again (external Influx plugin repo, or a restored in-tree copy). Combinations that currently render wrong SQL (or would without an explicit type):

| # | Field type | Key shape | Operator | Literal | Wrong / desired |
| --- | --- | --- | --- | --- | --- |
| 1 | string | `fieldstring::field` | `Is Not` / `!=` via `Is*` | `10` | Today: unquoted `10` (empty result). Must be `'10'` |
| 2 | string | `fieldstring::field` | `Is` / `=` via `Is*` | `10` | Same as #1 for equality |
| 3 | integer / float / unsigned | `n::field` | `=` / `!=` | `42` / `1.5` / `-3` | Today: always quoted `'42'`. Must be **unquoted** |
| 4 | boolean | `b::field` | `=` / `!=` | `true` / `TRUE` | Unquoted lowercase `true` / `false` (match `Is` path) |
| 5 | string | `s::field` | `=` / `Is` | `true` | Must stay **quoted** `'true'` — literal inference alone is wrong |
| 6 | string | `s::field` | `<` / `>` | `10` | Comparison ops currently force unquoted; string fields need quotes |
| 7 | integer | `n::field` | `Is` / `Is Not` | `10` | Already unquoted via literal inference; keep as regression |
| 8 | tag | `host::tag` | `=` / `Is` | `10` | Tags must **always** stay quoted regardless of `dataType` |
| 9 | field, unknown type | `x::field` | `=` | `10` | Safe default: quote (string-like) when type missing |
| 10 | field + explicit `dataType: string` | `v::field` | `Is` | `42` | Overrides numeric-looking literal → `'42'` |
| 11 | field + explicit `dataType: float` | `v::field` | `=` | `42` | Overrides always-quote default → unquoted `42` |
| 12 | regex | any | `=~` / `!~` | `/a.*/` | Unchanged — no extra quoting |

Parser tests: JSON tag with `dataType` populates `Tag.Type`; omitted `dataType` leaves type empty (backward compatible).

UI / integration ideas (when plugin e2e exists): pick a string field in the visual builder, set `Is Not` / value `10`, assert executed query shows `!= '10'` and rows return.

---

## 4. Smallest fix path (sketch)

Align with upstream PR #127890; extend it so the ambiguous string-vs-number case is not guess-only.

### A. Thread type from metadata into the query model (frontend)

1. Change `SHOW FIELD KEYS` parsing to return `{ text: fieldKey, type: fieldType }` (or a parallel map). Keep `getFieldKeys` callers compiling by adapting the return type or adding `getFieldKeysWithTypes`.
2. When the user selects a `::field` key in `TagsSection` / `VisualInfluxQLEditor`, set `InfluxQueryTag.dataType` from that map.
3. Clear or refresh `dataType` when the key changes; leave tags (`::tag`) without a type (always quoted).

### B. Honor type in renderers (backend + frontend)

1. Add optional `Type` / `dataType` on Go `Tag` and TS `InfluxQueryTag`; parse in `parseTags`.
2. Extract shared helper (e.g. `renderFieldValue(value, dataType, key)`):
   - If key is `::tag` (or not `::field`): keep today’s quoting.
   - If `dataType` is numeric or boolean: unquoted (bool lowercased).
   - If `dataType` is string or unknown: quoted.
   - Optional fallback: when `dataType` absent, infer from literal (current `Is` behavior) so old dashboards improve without migration — but **prefer quoting** for unknown `::field` when the operator is `=` / `!=` to avoid the string/`10` empty-result case.
3. Use the helper for `=`, `!=`, `<>`, `Is` / `Is Not`, and decide explicitly for `<` / `>` / `>=` / `<=` on string fields (today they never quote).

### C. Compatibility / migration

- **Additive JSON only** — optional `dataType` on tags; old panels keep working.
- **No dashboard migration required** if literal inference remains the fallback; panels that pick fields again in the builder get precise types.
- **Semantic change:** queries that today quote numeric field filters as `'42'` (or leave string fields unquoted via `Is*` / comparison ops) will start returning data. Call that out in the changelog; it fixes correctness, but golden / recorded queries may need updates.
- **Externalized plugin:** fix must land in the post-#129602 InfluxDB plugin repository (and any vendored copy), not only in this grafana core tree. This fork’s `main` no longer contains `pkg/tsdb/influxdb` or `public/app/plugins/datasource/influxdb`.
- **Do not conflate with KAN-6 / KAN-8** (identifier quoting). This ticket is **value** quoting driven by field types.

### D. Suggested implementation order

1. Backend `renderTags` + table-driven tests (unblocks correct execution even before UI sends `dataType`, via safer unknown-type default + optional override).
2. Frontend `InfluxQueryTag.dataType` + metadata parser retention of `fieldType`.
3. Wire picker → tag model; mirror quoting in `influx_query_model.ts` / `influxql_query_builder.ts`.
4. E2E on string field `Is Not` / `10` once a runnable plugin path exists.

---

## 5. What this PR does / does not do

- **Does:** Document render sites, metadata gap, test matrix, and smallest fix path for KAN-9 (re-verified against `b7f5816d321` after Influx removal).
- **Does not:** Reintroduce the removed Influx plugin, implement `dataType`, or change query semantics in this tree.

Visual verification: not feasible here — the affected UI/backend paths are not present on current `main`. A capture after the fix would show Explore → InfluxQL builder → WHERE on a string field with `Is Not` / value `10` producing `!= '10'` and returning rows.
