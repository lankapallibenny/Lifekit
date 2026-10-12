/**
 * LIFEKIT calculators.
 *
 * The expression evaluator is a small hand-written tokenizer + shunting-yard parser.
 * There is deliberately no `eval`, no `new Function` and no dynamic code generation
 * anywhere: a calculator is a user-input surface, so the parser accepts only digits,
 * a decimal point, four operators, parentheses, the percent sign and unary minus.
 * Anything else is rejected with a readable message.
 */

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' | 'u-' }
  | { kind: 'paren'; value: '(' | ')' }
  | { kind: 'percent' }
  | { kind: 'unary-minus' };

const MAX_INPUT = 240;
const MAX_ABS_VALUE = 1e15;

export function tokenize(input: string): { ok: true; tokens: Token[] } | { ok: false; error: string } {
  const tokens: Token[] = [];
  const text = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').replace(/\s+/g, '');
  if (text.length === 0) return { ok: false, error: 'Nothing to calculate yet.' };
  if (text.length > MAX_INPUT) return { ok: false, error: 'That expression is too long.' };

  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/[0-9.]/.test(char)) {
      let number = '';
      let dots = 0;
      while (index < text.length && /[0-9.]/.test(text[index])) {
        if (text[index] === '.') {
          dots++;
          if (dots > 1) return { ok: false, error: 'A number cannot contain two decimal points.' };
        }
        number += text[index];
        index++;
      }
      if (number === '.') return { ok: false, error: 'A decimal point needs a digit.' };
      const value = Number(number);
      if (!Number.isFinite(value)) return { ok: false, error: 'That number is too large.' };
      tokens.push({ kind: 'number', value });
      continue;
    }
    if (char === '+' || char === '*' || char === '/') {
      tokens.push({ kind: 'operator', value: char });
      index++;
      continue;
    }
    if (char === '-') {
      const previous = tokens[tokens.length - 1];
      const isUnary = !previous || previous.kind === 'operator' || (previous.kind === 'paren' && previous.value === '(');
      tokens.push(isUnary ? { kind: 'unary-minus' } : { kind: 'operator', value: '-' });
      index++;
      continue;
    }
    if (char === '%') {
      tokens.push({ kind: 'percent' });
      index++;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', value: char });
      index++;
      continue;
    }
    return { ok: false, error: `“${char}” is not something this calculator understands.` };
  }
  return { ok: true, tokens };
}

// Unary minus binds tighter than * and / so that -2*3 is (-2)*3 and -(3+4) negates the
// whole bracket. It is emitted as its own operator rather than rewriting to "0 - x",
// which would corrupt the operand order in postfix output.
const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3 };

/**
 * Evaluate an arithmetic expression. Supports + - * / , parentheses, decimals, unary
 * minus, and a postfix percent sign meaning "divide by 100" (so `200*10%` is 20).
 */
