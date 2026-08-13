import { QueryEditorExpressionType, type QueryEditorFunctionExpression } from '../expressions';

import { createSelectClause, haveColumns } from './sql.utils';

function column(partial: Partial<Omit<QueryEditorFunctionExpression, 'type'>>): QueryEditorFunctionExpression {
  return { type: QueryEditorExpressionType.Function, ...partial };
}

function parameter(name?: string) {
  return { type: QueryEditorExpressionType.FunctionParameter as const, name };
}

describe('createSelectClause', () => {
  it('emits empty args for a function without parameters', () => {
    expect(createSelectClause([column({ name: 'count' })])).toBe('SELECT count() ');
  });

  it('emits empty args for a function with unnamed parameter stubs', () => {
    expect(createSelectClause([column({ name: 'count', parameters: [parameter()] })])).toBe('SELECT count() ');
  });

  it('skips unnamed parameters but keeps named ones', () => {
    expect(createSelectClause([column({ name: 'sum', parameters: [parameter(), parameter('bytes')] })])).toBe(
      'SELECT sum(bytes) '
    );
  });

  it('renders a function with several named parameters', () => {
    expect(createSelectClause([column({ name: 'concat', parameters: [parameter('host'), parameter('path')] })])).toBe(
      'SELECT concat(host,path) '
    );
  });

  it('renders an alias with and without a function name', () => {
    expect(createSelectClause([column({ name: 'count', alias: '"total"' })])).toBe('SELECT count() AS "total" ');
    expect(createSelectClause([column({ alias: '"h"', parameters: [parameter('host')] })])).toBe('SELECT host AS "h" ');
  });

  it('renders a bare column and joins multiple columns', () => {
    expect(
      createSelectClause([
        column({ parameters: [parameter('host')] }),
        column({ name: 'count', parameters: [parameter()] }),
      ])
    ).toBe('SELECT host, count() ');
  });

  it('never emits the identifier undefined for empty stubs', () => {
    expect(createSelectClause([column({})])).not.toContain('undefined');
    expect(createSelectClause([column({ parameters: [parameter()] })])).not.toContain('undefined');
    expect(createSelectClause([column({ name: 'count' })])).not.toContain('undefined');
  });
});

describe('haveColumns', () => {
  it('is false when there are no columns', () => {
    expect(haveColumns(undefined)).toBe(false);
    expect(haveColumns([])).toBe(false);
  });

  it('is false for an empty parameter stub', () => {
    expect(haveColumns([column({ parameters: [parameter()] })])).toBe(false);
    expect(haveColumns([column({})])).toBe(false);
  });

  it('is true when a parameter is named', () => {
    expect(haveColumns([column({ parameters: [parameter('host')] })])).toBe(true);
  });

  it('is true when a function name is set', () => {
    expect(haveColumns([column({ name: 'count' })])).toBe(true);
    expect(haveColumns([column({ name: 'count', parameters: [parameter()] })])).toBe(true);
  });
});
