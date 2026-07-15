// Tuliprox-inspired boolean/regex filter DSL for playlist filtering.
//
// Grammar (case-insensitive operators):
//   expr      := term (OR term)*
//   term      := factor (AND factor)*
//   factor    := NOT factor | '(' expr ')' | predicate
//   predicate := field OP "regex"
//   field     := Name | Group | Url | Logo | Quality | Country
//   OP        := ~ (matches) | !~ (does not match)
//
// Examples:
//   Group ~ "^News.*"
//   Name ~ ".*NBA.*" AND NOT Group ~ ".*XXX.*"
//   (Group ~ "^Sports.*" OR Name ~ ".*World Cup.*") AND NOT Country ~ "US"
//
// Empty string = pass-through (everything matches).

export type FilterField = 'name' | 'group' | 'url' | 'logo' | 'quality' | 'country'

type Token =
  | { kind: 'LPAREN' }
  | { kind: 'RPAREN' }
  | { kind: 'AND' }
  | { kind: 'OR' }
  | { kind: 'NOT' }
  | { kind: 'FIELD'; value: FilterField }
  | { kind: 'MATCH' }       // ~
  | { kind: 'NMATCH' }      // !~
  | { kind: 'REGEX'; value: string }

function tokenize(s: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = s.length

  while (i < n) {
    const c = s[i]

    // Skip whitespace
    if (/\s/.test(c)) {
      i++
      continue
    }

    if (c === '(') { tokens.push({ kind: 'LPAREN' }); i++; continue }
    if (c === ')') { tokens.push({ kind: 'RPAREN' }); i++; continue }
    if (c === '~') { tokens.push({ kind: 'MATCH' }); i++; continue }
    if (c === '!' && s[i + 1] === '~') { tokens.push({ kind: 'NMATCH' }); i += 2; continue }

    // Quoted regex
    if (c === '"' || c === "'") {
      const quote = c
      i++
      let body = ''
      while (i < n && s[i] !== quote) {
        if (s[i] === '\\' && i + 1 < n) {
          body += s[i] + s[i + 1]
          i += 2
        } else {
          body += s[i]
          i++
        }
      }
      i++ // skip closing quote
      tokens.push({ kind: 'REGEX', value: body })
      continue
    }

    // Identifier — could be AND, OR, NOT, or a field name
    if (/[A-Za-z_]/.test(c)) {
      let ident = ''
      while (i < n && /[A-Za-z0-9_]/.test(s[i])) {
        ident += s[i]
        i++
      }
      const upper = ident.toUpperCase()
      if (upper === 'AND') tokens.push({ kind: 'AND' })
      else if (upper === 'OR') tokens.push({ kind: 'OR' })
      else if (upper === 'NOT') tokens.push({ kind: 'NOT' })
      else {
        const f = ident.toLowerCase() as FilterField
        if (['name', 'group', 'url', 'logo', 'quality', 'country'].includes(f)) {
          tokens.push({ kind: 'FIELD', value: f })
        } else {
          throw new Error(`Unknown identifier: "${ident}". Valid fields: Name, Group, Url, Logo, Quality, Country`)
        }
      }
      continue
    }

    throw new Error(`Unexpected character: "${c}" at position ${i}`)
  }

  return tokens
}

// ─── Recursive-descent parser → AST ─────────────────────────────────────────

type Ast =
  | { kind: 'OR'; left: Ast; right: Ast }
  | { kind: 'AND'; left: Ast; right: Ast }
  | { kind: 'NOT'; operand: Ast }
  | { kind: 'PRED'; field: FilterField; negate: boolean; regex: RegExp }

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token {
    const t = this.tokens[this.pos]
    if (!t) throw new Error('Unexpected end of input')
    this.pos++
    return t
  }

  parse(): Ast {
    if (this.tokens.length === 0) {
      // Empty filter — always true
      return { kind: 'PRED', field: 'name', negate: false, regex: /.*/ }
    }
    const ast = this.parseOr()
    if (this.pos < this.tokens.length) {
      throw new Error('Trailing tokens after expression')
    }
    return ast
  }

  private parseOr(): Ast {
    let left = this.parseAnd()
    while (this.peek()?.kind === 'OR') {
      this.next()
      const right = this.parseAnd()
      left = { kind: 'OR', left, right }
    }
    return left
  }

  private parseAnd(): Ast {
    let left = this.parseFactor()
    while (
      this.peek()?.kind === 'AND' ||
      // Implicit AND between adjacent factors (except after OR/NOT at start)
      (this.peek() &&
        this.peek()!.kind !== 'AND' &&
        this.peek()!.kind !== 'OR' &&
        this.peek()!.kind !== 'RPAREN' &&
        this.peek()!.kind !== undefined)
    ) {
      if (this.peek()?.kind === 'AND') this.next()
      const right = this.parseFactor()
      left = { kind: 'AND', left, right }
    }
    return left
  }

  private parseFactor(): Ast {
    const t = this.peek()
    if (!t) throw new Error('Unexpected end of input')

    if (t.kind === 'NOT') {
      this.next()
      return { kind: 'NOT', operand: this.parseFactor() }
    }
    if (t.kind === 'LPAREN') {
      this.next()
      const inner = this.parseOr()
      const close = this.next()
      if (close.kind !== 'RPAREN') throw new Error('Expected ")"')
      return inner
    }
    if (t.kind === 'FIELD') {
      this.next() // consume field
      const op = this.next()
      if (op.kind !== 'MATCH' && op.kind !== 'NMATCH') {
        throw new Error(`Expected "~" or "!~" after field, got ${op.kind}`)
      }
      const regexTok = this.next()
      if (regexTok.kind !== 'REGEX') {
        throw new Error('Expected quoted regex string after operator')
      }
      let re: RegExp
      try {
        re = new RegExp(regexTok.value, 'i') // case-insensitive
      } catch (e) {
        throw new Error(`Invalid regex: "${regexTok.value}"`)
      }
      return {
        kind: 'PRED',
        field: t.value,
        negate: op.kind === 'NMATCH',
        regex: re,
      }
    }

    throw new Error(`Unexpected token: ${t.kind}`)
  }
}

function evaluate(ast: Ast, ctx: Record<FilterField, string>): boolean {
  switch (ast.kind) {
    case 'OR':
      return evaluate(ast.left, ctx) || evaluate(ast.right, ctx)
    case 'AND':
      return evaluate(ast.left, ctx) && evaluate(ast.right, ctx)
    case 'NOT':
      return !evaluate(ast.operand, ctx)
    case 'PRED': {
      const value = ctx[ast.field] ?? ''
      const match = ast.regex.test(value)
      return ast.negate ? !match : match
    }
  }
}

export type CompiledFilter = (ctx: {
  name: string
  group: string
  url: string
  logo: string
  quality: string
  country: string
}) => boolean

/**
 * Compile a tuliprox-style filter expression.
 * Returns a function that takes a channel context and returns true if it matches.
 * Throws on parse error — callers should wrap in try/catch.
 */
export function compileFilter(expr: string): CompiledFilter {
  const trimmed = expr.trim()
  if (!trimmed) {
    return () => true // pass-through
  }
  const tokens = tokenize(trimmed)
  const parser = new Parser(tokens)
  const ast = parser.parse()
  return (ctx) => evaluate(ast, ctx)
}

/** Try to compile; return null on error (with message via console.warn). */
export function tryCompileFilter(expr: string): { ok: true; fn: CompiledFilter } | { ok: false; error: string } {
  try {
    const fn = compileFilter(expr)
    return { ok: true, fn }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Parse error' }
  }
}
