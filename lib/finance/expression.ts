/** Evaluates the given form field as an amount expression and, on success,
 * replaces it in place with the resolved number so the server action
 * receives a clean numeric string exactly as it did before this field
 * supported expressions. Returns an error message on failure (empty,
 * unparsable, or negative), or null on success. */
export function resolveAmountField(
  formData: FormData,
  fieldName: string,
  fieldLabel: string,
): string | null {
  const raw = formData.get(fieldName);
  const text = typeof raw === "string" ? raw : "";
  const value = evaluateAmountExpression(text);
  if (value === null) {
    return `${fieldLabel} must be a number or a simple expression like 1200+300`;
  }
  if (value < 0) {
    return `${fieldLabel} can't be negative`;
  }
  formData.set(fieldName, String(value));
  return null;
}

/** Evaluates a plain number or a simple arithmetic expression typed into an
 * amount field, e.g. "1223+2341" or "=1223+2341" (spreadsheet-style leading
 * "="). Supports +, -, *, /, parentheses, and decimals. Returns null for
 * empty input, invalid syntax, or a non-finite result (e.g. divide by
 * zero) — deliberately hand-rolled instead of eval()/Function() so a typed
 * amount can never execute arbitrary code. */
export function evaluateAmountExpression(raw: string): number | null {
  const input = raw.trim().replace(/^=/, "").trim();
  if (input === "") return null;
  if (!/^[0-9+\-*/(). \t]*$/.test(input)) return null;

  try {
    const parser = new ExpressionParser(input);
    const value = parser.parseExpression();
    parser.expectEnd();
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  } catch {
    return null;
  }
}

class ExpressionParser {
  private pos = 0;
  constructor(private readonly input: string) {}

  parseExpression(): number {
    let value = this.parseTerm();
    for (;;) {
      this.skipSpaces();
      const op = this.input[this.pos];
      if (op === "+" || op === "-") {
        this.pos++;
        const rhs = this.parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      } else break;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    for (;;) {
      this.skipSpaces();
      const op = this.input[this.pos];
      if (op === "*" || op === "/") {
        this.pos++;
        const rhs = this.parseFactor();
        value = op === "*" ? value * rhs : value / rhs;
      } else break;
    }
    return value;
  }

  private parseFactor(): number {
    this.skipSpaces();
    const c = this.input[this.pos];
    if (c === "-") {
      this.pos++;
      return -this.parseFactor();
    }
    if (c === "+") {
      this.pos++;
      return this.parseFactor();
    }
    if (c === "(") {
      this.pos++;
      const value = this.parseExpression();
      this.skipSpaces();
      if (this.input[this.pos] !== ")") throw new Error("Expected )");
      this.pos++;
      return value;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipSpaces();
    const start = this.pos;
    while (this.isDigit(this.input[this.pos])) this.pos++;
    if (this.input[this.pos] === ".") {
      this.pos++;
      while (this.isDigit(this.input[this.pos])) this.pos++;
    }
    if (this.pos === start) throw new Error("Expected number");
    return Number(this.input.slice(start, this.pos));
  }

  private isDigit(c: string | undefined): boolean {
    return c !== undefined && c >= "0" && c <= "9";
  }

  private skipSpaces() {
    while (this.input[this.pos] === " " || this.input[this.pos] === "\t") {
      this.pos++;
    }
  }

  expectEnd() {
    this.skipSpaces();
    if (this.pos !== this.input.length) {
      throw new Error("Unexpected trailing characters");
    }
  }
}
