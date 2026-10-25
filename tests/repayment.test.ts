import { describe, expect, it } from 'vitest';
import { estimateRepayment } from '../src/lib/intelligence';

describe('estimateRepayment', () => {
  it('handles a zero-interest balance and a smaller final payment', () => {
    const result = estimateRepayment(1000, 0, 600);
    expect(result).toMatchObject({ months: 2, totalInterest: 0, totalPaid: 1000, verdict: 'ok' });
  });

  it('adds separately-paid monthly fees to total outlay without using them to reduce debt', () => {
    const result = estimateRepayment(1000, 0, 600, 25);
    expect(result).toMatchObject({ months: 2, totalInterest: 0, totalPaid: 1050, verdict: 'ok' });
  });

  it('reports the monthly interest when the payment cannot reduce the balance', () => {
    const result = estimateRepayment(1000, 12, 10);
    expect(result.verdict).toBe('tooSmall');
    expect(result.monthlyInterest).toBe(10);
    expect(result.months).toBeNull();
  });

  it('calculates interest over the reducing balance', () => {
    const result = estimateRepayment(1000, 12, 100);
    expect(result.verdict).toBe('ok');
    expect(result.months).toBe(11);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.totalPaid).toBeCloseTo(1000 + (result.totalInterest ?? 0));
  });

  it('limits impractically long estimates and rejects invalid inputs', () => {
    expect(estimateRepayment(1000, 12, 10.00001).verdict).toBe('tooLong');
    expect(estimateRepayment(0, 12, 100).verdict).toBe('invalid');
    expect(estimateRepayment(1000, 12, 100, -1).verdict).toBe('invalid');
  });
});
