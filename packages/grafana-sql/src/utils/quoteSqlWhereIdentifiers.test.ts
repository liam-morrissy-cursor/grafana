import { quoteSqlWhereIdentifiers } from './quoteSqlWhereIdentifiers';

describe('quoteSqlWhereIdentifiers', () => {
  it('quotes field names for == / = filters (no regression)', () => {
    expect(quoteSqlWhereIdentifiers(`(sensor_id = '12' AND sensor_id = '23')`)).toBe(
      `("sensor_id" = '12' AND "sensor_id" = '23')`
    );
  });

  it('quotes field names that require quoting for = filters', () => {
    expect(quoteSqlWhereIdentifiers(`(MixedCase = 'ok')`)).toBe(`("MixedCase" = 'ok')`);
    expect(quoteSqlWhereIdentifiers(`(cpu.usage = '1')`)).toBe(`("cpu.usage" = '1')`);
  });

  it('quotes field names for contains / LIKE-style filters', () => {
    expect(quoteSqlWhereIdentifiers(`(MixedCase LIKE '%err%')`)).toBe(`("MixedCase" LIKE '%err%')`);
    expect(quoteSqlWhereIdentifiers(`(cpu.usage LIKE '%err%')`)).toBe(`("cpu.usage" LIKE '%err%')`);
    expect(quoteSqlWhereIdentifiers(`(host NOT LIKE '%prod%')`)).toBe(`("host" NOT LIKE '%prod%')`);
    expect(quoteSqlWhereIdentifiers(`(region ILIKE '%us%')`)).toBe(`("region" ILIKE '%us%')`);
    expect(quoteSqlWhereIdentifiers(`(region NOT ILIKE '%eu%')`)).toBe(`("region" NOT ILIKE '%eu%')`);
  });

  it('quotes field names for other comparison and IN operators', () => {
    expect(quoteSqlWhereIdentifiers(`(value != 1)`)).toBe(`("value" != 1)`);
    expect(quoteSqlWhereIdentifiers(`(value <> 1)`)).toBe(`("value" <> 1)`);
    expect(quoteSqlWhereIdentifiers(`(value >= 1)`)).toBe(`("value" >= 1)`);
    expect(quoteSqlWhereIdentifiers(`(host IN ('a', 'b'))`)).toBe(`("host" IN ('a', 'b'))`);
    expect(quoteSqlWhereIdentifiers(`(host NOT IN ('a'))`)).toBe(`("host" NOT IN ('a'))`);
  });

  it('does not double-quote already quoted identifiers', () => {
    expect(quoteSqlWhereIdentifiers(`("MixedCase" = 'ok')`)).toBe(`("MixedCase" = 'ok')`);
    expect(quoteSqlWhereIdentifiers(`("MixedCase" LIKE '%err%')`)).toBe(`("MixedCase" LIKE '%err%')`);
  });

  it('supports an alternate quote character', () => {
    expect(quoteSqlWhereIdentifiers(`(MixedCase LIKE '%err%')`, '`')).toBe('(`MixedCase` LIKE \'%err%\')');
  });
});
