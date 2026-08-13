import { injectGlobal } from '@emotion/css';
import { Builder, type Config, type ImmutableTree, Query, Utils } from '@react-awesome-query-builder/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type SQLExpression } from '../../types';

import { emptyInitTree, raqbConfig } from './AwesomeQueryBuilder';

interface SQLBuilderWhereRowProps {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  config?: Partial<Config>;
}

function fieldsFingerprint(fields: Config['fields'] | undefined): string {
  return JSON.stringify(fields ?? {});
}

export function WhereRow({ sql, config, onSqlChange }: SQLBuilderWhereRowProps) {
  const [tree, setTree] = useState<ImmutableTree>();
  const configWithDefaults = useMemo(() => ({ ...raqbConfig, ...config }), [config]);
  const fieldsKey = fieldsFingerprint(config?.fields);
  const prevFieldsKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Set the initial tree
    if (!tree) {
      const initTree = Utils.checkTree(Utils.loadTree(sql.whereJsonTree ?? emptyInitTree), configWithDefaults);
      setTree(initTree);
    }
  }, [configWithDefaults, sql.whereJsonTree, tree]);

  useEffect(() => {
    if (!sql.whereJsonTree) {
      setTree(Utils.checkTree(Utils.loadTree(emptyInitTree), configWithDefaults));
    }
  }, [configWithDefaults, sql.whereJsonTree]);

  // When column metadata loads (or otherwise changes), re-validate from the persisted
  // whereJsonTree. RAQB may have stripped operators while fields were empty; reloading
  // from sql restores them without remounting the editor (which wiped in-progress edits).
  useEffect(() => {
    if (prevFieldsKey.current === undefined) {
      prevFieldsKey.current = fieldsKey;
      return;
    }
    if (prevFieldsKey.current === fieldsKey) {
      return;
    }
    prevFieldsKey.current = fieldsKey;
    setTree(Utils.checkTree(Utils.loadTree(sql.whereJsonTree ?? emptyInitTree), configWithDefaults));
  }, [configWithDefaults, fieldsKey, sql.whereJsonTree]);

  const onTreeChange = useCallback(
    (changedTree: ImmutableTree, config: Config) => {
      setTree(changedTree);
      const newSql = {
        ...sql,
        whereJsonTree: Utils.getTree(changedTree),
        whereString: Utils.sqlFormat(changedTree, config),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  if (!tree) {
    return null;
  }

  return (
    <Query
      {...configWithDefaults}
      value={tree}
      onChange={onTreeChange}
      renderBuilder={(props) => <Builder {...props} />}
    />
  );
}

function flex(direction: string) {
  return `
    display: flex;
    gap: 8px;
    flex-direction: ${direction};`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
injectGlobal`
  .group--header {
    ${flex('row')}
  }

  .group-or-rule {
    ${flex('column')}
    .rule {
      flex-direction: row;
    }
  }

  .rule--body {
    ${flex('row')}
  }

  .group--children {
    ${flex('column')}
  }

  .group--conjunctions:empty {
    display: none;
  }
`;
