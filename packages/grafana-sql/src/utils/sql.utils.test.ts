import {
  QueryEditorExpressionType,
  type QueryEditorFunctionExpression,
  type QueryEditorFunctionParameterExpression,
} from '../expressions';

import { createSelectClause, haveColumns } from './sql.utils';

function param(name?: string): QueryEditorFunctionParameterExpression {
  return { type: QueryEditorExpressionType.FunctionParameter, name };
}

function column(props: Omit<QueryEditorFunctionExpression, 'type'>): QueryEditorFunctionExpression {
  return { type: QueryEditorExpressionType.Function, ...props };
}

describe('createSelectClause', () => {
  it('emits empty arguments for a function without parameters', () => {
    expect(createSelectClause([column({ name: 'count' })])).toBe('SELECT count() ');
  });

  it('emits empty arguments for a function whose only parameter is unnamed', () => {
    expect(createSelectClause([column({ name: 'count', parameters: [param()] })])).toBe('SELECT count() ');
  });

  it('never emits the identifier undefined', () => {
    expect(createSelectClause([column({ name: 'count' }), column({ parameters: [param()] })])).not.toContain(
      'undefined'
    );
  });

  it('emits named parameters as function arguments', () => {
    expect(createSelectClause([column({ name: 'sum', parameters: [param('amount')] })])).toBe('SELECT sum(amount) ');
  });

  it('skips unnamed parameters but keeps named ones', () => {
    expect(createSelectClause([column({ name: 'sum', parameters: [param('amount'), param()] })])).toBe(
      'SELECT sum(amount) '
    );
  });

  it('emits function, parameters and alias', () => {
    expect(
      createSelectClause([
        column({ name: '$__timeGroup', alias: 'time', parameters: [param('createdAt'), param('$__interval')] }),
      ])
    ).toBe('SELECT $__timeGroup(createdAt,$__interval) AS time ');
  });

  it('emits a bare column when there is no function name', () => {
    expect(createSelectClause([column({ parameters: [param('host')] })])).toBe('SELECT host ');
    expect(createSelectClause([column({ alias: '"h"', parameters: [param('host')] })])).toBe('SELECT host AS "h" ');
  });

  it('joins multiple columns', () => {
    expect(createSelectClause([column({ parameters: [param('host')] }), column({ name: 'count' })])).toBe(
      'SELECT host, count() '
    );
  });
});

describe('haveColumns', () => {
  it('is false for missing or empty columns', () => {
    expect(haveColumns(undefined)).toBe(false);
    expect(haveColumns([])).toBe(false);
  });

  it('is false when the only parameter is an empty stub', () => {
    expect(haveColumns([column({ parameters: [param()] })])).toBe(false);
  });

  it('is true when a parameter has a name', () => {
    expect(haveColumns([column({ parameters: [param('host')] })])).toBe(true);
  });

  it('is true when a column has a function name', () => {
    expect(haveColumns([column({ name: 'count' })])).toBe(true);
  });
});
