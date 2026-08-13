import { useMemo } from 'react';

import { type SelectableValue, type TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { type QueryWithDefaults } from '../../defaults';
import { type DB, type SQLExpression, type SQLQuery, type SQLSelectableValue } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { type Config } from './AwesomeQueryBuilder';
import { WhereRow } from './WhereRow';

interface WhereRowProps {
  query: QueryWithDefaults;
  fields: SelectableValue[];
  onQueryChange: (query: SQLQuery) => void;
  db: DB;
}

export function SQLWhereRow({ query, fields, onQueryChange, db }: WhereRowProps) {
  // Stabilize on field contents: the parent often passes a new [] while columns load.
  const fieldsKey = useMemo(
    () => JSON.stringify(fields.map((f) => [f.value, f.raqbFieldType, f.icon])),
    [fields]
  );
  const config = useMemo(
    () => ({ fields: mapFieldsToTypes(fields) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fieldsKey fingerprints column metadata
    [fieldsKey]
  );

  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return (
    <WhereRow
      config={config}
      sql={query.sql!}
      onSqlChange={(val: SQLExpression) => {
        const templateVars = getTemplateSrv().getVariables();

        removeQuotesForMultiVariables(val, templateVars);

        onSqlChange(val);
      }}
    />
  );
}

// needed for awesome query builder
function mapFieldsToTypes(columns: SQLSelectableValue[]) {
  const fields: Config['fields'] = {};
  for (const col of columns) {
    fields[col.value] = {
      type: col.raqbFieldType || 'text',
      valueSources: ['value'],
      mainWidgetProps: { customProps: { icon: col.icon } },
    };
  }
  return fields;
}

export function removeQuotesForMultiVariables(val: SQLExpression, templateVars: TypedVariableModel[]) {
  const multiVariableInWhereString = (tv: TypedVariableModel) =>
    'multi' in tv &&
    tv.multi &&
    (val.whereString?.includes(`\${${tv.name}}`) || val.whereString?.includes(`$${tv.name}`));

  if (templateVars.some((tv) => multiVariableInWhereString(tv))) {
    val.whereString = val.whereString?.replaceAll("')", ')');
    val.whereString = val.whereString?.replaceAll("('", '(');
  }
}
