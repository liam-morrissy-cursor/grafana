# KAN-9 spike: Influx WHERE value quoting ignores field types

**Issue:** KAN-9 — Influx query builder WHERE clauses ignore field types when quoting values  
**Upstream:** grafana/grafana#94472 (auto-closed stale); open PR grafana/grafana#127890  
**Scope:** Plan only — no product fix in this PR  
**Tree status:** On current `main`, the InfluxDB core plugin and `pkg/tsdb/influxdb` were removed (#129602). Analysis below uses the last in-tree revision that still contained the code: `b7f5816d321` (parent of the removal).

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

Current `renderTags` quoting rules (broken for typed fields):

- `=~` / `!~`: pass value through (regex).
- `<` / `>` / `>=` / `<=`: unquoted (after stripping regex wrappers).
- `Is` / `Is Not`: rewrite to `=` / `!=`, then **infer type from the literal** (bool / number / string). Tags (`::tag`) always quoted.
- **Default (`=`, `!=`, `<>`, …): always single-quote the value.**

So for a normal `=` / `!=` on a `::field` key, a numeric-looking string field value `10` becomes `... != '10'` only if it goes through a path that quotes; the ticket’s empty-result case is the opposite: the builder emits an **unquoted** `10` when it should quote for a string field — or quotes when the field is numeric. In the pre-removal Go code, `=` / `!=` always quote; comparison operators never do. Upstream PR #127890 reframes the bug around typed `::field` comparisons and adds explicit `dataType` so string fields with numeric-looking values stay quoted while numeric/boolean fields stay unquoted.

### Frontend (preview / legacy client-side render)

| Piece | Path (pre-removal) | Role |
| --- | --- | --- |
| Visual editor tags UI | `.../influxql/visual/TagsSection.tsx` | Edits `InfluxQueryTag` — no type |
| Client render | `InfluxQueryModel.renderTagCondition()` in `influx_query_model.ts` | Same operator-based quoting as Go |
| Metadata WHERE helper | `renderTagCondition()` in `influxql_query_builder.ts` | Used for `SHOW ...` metadata queries; also quotes without field type |
| Tag type | `InfluxQueryTag` in `types.ts` | `key`, `operator?`, `condition?`, `value` — **no `dataType`** |

`Is` / `Is Not` already attempt literal-based typing in both Go and TS; `=` / `!=` do not consult field metadata anywhere.

---

## 2. Is field type metadata available at render time?

**Fetched, then discarded — not available on the tag model today.**

1. The visual editor loads field names via `getFieldKeys()` → metadata query type `FIELDS` → `SHOW FIELD KEYS FROM <measurement>`.
2. InfluxDB returns two columns: `fieldKey`, `fieldType` (string / float / integer / unsigned / boolean).
3. `response_parser.ts` treats `SHOW FIELD KEYS` as “value first” and keeps **only** `value[0]` (the key). `fieldType` is dropped.
4. `VisualInfluxQLEditor` maps keys to `"${field}::field"` strings for the WHERE key picker — name only.
5. Neither frontend `InfluxQueryTag` nor backend `Tag` carries a type, so `renderTags` / `renderTagCondition` cannot consult it.

So: metadata is one query away and already issued for the key picker, but the type column is never retained or threaded into the query JSON.

---

## 3. Concrete failing-test ideas

Prefer table-driven Go tests on `renderTags` (and mirrored TS tests on `renderTagCondition`) once the plugin tree exists again. Combinations that currently render wrong SQL (or would without an explicit type):

| # | Field type | Key shape | Operator | Literal | Wrong / desired |
| --- | --- | --- | --- | --- | --- |
| 1 | string | `fieldstring::field` | `!=` | `10` | Must be `'10'`; unquoted `10` returns no rows (upstream repro) |
| 2 | string | `fieldstring::field` | `=` | `10` | Same as #1 for equality |
| 3 | integer / float / unsigned | `n::field` | `=` / `!=` | `42` / `1.5` / `-3` | Must be **unquoted**; quoted `'42'` compares as string → empty |
| 4 | boolean | `b::field` | `=` / `!=` | `true` / `TRUE` | Unquoted lowercase `true` / `false` (match `Is` path) |
| 5 | string | `s::field` | `=` | `true` | Must stay **quoted** `'true'` — literal inference alone is wrong |
| 6 | string | `s::field` | `<` / `>` | `10` | Comparison ops currently force unquoted; string fields need quotes |
| 7 | integer | `n::field` | `Is` / `Is Not` | `10` | Already unquoted via literal inference; keep as regression |
| 8 | tag | `host::tag` | `=` | `10` | Tags must **always** stay quoted regardless of `dataType` |
| 9 | field, unknown type | `x::field` | `=` | `10` | Safe default: quote (string-like) when type missing |
| 10 | field + explicit `dataType: string` | `v::field` | `=` | `42` | Overrides numeric-looking literal → `'42'` |
| 11 | field + explicit `dataType: float` | `v::field` | `=` | `42` | Overrides → unquoted `42` |
| 12 | regex | any | `=~` / `!~` | `/a.*/` | Unchanged — no extra quoting |

Parser tests: JSON tag with `dataType` populates `Tag.Type`; omitted `dataType` leaves type empty (backward compatible).

UI / integration ideas (when plugin e2e exists): pick a string field in the visual builder, set `!= 10`, assert executed query shows `!= '10'`.

---

## 4. Smallest fix path (sketch)

Align with upstream PR #127890; extend it so the ambiguous string-vs-number case is not guess-only.

### A. Thread type from metadata into the query model (frontend)

1. Change `SHOW FIELD KEYS` parsing to return `{ text: fieldKey, type: fieldType }` (or a parallel map).
2. When the user selects a `::field` key in `TagsSection` / `VisualInfluxQLEditor`, set `InfluxQueryTag.dataType` from that map.
3. Clear or refresh `dataType` when the key changes; leave tags (`::tag`) without a type (always quoted).

### B. Honor type in renderers (backend + frontend)

1. Add optional `Type` / `dataType` on Go `Tag` and TS `InfluxQueryTag`; parse in `parseTags`.
2. Extract shared helper (e.g. `renderFieldValue(value, dataType, key)`):
   - If key is `::tag` (or not `::field`): keep today’s quoting.
   - If `dataType` is numeric or boolean: unquoted (bool lowercased).
   - If `dataType` is string or unknown: quoted.
   - Optional fallback: when `dataType` absent, infer from literal (current `Is` behavior) so old dashboards improve without migration.
3. Use the helper for `=`, `!=`, `<>`, `Is` / `Is Not`, and decide explicitly for `<` / `>` / `>=` / `<=` on string fields (today they never quote).

### C. Compatibility / migration

- **Additive JSON only** — optional `dataType` on tags; old panels keep working.
- **No dashboard migration required** if literal inference remains the fallback; panels that pick fields again in the builder get precise types.
- **Semantic change:** queries that today quote numeric field filters as `'42'` (or leave string fields unquoted via comparison ops) will start returning data. Call that out in the changelog; it fixes correctness, but golden / recorded queries may need updates.
- **Externalized plugin:** fix must land in the post-#129602 InfluxDB plugin repository (and any vendored copy), not only in this grafana core tree. This fork’s `main` no longer contains `pkg/tsdb/influxdb` or `public/app/plugins/datasource/influxdb`.
- **Do not conflate with KAN-6** (identifier / dotted-name quoting). This ticket is **value** quoting driven by field types.

### D. Suggested implementation order

1. Backend `renderTags` + tests (unblocks correct execution even before UI sends `dataType`, via inference + optional override).
2. Frontend `InfluxQueryTag.dataType` + metadata parser retention.
3. Wire picker → tag model; mirror quoting in `influx_query_model.ts` / `influxql_query_builder.ts`.
4. E2E on string field `!= 10` once a runnable plugin path exists.

---

## 5. What this PR does / does not do

- **Does:** Document render sites, metadata gap, test matrix, and smallest fix path for KAN-9.
- **Does not:** Reintroduce the removed Influx plugin, implement `dataType`, or change query semantics in this tree.

Visual verification: not feasible here — the affected UI/backend paths are not present on current `main`. A capture after the fix would show Explore → InfluxQL builder → WHERE on a string field with value `10` producing `!= '10'` and returning rows.
