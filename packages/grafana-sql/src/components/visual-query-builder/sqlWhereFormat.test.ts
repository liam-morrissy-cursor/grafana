import { type Config, type JsonTree, Utils } from '@react-awesome-query-builder/ui';

import { QueryEditorExpressionType } from '../../expressions';
import { type SQLQuery } from '../../types';
import { quoteSqlWhereIdentifiers } from '../../utils/quoteSqlWhereIdentifiers';
import { toFlightSql } from '../../utils/toFlightSql';

import { raqbConfig } from './AwesomeQueryBuilder';

const config: Config = {
  ...raqbConfig,
  fields: {
    MixedCase: { label: 'MixedCase', type: 'text', valueSources: ['value'] },
    'cpu.usage': { label: 'cpu.usage', type: 'text', valueSources: ['value'] },
    host: { label: 'host', type: 'text', valueSources: ['value'] },
  },
};

function ruleTree(field: string, operator: string, value: string): JsonTree {
  return {
    id: Utils.uuid(),
    type: 'group',
    children1: [
      {
        type: 'rule',
        properties: { field, operator, value: [value], valueSrc: ['value'], valueType: ['text'] },
      },
    ],
  };
}

function toSql(tree: JsonTree): string | undefined {
  return Utils.sqlFormat(Utils.checkTree(Utils.loadTree(tree), config), config) ?? undefined;
}

function flightSqlFromWhere(whereString: string): string {
  const query: SQLQuery = {
    refId: 'A',
    table: 'cpu',
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
  return toFlightSql(query);
}

describe('query builder WHERE identifier quoting', () => {
  it('quotes == filters on names that require quoting', () => {
    const whereString = toSql(ruleTree('MixedCase', 'equal', 'ok'));
    expect(whereString).toBe("MixedCase = 'ok'");
    expect(quoteSqlWhereIdentifiers(whereString!)).toBe(`"MixedCase" = 'ok'`);
    expect(flightSqlFromWhere(whereString!)).toContain(`"MixedCase" = 'ok'`);
  });

  it('quotes contains / LIKE filters the same way as ==', () => {
    const whereString = toSql(ruleTree('MixedCase', 'like', 'err'));
    expect(whereString).toBe("MixedCase LIKE '%err%'");
    expect(quoteSqlWhereIdentifiers(whereString!)).toBe(`"MixedCase" LIKE '%err%'`);
    expect(flightSqlFromWhere(whereString!)).toContain(`"MixedCase" LIKE '%err%'`);
  });

  it('quotes other LIKE-style operators that share the contains code path', () => {
    const notContains = toSql(ruleTree('cpu.usage', 'not_like', 'err'));
    expect(notContains).toBe("cpu.usage NOT LIKE '%err%'");
    expect(quoteSqlWhereIdentifiers(notContains!)).toBe(`"cpu.usage" NOT LIKE '%err%'`);

    const startsWith = toSql(ruleTree('host', 'starts_with', 'prod'));
    expect(startsWith).toBe("host LIKE 'prod%'");
    expect(quoteSqlWhereIdentifiers(startsWith!)).toBe(`"host" LIKE 'prod%'`);

    const endsWith = toSql(ruleTree('host', 'ends_with', 'prod'));
    expect(endsWith).toBe("host LIKE '%prod'");
    expect(quoteSqlWhereIdentifiers(endsWith!)).toBe(`"host" LIKE '%prod'`);
  });
});
