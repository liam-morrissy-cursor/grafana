/**
 * Quotes unquoted identifiers in a react-awesome-query-builder WHERE string.
 *
 * RAQB emits bare field names. FlightSQL (InfluxDB SQL) requires quoting for
 * mixed-case / dotted / special identifiers. Datasources historically patched
 * only `=` comparisons, which left LIKE-style operators (contains / starts with /
 * ends with) unquoted and rejected by the planner. This helper covers comparison
 * and LIKE/IN forms so every operator quotes the same way.
 */
export function quoteSqlWhereIdentifiers(whereString: string, quote = '"'): string {
  // Longer operators first so "NOT LIKE" is not partially matched as "LIKE", etc.
  const comparisonOps = '!=|<>|<=|>=|=|<|>';
  const wordOps = 'NOT\\s+LIKE|LIKE|NOT\\s+ILIKE|ILIKE|NOT\\s+IN|IN';
  // Anchor on start / whitespace / '(' so we do not rematch inside already-quoted names.
  const wherePattern = new RegExp(
    `(^|[\\s(])([^\\s${quote}'()]+)(\\s*)(?:(${comparisonOps})|(${wordOps})\\b)`,
    'gi'
  );

  return whereString.replace(wherePattern, (_match, leading, identifier, spacing, comparisonOp, wordOp) => {
    const op = comparisonOp || wordOp;
    const escaped = String(identifier).replaceAll(quote, `${quote}${quote}`);
    return `${leading}${quote}${escaped}${quote}${spacing}${op}`;
  });
}
