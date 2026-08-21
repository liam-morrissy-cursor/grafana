import '@testing-library/jest-dom';
import { type JsonTree, Utils } from '@react-awesome-query-builder/ui';
import { render, screen, waitFor } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { type SQLExpression } from '../../types';

import { WhereRow } from './WhereRow';

function ruleTree(field: string, operator: string, value: string): JsonTree {
  return {
    id: Utils.uuid(),
    type: 'group',
    children1: [
      {
        type: 'rule',
        properties: {
          field,
          operator,
          value: [value],
          valueSrc: ['value'],
          valueType: ['text'],
        },
      },
    ],
  };
}

const hostnameFields = {
  hostname: {
    type: 'text' as const,
    valueSources: ['value' as const],
  },
};

describe('WhereRow', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    // RAQB logs when checkTree drops rules for unknown fields (empty metadata).
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('restores field and operator after column metadata loads without a remount key', async () => {
    const whereJsonTree = ruleTree('hostname', 'equal', 'server-1');
    const sql: SQLExpression = {
      whereJsonTree,
      whereString: "hostname = 'server-1'",
    };
    const onSqlChange = jest.fn();

    const { rerender } = render(<WhereRow sql={sql} config={{ fields: {} }} onSqlChange={onSqlChange} />);

    // Empty fields cause RAQB to delete the rule from the in-memory tree — the bug the
    // old JSON.stringify remount key papered over.
    expect(warnSpy).toHaveBeenCalled();

    rerender(<WhereRow sql={sql} config={{ fields: hostnameFields }} onSqlChange={onSqlChange} />);

    await waitFor(() => {
      expect(screen.getByTestId(selectors.components.SQLQueryEditor.filterField)).toHaveTextContent('hostname');
    });

    // Operator select should be populated again from the persisted whereJsonTree.
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.filterOperator)).not.toBeEmptyDOMElement();
  });

  it('does not clear persisted where state when fields load', async () => {
    const whereJsonTree = ruleTree('hostname', 'equal', 'server-1');
    const sql: SQLExpression = {
      whereJsonTree,
      whereString: "hostname = 'server-1'",
    };
    const onSqlChange = jest.fn();

    const { rerender } = render(<WhereRow sql={sql} config={{ fields: {} }} onSqlChange={onSqlChange} />);
    rerender(<WhereRow sql={sql} config={{ fields: hostnameFields }} onSqlChange={onSqlChange} />);

    await waitFor(() => {
      expect(screen.getByTestId(selectors.components.SQLQueryEditor.filterField)).toHaveTextContent('hostname');
    });

    const wiped = onSqlChange.mock.calls.some(([next]: [SQLExpression]) => {
      const tree = next.whereJsonTree as JsonTree | undefined;
      const children = tree && 'children1' in tree ? tree.children1 : undefined;
      const emptyChildren =
        children == null || (Array.isArray(children) && children.length === 0) || Object.keys(children ?? {}).length === 0;
      return next.whereString === '' || next.whereString == null || emptyChildren;
    });
    expect(wiped).toBe(false);
  });
});
