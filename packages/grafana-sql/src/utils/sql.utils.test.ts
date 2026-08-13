import { QueryEditorExpressionType } from '../expressions';

import { createSelectClause, haveColumns } from './sql.utils';

describe('createSelectClause', () => {
  it('omits missing function parameters', () => {
    expect(
      createSelectClause([
        {
          type: QueryEditorExpressionType.Function,
          name: 'count',
        },
      ])
    ).toBe('SELECT count() ');
  });

  it('omits unnamed parameter stubs', () => {
    expect(
      createSelectClause([
        {
          type: QueryEditorExpressionType.Function,
          name: 'count',
          parameters: [{ type: QueryEditorExpressionType.FunctionParameter }],
        },
      ])
    ).toBe('SELECT count() ');
  });
});

describe('haveColumns', () => {
  it('returns false for empty parameter stubs', () => {
    expect(
      haveColumns([
        {
          type: QueryEditorExpressionType.Function,
          parameters: [{ type: QueryEditorExpressionType.FunctionParameter }],
        },
      ])
    ).toBe(false);
  });

  it('returns true for a named parameter', () => {
    expect(
      haveColumns([
        {
          type: QueryEditorExpressionType.Function,
          parameters: [{ type: QueryEditorExpressionType.FunctionParameter, name: 'host' }],
        },
      ])
    ).toBe(true);
  });

  it('returns true for a named function', () => {
    expect(
      haveColumns([
        {
          type: QueryEditorExpressionType.Function,
          name: 'count',
        },
      ])
    ).toBe(true);
  });
});