export function evaluate(expression: string): CalcResult {
  const tokenized = tokenize(expression);
  if (!tokenized.ok) return tokenized;
  const tokens = tokenized.tokens;

  const output: Token[] = [];
  const operators: Token[] = [];
  for (const token of tokens) {
    if (token.kind === 'number') {
      output.push(token);
      continue;
    }
    if (token.kind === 'percent') {
      // Postfix unary: applies to the previous value.
      output.push(token);
      continue;
    }
    if (token.kind === 'unary-minus') {
      // Prefix operator: right-associative, so only strictly higher precedence operators are
      // emitted first (none, as it sits at the top of the table).
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.kind === 'operator' && PRECEDENCE[top.value] > PRECEDENCE['u-']) {
          output.push(operators.pop() as Token);
        } else {
          break;
        }
      }
      operators.push({ kind: 'operator', value: 'u-' });
      continue;
    }
    if (token.kind === 'operator') {
      // Re-read the top of the stack on every iteration: holding it in a variable outside the
      // loop made the loop non-terminating once the stack emptied.
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.kind === 'operator' && PRECEDENCE[top.value] >= PRECEDENCE[token.value]) {
          output.push(operators.pop() as Token);
        } else {
          break;
        }
      }
      operators.push(token);
      continue;
    }
    if (token.kind === 'paren' && token.value === '(') {
      operators.push(token);
      continue;
    }
    // closing paren
    let foundOpen = false;
    while (operators.length > 0) {
      const popped = operators.pop() as Token;
      if (popped.kind === 'paren' && popped.value === '(') {
        foundOpen = true;
        break;
      }
      output.push(popped);
    }
    if (!foundOpen) return { ok: false, error: 'There is a closing bracket without an opening one.' };
  }
  while (operators.length > 0) {
    const popped = operators.pop() as Token;
    if (popped.kind === 'paren') return { ok: false, error: 'There is an unclosed bracket.' };
    output.push(popped);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (token.kind === 'number') {
      stack.push(token.value);
      continue;
    }
    if (token.kind === 'percent') {
      const value = stack.pop();
      if (value === undefined) return { ok: false, error: 'The percent sign needs a number before it.' };
      stack.push(value / 100);
      continue;
    }
    if (token.kind === 'operator' && token.value === 'u-') {
      const operand = stack.pop();
      if (operand === undefined) return { ok: false, error: 'That expression is incomplete.' };
      stack.push(-operand);
      continue;
    }
    if (token.kind === 'operator') {
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) {
        return { ok: false, error: 'That expression is incomplete.' };
      }
      let result = 0;
      switch (token.value) {
        case '+':
          result = left + right;
          break;
        case '-':
          result = left - right;
          break;
        case '*':
          result = left * right;
          break;
        case '/':
          if (right === 0) return { ok: false, error: 'Cannot divide by zero.' };
          result = left / right;
          break;
      }
      if (!Number.isFinite(result)) return { ok: false, error: 'The result is not a usable number.' };
      stack.push(result);
    }
  }

  if (stack.length !== 1) return { ok: false, error: 'That expression is incomplete.' };
  const value = stack[0];
  if (Math.abs(value) > MAX_ABS_VALUE) return { ok: false, error: 'The result is too large to display.' };
  return { ok: true, value: Math.round(value * 1e10) / 1e10 };
}

/* ------------------------------- percentage helpers ------------------------------- */

export function percentOf(percent: number, value: number): number {
  return round10((percent / 100) * value);
}

export function whatPercent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return round10((part / whole) * 100);
}

export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return round10(((to - from) / Math.abs(from)) * 100);
}

export function addPercent(value: number, percent: number): number {
  return round10(value * (1 + percent / 100));
}

export function subtractPercent(value: number, percent: number): number {
  return round10(value * (1 - percent / 100));
}

/** Two successive discounts multiply rather than add — worth surfacing in the UI. */
export function combinedDiscount(firstPercent: number, secondPercent: number): number {
  return round10(100 * (1 - (1 - firstPercent / 100) * (1 - secondPercent / 100)));
}

/* ------------------------------- savings goal maths ------------------------------- */

export interface SavingsPlan {
  monthlyRequired: number | null;
  monthsToTarget: number | null;
  totalContributions: number;
  target: number;
  gap: number;
}

/**
 * Plain arithmetic for a savings plan: no interest modelling, no projections presented as
 * returns. `monthlyRequired` is what a person would have to set aside each month to reach
 * the target in the given months; `monthsToTarget` is how long the given monthly amount
 * would take.
 */
export function savingsPlan(params: {
  target: number;
  current: number;
  months?: number | null;
  monthlyAmount?: number | null;
}): SavingsPlan {
  const target = Math.max(0, params.target);
  const current = Math.max(0, params.current);
  const gap = round10(Math.max(0, target - current));
  const months = params.months && params.months > 0 ? Math.floor(params.months) : null;
  const monthlyAmount = params.monthlyAmount && params.monthlyAmount > 0 ? params.monthlyAmount : null;

  return {
    target: round10(target),
    gap,
    totalContributions: round10(current),
    monthlyRequired: gap === 0 ? 0 : months ? round10(gap / months) : null,
    // A met target always reports zero months remaining, whether or not a monthly amount
    // was supplied. Otherwise the estimate needs a monthly amount to divide by.
    monthsToTarget: gap === 0 ? 0 : monthlyAmount ? Math.ceil(gap / monthlyAmount) : null,
  };
}

/** Average monthly amount from a list of dated contributions, for pace estimates. */
export function averageMonthly(contributions: { amount: number; date: string }[], now = new Date()): number | null {
  if (contributions.length === 0) return null;
  const dates = contributions
    .map((c) => new Date(`${c.date}T00:00:00`))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return null;
  const first = dates[0];
  const last = now > dates[dates.length - 1] ? now : dates[dates.length - 1];
  const months = Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1);
  const total = contributions.reduce((sum, c) => sum + (Number.isFinite(c.amount) ? c.amount : 0), 0);
  return round10(total / months);
}

function round10(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}
