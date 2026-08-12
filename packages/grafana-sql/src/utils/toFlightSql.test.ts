import { QueryEditorExpressionType } from '../expressions';
import { type SQLQuery } from '../types';

import { toFlightSql } from './toFlightSql';

function queryWithWhere(whereString?: string): SQLQuery {
  return {
    refId: 'A',
    dataset: 'iox',
    table: 'TestValue',
    sql: {
      limit: 50,
      columns: [
        {
          parameters: [{ name: 'host', type: QueryEditorExpressionType.FunctionParameter }],
          type: QueryEditorExpressionType.Function,
        },
      ],
      whereString,
    },
  };
}

describe('toFlightSql', () => {
  it('should render sql properly', () => {
    expect(toFlightSql(queryWithWhere())).toBe(
      'SELECT "host" FROM "TestValue" WHERE "time" >= $__timeFrom AND "time" <= $__timeTo LIMIT 50'
    );
  });

  it('should wrap table identifiers with quotes', () => {
    expect(toFlightSql(queryWithWhere())).toContain('FROM "TestValue"');
  });

  it('quotes == / = filters (no regression)', () => {
    const result = toFlightSql(queryWithWhere(`(sensor_id = '12' AND sensor_id = '23')`));
    expect(result).toBe(
      `SELECT "host" FROM "TestValue" WHERE "time" >= $__timeFrom AND "time" <= $__timeTo AND ("sensor_id" = '12' AND "sensor_id" = '23') LIMIT 50`
    );
  });

  it('quotes contains / LIKE-style filters the same way as ==', () => {
    expect(toFlightSql(queryWithWhere(`(MixedCase LIKE '%err%')`))).toContain(`("MixedCase" LIKE '%err%')`);
    expect(toFlightSql(queryWithWhere(`(cpu.usage LIKE '%err%')`))).toContain(`("cpu.usage" LIKE '%err%')`);
    expect(toFlightSql(queryWithWhere(`(host NOT LIKE '%prod%')`))).toContain(`("host" NOT LIKE '%prod%')`);
    expect(toFlightSql(queryWithWhere(`(region ILIKE '%us%')`))).toContain(`("region" ILIKE '%us%')`);
    expect(toFlightSql(queryWithWhere(`(host LIKE 'prod%')`))).toContain(`("host" LIKE 'prod%')`);
    expect(toFlightSql(queryWithWhere(`(host LIKE '%prod')`))).toContain(`("host" LIKE '%prod')`);
  });

  it('quotes mixed-case == filters', () => {
    expect(toFlightSql(queryWithWhere(`(MixedCase = 'ok')`))).toContain(`("MixedCase" = 'ok')`);
  });

  it('should not wrap * with quote', () => {
    const query: SQLQuery = {
      refId: 'A',
      table: 'TestValue',
      sql: {
        limit: 50,
        columns: [
          {
            parameters: [{ name: '*', type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      },
    };
    expect(toFlightSql(query)).toBe(
      'SELECT * FROM "TestValue" WHERE "time" >= $__timeFrom AND "time" <= $__timeTo LIMIT 50'
    );
  });
});
