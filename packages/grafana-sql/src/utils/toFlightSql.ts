import { isEmpty } from 'lodash';

import { type SQLQuery } from '../types';

import { quoteSqlWhereIdentifiers } from './quoteSqlWhereIdentifiers';
import { createSelectClause, haveColumns } from './sql.utils';

/**
 * Renders an InfluxDB SQL / FlightSQL query from the visual builder model.
 *
 * Identifier quoting for WHERE used to cover only `=`, so contains/LIKE filters
 * left mixed-case and dotted field names bare. This renderer quotes comparison
 * and LIKE-style operators the same way.
 */
export function toFlightSql({ sql, table }: SQLQuery): string {
  let rawQuery = '';

  if (!sql || !haveColumns(sql.columns)) {
    return rawQuery;
  }

  const sc = sql.columns.map((c) => ({
    ...c,
    parameters: c.parameters?.map((p) => ({ ...p, name: formatColumnName(p.name) })),
  }));
  rawQuery += createSelectClause(sc);

  if (table) {
    rawQuery += `FROM "${table}" `;
  }

  rawQuery += `WHERE "time" >= $__timeFrom AND "time" <= $__timeTo `;
  if (sql.whereString) {
    rawQuery += `AND ${quoteSqlWhereIdentifiers(sql.whereString)} `;
  }

  if (sql.groupBy?.[0]?.property.name) {
    const groupBy = sql.groupBy.map((g) => `"${g.property.name}"`).filter((g) => !isEmpty(g));
    rawQuery += `GROUP BY ${groupBy.join(', ')} `;
  }

  if (sql.orderBy?.property.name) {
    rawQuery += `ORDER BY "${sql.orderBy.property.name}" `;
  }

  if (sql.orderBy?.property.name && sql.orderByDirection) {
    rawQuery += `${sql.orderByDirection} `;
  }

  if (isLimit(sql.limit)) {
    rawQuery += `LIMIT ${sql.limit}`;
  }

  return rawQuery;
}

function formatColumnName(parameter: string | undefined): string {
  if (parameter === '*') {
    return parameter;
  }

  return `"${parameter}"`;
}

const isLimit = (limit: number | undefined): boolean => limit !== undefined && limit >= 0;
