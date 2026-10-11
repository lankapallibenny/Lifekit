/**
 * Calculator, percentage and converter tests.
 *
 * The evaluator is a user-input surface, so the tests deliberately include hostile input:
 * attempts to inject JavaScript, unbalanced brackets, division by zero, absurdly large
 * numbers and non-numeric characters. Any of these must produce a readable error rather
 * than an exception or a wrong number.
 */
import { describe, expect, it } from 'vitest';
import {
  addPercent,
  averageMonthly,
  combinedDiscount,
  evaluate,
  percentChange,
  percentOf,
  savingsPlan,
  subtractPercent,
  tokenize,
  whatPercent,
} from '../src/lib/calc';
import { UNIT_CATEGORIES, convertUnit, formatNumber, roundSignificant } from '../src/lib/units';

const value = (expression: string): number => {
  const result = evaluate(expression);
  if (!result.ok) throw new Error(`expected success for ${expression}: ${result.error}`);
  return result.value;
};

describe('calculator evaluation', () => {
  it('handles the four operations with correct precedence', () => {
    expect(value('2+3*4')).toBe(14);
    expect(value('(2+3)*4')).toBe(20);
    expect(value('100/4/5')).toBe(5);
    expect(value('10-2-3')).toBe(5);
    expect(value('2*3+4*5')).toBe(26);
  });

  it('handles decimals', () => {
    expect(value('0.1+0.2')).toBeCloseTo(0.3, 10);
    expect(value('19.99*3')).toBeCloseTo(59.97, 10);
    expect(value('.5+.5')).toBe(1);
  });

  it('supports unary minus in every reasonable position', () => {
    expect(value('-5+10')).toBe(5);
    expect(value('10*-2')).toBe(-20);
    expect(value('-(3+4)')).toBe(-7);
    expect(value('10--5')).toBe(15);
  });

  it('treats percent as "divide by 100"', () => {
    expect(value('50%')).toBe(0.5);
    expect(value('200*10%')).toBe(20);
    expect(value('1000-15%')).toBeCloseTo(999.85, 10);
  });

  it('accepts the multiply and divide symbols people see on keyboards', () => {
    expect(value('6×7')).toBe(42);
    expect(value('84÷2')).toBe(42);
  });

  it('ignores digit grouping commas', () => {
    expect(value('1,00,000+1')).toBe(100001);
  });

  it('rejects non-numeric and dangerous input instead of executing anything', () => {
    const hostile = [
      'alert(1)',
      'window.location="http://evil.example"',
      'process.exit(1)',
      'fetch("/api")',
      '2**8',
      'Math.max(1,2)',
      '[1,2,3]',
      '{a:1}',
      '1;2',
      '`${1}`',
      '1e10000',
    ];
    for (const input of hostile) {
      const result = evaluate(input);
      expect(result.ok, `expected ${input} to be rejected`).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(5);
    }
  });

  it('reports structural mistakes with readable messages', () => {
    expect(evaluate('2+').ok).toBe(false);
    expect(evaluate('(2+3').ok).toBe(false);
    expect(evaluate('2+3)').ok).toBe(false);
    expect(evaluate('10/0').ok).toBe(false);
    expect(evaluate('').ok).toBe(false);
    expect(evaluate('   ').ok).toBe(false);
    expect(evaluate('1.2.3').ok).toBe(false);
    expect(evaluate('.').ok).toBe(false);
  });

  it('caps absurd input rather than hanging', () => {
    expect(evaluate('9'.repeat(300)).ok).toBe(false);
    expect(evaluate('999999999999999999*999999999999999999').ok).toBe(false);
  });

  it('tokenizes a normal expression into the expected shape', () => {
    const result = tokenize('12+3');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens).toHaveLength(3);
      expect(result.tokens[0]).toEqual({ kind: 'number', value: 12 });
    }
  });
});

describe('percentage helpers', () => {
  it('finds a percentage of a value', () => {
    expect(percentOf(15, 2400)).toBe(360);
    expect(percentOf(7.5, 900)).toBe(67.5);
    expect(percentOf(0, 500)).toBe(0);
  });

  it('finds what percent one number is of another', () => {
    expect(whatPercent(25, 200)).toBe(12.5);
    expect(whatPercent(1, 3)).toBeCloseTo(33.3333333333, 8);
    expect(whatPercent(5, 0)).toBeNull();
  });

  it('computes percentage change in both directions', () => {
    expect(percentChange(200, 250)).toBe(25);
    expect(percentChange(250, 200)).toBe(-20);
    expect(percentChange(0, 10)).toBeNull();
  });

  it('applies and removes percentages', () => {
    expect(addPercent(1000, 18)).toBeCloseTo(1180, 10);
    expect(subtractPercent(2000, 30)).toBe(1400);
  });

  it('shows that successive discounts multiply rather than add', () => {
    expect(combinedDiscount(20, 20)).toBe(36);
    expect(combinedDiscount(10, 10)).toBe(19);
    expect(combinedDiscount(0, 0)).toBe(0);
  });
});

