import { describe, expect, it } from 'vitest';
import type { DatabaseColumn, DatabaseRow, FilterGroup } from '@/types/database';
import { applyFilters } from './databaseFilter';

const columns: DatabaseColumn[] = [
  { id: 'title', name: 'Title', type: 'text' },
  { id: 'score', name: 'Score', type: 'number' },
  { id: 'due', name: 'Due', type: 'date' },
];

const rows: DatabaseRow[] = [
  {
    id: '1',
    notePath: 'a.md',
    noteTitle: 'Alpha',
    cells: { title: 'Alpha Task', score: 8, due: { start: '2026-02-10' } },
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: '2',
    notePath: 'b.md',
    noteTitle: 'Beta',
    cells: { title: 'Beta Plan', score: 5, due: { start: '2026-02-14' } },
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
];

function rule(operator: string, value: unknown) {
  return {
    id: 'r1',
    columnId:
      operator.startsWith('date_')
        ? 'due'
        : operator.includes('equal') || operator.includes('greater') || operator.includes('less')
          ? 'score'
          : 'title',
    operator: operator as any,
    value: value as any,
  };
}

function group(type: 'and' | 'or', rules: FilterGroup['rules']): FilterGroup {
  return { type, rules };
}

describe('databaseFilter high-frequency operators', () => {
  it('supports starts_with and ends_with with the expected matching rows', () => {
    expect(applyFilters(rows, group('and', [rule('starts_with', 'alpha')]), columns).map((row) => row.id)).toEqual(['1']);
    expect(applyFilters(rows, group('and', [rule('ends_with', 'plan')]), columns).map((row) => row.id)).toEqual(['2']);
  });

  it('supports greater_equal and less_equal with the expected matching rows', () => {
    expect(applyFilters(rows, group('and', [rule('greater_equal', 8)]), columns).map((row) => row.id)).toEqual(['1']);
    expect(applyFilters(rows, group('and', [rule('less_equal', 5)]), columns).map((row) => row.id)).toEqual(['2']);
  });

  it('supports date_before and date_after with the expected matching rows', () => {
    expect(applyFilters(rows, group('and', [rule('date_before', '2026-02-12')]), columns).map((row) => row.id)).toEqual(['1']);
    expect(applyFilters(rows, group('and', [rule('date_after', '2026-02-12')]), columns).map((row) => row.id)).toEqual(['2']);
  });

  it('supports or groups across multiple rules', () => {
    const result = applyFilters(
      rows,
      group('or', [rule('starts_with', 'alpha'), rule('date_after', '2026-02-12')]),
      columns,
    );

    expect(result.map((row) => row.id).sort()).toEqual(['1', '2']);
  });
});
