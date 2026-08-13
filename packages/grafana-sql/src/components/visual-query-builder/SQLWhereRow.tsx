import { useAsync } from 'react-use';

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
  const state = useAsync(async () => {
    return mapFieldsToTypes(fields);
  }, [fields]);

  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return (
    <WhereRow
      // TODO: fix key that's used to force clean render or SQLWhereRow - otherwise it doesn't render operators correctly
      key={JSON.stringify(state.value)}
      config={{ fields: state.value || {} }}
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
  if (!val.whereString) {
    return;
  }

  let whereString = val.whereString;

  for (const tv of templateVars) {
    if (!('multi' in tv) || !tv.multi) {
      continue;
    }

    // Only unwrap quotes that the query builder wraps around the multi-value
    // variable itself. A global replace of "('" / "')" would also rewrite
    // unrelated string literals in the same WHERE clause.
    for (const variableSyntax of [`\${${tv.name}}`, `$${tv.name}`]) {
      if (whereString.includes(variableSyntax)) {
        whereString = whereString.replaceAll(`('${variableSyntax}')`, `(${variableSyntax})`);
      }
    }
  }

  val.whereString = whereString;
}