describe('savings plan arithmetic', () => {
  it('divides the gap evenly across the months given', () => {
    const plan = savingsPlan({ target: 60000, current: 0, months: 12 });
    expect(plan.gap).toBe(60000);
    expect(plan.monthlyRequired).toBe(5000);
  });

  it('accounts for money already saved', () => {
    const plan = savingsPlan({ target: 60000, current: 20000, months: 10 });
    expect(plan.gap).toBe(40000);
    expect(plan.monthlyRequired).toBe(4000);
  });

  it('reports zero required when the target is met, and never a negative gap', () => {
    const plan = savingsPlan({ target: 10000, current: 15000, months: 6 });
    expect(plan.gap).toBe(0);
    expect(plan.monthlyRequired).toBe(0);
    expect(plan.monthsToTarget).toBe(0);
  });

  it('estimates months from a monthly amount and rounds up', () => {
    const plan = savingsPlan({ target: 10000, current: 0, monthlyAmount: 3000 });
    expect(plan.monthsToTarget).toBe(4);
  });

  it('refuses to divide by zero or by non-positive inputs', () => {
    expect(savingsPlan({ target: 1000, current: 0, months: 0 }).monthlyRequired).toBeNull();
    expect(savingsPlan({ target: 1000, current: 0, monthlyAmount: 0 }).monthsToTarget).toBeNull();
  });

  it('averages contributions over the months they span', () => {
    const average = averageMonthly(
      [
        { amount: 1000, date: '2026-08-01' },
        { amount: 1000, date: '2026-09-01' },
        { amount: 1000, date: '2026-10-01' },
      ],
      new Date('2026-10-15T00:00:00')
    );
    expect(average).toBe(1000);
    expect(averageMonthly([], new Date())).toBeNull();
  });
});

describe('unit conversion', () => {
  it('converts length units exactly', () => {
    expect(convertUnit('length', 1, 'km', 'm')).toBe(1000);
    expect(convertUnit('length', 1, 'mile', 'km')).toBeCloseTo(1.609344, 6);
    expect(convertUnit('length', 12, 'inch', 'foot')).toBeCloseTo(1, 6);
  });

  it('converts mass units', () => {
    expect(convertUnit('mass', 1, 'kg', 'g')).toBe(1000);
    expect(convertUnit('mass', 1, 'pound', 'kg')).toBeCloseTo(0.45359237, 8);
    expect(convertUnit('mass', 1, 'quintal', 'kg')).toBe(100);
  });

  it('converts temperature with the correct offsets', () => {
    expect(convertUnit('temperature', 0, 'celsius', 'fahrenheit')).toBe(32);
    expect(convertUnit('temperature', 100, 'celsius', 'fahrenheit')).toBe(212);
    expect(convertUnit('temperature', 32, 'fahrenheit', 'celsius')).toBe(0);
    expect(convertUnit('temperature', 0, 'celsius', 'kelvin')).toBeCloseTo(273.15, 6);
    expect(convertUnit('temperature', -40, 'celsius', 'fahrenheit')).toBeCloseTo(-40, 6);
  });

  it('converts Indian land units used in property paperwork', () => {
    expect(convertUnit('area', 1, 'acre', 'cent')).toBeCloseTo(100, 4);
    expect(convertUnit('area', 1, 'acre', 'guntha')).toBeCloseTo(40, 3);
    expect(convertUnit('area', 1, 'hectare', 'sqm')).toBe(10000);
  });

  it('converts data using binary multiples', () => {
    expect(convertUnit('data', 1, 'gb', 'mb')).toBe(1024);
    expect(convertUnit('data', 1, 'mb', 'kb')).toBe(1024);
  });

  it('converts time and speed', () => {
    expect(convertUnit('time', 1, 'hour', 'minute')).toBe(60);
    expect(convertUnit('time', 1, 'day', 'hour')).toBe(24);
    expect(convertUnit('speed', 36, 'kph', 'mps')).toBeCloseTo(10, 6);
  });

  it('is self-consistent in both directions', () => {
    for (const category of UNIT_CATEGORIES) {
      const [first, second] = category.units;
      const forward = convertUnit(category.id, 7.5, first.id, second.id);
      expect(forward).not.toBeNull();
      const back = convertUnit(category.id, forward as number, second.id, first.id);
      expect(back).toBeCloseTo(7.5, 3);
    }
  });

  it('rejects unknown units and non-finite values', () => {
    expect(convertUnit('length', 1, 'parsec', 'm')).toBeNull();
    expect(convertUnit('length', Number.NaN, 'm', 'km')).toBeNull();
  });

  it('keeps results readable', () => {
    expect(roundSignificant(123456789)).toBe(123457000);
    expect(roundSignificant(0)).toBe(0);
    expect(formatNumber(1 / 3, 4)).toBe('0.3333');
    expect(formatNumber(1234.5678)).toBe('1,234.57');
  });
});
