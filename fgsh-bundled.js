// @bun
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = import.meta.require;

// node_modules/@isaacs/balanced-match/dist/commonjs/index.js
var require_commonjs = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.range = exports.balanced = undefined;
  var balanced = (a, b, str) => {
    const ma = a instanceof RegExp ? maybeMatch(a, str) : a;
    const mb = b instanceof RegExp ? maybeMatch(b, str) : b;
    const r = ma !== null && mb != null && (0, exports.range)(ma, mb, str);
    return r && {
      start: r[0],
      end: r[1],
      pre: str.slice(0, r[0]),
      body: str.slice(r[0] + ma.length, r[1]),
      post: str.slice(r[1] + mb.length)
    };
  };
  exports.balanced = balanced;
  var maybeMatch = (reg, str) => {
    const m = str.match(reg);
    return m ? m[0] : null;
  };
  var range = (a, b, str) => {
    let begs, beg, left, right = undefined, result;
    let ai = str.indexOf(a);
    let bi = str.indexOf(b, ai + 1);
    let i = ai;
    if (ai >= 0 && bi > 0) {
      if (a === b) {
        return [ai, bi];
      }
      begs = [];
      left = str.length;
      while (i >= 0 && !result) {
        if (i === ai) {
          begs.push(i);
          ai = str.indexOf(a, i + 1);
        } else if (begs.length === 1) {
          const r = begs.pop();
          if (r !== undefined)
            result = [r, bi];
        } else {
          beg = begs.pop();
          if (beg !== undefined && beg < left) {
            left = beg;
            right = bi;
          }
          bi = str.indexOf(b, i + 1);
        }
        i = ai < bi && ai >= 0 ? ai : bi;
      }
      if (begs.length && right !== undefined) {
        result = [left, right];
      }
    }
    return result;
  };
  exports.range = range;
});

// node_modules/@isaacs/brace-expansion/dist/commonjs/index.js
var require_commonjs2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.expand = expand;
  var balanced_match_1 = require_commonjs();
  var escSlash = "\x00SLASH" + Math.random() + "\x00";
  var escOpen = "\x00OPEN" + Math.random() + "\x00";
  var escClose = "\x00CLOSE" + Math.random() + "\x00";
  var escComma = "\x00COMMA" + Math.random() + "\x00";
  var escPeriod = "\x00PERIOD" + Math.random() + "\x00";
  var escSlashPattern = new RegExp(escSlash, "g");
  var escOpenPattern = new RegExp(escOpen, "g");
  var escClosePattern = new RegExp(escClose, "g");
  var escCommaPattern = new RegExp(escComma, "g");
  var escPeriodPattern = new RegExp(escPeriod, "g");
  var slashPattern = /\\\\/g;
  var openPattern = /\\{/g;
  var closePattern = /\\}/g;
  var commaPattern = /\\,/g;
  var periodPattern = /\\./g;
  function numeric(str) {
    return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
  }
  function escapeBraces(str) {
    return str.replace(slashPattern, escSlash).replace(openPattern, escOpen).replace(closePattern, escClose).replace(commaPattern, escComma).replace(periodPattern, escPeriod);
  }
  function unescapeBraces(str) {
    return str.replace(escSlashPattern, "\\").replace(escOpenPattern, "{").replace(escClosePattern, "}").replace(escCommaPattern, ",").replace(escPeriodPattern, ".");
  }
  function parseCommaParts(str) {
    if (!str) {
      return [""];
    }
    const parts = [];
    const m = (0, balanced_match_1.balanced)("{", "}", str);
    if (!m) {
      return str.split(",");
    }
    const { pre, body, post } = m;
    const p = pre.split(",");
    p[p.length - 1] += "{" + body + "}";
    const postParts = parseCommaParts(post);
    if (post.length) {
      p[p.length - 1] += postParts.shift();
      p.push.apply(p, postParts);
    }
    parts.push.apply(parts, p);
    return parts;
  }
  function expand(str) {
    if (!str) {
      return [];
    }
    if (str.slice(0, 2) === "{}") {
      str = "\\{\\}" + str.slice(2);
    }
    return expand_(escapeBraces(str), true).map(unescapeBraces);
  }
  function embrace(str) {
    return "{" + str + "}";
  }
  function isPadded(el) {
    return /^-?0\d/.test(el);
  }
  function lte(i, y) {
    return i <= y;
  }
  function gte(i, y) {
    return i >= y;
  }
  function expand_(str, isTop) {
    const expansions = [];
    const m = (0, balanced_match_1.balanced)("{", "}", str);
    if (!m)
      return [str];
    const pre = m.pre;
    const post = m.post.length ? expand_(m.post, false) : [""];
    if (/\$$/.test(m.pre)) {
      for (let k = 0;k < post.length; k++) {
        const expansion = pre + "{" + m.body + "}" + post[k];
        expansions.push(expansion);
      }
    } else {
      const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
      const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
      const isSequence = isNumericSequence || isAlphaSequence;
      const isOptions = m.body.indexOf(",") >= 0;
      if (!isSequence && !isOptions) {
        if (m.post.match(/,(?!,).*\}/)) {
          str = m.pre + "{" + m.body + escClose + m.post;
          return expand_(str);
        }
        return [str];
      }
      let n;
      if (isSequence) {
        n = m.body.split(/\.\./);
      } else {
        n = parseCommaParts(m.body);
        if (n.length === 1 && n[0] !== undefined) {
          n = expand_(n[0], false).map(embrace);
          if (n.length === 1) {
            return post.map((p) => m.pre + n[0] + p);
          }
        }
      }
      let N;
      if (isSequence && n[0] !== undefined && n[1] !== undefined) {
        const x = numeric(n[0]);
        const y = numeric(n[1]);
        const width = Math.max(n[0].length, n[1].length);
        let incr = n.length === 3 && n[2] !== undefined ? Math.abs(numeric(n[2])) : 1;
        let test = lte;
        const reverse = y < x;
        if (reverse) {
          incr *= -1;
          test = gte;
        }
        const pad = n.some(isPadded);
        N = [];
        for (let i = x;test(i, y); i += incr) {
          let c;
          if (isAlphaSequence) {
            c = String.fromCharCode(i);
            if (c === "\\") {
              c = "";
            }
          } else {
            c = String(i);
            if (pad) {
              const need = width - c.length;
              if (need > 0) {
                const z = new Array(need + 1).join("0");
                if (i < 0) {
                  c = "-" + z + c.slice(1);
                } else {
                  c = z + c;
                }
              }
            }
          }
          N.push(c);
        }
      } else {
        N = [];
        for (let j = 0;j < n.length; j++) {
          N.push.apply(N, expand_(n[j], false));
        }
      }
      for (let j = 0;j < N.length; j++) {
        for (let k = 0;k < post.length; k++) {
          const expansion = pre + N[j] + post[k];
          if (!isTop || isSequence || expansion) {
            expansions.push(expansion);
          }
        }
      }
    }
    return expansions;
  }
});

// node_modules/minimatch/dist/commonjs/assert-valid-pattern.js
var require_assert_valid_pattern = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.assertValidPattern = undefined;
  var MAX_PATTERN_LENGTH = 1024 * 64;
  var assertValidPattern = (pattern) => {
    if (typeof pattern !== "string") {
      throw new TypeError("invalid pattern");
    }
    if (pattern.length > MAX_PATTERN_LENGTH) {
      throw new TypeError("pattern is too long");
    }
  };
  exports.assertValidPattern = assertValidPattern;
});

// node_modules/minimatch/dist/commonjs/brace-expressions.js
var require_brace_expressions = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.parseClass = undefined;
  var posixClasses = {
    "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
    "[:alpha:]": ["\\p{L}\\p{Nl}", true],
    "[:ascii:]": ["\\x" + "00-\\x" + "7f", false],
    "[:blank:]": ["\\p{Zs}\\t", true],
    "[:cntrl:]": ["\\p{Cc}", true],
    "[:digit:]": ["\\p{Nd}", true],
    "[:graph:]": ["\\p{Z}\\p{C}", true, true],
    "[:lower:]": ["\\p{Ll}", true],
    "[:print:]": ["\\p{C}", true],
    "[:punct:]": ["\\p{P}", true],
    "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
    "[:upper:]": ["\\p{Lu}", true],
    "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
    "[:xdigit:]": ["A-Fa-f0-9", false]
  };
  var braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
  var regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  var rangesToString = (ranges) => ranges.join("");
  var parseClass = (glob, position) => {
    const pos = position;
    if (glob.charAt(pos) !== "[") {
      throw new Error("not in a brace expression");
    }
    const ranges = [];
    const negs = [];
    let i = pos + 1;
    let sawStart = false;
    let uflag = false;
    let escaping = false;
    let negate = false;
    let endPos = pos;
    let rangeStart = "";
    WHILE:
      while (i < glob.length) {
        const c = glob.charAt(i);
        if ((c === "!" || c === "^") && i === pos + 1) {
          negate = true;
          i++;
          continue;
        }
        if (c === "]" && sawStart && !escaping) {
          endPos = i + 1;
          break;
        }
        sawStart = true;
        if (c === "\\") {
          if (!escaping) {
            escaping = true;
            i++;
            continue;
          }
        }
        if (c === "[" && !escaping) {
          for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
            if (glob.startsWith(cls, i)) {
              if (rangeStart) {
                return ["$.", false, glob.length - pos, true];
              }
              i += cls.length;
              if (neg)
                negs.push(unip);
              else
                ranges.push(unip);
              uflag = uflag || u;
              continue WHILE;
            }
          }
        }
        escaping = false;
        if (rangeStart) {
          if (c > rangeStart) {
            ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
          } else if (c === rangeStart) {
            ranges.push(braceEscape(c));
          }
          rangeStart = "";
          i++;
          continue;
        }
        if (glob.startsWith("-]", i + 1)) {
          ranges.push(braceEscape(c + "-"));
          i += 2;
          continue;
        }
        if (glob.startsWith("-", i + 1)) {
          rangeStart = c;
          i += 2;
          continue;
        }
        ranges.push(braceEscape(c));
        i++;
      }
    if (endPos < i) {
      return ["", false, 0, false];
    }
    if (!ranges.length && !negs.length) {
      return ["$.", false, glob.length - pos, true];
    }
    if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
      const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
      return [regexpEscape(r), false, endPos - pos, false];
    }
    const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
    const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
    const comb = ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs;
    return [comb, uflag, endPos - pos, true];
  };
  exports.parseClass = parseClass;
});

// node_modules/minimatch/dist/commonjs/unescape.js
var require_unescape = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.unescape = undefined;
  var unescape = (s, { windowsPathsNoEscape = false, magicalBraces = true } = {}) => {
    if (magicalBraces) {
      return windowsPathsNoEscape ? s.replace(/\[([^\/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
    }
    return windowsPathsNoEscape ? s.replace(/\[([^\/\\{}])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\{}])\]/g, "$1$2").replace(/\\([^\/{}])/g, "$1");
  };
  exports.unescape = unescape;
});

// node_modules/minimatch/dist/commonjs/ast.js
var require_ast = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.AST = undefined;
  var brace_expressions_js_1 = require_brace_expressions();
  var unescape_js_1 = require_unescape();
  var types = new Set(["!", "?", "+", "*", "@"]);
  var isExtglobType = (c) => types.has(c);
  var startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
  var startNoDot = "(?!\\.)";
  var addPatternStart = new Set(["[", "."]);
  var justDots = new Set(["..", "."]);
  var reSpecials = new Set("().*{}+?[]^$\\!");
  var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  var qmark = "[^/]";
  var star = qmark + "*?";
  var starNoEmpty = qmark + "+?";

  class AST {
    type;
    #root;
    #hasMagic;
    #uflag = false;
    #parts = [];
    #parent;
    #parentIndex;
    #negs;
    #filledNegs = false;
    #options;
    #toString;
    #emptyExt = false;
    constructor(type, parent, options = {}) {
      this.type = type;
      if (type)
        this.#hasMagic = true;
      this.#parent = parent;
      this.#root = this.#parent ? this.#parent.#root : this;
      this.#options = this.#root === this ? options : this.#root.#options;
      this.#negs = this.#root === this ? [] : this.#root.#negs;
      if (type === "!" && !this.#root.#filledNegs)
        this.#negs.push(this);
      this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
    }
    get hasMagic() {
      if (this.#hasMagic !== undefined)
        return this.#hasMagic;
      for (const p of this.#parts) {
        if (typeof p === "string")
          continue;
        if (p.type || p.hasMagic)
          return this.#hasMagic = true;
      }
      return this.#hasMagic;
    }
    toString() {
      if (this.#toString !== undefined)
        return this.#toString;
      if (!this.type) {
        return this.#toString = this.#parts.map((p) => String(p)).join("");
      } else {
        return this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
      }
    }
    #fillNegs() {
      if (this !== this.#root)
        throw new Error("should only call on root");
      if (this.#filledNegs)
        return this;
      this.toString();
      this.#filledNegs = true;
      let n;
      while (n = this.#negs.pop()) {
        if (n.type !== "!")
          continue;
        let p = n;
        let pp = p.#parent;
        while (pp) {
          for (let i = p.#parentIndex + 1;!pp.type && i < pp.#parts.length; i++) {
            for (const part of n.#parts) {
              if (typeof part === "string") {
                throw new Error("string part in extglob AST??");
              }
              part.copyIn(pp.#parts[i]);
            }
          }
          p = pp;
          pp = p.#parent;
        }
      }
      return this;
    }
    push(...parts) {
      for (const p of parts) {
        if (p === "")
          continue;
        if (typeof p !== "string" && !(p instanceof AST && p.#parent === this)) {
          throw new Error("invalid part: " + p);
        }
        this.#parts.push(p);
      }
    }
    toJSON() {
      const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
      if (this.isStart() && !this.type)
        ret.unshift([]);
      if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && this.#parent?.type === "!")) {
        ret.push({});
      }
      return ret;
    }
    isStart() {
      if (this.#root === this)
        return true;
      if (!this.#parent?.isStart())
        return false;
      if (this.#parentIndex === 0)
        return true;
      const p = this.#parent;
      for (let i = 0;i < this.#parentIndex; i++) {
        const pp = p.#parts[i];
        if (!(pp instanceof AST && pp.type === "!")) {
          return false;
        }
      }
      return true;
    }
    isEnd() {
      if (this.#root === this)
        return true;
      if (this.#parent?.type === "!")
        return true;
      if (!this.#parent?.isEnd())
        return false;
      if (!this.type)
        return this.#parent?.isEnd();
      const pl = this.#parent ? this.#parent.#parts.length : 0;
      return this.#parentIndex === pl - 1;
    }
    copyIn(part) {
      if (typeof part === "string")
        this.push(part);
      else
        this.push(part.clone(this));
    }
    clone(parent) {
      const c = new AST(this.type, parent);
      for (const p of this.#parts) {
        c.copyIn(p);
      }
      return c;
    }
    static #parseAST(str, ast, pos, opt) {
      let escaping = false;
      let inBrace = false;
      let braceStart = -1;
      let braceNeg = false;
      if (ast.type === null) {
        let i2 = pos;
        let acc2 = "";
        while (i2 < str.length) {
          const c = str.charAt(i2++);
          if (escaping || c === "\\") {
            escaping = !escaping;
            acc2 += c;
            continue;
          }
          if (inBrace) {
            if (i2 === braceStart + 1) {
              if (c === "^" || c === "!") {
                braceNeg = true;
              }
            } else if (c === "]" && !(i2 === braceStart + 2 && braceNeg)) {
              inBrace = false;
            }
            acc2 += c;
            continue;
          } else if (c === "[") {
            inBrace = true;
            braceStart = i2;
            braceNeg = false;
            acc2 += c;
            continue;
          }
          if (!opt.noext && isExtglobType(c) && str.charAt(i2) === "(") {
            ast.push(acc2);
            acc2 = "";
            const ext = new AST(c, ast);
            i2 = AST.#parseAST(str, ext, i2, opt);
            ast.push(ext);
            continue;
          }
          acc2 += c;
        }
        ast.push(acc2);
        return i2;
      }
      let i = pos + 1;
      let part = new AST(null, ast);
      const parts = [];
      let acc = "";
      while (i < str.length) {
        const c = str.charAt(i++);
        if (escaping || c === "\\") {
          escaping = !escaping;
          acc += c;
          continue;
        }
        if (inBrace) {
          if (i === braceStart + 1) {
            if (c === "^" || c === "!") {
              braceNeg = true;
            }
          } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
            inBrace = false;
          }
          acc += c;
          continue;
        } else if (c === "[") {
          inBrace = true;
          braceStart = i;
          braceNeg = false;
          acc += c;
          continue;
        }
        if (isExtglobType(c) && str.charAt(i) === "(") {
          part.push(acc);
          acc = "";
          const ext = new AST(c, part);
          part.push(ext);
          i = AST.#parseAST(str, ext, i, opt);
          continue;
        }
        if (c === "|") {
          part.push(acc);
          acc = "";
          parts.push(part);
          part = new AST(null, ast);
          continue;
        }
        if (c === ")") {
          if (acc === "" && ast.#parts.length === 0) {
            ast.#emptyExt = true;
          }
          part.push(acc);
          acc = "";
          ast.push(...parts, part);
          return i;
        }
        acc += c;
      }
      ast.type = null;
      ast.#hasMagic = undefined;
      ast.#parts = [str.substring(pos - 1)];
      return i;
    }
    static fromGlob(pattern, options = {}) {
      const ast = new AST(null, undefined, options);
      AST.#parseAST(pattern, ast, 0, options);
      return ast;
    }
    toMMPattern() {
      if (this !== this.#root)
        return this.#root.toMMPattern();
      const glob = this.toString();
      const [re, body, hasMagic, uflag] = this.toRegExpSource();
      const anyMagic = hasMagic || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob.toUpperCase() !== glob.toLowerCase();
      if (!anyMagic) {
        return body;
      }
      const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
      return Object.assign(new RegExp(`^${re}$`, flags), {
        _src: re,
        _glob: glob
      });
    }
    get options() {
      return this.#options;
    }
    toRegExpSource(allowDot) {
      const dot = allowDot ?? !!this.#options.dot;
      if (this.#root === this)
        this.#fillNegs();
      if (!this.type) {
        const noEmpty = this.isStart() && this.isEnd() && !this.#parts.some((s) => typeof s !== "string");
        const src = this.#parts.map((p) => {
          const [re, _, hasMagic, uflag] = typeof p === "string" ? AST.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
          this.#hasMagic = this.#hasMagic || hasMagic;
          this.#uflag = this.#uflag || uflag;
          return re;
        }).join("");
        let start2 = "";
        if (this.isStart()) {
          if (typeof this.#parts[0] === "string") {
            const dotTravAllowed = this.#parts.length === 1 && justDots.has(this.#parts[0]);
            if (!dotTravAllowed) {
              const aps = addPatternStart;
              const needNoTrav = dot && aps.has(src.charAt(0)) || src.startsWith("\\.") && aps.has(src.charAt(2)) || src.startsWith("\\.\\.") && aps.has(src.charAt(4));
              const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
              start2 = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
            }
          }
        }
        let end = "";
        if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") {
          end = "(?:$|\\/)";
        }
        const final2 = start2 + src + end;
        return [
          final2,
          (0, unescape_js_1.unescape)(src),
          this.#hasMagic = !!this.#hasMagic,
          this.#uflag
        ];
      }
      const repeated = this.type === "*" || this.type === "+";
      const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
      let body = this.#partsToRegExp(dot);
      if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
        const s = this.toString();
        this.#parts = [s];
        this.type = null;
        this.#hasMagic = undefined;
        return [s, (0, unescape_js_1.unescape)(this.toString()), false, false];
      }
      let bodyDotAllowed = !repeated || allowDot || dot || !startNoDot ? "" : this.#partsToRegExp(true);
      if (bodyDotAllowed === body) {
        bodyDotAllowed = "";
      }
      if (bodyDotAllowed) {
        body = `(?:${body})(?:${bodyDotAllowed})*?`;
      }
      let final = "";
      if (this.type === "!" && this.#emptyExt) {
        final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
      } else {
        const close = this.type === "!" ? "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + star + ")" : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
        final = start + body + close;
      }
      return [
        final,
        (0, unescape_js_1.unescape)(body),
        this.#hasMagic = !!this.#hasMagic,
        this.#uflag
      ];
    }
    #partsToRegExp(dot) {
      return this.#parts.map((p) => {
        if (typeof p === "string") {
          throw new Error("string type in extglob ast??");
        }
        const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
        this.#uflag = this.#uflag || uflag;
        return re;
      }).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
    }
    static #parseGlob(glob, hasMagic, noEmpty = false) {
      let escaping = false;
      let re = "";
      let uflag = false;
      for (let i = 0;i < glob.length; i++) {
        const c = glob.charAt(i);
        if (escaping) {
          escaping = false;
          re += (reSpecials.has(c) ? "\\" : "") + c;
          continue;
        }
        if (c === "\\") {
          if (i === glob.length - 1) {
            re += "\\\\";
          } else {
            escaping = true;
          }
          continue;
        }
        if (c === "[") {
          const [src, needUflag, consumed, magic] = (0, brace_expressions_js_1.parseClass)(glob, i);
          if (consumed) {
            re += src;
            uflag = uflag || needUflag;
            i += consumed - 1;
            hasMagic = hasMagic || magic;
            continue;
          }
        }
        if (c === "*") {
          re += noEmpty && glob === "*" ? starNoEmpty : star;
          hasMagic = true;
          continue;
        }
        if (c === "?") {
          re += qmark;
          hasMagic = true;
          continue;
        }
        re += regExpEscape(c);
      }
      return [re, (0, unescape_js_1.unescape)(glob), !!hasMagic, uflag];
    }
  }
  exports.AST = AST;
});

// node_modules/minimatch/dist/commonjs/escape.js
var require_escape = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.escape = undefined;
  var escape = (s, { windowsPathsNoEscape = false, magicalBraces = false } = {}) => {
    if (magicalBraces) {
      return windowsPathsNoEscape ? s.replace(/[?*()[\]{}]/g, "[$&]") : s.replace(/[?*()[\]\\{}]/g, "\\$&");
    }
    return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
  };
  exports.escape = escape;
});

// node_modules/minimatch/dist/commonjs/index.js
var require_commonjs3 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.unescape = exports.escape = exports.AST = exports.Minimatch = exports.match = exports.makeRe = exports.braceExpand = exports.defaults = exports.filter = exports.GLOBSTAR = exports.sep = exports.minimatch = undefined;
  var brace_expansion_1 = require_commonjs2();
  var assert_valid_pattern_js_1 = require_assert_valid_pattern();
  var ast_js_1 = require_ast();
  var escape_js_1 = require_escape();
  var unescape_js_1 = require_unescape();
  var minimatch = (p, pattern, options = {}) => {
    (0, assert_valid_pattern_js_1.assertValidPattern)(pattern);
    if (!options.nocomment && pattern.charAt(0) === "#") {
      return false;
    }
    return new Minimatch(pattern, options).match(p);
  };
  exports.minimatch = minimatch;
  var starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/;
  var starDotExtTest = (ext2) => (f2) => !f2.startsWith(".") && f2.endsWith(ext2);
  var starDotExtTestDot = (ext2) => (f2) => f2.endsWith(ext2);
  var starDotExtTestNocase = (ext2) => {
    ext2 = ext2.toLowerCase();
    return (f2) => !f2.startsWith(".") && f2.toLowerCase().endsWith(ext2);
  };
  var starDotExtTestNocaseDot = (ext2) => {
    ext2 = ext2.toLowerCase();
    return (f2) => f2.toLowerCase().endsWith(ext2);
  };
  var starDotStarRE = /^\*+\.\*+$/;
  var starDotStarTest = (f2) => !f2.startsWith(".") && f2.includes(".");
  var starDotStarTestDot = (f2) => f2 !== "." && f2 !== ".." && f2.includes(".");
  var dotStarRE = /^\.\*+$/;
  var dotStarTest = (f2) => f2 !== "." && f2 !== ".." && f2.startsWith(".");
  var starRE = /^\*+$/;
  var starTest = (f2) => f2.length !== 0 && !f2.startsWith(".");
  var starTestDot = (f2) => f2.length !== 0 && f2 !== "." && f2 !== "..";
  var qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/;
  var qmarksTestNocase = ([$0, ext2 = ""]) => {
    const noext = qmarksTestNoExt([$0]);
    if (!ext2)
      return noext;
    ext2 = ext2.toLowerCase();
    return (f2) => noext(f2) && f2.toLowerCase().endsWith(ext2);
  };
  var qmarksTestNocaseDot = ([$0, ext2 = ""]) => {
    const noext = qmarksTestNoExtDot([$0]);
    if (!ext2)
      return noext;
    ext2 = ext2.toLowerCase();
    return (f2) => noext(f2) && f2.toLowerCase().endsWith(ext2);
  };
  var qmarksTestDot = ([$0, ext2 = ""]) => {
    const noext = qmarksTestNoExtDot([$0]);
    return !ext2 ? noext : (f2) => noext(f2) && f2.endsWith(ext2);
  };
  var qmarksTest = ([$0, ext2 = ""]) => {
    const noext = qmarksTestNoExt([$0]);
    return !ext2 ? noext : (f2) => noext(f2) && f2.endsWith(ext2);
  };
  var qmarksTestNoExt = ([$0]) => {
    const len = $0.length;
    return (f2) => f2.length === len && !f2.startsWith(".");
  };
  var qmarksTestNoExtDot = ([$0]) => {
    const len = $0.length;
    return (f2) => f2.length === len && f2 !== "." && f2 !== "..";
  };
  var defaultPlatform = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
  var path = {
    win32: { sep: "\\" },
    posix: { sep: "/" }
  };
  exports.sep = defaultPlatform === "win32" ? path.win32.sep : path.posix.sep;
  exports.minimatch.sep = exports.sep;
  exports.GLOBSTAR = Symbol("globstar **");
  exports.minimatch.GLOBSTAR = exports.GLOBSTAR;
  var qmark = "[^/]";
  var star = qmark + "*?";
  var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
  var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
  var filter = (pattern, options = {}) => (p) => (0, exports.minimatch)(p, pattern, options);
  exports.filter = filter;
  exports.minimatch.filter = exports.filter;
  var ext = (a, b = {}) => Object.assign({}, a, b);
  var defaults = (def) => {
    if (!def || typeof def !== "object" || !Object.keys(def).length) {
      return exports.minimatch;
    }
    const orig = exports.minimatch;
    const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
    return Object.assign(m, {
      Minimatch: class Minimatch2 extends orig.Minimatch {
        constructor(pattern, options = {}) {
          super(pattern, ext(def, options));
        }
        static defaults(options) {
          return orig.defaults(ext(def, options)).Minimatch;
        }
      },
      AST: class AST extends orig.AST {
        constructor(type, parent, options = {}) {
          super(type, parent, ext(def, options));
        }
        static fromGlob(pattern, options = {}) {
          return orig.AST.fromGlob(pattern, ext(def, options));
        }
      },
      unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
      escape: (s, options = {}) => orig.escape(s, ext(def, options)),
      filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
      defaults: (options) => orig.defaults(ext(def, options)),
      makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
      braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
      match: (list, pattern, options = {}) => orig.match(list, pattern, ext(def, options)),
      sep: orig.sep,
      GLOBSTAR: exports.GLOBSTAR
    });
  };
  exports.defaults = defaults;
  exports.minimatch.defaults = exports.defaults;
  var braceExpand = (pattern, options = {}) => {
    (0, assert_valid_pattern_js_1.assertValidPattern)(pattern);
    if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
      return [pattern];
    }
    return (0, brace_expansion_1.expand)(pattern);
  };
  exports.braceExpand = braceExpand;
  exports.minimatch.braceExpand = exports.braceExpand;
  var makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
  exports.makeRe = makeRe;
  exports.minimatch.makeRe = exports.makeRe;
  var match = (list, pattern, options = {}) => {
    const mm = new Minimatch(pattern, options);
    list = list.filter((f2) => mm.match(f2));
    if (mm.options.nonull && !list.length) {
      list.push(pattern);
    }
    return list;
  };
  exports.match = match;
  exports.minimatch.match = exports.match;
  var globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
  var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

  class Minimatch {
    options;
    set;
    pattern;
    windowsPathsNoEscape;
    nonegate;
    negate;
    comment;
    empty;
    preserveMultipleSlashes;
    partial;
    globSet;
    globParts;
    nocase;
    isWindows;
    platform;
    windowsNoMagicRoot;
    regexp;
    constructor(pattern, options = {}) {
      (0, assert_valid_pattern_js_1.assertValidPattern)(pattern);
      options = options || {};
      this.options = options;
      this.pattern = pattern;
      this.platform = options.platform || defaultPlatform;
      this.isWindows = this.platform === "win32";
      this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
      if (this.windowsPathsNoEscape) {
        this.pattern = this.pattern.replace(/\\/g, "/");
      }
      this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
      this.regexp = null;
      this.negate = false;
      this.nonegate = !!options.nonegate;
      this.comment = false;
      this.empty = false;
      this.partial = !!options.partial;
      this.nocase = !!this.options.nocase;
      this.windowsNoMagicRoot = options.windowsNoMagicRoot !== undefined ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
      this.globSet = [];
      this.globParts = [];
      this.set = [];
      this.make();
    }
    hasMagic() {
      if (this.options.magicalBraces && this.set.length > 1) {
        return true;
      }
      for (const pattern of this.set) {
        for (const part of pattern) {
          if (typeof part !== "string")
            return true;
        }
      }
      return false;
    }
    debug(..._) {}
    make() {
      const pattern = this.pattern;
      const options = this.options;
      if (!options.nocomment && pattern.charAt(0) === "#") {
        this.comment = true;
        return;
      }
      if (!pattern) {
        this.empty = true;
        return;
      }
      this.parseNegate();
      this.globSet = [...new Set(this.braceExpand())];
      if (options.debug) {
        this.debug = (...args) => console.error(...args);
      }
      this.debug(this.pattern, this.globSet);
      const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
      this.globParts = this.preprocess(rawGlobParts);
      this.debug(this.pattern, this.globParts);
      let set = this.globParts.map((s, _, __) => {
        if (this.isWindows && this.windowsNoMagicRoot) {
          const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
          const isDrive = /^[a-z]:/i.test(s[0]);
          if (isUNC) {
            return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
          } else if (isDrive) {
            return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
          }
        }
        return s.map((ss) => this.parse(ss));
      });
      this.debug(this.pattern, set);
      this.set = set.filter((s) => s.indexOf(false) === -1);
      if (this.isWindows) {
        for (let i = 0;i < this.set.length; i++) {
          const p = this.set[i];
          if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) {
            p[2] = "?";
          }
        }
      }
      this.debug(this.pattern, this.set);
    }
    preprocess(globParts) {
      if (this.options.noglobstar) {
        for (let i = 0;i < globParts.length; i++) {
          for (let j = 0;j < globParts[i].length; j++) {
            if (globParts[i][j] === "**") {
              globParts[i][j] = "*";
            }
          }
        }
      }
      const { optimizationLevel = 1 } = this.options;
      if (optimizationLevel >= 2) {
        globParts = this.firstPhasePreProcess(globParts);
        globParts = this.secondPhasePreProcess(globParts);
      } else if (optimizationLevel >= 1) {
        globParts = this.levelOneOptimize(globParts);
      } else {
        globParts = this.adjascentGlobstarOptimize(globParts);
      }
      return globParts;
    }
    adjascentGlobstarOptimize(globParts) {
      return globParts.map((parts) => {
        let gs = -1;
        while ((gs = parts.indexOf("**", gs + 1)) !== -1) {
          let i = gs;
          while (parts[i + 1] === "**") {
            i++;
          }
          if (i !== gs) {
            parts.splice(gs, i - gs);
          }
        }
        return parts;
      });
    }
    levelOneOptimize(globParts) {
      return globParts.map((parts) => {
        parts = parts.reduce((set, part) => {
          const prev = set[set.length - 1];
          if (part === "**" && prev === "**") {
            return set;
          }
          if (part === "..") {
            if (prev && prev !== ".." && prev !== "." && prev !== "**") {
              set.pop();
              return set;
            }
          }
          set.push(part);
          return set;
        }, []);
        return parts.length === 0 ? [""] : parts;
      });
    }
    levelTwoFileOptimize(parts) {
      if (!Array.isArray(parts)) {
        parts = this.slashSplit(parts);
      }
      let didSomething = false;
      do {
        didSomething = false;
        if (!this.preserveMultipleSlashes) {
          for (let i = 1;i < parts.length - 1; i++) {
            const p = parts[i];
            if (i === 1 && p === "" && parts[0] === "")
              continue;
            if (p === "." || p === "") {
              didSomething = true;
              parts.splice(i, 1);
              i--;
            }
          }
          if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
            didSomething = true;
            parts.pop();
          }
        }
        let dd = 0;
        while ((dd = parts.indexOf("..", dd + 1)) !== -1) {
          const p = parts[dd - 1];
          if (p && p !== "." && p !== ".." && p !== "**") {
            didSomething = true;
            parts.splice(dd - 1, 2);
            dd -= 2;
          }
        }
      } while (didSomething);
      return parts.length === 0 ? [""] : parts;
    }
    firstPhasePreProcess(globParts) {
      let didSomething = false;
      do {
        didSomething = false;
        for (let parts of globParts) {
          let gs = -1;
          while ((gs = parts.indexOf("**", gs + 1)) !== -1) {
            let gss = gs;
            while (parts[gss + 1] === "**") {
              gss++;
            }
            if (gss > gs) {
              parts.splice(gs + 1, gss - gs);
            }
            let next = parts[gs + 1];
            const p = parts[gs + 2];
            const p2 = parts[gs + 3];
            if (next !== "..")
              continue;
            if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
              continue;
            }
            didSomething = true;
            parts.splice(gs, 1);
            const other = parts.slice(0);
            other[gs] = "**";
            globParts.push(other);
            gs--;
          }
          if (!this.preserveMultipleSlashes) {
            for (let i = 1;i < parts.length - 1; i++) {
              const p = parts[i];
              if (i === 1 && p === "" && parts[0] === "")
                continue;
              if (p === "." || p === "") {
                didSomething = true;
                parts.splice(i, 1);
                i--;
              }
            }
            if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
              didSomething = true;
              parts.pop();
            }
          }
          let dd = 0;
          while ((dd = parts.indexOf("..", dd + 1)) !== -1) {
            const p = parts[dd - 1];
            if (p && p !== "." && p !== ".." && p !== "**") {
              didSomething = true;
              const needDot = dd === 1 && parts[dd + 1] === "**";
              const splin = needDot ? ["."] : [];
              parts.splice(dd - 1, 2, ...splin);
              if (parts.length === 0)
                parts.push("");
              dd -= 2;
            }
          }
        }
      } while (didSomething);
      return globParts;
    }
    secondPhasePreProcess(globParts) {
      for (let i = 0;i < globParts.length - 1; i++) {
        for (let j = i + 1;j < globParts.length; j++) {
          const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
          if (matched) {
            globParts[i] = [];
            globParts[j] = matched;
            break;
          }
        }
      }
      return globParts.filter((gs) => gs.length);
    }
    partsMatch(a, b, emptyGSMatch = false) {
      let ai = 0;
      let bi = 0;
      let result = [];
      let which = "";
      while (ai < a.length && bi < b.length) {
        if (a[ai] === b[bi]) {
          result.push(which === "b" ? b[bi] : a[ai]);
          ai++;
          bi++;
        } else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
          result.push(a[ai]);
          ai++;
        } else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
          result.push(b[bi]);
          bi++;
        } else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
          if (which === "b")
            return false;
          which = "a";
          result.push(a[ai]);
          ai++;
          bi++;
        } else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
          if (which === "a")
            return false;
          which = "b";
          result.push(b[bi]);
          ai++;
          bi++;
        } else {
          return false;
        }
      }
      return a.length === b.length && result;
    }
    parseNegate() {
      if (this.nonegate)
        return;
      const pattern = this.pattern;
      let negate = false;
      let negateOffset = 0;
      for (let i = 0;i < pattern.length && pattern.charAt(i) === "!"; i++) {
        negate = !negate;
        negateOffset++;
      }
      if (negateOffset)
        this.pattern = pattern.slice(negateOffset);
      this.negate = negate;
    }
    matchOne(file, pattern, partial = false) {
      const options = this.options;
      if (this.isWindows) {
        const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
        const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
        const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
        const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
        const fdi = fileUNC ? 3 : fileDrive ? 0 : undefined;
        const pdi = patternUNC ? 3 : patternDrive ? 0 : undefined;
        if (typeof fdi === "number" && typeof pdi === "number") {
          const [fd, pd] = [file[fdi], pattern[pdi]];
          if (fd.toLowerCase() === pd.toLowerCase()) {
            pattern[pdi] = fd;
            if (pdi > fdi) {
              pattern = pattern.slice(pdi);
            } else if (fdi > pdi) {
              file = file.slice(fdi);
            }
          }
        }
      }
      const { optimizationLevel = 1 } = this.options;
      if (optimizationLevel >= 2) {
        file = this.levelTwoFileOptimize(file);
      }
      this.debug("matchOne", this, { file, pattern });
      this.debug("matchOne", file.length, pattern.length);
      for (var fi = 0, pi = 0, fl = file.length, pl = pattern.length;fi < fl && pi < pl; fi++, pi++) {
        this.debug("matchOne loop");
        var p = pattern[pi];
        var f2 = file[fi];
        this.debug(pattern, p, f2);
        if (p === false) {
          return false;
        }
        if (p === exports.GLOBSTAR) {
          this.debug("GLOBSTAR", [pattern, p, f2]);
          var fr = fi;
          var pr = pi + 1;
          if (pr === pl) {
            this.debug("** at the end");
            for (;fi < fl; fi++) {
              if (file[fi] === "." || file[fi] === ".." || !options.dot && file[fi].charAt(0) === ".")
                return false;
            }
            return true;
          }
          while (fr < fl) {
            var swallowee = file[fr];
            this.debug(`
globstar while`, file, fr, pattern, pr, swallowee);
            if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
              this.debug("globstar found match!", fr, fl, swallowee);
              return true;
            } else {
              if (swallowee === "." || swallowee === ".." || !options.dot && swallowee.charAt(0) === ".") {
                this.debug("dot detected!", file, fr, pattern, pr);
                break;
              }
              this.debug("globstar swallow a segment, and continue");
              fr++;
            }
          }
          if (partial) {
            this.debug(`
>>> no match, partial?`, file, fr, pattern, pr);
            if (fr === fl) {
              return true;
            }
          }
          return false;
        }
        let hit;
        if (typeof p === "string") {
          hit = f2 === p;
          this.debug("string match", p, f2, hit);
        } else {
          hit = p.test(f2);
          this.debug("pattern match", p, f2, hit);
        }
        if (!hit)
          return false;
      }
      if (fi === fl && pi === pl) {
        return true;
      } else if (fi === fl) {
        return partial;
      } else if (pi === pl) {
        return fi === fl - 1 && file[fi] === "";
      } else {
        throw new Error("wtf?");
      }
    }
    braceExpand() {
      return (0, exports.braceExpand)(this.pattern, this.options);
    }
    parse(pattern) {
      (0, assert_valid_pattern_js_1.assertValidPattern)(pattern);
      const options = this.options;
      if (pattern === "**")
        return exports.GLOBSTAR;
      if (pattern === "")
        return "";
      let m;
      let fastTest = null;
      if (m = pattern.match(starRE)) {
        fastTest = options.dot ? starTestDot : starTest;
      } else if (m = pattern.match(starDotExtRE)) {
        fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
      } else if (m = pattern.match(qmarksRE)) {
        fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
      } else if (m = pattern.match(starDotStarRE)) {
        fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
      } else if (m = pattern.match(dotStarRE)) {
        fastTest = dotStarTest;
      }
      const re = ast_js_1.AST.fromGlob(pattern, this.options).toMMPattern();
      if (fastTest && typeof re === "object") {
        Reflect.defineProperty(re, "test", { value: fastTest });
      }
      return re;
    }
    makeRe() {
      if (this.regexp || this.regexp === false)
        return this.regexp;
      const set = this.set;
      if (!set.length) {
        this.regexp = false;
        return this.regexp;
      }
      const options = this.options;
      const twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
      const flags = new Set(options.nocase ? ["i"] : []);
      let re = set.map((pattern) => {
        const pp = pattern.map((p) => {
          if (p instanceof RegExp) {
            for (const f2 of p.flags.split(""))
              flags.add(f2);
          }
          return typeof p === "string" ? regExpEscape(p) : p === exports.GLOBSTAR ? exports.GLOBSTAR : p._src;
        });
        pp.forEach((p, i) => {
          const next = pp[i + 1];
          const prev = pp[i - 1];
          if (p !== exports.GLOBSTAR || prev === exports.GLOBSTAR) {
            return;
          }
          if (prev === undefined) {
            if (next !== undefined && next !== exports.GLOBSTAR) {
              pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
            } else {
              pp[i] = twoStar;
            }
          } else if (next === undefined) {
            pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + ")?";
          } else if (next !== exports.GLOBSTAR) {
            pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
            pp[i + 1] = exports.GLOBSTAR;
          }
        });
        const filtered = pp.filter((p) => p !== exports.GLOBSTAR);
        if (this.partial && filtered.length >= 1) {
          const prefixes = [];
          for (let i = 1;i <= filtered.length; i++) {
            prefixes.push(filtered.slice(0, i).join("/"));
          }
          return "(?:" + prefixes.join("|") + ")";
        }
        return filtered.join("/");
      }).join("|");
      const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
      re = "^" + open + re + close + "$";
      if (this.partial) {
        re = "^(?:\\/|" + open + re.slice(1, -1) + close + ")$";
      }
      if (this.negate)
        re = "^(?!" + re + ").+$";
      try {
        this.regexp = new RegExp(re, [...flags].join(""));
      } catch (ex) {
        this.regexp = false;
      }
      return this.regexp;
    }
    slashSplit(p) {
      if (this.preserveMultipleSlashes) {
        return p.split("/");
      } else if (this.isWindows && /^\/\/[^\/]+/.test(p)) {
        return ["", ...p.split(/\/+/)];
      } else {
        return p.split(/\/+/);
      }
    }
    match(f2, partial = this.partial) {
      this.debug("match", f2, this.pattern);
      if (this.comment) {
        return false;
      }
      if (this.empty) {
        return f2 === "";
      }
      if (f2 === "/" && partial) {
        return true;
      }
      const options = this.options;
      if (this.isWindows) {
        f2 = f2.split("\\").join("/");
      }
      const ff = this.slashSplit(f2);
      this.debug(this.pattern, "split", ff);
      const set = this.set;
      this.debug(this.pattern, "set", set);
      let filename = ff[ff.length - 1];
      if (!filename) {
        for (let i = ff.length - 2;!filename && i >= 0; i--) {
          filename = ff[i];
        }
      }
      for (let i = 0;i < set.length; i++) {
        const pattern = set[i];
        let file = ff;
        if (options.matchBase && pattern.length === 1) {
          file = [filename];
        }
        const hit = this.matchOne(file, pattern, partial);
        if (hit) {
          if (options.flipNegate) {
            return true;
          }
          return !this.negate;
        }
      }
      if (options.flipNegate) {
        return false;
      }
      return this.negate;
    }
    static defaults(def) {
      return exports.minimatch.defaults(def).Minimatch;
    }
  }
  exports.Minimatch = Minimatch;
  var ast_js_2 = require_ast();
  Object.defineProperty(exports, "AST", { enumerable: true, get: function() {
    return ast_js_2.AST;
  } });
  var escape_js_2 = require_escape();
  Object.defineProperty(exports, "escape", { enumerable: true, get: function() {
    return escape_js_2.escape;
  } });
  var unescape_js_2 = require_unescape();
  Object.defineProperty(exports, "unescape", { enumerable: true, get: function() {
    return unescape_js_2.unescape;
  } });
  exports.minimatch.AST = ast_js_1.AST;
  exports.minimatch.Minimatch = Minimatch;
  exports.minimatch.escape = escape_js_1.escape;
  exports.minimatch.unescape = unescape_js_1.unescape;
});

// node_modules/lru-cache/dist/commonjs/index.js
var require_commonjs4 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.LRUCache = undefined;
  var defaultPerf = typeof performance === "object" && performance && typeof performance.now === "function" ? performance : Date;
  var warned = new Set;
  var PROCESS = typeof process === "object" && !!process ? process : {};
  var emitWarning = (msg, type, code, fn) => {
    typeof PROCESS.emitWarning === "function" ? PROCESS.emitWarning(msg, type, code, fn) : console.error(`[${code}] ${type}: ${msg}`);
  };
  var AC = globalThis.AbortController;
  var AS = globalThis.AbortSignal;
  if (typeof AC === "undefined") {
    AS = class AbortSignal {
      onabort;
      _onabort = [];
      reason;
      aborted = false;
      addEventListener(_, fn) {
        this._onabort.push(fn);
      }
    };
    AC = class AbortController {
      constructor() {
        warnACPolyfill();
      }
      signal = new AS;
      abort(reason) {
        if (this.signal.aborted)
          return;
        this.signal.reason = reason;
        this.signal.aborted = true;
        for (const fn of this.signal._onabort) {
          fn(reason);
        }
        this.signal.onabort?.(reason);
      }
    };
    let printACPolyfillWarning = PROCESS.env?.LRU_CACHE_IGNORE_AC_WARNING !== "1";
    const warnACPolyfill = () => {
      if (!printACPolyfillWarning)
        return;
      printACPolyfillWarning = false;
      emitWarning("AbortController is not defined. If using lru-cache in " + "node 14, load an AbortController polyfill from the " + "`node-abort-controller` package. A minimal polyfill is " + "provided for use by LRUCache.fetch(), but it should not be " + "relied upon in other contexts (eg, passing it to other APIs that " + "use AbortController/AbortSignal might have undesirable effects). " + "You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", warnACPolyfill);
    };
  }
  var shouldWarn = (code) => !warned.has(code);
  var TYPE = Symbol("type");
  var isPosInt = (n) => n && n === Math.floor(n) && n > 0 && isFinite(n);
  var getUintArray = (max) => !isPosInt(max) ? null : max <= Math.pow(2, 8) ? Uint8Array : max <= Math.pow(2, 16) ? Uint16Array : max <= Math.pow(2, 32) ? Uint32Array : max <= Number.MAX_SAFE_INTEGER ? ZeroArray : null;

  class ZeroArray extends Array {
    constructor(size) {
      super(size);
      this.fill(0);
    }
  }

  class Stack {
    heap;
    length;
    static #constructing = false;
    static create(max) {
      const HeapCls = getUintArray(max);
      if (!HeapCls)
        return [];
      Stack.#constructing = true;
      const s = new Stack(max, HeapCls);
      Stack.#constructing = false;
      return s;
    }
    constructor(max, HeapCls) {
      if (!Stack.#constructing) {
        throw new TypeError("instantiate Stack using Stack.create(n)");
      }
      this.heap = new HeapCls(max);
      this.length = 0;
    }
    push(n) {
      this.heap[this.length++] = n;
    }
    pop() {
      return this.heap[--this.length];
    }
  }

  class LRUCache {
    #max;
    #maxSize;
    #dispose;
    #onInsert;
    #disposeAfter;
    #fetchMethod;
    #memoMethod;
    #perf;
    get perf() {
      return this.#perf;
    }
    ttl;
    ttlResolution;
    ttlAutopurge;
    updateAgeOnGet;
    updateAgeOnHas;
    allowStale;
    noDisposeOnSet;
    noUpdateTTL;
    maxEntrySize;
    sizeCalculation;
    noDeleteOnFetchRejection;
    noDeleteOnStaleGet;
    allowStaleOnFetchAbort;
    allowStaleOnFetchRejection;
    ignoreFetchAbort;
    #size;
    #calculatedSize;
    #keyMap;
    #keyList;
    #valList;
    #next;
    #prev;
    #head;
    #tail;
    #free;
    #disposed;
    #sizes;
    #starts;
    #ttls;
    #autopurgeTimers;
    #hasDispose;
    #hasFetchMethod;
    #hasDisposeAfter;
    #hasOnInsert;
    static unsafeExposeInternals(c) {
      return {
        starts: c.#starts,
        ttls: c.#ttls,
        autopurgeTimers: c.#autopurgeTimers,
        sizes: c.#sizes,
        keyMap: c.#keyMap,
        keyList: c.#keyList,
        valList: c.#valList,
        next: c.#next,
        prev: c.#prev,
        get head() {
          return c.#head;
        },
        get tail() {
          return c.#tail;
        },
        free: c.#free,
        isBackgroundFetch: (p) => c.#isBackgroundFetch(p),
        backgroundFetch: (k, index, options, context) => c.#backgroundFetch(k, index, options, context),
        moveToTail: (index) => c.#moveToTail(index),
        indexes: (options) => c.#indexes(options),
        rindexes: (options) => c.#rindexes(options),
        isStale: (index) => c.#isStale(index)
      };
    }
    get max() {
      return this.#max;
    }
    get maxSize() {
      return this.#maxSize;
    }
    get calculatedSize() {
      return this.#calculatedSize;
    }
    get size() {
      return this.#size;
    }
    get fetchMethod() {
      return this.#fetchMethod;
    }
    get memoMethod() {
      return this.#memoMethod;
    }
    get dispose() {
      return this.#dispose;
    }
    get onInsert() {
      return this.#onInsert;
    }
    get disposeAfter() {
      return this.#disposeAfter;
    }
    constructor(options) {
      const { max = 0, ttl, ttlResolution = 1, ttlAutopurge, updateAgeOnGet, updateAgeOnHas, allowStale, dispose, onInsert, disposeAfter, noDisposeOnSet, noUpdateTTL, maxSize = 0, maxEntrySize = 0, sizeCalculation, fetchMethod, memoMethod, noDeleteOnFetchRejection, noDeleteOnStaleGet, allowStaleOnFetchRejection, allowStaleOnFetchAbort, ignoreFetchAbort, perf } = options;
      if (perf !== undefined) {
        if (typeof perf?.now !== "function") {
          throw new TypeError("perf option must have a now() method if specified");
        }
      }
      this.#perf = perf ?? defaultPerf;
      if (max !== 0 && !isPosInt(max)) {
        throw new TypeError("max option must be a nonnegative integer");
      }
      const UintArray = max ? getUintArray(max) : Array;
      if (!UintArray) {
        throw new Error("invalid max value: " + max);
      }
      this.#max = max;
      this.#maxSize = maxSize;
      this.maxEntrySize = maxEntrySize || this.#maxSize;
      this.sizeCalculation = sizeCalculation;
      if (this.sizeCalculation) {
        if (!this.#maxSize && !this.maxEntrySize) {
          throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
        }
        if (typeof this.sizeCalculation !== "function") {
          throw new TypeError("sizeCalculation set to non-function");
        }
      }
      if (memoMethod !== undefined && typeof memoMethod !== "function") {
        throw new TypeError("memoMethod must be a function if defined");
      }
      this.#memoMethod = memoMethod;
      if (fetchMethod !== undefined && typeof fetchMethod !== "function") {
        throw new TypeError("fetchMethod must be a function if specified");
      }
      this.#fetchMethod = fetchMethod;
      this.#hasFetchMethod = !!fetchMethod;
      this.#keyMap = new Map;
      this.#keyList = new Array(max).fill(undefined);
      this.#valList = new Array(max).fill(undefined);
      this.#next = new UintArray(max);
      this.#prev = new UintArray(max);
      this.#head = 0;
      this.#tail = 0;
      this.#free = Stack.create(max);
      this.#size = 0;
      this.#calculatedSize = 0;
      if (typeof dispose === "function") {
        this.#dispose = dispose;
      }
      if (typeof onInsert === "function") {
        this.#onInsert = onInsert;
      }
      if (typeof disposeAfter === "function") {
        this.#disposeAfter = disposeAfter;
        this.#disposed = [];
      } else {
        this.#disposeAfter = undefined;
        this.#disposed = undefined;
      }
      this.#hasDispose = !!this.#dispose;
      this.#hasOnInsert = !!this.#onInsert;
      this.#hasDisposeAfter = !!this.#disposeAfter;
      this.noDisposeOnSet = !!noDisposeOnSet;
      this.noUpdateTTL = !!noUpdateTTL;
      this.noDeleteOnFetchRejection = !!noDeleteOnFetchRejection;
      this.allowStaleOnFetchRejection = !!allowStaleOnFetchRejection;
      this.allowStaleOnFetchAbort = !!allowStaleOnFetchAbort;
      this.ignoreFetchAbort = !!ignoreFetchAbort;
      if (this.maxEntrySize !== 0) {
        if (this.#maxSize !== 0) {
          if (!isPosInt(this.#maxSize)) {
            throw new TypeError("maxSize must be a positive integer if specified");
          }
        }
        if (!isPosInt(this.maxEntrySize)) {
          throw new TypeError("maxEntrySize must be a positive integer if specified");
        }
        this.#initializeSizeTracking();
      }
      this.allowStale = !!allowStale;
      this.noDeleteOnStaleGet = !!noDeleteOnStaleGet;
      this.updateAgeOnGet = !!updateAgeOnGet;
      this.updateAgeOnHas = !!updateAgeOnHas;
      this.ttlResolution = isPosInt(ttlResolution) || ttlResolution === 0 ? ttlResolution : 1;
      this.ttlAutopurge = !!ttlAutopurge;
      this.ttl = ttl || 0;
      if (this.ttl) {
        if (!isPosInt(this.ttl)) {
          throw new TypeError("ttl must be a positive integer if specified");
        }
        this.#initializeTTLTracking();
      }
      if (this.#max === 0 && this.ttl === 0 && this.#maxSize === 0) {
        throw new TypeError("At least one of max, maxSize, or ttl is required");
      }
      if (!this.ttlAutopurge && !this.#max && !this.#maxSize) {
        const code = "LRU_CACHE_UNBOUNDED";
        if (shouldWarn(code)) {
          warned.add(code);
          const msg = "TTL caching without ttlAutopurge, max, or maxSize can " + "result in unbounded memory consumption.";
          emitWarning(msg, "UnboundedCacheWarning", code, LRUCache);
        }
      }
    }
    getRemainingTTL(key) {
      return this.#keyMap.has(key) ? Infinity : 0;
    }
    #initializeTTLTracking() {
      const ttls = new ZeroArray(this.#max);
      const starts = new ZeroArray(this.#max);
      this.#ttls = ttls;
      this.#starts = starts;
      const purgeTimers = this.ttlAutopurge ? new Array(this.#max) : undefined;
      this.#autopurgeTimers = purgeTimers;
      this.#setItemTTL = (index, ttl, start = this.#perf.now()) => {
        starts[index] = ttl !== 0 ? start : 0;
        ttls[index] = ttl;
        if (purgeTimers?.[index]) {
          clearTimeout(purgeTimers[index]);
          purgeTimers[index] = undefined;
        }
        if (ttl !== 0 && purgeTimers) {
          const t = setTimeout(() => {
            if (this.#isStale(index)) {
              this.#delete(this.#keyList[index], "expire");
            }
          }, ttl + 1);
          if (t.unref) {
            t.unref();
          }
          purgeTimers[index] = t;
        }
      };
      this.#updateItemAge = (index) => {
        starts[index] = ttls[index] !== 0 ? this.#perf.now() : 0;
      };
      this.#statusTTL = (status, index) => {
        if (ttls[index]) {
          const ttl = ttls[index];
          const start = starts[index];
          if (!ttl || !start)
            return;
          status.ttl = ttl;
          status.start = start;
          status.now = cachedNow || getNow();
          const age = status.now - start;
          status.remainingTTL = ttl - age;
        }
      };
      let cachedNow = 0;
      const getNow = () => {
        const n = this.#perf.now();
        if (this.ttlResolution > 0) {
          cachedNow = n;
          const t = setTimeout(() => cachedNow = 0, this.ttlResolution);
          if (t.unref) {
            t.unref();
          }
        }
        return n;
      };
      this.getRemainingTTL = (key) => {
        const index = this.#keyMap.get(key);
        if (index === undefined) {
          return 0;
        }
        const ttl = ttls[index];
        const start = starts[index];
        if (!ttl || !start) {
          return Infinity;
        }
        const age = (cachedNow || getNow()) - start;
        return ttl - age;
      };
      this.#isStale = (index) => {
        const s = starts[index];
        const t = ttls[index];
        return !!t && !!s && (cachedNow || getNow()) - s > t;
      };
    }
    #updateItemAge = () => {};
    #statusTTL = () => {};
    #setItemTTL = () => {};
    #isStale = () => false;
    #initializeSizeTracking() {
      const sizes = new ZeroArray(this.#max);
      this.#calculatedSize = 0;
      this.#sizes = sizes;
      this.#removeItemSize = (index) => {
        this.#calculatedSize -= sizes[index];
        sizes[index] = 0;
      };
      this.#requireSize = (k, v, size, sizeCalculation) => {
        if (this.#isBackgroundFetch(v)) {
          return 0;
        }
        if (!isPosInt(size)) {
          if (sizeCalculation) {
            if (typeof sizeCalculation !== "function") {
              throw new TypeError("sizeCalculation must be a function");
            }
            size = sizeCalculation(v, k);
            if (!isPosInt(size)) {
              throw new TypeError("sizeCalculation return invalid (expect positive integer)");
            }
          } else {
            throw new TypeError("invalid size value (must be positive integer). " + "When maxSize or maxEntrySize is used, sizeCalculation " + "or size must be set.");
          }
        }
        return size;
      };
      this.#addItemSize = (index, size, status) => {
        sizes[index] = size;
        if (this.#maxSize) {
          const maxSize = this.#maxSize - sizes[index];
          while (this.#calculatedSize > maxSize) {
            this.#evict(true);
          }
        }
        this.#calculatedSize += sizes[index];
        if (status) {
          status.entrySize = size;
          status.totalCalculatedSize = this.#calculatedSize;
        }
      };
    }
    #removeItemSize = (_i) => {};
    #addItemSize = (_i, _s, _st) => {};
    #requireSize = (_k, _v, size, sizeCalculation) => {
      if (size || sizeCalculation) {
        throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
      }
      return 0;
    };
    *#indexes({ allowStale = this.allowStale } = {}) {
      if (this.#size) {
        for (let i = this.#tail;; ) {
          if (!this.#isValidIndex(i)) {
            break;
          }
          if (allowStale || !this.#isStale(i)) {
            yield i;
          }
          if (i === this.#head) {
            break;
          } else {
            i = this.#prev[i];
          }
        }
      }
    }
    *#rindexes({ allowStale = this.allowStale } = {}) {
      if (this.#size) {
        for (let i = this.#head;; ) {
          if (!this.#isValidIndex(i)) {
            break;
          }
          if (allowStale || !this.#isStale(i)) {
            yield i;
          }
          if (i === this.#tail) {
            break;
          } else {
            i = this.#next[i];
          }
        }
      }
    }
    #isValidIndex(index) {
      return index !== undefined && this.#keyMap.get(this.#keyList[index]) === index;
    }
    *entries() {
      for (const i of this.#indexes()) {
        if (this.#valList[i] !== undefined && this.#keyList[i] !== undefined && !this.#isBackgroundFetch(this.#valList[i])) {
          yield [this.#keyList[i], this.#valList[i]];
        }
      }
    }
    *rentries() {
      for (const i of this.#rindexes()) {
        if (this.#valList[i] !== undefined && this.#keyList[i] !== undefined && !this.#isBackgroundFetch(this.#valList[i])) {
          yield [this.#keyList[i], this.#valList[i]];
        }
      }
    }
    *keys() {
      for (const i of this.#indexes()) {
        const k = this.#keyList[i];
        if (k !== undefined && !this.#isBackgroundFetch(this.#valList[i])) {
          yield k;
        }
      }
    }
    *rkeys() {
      for (const i of this.#rindexes()) {
        const k = this.#keyList[i];
        if (k !== undefined && !this.#isBackgroundFetch(this.#valList[i])) {
          yield k;
        }
      }
    }
    *values() {
      for (const i of this.#indexes()) {
        const v = this.#valList[i];
        if (v !== undefined && !this.#isBackgroundFetch(this.#valList[i])) {
          yield this.#valList[i];
        }
      }
    }
    *rvalues() {
      for (const i of this.#rindexes()) {
        const v = this.#valList[i];
        if (v !== undefined && !this.#isBackgroundFetch(this.#valList[i])) {
          yield this.#valList[i];
        }
      }
    }
    [Symbol.iterator]() {
      return this.entries();
    }
    [Symbol.toStringTag] = "LRUCache";
    find(fn, getOptions = {}) {
      for (const i of this.#indexes()) {
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === undefined)
          continue;
        if (fn(value, this.#keyList[i], this)) {
          return this.get(this.#keyList[i], getOptions);
        }
      }
    }
    forEach(fn, thisp = this) {
      for (const i of this.#indexes()) {
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === undefined)
          continue;
        fn.call(thisp, value, this.#keyList[i], this);
      }
    }
    rforEach(fn, thisp = this) {
      for (const i of this.#rindexes()) {
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === undefined)
          continue;
        fn.call(thisp, value, this.#keyList[i], this);
      }
    }
    purgeStale() {
      let deleted = false;
      for (const i of this.#rindexes({ allowStale: true })) {
        if (this.#isStale(i)) {
          this.#delete(this.#keyList[i], "expire");
          deleted = true;
        }
      }
      return deleted;
    }
    info(key) {
      const i = this.#keyMap.get(key);
      if (i === undefined)
        return;
      const v = this.#valList[i];
      const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
      if (value === undefined)
        return;
      const entry = { value };
      if (this.#ttls && this.#starts) {
        const ttl = this.#ttls[i];
        const start = this.#starts[i];
        if (ttl && start) {
          const remain = ttl - (this.#perf.now() - start);
          entry.ttl = remain;
          entry.start = Date.now();
        }
      }
      if (this.#sizes) {
        entry.size = this.#sizes[i];
      }
      return entry;
    }
    dump() {
      const arr = [];
      for (const i of this.#indexes({ allowStale: true })) {
        const key = this.#keyList[i];
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === undefined || key === undefined)
          continue;
        const entry = { value };
        if (this.#ttls && this.#starts) {
          entry.ttl = this.#ttls[i];
          const age = this.#perf.now() - this.#starts[i];
          entry.start = Math.floor(Date.now() - age);
        }
        if (this.#sizes) {
          entry.size = this.#sizes[i];
        }
        arr.unshift([key, entry]);
      }
      return arr;
    }
    load(arr) {
      this.clear();
      for (const [key, entry] of arr) {
        if (entry.start) {
          const age = Date.now() - entry.start;
          entry.start = this.#perf.now() - age;
        }
        this.set(key, entry.value, entry);
      }
    }
    set(k, v, setOptions = {}) {
      if (v === undefined) {
        this.delete(k);
        return this;
      }
      const { ttl = this.ttl, start, noDisposeOnSet = this.noDisposeOnSet, sizeCalculation = this.sizeCalculation, status } = setOptions;
      let { noUpdateTTL = this.noUpdateTTL } = setOptions;
      const size = this.#requireSize(k, v, setOptions.size || 0, sizeCalculation);
      if (this.maxEntrySize && size > this.maxEntrySize) {
        if (status) {
          status.set = "miss";
          status.maxEntrySizeExceeded = true;
        }
        this.#delete(k, "set");
        return this;
      }
      let index = this.#size === 0 ? undefined : this.#keyMap.get(k);
      if (index === undefined) {
        index = this.#size === 0 ? this.#tail : this.#free.length !== 0 ? this.#free.pop() : this.#size === this.#max ? this.#evict(false) : this.#size;
        this.#keyList[index] = k;
        this.#valList[index] = v;
        this.#keyMap.set(k, index);
        this.#next[this.#tail] = index;
        this.#prev[index] = this.#tail;
        this.#tail = index;
        this.#size++;
        this.#addItemSize(index, size, status);
        if (status)
          status.set = "add";
        noUpdateTTL = false;
        if (this.#hasOnInsert) {
          this.#onInsert?.(v, k, "add");
        }
      } else {
        this.#moveToTail(index);
        const oldVal = this.#valList[index];
        if (v !== oldVal) {
          if (this.#hasFetchMethod && this.#isBackgroundFetch(oldVal)) {
            oldVal.__abortController.abort(new Error("replaced"));
            const { __staleWhileFetching: s } = oldVal;
            if (s !== undefined && !noDisposeOnSet) {
              if (this.#hasDispose) {
                this.#dispose?.(s, k, "set");
              }
              if (this.#hasDisposeAfter) {
                this.#disposed?.push([s, k, "set"]);
              }
            }
          } else if (!noDisposeOnSet) {
            if (this.#hasDispose) {
              this.#dispose?.(oldVal, k, "set");
            }
            if (this.#hasDisposeAfter) {
              this.#disposed?.push([oldVal, k, "set"]);
            }
          }
          this.#removeItemSize(index);
          this.#addItemSize(index, size, status);
          this.#valList[index] = v;
          if (status) {
            status.set = "replace";
            const oldValue = oldVal && this.#isBackgroundFetch(oldVal) ? oldVal.__staleWhileFetching : oldVal;
            if (oldValue !== undefined)
              status.oldValue = oldValue;
          }
        } else if (status) {
          status.set = "update";
        }
        if (this.#hasOnInsert) {
          this.onInsert?.(v, k, v === oldVal ? "update" : "replace");
        }
      }
      if (ttl !== 0 && !this.#ttls) {
        this.#initializeTTLTracking();
      }
      if (this.#ttls) {
        if (!noUpdateTTL) {
          this.#setItemTTL(index, ttl, start);
        }
        if (status)
          this.#statusTTL(status, index);
      }
      if (!noDisposeOnSet && this.#hasDisposeAfter && this.#disposed) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
      return this;
    }
    pop() {
      try {
        while (this.#size) {
          const val = this.#valList[this.#head];
          this.#evict(true);
          if (this.#isBackgroundFetch(val)) {
            if (val.__staleWhileFetching) {
              return val.__staleWhileFetching;
            }
          } else if (val !== undefined) {
            return val;
          }
        }
      } finally {
        if (this.#hasDisposeAfter && this.#disposed) {
          const dt = this.#disposed;
          let task;
          while (task = dt?.shift()) {
            this.#disposeAfter?.(...task);
          }
        }
      }
    }
    #evict(free) {
      const head = this.#head;
      const k = this.#keyList[head];
      const v = this.#valList[head];
      if (this.#hasFetchMethod && this.#isBackgroundFetch(v)) {
        v.__abortController.abort(new Error("evicted"));
      } else if (this.#hasDispose || this.#hasDisposeAfter) {
        if (this.#hasDispose) {
          this.#dispose?.(v, k, "evict");
        }
        if (this.#hasDisposeAfter) {
          this.#disposed?.push([v, k, "evict"]);
        }
      }
      this.#removeItemSize(head);
      if (this.#autopurgeTimers?.[head]) {
        clearTimeout(this.#autopurgeTimers[head]);
        this.#autopurgeTimers[head] = undefined;
      }
      if (free) {
        this.#keyList[head] = undefined;
        this.#valList[head] = undefined;
        this.#free.push(head);
      }
      if (this.#size === 1) {
        this.#head = this.#tail = 0;
        this.#free.length = 0;
      } else {
        this.#head = this.#next[head];
      }
      this.#keyMap.delete(k);
      this.#size--;
      return head;
    }
    has(k, hasOptions = {}) {
      const { updateAgeOnHas = this.updateAgeOnHas, status } = hasOptions;
      const index = this.#keyMap.get(k);
      if (index !== undefined) {
        const v = this.#valList[index];
        if (this.#isBackgroundFetch(v) && v.__staleWhileFetching === undefined) {
          return false;
        }
        if (!this.#isStale(index)) {
          if (updateAgeOnHas) {
            this.#updateItemAge(index);
          }
          if (status) {
            status.has = "hit";
            this.#statusTTL(status, index);
          }
          return true;
        } else if (status) {
          status.has = "stale";
          this.#statusTTL(status, index);
        }
      } else if (status) {
        status.has = "miss";
      }
      return false;
    }
    peek(k, peekOptions = {}) {
      const { allowStale = this.allowStale } = peekOptions;
      const index = this.#keyMap.get(k);
      if (index === undefined || !allowStale && this.#isStale(index)) {
        return;
      }
      const v = this.#valList[index];
      return this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
    }
    #backgroundFetch(k, index, options, context) {
      const v = index === undefined ? undefined : this.#valList[index];
      if (this.#isBackgroundFetch(v)) {
        return v;
      }
      const ac = new AC;
      const { signal } = options;
      signal?.addEventListener("abort", () => ac.abort(signal.reason), {
        signal: ac.signal
      });
      const fetchOpts = {
        signal: ac.signal,
        options,
        context
      };
      const cb = (v2, updateCache = false) => {
        const { aborted } = ac.signal;
        const ignoreAbort = options.ignoreFetchAbort && v2 !== undefined;
        if (options.status) {
          if (aborted && !updateCache) {
            options.status.fetchAborted = true;
            options.status.fetchError = ac.signal.reason;
            if (ignoreAbort)
              options.status.fetchAbortIgnored = true;
          } else {
            options.status.fetchResolved = true;
          }
        }
        if (aborted && !ignoreAbort && !updateCache) {
          return fetchFail(ac.signal.reason);
        }
        const bf2 = p;
        const vl = this.#valList[index];
        if (vl === p || ignoreAbort && updateCache && vl === undefined) {
          if (v2 === undefined) {
            if (bf2.__staleWhileFetching !== undefined) {
              this.#valList[index] = bf2.__staleWhileFetching;
            } else {
              this.#delete(k, "fetch");
            }
          } else {
            if (options.status)
              options.status.fetchUpdated = true;
            this.set(k, v2, fetchOpts.options);
          }
        }
        return v2;
      };
      const eb = (er) => {
        if (options.status) {
          options.status.fetchRejected = true;
          options.status.fetchError = er;
        }
        return fetchFail(er);
      };
      const fetchFail = (er) => {
        const { aborted } = ac.signal;
        const allowStaleAborted = aborted && options.allowStaleOnFetchAbort;
        const allowStale = allowStaleAborted || options.allowStaleOnFetchRejection;
        const noDelete = allowStale || options.noDeleteOnFetchRejection;
        const bf2 = p;
        if (this.#valList[index] === p) {
          const del = !noDelete || bf2.__staleWhileFetching === undefined;
          if (del) {
            this.#delete(k, "fetch");
          } else if (!allowStaleAborted) {
            this.#valList[index] = bf2.__staleWhileFetching;
          }
        }
        if (allowStale) {
          if (options.status && bf2.__staleWhileFetching !== undefined) {
            options.status.returnedStale = true;
          }
          return bf2.__staleWhileFetching;
        } else if (bf2.__returned === bf2) {
          throw er;
        }
      };
      const pcall = (res, rej) => {
        const fmp = this.#fetchMethod?.(k, v, fetchOpts);
        if (fmp && fmp instanceof Promise) {
          fmp.then((v2) => res(v2 === undefined ? undefined : v2), rej);
        }
        ac.signal.addEventListener("abort", () => {
          if (!options.ignoreFetchAbort || options.allowStaleOnFetchAbort) {
            res(undefined);
            if (options.allowStaleOnFetchAbort) {
              res = (v2) => cb(v2, true);
            }
          }
        });
      };
      if (options.status)
        options.status.fetchDispatched = true;
      const p = new Promise(pcall).then(cb, eb);
      const bf = Object.assign(p, {
        __abortController: ac,
        __staleWhileFetching: v,
        __returned: undefined
      });
      if (index === undefined) {
        this.set(k, bf, { ...fetchOpts.options, status: undefined });
        index = this.#keyMap.get(k);
      } else {
        this.#valList[index] = bf;
      }
      return bf;
    }
    #isBackgroundFetch(p) {
      if (!this.#hasFetchMethod)
        return false;
      const b = p;
      return !!b && b instanceof Promise && b.hasOwnProperty("__staleWhileFetching") && b.__abortController instanceof AC;
    }
    async fetch(k, fetchOptions = {}) {
      const {
        allowStale = this.allowStale,
        updateAgeOnGet = this.updateAgeOnGet,
        noDeleteOnStaleGet = this.noDeleteOnStaleGet,
        ttl = this.ttl,
        noDisposeOnSet = this.noDisposeOnSet,
        size = 0,
        sizeCalculation = this.sizeCalculation,
        noUpdateTTL = this.noUpdateTTL,
        noDeleteOnFetchRejection = this.noDeleteOnFetchRejection,
        allowStaleOnFetchRejection = this.allowStaleOnFetchRejection,
        ignoreFetchAbort = this.ignoreFetchAbort,
        allowStaleOnFetchAbort = this.allowStaleOnFetchAbort,
        context,
        forceRefresh = false,
        status,
        signal
      } = fetchOptions;
      if (!this.#hasFetchMethod) {
        if (status)
          status.fetch = "get";
        return this.get(k, {
          allowStale,
          updateAgeOnGet,
          noDeleteOnStaleGet,
          status
        });
      }
      const options = {
        allowStale,
        updateAgeOnGet,
        noDeleteOnStaleGet,
        ttl,
        noDisposeOnSet,
        size,
        sizeCalculation,
        noUpdateTTL,
        noDeleteOnFetchRejection,
        allowStaleOnFetchRejection,
        allowStaleOnFetchAbort,
        ignoreFetchAbort,
        status,
        signal
      };
      let index = this.#keyMap.get(k);
      if (index === undefined) {
        if (status)
          status.fetch = "miss";
        const p = this.#backgroundFetch(k, index, options, context);
        return p.__returned = p;
      } else {
        const v = this.#valList[index];
        if (this.#isBackgroundFetch(v)) {
          const stale = allowStale && v.__staleWhileFetching !== undefined;
          if (status) {
            status.fetch = "inflight";
            if (stale)
              status.returnedStale = true;
          }
          return stale ? v.__staleWhileFetching : v.__returned = v;
        }
        const isStale = this.#isStale(index);
        if (!forceRefresh && !isStale) {
          if (status)
            status.fetch = "hit";
          this.#moveToTail(index);
          if (updateAgeOnGet) {
            this.#updateItemAge(index);
          }
          if (status)
            this.#statusTTL(status, index);
          return v;
        }
        const p = this.#backgroundFetch(k, index, options, context);
        const hasStale = p.__staleWhileFetching !== undefined;
        const staleVal = hasStale && allowStale;
        if (status) {
          status.fetch = isStale ? "stale" : "refresh";
          if (staleVal && isStale)
            status.returnedStale = true;
        }
        return staleVal ? p.__staleWhileFetching : p.__returned = p;
      }
    }
    async forceFetch(k, fetchOptions = {}) {
      const v = await this.fetch(k, fetchOptions);
      if (v === undefined)
        throw new Error("fetch() returned undefined");
      return v;
    }
    memo(k, memoOptions = {}) {
      const memoMethod = this.#memoMethod;
      if (!memoMethod) {
        throw new Error("no memoMethod provided to constructor");
      }
      const { context, forceRefresh, ...options } = memoOptions;
      const v = this.get(k, options);
      if (!forceRefresh && v !== undefined)
        return v;
      const vv = memoMethod(k, v, {
        options,
        context
      });
      this.set(k, vv, options);
      return vv;
    }
    get(k, getOptions = {}) {
      const { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, status } = getOptions;
      const index = this.#keyMap.get(k);
      if (index !== undefined) {
        const value = this.#valList[index];
        const fetching = this.#isBackgroundFetch(value);
        if (status)
          this.#statusTTL(status, index);
        if (this.#isStale(index)) {
          if (status)
            status.get = "stale";
          if (!fetching) {
            if (!noDeleteOnStaleGet) {
              this.#delete(k, "expire");
            }
            if (status && allowStale)
              status.returnedStale = true;
            return allowStale ? value : undefined;
          } else {
            if (status && allowStale && value.__staleWhileFetching !== undefined) {
              status.returnedStale = true;
            }
            return allowStale ? value.__staleWhileFetching : undefined;
          }
        } else {
          if (status)
            status.get = "hit";
          if (fetching) {
            return value.__staleWhileFetching;
          }
          this.#moveToTail(index);
          if (updateAgeOnGet) {
            this.#updateItemAge(index);
          }
          return value;
        }
      } else if (status) {
        status.get = "miss";
      }
    }
    #connect(p, n) {
      this.#prev[n] = p;
      this.#next[p] = n;
    }
    #moveToTail(index) {
      if (index !== this.#tail) {
        if (index === this.#head) {
          this.#head = this.#next[index];
        } else {
          this.#connect(this.#prev[index], this.#next[index]);
        }
        this.#connect(this.#tail, index);
        this.#tail = index;
      }
    }
    delete(k) {
      return this.#delete(k, "delete");
    }
    #delete(k, reason) {
      let deleted = false;
      if (this.#size !== 0) {
        const index = this.#keyMap.get(k);
        if (index !== undefined) {
          if (this.#autopurgeTimers?.[index]) {
            clearTimeout(this.#autopurgeTimers?.[index]);
            this.#autopurgeTimers[index] = undefined;
          }
          deleted = true;
          if (this.#size === 1) {
            this.#clear(reason);
          } else {
            this.#removeItemSize(index);
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v)) {
              v.__abortController.abort(new Error("deleted"));
            } else if (this.#hasDispose || this.#hasDisposeAfter) {
              if (this.#hasDispose) {
                this.#dispose?.(v, k, reason);
              }
              if (this.#hasDisposeAfter) {
                this.#disposed?.push([v, k, reason]);
              }
            }
            this.#keyMap.delete(k);
            this.#keyList[index] = undefined;
            this.#valList[index] = undefined;
            if (index === this.#tail) {
              this.#tail = this.#prev[index];
            } else if (index === this.#head) {
              this.#head = this.#next[index];
            } else {
              const pi = this.#prev[index];
              this.#next[pi] = this.#next[index];
              const ni = this.#next[index];
              this.#prev[ni] = this.#prev[index];
            }
            this.#size--;
            this.#free.push(index);
          }
        }
      }
      if (this.#hasDisposeAfter && this.#disposed?.length) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
      return deleted;
    }
    clear() {
      return this.#clear("delete");
    }
    #clear(reason) {
      for (const index of this.#rindexes({ allowStale: true })) {
        const v = this.#valList[index];
        if (this.#isBackgroundFetch(v)) {
          v.__abortController.abort(new Error("deleted"));
        } else {
          const k = this.#keyList[index];
          if (this.#hasDispose) {
            this.#dispose?.(v, k, reason);
          }
          if (this.#hasDisposeAfter) {
            this.#disposed?.push([v, k, reason]);
          }
        }
      }
      this.#keyMap.clear();
      this.#valList.fill(undefined);
      this.#keyList.fill(undefined);
      if (this.#ttls && this.#starts) {
        this.#ttls.fill(0);
        this.#starts.fill(0);
        for (const t of this.#autopurgeTimers ?? []) {
          if (t !== undefined)
            clearTimeout(t);
        }
        this.#autopurgeTimers?.fill(undefined);
      }
      if (this.#sizes) {
        this.#sizes.fill(0);
      }
      this.#head = 0;
      this.#tail = 0;
      this.#free.length = 0;
      this.#calculatedSize = 0;
      this.#size = 0;
      if (this.#hasDisposeAfter && this.#disposed) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
    }
  }
  exports.LRUCache = LRUCache;
});

// node_modules/minipass/dist/commonjs/index.js
var require_commonjs5 = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Minipass = exports.isWritable = exports.isReadable = exports.isStream = undefined;
  var proc = typeof process === "object" && process ? process : {
    stdout: null,
    stderr: null
  };
  var node_events_1 = __require("events");
  var node_stream_1 = __importDefault(__require("stream"));
  var node_string_decoder_1 = __require("string_decoder");
  var isStream = (s) => !!s && typeof s === "object" && (s instanceof Minipass || s instanceof node_stream_1.default || (0, exports.isReadable)(s) || (0, exports.isWritable)(s));
  exports.isStream = isStream;
  var isReadable = (s) => !!s && typeof s === "object" && s instanceof node_events_1.EventEmitter && typeof s.pipe === "function" && s.pipe !== node_stream_1.default.Writable.prototype.pipe;
  exports.isReadable = isReadable;
  var isWritable = (s) => !!s && typeof s === "object" && s instanceof node_events_1.EventEmitter && typeof s.write === "function" && typeof s.end === "function";
  exports.isWritable = isWritable;
  var EOF = Symbol("EOF");
  var MAYBE_EMIT_END = Symbol("maybeEmitEnd");
  var EMITTED_END = Symbol("emittedEnd");
  var EMITTING_END = Symbol("emittingEnd");
  var EMITTED_ERROR = Symbol("emittedError");
  var CLOSED = Symbol("closed");
  var READ = Symbol("read");
  var FLUSH = Symbol("flush");
  var FLUSHCHUNK = Symbol("flushChunk");
  var ENCODING = Symbol("encoding");
  var DECODER = Symbol("decoder");
  var FLOWING = Symbol("flowing");
  var PAUSED = Symbol("paused");
  var RESUME = Symbol("resume");
  var BUFFER = Symbol("buffer");
  var PIPES = Symbol("pipes");
  var BUFFERLENGTH = Symbol("bufferLength");
  var BUFFERPUSH = Symbol("bufferPush");
  var BUFFERSHIFT = Symbol("bufferShift");
  var OBJECTMODE = Symbol("objectMode");
  var DESTROYED = Symbol("destroyed");
  var ERROR = Symbol("error");
  var EMITDATA = Symbol("emitData");
  var EMITEND = Symbol("emitEnd");
  var EMITEND2 = Symbol("emitEnd2");
  var ASYNC = Symbol("async");
  var ABORT = Symbol("abort");
  var ABORTED = Symbol("aborted");
  var SIGNAL = Symbol("signal");
  var DATALISTENERS = Symbol("dataListeners");
  var DISCARDED = Symbol("discarded");
  var defer = (fn) => Promise.resolve().then(fn);
  var nodefer = (fn) => fn();
  var isEndish = (ev) => ev === "end" || ev === "finish" || ev === "prefinish";
  var isArrayBufferLike = (b) => b instanceof ArrayBuffer || !!b && typeof b === "object" && b.constructor && b.constructor.name === "ArrayBuffer" && b.byteLength >= 0;
  var isArrayBufferView = (b) => !Buffer.isBuffer(b) && ArrayBuffer.isView(b);

  class Pipe {
    src;
    dest;
    opts;
    ondrain;
    constructor(src, dest, opts) {
      this.src = src;
      this.dest = dest;
      this.opts = opts;
      this.ondrain = () => src[RESUME]();
      this.dest.on("drain", this.ondrain);
    }
    unpipe() {
      this.dest.removeListener("drain", this.ondrain);
    }
    proxyErrors(_er) {}
    end() {
      this.unpipe();
      if (this.opts.end)
        this.dest.end();
    }
  }

  class PipeProxyErrors extends Pipe {
    unpipe() {
      this.src.removeListener("error", this.proxyErrors);
      super.unpipe();
    }
    constructor(src, dest, opts) {
      super(src, dest, opts);
      this.proxyErrors = (er) => dest.emit("error", er);
      src.on("error", this.proxyErrors);
    }
  }
  var isObjectModeOptions = (o) => !!o.objectMode;
  var isEncodingOptions = (o) => !o.objectMode && !!o.encoding && o.encoding !== "buffer";

  class Minipass extends node_events_1.EventEmitter {
    [FLOWING] = false;
    [PAUSED] = false;
    [PIPES] = [];
    [BUFFER] = [];
    [OBJECTMODE];
    [ENCODING];
    [ASYNC];
    [DECODER];
    [EOF] = false;
    [EMITTED_END] = false;
    [EMITTING_END] = false;
    [CLOSED] = false;
    [EMITTED_ERROR] = null;
    [BUFFERLENGTH] = 0;
    [DESTROYED] = false;
    [SIGNAL];
    [ABORTED] = false;
    [DATALISTENERS] = 0;
    [DISCARDED] = false;
    writable = true;
    readable = true;
    constructor(...args) {
      const options = args[0] || {};
      super();
      if (options.objectMode && typeof options.encoding === "string") {
        throw new TypeError("Encoding and objectMode may not be used together");
      }
      if (isObjectModeOptions(options)) {
        this[OBJECTMODE] = true;
        this[ENCODING] = null;
      } else if (isEncodingOptions(options)) {
        this[ENCODING] = options.encoding;
        this[OBJECTMODE] = false;
      } else {
        this[OBJECTMODE] = false;
        this[ENCODING] = null;
      }
      this[ASYNC] = !!options.async;
      this[DECODER] = this[ENCODING] ? new node_string_decoder_1.StringDecoder(this[ENCODING]) : null;
      if (options && options.debugExposeBuffer === true) {
        Object.defineProperty(this, "buffer", { get: () => this[BUFFER] });
      }
      if (options && options.debugExposePipes === true) {
        Object.defineProperty(this, "pipes", { get: () => this[PIPES] });
      }
      const { signal } = options;
      if (signal) {
        this[SIGNAL] = signal;
        if (signal.aborted) {
          this[ABORT]();
        } else {
          signal.addEventListener("abort", () => this[ABORT]());
        }
      }
    }
    get bufferLength() {
      return this[BUFFERLENGTH];
    }
    get encoding() {
      return this[ENCODING];
    }
    set encoding(_enc) {
      throw new Error("Encoding must be set at instantiation time");
    }
    setEncoding(_enc) {
      throw new Error("Encoding must be set at instantiation time");
    }
    get objectMode() {
      return this[OBJECTMODE];
    }
    set objectMode(_om) {
      throw new Error("objectMode must be set at instantiation time");
    }
    get ["async"]() {
      return this[ASYNC];
    }
    set ["async"](a) {
      this[ASYNC] = this[ASYNC] || !!a;
    }
    [ABORT]() {
      this[ABORTED] = true;
      this.emit("abort", this[SIGNAL]?.reason);
      this.destroy(this[SIGNAL]?.reason);
    }
    get aborted() {
      return this[ABORTED];
    }
    set aborted(_) {}
    write(chunk, encoding, cb) {
      if (this[ABORTED])
        return false;
      if (this[EOF])
        throw new Error("write after end");
      if (this[DESTROYED]) {
        this.emit("error", Object.assign(new Error("Cannot call write after a stream was destroyed"), { code: "ERR_STREAM_DESTROYED" }));
        return true;
      }
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = "utf8";
      }
      if (!encoding)
        encoding = "utf8";
      const fn = this[ASYNC] ? defer : nodefer;
      if (!this[OBJECTMODE] && !Buffer.isBuffer(chunk)) {
        if (isArrayBufferView(chunk)) {
          chunk = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        } else if (isArrayBufferLike(chunk)) {
          chunk = Buffer.from(chunk);
        } else if (typeof chunk !== "string") {
          throw new Error("Non-contiguous data written to non-objectMode stream");
        }
      }
      if (this[OBJECTMODE]) {
        if (this[FLOWING] && this[BUFFERLENGTH] !== 0)
          this[FLUSH](true);
        if (this[FLOWING])
          this.emit("data", chunk);
        else
          this[BUFFERPUSH](chunk);
        if (this[BUFFERLENGTH] !== 0)
          this.emit("readable");
        if (cb)
          fn(cb);
        return this[FLOWING];
      }
      if (!chunk.length) {
        if (this[BUFFERLENGTH] !== 0)
          this.emit("readable");
        if (cb)
          fn(cb);
        return this[FLOWING];
      }
      if (typeof chunk === "string" && !(encoding === this[ENCODING] && !this[DECODER]?.lastNeed)) {
        chunk = Buffer.from(chunk, encoding);
      }
      if (Buffer.isBuffer(chunk) && this[ENCODING]) {
        chunk = this[DECODER].write(chunk);
      }
      if (this[FLOWING] && this[BUFFERLENGTH] !== 0)
        this[FLUSH](true);
      if (this[FLOWING])
        this.emit("data", chunk);
      else
        this[BUFFERPUSH](chunk);
      if (this[BUFFERLENGTH] !== 0)
        this.emit("readable");
      if (cb)
        fn(cb);
      return this[FLOWING];
    }
    read(n) {
      if (this[DESTROYED])
        return null;
      this[DISCARDED] = false;
      if (this[BUFFERLENGTH] === 0 || n === 0 || n && n > this[BUFFERLENGTH]) {
        this[MAYBE_EMIT_END]();
        return null;
      }
      if (this[OBJECTMODE])
        n = null;
      if (this[BUFFER].length > 1 && !this[OBJECTMODE]) {
        this[BUFFER] = [
          this[ENCODING] ? this[BUFFER].join("") : Buffer.concat(this[BUFFER], this[BUFFERLENGTH])
        ];
      }
      const ret = this[READ](n || null, this[BUFFER][0]);
      this[MAYBE_EMIT_END]();
      return ret;
    }
    [READ](n, chunk) {
      if (this[OBJECTMODE])
        this[BUFFERSHIFT]();
      else {
        const c = chunk;
        if (n === c.length || n === null)
          this[BUFFERSHIFT]();
        else if (typeof c === "string") {
          this[BUFFER][0] = c.slice(n);
          chunk = c.slice(0, n);
          this[BUFFERLENGTH] -= n;
        } else {
          this[BUFFER][0] = c.subarray(n);
          chunk = c.subarray(0, n);
          this[BUFFERLENGTH] -= n;
        }
      }
      this.emit("data", chunk);
      if (!this[BUFFER].length && !this[EOF])
        this.emit("drain");
      return chunk;
    }
    end(chunk, encoding, cb) {
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = undefined;
      }
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = "utf8";
      }
      if (chunk !== undefined)
        this.write(chunk, encoding);
      if (cb)
        this.once("end", cb);
      this[EOF] = true;
      this.writable = false;
      if (this[FLOWING] || !this[PAUSED])
        this[MAYBE_EMIT_END]();
      return this;
    }
    [RESUME]() {
      if (this[DESTROYED])
        return;
      if (!this[DATALISTENERS] && !this[PIPES].length) {
        this[DISCARDED] = true;
      }
      this[PAUSED] = false;
      this[FLOWING] = true;
      this.emit("resume");
      if (this[BUFFER].length)
        this[FLUSH]();
      else if (this[EOF])
        this[MAYBE_EMIT_END]();
      else
        this.emit("drain");
    }
    resume() {
      return this[RESUME]();
    }
    pause() {
      this[FLOWING] = false;
      this[PAUSED] = true;
      this[DISCARDED] = false;
    }
    get destroyed() {
      return this[DESTROYED];
    }
    get flowing() {
      return this[FLOWING];
    }
    get paused() {
      return this[PAUSED];
    }
    [BUFFERPUSH](chunk) {
      if (this[OBJECTMODE])
        this[BUFFERLENGTH] += 1;
      else
        this[BUFFERLENGTH] += chunk.length;
      this[BUFFER].push(chunk);
    }
    [BUFFERSHIFT]() {
      if (this[OBJECTMODE])
        this[BUFFERLENGTH] -= 1;
      else
        this[BUFFERLENGTH] -= this[BUFFER][0].length;
      return this[BUFFER].shift();
    }
    [FLUSH](noDrain = false) {
      do {} while (this[FLUSHCHUNK](this[BUFFERSHIFT]()) && this[BUFFER].length);
      if (!noDrain && !this[BUFFER].length && !this[EOF])
        this.emit("drain");
    }
    [FLUSHCHUNK](chunk) {
      this.emit("data", chunk);
      return this[FLOWING];
    }
    pipe(dest, opts) {
      if (this[DESTROYED])
        return dest;
      this[DISCARDED] = false;
      const ended = this[EMITTED_END];
      opts = opts || {};
      if (dest === proc.stdout || dest === proc.stderr)
        opts.end = false;
      else
        opts.end = opts.end !== false;
      opts.proxyErrors = !!opts.proxyErrors;
      if (ended) {
        if (opts.end)
          dest.end();
      } else {
        this[PIPES].push(!opts.proxyErrors ? new Pipe(this, dest, opts) : new PipeProxyErrors(this, dest, opts));
        if (this[ASYNC])
          defer(() => this[RESUME]());
        else
          this[RESUME]();
      }
      return dest;
    }
    unpipe(dest) {
      const p = this[PIPES].find((p2) => p2.dest === dest);
      if (p) {
        if (this[PIPES].length === 1) {
          if (this[FLOWING] && this[DATALISTENERS] === 0) {
            this[FLOWING] = false;
          }
          this[PIPES] = [];
        } else
          this[PIPES].splice(this[PIPES].indexOf(p), 1);
        p.unpipe();
      }
    }
    addListener(ev, handler) {
      return this.on(ev, handler);
    }
    on(ev, handler) {
      const ret = super.on(ev, handler);
      if (ev === "data") {
        this[DISCARDED] = false;
        this[DATALISTENERS]++;
        if (!this[PIPES].length && !this[FLOWING]) {
          this[RESUME]();
        }
      } else if (ev === "readable" && this[BUFFERLENGTH] !== 0) {
        super.emit("readable");
      } else if (isEndish(ev) && this[EMITTED_END]) {
        super.emit(ev);
        this.removeAllListeners(ev);
      } else if (ev === "error" && this[EMITTED_ERROR]) {
        const h = handler;
        if (this[ASYNC])
          defer(() => h.call(this, this[EMITTED_ERROR]));
        else
          h.call(this, this[EMITTED_ERROR]);
      }
      return ret;
    }
    removeListener(ev, handler) {
      return this.off(ev, handler);
    }
    off(ev, handler) {
      const ret = super.off(ev, handler);
      if (ev === "data") {
        this[DATALISTENERS] = this.listeners("data").length;
        if (this[DATALISTENERS] === 0 && !this[DISCARDED] && !this[PIPES].length) {
          this[FLOWING] = false;
        }
      }
      return ret;
    }
    removeAllListeners(ev) {
      const ret = super.removeAllListeners(ev);
      if (ev === "data" || ev === undefined) {
        this[DATALISTENERS] = 0;
        if (!this[DISCARDED] && !this[PIPES].length) {
          this[FLOWING] = false;
        }
      }
      return ret;
    }
    get emittedEnd() {
      return this[EMITTED_END];
    }
    [MAYBE_EMIT_END]() {
      if (!this[EMITTING_END] && !this[EMITTED_END] && !this[DESTROYED] && this[BUFFER].length === 0 && this[EOF]) {
        this[EMITTING_END] = true;
        this.emit("end");
        this.emit("prefinish");
        this.emit("finish");
        if (this[CLOSED])
          this.emit("close");
        this[EMITTING_END] = false;
      }
    }
    emit(ev, ...args) {
      const data = args[0];
      if (ev !== "error" && ev !== "close" && ev !== DESTROYED && this[DESTROYED]) {
        return false;
      } else if (ev === "data") {
        return !this[OBJECTMODE] && !data ? false : this[ASYNC] ? (defer(() => this[EMITDATA](data)), true) : this[EMITDATA](data);
      } else if (ev === "end") {
        return this[EMITEND]();
      } else if (ev === "close") {
        this[CLOSED] = true;
        if (!this[EMITTED_END] && !this[DESTROYED])
          return false;
        const ret2 = super.emit("close");
        this.removeAllListeners("close");
        return ret2;
      } else if (ev === "error") {
        this[EMITTED_ERROR] = data;
        super.emit(ERROR, data);
        const ret2 = !this[SIGNAL] || this.listeners("error").length ? super.emit("error", data) : false;
        this[MAYBE_EMIT_END]();
        return ret2;
      } else if (ev === "resume") {
        const ret2 = super.emit("resume");
        this[MAYBE_EMIT_END]();
        return ret2;
      } else if (ev === "finish" || ev === "prefinish") {
        const ret2 = super.emit(ev);
        this.removeAllListeners(ev);
        return ret2;
      }
      const ret = super.emit(ev, ...args);
      this[MAYBE_EMIT_END]();
      return ret;
    }
    [EMITDATA](data) {
      for (const p of this[PIPES]) {
        if (p.dest.write(data) === false)
          this.pause();
      }
      const ret = this[DISCARDED] ? false : super.emit("data", data);
      this[MAYBE_EMIT_END]();
      return ret;
    }
    [EMITEND]() {
      if (this[EMITTED_END])
        return false;
      this[EMITTED_END] = true;
      this.readable = false;
      return this[ASYNC] ? (defer(() => this[EMITEND2]()), true) : this[EMITEND2]();
    }
    [EMITEND2]() {
      if (this[DECODER]) {
        const data = this[DECODER].end();
        if (data) {
          for (const p of this[PIPES]) {
            p.dest.write(data);
          }
          if (!this[DISCARDED])
            super.emit("data", data);
        }
      }
      for (const p of this[PIPES]) {
        p.end();
      }
      const ret = super.emit("end");
      this.removeAllListeners("end");
      return ret;
    }
    async collect() {
      const buf = Object.assign([], {
        dataLength: 0
      });
      if (!this[OBJECTMODE])
        buf.dataLength = 0;
      const p = this.promise();
      this.on("data", (c) => {
        buf.push(c);
        if (!this[OBJECTMODE])
          buf.dataLength += c.length;
      });
      await p;
      return buf;
    }
    async concat() {
      if (this[OBJECTMODE]) {
        throw new Error("cannot concat in objectMode");
      }
      const buf = await this.collect();
      return this[ENCODING] ? buf.join("") : Buffer.concat(buf, buf.dataLength);
    }
    async promise() {
      return new Promise((resolve, reject) => {
        this.on(DESTROYED, () => reject(new Error("stream destroyed")));
        this.on("error", (er) => reject(er));
        this.on("end", () => resolve());
      });
    }
    [Symbol.asyncIterator]() {
      this[DISCARDED] = false;
      let stopped = false;
      const stop = async () => {
        this.pause();
        stopped = true;
        return { value: undefined, done: true };
      };
      const next = () => {
        if (stopped)
          return stop();
        const res = this.read();
        if (res !== null)
          return Promise.resolve({ done: false, value: res });
        if (this[EOF])
          return stop();
        let resolve;
        let reject;
        const onerr = (er) => {
          this.off("data", ondata);
          this.off("end", onend);
          this.off(DESTROYED, ondestroy);
          stop();
          reject(er);
        };
        const ondata = (value) => {
          this.off("error", onerr);
          this.off("end", onend);
          this.off(DESTROYED, ondestroy);
          this.pause();
          resolve({ value, done: !!this[EOF] });
        };
        const onend = () => {
          this.off("error", onerr);
          this.off("data", ondata);
          this.off(DESTROYED, ondestroy);
          stop();
          resolve({ done: true, value: undefined });
        };
        const ondestroy = () => onerr(new Error("stream destroyed"));
        return new Promise((res2, rej) => {
          reject = rej;
          resolve = res2;
          this.once(DESTROYED, ondestroy);
          this.once("error", onerr);
          this.once("end", onend);
          this.once("data", ondata);
        });
      };
      return {
        next,
        throw: stop,
        return: stop,
        [Symbol.asyncIterator]() {
          return this;
        }
      };
    }
    [Symbol.iterator]() {
      this[DISCARDED] = false;
      let stopped = false;
      const stop = () => {
        this.pause();
        this.off(ERROR, stop);
        this.off(DESTROYED, stop);
        this.off("end", stop);
        stopped = true;
        return { done: true, value: undefined };
      };
      const next = () => {
        if (stopped)
          return stop();
        const value = this.read();
        return value === null ? stop() : { done: false, value };
      };
      this.once("end", stop);
      this.once(ERROR, stop);
      this.once(DESTROYED, stop);
      return {
        next,
        throw: stop,
        return: stop,
        [Symbol.iterator]() {
          return this;
        }
      };
    }
    destroy(er) {
      if (this[DESTROYED]) {
        if (er)
          this.emit("error", er);
        else
          this.emit(DESTROYED);
        return this;
      }
      this[DESTROYED] = true;
      this[DISCARDED] = true;
      this[BUFFER].length = 0;
      this[BUFFERLENGTH] = 0;
      const wc = this;
      if (typeof wc.close === "function" && !this[CLOSED])
        wc.close();
      if (er)
        this.emit("error", er);
      else
        this.emit(DESTROYED);
      return this;
    }
    static get isStream() {
      return exports.isStream;
    }
  }
  exports.Minipass = Minipass;
});

// node_modules/path-scurry/dist/commonjs/index.js
var require_commonjs6 = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
  } : function(o, v) {
    o["default"] = v;
  });
  var __importStar = exports && exports.__importStar || function(mod) {
    if (mod && mod.__esModule)
      return mod;
    var result = {};
    if (mod != null) {
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.PathScurry = exports.Path = exports.PathScurryDarwin = exports.PathScurryPosix = exports.PathScurryWin32 = exports.PathScurryBase = exports.PathPosix = exports.PathWin32 = exports.PathBase = exports.ChildrenCache = exports.ResolveCache = undefined;
  var lru_cache_1 = require_commonjs4();
  var node_path_1 = __require("path");
  var node_url_1 = __require("url");
  var fs_1 = __require("fs");
  var actualFS = __importStar(__require("fs"));
  var realpathSync = fs_1.realpathSync.native;
  var promises_1 = __require("fs/promises");
  var minipass_1 = require_commonjs5();
  var defaultFS = {
    lstatSync: fs_1.lstatSync,
    readdir: fs_1.readdir,
    readdirSync: fs_1.readdirSync,
    readlinkSync: fs_1.readlinkSync,
    realpathSync,
    promises: {
      lstat: promises_1.lstat,
      readdir: promises_1.readdir,
      readlink: promises_1.readlink,
      realpath: promises_1.realpath
    }
  };
  var fsFromOption = (fsOption) => !fsOption || fsOption === defaultFS || fsOption === actualFS ? defaultFS : {
    ...defaultFS,
    ...fsOption,
    promises: {
      ...defaultFS.promises,
      ...fsOption.promises || {}
    }
  };
  var uncDriveRegexp = /^\\\\\?\\([a-z]:)\\?$/i;
  var uncToDrive = (rootPath) => rootPath.replace(/\//g, "\\").replace(uncDriveRegexp, "$1\\");
  var eitherSep = /[\\\/]/;
  var UNKNOWN = 0;
  var IFIFO = 1;
  var IFCHR = 2;
  var IFDIR = 4;
  var IFBLK = 6;
  var IFREG = 8;
  var IFLNK = 10;
  var IFSOCK = 12;
  var IFMT = 15;
  var IFMT_UNKNOWN = ~IFMT;
  var READDIR_CALLED = 16;
  var LSTAT_CALLED = 32;
  var ENOTDIR = 64;
  var ENOENT = 128;
  var ENOREADLINK = 256;
  var ENOREALPATH = 512;
  var ENOCHILD = ENOTDIR | ENOENT | ENOREALPATH;
  var TYPEMASK = 1023;
  var entToType = (s) => s.isFile() ? IFREG : s.isDirectory() ? IFDIR : s.isSymbolicLink() ? IFLNK : s.isCharacterDevice() ? IFCHR : s.isBlockDevice() ? IFBLK : s.isSocket() ? IFSOCK : s.isFIFO() ? IFIFO : UNKNOWN;
  var normalizeCache = new lru_cache_1.LRUCache({ max: 2 ** 12 });
  var normalize = (s) => {
    const c = normalizeCache.get(s);
    if (c)
      return c;
    const n = s.normalize("NFKD");
    normalizeCache.set(s, n);
    return n;
  };
  var normalizeNocaseCache = new lru_cache_1.LRUCache({ max: 2 ** 12 });
  var normalizeNocase = (s) => {
    const c = normalizeNocaseCache.get(s);
    if (c)
      return c;
    const n = normalize(s.toLowerCase());
    normalizeNocaseCache.set(s, n);
    return n;
  };

  class ResolveCache extends lru_cache_1.LRUCache {
    constructor() {
      super({ max: 256 });
    }
  }
  exports.ResolveCache = ResolveCache;

  class ChildrenCache extends lru_cache_1.LRUCache {
    constructor(maxSize = 16 * 1024) {
      super({
        maxSize,
        sizeCalculation: (a) => a.length + 1
      });
    }
  }
  exports.ChildrenCache = ChildrenCache;
  var setAsCwd = Symbol("PathScurry setAsCwd");

  class PathBase {
    name;
    root;
    roots;
    parent;
    nocase;
    isCWD = false;
    #fs;
    #dev;
    get dev() {
      return this.#dev;
    }
    #mode;
    get mode() {
      return this.#mode;
    }
    #nlink;
    get nlink() {
      return this.#nlink;
    }
    #uid;
    get uid() {
      return this.#uid;
    }
    #gid;
    get gid() {
      return this.#gid;
    }
    #rdev;
    get rdev() {
      return this.#rdev;
    }
    #blksize;
    get blksize() {
      return this.#blksize;
    }
    #ino;
    get ino() {
      return this.#ino;
    }
    #size;
    get size() {
      return this.#size;
    }
    #blocks;
    get blocks() {
      return this.#blocks;
    }
    #atimeMs;
    get atimeMs() {
      return this.#atimeMs;
    }
    #mtimeMs;
    get mtimeMs() {
      return this.#mtimeMs;
    }
    #ctimeMs;
    get ctimeMs() {
      return this.#ctimeMs;
    }
    #birthtimeMs;
    get birthtimeMs() {
      return this.#birthtimeMs;
    }
    #atime;
    get atime() {
      return this.#atime;
    }
    #mtime;
    get mtime() {
      return this.#mtime;
    }
    #ctime;
    get ctime() {
      return this.#ctime;
    }
    #birthtime;
    get birthtime() {
      return this.#birthtime;
    }
    #matchName;
    #depth;
    #fullpath;
    #fullpathPosix;
    #relative;
    #relativePosix;
    #type;
    #children;
    #linkTarget;
    #realpath;
    get parentPath() {
      return (this.parent || this).fullpath();
    }
    get path() {
      return this.parentPath;
    }
    constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
      this.name = name;
      this.#matchName = nocase ? normalizeNocase(name) : normalize(name);
      this.#type = type & TYPEMASK;
      this.nocase = nocase;
      this.roots = roots;
      this.root = root || this;
      this.#children = children;
      this.#fullpath = opts.fullpath;
      this.#relative = opts.relative;
      this.#relativePosix = opts.relativePosix;
      this.parent = opts.parent;
      if (this.parent) {
        this.#fs = this.parent.#fs;
      } else {
        this.#fs = fsFromOption(opts.fs);
      }
    }
    depth() {
      if (this.#depth !== undefined)
        return this.#depth;
      if (!this.parent)
        return this.#depth = 0;
      return this.#depth = this.parent.depth() + 1;
    }
    childrenCache() {
      return this.#children;
    }
    resolve(path) {
      if (!path) {
        return this;
      }
      const rootPath = this.getRootString(path);
      const dir = path.substring(rootPath.length);
      const dirParts = dir.split(this.splitSep);
      const result = rootPath ? this.getRoot(rootPath).#resolveParts(dirParts) : this.#resolveParts(dirParts);
      return result;
    }
    #resolveParts(dirParts) {
      let p = this;
      for (const part of dirParts) {
        p = p.child(part);
      }
      return p;
    }
    children() {
      const cached = this.#children.get(this);
      if (cached) {
        return cached;
      }
      const children = Object.assign([], { provisional: 0 });
      this.#children.set(this, children);
      this.#type &= ~READDIR_CALLED;
      return children;
    }
    child(pathPart, opts) {
      if (pathPart === "" || pathPart === ".") {
        return this;
      }
      if (pathPart === "..") {
        return this.parent || this;
      }
      const children = this.children();
      const name = this.nocase ? normalizeNocase(pathPart) : normalize(pathPart);
      for (const p of children) {
        if (p.#matchName === name) {
          return p;
        }
      }
      const s = this.parent ? this.sep : "";
      const fullpath = this.#fullpath ? this.#fullpath + s + pathPart : undefined;
      const pchild = this.newChild(pathPart, UNKNOWN, {
        ...opts,
        parent: this,
        fullpath
      });
      if (!this.canReaddir()) {
        pchild.#type |= ENOENT;
      }
      children.push(pchild);
      return pchild;
    }
    relative() {
      if (this.isCWD)
        return "";
      if (this.#relative !== undefined) {
        return this.#relative;
      }
      const name = this.name;
      const p = this.parent;
      if (!p) {
        return this.#relative = this.name;
      }
      const pv = p.relative();
      return pv + (!pv || !p.parent ? "" : this.sep) + name;
    }
    relativePosix() {
      if (this.sep === "/")
        return this.relative();
      if (this.isCWD)
        return "";
      if (this.#relativePosix !== undefined)
        return this.#relativePosix;
      const name = this.name;
      const p = this.parent;
      if (!p) {
        return this.#relativePosix = this.fullpathPosix();
      }
      const pv = p.relativePosix();
      return pv + (!pv || !p.parent ? "" : "/") + name;
    }
    fullpath() {
      if (this.#fullpath !== undefined) {
        return this.#fullpath;
      }
      const name = this.name;
      const p = this.parent;
      if (!p) {
        return this.#fullpath = this.name;
      }
      const pv = p.fullpath();
      const fp = pv + (!p.parent ? "" : this.sep) + name;
      return this.#fullpath = fp;
    }
    fullpathPosix() {
      if (this.#fullpathPosix !== undefined)
        return this.#fullpathPosix;
      if (this.sep === "/")
        return this.#fullpathPosix = this.fullpath();
      if (!this.parent) {
        const p2 = this.fullpath().replace(/\\/g, "/");
        if (/^[a-z]:\//i.test(p2)) {
          return this.#fullpathPosix = `//?/${p2}`;
        } else {
          return this.#fullpathPosix = p2;
        }
      }
      const p = this.parent;
      const pfpp = p.fullpathPosix();
      const fpp = pfpp + (!pfpp || !p.parent ? "" : "/") + this.name;
      return this.#fullpathPosix = fpp;
    }
    isUnknown() {
      return (this.#type & IFMT) === UNKNOWN;
    }
    isType(type) {
      return this[`is${type}`]();
    }
    getType() {
      return this.isUnknown() ? "Unknown" : this.isDirectory() ? "Directory" : this.isFile() ? "File" : this.isSymbolicLink() ? "SymbolicLink" : this.isFIFO() ? "FIFO" : this.isCharacterDevice() ? "CharacterDevice" : this.isBlockDevice() ? "BlockDevice" : this.isSocket() ? "Socket" : "Unknown";
    }
    isFile() {
      return (this.#type & IFMT) === IFREG;
    }
    isDirectory() {
      return (this.#type & IFMT) === IFDIR;
    }
    isCharacterDevice() {
      return (this.#type & IFMT) === IFCHR;
    }
    isBlockDevice() {
      return (this.#type & IFMT) === IFBLK;
    }
    isFIFO() {
      return (this.#type & IFMT) === IFIFO;
    }
    isSocket() {
      return (this.#type & IFMT) === IFSOCK;
    }
    isSymbolicLink() {
      return (this.#type & IFLNK) === IFLNK;
    }
    lstatCached() {
      return this.#type & LSTAT_CALLED ? this : undefined;
    }
    readlinkCached() {
      return this.#linkTarget;
    }
    realpathCached() {
      return this.#realpath;
    }
    readdirCached() {
      const children = this.children();
      return children.slice(0, children.provisional);
    }
    canReadlink() {
      if (this.#linkTarget)
        return true;
      if (!this.parent)
        return false;
      const ifmt = this.#type & IFMT;
      return !(ifmt !== UNKNOWN && ifmt !== IFLNK || this.#type & ENOREADLINK || this.#type & ENOENT);
    }
    calledReaddir() {
      return !!(this.#type & READDIR_CALLED);
    }
    isENOENT() {
      return !!(this.#type & ENOENT);
    }
    isNamed(n) {
      return !this.nocase ? this.#matchName === normalize(n) : this.#matchName === normalizeNocase(n);
    }
    async readlink() {
      const target = this.#linkTarget;
      if (target) {
        return target;
      }
      if (!this.canReadlink()) {
        return;
      }
      if (!this.parent) {
        return;
      }
      try {
        const read = await this.#fs.promises.readlink(this.fullpath());
        const linkTarget = (await this.parent.realpath())?.resolve(read);
        if (linkTarget) {
          return this.#linkTarget = linkTarget;
        }
      } catch (er) {
        this.#readlinkFail(er.code);
        return;
      }
    }
    readlinkSync() {
      const target = this.#linkTarget;
      if (target) {
        return target;
      }
      if (!this.canReadlink()) {
        return;
      }
      if (!this.parent) {
        return;
      }
      try {
        const read = this.#fs.readlinkSync(this.fullpath());
        const linkTarget = this.parent.realpathSync()?.resolve(read);
        if (linkTarget) {
          return this.#linkTarget = linkTarget;
        }
      } catch (er) {
        this.#readlinkFail(er.code);
        return;
      }
    }
    #readdirSuccess(children) {
      this.#type |= READDIR_CALLED;
      for (let p = children.provisional;p < children.length; p++) {
        const c = children[p];
        if (c)
          c.#markENOENT();
      }
    }
    #markENOENT() {
      if (this.#type & ENOENT)
        return;
      this.#type = (this.#type | ENOENT) & IFMT_UNKNOWN;
      this.#markChildrenENOENT();
    }
    #markChildrenENOENT() {
      const children = this.children();
      children.provisional = 0;
      for (const p of children) {
        p.#markENOENT();
      }
    }
    #markENOREALPATH() {
      this.#type |= ENOREALPATH;
      this.#markENOTDIR();
    }
    #markENOTDIR() {
      if (this.#type & ENOTDIR)
        return;
      let t = this.#type;
      if ((t & IFMT) === IFDIR)
        t &= IFMT_UNKNOWN;
      this.#type = t | ENOTDIR;
      this.#markChildrenENOENT();
    }
    #readdirFail(code = "") {
      if (code === "ENOTDIR" || code === "EPERM") {
        this.#markENOTDIR();
      } else if (code === "ENOENT") {
        this.#markENOENT();
      } else {
        this.children().provisional = 0;
      }
    }
    #lstatFail(code = "") {
      if (code === "ENOTDIR") {
        const p = this.parent;
        p.#markENOTDIR();
      } else if (code === "ENOENT") {
        this.#markENOENT();
      }
    }
    #readlinkFail(code = "") {
      let ter = this.#type;
      ter |= ENOREADLINK;
      if (code === "ENOENT")
        ter |= ENOENT;
      if (code === "EINVAL" || code === "UNKNOWN") {
        ter &= IFMT_UNKNOWN;
      }
      this.#type = ter;
      if (code === "ENOTDIR" && this.parent) {
        this.parent.#markENOTDIR();
      }
    }
    #readdirAddChild(e, c) {
      return this.#readdirMaybePromoteChild(e, c) || this.#readdirAddNewChild(e, c);
    }
    #readdirAddNewChild(e, c) {
      const type = entToType(e);
      const child = this.newChild(e.name, type, { parent: this });
      const ifmt = child.#type & IFMT;
      if (ifmt !== IFDIR && ifmt !== IFLNK && ifmt !== UNKNOWN) {
        child.#type |= ENOTDIR;
      }
      c.unshift(child);
      c.provisional++;
      return child;
    }
    #readdirMaybePromoteChild(e, c) {
      for (let p = c.provisional;p < c.length; p++) {
        const pchild = c[p];
        const name = this.nocase ? normalizeNocase(e.name) : normalize(e.name);
        if (name !== pchild.#matchName) {
          continue;
        }
        return this.#readdirPromoteChild(e, pchild, p, c);
      }
    }
    #readdirPromoteChild(e, p, index, c) {
      const v = p.name;
      p.#type = p.#type & IFMT_UNKNOWN | entToType(e);
      if (v !== e.name)
        p.name = e.name;
      if (index !== c.provisional) {
        if (index === c.length - 1)
          c.pop();
        else
          c.splice(index, 1);
        c.unshift(p);
      }
      c.provisional++;
      return p;
    }
    async lstat() {
      if ((this.#type & ENOENT) === 0) {
        try {
          this.#applyStat(await this.#fs.promises.lstat(this.fullpath()));
          return this;
        } catch (er) {
          this.#lstatFail(er.code);
        }
      }
    }
    lstatSync() {
      if ((this.#type & ENOENT) === 0) {
        try {
          this.#applyStat(this.#fs.lstatSync(this.fullpath()));
          return this;
        } catch (er) {
          this.#lstatFail(er.code);
        }
      }
    }
    #applyStat(st) {
      const { atime, atimeMs, birthtime, birthtimeMs, blksize, blocks, ctime, ctimeMs, dev, gid, ino, mode, mtime, mtimeMs, nlink, rdev, size, uid } = st;
      this.#atime = atime;
      this.#atimeMs = atimeMs;
      this.#birthtime = birthtime;
      this.#birthtimeMs = birthtimeMs;
      this.#blksize = blksize;
      this.#blocks = blocks;
      this.#ctime = ctime;
      this.#ctimeMs = ctimeMs;
      this.#dev = dev;
      this.#gid = gid;
      this.#ino = ino;
      this.#mode = mode;
      this.#mtime = mtime;
      this.#mtimeMs = mtimeMs;
      this.#nlink = nlink;
      this.#rdev = rdev;
      this.#size = size;
      this.#uid = uid;
      const ifmt = entToType(st);
      this.#type = this.#type & IFMT_UNKNOWN | ifmt | LSTAT_CALLED;
      if (ifmt !== UNKNOWN && ifmt !== IFDIR && ifmt !== IFLNK) {
        this.#type |= ENOTDIR;
      }
    }
    #onReaddirCB = [];
    #readdirCBInFlight = false;
    #callOnReaddirCB(children) {
      this.#readdirCBInFlight = false;
      const cbs = this.#onReaddirCB.slice();
      this.#onReaddirCB.length = 0;
      cbs.forEach((cb) => cb(null, children));
    }
    readdirCB(cb, allowZalgo = false) {
      if (!this.canReaddir()) {
        if (allowZalgo)
          cb(null, []);
        else
          queueMicrotask(() => cb(null, []));
        return;
      }
      const children = this.children();
      if (this.calledReaddir()) {
        const c = children.slice(0, children.provisional);
        if (allowZalgo)
          cb(null, c);
        else
          queueMicrotask(() => cb(null, c));
        return;
      }
      this.#onReaddirCB.push(cb);
      if (this.#readdirCBInFlight) {
        return;
      }
      this.#readdirCBInFlight = true;
      const fullpath = this.fullpath();
      this.#fs.readdir(fullpath, { withFileTypes: true }, (er, entries) => {
        if (er) {
          this.#readdirFail(er.code);
          children.provisional = 0;
        } else {
          for (const e of entries) {
            this.#readdirAddChild(e, children);
          }
          this.#readdirSuccess(children);
        }
        this.#callOnReaddirCB(children.slice(0, children.provisional));
        return;
      });
    }
    #asyncReaddirInFlight;
    async readdir() {
      if (!this.canReaddir()) {
        return [];
      }
      const children = this.children();
      if (this.calledReaddir()) {
        return children.slice(0, children.provisional);
      }
      const fullpath = this.fullpath();
      if (this.#asyncReaddirInFlight) {
        await this.#asyncReaddirInFlight;
      } else {
        let resolve = () => {};
        this.#asyncReaddirInFlight = new Promise((res) => resolve = res);
        try {
          for (const e of await this.#fs.promises.readdir(fullpath, {
            withFileTypes: true
          })) {
            this.#readdirAddChild(e, children);
          }
          this.#readdirSuccess(children);
        } catch (er) {
          this.#readdirFail(er.code);
          children.provisional = 0;
        }
        this.#asyncReaddirInFlight = undefined;
        resolve();
      }
      return children.slice(0, children.provisional);
    }
    readdirSync() {
      if (!this.canReaddir()) {
        return [];
      }
      const children = this.children();
      if (this.calledReaddir()) {
        return children.slice(0, children.provisional);
      }
      const fullpath = this.fullpath();
      try {
        for (const e of this.#fs.readdirSync(fullpath, {
          withFileTypes: true
        })) {
          this.#readdirAddChild(e, children);
        }
        this.#readdirSuccess(children);
      } catch (er) {
        this.#readdirFail(er.code);
        children.provisional = 0;
      }
      return children.slice(0, children.provisional);
    }
    canReaddir() {
      if (this.#type & ENOCHILD)
        return false;
      const ifmt = IFMT & this.#type;
      if (!(ifmt === UNKNOWN || ifmt === IFDIR || ifmt === IFLNK)) {
        return false;
      }
      return true;
    }
    shouldWalk(dirs, walkFilter) {
      return (this.#type & IFDIR) === IFDIR && !(this.#type & ENOCHILD) && !dirs.has(this) && (!walkFilter || walkFilter(this));
    }
    async realpath() {
      if (this.#realpath)
        return this.#realpath;
      if ((ENOREALPATH | ENOREADLINK | ENOENT) & this.#type)
        return;
      try {
        const rp = await this.#fs.promises.realpath(this.fullpath());
        return this.#realpath = this.resolve(rp);
      } catch (_) {
        this.#markENOREALPATH();
      }
    }
    realpathSync() {
      if (this.#realpath)
        return this.#realpath;
      if ((ENOREALPATH | ENOREADLINK | ENOENT) & this.#type)
        return;
      try {
        const rp = this.#fs.realpathSync(this.fullpath());
        return this.#realpath = this.resolve(rp);
      } catch (_) {
        this.#markENOREALPATH();
      }
    }
    [setAsCwd](oldCwd) {
      if (oldCwd === this)
        return;
      oldCwd.isCWD = false;
      this.isCWD = true;
      const changed = new Set([]);
      let rp = [];
      let p = this;
      while (p && p.parent) {
        changed.add(p);
        p.#relative = rp.join(this.sep);
        p.#relativePosix = rp.join("/");
        p = p.parent;
        rp.push("..");
      }
      p = oldCwd;
      while (p && p.parent && !changed.has(p)) {
        p.#relative = undefined;
        p.#relativePosix = undefined;
        p = p.parent;
      }
    }
  }
  exports.PathBase = PathBase;

  class PathWin32 extends PathBase {
    sep = "\\";
    splitSep = eitherSep;
    constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
      super(name, type, root, roots, nocase, children, opts);
    }
    newChild(name, type = UNKNOWN, opts = {}) {
      return new PathWin32(name, type, this.root, this.roots, this.nocase, this.childrenCache(), opts);
    }
    getRootString(path) {
      return node_path_1.win32.parse(path).root;
    }
    getRoot(rootPath) {
      rootPath = uncToDrive(rootPath.toUpperCase());
      if (rootPath === this.root.name) {
        return this.root;
      }
      for (const [compare, root] of Object.entries(this.roots)) {
        if (this.sameRoot(rootPath, compare)) {
          return this.roots[rootPath] = root;
        }
      }
      return this.roots[rootPath] = new PathScurryWin32(rootPath, this).root;
    }
    sameRoot(rootPath, compare = this.root.name) {
      rootPath = rootPath.toUpperCase().replace(/\//g, "\\").replace(uncDriveRegexp, "$1\\");
      return rootPath === compare;
    }
  }
  exports.PathWin32 = PathWin32;

  class PathPosix extends PathBase {
    splitSep = "/";
    sep = "/";
    constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
      super(name, type, root, roots, nocase, children, opts);
    }
    getRootString(path) {
      return path.startsWith("/") ? "/" : "";
    }
    getRoot(_rootPath) {
      return this.root;
    }
    newChild(name, type = UNKNOWN, opts = {}) {
      return new PathPosix(name, type, this.root, this.roots, this.nocase, this.childrenCache(), opts);
    }
  }
  exports.PathPosix = PathPosix;

  class PathScurryBase {
    root;
    rootPath;
    roots;
    cwd;
    #resolveCache;
    #resolvePosixCache;
    #children;
    nocase;
    #fs;
    constructor(cwd = process.cwd(), pathImpl, sep, { nocase, childrenCacheSize = 16 * 1024, fs = defaultFS } = {}) {
      this.#fs = fsFromOption(fs);
      if (cwd instanceof URL || cwd.startsWith("file://")) {
        cwd = (0, node_url_1.fileURLToPath)(cwd);
      }
      const cwdPath = pathImpl.resolve(cwd);
      this.roots = Object.create(null);
      this.rootPath = this.parseRootPath(cwdPath);
      this.#resolveCache = new ResolveCache;
      this.#resolvePosixCache = new ResolveCache;
      this.#children = new ChildrenCache(childrenCacheSize);
      const split = cwdPath.substring(this.rootPath.length).split(sep);
      if (split.length === 1 && !split[0]) {
        split.pop();
      }
      if (nocase === undefined) {
        throw new TypeError("must provide nocase setting to PathScurryBase ctor");
      }
      this.nocase = nocase;
      this.root = this.newRoot(this.#fs);
      this.roots[this.rootPath] = this.root;
      let prev = this.root;
      let len = split.length - 1;
      const joinSep = pathImpl.sep;
      let abs = this.rootPath;
      let sawFirst = false;
      for (const part of split) {
        const l = len--;
        prev = prev.child(part, {
          relative: new Array(l).fill("..").join(joinSep),
          relativePosix: new Array(l).fill("..").join("/"),
          fullpath: abs += (sawFirst ? "" : joinSep) + part
        });
        sawFirst = true;
      }
      this.cwd = prev;
    }
    depth(path = this.cwd) {
      if (typeof path === "string") {
        path = this.cwd.resolve(path);
      }
      return path.depth();
    }
    childrenCache() {
      return this.#children;
    }
    resolve(...paths) {
      let r = "";
      for (let i = paths.length - 1;i >= 0; i--) {
        const p = paths[i];
        if (!p || p === ".")
          continue;
        r = r ? `${p}/${r}` : p;
        if (this.isAbsolute(p)) {
          break;
        }
      }
      const cached = this.#resolveCache.get(r);
      if (cached !== undefined) {
        return cached;
      }
      const result = this.cwd.resolve(r).fullpath();
      this.#resolveCache.set(r, result);
      return result;
    }
    resolvePosix(...paths) {
      let r = "";
      for (let i = paths.length - 1;i >= 0; i--) {
        const p = paths[i];
        if (!p || p === ".")
          continue;
        r = r ? `${p}/${r}` : p;
        if (this.isAbsolute(p)) {
          break;
        }
      }
      const cached = this.#resolvePosixCache.get(r);
      if (cached !== undefined) {
        return cached;
      }
      const result = this.cwd.resolve(r).fullpathPosix();
      this.#resolvePosixCache.set(r, result);
      return result;
    }
    relative(entry = this.cwd) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      }
      return entry.relative();
    }
    relativePosix(entry = this.cwd) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      }
      return entry.relativePosix();
    }
    basename(entry = this.cwd) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      }
      return entry.name;
    }
    dirname(entry = this.cwd) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      }
      return (entry.parent || entry).fullpath();
    }
    async readdir(entry = this.cwd, opts = {
      withFileTypes: true
    }) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes } = opts;
      if (!entry.canReaddir()) {
        return [];
      } else {
        const p = await entry.readdir();
        return withFileTypes ? p : p.map((e) => e.name);
      }
    }
    readdirSync(entry = this.cwd, opts = {
      withFileTypes: true
    }) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes = true } = opts;
      if (!entry.canReaddir()) {
        return [];
      } else if (withFileTypes) {
        return entry.readdirSync();
      } else {
        return entry.readdirSync().map((e) => e.name);
      }
    }
    async lstat(entry = this.cwd) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      }
      return entry.lstat();
    }
    lstatSync(entry = this.cwd) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      }
      return entry.lstatSync();
    }
    async readlink(entry = this.cwd, { withFileTypes } = {
      withFileTypes: false
    }) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        withFileTypes = entry.withFileTypes;
        entry = this.cwd;
      }
      const e = await entry.readlink();
      return withFileTypes ? e : e?.fullpath();
    }
    readlinkSync(entry = this.cwd, { withFileTypes } = {
      withFileTypes: false
    }) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        withFileTypes = entry.withFileTypes;
        entry = this.cwd;
      }
      const e = entry.readlinkSync();
      return withFileTypes ? e : e?.fullpath();
    }
    async realpath(entry = this.cwd, { withFileTypes } = {
      withFileTypes: false
    }) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        withFileTypes = entry.withFileTypes;
        entry = this.cwd;
      }
      const e = await entry.realpath();
      return withFileTypes ? e : e?.fullpath();
    }
    realpathSync(entry = this.cwd, { withFileTypes } = {
      withFileTypes: false
    }) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        withFileTypes = entry.withFileTypes;
        entry = this.cwd;
      }
      const e = entry.realpathSync();
      return withFileTypes ? e : e?.fullpath();
    }
    async walk(entry = this.cwd, opts = {}) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
      const results = [];
      if (!filter || filter(entry)) {
        results.push(withFileTypes ? entry : entry.fullpath());
      }
      const dirs = new Set;
      const walk = (dir, cb) => {
        dirs.add(dir);
        dir.readdirCB((er, entries) => {
          if (er) {
            return cb(er);
          }
          let len = entries.length;
          if (!len)
            return cb();
          const next = () => {
            if (--len === 0) {
              cb();
            }
          };
          for (const e of entries) {
            if (!filter || filter(e)) {
              results.push(withFileTypes ? e : e.fullpath());
            }
            if (follow && e.isSymbolicLink()) {
              e.realpath().then((r) => r?.isUnknown() ? r.lstat() : r).then((r) => r?.shouldWalk(dirs, walkFilter) ? walk(r, next) : next());
            } else {
              if (e.shouldWalk(dirs, walkFilter)) {
                walk(e, next);
              } else {
                next();
              }
            }
          }
        }, true);
      };
      const start = entry;
      return new Promise((res, rej) => {
        walk(start, (er) => {
          if (er)
            return rej(er);
          res(results);
        });
      });
    }
    walkSync(entry = this.cwd, opts = {}) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
      const results = [];
      if (!filter || filter(entry)) {
        results.push(withFileTypes ? entry : entry.fullpath());
      }
      const dirs = new Set([entry]);
      for (const dir of dirs) {
        const entries = dir.readdirSync();
        for (const e of entries) {
          if (!filter || filter(e)) {
            results.push(withFileTypes ? e : e.fullpath());
          }
          let r = e;
          if (e.isSymbolicLink()) {
            if (!(follow && (r = e.realpathSync())))
              continue;
            if (r.isUnknown())
              r.lstatSync();
          }
          if (r.shouldWalk(dirs, walkFilter)) {
            dirs.add(r);
          }
        }
      }
      return results;
    }
    [Symbol.asyncIterator]() {
      return this.iterate();
    }
    iterate(entry = this.cwd, options = {}) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        options = entry;
        entry = this.cwd;
      }
      return this.stream(entry, options)[Symbol.asyncIterator]();
    }
    [Symbol.iterator]() {
      return this.iterateSync();
    }
    *iterateSync(entry = this.cwd, opts = {}) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
      if (!filter || filter(entry)) {
        yield withFileTypes ? entry : entry.fullpath();
      }
      const dirs = new Set([entry]);
      for (const dir of dirs) {
        const entries = dir.readdirSync();
        for (const e of entries) {
          if (!filter || filter(e)) {
            yield withFileTypes ? e : e.fullpath();
          }
          let r = e;
          if (e.isSymbolicLink()) {
            if (!(follow && (r = e.realpathSync())))
              continue;
            if (r.isUnknown())
              r.lstatSync();
          }
          if (r.shouldWalk(dirs, walkFilter)) {
            dirs.add(r);
          }
        }
      }
    }
    stream(entry = this.cwd, opts = {}) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
      const results = new minipass_1.Minipass({ objectMode: true });
      if (!filter || filter(entry)) {
        results.write(withFileTypes ? entry : entry.fullpath());
      }
      const dirs = new Set;
      const queue = [entry];
      let processing = 0;
      const process2 = () => {
        let paused = false;
        while (!paused) {
          const dir = queue.shift();
          if (!dir) {
            if (processing === 0)
              results.end();
            return;
          }
          processing++;
          dirs.add(dir);
          const onReaddir = (er, entries, didRealpaths = false) => {
            if (er)
              return results.emit("error", er);
            if (follow && !didRealpaths) {
              const promises = [];
              for (const e of entries) {
                if (e.isSymbolicLink()) {
                  promises.push(e.realpath().then((r) => r?.isUnknown() ? r.lstat() : r));
                }
              }
              if (promises.length) {
                Promise.all(promises).then(() => onReaddir(null, entries, true));
                return;
              }
            }
            for (const e of entries) {
              if (e && (!filter || filter(e))) {
                if (!results.write(withFileTypes ? e : e.fullpath())) {
                  paused = true;
                }
              }
            }
            processing--;
            for (const e of entries) {
              const r = e.realpathCached() || e;
              if (r.shouldWalk(dirs, walkFilter)) {
                queue.push(r);
              }
            }
            if (paused && !results.flowing) {
              results.once("drain", process2);
            } else if (!sync) {
              process2();
            }
          };
          let sync = true;
          dir.readdirCB(onReaddir, true);
          sync = false;
        }
      };
      process2();
      return results;
    }
    streamSync(entry = this.cwd, opts = {}) {
      if (typeof entry === "string") {
        entry = this.cwd.resolve(entry);
      } else if (!(entry instanceof PathBase)) {
        opts = entry;
        entry = this.cwd;
      }
      const { withFileTypes = true, follow = false, filter, walkFilter } = opts;
      const results = new minipass_1.Minipass({ objectMode: true });
      const dirs = new Set;
      if (!filter || filter(entry)) {
        results.write(withFileTypes ? entry : entry.fullpath());
      }
      const queue = [entry];
      let processing = 0;
      const process2 = () => {
        let paused = false;
        while (!paused) {
          const dir = queue.shift();
          if (!dir) {
            if (processing === 0)
              results.end();
            return;
          }
          processing++;
          dirs.add(dir);
          const entries = dir.readdirSync();
          for (const e of entries) {
            if (!filter || filter(e)) {
              if (!results.write(withFileTypes ? e : e.fullpath())) {
                paused = true;
              }
            }
          }
          processing--;
          for (const e of entries) {
            let r = e;
            if (e.isSymbolicLink()) {
              if (!(follow && (r = e.realpathSync())))
                continue;
              if (r.isUnknown())
                r.lstatSync();
            }
            if (r.shouldWalk(dirs, walkFilter)) {
              queue.push(r);
            }
          }
        }
        if (paused && !results.flowing)
          results.once("drain", process2);
      };
      process2();
      return results;
    }
    chdir(path = this.cwd) {
      const oldCwd = this.cwd;
      this.cwd = typeof path === "string" ? this.cwd.resolve(path) : path;
      this.cwd[setAsCwd](oldCwd);
    }
  }
  exports.PathScurryBase = PathScurryBase;

  class PathScurryWin32 extends PathScurryBase {
    sep = "\\";
    constructor(cwd = process.cwd(), opts = {}) {
      const { nocase = true } = opts;
      super(cwd, node_path_1.win32, "\\", { ...opts, nocase });
      this.nocase = nocase;
      for (let p = this.cwd;p; p = p.parent) {
        p.nocase = this.nocase;
      }
    }
    parseRootPath(dir) {
      return node_path_1.win32.parse(dir).root.toUpperCase();
    }
    newRoot(fs) {
      return new PathWin32(this.rootPath, IFDIR, undefined, this.roots, this.nocase, this.childrenCache(), { fs });
    }
    isAbsolute(p) {
      return p.startsWith("/") || p.startsWith("\\") || /^[a-z]:(\/|\\)/i.test(p);
    }
  }
  exports.PathScurryWin32 = PathScurryWin32;

  class PathScurryPosix extends PathScurryBase {
    sep = "/";
    constructor(cwd = process.cwd(), opts = {}) {
      const { nocase = false } = opts;
      super(cwd, node_path_1.posix, "/", { ...opts, nocase });
      this.nocase = nocase;
    }
    parseRootPath(_dir) {
      return "/";
    }
    newRoot(fs) {
      return new PathPosix(this.rootPath, IFDIR, undefined, this.roots, this.nocase, this.childrenCache(), { fs });
    }
    isAbsolute(p) {
      return p.startsWith("/");
    }
  }
  exports.PathScurryPosix = PathScurryPosix;

  class PathScurryDarwin extends PathScurryPosix {
    constructor(cwd = process.cwd(), opts = {}) {
      const { nocase = true } = opts;
      super(cwd, { ...opts, nocase });
    }
  }
  exports.PathScurryDarwin = PathScurryDarwin;
  exports.Path = process.platform === "win32" ? PathWin32 : PathPosix;
  exports.PathScurry = process.platform === "win32" ? PathScurryWin32 : process.platform === "darwin" ? PathScurryDarwin : PathScurryPosix;
});

// node_modules/glob/dist/commonjs/pattern.js
var require_pattern = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Pattern = undefined;
  var minimatch_1 = require_commonjs3();
  var isPatternList = (pl) => pl.length >= 1;
  var isGlobList = (gl) => gl.length >= 1;

  class Pattern {
    #patternList;
    #globList;
    #index;
    length;
    #platform;
    #rest;
    #globString;
    #isDrive;
    #isUNC;
    #isAbsolute;
    #followGlobstar = true;
    constructor(patternList, globList, index, platform) {
      if (!isPatternList(patternList)) {
        throw new TypeError("empty pattern list");
      }
      if (!isGlobList(globList)) {
        throw new TypeError("empty glob list");
      }
      if (globList.length !== patternList.length) {
        throw new TypeError("mismatched pattern list and glob list lengths");
      }
      this.length = patternList.length;
      if (index < 0 || index >= this.length) {
        throw new TypeError("index out of range");
      }
      this.#patternList = patternList;
      this.#globList = globList;
      this.#index = index;
      this.#platform = platform;
      if (this.#index === 0) {
        if (this.isUNC()) {
          const [p0, p1, p2, p3, ...prest] = this.#patternList;
          const [g0, g1, g2, g3, ...grest] = this.#globList;
          if (prest[0] === "") {
            prest.shift();
            grest.shift();
          }
          const p = [p0, p1, p2, p3, ""].join("/");
          const g = [g0, g1, g2, g3, ""].join("/");
          this.#patternList = [p, ...prest];
          this.#globList = [g, ...grest];
          this.length = this.#patternList.length;
        } else if (this.isDrive() || this.isAbsolute()) {
          const [p1, ...prest] = this.#patternList;
          const [g1, ...grest] = this.#globList;
          if (prest[0] === "") {
            prest.shift();
            grest.shift();
          }
          const p = p1 + "/";
          const g = g1 + "/";
          this.#patternList = [p, ...prest];
          this.#globList = [g, ...grest];
          this.length = this.#patternList.length;
        }
      }
    }
    pattern() {
      return this.#patternList[this.#index];
    }
    isString() {
      return typeof this.#patternList[this.#index] === "string";
    }
    isGlobstar() {
      return this.#patternList[this.#index] === minimatch_1.GLOBSTAR;
    }
    isRegExp() {
      return this.#patternList[this.#index] instanceof RegExp;
    }
    globString() {
      return this.#globString = this.#globString || (this.#index === 0 ? this.isAbsolute() ? this.#globList[0] + this.#globList.slice(1).join("/") : this.#globList.join("/") : this.#globList.slice(this.#index).join("/"));
    }
    hasMore() {
      return this.length > this.#index + 1;
    }
    rest() {
      if (this.#rest !== undefined)
        return this.#rest;
      if (!this.hasMore())
        return this.#rest = null;
      this.#rest = new Pattern(this.#patternList, this.#globList, this.#index + 1, this.#platform);
      this.#rest.#isAbsolute = this.#isAbsolute;
      this.#rest.#isUNC = this.#isUNC;
      this.#rest.#isDrive = this.#isDrive;
      return this.#rest;
    }
    isUNC() {
      const pl = this.#patternList;
      return this.#isUNC !== undefined ? this.#isUNC : this.#isUNC = this.#platform === "win32" && this.#index === 0 && pl[0] === "" && pl[1] === "" && typeof pl[2] === "string" && !!pl[2] && typeof pl[3] === "string" && !!pl[3];
    }
    isDrive() {
      const pl = this.#patternList;
      return this.#isDrive !== undefined ? this.#isDrive : this.#isDrive = this.#platform === "win32" && this.#index === 0 && this.length > 1 && typeof pl[0] === "string" && /^[a-z]:$/i.test(pl[0]);
    }
    isAbsolute() {
      const pl = this.#patternList;
      return this.#isAbsolute !== undefined ? this.#isAbsolute : this.#isAbsolute = pl[0] === "" && pl.length > 1 || this.isDrive() || this.isUNC();
    }
    root() {
      const p = this.#patternList[0];
      return typeof p === "string" && this.isAbsolute() && this.#index === 0 ? p : "";
    }
    checkFollowGlobstar() {
      return !(this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar);
    }
    markFollowGlobstar() {
      if (this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar)
        return false;
      this.#followGlobstar = false;
      return true;
    }
  }
  exports.Pattern = Pattern;
});

// node_modules/glob/dist/commonjs/ignore.js
var require_ignore = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Ignore = undefined;
  var minimatch_1 = require_commonjs3();
  var pattern_js_1 = require_pattern();
  var defaultPlatform = typeof process === "object" && process && typeof process.platform === "string" ? process.platform : "linux";

  class Ignore {
    relative;
    relativeChildren;
    absolute;
    absoluteChildren;
    platform;
    mmopts;
    constructor(ignored, { nobrace, nocase, noext, noglobstar, platform = defaultPlatform }) {
      this.relative = [];
      this.absolute = [];
      this.relativeChildren = [];
      this.absoluteChildren = [];
      this.platform = platform;
      this.mmopts = {
        dot: true,
        nobrace,
        nocase,
        noext,
        noglobstar,
        optimizationLevel: 2,
        platform,
        nocomment: true,
        nonegate: true
      };
      for (const ign of ignored)
        this.add(ign);
    }
    add(ign) {
      const mm = new minimatch_1.Minimatch(ign, this.mmopts);
      for (let i = 0;i < mm.set.length; i++) {
        const parsed = mm.set[i];
        const globParts = mm.globParts[i];
        if (!parsed || !globParts) {
          throw new Error("invalid pattern object");
        }
        while (parsed[0] === "." && globParts[0] === ".") {
          parsed.shift();
          globParts.shift();
        }
        const p = new pattern_js_1.Pattern(parsed, globParts, 0, this.platform);
        const m = new minimatch_1.Minimatch(p.globString(), this.mmopts);
        const children = globParts[globParts.length - 1] === "**";
        const absolute = p.isAbsolute();
        if (absolute)
          this.absolute.push(m);
        else
          this.relative.push(m);
        if (children) {
          if (absolute)
            this.absoluteChildren.push(m);
          else
            this.relativeChildren.push(m);
        }
      }
    }
    ignored(p) {
      const fullpath = p.fullpath();
      const fullpaths = `${fullpath}/`;
      const relative = p.relative() || ".";
      const relatives = `${relative}/`;
      for (const m of this.relative) {
        if (m.match(relative) || m.match(relatives))
          return true;
      }
      for (const m of this.absolute) {
        if (m.match(fullpath) || m.match(fullpaths))
          return true;
      }
      return false;
    }
    childrenIgnored(p) {
      const fullpath = p.fullpath() + "/";
      const relative = (p.relative() || ".") + "/";
      for (const m of this.relativeChildren) {
        if (m.match(relative))
          return true;
      }
      for (const m of this.absoluteChildren) {
        if (m.match(fullpath))
          return true;
      }
      return false;
    }
  }
  exports.Ignore = Ignore;
});

// node_modules/glob/dist/commonjs/processor.js
var require_processor = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Processor = exports.SubWalks = exports.MatchRecord = exports.HasWalkedCache = undefined;
  var minimatch_1 = require_commonjs3();

  class HasWalkedCache {
    store;
    constructor(store = new Map) {
      this.store = store;
    }
    copy() {
      return new HasWalkedCache(new Map(this.store));
    }
    hasWalked(target, pattern) {
      return this.store.get(target.fullpath())?.has(pattern.globString());
    }
    storeWalked(target, pattern) {
      const fullpath = target.fullpath();
      const cached = this.store.get(fullpath);
      if (cached)
        cached.add(pattern.globString());
      else
        this.store.set(fullpath, new Set([pattern.globString()]));
    }
  }
  exports.HasWalkedCache = HasWalkedCache;

  class MatchRecord {
    store = new Map;
    add(target, absolute, ifDir) {
      const n = (absolute ? 2 : 0) | (ifDir ? 1 : 0);
      const current = this.store.get(target);
      this.store.set(target, current === undefined ? n : n & current);
    }
    entries() {
      return [...this.store.entries()].map(([path, n]) => [
        path,
        !!(n & 2),
        !!(n & 1)
      ]);
    }
  }
  exports.MatchRecord = MatchRecord;

  class SubWalks {
    store = new Map;
    add(target, pattern) {
      if (!target.canReaddir()) {
        return;
      }
      const subs = this.store.get(target);
      if (subs) {
        if (!subs.find((p) => p.globString() === pattern.globString())) {
          subs.push(pattern);
        }
      } else
        this.store.set(target, [pattern]);
    }
    get(target) {
      const subs = this.store.get(target);
      if (!subs) {
        throw new Error("attempting to walk unknown path");
      }
      return subs;
    }
    entries() {
      return this.keys().map((k) => [k, this.store.get(k)]);
    }
    keys() {
      return [...this.store.keys()].filter((t) => t.canReaddir());
    }
  }
  exports.SubWalks = SubWalks;

  class Processor {
    hasWalkedCache;
    matches = new MatchRecord;
    subwalks = new SubWalks;
    patterns;
    follow;
    dot;
    opts;
    constructor(opts, hasWalkedCache) {
      this.opts = opts;
      this.follow = !!opts.follow;
      this.dot = !!opts.dot;
      this.hasWalkedCache = hasWalkedCache ? hasWalkedCache.copy() : new HasWalkedCache;
    }
    processPatterns(target, patterns) {
      this.patterns = patterns;
      const processingSet = patterns.map((p) => [target, p]);
      for (let [t, pattern] of processingSet) {
        this.hasWalkedCache.storeWalked(t, pattern);
        const root = pattern.root();
        const absolute = pattern.isAbsolute() && this.opts.absolute !== false;
        if (root) {
          t = t.resolve(root === "/" && this.opts.root !== undefined ? this.opts.root : root);
          const rest2 = pattern.rest();
          if (!rest2) {
            this.matches.add(t, true, false);
            continue;
          } else {
            pattern = rest2;
          }
        }
        if (t.isENOENT())
          continue;
        let p;
        let rest;
        let changed = false;
        while (typeof (p = pattern.pattern()) === "string" && (rest = pattern.rest())) {
          const c = t.resolve(p);
          t = c;
          pattern = rest;
          changed = true;
        }
        p = pattern.pattern();
        rest = pattern.rest();
        if (changed) {
          if (this.hasWalkedCache.hasWalked(t, pattern))
            continue;
          this.hasWalkedCache.storeWalked(t, pattern);
        }
        if (typeof p === "string") {
          const ifDir = p === ".." || p === "" || p === ".";
          this.matches.add(t.resolve(p), absolute, ifDir);
          continue;
        } else if (p === minimatch_1.GLOBSTAR) {
          if (!t.isSymbolicLink() || this.follow || pattern.checkFollowGlobstar()) {
            this.subwalks.add(t, pattern);
          }
          const rp = rest?.pattern();
          const rrest = rest?.rest();
          if (!rest || (rp === "" || rp === ".") && !rrest) {
            this.matches.add(t, absolute, rp === "" || rp === ".");
          } else {
            if (rp === "..") {
              const tp = t.parent || t;
              if (!rrest)
                this.matches.add(tp, absolute, true);
              else if (!this.hasWalkedCache.hasWalked(tp, rrest)) {
                this.subwalks.add(tp, rrest);
              }
            }
          }
        } else if (p instanceof RegExp) {
          this.subwalks.add(t, pattern);
        }
      }
      return this;
    }
    subwalkTargets() {
      return this.subwalks.keys();
    }
    child() {
      return new Processor(this.opts, this.hasWalkedCache);
    }
    filterEntries(parent, entries) {
      const patterns = this.subwalks.get(parent);
      const results = this.child();
      for (const e of entries) {
        for (const pattern of patterns) {
          const absolute = pattern.isAbsolute();
          const p = pattern.pattern();
          const rest = pattern.rest();
          if (p === minimatch_1.GLOBSTAR) {
            results.testGlobstar(e, pattern, rest, absolute);
          } else if (p instanceof RegExp) {
            results.testRegExp(e, p, rest, absolute);
          } else {
            results.testString(e, p, rest, absolute);
          }
        }
      }
      return results;
    }
    testGlobstar(e, pattern, rest, absolute) {
      if (this.dot || !e.name.startsWith(".")) {
        if (!pattern.hasMore()) {
          this.matches.add(e, absolute, false);
        }
        if (e.canReaddir()) {
          if (this.follow || !e.isSymbolicLink()) {
            this.subwalks.add(e, pattern);
          } else if (e.isSymbolicLink()) {
            if (rest && pattern.checkFollowGlobstar()) {
              this.subwalks.add(e, rest);
            } else if (pattern.markFollowGlobstar()) {
              this.subwalks.add(e, pattern);
            }
          }
        }
      }
      if (rest) {
        const rp = rest.pattern();
        if (typeof rp === "string" && rp !== ".." && rp !== "" && rp !== ".") {
          this.testString(e, rp, rest.rest(), absolute);
        } else if (rp === "..") {
          const ep = e.parent || e;
          this.subwalks.add(ep, rest);
        } else if (rp instanceof RegExp) {
          this.testRegExp(e, rp, rest.rest(), absolute);
        }
      }
    }
    testRegExp(e, p, rest, absolute) {
      if (!p.test(e.name))
        return;
      if (!rest) {
        this.matches.add(e, absolute, false);
      } else {
        this.subwalks.add(e, rest);
      }
    }
    testString(e, p, rest, absolute) {
      if (!e.isNamed(p))
        return;
      if (!rest) {
        this.matches.add(e, absolute, false);
      } else {
        this.subwalks.add(e, rest);
      }
    }
  }
  exports.Processor = Processor;
});

// node_modules/glob/dist/commonjs/walker.js
var require_walker = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.GlobStream = exports.GlobWalker = exports.GlobUtil = undefined;
  var minipass_1 = require_commonjs5();
  var ignore_js_1 = require_ignore();
  var processor_js_1 = require_processor();
  var makeIgnore = (ignore, opts) => typeof ignore === "string" ? new ignore_js_1.Ignore([ignore], opts) : Array.isArray(ignore) ? new ignore_js_1.Ignore(ignore, opts) : ignore;

  class GlobUtil {
    path;
    patterns;
    opts;
    seen = new Set;
    paused = false;
    aborted = false;
    #onResume = [];
    #ignore;
    #sep;
    signal;
    maxDepth;
    includeChildMatches;
    constructor(patterns, path, opts) {
      this.patterns = patterns;
      this.path = path;
      this.opts = opts;
      this.#sep = !opts.posix && opts.platform === "win32" ? "\\" : "/";
      this.includeChildMatches = opts.includeChildMatches !== false;
      if (opts.ignore || !this.includeChildMatches) {
        this.#ignore = makeIgnore(opts.ignore ?? [], opts);
        if (!this.includeChildMatches && typeof this.#ignore.add !== "function") {
          const m = "cannot ignore child matches, ignore lacks add() method.";
          throw new Error(m);
        }
      }
      this.maxDepth = opts.maxDepth || Infinity;
      if (opts.signal) {
        this.signal = opts.signal;
        this.signal.addEventListener("abort", () => {
          this.#onResume.length = 0;
        });
      }
    }
    #ignored(path) {
      return this.seen.has(path) || !!this.#ignore?.ignored?.(path);
    }
    #childrenIgnored(path) {
      return !!this.#ignore?.childrenIgnored?.(path);
    }
    pause() {
      this.paused = true;
    }
    resume() {
      if (this.signal?.aborted)
        return;
      this.paused = false;
      let fn = undefined;
      while (!this.paused && (fn = this.#onResume.shift())) {
        fn();
      }
    }
    onResume(fn) {
      if (this.signal?.aborted)
        return;
      if (!this.paused) {
        fn();
      } else {
        this.#onResume.push(fn);
      }
    }
    async matchCheck(e, ifDir) {
      if (ifDir && this.opts.nodir)
        return;
      let rpc;
      if (this.opts.realpath) {
        rpc = e.realpathCached() || await e.realpath();
        if (!rpc)
          return;
        e = rpc;
      }
      const needStat = e.isUnknown() || this.opts.stat;
      const s = needStat ? await e.lstat() : e;
      if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
        const target = await s.realpath();
        if (target && (target.isUnknown() || this.opts.stat)) {
          await target.lstat();
        }
      }
      return this.matchCheckTest(s, ifDir);
    }
    matchCheckTest(e, ifDir) {
      return e && (this.maxDepth === Infinity || e.depth() <= this.maxDepth) && (!ifDir || e.canReaddir()) && (!this.opts.nodir || !e.isDirectory()) && (!this.opts.nodir || !this.opts.follow || !e.isSymbolicLink() || !e.realpathCached()?.isDirectory()) && !this.#ignored(e) ? e : undefined;
    }
    matchCheckSync(e, ifDir) {
      if (ifDir && this.opts.nodir)
        return;
      let rpc;
      if (this.opts.realpath) {
        rpc = e.realpathCached() || e.realpathSync();
        if (!rpc)
          return;
        e = rpc;
      }
      const needStat = e.isUnknown() || this.opts.stat;
      const s = needStat ? e.lstatSync() : e;
      if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
        const target = s.realpathSync();
        if (target && (target?.isUnknown() || this.opts.stat)) {
          target.lstatSync();
        }
      }
      return this.matchCheckTest(s, ifDir);
    }
    matchFinish(e, absolute) {
      if (this.#ignored(e))
        return;
      if (!this.includeChildMatches && this.#ignore?.add) {
        const ign = `${e.relativePosix()}/**`;
        this.#ignore.add(ign);
      }
      const abs = this.opts.absolute === undefined ? absolute : this.opts.absolute;
      this.seen.add(e);
      const mark = this.opts.mark && e.isDirectory() ? this.#sep : "";
      if (this.opts.withFileTypes) {
        this.matchEmit(e);
      } else if (abs) {
        const abs2 = this.opts.posix ? e.fullpathPosix() : e.fullpath();
        this.matchEmit(abs2 + mark);
      } else {
        const rel = this.opts.posix ? e.relativePosix() : e.relative();
        const pre = this.opts.dotRelative && !rel.startsWith(".." + this.#sep) ? "." + this.#sep : "";
        this.matchEmit(!rel ? "." + mark : pre + rel + mark);
      }
    }
    async match(e, absolute, ifDir) {
      const p = await this.matchCheck(e, ifDir);
      if (p)
        this.matchFinish(p, absolute);
    }
    matchSync(e, absolute, ifDir) {
      const p = this.matchCheckSync(e, ifDir);
      if (p)
        this.matchFinish(p, absolute);
    }
    walkCB(target, patterns, cb) {
      if (this.signal?.aborted)
        cb();
      this.walkCB2(target, patterns, new processor_js_1.Processor(this.opts), cb);
    }
    walkCB2(target, patterns, processor, cb) {
      if (this.#childrenIgnored(target))
        return cb();
      if (this.signal?.aborted)
        cb();
      if (this.paused) {
        this.onResume(() => this.walkCB2(target, patterns, processor, cb));
        return;
      }
      processor.processPatterns(target, patterns);
      let tasks = 1;
      const next = () => {
        if (--tasks === 0)
          cb();
      };
      for (const [m, absolute, ifDir] of processor.matches.entries()) {
        if (this.#ignored(m))
          continue;
        tasks++;
        this.match(m, absolute, ifDir).then(() => next());
      }
      for (const t of processor.subwalkTargets()) {
        if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
          continue;
        }
        tasks++;
        const childrenCached = t.readdirCached();
        if (t.calledReaddir())
          this.walkCB3(t, childrenCached, processor, next);
        else {
          t.readdirCB((_, entries) => this.walkCB3(t, entries, processor, next), true);
        }
      }
      next();
    }
    walkCB3(target, entries, processor, cb) {
      processor = processor.filterEntries(target, entries);
      let tasks = 1;
      const next = () => {
        if (--tasks === 0)
          cb();
      };
      for (const [m, absolute, ifDir] of processor.matches.entries()) {
        if (this.#ignored(m))
          continue;
        tasks++;
        this.match(m, absolute, ifDir).then(() => next());
      }
      for (const [target2, patterns] of processor.subwalks.entries()) {
        tasks++;
        this.walkCB2(target2, patterns, processor.child(), next);
      }
      next();
    }
    walkCBSync(target, patterns, cb) {
      if (this.signal?.aborted)
        cb();
      this.walkCB2Sync(target, patterns, new processor_js_1.Processor(this.opts), cb);
    }
    walkCB2Sync(target, patterns, processor, cb) {
      if (this.#childrenIgnored(target))
        return cb();
      if (this.signal?.aborted)
        cb();
      if (this.paused) {
        this.onResume(() => this.walkCB2Sync(target, patterns, processor, cb));
        return;
      }
      processor.processPatterns(target, patterns);
      let tasks = 1;
      const next = () => {
        if (--tasks === 0)
          cb();
      };
      for (const [m, absolute, ifDir] of processor.matches.entries()) {
        if (this.#ignored(m))
          continue;
        this.matchSync(m, absolute, ifDir);
      }
      for (const t of processor.subwalkTargets()) {
        if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
          continue;
        }
        tasks++;
        const children = t.readdirSync();
        this.walkCB3Sync(t, children, processor, next);
      }
      next();
    }
    walkCB3Sync(target, entries, processor, cb) {
      processor = processor.filterEntries(target, entries);
      let tasks = 1;
      const next = () => {
        if (--tasks === 0)
          cb();
      };
      for (const [m, absolute, ifDir] of processor.matches.entries()) {
        if (this.#ignored(m))
          continue;
        this.matchSync(m, absolute, ifDir);
      }
      for (const [target2, patterns] of processor.subwalks.entries()) {
        tasks++;
        this.walkCB2Sync(target2, patterns, processor.child(), next);
      }
      next();
    }
  }
  exports.GlobUtil = GlobUtil;

  class GlobWalker extends GlobUtil {
    matches = new Set;
    constructor(patterns, path, opts) {
      super(patterns, path, opts);
    }
    matchEmit(e) {
      this.matches.add(e);
    }
    async walk() {
      if (this.signal?.aborted)
        throw this.signal.reason;
      if (this.path.isUnknown()) {
        await this.path.lstat();
      }
      await new Promise((res, rej) => {
        this.walkCB(this.path, this.patterns, () => {
          if (this.signal?.aborted) {
            rej(this.signal.reason);
          } else {
            res(this.matches);
          }
        });
      });
      return this.matches;
    }
    walkSync() {
      if (this.signal?.aborted)
        throw this.signal.reason;
      if (this.path.isUnknown()) {
        this.path.lstatSync();
      }
      this.walkCBSync(this.path, this.patterns, () => {
        if (this.signal?.aborted)
          throw this.signal.reason;
      });
      return this.matches;
    }
  }
  exports.GlobWalker = GlobWalker;

  class GlobStream extends GlobUtil {
    results;
    constructor(patterns, path, opts) {
      super(patterns, path, opts);
      this.results = new minipass_1.Minipass({
        signal: this.signal,
        objectMode: true
      });
      this.results.on("drain", () => this.resume());
      this.results.on("resume", () => this.resume());
    }
    matchEmit(e) {
      this.results.write(e);
      if (!this.results.flowing)
        this.pause();
    }
    stream() {
      const target = this.path;
      if (target.isUnknown()) {
        target.lstat().then(() => {
          this.walkCB(target, this.patterns, () => this.results.end());
        });
      } else {
        this.walkCB(target, this.patterns, () => this.results.end());
      }
      return this.results;
    }
    streamSync() {
      if (this.path.isUnknown()) {
        this.path.lstatSync();
      }
      this.walkCBSync(this.path, this.patterns, () => this.results.end());
      return this.results;
    }
  }
  exports.GlobStream = GlobStream;
});

// node_modules/glob/dist/commonjs/glob.js
var require_glob = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Glob = undefined;
  var minimatch_1 = require_commonjs3();
  var node_url_1 = __require("url");
  var path_scurry_1 = require_commonjs6();
  var pattern_js_1 = require_pattern();
  var walker_js_1 = require_walker();
  var defaultPlatform = typeof process === "object" && process && typeof process.platform === "string" ? process.platform : "linux";

  class Glob {
    absolute;
    cwd;
    root;
    dot;
    dotRelative;
    follow;
    ignore;
    magicalBraces;
    mark;
    matchBase;
    maxDepth;
    nobrace;
    nocase;
    nodir;
    noext;
    noglobstar;
    pattern;
    platform;
    realpath;
    scurry;
    stat;
    signal;
    windowsPathsNoEscape;
    withFileTypes;
    includeChildMatches;
    opts;
    patterns;
    constructor(pattern, opts) {
      if (!opts)
        throw new TypeError("glob options required");
      this.withFileTypes = !!opts.withFileTypes;
      this.signal = opts.signal;
      this.follow = !!opts.follow;
      this.dot = !!opts.dot;
      this.dotRelative = !!opts.dotRelative;
      this.nodir = !!opts.nodir;
      this.mark = !!opts.mark;
      if (!opts.cwd) {
        this.cwd = "";
      } else if (opts.cwd instanceof URL || opts.cwd.startsWith("file://")) {
        opts.cwd = (0, node_url_1.fileURLToPath)(opts.cwd);
      }
      this.cwd = opts.cwd || "";
      this.root = opts.root;
      this.magicalBraces = !!opts.magicalBraces;
      this.nobrace = !!opts.nobrace;
      this.noext = !!opts.noext;
      this.realpath = !!opts.realpath;
      this.absolute = opts.absolute;
      this.includeChildMatches = opts.includeChildMatches !== false;
      this.noglobstar = !!opts.noglobstar;
      this.matchBase = !!opts.matchBase;
      this.maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : Infinity;
      this.stat = !!opts.stat;
      this.ignore = opts.ignore;
      if (this.withFileTypes && this.absolute !== undefined) {
        throw new Error("cannot set absolute and withFileTypes:true");
      }
      if (typeof pattern === "string") {
        pattern = [pattern];
      }
      this.windowsPathsNoEscape = !!opts.windowsPathsNoEscape || opts.allowWindowsEscape === false;
      if (this.windowsPathsNoEscape) {
        pattern = pattern.map((p) => p.replace(/\\/g, "/"));
      }
      if (this.matchBase) {
        if (opts.noglobstar) {
          throw new TypeError("base matching requires globstar");
        }
        pattern = pattern.map((p) => p.includes("/") ? p : `./**/${p}`);
      }
      this.pattern = pattern;
      this.platform = opts.platform || defaultPlatform;
      this.opts = { ...opts, platform: this.platform };
      if (opts.scurry) {
        this.scurry = opts.scurry;
        if (opts.nocase !== undefined && opts.nocase !== opts.scurry.nocase) {
          throw new Error("nocase option contradicts provided scurry option");
        }
      } else {
        const Scurry = opts.platform === "win32" ? path_scurry_1.PathScurryWin32 : opts.platform === "darwin" ? path_scurry_1.PathScurryDarwin : opts.platform ? path_scurry_1.PathScurryPosix : path_scurry_1.PathScurry;
        this.scurry = new Scurry(this.cwd, {
          nocase: opts.nocase,
          fs: opts.fs
        });
      }
      this.nocase = this.scurry.nocase;
      const nocaseMagicOnly = this.platform === "darwin" || this.platform === "win32";
      const mmo = {
        ...opts,
        dot: this.dot,
        matchBase: this.matchBase,
        nobrace: this.nobrace,
        nocase: this.nocase,
        nocaseMagicOnly,
        nocomment: true,
        noext: this.noext,
        nonegate: true,
        optimizationLevel: 2,
        platform: this.platform,
        windowsPathsNoEscape: this.windowsPathsNoEscape,
        debug: !!this.opts.debug
      };
      const mms = this.pattern.map((p) => new minimatch_1.Minimatch(p, mmo));
      const [matchSet, globParts] = mms.reduce((set, m) => {
        set[0].push(...m.set);
        set[1].push(...m.globParts);
        return set;
      }, [[], []]);
      this.patterns = matchSet.map((set, i) => {
        const g = globParts[i];
        if (!g)
          throw new Error("invalid pattern object");
        return new pattern_js_1.Pattern(set, g, 0, this.platform);
      });
    }
    async walk() {
      return [
        ...await new walker_js_1.GlobWalker(this.patterns, this.scurry.cwd, {
          ...this.opts,
          maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
          platform: this.platform,
          nocase: this.nocase,
          includeChildMatches: this.includeChildMatches
        }).walk()
      ];
    }
    walkSync() {
      return [
        ...new walker_js_1.GlobWalker(this.patterns, this.scurry.cwd, {
          ...this.opts,
          maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
          platform: this.platform,
          nocase: this.nocase,
          includeChildMatches: this.includeChildMatches
        }).walkSync()
      ];
    }
    stream() {
      return new walker_js_1.GlobStream(this.patterns, this.scurry.cwd, {
        ...this.opts,
        maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
        platform: this.platform,
        nocase: this.nocase,
        includeChildMatches: this.includeChildMatches
      }).stream();
    }
    streamSync() {
      return new walker_js_1.GlobStream(this.patterns, this.scurry.cwd, {
        ...this.opts,
        maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
        platform: this.platform,
        nocase: this.nocase,
        includeChildMatches: this.includeChildMatches
      }).streamSync();
    }
    iterateSync() {
      return this.streamSync()[Symbol.iterator]();
    }
    [Symbol.iterator]() {
      return this.iterateSync();
    }
    iterate() {
      return this.stream()[Symbol.asyncIterator]();
    }
    [Symbol.asyncIterator]() {
      return this.iterate();
    }
  }
  exports.Glob = Glob;
});

// node_modules/glob/dist/commonjs/has-magic.js
var require_has_magic = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.hasMagic = undefined;
  var minimatch_1 = require_commonjs3();
  var hasMagic = (pattern, options = {}) => {
    if (!Array.isArray(pattern)) {
      pattern = [pattern];
    }
    for (const p of pattern) {
      if (new minimatch_1.Minimatch(p, options).hasMagic())
        return true;
    }
    return false;
  };
  exports.hasMagic = hasMagic;
});

// node_modules/glob/dist/commonjs/index.js
var require_commonjs7 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.glob = exports.sync = exports.iterate = exports.iterateSync = exports.stream = exports.streamSync = exports.Ignore = exports.hasMagic = exports.Glob = exports.unescape = exports.escape = undefined;
  exports.globStreamSync = globStreamSync;
  exports.globStream = globStream;
  exports.globSync = globSync;
  exports.globIterateSync = globIterateSync;
  exports.globIterate = globIterate;
  var minimatch_1 = require_commonjs3();
  var glob_js_1 = require_glob();
  var has_magic_js_1 = require_has_magic();
  var minimatch_2 = require_commonjs3();
  Object.defineProperty(exports, "escape", { enumerable: true, get: function() {
    return minimatch_2.escape;
  } });
  Object.defineProperty(exports, "unescape", { enumerable: true, get: function() {
    return minimatch_2.unescape;
  } });
  var glob_js_2 = require_glob();
  Object.defineProperty(exports, "Glob", { enumerable: true, get: function() {
    return glob_js_2.Glob;
  } });
  var has_magic_js_2 = require_has_magic();
  Object.defineProperty(exports, "hasMagic", { enumerable: true, get: function() {
    return has_magic_js_2.hasMagic;
  } });
  var ignore_js_1 = require_ignore();
  Object.defineProperty(exports, "Ignore", { enumerable: true, get: function() {
    return ignore_js_1.Ignore;
  } });
  function globStreamSync(pattern, options = {}) {
    return new glob_js_1.Glob(pattern, options).streamSync();
  }
  function globStream(pattern, options = {}) {
    return new glob_js_1.Glob(pattern, options).stream();
  }
  function globSync(pattern, options = {}) {
    return new glob_js_1.Glob(pattern, options).walkSync();
  }
  async function glob_(pattern, options = {}) {
    return new glob_js_1.Glob(pattern, options).walk();
  }
  function globIterateSync(pattern, options = {}) {
    return new glob_js_1.Glob(pattern, options).iterateSync();
  }
  function globIterate(pattern, options = {}) {
    return new glob_js_1.Glob(pattern, options).iterate();
  }
  exports.streamSync = globStreamSync;
  exports.stream = Object.assign(globStream, { sync: globStreamSync });
  exports.iterateSync = globIterateSync;
  exports.iterate = Object.assign(globIterate, {
    sync: globIterateSync
  });
  exports.sync = Object.assign(globSync, {
    stream: globStreamSync,
    iterate: globIterateSync
  });
  exports.glob = Object.assign(glob_, {
    glob: glob_,
    globSync,
    sync: exports.sync,
    globStream,
    stream: exports.stream,
    globStreamSync,
    streamSync: exports.streamSync,
    globIterate,
    iterate: exports.iterate,
    globIterateSync,
    iterateSync: exports.iterateSync,
    Glob: glob_js_1.Glob,
    hasMagic: has_magic_js_1.hasMagic,
    escape: minimatch_1.escape,
    unescape: minimatch_1.unescape
  });
  exports.glob.glob = exports.glob;
});

// node_modules/minimist/index.js
var require_minimist = __commonJS((exports, module) => {
  function hasKey(obj, keys) {
    var o = obj;
    keys.slice(0, -1).forEach(function(key2) {
      o = o[key2] || {};
    });
    var key = keys[keys.length - 1];
    return key in o;
  }
  function isNumber(x) {
    if (typeof x === "number") {
      return true;
    }
    if (/^0x[0-9a-f]+$/i.test(x)) {
      return true;
    }
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
  }
  function isConstructorOrProto(obj, key) {
    return key === "constructor" && typeof obj[key] === "function" || key === "__proto__";
  }
  module.exports = function(args, opts) {
    if (!opts) {
      opts = {};
    }
    var flags = {
      bools: {},
      strings: {},
      unknownFn: null
    };
    if (typeof opts.unknown === "function") {
      flags.unknownFn = opts.unknown;
    }
    if (typeof opts.boolean === "boolean" && opts.boolean) {
      flags.allBools = true;
    } else {
      [].concat(opts.boolean).filter(Boolean).forEach(function(key2) {
        flags.bools[key2] = true;
      });
    }
    var aliases = {};
    function aliasIsBoolean(key2) {
      return aliases[key2].some(function(x) {
        return flags.bools[x];
      });
    }
    Object.keys(opts.alias || {}).forEach(function(key2) {
      aliases[key2] = [].concat(opts.alias[key2]);
      aliases[key2].forEach(function(x) {
        aliases[x] = [key2].concat(aliases[key2].filter(function(y) {
          return x !== y;
        }));
      });
    });
    [].concat(opts.string).filter(Boolean).forEach(function(key2) {
      flags.strings[key2] = true;
      if (aliases[key2]) {
        [].concat(aliases[key2]).forEach(function(k) {
          flags.strings[k] = true;
        });
      }
    });
    var defaults = opts.default || {};
    var argv = { _: [] };
    function argDefined(key2, arg2) {
      return flags.allBools && /^--[^=]+$/.test(arg2) || flags.strings[key2] || flags.bools[key2] || aliases[key2];
    }
    function setKey(obj, keys, value2) {
      var o = obj;
      for (var i2 = 0;i2 < keys.length - 1; i2++) {
        var key2 = keys[i2];
        if (isConstructorOrProto(o, key2)) {
          return;
        }
        if (o[key2] === undefined) {
          o[key2] = {};
        }
        if (o[key2] === Object.prototype || o[key2] === Number.prototype || o[key2] === String.prototype) {
          o[key2] = {};
        }
        if (o[key2] === Array.prototype) {
          o[key2] = [];
        }
        o = o[key2];
      }
      var lastKey = keys[keys.length - 1];
      if (isConstructorOrProto(o, lastKey)) {
        return;
      }
      if (o === Object.prototype || o === Number.prototype || o === String.prototype) {
        o = {};
      }
      if (o === Array.prototype) {
        o = [];
      }
      if (o[lastKey] === undefined || flags.bools[lastKey] || typeof o[lastKey] === "boolean") {
        o[lastKey] = value2;
      } else if (Array.isArray(o[lastKey])) {
        o[lastKey].push(value2);
      } else {
        o[lastKey] = [o[lastKey], value2];
      }
    }
    function setArg(key2, val, arg2) {
      if (arg2 && flags.unknownFn && !argDefined(key2, arg2)) {
        if (flags.unknownFn(arg2) === false) {
          return;
        }
      }
      var value2 = !flags.strings[key2] && isNumber(val) ? Number(val) : val;
      setKey(argv, key2.split("."), value2);
      (aliases[key2] || []).forEach(function(x) {
        setKey(argv, x.split("."), value2);
      });
    }
    Object.keys(flags.bools).forEach(function(key2) {
      setArg(key2, defaults[key2] === undefined ? false : defaults[key2]);
    });
    var notFlags = [];
    if (args.indexOf("--") !== -1) {
      notFlags = args.slice(args.indexOf("--") + 1);
      args = args.slice(0, args.indexOf("--"));
    }
    for (var i = 0;i < args.length; i++) {
      var arg = args[i];
      var key;
      var next;
      if (/^--.+=/.test(arg)) {
        var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
        key = m[1];
        var value = m[2];
        if (flags.bools[key]) {
          value = value !== "false";
        }
        setArg(key, value, arg);
      } else if (/^--no-.+/.test(arg)) {
        key = arg.match(/^--no-(.+)/)[1];
        setArg(key, false, arg);
      } else if (/^--.+/.test(arg)) {
        key = arg.match(/^--(.+)/)[1];
        next = args[i + 1];
        if (next !== undefined && !/^(-|--)[^-]/.test(next) && !flags.bools[key] && !flags.allBools && (aliases[key] ? !aliasIsBoolean(key) : true)) {
          setArg(key, next, arg);
          i += 1;
        } else if (/^(true|false)$/.test(next)) {
          setArg(key, next === "true", arg);
          i += 1;
        } else {
          setArg(key, flags.strings[key] ? "" : true, arg);
        }
      } else if (/^-[^-]+/.test(arg)) {
        var letters = arg.slice(1, -1).split("");
        var broken = false;
        for (var j = 0;j < letters.length; j++) {
          next = arg.slice(j + 2);
          if (next === "-") {
            setArg(letters[j], next, arg);
            continue;
          }
          if (/[A-Za-z]/.test(letters[j]) && next[0] === "=") {
            setArg(letters[j], next.slice(1), arg);
            broken = true;
            break;
          }
          if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
            setArg(letters[j], next, arg);
            broken = true;
            break;
          }
          if (letters[j + 1] && letters[j + 1].match(/\W/)) {
            setArg(letters[j], arg.slice(j + 2), arg);
            broken = true;
            break;
          } else {
            setArg(letters[j], flags.strings[letters[j]] ? "" : true, arg);
          }
        }
        key = arg.slice(-1)[0];
        if (!broken && key !== "-") {
          if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !flags.bools[key] && (aliases[key] ? !aliasIsBoolean(key) : true)) {
            setArg(key, args[i + 1], arg);
            i += 1;
          } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
            setArg(key, args[i + 1] === "true", arg);
            i += 1;
          } else {
            setArg(key, flags.strings[key] ? "" : true, arg);
          }
        }
      } else {
        if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
          argv._.push(flags.strings._ || !isNumber(arg) ? arg : Number(arg));
        }
        if (opts.stopEarly) {
          argv._.push.apply(argv._, args.slice(i + 1));
          break;
        }
      }
    }
    Object.keys(defaults).forEach(function(k) {
      if (!hasKey(argv, k.split("."))) {
        setKey(argv, k.split("."), defaults[k]);
        (aliases[k] || []).forEach(function(x) {
          setKey(argv, x.split("."), defaults[k]);
        });
      }
    });
    if (opts["--"]) {
      argv["--"] = notFlags.slice();
    } else {
      notFlags.forEach(function(k) {
        argv._.push(k);
      });
    }
    return argv;
  };
});

// src/shell.js
var require_shell = __commonJS((exports, module) => {
  var os = __require("os");
  var fs = __require("fs");
  var path = __require("path");
  var initialCwd = process.cwd();
  try {
    fs.accessSync(initialCwd);
  } catch (e) {
    const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
    try {
      fs.accessSync(home);
      initialCwd = home;
    } catch (e2) {
      try {
        fs.accessSync("/tmp");
        initialCwd = "/tmp";
      } catch (e3) {
        initialCwd = "/";
      }
    }
  }
  var SHELL = {
    cwd: initialCwd,
    env: Object.assign({}, process.env),
    jobs: [],
    nextJobId: 1,
    lastExitCode: 0,
    history: [],
    aliases: {}
  };
  if (!SHELL.env.HOME) {
    let username = SHELL.env.USER || SHELL.env.LOGNAME;
    if (!username) {
      try {
        const uid = process.getuid();
        const passwdContent = fs.readFileSync("/etc/passwd", "utf8");
        const lines = passwdContent.split(`
`);
        for (const line of lines) {
          const parts = line.split(":");
          if (parseInt(parts[2]) === uid) {
            username = parts[0];
            break;
          }
        }
      } catch (e) {}
    }
    if (username) {
      try {
        const passwdContent = fs.readFileSync("/etc/passwd", "utf8");
        const lines = passwdContent.split(`
`);
        for (const line of lines) {
          const parts = line.split(":");
          if (parts[0] === username) {
            SHELL.env.HOME = parts[5];
            break;
          }
        }
      } catch (e) {}
    }
    if (!SHELL.env.HOME) {
      SHELL.env.HOME = "/tmp";
    }
  }
  if (!SHELL.env.PATH || SHELL.env.PATH.trim() === "") {
    SHELL.env.PATH = "/run/wrappers/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/nix/profile/bin:/usr/local/bin:/usr/bin:/bin";
  }
  if (process.stdin.isTTY && process.stdout.isTTY) {
    if (!SHELL.env.TERM) {
      SHELL.env.TERM = "xterm-256color";
    }
  }
  module.exports = SHELL;
});

// node_modules/fuse.js/dist/fuse.cjs
var require_fuse = __commonJS((exports, module) => {
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      enumerableOnly && (symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread2(target) {
    for (var i = 1;i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
    return target;
  }
  function _typeof(obj) {
    "@babel/helpers - typeof";
    return _typeof = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(obj2) {
      return typeof obj2;
    } : function(obj2) {
      return obj2 && typeof Symbol == "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
    }, _typeof(obj);
  }
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties(target, props) {
    for (var i = 0;i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor)
        descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps)
      _defineProperties(Constructor.prototype, protoProps);
    if (staticProps)
      _defineProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", {
      writable: false
    });
    return Constructor;
  }
  function _defineProperty(obj, key, value) {
    key = _toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    Object.defineProperty(subClass, "prototype", {
      writable: false
    });
    if (superClass)
      _setPrototypeOf(subClass, superClass);
  }
  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o2) {
      return o2.__proto__ || Object.getPrototypeOf(o2);
    };
    return _getPrototypeOf(o);
  }
  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o2, p2) {
      o2.__proto__ = p2;
      return o2;
    };
    return _setPrototypeOf(o, p);
  }
  function _isNativeReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct)
      return false;
    if (Reflect.construct.sham)
      return false;
    if (typeof Proxy === "function")
      return true;
    try {
      Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
      return true;
    } catch (e) {
      return false;
    }
  }
  function _assertThisInitialized(self) {
    if (self === undefined) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
  }
  function _possibleConstructorReturn(self, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    } else if (call !== undefined) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }
    return _assertThisInitialized(self);
  }
  function _createSuper(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct();
    return function _createSuperInternal() {
      var Super = _getPrototypeOf(Derived), result;
      if (hasNativeReflectConstruct) {
        var NewTarget = _getPrototypeOf(this).constructor;
        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }
      return _possibleConstructorReturn(this, result);
    };
  }
  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }
  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr))
      return _arrayLikeToArray(arr);
  }
  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null)
      return Array.from(iter);
  }
  function _unsupportedIterableToArray(o, minLen) {
    if (!o)
      return;
    if (typeof o === "string")
      return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor)
      n = o.constructor.name;
    if (n === "Map" || n === "Set")
      return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
      return _arrayLikeToArray(o, minLen);
  }
  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length)
      len = arr.length;
    for (var i = 0, arr2 = new Array(len);i < len; i++)
      arr2[i] = arr[i];
    return arr2;
  }
  function _nonIterableSpread() {
    throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  function _toPrimitive(input, hint) {
    if (typeof input !== "object" || input === null)
      return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
      var res = prim.call(input, hint || "default");
      if (typeof res !== "object")
        return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }
  function _toPropertyKey(arg) {
    var key = _toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }
  function isArray(value) {
    return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
  }
  var INFINITY = 1 / 0;
  function baseToString(value) {
    if (typeof value == "string") {
      return value;
    }
    var result = value + "";
    return result == "0" && 1 / value == -INFINITY ? "-0" : result;
  }
  function toString(value) {
    return value == null ? "" : baseToString(value);
  }
  function isString(value) {
    return typeof value === "string";
  }
  function isNumber(value) {
    return typeof value === "number";
  }
  function isBoolean(value) {
    return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
  }
  function isObject(value) {
    return _typeof(value) === "object";
  }
  function isObjectLike(value) {
    return isObject(value) && value !== null;
  }
  function isDefined(value) {
    return value !== undefined && value !== null;
  }
  function isBlank(value) {
    return !value.trim().length;
  }
  function getTag(value) {
    return value == null ? value === undefined ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
  }
  var INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
  var LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = function LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key) {
    return "Invalid value for key ".concat(key);
  };
  var PATTERN_LENGTH_TOO_LARGE = function PATTERN_LENGTH_TOO_LARGE(max) {
    return "Pattern length exceeds max of ".concat(max, ".");
  };
  var MISSING_KEY_PROPERTY = function MISSING_KEY_PROPERTY(name) {
    return "Missing ".concat(name, " property in key");
  };
  var INVALID_KEY_WEIGHT_VALUE = function INVALID_KEY_WEIGHT_VALUE(key) {
    return "Property 'weight' in key '".concat(key, "' must be a positive integer");
  };
  var hasOwn = Object.prototype.hasOwnProperty;
  var KeyStore = /* @__PURE__ */ function() {
    function KeyStore2(keys) {
      var _this = this;
      _classCallCheck(this, KeyStore2);
      this._keys = [];
      this._keyMap = {};
      var totalWeight = 0;
      keys.forEach(function(key) {
        var obj = createKey(key);
        _this._keys.push(obj);
        _this._keyMap[obj.id] = obj;
        totalWeight += obj.weight;
      });
      this._keys.forEach(function(key) {
        key.weight /= totalWeight;
      });
    }
    _createClass(KeyStore2, [{
      key: "get",
      value: function get(keyId) {
        return this._keyMap[keyId];
      }
    }, {
      key: "keys",
      value: function keys() {
        return this._keys;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return JSON.stringify(this._keys);
      }
    }]);
    return KeyStore2;
  }();
  function createKey(key) {
    var path = null;
    var id = null;
    var src = null;
    var weight = 1;
    var getFn = null;
    if (isString(key) || isArray(key)) {
      src = key;
      path = createKeyPath(key);
      id = createKeyId(key);
    } else {
      if (!hasOwn.call(key, "name")) {
        throw new Error(MISSING_KEY_PROPERTY("name"));
      }
      var name = key.name;
      src = name;
      if (hasOwn.call(key, "weight")) {
        weight = key.weight;
        if (weight <= 0) {
          throw new Error(INVALID_KEY_WEIGHT_VALUE(name));
        }
      }
      path = createKeyPath(name);
      id = createKeyId(name);
      getFn = key.getFn;
    }
    return {
      path,
      id,
      weight,
      src,
      getFn
    };
  }
  function createKeyPath(key) {
    return isArray(key) ? key : key.split(".");
  }
  function createKeyId(key) {
    return isArray(key) ? key.join(".") : key;
  }
  function get(obj, path) {
    var list = [];
    var arr = false;
    var deepGet = function deepGet(obj2, path2, index) {
      if (!isDefined(obj2)) {
        return;
      }
      if (!path2[index]) {
        list.push(obj2);
      } else {
        var key = path2[index];
        var value = obj2[key];
        if (!isDefined(value)) {
          return;
        }
        if (index === path2.length - 1 && (isString(value) || isNumber(value) || isBoolean(value))) {
          list.push(toString(value));
        } else if (isArray(value)) {
          arr = true;
          for (var i = 0, len = value.length;i < len; i += 1) {
            deepGet(value[i], path2, index + 1);
          }
        } else if (path2.length) {
          deepGet(value, path2, index + 1);
        }
      }
    };
    deepGet(obj, isString(path) ? path.split(".") : path, 0);
    return arr ? list : list[0];
  }
  var MatchOptions = {
    includeMatches: false,
    findAllMatches: false,
    minMatchCharLength: 1
  };
  var BasicOptions = {
    isCaseSensitive: false,
    ignoreDiacritics: false,
    includeScore: false,
    keys: [],
    shouldSort: true,
    sortFn: function sortFn(a, b) {
      return a.score === b.score ? a.idx < b.idx ? -1 : 1 : a.score < b.score ? -1 : 1;
    }
  };
  var FuzzyOptions = {
    location: 0,
    threshold: 0.6,
    distance: 100
  };
  var AdvancedOptions = {
    useExtendedSearch: false,
    getFn: get,
    ignoreLocation: false,
    ignoreFieldNorm: false,
    fieldNormWeight: 1
  };
  var Config = _objectSpread2(_objectSpread2(_objectSpread2(_objectSpread2({}, BasicOptions), MatchOptions), FuzzyOptions), AdvancedOptions);
  var SPACE = /[^ ]+/g;
  function norm() {
    var weight = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    var mantissa = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3;
    var cache = new Map;
    var m = Math.pow(10, mantissa);
    return {
      get: function get(value) {
        var numTokens = value.match(SPACE).length;
        if (cache.has(numTokens)) {
          return cache.get(numTokens);
        }
        var norm2 = 1 / Math.pow(numTokens, 0.5 * weight);
        var n = parseFloat(Math.round(norm2 * m) / m);
        cache.set(numTokens, n);
        return n;
      },
      clear: function clear() {
        cache.clear();
      }
    };
  }
  var FuseIndex = /* @__PURE__ */ function() {
    function FuseIndex2() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, _ref$getFn = _ref.getFn, getFn = _ref$getFn === undefined ? Config.getFn : _ref$getFn, _ref$fieldNormWeight = _ref.fieldNormWeight, fieldNormWeight = _ref$fieldNormWeight === undefined ? Config.fieldNormWeight : _ref$fieldNormWeight;
      _classCallCheck(this, FuseIndex2);
      this.norm = norm(fieldNormWeight, 3);
      this.getFn = getFn;
      this.isCreated = false;
      this.setIndexRecords();
    }
    _createClass(FuseIndex2, [{
      key: "setSources",
      value: function setSources() {
        var docs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        this.docs = docs;
      }
    }, {
      key: "setIndexRecords",
      value: function setIndexRecords() {
        var records = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        this.records = records;
      }
    }, {
      key: "setKeys",
      value: function setKeys() {
        var _this = this;
        var keys = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        this.keys = keys;
        this._keysMap = {};
        keys.forEach(function(key, idx) {
          _this._keysMap[key.id] = idx;
        });
      }
    }, {
      key: "create",
      value: function create() {
        var _this2 = this;
        if (this.isCreated || !this.docs.length) {
          return;
        }
        this.isCreated = true;
        if (isString(this.docs[0])) {
          this.docs.forEach(function(doc, docIndex) {
            _this2._addString(doc, docIndex);
          });
        } else {
          this.docs.forEach(function(doc, docIndex) {
            _this2._addObject(doc, docIndex);
          });
        }
        this.norm.clear();
      }
    }, {
      key: "add",
      value: function add(doc) {
        var idx = this.size();
        if (isString(doc)) {
          this._addString(doc, idx);
        } else {
          this._addObject(doc, idx);
        }
      }
    }, {
      key: "removeAt",
      value: function removeAt(idx) {
        this.records.splice(idx, 1);
        for (var i = idx, len = this.size();i < len; i += 1) {
          this.records[i].i -= 1;
        }
      }
    }, {
      key: "getValueForItemAtKeyId",
      value: function getValueForItemAtKeyId(item, keyId) {
        return item[this._keysMap[keyId]];
      }
    }, {
      key: "size",
      value: function size() {
        return this.records.length;
      }
    }, {
      key: "_addString",
      value: function _addString(doc, docIndex) {
        if (!isDefined(doc) || isBlank(doc)) {
          return;
        }
        var record = {
          v: doc,
          i: docIndex,
          n: this.norm.get(doc)
        };
        this.records.push(record);
      }
    }, {
      key: "_addObject",
      value: function _addObject(doc, docIndex) {
        var _this3 = this;
        var record = {
          i: docIndex,
          $: {}
        };
        this.keys.forEach(function(key, keyIndex) {
          var value = key.getFn ? key.getFn(doc) : _this3.getFn(doc, key.path);
          if (!isDefined(value)) {
            return;
          }
          if (isArray(value)) {
            var subRecords = [];
            var stack = [{
              nestedArrIndex: -1,
              value
            }];
            while (stack.length) {
              var _stack$pop = stack.pop(), nestedArrIndex = _stack$pop.nestedArrIndex, _value = _stack$pop.value;
              if (!isDefined(_value)) {
                continue;
              }
              if (isString(_value) && !isBlank(_value)) {
                var subRecord = {
                  v: _value,
                  i: nestedArrIndex,
                  n: _this3.norm.get(_value)
                };
                subRecords.push(subRecord);
              } else if (isArray(_value)) {
                _value.forEach(function(item, k) {
                  stack.push({
                    nestedArrIndex: k,
                    value: item
                  });
                });
              } else
                ;
            }
            record.$[keyIndex] = subRecords;
          } else if (isString(value) && !isBlank(value)) {
            var _subRecord = {
              v: value,
              n: _this3.norm.get(value)
            };
            record.$[keyIndex] = _subRecord;
          }
        });
        this.records.push(record);
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return {
          keys: this.keys,
          records: this.records
        };
      }
    }]);
    return FuseIndex2;
  }();
  function createIndex(keys, docs) {
    var _ref2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {}, _ref2$getFn = _ref2.getFn, getFn = _ref2$getFn === undefined ? Config.getFn : _ref2$getFn, _ref2$fieldNormWeight = _ref2.fieldNormWeight, fieldNormWeight = _ref2$fieldNormWeight === undefined ? Config.fieldNormWeight : _ref2$fieldNormWeight;
    var myIndex = new FuseIndex({
      getFn,
      fieldNormWeight
    });
    myIndex.setKeys(keys.map(createKey));
    myIndex.setSources(docs);
    myIndex.create();
    return myIndex;
  }
  function parseIndex(data) {
    var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}, _ref3$getFn = _ref3.getFn, getFn = _ref3$getFn === undefined ? Config.getFn : _ref3$getFn, _ref3$fieldNormWeight = _ref3.fieldNormWeight, fieldNormWeight = _ref3$fieldNormWeight === undefined ? Config.fieldNormWeight : _ref3$fieldNormWeight;
    var { keys, records } = data;
    var myIndex = new FuseIndex({
      getFn,
      fieldNormWeight
    });
    myIndex.setKeys(keys);
    myIndex.setIndexRecords(records);
    return myIndex;
  }
  function computeScore$1(pattern) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}, _ref$errors = _ref.errors, errors = _ref$errors === undefined ? 0 : _ref$errors, _ref$currentLocation = _ref.currentLocation, currentLocation = _ref$currentLocation === undefined ? 0 : _ref$currentLocation, _ref$expectedLocation = _ref.expectedLocation, expectedLocation = _ref$expectedLocation === undefined ? 0 : _ref$expectedLocation, _ref$distance = _ref.distance, distance = _ref$distance === undefined ? Config.distance : _ref$distance, _ref$ignoreLocation = _ref.ignoreLocation, ignoreLocation = _ref$ignoreLocation === undefined ? Config.ignoreLocation : _ref$ignoreLocation;
    var accuracy = errors / pattern.length;
    if (ignoreLocation) {
      return accuracy;
    }
    var proximity = Math.abs(expectedLocation - currentLocation);
    if (!distance) {
      return proximity ? 1 : accuracy;
    }
    return accuracy + proximity / distance;
  }
  function convertMaskToIndices() {
    var matchmask = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var minMatchCharLength = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Config.minMatchCharLength;
    var indices = [];
    var start = -1;
    var end = -1;
    var i = 0;
    for (var len = matchmask.length;i < len; i += 1) {
      var match = matchmask[i];
      if (match && start === -1) {
        start = i;
      } else if (!match && start !== -1) {
        end = i - 1;
        if (end - start + 1 >= minMatchCharLength) {
          indices.push([start, end]);
        }
        start = -1;
      }
    }
    if (matchmask[i - 1] && i - start >= minMatchCharLength) {
      indices.push([start, i - 1]);
    }
    return indices;
  }
  var MAX_BITS = 32;
  function search(text, pattern, patternAlphabet) {
    var _ref = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {}, _ref$location = _ref.location, location = _ref$location === undefined ? Config.location : _ref$location, _ref$distance = _ref.distance, distance = _ref$distance === undefined ? Config.distance : _ref$distance, _ref$threshold = _ref.threshold, threshold = _ref$threshold === undefined ? Config.threshold : _ref$threshold, _ref$findAllMatches = _ref.findAllMatches, findAllMatches = _ref$findAllMatches === undefined ? Config.findAllMatches : _ref$findAllMatches, _ref$minMatchCharLeng = _ref.minMatchCharLength, minMatchCharLength = _ref$minMatchCharLeng === undefined ? Config.minMatchCharLength : _ref$minMatchCharLeng, _ref$includeMatches = _ref.includeMatches, includeMatches = _ref$includeMatches === undefined ? Config.includeMatches : _ref$includeMatches, _ref$ignoreLocation = _ref.ignoreLocation, ignoreLocation = _ref$ignoreLocation === undefined ? Config.ignoreLocation : _ref$ignoreLocation;
    if (pattern.length > MAX_BITS) {
      throw new Error(PATTERN_LENGTH_TOO_LARGE(MAX_BITS));
    }
    var patternLen = pattern.length;
    var textLen = text.length;
    var expectedLocation = Math.max(0, Math.min(location, textLen));
    var currentThreshold = threshold;
    var bestLocation = expectedLocation;
    var computeMatches = minMatchCharLength > 1 || includeMatches;
    var matchMask = computeMatches ? Array(textLen) : [];
    var index;
    while ((index = text.indexOf(pattern, bestLocation)) > -1) {
      var score = computeScore$1(pattern, {
        currentLocation: index,
        expectedLocation,
        distance,
        ignoreLocation
      });
      currentThreshold = Math.min(score, currentThreshold);
      bestLocation = index + patternLen;
      if (computeMatches) {
        var i = 0;
        while (i < patternLen) {
          matchMask[index + i] = 1;
          i += 1;
        }
      }
    }
    bestLocation = -1;
    var lastBitArr = [];
    var finalScore = 1;
    var binMax = patternLen + textLen;
    var mask = 1 << patternLen - 1;
    for (var _i = 0;_i < patternLen; _i += 1) {
      var binMin = 0;
      var binMid = binMax;
      while (binMin < binMid) {
        var _score = computeScore$1(pattern, {
          errors: _i,
          currentLocation: expectedLocation + binMid,
          expectedLocation,
          distance,
          ignoreLocation
        });
        if (_score <= currentThreshold) {
          binMin = binMid;
        } else {
          binMax = binMid;
        }
        binMid = Math.floor((binMax - binMin) / 2 + binMin);
      }
      binMax = binMid;
      var start = Math.max(1, expectedLocation - binMid + 1);
      var finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
      var bitArr = Array(finish + 2);
      bitArr[finish + 1] = (1 << _i) - 1;
      for (var j = finish;j >= start; j -= 1) {
        var currentLocation = j - 1;
        var charMatch = patternAlphabet[text.charAt(currentLocation)];
        if (computeMatches) {
          matchMask[currentLocation] = +!!charMatch;
        }
        bitArr[j] = (bitArr[j + 1] << 1 | 1) & charMatch;
        if (_i) {
          bitArr[j] |= (lastBitArr[j + 1] | lastBitArr[j]) << 1 | 1 | lastBitArr[j + 1];
        }
        if (bitArr[j] & mask) {
          finalScore = computeScore$1(pattern, {
            errors: _i,
            currentLocation,
            expectedLocation,
            distance,
            ignoreLocation
          });
          if (finalScore <= currentThreshold) {
            currentThreshold = finalScore;
            bestLocation = currentLocation;
            if (bestLocation <= expectedLocation) {
              break;
            }
            start = Math.max(1, 2 * expectedLocation - bestLocation);
          }
        }
      }
      var _score2 = computeScore$1(pattern, {
        errors: _i + 1,
        currentLocation: expectedLocation,
        expectedLocation,
        distance,
        ignoreLocation
      });
      if (_score2 > currentThreshold) {
        break;
      }
      lastBitArr = bitArr;
    }
    var result = {
      isMatch: bestLocation >= 0,
      score: Math.max(0.001, finalScore)
    };
    if (computeMatches) {
      var indices = convertMaskToIndices(matchMask, minMatchCharLength);
      if (!indices.length) {
        result.isMatch = false;
      } else if (includeMatches) {
        result.indices = indices;
      }
    }
    return result;
  }
  function createPatternAlphabet(pattern) {
    var mask = {};
    for (var i = 0, len = pattern.length;i < len; i += 1) {
      var _char = pattern.charAt(i);
      mask[_char] = (mask[_char] || 0) | 1 << len - i - 1;
    }
    return mask;
  }
  var stripDiacritics = String.prototype.normalize ? function(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "");
  } : function(str) {
    return str;
  };
  var BitapSearch = /* @__PURE__ */ function() {
    function BitapSearch2(pattern) {
      var _this = this;
      var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}, _ref$location = _ref.location, location = _ref$location === undefined ? Config.location : _ref$location, _ref$threshold = _ref.threshold, threshold = _ref$threshold === undefined ? Config.threshold : _ref$threshold, _ref$distance = _ref.distance, distance = _ref$distance === undefined ? Config.distance : _ref$distance, _ref$includeMatches = _ref.includeMatches, includeMatches = _ref$includeMatches === undefined ? Config.includeMatches : _ref$includeMatches, _ref$findAllMatches = _ref.findAllMatches, findAllMatches = _ref$findAllMatches === undefined ? Config.findAllMatches : _ref$findAllMatches, _ref$minMatchCharLeng = _ref.minMatchCharLength, minMatchCharLength = _ref$minMatchCharLeng === undefined ? Config.minMatchCharLength : _ref$minMatchCharLeng, _ref$isCaseSensitive = _ref.isCaseSensitive, isCaseSensitive = _ref$isCaseSensitive === undefined ? Config.isCaseSensitive : _ref$isCaseSensitive, _ref$ignoreDiacritics = _ref.ignoreDiacritics, ignoreDiacritics = _ref$ignoreDiacritics === undefined ? Config.ignoreDiacritics : _ref$ignoreDiacritics, _ref$ignoreLocation = _ref.ignoreLocation, ignoreLocation = _ref$ignoreLocation === undefined ? Config.ignoreLocation : _ref$ignoreLocation;
      _classCallCheck(this, BitapSearch2);
      this.options = {
        location,
        threshold,
        distance,
        includeMatches,
        findAllMatches,
        minMatchCharLength,
        isCaseSensitive,
        ignoreDiacritics,
        ignoreLocation
      };
      pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
      pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
      this.pattern = pattern;
      this.chunks = [];
      if (!this.pattern.length) {
        return;
      }
      var addChunk = function addChunk(pattern2, startIndex2) {
        _this.chunks.push({
          pattern: pattern2,
          alphabet: createPatternAlphabet(pattern2),
          startIndex: startIndex2
        });
      };
      var len = this.pattern.length;
      if (len > MAX_BITS) {
        var i = 0;
        var remainder = len % MAX_BITS;
        var end = len - remainder;
        while (i < end) {
          addChunk(this.pattern.substr(i, MAX_BITS), i);
          i += MAX_BITS;
        }
        if (remainder) {
          var startIndex = len - MAX_BITS;
          addChunk(this.pattern.substr(startIndex), startIndex);
        }
      } else {
        addChunk(this.pattern, 0);
      }
    }
    _createClass(BitapSearch2, [{
      key: "searchIn",
      value: function searchIn(text) {
        var _this$options = this.options, isCaseSensitive = _this$options.isCaseSensitive, ignoreDiacritics = _this$options.ignoreDiacritics, includeMatches = _this$options.includeMatches;
        text = isCaseSensitive ? text : text.toLowerCase();
        text = ignoreDiacritics ? stripDiacritics(text) : text;
        if (this.pattern === text) {
          var _result = {
            isMatch: true,
            score: 0
          };
          if (includeMatches) {
            _result.indices = [[0, text.length - 1]];
          }
          return _result;
        }
        var _this$options2 = this.options, location = _this$options2.location, distance = _this$options2.distance, threshold = _this$options2.threshold, findAllMatches = _this$options2.findAllMatches, minMatchCharLength = _this$options2.minMatchCharLength, ignoreLocation = _this$options2.ignoreLocation;
        var allIndices = [];
        var totalScore = 0;
        var hasMatches = false;
        this.chunks.forEach(function(_ref2) {
          var { pattern, alphabet, startIndex } = _ref2;
          var _search = search(text, pattern, alphabet, {
            location: location + startIndex,
            distance,
            threshold,
            findAllMatches,
            minMatchCharLength,
            includeMatches,
            ignoreLocation
          }), isMatch = _search.isMatch, score = _search.score, indices = _search.indices;
          if (isMatch) {
            hasMatches = true;
          }
          totalScore += score;
          if (isMatch && indices) {
            allIndices = [].concat(_toConsumableArray(allIndices), _toConsumableArray(indices));
          }
        });
        var result = {
          isMatch: hasMatches,
          score: hasMatches ? totalScore / this.chunks.length : 1
        };
        if (hasMatches && includeMatches) {
          result.indices = allIndices;
        }
        return result;
      }
    }]);
    return BitapSearch2;
  }();
  var BaseMatch = /* @__PURE__ */ function() {
    function BaseMatch2(pattern) {
      _classCallCheck(this, BaseMatch2);
      this.pattern = pattern;
    }
    _createClass(BaseMatch2, [{
      key: "search",
      value: function search() {}
    }], [{
      key: "isMultiMatch",
      value: function isMultiMatch(pattern) {
        return getMatch(pattern, this.multiRegex);
      }
    }, {
      key: "isSingleMatch",
      value: function isSingleMatch(pattern) {
        return getMatch(pattern, this.singleRegex);
      }
    }]);
    return BaseMatch2;
  }();
  function getMatch(pattern, exp) {
    var matches = pattern.match(exp);
    return matches ? matches[1] : null;
  }
  var ExactMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(ExactMatch2, _BaseMatch);
    var _super = _createSuper(ExactMatch2);
    function ExactMatch2(pattern) {
      _classCallCheck(this, ExactMatch2);
      return _super.call(this, pattern);
    }
    _createClass(ExactMatch2, [{
      key: "search",
      value: function search(text) {
        var isMatch = text === this.pattern;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, this.pattern.length - 1]
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "exact";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^="(.*)"$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^=(.*)$/;
      }
    }]);
    return ExactMatch2;
  }(BaseMatch);
  var InverseExactMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(InverseExactMatch2, _BaseMatch);
    var _super = _createSuper(InverseExactMatch2);
    function InverseExactMatch2(pattern) {
      _classCallCheck(this, InverseExactMatch2);
      return _super.call(this, pattern);
    }
    _createClass(InverseExactMatch2, [{
      key: "search",
      value: function search(text) {
        var index = text.indexOf(this.pattern);
        var isMatch = index === -1;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "inverse-exact";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^!"(.*)"$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^!(.*)$/;
      }
    }]);
    return InverseExactMatch2;
  }(BaseMatch);
  var PrefixExactMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(PrefixExactMatch2, _BaseMatch);
    var _super = _createSuper(PrefixExactMatch2);
    function PrefixExactMatch2(pattern) {
      _classCallCheck(this, PrefixExactMatch2);
      return _super.call(this, pattern);
    }
    _createClass(PrefixExactMatch2, [{
      key: "search",
      value: function search(text) {
        var isMatch = text.startsWith(this.pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, this.pattern.length - 1]
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "prefix-exact";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^\^"(.*)"$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^\^(.*)$/;
      }
    }]);
    return PrefixExactMatch2;
  }(BaseMatch);
  var InversePrefixExactMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(InversePrefixExactMatch2, _BaseMatch);
    var _super = _createSuper(InversePrefixExactMatch2);
    function InversePrefixExactMatch2(pattern) {
      _classCallCheck(this, InversePrefixExactMatch2);
      return _super.call(this, pattern);
    }
    _createClass(InversePrefixExactMatch2, [{
      key: "search",
      value: function search(text) {
        var isMatch = !text.startsWith(this.pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "inverse-prefix-exact";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^!\^"(.*)"$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^!\^(.*)$/;
      }
    }]);
    return InversePrefixExactMatch2;
  }(BaseMatch);
  var SuffixExactMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(SuffixExactMatch2, _BaseMatch);
    var _super = _createSuper(SuffixExactMatch2);
    function SuffixExactMatch2(pattern) {
      _classCallCheck(this, SuffixExactMatch2);
      return _super.call(this, pattern);
    }
    _createClass(SuffixExactMatch2, [{
      key: "search",
      value: function search(text) {
        var isMatch = text.endsWith(this.pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [text.length - this.pattern.length, text.length - 1]
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "suffix-exact";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^"(.*)"\$$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^(.*)\$$/;
      }
    }]);
    return SuffixExactMatch2;
  }(BaseMatch);
  var InverseSuffixExactMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(InverseSuffixExactMatch2, _BaseMatch);
    var _super = _createSuper(InverseSuffixExactMatch2);
    function InverseSuffixExactMatch2(pattern) {
      _classCallCheck(this, InverseSuffixExactMatch2);
      return _super.call(this, pattern);
    }
    _createClass(InverseSuffixExactMatch2, [{
      key: "search",
      value: function search(text) {
        var isMatch = !text.endsWith(this.pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "inverse-suffix-exact";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^!"(.*)"\$$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^!(.*)\$$/;
      }
    }]);
    return InverseSuffixExactMatch2;
  }(BaseMatch);
  var FuzzyMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(FuzzyMatch2, _BaseMatch);
    var _super = _createSuper(FuzzyMatch2);
    function FuzzyMatch2(pattern) {
      var _this;
      var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}, _ref$location = _ref.location, location = _ref$location === undefined ? Config.location : _ref$location, _ref$threshold = _ref.threshold, threshold = _ref$threshold === undefined ? Config.threshold : _ref$threshold, _ref$distance = _ref.distance, distance = _ref$distance === undefined ? Config.distance : _ref$distance, _ref$includeMatches = _ref.includeMatches, includeMatches = _ref$includeMatches === undefined ? Config.includeMatches : _ref$includeMatches, _ref$findAllMatches = _ref.findAllMatches, findAllMatches = _ref$findAllMatches === undefined ? Config.findAllMatches : _ref$findAllMatches, _ref$minMatchCharLeng = _ref.minMatchCharLength, minMatchCharLength = _ref$minMatchCharLeng === undefined ? Config.minMatchCharLength : _ref$minMatchCharLeng, _ref$isCaseSensitive = _ref.isCaseSensitive, isCaseSensitive = _ref$isCaseSensitive === undefined ? Config.isCaseSensitive : _ref$isCaseSensitive, _ref$ignoreDiacritics = _ref.ignoreDiacritics, ignoreDiacritics = _ref$ignoreDiacritics === undefined ? Config.ignoreDiacritics : _ref$ignoreDiacritics, _ref$ignoreLocation = _ref.ignoreLocation, ignoreLocation = _ref$ignoreLocation === undefined ? Config.ignoreLocation : _ref$ignoreLocation;
      _classCallCheck(this, FuzzyMatch2);
      _this = _super.call(this, pattern);
      _this._bitapSearch = new BitapSearch(pattern, {
        location,
        threshold,
        distance,
        includeMatches,
        findAllMatches,
        minMatchCharLength,
        isCaseSensitive,
        ignoreDiacritics,
        ignoreLocation
      });
      return _this;
    }
    _createClass(FuzzyMatch2, [{
      key: "search",
      value: function search(text) {
        return this._bitapSearch.searchIn(text);
      }
    }], [{
      key: "type",
      get: function get() {
        return "fuzzy";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^"(.*)"$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^(.*)$/;
      }
    }]);
    return FuzzyMatch2;
  }(BaseMatch);
  var IncludeMatch = /* @__PURE__ */ function(_BaseMatch) {
    _inherits(IncludeMatch2, _BaseMatch);
    var _super = _createSuper(IncludeMatch2);
    function IncludeMatch2(pattern) {
      _classCallCheck(this, IncludeMatch2);
      return _super.call(this, pattern);
    }
    _createClass(IncludeMatch2, [{
      key: "search",
      value: function search(text) {
        var location = 0;
        var index;
        var indices = [];
        var patternLen = this.pattern.length;
        while ((index = text.indexOf(this.pattern, location)) > -1) {
          location = index + patternLen;
          indices.push([index, location - 1]);
        }
        var isMatch = !!indices.length;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices
        };
      }
    }], [{
      key: "type",
      get: function get() {
        return "include";
      }
    }, {
      key: "multiRegex",
      get: function get() {
        return /^'"(.*)"$/;
      }
    }, {
      key: "singleRegex",
      get: function get() {
        return /^'(.*)$/;
      }
    }]);
    return IncludeMatch2;
  }(BaseMatch);
  var searchers = [ExactMatch, IncludeMatch, PrefixExactMatch, InversePrefixExactMatch, InverseSuffixExactMatch, SuffixExactMatch, InverseExactMatch, FuzzyMatch];
  var searchersLen = searchers.length;
  var SPACE_RE = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
  var OR_TOKEN = "|";
  function parseQuery(pattern) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return pattern.split(OR_TOKEN).map(function(item) {
      var query = item.trim().split(SPACE_RE).filter(function(item2) {
        return item2 && !!item2.trim();
      });
      var results = [];
      for (var i = 0, len = query.length;i < len; i += 1) {
        var queryItem = query[i];
        var found = false;
        var idx = -1;
        while (!found && ++idx < searchersLen) {
          var searcher = searchers[idx];
          var token = searcher.isMultiMatch(queryItem);
          if (token) {
            results.push(new searcher(token, options));
            found = true;
          }
        }
        if (found) {
          continue;
        }
        idx = -1;
        while (++idx < searchersLen) {
          var _searcher = searchers[idx];
          var _token = _searcher.isSingleMatch(queryItem);
          if (_token) {
            results.push(new _searcher(_token, options));
            break;
          }
        }
      }
      return results;
    });
  }
  var MultiMatchSet = new Set([FuzzyMatch.type, IncludeMatch.type]);
  var ExtendedSearch = /* @__PURE__ */ function() {
    function ExtendedSearch2(pattern) {
      var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}, _ref$isCaseSensitive = _ref.isCaseSensitive, isCaseSensitive = _ref$isCaseSensitive === undefined ? Config.isCaseSensitive : _ref$isCaseSensitive, _ref$ignoreDiacritics = _ref.ignoreDiacritics, ignoreDiacritics = _ref$ignoreDiacritics === undefined ? Config.ignoreDiacritics : _ref$ignoreDiacritics, _ref$includeMatches = _ref.includeMatches, includeMatches = _ref$includeMatches === undefined ? Config.includeMatches : _ref$includeMatches, _ref$minMatchCharLeng = _ref.minMatchCharLength, minMatchCharLength = _ref$minMatchCharLeng === undefined ? Config.minMatchCharLength : _ref$minMatchCharLeng, _ref$ignoreLocation = _ref.ignoreLocation, ignoreLocation = _ref$ignoreLocation === undefined ? Config.ignoreLocation : _ref$ignoreLocation, _ref$findAllMatches = _ref.findAllMatches, findAllMatches = _ref$findAllMatches === undefined ? Config.findAllMatches : _ref$findAllMatches, _ref$location = _ref.location, location = _ref$location === undefined ? Config.location : _ref$location, _ref$threshold = _ref.threshold, threshold = _ref$threshold === undefined ? Config.threshold : _ref$threshold, _ref$distance = _ref.distance, distance = _ref$distance === undefined ? Config.distance : _ref$distance;
      _classCallCheck(this, ExtendedSearch2);
      this.query = null;
      this.options = {
        isCaseSensitive,
        ignoreDiacritics,
        includeMatches,
        minMatchCharLength,
        findAllMatches,
        ignoreLocation,
        location,
        threshold,
        distance
      };
      pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
      pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
      this.pattern = pattern;
      this.query = parseQuery(this.pattern, this.options);
    }
    _createClass(ExtendedSearch2, [{
      key: "searchIn",
      value: function searchIn(text) {
        var query = this.query;
        if (!query) {
          return {
            isMatch: false,
            score: 1
          };
        }
        var _this$options = this.options, includeMatches = _this$options.includeMatches, isCaseSensitive = _this$options.isCaseSensitive, ignoreDiacritics = _this$options.ignoreDiacritics;
        text = isCaseSensitive ? text : text.toLowerCase();
        text = ignoreDiacritics ? stripDiacritics(text) : text;
        var numMatches = 0;
        var allIndices = [];
        var totalScore = 0;
        for (var i = 0, qLen = query.length;i < qLen; i += 1) {
          var searchers2 = query[i];
          allIndices.length = 0;
          numMatches = 0;
          for (var j = 0, pLen = searchers2.length;j < pLen; j += 1) {
            var searcher = searchers2[j];
            var _searcher$search = searcher.search(text), isMatch = _searcher$search.isMatch, indices = _searcher$search.indices, score = _searcher$search.score;
            if (isMatch) {
              numMatches += 1;
              totalScore += score;
              if (includeMatches) {
                var type = searcher.constructor.type;
                if (MultiMatchSet.has(type)) {
                  allIndices = [].concat(_toConsumableArray(allIndices), _toConsumableArray(indices));
                } else {
                  allIndices.push(indices);
                }
              }
            } else {
              totalScore = 0;
              numMatches = 0;
              allIndices.length = 0;
              break;
            }
          }
          if (numMatches) {
            var result = {
              isMatch: true,
              score: totalScore / numMatches
            };
            if (includeMatches) {
              result.indices = allIndices;
            }
            return result;
          }
        }
        return {
          isMatch: false,
          score: 1
        };
      }
    }], [{
      key: "condition",
      value: function condition(_, options) {
        return options.useExtendedSearch;
      }
    }]);
    return ExtendedSearch2;
  }();
  var registeredSearchers = [];
  function register() {
    registeredSearchers.push.apply(registeredSearchers, arguments);
  }
  function createSearcher(pattern, options) {
    for (var i = 0, len = registeredSearchers.length;i < len; i += 1) {
      var searcherClass = registeredSearchers[i];
      if (searcherClass.condition(pattern, options)) {
        return new searcherClass(pattern, options);
      }
    }
    return new BitapSearch(pattern, options);
  }
  var LogicalOperator = {
    AND: "$and",
    OR: "$or"
  };
  var KeyType = {
    PATH: "$path",
    PATTERN: "$val"
  };
  var isExpression = function isExpression(query) {
    return !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
  };
  var isPath = function isPath(query) {
    return !!query[KeyType.PATH];
  };
  var isLeaf = function isLeaf(query) {
    return !isArray(query) && isObject(query) && !isExpression(query);
  };
  var convertToExplicit = function convertToExplicit(query) {
    return _defineProperty({}, LogicalOperator.AND, Object.keys(query).map(function(key) {
      return _defineProperty({}, key, query[key]);
    }));
  };
  function parse(query, options) {
    var _ref3 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {}, _ref3$auto = _ref3.auto, auto = _ref3$auto === undefined ? true : _ref3$auto;
    var next = function next(query2) {
      var keys = Object.keys(query2);
      var isQueryPath = isPath(query2);
      if (!isQueryPath && keys.length > 1 && !isExpression(query2)) {
        return next(convertToExplicit(query2));
      }
      if (isLeaf(query2)) {
        var key = isQueryPath ? query2[KeyType.PATH] : keys[0];
        var pattern = isQueryPath ? query2[KeyType.PATTERN] : query2[key];
        if (!isString(pattern)) {
          throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
        }
        var obj = {
          keyId: createKeyId(key),
          pattern
        };
        if (auto) {
          obj.searcher = createSearcher(pattern, options);
        }
        return obj;
      }
      var node = {
        children: [],
        operator: keys[0]
      };
      keys.forEach(function(key2) {
        var value = query2[key2];
        if (isArray(value)) {
          value.forEach(function(item) {
            node.children.push(next(item));
          });
        }
      });
      return node;
    };
    if (!isExpression(query)) {
      query = convertToExplicit(query);
    }
    return next(query);
  }
  function computeScore(results, _ref) {
    var _ref$ignoreFieldNorm = _ref.ignoreFieldNorm, ignoreFieldNorm = _ref$ignoreFieldNorm === undefined ? Config.ignoreFieldNorm : _ref$ignoreFieldNorm;
    results.forEach(function(result) {
      var totalScore = 1;
      result.matches.forEach(function(_ref2) {
        var { key, norm: norm2, score } = _ref2;
        var weight = key ? key.weight : null;
        totalScore *= Math.pow(score === 0 && weight ? Number.EPSILON : score, (weight || 1) * (ignoreFieldNorm ? 1 : norm2));
      });
      result.score = totalScore;
    });
  }
  function transformMatches(result, data) {
    var matches = result.matches;
    data.matches = [];
    if (!isDefined(matches)) {
      return;
    }
    matches.forEach(function(match) {
      if (!isDefined(match.indices) || !match.indices.length) {
        return;
      }
      var { indices, value } = match;
      var obj = {
        indices,
        value
      };
      if (match.key) {
        obj.key = match.key.src;
      }
      if (match.idx > -1) {
        obj.refIndex = match.idx;
      }
      data.matches.push(obj);
    });
  }
  function transformScore(result, data) {
    data.score = result.score;
  }
  function format(results, docs) {
    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {}, _ref$includeMatches = _ref.includeMatches, includeMatches = _ref$includeMatches === undefined ? Config.includeMatches : _ref$includeMatches, _ref$includeScore = _ref.includeScore, includeScore = _ref$includeScore === undefined ? Config.includeScore : _ref$includeScore;
    var transformers = [];
    if (includeMatches)
      transformers.push(transformMatches);
    if (includeScore)
      transformers.push(transformScore);
    return results.map(function(result) {
      var idx = result.idx;
      var data = {
        item: docs[idx],
        refIndex: idx
      };
      if (transformers.length) {
        transformers.forEach(function(transformer) {
          transformer(result, data);
        });
      }
      return data;
    });
  }
  var Fuse$1 = /* @__PURE__ */ function() {
    function Fuse2(docs) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var index = arguments.length > 2 ? arguments[2] : undefined;
      _classCallCheck(this, Fuse2);
      this.options = _objectSpread2(_objectSpread2({}, Config), options);
      if (this.options.useExtendedSearch && false) {}
      this._keyStore = new KeyStore(this.options.keys);
      this.setCollection(docs, index);
    }
    _createClass(Fuse2, [{
      key: "setCollection",
      value: function setCollection(docs, index) {
        this._docs = docs;
        if (index && !(index instanceof FuseIndex)) {
          throw new Error(INCORRECT_INDEX_TYPE);
        }
        this._myIndex = index || createIndex(this.options.keys, this._docs, {
          getFn: this.options.getFn,
          fieldNormWeight: this.options.fieldNormWeight
        });
      }
    }, {
      key: "add",
      value: function add(doc) {
        if (!isDefined(doc)) {
          return;
        }
        this._docs.push(doc);
        this._myIndex.add(doc);
      }
    }, {
      key: "remove",
      value: function remove() {
        var predicate = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function() {
          return false;
        };
        var results = [];
        for (var i = 0, len = this._docs.length;i < len; i += 1) {
          var doc = this._docs[i];
          if (predicate(doc, i)) {
            this.removeAt(i);
            i -= 1;
            len -= 1;
            results.push(doc);
          }
        }
        return results;
      }
    }, {
      key: "removeAt",
      value: function removeAt(idx) {
        this._docs.splice(idx, 1);
        this._myIndex.removeAt(idx);
      }
    }, {
      key: "getIndex",
      value: function getIndex() {
        return this._myIndex;
      }
    }, {
      key: "search",
      value: function search(query) {
        var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}, _ref$limit = _ref.limit, limit = _ref$limit === undefined ? -1 : _ref$limit;
        var _this$options = this.options, includeMatches = _this$options.includeMatches, includeScore = _this$options.includeScore, shouldSort = _this$options.shouldSort, sortFn = _this$options.sortFn, ignoreFieldNorm = _this$options.ignoreFieldNorm;
        var results = isString(query) ? isString(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
        computeScore(results, {
          ignoreFieldNorm
        });
        if (shouldSort) {
          results.sort(sortFn);
        }
        if (isNumber(limit) && limit > -1) {
          results = results.slice(0, limit);
        }
        return format(results, this._docs, {
          includeMatches,
          includeScore
        });
      }
    }, {
      key: "_searchStringList",
      value: function _searchStringList(query) {
        var searcher = createSearcher(query, this.options);
        var records = this._myIndex.records;
        var results = [];
        records.forEach(function(_ref2) {
          var { v: text, i: idx, n: norm2 } = _ref2;
          if (!isDefined(text)) {
            return;
          }
          var _searcher$searchIn = searcher.searchIn(text), isMatch = _searcher$searchIn.isMatch, score = _searcher$searchIn.score, indices = _searcher$searchIn.indices;
          if (isMatch) {
            results.push({
              item: text,
              idx,
              matches: [{
                score,
                value: text,
                norm: norm2,
                indices
              }]
            });
          }
        });
        return results;
      }
    }, {
      key: "_searchLogical",
      value: function _searchLogical(query) {
        var _this = this;
        var expression = parse(query, this.options);
        var evaluate = function evaluate(node, item, idx) {
          if (!node.children) {
            var { keyId, searcher } = node;
            var matches = _this._findMatches({
              key: _this._keyStore.get(keyId),
              value: _this._myIndex.getValueForItemAtKeyId(item, keyId),
              searcher
            });
            if (matches && matches.length) {
              return [{
                idx,
                item,
                matches
              }];
            }
            return [];
          }
          var res = [];
          for (var i = 0, len = node.children.length;i < len; i += 1) {
            var child = node.children[i];
            var result = evaluate(child, item, idx);
            if (result.length) {
              res.push.apply(res, _toConsumableArray(result));
            } else if (node.operator === LogicalOperator.AND) {
              return [];
            }
          }
          return res;
        };
        var records = this._myIndex.records;
        var resultMap = {};
        var results = [];
        records.forEach(function(_ref3) {
          var { $: item, i: idx } = _ref3;
          if (isDefined(item)) {
            var expResults = evaluate(expression, item, idx);
            if (expResults.length) {
              if (!resultMap[idx]) {
                resultMap[idx] = {
                  idx,
                  item,
                  matches: []
                };
                results.push(resultMap[idx]);
              }
              expResults.forEach(function(_ref4) {
                var _resultMap$idx$matche;
                var matches = _ref4.matches;
                (_resultMap$idx$matche = resultMap[idx].matches).push.apply(_resultMap$idx$matche, _toConsumableArray(matches));
              });
            }
          }
        });
        return results;
      }
    }, {
      key: "_searchObjectList",
      value: function _searchObjectList(query) {
        var _this2 = this;
        var searcher = createSearcher(query, this.options);
        var _this$_myIndex = this._myIndex, keys = _this$_myIndex.keys, records = _this$_myIndex.records;
        var results = [];
        records.forEach(function(_ref5) {
          var { $: item, i: idx } = _ref5;
          if (!isDefined(item)) {
            return;
          }
          var matches = [];
          keys.forEach(function(key, keyIndex) {
            matches.push.apply(matches, _toConsumableArray(_this2._findMatches({
              key,
              value: item[keyIndex],
              searcher
            })));
          });
          if (matches.length) {
            results.push({
              idx,
              item,
              matches
            });
          }
        });
        return results;
      }
    }, {
      key: "_findMatches",
      value: function _findMatches(_ref6) {
        var { key, value, searcher } = _ref6;
        if (!isDefined(value)) {
          return [];
        }
        var matches = [];
        if (isArray(value)) {
          value.forEach(function(_ref7) {
            var { v: text2, i: idx, n: norm3 } = _ref7;
            if (!isDefined(text2)) {
              return;
            }
            var _searcher$searchIn2 = searcher.searchIn(text2), isMatch2 = _searcher$searchIn2.isMatch, score2 = _searcher$searchIn2.score, indices2 = _searcher$searchIn2.indices;
            if (isMatch2) {
              matches.push({
                score: score2,
                key,
                value: text2,
                idx,
                norm: norm3,
                indices: indices2
              });
            }
          });
        } else {
          var { v: text, n: norm2 } = value;
          var _searcher$searchIn3 = searcher.searchIn(text), isMatch = _searcher$searchIn3.isMatch, score = _searcher$searchIn3.score, indices = _searcher$searchIn3.indices;
          if (isMatch) {
            matches.push({
              score,
              key,
              value: text,
              norm: norm2,
              indices
            });
          }
        }
        return matches;
      }
    }]);
    return Fuse2;
  }();
  Fuse$1.version = "7.1.0";
  Fuse$1.createIndex = createIndex;
  Fuse$1.parseIndex = parseIndex;
  Fuse$1.config = Config;
  {
    Fuse$1.parseQuery = parse;
  }
  {
    register(ExtendedSearch);
  }
  var Fuse = Fuse$1;
  module.exports = Fuse;
});

// src/history-db.js
var require_history_db = __commonJS((exports, module) => {
  var { Database } = __require("bun:sqlite");
  var path = __require("path");
  var os = __require("os");
  var Fuse = require_fuse();
  var HISTORY_DB_PATH = path.join(os.homedir(), ".fgshell_history.db");
  var db = null;
  function initDB() {
    if (db)
      return;
    db = new Database(HISTORY_DB_PATH);
    db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      exit_code INTEGER,
      cwd TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_timestamp ON history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_cwd ON history(cwd);
  `);
  }
  function addEntry(command, exitCode, cwd, duration) {
    initDB();
    const timestamp = Math.floor(Date.now() / 1000);
    db.run(`INSERT INTO history (command, timestamp, exit_code, cwd, duration)
     VALUES (?, ?, ?, ?, ?)`, [command, timestamp, exitCode, cwd, duration]);
  }
  function getAll(limit = 1000) {
    initDB();
    try {
      const stmt = db.prepare(`
      SELECT id, command, timestamp, exit_code, cwd, duration
      FROM history
      ORDER BY timestamp DESC
      LIMIT ?
    `);
      return stmt.all(limit);
    } catch (e) {
      console.error("getAll error:", e.message);
      return [];
    }
  }
  function search(query, limit = 50) {
    initDB();
    const entries = getAll(1e4);
    const fuse = new Fuse(entries, {
      keys: ["command"],
      threshold: 0.3
    });
    const results = fuse.search(query);
    return results.slice(0, limit).map((r) => r.item);
  }
  function searchByExitCode(exitCode, limit = 50) {
    initDB();
    return db.query(`
    SELECT id, command, timestamp, exit_code, cwd, duration
    FROM history
    WHERE exit_code = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(exitCode, limit);
  }
  function searchByCwd(cwd, limit = 50) {
    initDB();
    return db.query(`
    SELECT id, command, timestamp, exit_code, cwd, duration
    FROM history
    WHERE cwd = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(cwd, limit);
  }
  function clearOlderThan(days) {
    initDB();
    const secondsAgo = days * 24 * 60 * 60;
    const cutoff = Math.floor(Date.now() / 1000) - secondsAgo;
    return db.run(`
    DELETE FROM history WHERE timestamp < ?
  `, [cutoff]);
  }
  function closeDB() {
    if (db) {
      db.close();
      db = null;
    }
  }
  module.exports = {
    initDB,
    addEntry,
    getAll,
    search,
    searchByExitCode,
    searchByCwd,
    clearOlderThan,
    closeDB
  };
});

// node_modules/js-yaml/lib/common.js
var require_common = __commonJS((exports, module) => {
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence))
      return sequence;
    else if (isNothing(sequence))
      return [];
    return [sequence];
  }
  function extend(target, source) {
    var index, length, key, sourceKeys;
    if (source) {
      sourceKeys = Object.keys(source);
      for (index = 0, length = sourceKeys.length;index < length; index += 1) {
        key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    var result = "", cycle;
    for (cycle = 0;cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  exports.isNothing = isNothing;
  exports.isObject = isObject;
  exports.toArray = toArray;
  exports.repeat = repeat;
  exports.isNegativeZero = isNegativeZero;
  exports.extend = extend;
});

// node_modules/js-yaml/lib/exception.js
var require_exception = __commonJS((exports, module) => {
  function formatError(exception, compact) {
    var where = "", message = exception.reason || "(unknown reason)";
    if (!exception.mark)
      return message;
    if (exception.mark.name) {
      where += 'in "' + exception.mark.name + '" ';
    }
    where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
    if (!compact && exception.mark.snippet) {
      where += `

` + exception.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException.prototype = Object.create(Error.prototype);
  YAMLException.prototype.constructor = YAMLException;
  YAMLException.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  module.exports = YAMLException;
});

// node_modules/js-yaml/lib/snippet.js
var require_snippet = __commonJS((exports, module) => {
  var common = require_common();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    var head = "";
    var tail = "";
    var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return common.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer)
      return null;
    if (!options.maxLength)
      options.maxLength = 79;
    if (typeof options.indent !== "number")
      options.indent = 1;
    if (typeof options.linesBefore !== "number")
      options.linesBefore = 3;
    if (typeof options.linesAfter !== "number")
      options.linesAfter = 2;
    var re = /\r?\n|\r|\0/g;
    var lineStarts = [0];
    var lineEnds = [];
    var match;
    var foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0)
      foundLineNo = lineStarts.length - 1;
    var result = "", i, line;
    var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (i = 1;i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0)
        break;
      line = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
      result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + `
` + result;
    }
    line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + `
`;
    result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^" + `
`;
    for (i = 1;i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length)
        break;
      line = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
      result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + `
`;
    }
    return result.replace(/\n$/, "");
  }
  module.exports = makeSnippet;
});

// node_modules/js-yaml/lib/type.js
var require_type = __commonJS((exports, module) => {
  var YAMLException = require_exception();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  var YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map) {
    var result = {};
    if (map !== null) {
      Object.keys(map).forEach(function(style) {
        map[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  module.exports = Type;
});

// node_modules/js-yaml/lib/schema.js
var require_schema = __commonJS((exports, module) => {
  var YAMLException = require_exception();
  var Type = require_type();
  function compileList(schema, name) {
    var result = [];
    schema[name].forEach(function(currentType) {
      var newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    var result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    }, index, length;
    function collectType(type) {
      if (type.multi) {
        result.multi[type.kind].push(type);
        result.multi["fallback"].push(type);
      } else {
        result[type.kind][type.tag] = result["fallback"][type.tag] = type;
      }
    }
    for (index = 0, length = arguments.length;index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema(definition) {
    return this.extend(definition);
  }
  Schema.prototype.extend = function extend(definition) {
    var implicit = [];
    var explicit = [];
    if (definition instanceof Type) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException("Schema.extend argument should be a Type, [ Type ], " + "or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type) {
      if (!(type instanceof Type)) {
        throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type.loadKind && type.loadKind !== "scalar") {
        throw new YAMLException("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type.multi) {
        throw new YAMLException("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type) {
      if (!(type instanceof Type)) {
        throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    var result = Object.create(Schema.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  module.exports = Schema;
});

// node_modules/js-yaml/lib/type/str.js
var require_str = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
});

// node_modules/js-yaml/lib/type/seq.js
var require_seq = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
});

// node_modules/js-yaml/lib/type/map.js
var require_map = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
});

// node_modules/js-yaml/lib/schema/failsafe.js
var require_failsafe = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = new Schema({
    explicit: [
      require_str(),
      require_seq(),
      require_map()
    ]
  });
});

// node_modules/js-yaml/lib/type/null.js
var require_null = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlNull(data) {
    if (data === null)
      return true;
    var max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  module.exports = new Type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
});

// node_modules/js-yaml/lib/type/bool.js
var require_bool = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlBoolean(data) {
    if (data === null)
      return false;
    var max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  module.exports = new Type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
});

// node_modules/js-yaml/lib/type/int.js
var require_int = __commonJS((exports, module) => {
  var common = require_common();
  var Type = require_type();
  function isHexCode(c) {
    return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
  }
  function isOctCode(c) {
    return 48 <= c && c <= 55;
  }
  function isDecCode(c) {
    return 48 <= c && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null)
      return false;
    var max = data.length, index = 0, hasDigits = false, ch;
    if (!max)
      return false;
    ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max)
        return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch === "_")
            continue;
          if (ch !== "0" && ch !== "1")
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "x") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch === "_")
            continue;
          if (!isHexCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "o") {
        index++;
        for (;index < max; index++) {
          ch = data[index];
          if (ch === "_")
            continue;
          if (!isOctCode(data.charCodeAt(index)))
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
    }
    if (ch === "_")
      return false;
    for (;index < max; index++) {
      ch = data[index];
      if (ch === "_")
        continue;
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits || ch === "_")
      return false;
    return true;
  }
  function constructYamlInteger(data) {
    var value = data, sign = 1, ch;
    if (value.indexOf("_") !== -1) {
      value = value.replace(/_/g, "");
    }
    ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-")
        sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0")
      return 0;
    if (ch === "0") {
      if (value[1] === "b")
        return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x")
        return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o")
        return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
  }
  module.exports = new Type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
});

// node_modules/js-yaml/lib/type/float.js
var require_float = __commonJS((exports, module) => {
  var common = require_common();
  var Type = require_type();
  var YAML_FLOAT_PATTERN = new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?" + "|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?" + "|[-+]?\\.(?:inf|Inf|INF)" + "|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(data) {
    if (data === null)
      return false;
    if (!YAML_FLOAT_PATTERN.test(data) || data[data.length - 1] === "_") {
      return false;
    }
    return true;
  }
  function constructYamlFloat(data) {
    var value, sign;
    value = data.replace(/_/g, "").toLowerCase();
    sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    var res;
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common.isNegativeZero(object)) {
      return "-0.0";
    }
    res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
  }
  module.exports = new Type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
});

// node_modules/js-yaml/lib/schema/json.js
var require_json = __commonJS((exports, module) => {
  module.exports = require_failsafe().extend({
    implicit: [
      require_null(),
      require_bool(),
      require_int(),
      require_float()
    ]
  });
});

// node_modules/js-yaml/lib/type/timestamp.js
var require_timestamp = __commonJS((exports, module) => {
  var Type = require_type();
  var YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9])" + "-([0-9][0-9])$");
  var YAML_TIMESTAMP_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9]?)" + "-([0-9][0-9]?)" + "(?:[Tt]|[ \\t]+)" + "([0-9][0-9]?)" + ":([0-9][0-9])" + ":([0-9][0-9])" + "(?:\\.([0-9]*))?" + "(?:[ \\t]*(Z|([-+])([0-9][0-9]?)" + "(?::([0-9][0-9]))?))?$");
  function resolveYamlTimestamp(data) {
    if (data === null)
      return false;
    if (YAML_DATE_REGEXP.exec(data) !== null)
      return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
      return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
    match = YAML_DATE_REGEXP.exec(data);
    if (match === null)
      match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null)
      throw new Error("Date resolve error");
    year = +match[1];
    month = +match[2] - 1;
    day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    hour = +match[4];
    minute = +match[5];
    second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      tz_hour = +match[10];
      tz_minute = +(match[11] || 0);
      delta = (tz_hour * 60 + tz_minute) * 60000;
      if (match[9] === "-")
        delta = -delta;
    }
    date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta)
      date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  module.exports = new Type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
});

// node_modules/js-yaml/lib/type/merge.js
var require_merge = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  module.exports = new Type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
});

// node_modules/js-yaml/lib/type/binary.js
var require_binary = __commonJS((exports, module) => {
  var Type = require_type();
  var BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
  function resolveYamlBinary(data) {
    if (data === null)
      return false;
    var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;
    for (idx = 0;idx < max; idx++) {
      code = map.indexOf(data.charAt(idx));
      if (code > 64)
        continue;
      if (code < 0)
        return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map = BASE64_MAP, bits = 0, result = [];
    for (idx = 0;idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map.indexOf(input.charAt(idx));
    }
    tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    var result = "", bits = 0, idx, tail, max = object.length, map = BASE64_MAP;
    for (idx = 0;idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map[bits >> 18 & 63];
        result += map[bits >> 12 & 63];
        result += map[bits >> 6 & 63];
        result += map[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    tail = max % 3;
    if (tail === 0) {
      result += map[bits >> 18 & 63];
      result += map[bits >> 12 & 63];
      result += map[bits >> 6 & 63];
      result += map[bits & 63];
    } else if (tail === 2) {
      result += map[bits >> 10 & 63];
      result += map[bits >> 4 & 63];
      result += map[bits << 2 & 63];
      result += map[64];
    } else if (tail === 1) {
      result += map[bits >> 2 & 63];
      result += map[bits << 4 & 63];
      result += map[64];
      result += map[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  module.exports = new Type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
});

// node_modules/js-yaml/lib/type/omap.js
var require_omap = __commonJS((exports, module) => {
  var Type = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null)
      return true;
    var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
    for (index = 0, length = object.length;index < length; index += 1) {
      pair = object[index];
      pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]")
        return false;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey)
            pairHasKey = true;
          else
            return false;
        }
      }
      if (!pairHasKey)
        return false;
      if (objectKeys.indexOf(pairKey) === -1)
        objectKeys.push(pairKey);
      else
        return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  module.exports = new Type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
});

// node_modules/js-yaml/lib/type/pairs.js
var require_pairs = __commonJS((exports, module) => {
  var Type = require_type();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null)
      return true;
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length;index < length; index += 1) {
      pair = object[index];
      if (_toString.call(pair) !== "[object Object]")
        return false;
      keys = Object.keys(pair);
      if (keys.length !== 1)
        return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null)
      return [];
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length;index < length; index += 1) {
      pair = object[index];
      keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  module.exports = new Type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
});

// node_modules/js-yaml/lib/type/set.js
var require_set = __commonJS((exports, module) => {
  var Type = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null)
      return true;
    var key, object = data;
    for (key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null)
          return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  module.exports = new Type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
});

// node_modules/js-yaml/lib/schema/default.js
var require_default = __commonJS((exports, module) => {
  module.exports = require_json().extend({
    implicit: [
      require_timestamp(),
      require_merge()
    ],
    explicit: [
      require_binary(),
      require_omap(),
      require_pairs(),
      require_set()
    ]
  });
});

// node_modules/js-yaml/lib/loader.js
var require_loader = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var makeSnippet = require_snippet();
  var DEFAULT_SCHEMA = require_default();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function is_EOL(c) {
    return c === 10 || c === 13;
  }
  function is_WHITE_SPACE(c) {
    return c === 9 || c === 32;
  }
  function is_WS_OR_EOL(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function is_FLOW_INDICATOR(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    var lc;
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    lc = c | 32;
    if (97 <= lc && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    return c === 48 ? "\x00" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "\t" : c === 9 ? "\t" : c === 110 ? `
` : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "\x85" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (i = 0;i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  var i;
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.firstTabInLine = -1;
    this.documents = [];
  }
  function generateError(state, message) {
    var mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      var handle, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    var _position, _length, _character, _result;
    if (start < end) {
      _result = state.input.slice(start, end);
      if (checkJson) {
        for (_position = 0, _length = _result.length;_position < _length; _position += 1) {
          _character = _result.charCodeAt(_position);
          if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    var sourceKeys, key, index, quantity;
    if (!common.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    sourceKeys = Object.keys(source);
    for (index = 0, quantity = sourceKeys.length;index < quantity; index += 1) {
      key = sourceKeys[index];
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    var index, quantity;
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (index = 0, quantity = keyNode.length;index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        for (index = 0, quantity = valueNode.length;index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    var ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (is_EOL(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    var _position = state.position, ch;
    ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || is_WS_OR_EOL(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common.repeat(`
`, count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
    ch = state.input.charCodeAt(state.position);
    if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
          break;
        }
      } else if (ch === 35) {
        preceding = state.input.charCodeAt(state.position - 1);
        if (is_WS_OR_EOL(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
        break;
      } else if (is_EOL(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!is_WHITE_SPACE(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    var ch, captureStart, captureEnd;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (is_EOL(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          hexLength = tmp;
          hexResult = 0;
          for (;hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = Object.create(null), keyNode, keyTag, valueNode, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (is_WHITE_SPACE(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (is_WHITE_SPACE(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!is_EOL(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (is_EOL(ch)) {
        emptyLines++;
        continue;
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += `
`;
          }
        }
        break;
      }
      if (folding) {
        if (is_WHITE_SPACE(ch)) {
          atMoreIndented = true;
          state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common.repeat(`
`, emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common.repeat(`
`, emptyLines);
        }
      } else {
        state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      captureStart = state.position;
      while (!is_EOL(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      following = state.input.charCodeAt(state.position + 1);
      if (!is_WS_OR_EOL(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      following = state.input.charCodeAt(state.position + 1);
      _line = state.line;
      if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!is_WS_OR_EOL(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 33)
      return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    var _position, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 38)
      return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    var _position, alias, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 42)
      return false;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type, flowIndent, blockIndent;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (readTagProperty(state) || readAnchorProperty(state)) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (typeIndex = 0, typeQuantity = state.implicitTypes.length;typeIndex < typeQuantity; typeIndex += 1) {
        type = state.implicitTypes[typeIndex];
        if (type.resolve(state.result)) {
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type = null;
        typeList = state.typeMap.multi[state.kind || "fallback"];
        for (typeIndex = 0, typeQuantity = typeList.length;typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
      }
      if (!type.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type.construct(state.result, state.tag);
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = Object.create(null);
    state.anchorMap = Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveName = state.input.slice(_position, state.position);
      directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !is_EOL(ch));
          break;
        }
        if (is_EOL(ch))
          break;
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0)
        readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    } else {
      return;
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += `
`;
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    var state = new State(input, options);
    var nullpos = input.indexOf("\x00");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\x00";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    var documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (var index = 0, length = documents.length;index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load(input, options) {
    var documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  exports.loadAll = loadAll;
  exports.load = load;
});

// node_modules/js-yaml/lib/dumper.js
var require_dumper = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var DEFAULT_SCHEMA = require_default();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_BOM = 65279;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = "\\\"";
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema, map) {
    var result, keys, index, length, tag, style, type;
    if (map === null)
      return {};
    result = {};
    keys = Object.keys(map);
    for (index = 0, length = keys.length;index < length; index += 1) {
      tag = keys[index];
      style = String(map[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      type = schema.compiledTypeMap["fallback"][tag];
      if (type && _hasOwnProperty.call(type.styleAliases, style)) {
        style = type.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    var string, handle, length;
    string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common.repeat("0", length - string.length) + string;
  }
  var QUOTING_TYPE_SINGLE = 1;
  var QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
    while (position < length) {
      next = string.indexOf(`
`, position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== `
`)
        result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return `
` + common.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str) {
    var index, length, type;
    for (index = 0, length = state.implicitTypes.length;index < length; index += 1) {
      type = state.implicitTypes[index];
      if (type.resolve(str)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    var first = string.charCodeAt(pos), second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    var leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  var STYLE_PLAIN = 1;
  var STYLE_SINGLE = 2;
  var STYLE_LITERAL = 3;
  var STYLE_FOLDED = 4;
  var STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    var i;
    var char = 0;
    var prevChar = null;
    var hasLineBreak = false;
    var hasFoldableLine = false;
    var shouldTrackWidth = lineWidth !== -1;
    var previousLineBreak = -1;
    var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      var indent = state.indent * Math.max(1, level);
      var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string, lineWidth) + '"';
        default:
          throw new YAMLException("impossible error: invalid scalar style");
      }
    }();
  }
  function blockHeader(string, indentPerLevel) {
    var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    var clip = string[string.length - 1] === `
`;
    var keep = clip && (string[string.length - 2] === `
` || string === `
`);
    var chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + `
`;
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    var lineRe = /(\n+)([^\n]*)/g;
    var result = function() {
      var nextLF = string.indexOf(`
`);
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    }();
    var prevMoreIndented = string[0] === `
` || string[0] === " ";
    var moreIndented;
    var match;
    while (match = lineRe.exec(string)) {
      var prefix = match[1], line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ")
      return line;
    var breakRe = / [^ ]/g;
    var match;
    var start = 0, end, curr = 0, next = 0;
    var result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += `
` + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += `
`;
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + `
` + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    var result = "";
    var char = 0;
    var escapeSeq;
    for (var i = 0;i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536)
          result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    var _result = "", _tag = state.tag, index, length, value;
    for (index = 0, length = object.length;index < length; index += 1) {
      value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "")
          _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    var _result = "", _tag = state.tag, index, length, value;
    for (index = 0, length = object.length;index < length; index += 1) {
      value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
    for (index = 0, length = objectKeyList.length;index < length; index += 1) {
      pairBuffer = "";
      if (_result !== "")
        pairBuffer += ", ";
      if (state.condenseFlow)
        pairBuffer += '"';
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024)
        pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException("sortKeys must be a boolean or a function");
    }
    for (index = 0, length = objectKeyList.length;index < length; index += 1) {
      pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    var _result, typeList, index, length, type, style;
    typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (index = 0, length = typeList.length;index < length; index += 1) {
      type = typeList[index];
      if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
        if (explicit) {
          if (type.multi && type.representName) {
            state.tag = type.representName(object);
          } else {
            state.tag = type.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type.represent) {
          style = state.styleMap[type.tag] || type.defaultStyle;
          if (_toString.call(type.represent) === "[object Function]") {
            _result = type.represent(object, style);
          } else if (_hasOwnProperty.call(type.represent, style)) {
            _result = type.represent[style](object, style);
          } else {
            throw new YAMLException("!<" + type.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    var type = _toString.call(state.dump);
    var inblock = block;
    var tagStr;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    var objectOrArray = type === "[object Object]" || type === "[object Array]", duplicateIndex, duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid)
          return false;
        throw new YAMLException("unacceptable kind of an object to dump " + type);
      }
      if (state.tag !== null && state.tag !== "?") {
        tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    var objects = [], duplicatesIndexes = [], index, length;
    inspectNode(object, objects, duplicatesIndexes);
    for (index = 0, length = duplicatesIndexes.length;index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    var objectKeyList, index, length;
    if (object !== null && typeof object === "object") {
      index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (index = 0, length = object.length;index < length; index += 1) {
            inspectNode(object[index], objects, duplicatesIndexes);
          }
        } else {
          objectKeyList = Object.keys(object);
          for (index = 0, length = objectKeyList.length;index < length; index += 1) {
            inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump(input, options) {
    options = options || {};
    var state = new State(options);
    if (!state.noRefs)
      getDuplicateReferences(input, state);
    var value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true))
      return state.dump + `
`;
    return "";
  }
  exports.dump = dump;
});

// node_modules/js-yaml/index.js
var require_js_yaml = __commonJS((exports, module) => {
  var loader = require_loader();
  var dumper = require_dumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. " + "Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  exports.Type = require_type();
  exports.Schema = require_schema();
  exports.FAILSAFE_SCHEMA = require_failsafe();
  exports.JSON_SCHEMA = require_json();
  exports.CORE_SCHEMA = require_json();
  exports.DEFAULT_SCHEMA = require_default();
  exports.load = loader.load;
  exports.loadAll = loader.loadAll;
  exports.dump = dumper.dump;
  exports.YAMLException = require_exception();
  exports.types = {
    binary: require_binary(),
    float: require_float(),
    map: require_map(),
    null: require_null(),
    pairs: require_pairs(),
    set: require_set(),
    timestamp: require_timestamp(),
    bool: require_bool(),
    int: require_int(),
    merge: require_merge(),
    omap: require_omap(),
    seq: require_seq(),
    str: require_str()
  };
  exports.safeLoad = renamed("safeLoad", "load");
  exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
  exports.safeDump = renamed("safeDump", "dump");
});

// src/output-formatter.js
var require_output_formatter = __commonJS((exports, module) => {
  var YAML = require_js_yaml();
  function toJSON(data, options = {}) {
    const { pretty = true } = options;
    return JSON.stringify(data, null, pretty ? 2 : undefined);
  }
  function toYAML(data, options = {}) {
    const { indent = 2 } = options;
    return YAML.dump(data, { indent });
  }
  function detectOutputFormat(args) {
    for (let i = 0;i < args.length; i++) {
      if (args[i] === "--json")
        return "json";
      if (args[i] === "--yaml" || args[i] === "--yml")
        return "yaml";
    }
    return null;
  }
  function removeOutputFormatFlags(args) {
    return args.filter((arg) => arg !== "--json" && arg !== "--yaml" && arg !== "--yml");
  }
  function formatFileInfo(name, stat, options = {}) {
    const { basePath, showInode = false, humanReadable = false } = options;
    const info = {
      name,
      type: stat.isDirectory() ? "dir" : stat.isSymbolicLink() ? "link" : stat.isBlockDevice() ? "block" : stat.isCharacterDevice() ? "char" : stat.isFIFO() ? "fifo" : stat.isSocket() ? "socket" : "file",
      size: stat.size,
      mode: parseInt("0" + stat.mode.toString(8).slice(-3), 8),
      uid: stat.uid,
      gid: stat.gid,
      mtime: stat.mtime.toISOString(),
      atime: stat.atime.toISOString(),
      ctime: stat.ctime.toISOString(),
      nlinks: stat.nlink,
      blksize: stat.blksize
    };
    if (showInode) {
      info.inode = stat.ino;
    }
    if (humanReadable && stat.size) {
      info.sizeFormatted = formatFileSize(stat.size);
    }
    return info;
  }
  function formatFileSize(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIdx = 0;
    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx++;
    }
    return unitIdx === 0 ? `${size}${units[unitIdx]}` : `${size.toFixed(1)}${units[unitIdx]}`;
  }
  function formatDirectoryListing(basePath, entries, options = {}) {
    const { recursive = false, showInode = false, humanReadable = false } = options;
    return {
      path: basePath,
      count: entries.length,
      files: entries.map((entry) => formatFileInfo(entry.name, entry.stat, {
        basePath,
        showInode,
        humanReadable
      }))
    };
  }
  module.exports = {
    toJSON,
    toYAML,
    detectOutputFormat,
    removeOutputFormatFlags,
    formatFileInfo,
    formatFileSize,
    formatDirectoryListing
  };
});

// src/fgshell.js
var require_fgshell = __commonJS(() => {
  var __dirname = "/Users/fearlessgeek/fgshell/src";
  var fs = __require("fs");
  var path = __require("path");
  var { spawn } = __require("child_process");
  var readline = __require("readline");
  var os = __require("os");
  var glob = require_commonjs7();
  var minimist = require_minimist();
  var SHELL = require_shell();
  var historyDB = require_history_db();
  var outputFormatter = require_output_formatter();
  var ptctl;
  try {
    ptctl = (()=>{throw new Error("Cannot require module "+"./ptctl.node");})();
  } catch (e) {
    ptctl = { available: false };
  }
  var VERSION;
  try {
    const tryPaths = [
      __require("path").join(__dirname, "package.json"),
      __require("path").join(__dirname, "..", "package.json"),
      __require("path").join(__dirname, "..", "..", "package.json")
    ];
    let pkg = null;
    for (const pkgPath of tryPaths) {
      try {
        pkg = JSON.parse(__require("fs").readFileSync(pkgPath, "utf8"));
        break;
      } catch (e) {}
    }
    VERSION = pkg && pkg.version ? pkg.version : "unknown";
  } catch (e) {
    VERSION = "unknown";
  }
  var help = {
    echo: `echo [-neE] [STRING]...
  Write arguments to standard output.

  Options:
  -n     do not output the trailing newline
  -e     enable interpretation of backslash escapes (default)
  -E     disable interpretation of backslash escapes

  Backslash escapes:
  \\a     alert (bell)
  \\b     backspace
  \\c     suppress further output
  \\e     an escape character
  \\f     form feed
  \\n     new line
  \\r     carriage return
  \\t     horizontal tab
  \\v     vertical tab
  \\\\     backslash
  \\0nnn  byte with octal value nnn
  \\xhh   byte with hexadecimal value hh

  Exit status:
  Always successful (0) unless a write error occurs.
  `,
    cd: `cd [-L|-P] [DIR]
  Change the shell working directory.

  Changes the current working directory to DIR. If DIR is not supplied,
  the value of HOME is used as the default.

  Options:
  -P     physical: resolve symlinks to get to the actual directory
  -L     logical: keep symlinks in the path (default)

  Special values:
  cd -   switches to the previous working directory
  cd ~   changes to the home directory
  cd ~user  changes to user's home directory

  Exit status:
  Returns 0 on successful change, non-zero if the directory cannot be accessed.
  `,
    mkcd: `mkcd [DIR]
  Create a directory and change into it.

  Creates DIR (and any missing parent directories) then changes the
  current working directory to DIR. Equivalent to mkdir -p DIR && cd DIR.

  Exit status:
  Returns 0 on success, non-zero if creation or directory change fails.
  `,
    pwd: `pwd [-LP]
  Print the current working directory.

  Options:
  -L     logical: include symlinks in the printed path (default)
  -P     physical: resolve symlinks to the actual directory

  Exit status:
  Always successful (0) unless an error occurs reading the directory.
  `,
    exit: `exit [n]
  Exit the shell with status n.

  Causes the shell to exit with a status of n. If n is omitted,
  the exit status is that of the last command executed.

  Note: If the shell is not interactive, SIGTERM is sent to all jobs
  before exiting.
  `,
    export: `export [-p] [name[=value] ...]
  Export variables to the environment.

  Marks each name for automatic export to the environment of subsequently
  executed commands. If value is supplied, it is assigned before exporting.

  Options:
  -p     print all exported variables in exportable form

  Exit status:
  Returns 0 unless an invalid option is supplied or assignment fails.
  `,
    unset: `unset [-fv] [name ...]
  Unset shell and environment variables.

  For each name, removes the variable or function definition.

  Options:
  -f     unset only function names
  -v     unset only variable names (default)

  Exit status:
  Returns 0 unless an invalid option is supplied or name is read-only.
  `,
    env: `env [NAME=VALUE ...] [COMMAND [ARGS ...]]
  Execute a command with modified environment.

  With no arguments, prints all environment variables.
  With NAME=VALUE, sets variables in the environment for a command.

  Examples:
  env                  # print all variables
  env PATH=/bin        # print current environment with modified PATH
  env -i TERM=xterm    # clear environment and set only TERM
  `,
    jobs: `jobs [-lnprs] [JOBSPEC ...]
  Display the status of background jobs.

  Options:
  -l     list job IDs with process group IDs
  -n     show only changed jobs
  -p     list only process group IDs
  -r     show only running jobs
  -s     show only stopped jobs

  Exit status:
  Returns 0 unless an invalid option is supplied or JOBSPEC not found.
  `,
    fg: `fg [JOBSPEC]
  Move a job to the foreground.

  Resumes JOBSPEC in the foreground. If JOBSPEC is not supplied,
  the shell's notion of the current job is used.

  JOBSPEC can be:
  %n        nth job in the job list
  %string   job started with 'string'
  %%        current job
  %+        current job (same as %%)
  %-        previous job

  Exit status:
  Returns the exit status of the resumed job, or non-zero if not found.
  `,
    bg: `bg [JOBSPEC ...]
  Continue stopped jobs in the background.

  Resumes each JOBSPEC as a background job. If JOBSPEC is not supplied,
  the shell's notion of the current job is used.

  JOBSPEC can be:
  %n        nth job in the job list
  %string   job started with 'string'
  %%        current job
  %+        current job (same as %%)
  %-        previous job

  Exit status:
  Returns 0 unless an invalid JOBSPEC is given.
  `,
    history: `history [-c] [-w] [-r] [FILENAME] or history [-n] [COUNT]
  Display the command history.

  With no options, displays the entire history with line numbers.

  Options:
  -c     clear the history list
  -w     write history to FILENAME (or ~/.bash_history)
  -r     read history from FILENAME (or ~/.bash_history)
  -n N   display the last N commands

  Exit status:
  Returns 0 unless an invalid option is supplied or file cannot be accessed.
  `,
    ls: `ls [OPTION]... [FILE]...
  List information about files and directories.

  Options:
  -a, --all                 do not ignore entries starting with .
  -A, --almost-all          same as -a but do not list . and ..
  -C                        list entries by columns
  -d, --directory           list directories themselves, not their contents
  -h, --human-readable      with -l, print sizes in human readable format
  -l                        use a long listing format
  -1                        list one file per line
  -R, --recursive           list subdirectories recursively
  -r, --reverse             reverse the sort order
  -S                        sort by file size, largest first
  -t                        sort by time, newest first
  -u                        sort by access time
  -U                        do not sort; list in directory order
  -v                        sort by version numbers
  --color[=WHEN]            colorize the output (auto, always, never)
  -G, --no-group            in long listing, don't print group names
  --full-time               show full date and time
  --help                    display this help and exit
  --version                 output version information and exit
  `,
    printf: `printf FORMAT [ARGUMENT]...
  Write the formatted arguments to the standard output under the control of the format.

  Format string escapes:
  \\a     alert (bell)
  \\b     backspace
  \\c     suppress further output
  \\e     escape character
  \\f     form feed
  \\n     new line
  \\r     carriage return
  \\t     horizontal tab
  \\v     vertical tab
  \\\\     backslash
  \\0nnn   character with octal value nnn

  Format conversions:
  %s     string
  %d, %i decimal integer
  %f     floating point
  %x     hexadecimal
  %o     octal
  %c     single character
  %%     literal %
  `,
    alias: `alias [-p] [name[=value] ...]
  Define or display aliases.

  An alias is an alternative name for a command. When a command is typed,
  the shell checks for aliases and substitutes the alias value before
  executing the command.

  Without arguments, prints all defined aliases in the form:
  alias name='value'

  Options:
  -p              print all aliases in exportable format

  Arguments:
  name             display the alias named 'name'
  name=value       define 'name' as an alias for 'value'
  name1=v1 ...    define multiple aliases at once

  Alias rules:
  - Aliases are expanded in non-interactive mode only if on a separate line
  - Aliases cannot be recursive (alias foo=foo)
  - An alias cannot reference another alias in expansion

  Examples:
  alias                      # list all aliases
  alias ls                   # show what 'ls' is aliased to
  alias ls='ls -l'           # alias ls to ls -l
  alias rm='rm -i'           # alias rm to rm -i (confirm deletions)
  alias mygrep='grep -n'     # create custom alias

  Exit status:
  Returns 0 unless name is invalid or assignment fails.
  `,
    unalias: `unalias [-a] [name ...]
  Remove aliases.

  Removes each named alias. The -a option removes all aliases.

  Options:
  -a              remove all defined aliases
  
  Without -a, removes only the specified aliases by name.
  Attempting to unalias a non-existent alias is not an error.

  Examples:
  unalias ls                 # remove 'ls' alias
  unalias rm cd              # remove multiple aliases
  unalias -a                 # remove all aliases at once

  Exit status:
  Returns 0 unless an invalid option is supplied.
  `,
    source: `source FILENAME [ARGUMENTS]
  Read and execute commands from a file in the current shell.

  The FILENAME is sourced (executed) in the current shell context,
  rather than in a subshell. This means all variable assignments,
  function definitions, and other changes are preserved after the
  file finishes executing.

  Differences from running as script:
  - Changes to environment variables persist
  - Changes to shell variables persist
  - Functions defined in the file are available in the current shell
  - No subshell is created

  Arguments passed to source are available as $1, $2, etc.

  Exit status:
  Returns the exit status of the last command executed in FILENAME,
  or non-zero if FILENAME cannot be read.

  Examples:
  source ~/.bashrc           # load shell configuration
  source setup.sh PARAM1     # run setup script with argument
  `,
    js: `js [CODE]
  Execute JavaScript code in the shell context.

  Executes JavaScript CODE and prints the result. The code has access
  to shell state through:
  - SHELL.env          object containing environment variables
  - SHELL.cwd          current working directory
  - SHELL.jobs         array of background jobs
  - process.env        Node.js environment variables
  - require()          load Node.js modules

  The result of the last expression is printed to stdout.

  Examples:
  js Math.sqrt(16)                       # prints 4
  js Object.keys(process.env).length     # count env variables
  js SHELL.env['PATH']                   # show PATH
  js SHELL.cwd                           # show current directory
  js require('fs').readdirSync('.')      # list files in directory

  Exit status:
  Returns 0 on success, non-zero if code throws an error.
  `,
    read: `read [-ers] [-p prompt] [-t timeout] [-n nchars] [-d delim] [VARIABLE ...]
  Read a line from standard input.

  Options:
  -p prompt     display prompt before reading
  -t timeout    read times out after timeout seconds
  -n nchars     read stops after nchars characters
  -d delim      read stops after delimiter character
  -e            use Readline for input
  -r            do not interpret backslash escapes
  -s            do not echo input (useful for passwords)

  If no VARIABLE is given, the input is assigned to REPLY.
  The input line is split into fields assigned to multiple variables.

  Exit status:
  Returns 0 unless EOF is encountered, a timeout expires, or invalid option.
  `,
    "[": `[ EXPRESSION ]
  Evaluate a conditional expression (POSIX test).

  File tests:
  -b FILE      true if FILE exists and is a block special file
  -c FILE      true if FILE exists and is a character special file
  -d FILE      true if FILE exists and is a directory
  -e FILE      true if FILE exists
  -f FILE      true if FILE exists and is a regular file
  -g FILE      true if FILE exists and has setgid bit set
  -h FILE      true if FILE exists and is a symbolic link
  -L FILE      true if FILE exists and is a symbolic link (same as -h)
  -k FILE      true if FILE exists and has sticky bit set
  -p FILE      true if FILE exists and is a named pipe
  -r FILE      true if FILE exists and is readable
  -s FILE      true if FILE exists and has size greater than 0
  -u FILE      true if FILE exists and has setuid bit set
  -w FILE      true if FILE exists and is writable
  -x FILE      true if FILE exists and is executable
  -O FILE      true if FILE is owned by the effective user ID
  -G FILE      true if FILE is owned by the effective group ID

  String tests:
  -n STRING    true if STRING is not empty (default)
  -z STRING    true if STRING is empty
  STRING1 = STRING2    true if strings are equal
  STRING1 != STRING2   true if strings are not equal
  STRING1 < STRING2    true if STRING1 sorts before STRING2
  STRING1 > STRING2    true if STRING1 sorts after STRING2

  Arithmetic tests:
  INT1 -eq INT2   equal
  INT1 -ne INT2   not equal
  INT1 -lt INT2   less than
  INT1 -le INT2   less than or equal
  INT1 -gt INT2   greater than
  INT1 -ge INT2   greater than or equal

  Logical:
  ! EXPR              true if EXPR is false
  EXPR1 -a EXPR2      true if both are true (AND, implied)
  EXPR1 -o EXPR2      true if either is true (OR)
  ( EXPR )            grouping

  Note: This form requires ] as the last argument.

  Exit status:
  Returns 0 if EXPRESSION is true, 1 if false or invalid.
  `,
    cat: `cat [-bEnstv] [FILE ...]
  Concatenate files and print to standard output.

  With no FILE or when FILE is -, reads from standard input.

  Options:
  -b      number only non-empty output lines
  -E      display $ at end of each line
  -n      number all output lines
  -s      suppress repeated empty lines
  -t      display tabs as ^I
  -v      display non-printing characters

  Exit status:
  Returns 0 on success, non-zero if FILE cannot be read.

  Examples:
  cat file.txt                # display file
  cat file1 file2             # concatenate and display
  cat > file.txt              # create file from stdin (Ctrl+D to end)
  cat << EOF                  # read until delimiter
  `,
    test: `test [EXPRESSION]
  Evaluate a conditional expression (same as [ ]).

  Identical to [ EXPRESSION ] but does not require ] as the last argument.

  All operators and syntax are the same as [ ], including:
  File tests, string tests, arithmetic tests, and logical operators.

  Exit status:
  Returns 0 if EXPRESSION is true, 1 if false or invalid.

  Examples:
  test -f /etc/passwd         # check if file exists
  test "$var" = "value"       # compare strings
  test -d /tmp                # check if directory exists
  test $x -gt 5               # arithmetic comparison
  `
  };
  function writeOutput(text) {
    if (rl.terminal) {
      process.stdout.write("\x1B[2K\r");
    }
    process.stdout.write(text);
    if (!text.endsWith(`
`)) {
      process.stdout.write(`
`);
    }
  }
  var SHELL_ARRAYS = {};
  function formatError(message, context, sourceSnippet, includeStack) {
    if (!context || !context.filename) {
      return message;
    }
    const basename = path.basename(context.filename);
    let formatted = `${basename}:${context.startLine}`;
    if (context.startLine !== context.endLine) {
      formatted += `-${context.endLine}`;
    }
    formatted += `: error: ${message}`;
    if (sourceSnippet && context.content) {
      const firstLine = context.content.split(`
`)[0];
      formatted += `
  ${firstLine}`;
    }
    if (includeStack && CALL_STACK.length > 0) {
      formatted += formatCallStack();
    }
    return formatted;
  }
  var builtins;
  try {
    builtins = {
      echo: function(args) {
        if (args.includes("--help")) {
          console.log(help.echo);
          return 0;
        }
        let interpretEscapes = false;
        let startIdx = 1;
        if (args[1] === "-e") {
          interpretEscapes = true;
          startIdx = 2;
        }
        let output = args.slice(startIdx).join(" ");
        if (interpretEscapes) {
          output = output.replace(/\\n/g, `
`).replace(/\\t/g, "\t").replace(/\\r/g, "\r").replace(/\\033/g, "\x1B").replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
        writeOutput(output);
        return 0;
      },
      cd: function(args) {
        if (args.includes("--help")) {
          console.log(help.cd);
          return 0;
        }
        const target = args[1] || SHELL.env.HOME || process.env.HOME || "/tmp";
        try {
          const newdir = path.resolve(SHELL.cwd, target);
          fs.accessSync(newdir);
          SHELL.cwd = newdir;
          process.chdir(SHELL.cwd);
        } catch (e) {
          console.error("cd: " + e.message);
          return 1;
        }
        return 0;
      },
      mkcd: function(args) {
        if (args.includes("--help")) {
          console.log(help.mkcd);
          return 0;
        }
        const target = args[1];
        if (!target) {
          console.error("mkcd: missing directory argument");
          return 1;
        }
        try {
          const newdir = path.resolve(SHELL.cwd, target);
          fs.mkdirSync(newdir, { recursive: true });
          fs.accessSync(newdir);
          SHELL.cwd = newdir;
          process.chdir(SHELL.cwd);
        } catch (e) {
          console.error("mkcd: " + e.message);
          return 1;
        }
        return 0;
      },
      pwd: function(args) {
        if (args.includes("--help")) {
          console.log(help.pwd);
          return 0;
        }
        console.log(SHELL.cwd);
        return 0;
      },
      exit: function(args) {
        if (args.includes("--help")) {
          console.log(help.exit);
          return 0;
        }
        const code = args[1] ? Number(args[1]) || 0 : 0;
        process.exit(code);
      },
      export: function(args) {
        if (args.includes("--help")) {
          console.log(help.export);
          return 0;
        }
        for (let i = 1;i < args.length; i++) {
          const part = args[i];
          const eq = part.indexOf("=");
          if (eq >= 0) {
            const key = part.slice(0, eq);
            const val = part.slice(eq + 1);
            SHELL.env[key] = val;
          } else {
            SHELL.env[part] = process.env[part] || "";
          }
        }
        return 0;
      },
      unset: function(args) {
        if (args.includes("--help")) {
          console.log(help.unset);
          return 0;
        }
        for (let i = 1;i < args.length; i++) {
          delete SHELL.env[args[i]];
        }
        return 0;
      },
      env: function(args) {
        if (args.includes("--help")) {
          console.log(help.env);
          return 0;
        }
        const outputFormat = outputFormatter.detectOutputFormat(args);
        const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
        if (outputFormat) {
          const envData = SHELL.env;
          if (outputFormat === "json") {
            console.log(outputFormatter.toJSON(envData));
          } else if (outputFormat === "yaml") {
            console.log(outputFormatter.toYAML(envData));
          }
        } else {
          for (const k of Object.keys(SHELL.env)) {
            console.log(`${k}=${SHELL.env[k]}`);
          }
        }
        return 0;
      },
      jobs: function(args) {
        if (args.includes("--help")) {
          console.log(help.jobs);
          return 0;
        }
        const outputFormat = outputFormatter.detectOutputFormat(args);
        const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
        if (outputFormat) {
          const jobsData = SHELL.jobs.map((j) => ({
            id: j.id,
            status: j.status,
            cmdline: j.cmdline,
            pids: j.pids,
            background: j.background || false
          }));
          if (outputFormat === "json") {
            console.log(outputFormatter.toJSON(jobsData));
          } else if (outputFormat === "yaml") {
            console.log(outputFormatter.toYAML(jobsData));
          }
        } else {
          for (const j of SHELL.jobs) {
            console.log(`[${j.id}] ${j.status}	${j.cmdline}`);
          }
        }
        return 0;
      },
      fg: async function(args) {
        if (args.includes("--help")) {
          console.log(help.fg);
          return 0;
        }
        const id = args[1] ? Number(args[1].replace("%", "")) : SHELL.jobs.length ? SHELL.jobs[SHELL.jobs.length - 1].id : null;
        if (!id) {
          console.error("fg: no job");
          return 1;
        }
        const job = SHELL.jobs.find((j) => j.id === id);
        if (!job) {
          console.error("fg: job not found");
          return 1;
        }
        console.log(job.cmdline);
        job.background = false;
        job.status = "running";
        if (job.pty) {
          rl.pause();
          process.stdin.setRawMode(true);
          const ptyInputHandler = (data) => job.pty.write(data.toString());
          process.stdin.on("data", ptyInputHandler);
          const resizeHandler = () => {
            if (job.pty)
              job.pty.resize(process.stdout.columns, process.stdout.rows);
          };
          process.stdout.on("resize", resizeHandler);
          resizeHandler();
          try {
            process.kill(job.pty.pid, "SIGCONT");
          } catch (e) {}
          await new Promise((resolve) => {
            const exitHandler = job.pty.onExit(() => {
              process.stdin.removeListener("data", ptyInputHandler);
              process.stdout.removeListener("resize", resizeHandler);
              if (process.stdin.isTTY)
                process.stdin.setRawMode(false);
              resolve();
            });
            const checkSuspended = setInterval(() => {
              if (job.status === "stopped") {
                process.stdin.removeListener("data", ptyInputHandler);
                process.stdout.removeListener("resize", resizeHandler);
                if (process.stdin.isTTY)
                  process.stdin.setRawMode(false);
                clearInterval(checkSuspended);
                console.log(`
[${job.id}] Stopped	${job.cmdline}`);
                resolve();
              }
            }, 100);
          });
          if (rl.paused) {
            rl.resume();
            prompt().catch(() => {});
          }
        } else {
          try {
            for (const pid of job.pids) {
              process.kill(pid, "SIGCONT");
            }
          } catch (e) {
            console.error("fg:", e.message);
            return 1;
          }
          await waitForJob(job);
        }
        return 0;
      },
      bg: function(args) {
        if (args.includes("--help")) {
          console.log(help.bg);
          return 0;
        }
        const id = args[1] ? Number(args[1].replace("%", "")) : SHELL.jobs.length ? SHELL.jobs[SHELL.jobs.length - 1].id : null;
        if (!id) {
          console.error("bg: no job");
          return 1;
        }
        const job = SHELL.jobs.find((j) => j.id === id);
        if (!job) {
          console.error("bg: job not found");
          return 1;
        }
        try {
          for (const pid of job.pids) {
            process.kill(pid, "SIGCONT");
          }
          job.status = "running";
        } catch (e) {
          console.error("bg:", e.message);
          return 1;
        }
        return 0;
      },
      history: function(args) {
        if (args.includes("--help")) {
          console.log(help.history);
          return 0;
        }
        const outputFormat = outputFormatter.detectOutputFormat(args);
        const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
        let entries;
        if (filteredArgs.length === 1) {
          entries = historyDB.getAll(1000);
        } else {
          const query = filteredArgs.slice(1).join(" ");
          entries = historyDB.search(query, 50);
        }
        if (outputFormat) {
          const historyData = entries.map((e) => ({
            id: e.id,
            command: e.command,
            timestamp: new Date(e.timestamp * 1000).toISOString(),
            exit_code: e.exit_code
          }));
          if (outputFormat === "json") {
            console.log(outputFormatter.toJSON(historyData));
          } else if (outputFormat === "yaml") {
            console.log(outputFormatter.toYAML(historyData));
          }
        } else {
          if (entries.length === 0) {
            console.log("No matching commands found");
          } else {
            for (let i = 0;i < entries.length; i++) {
              const e = entries[i];
              const timestamp = new Date(e.timestamp * 1000).toLocaleString();
              const exitCode = e.exit_code !== null ? ` [${e.exit_code}]` : "";
              console.log(`${e.id}	${timestamp}${exitCode}	${e.command}`);
            }
          }
        }
        return 0;
      },
      ls: function(args) {
        if (args.includes("--help")) {
          console.log(help.ls);
          return 0;
        }
        const outputFormat = outputFormatter.detectOutputFormat(args);
        const filteredArgs = outputFormatter.removeOutputFormatFlags(args);
        const argv = minimist(filteredArgs.slice(1), {
          alias: {
            all: "a",
            "almost-all": "A",
            long: "l",
            "human-readable": "h",
            reverse: "r",
            recursive: "R",
            sort: "S",
            time: "t",
            directory: "d",
            classify: "F",
            inode: "i",
            size: "s"
          },
          boolean: ["a", "A", "l", "h", "r", "R", "S", "t", "c", "C", "d", "D", "f", "F", "g", "G", "i", "k", "L", "m", "n", "N", "o", "p", "q", "Q", "s", "U", "v", "x", "X", "Z", "1", "G"],
          string: ["color"]
        });
        const longFormat = argv.l;
        const allFiles = argv.a;
        const almostAll = argv.A;
        const humanReadable = argv.h;
        const reverse = argv.r;
        const recursive = argv.R;
        const sortBySize = argv.S;
        const sortByTime = argv.t;
        const directory = argv.d;
        const classify = argv.F;
        const showInode = argv.i;
        const showSize = argv.s;
        let useColor = !outputFormat && (argv.color === true || argv.color === "always" || argv.color !== "never" && process.stdout.isTTY);
        const colorize = (name, stat) => {
          if (!useColor)
            return name;
          const colors = {
            dir: "\x1B[34m",
            link: "\x1B[36m",
            exe: "\x1B[32m",
            special: "\x1B[33m",
            reset: "\x1B[0m"
          };
          if (stat.isDirectory())
            return colors.dir + name + colors.reset;
          if (stat.isSymbolicLink())
            return colors.link + name + colors.reset;
          if (stat.mode & 73)
            return colors.exe + name + colors.reset;
          if (stat.isCharacterDevice() || stat.isBlockDevice() || stat.isFIFO() || stat.isSocket()) {
            return colors.special + name + colors.reset;
          }
          return name;
        };
        let paths = argv._;
        if (paths.length === 0) {
          paths.push(SHELL.cwd);
        }
        const allResults = [];
        const listPath = (targetPath) => {
          try {
            let stat;
            try {
              stat = fs.statSync(targetPath);
            } catch (statErr) {
              console.error(`ls: cannot access '${targetPath}': ${statErr.message}`);
              return;
            }
            if (directory) {
              printEntries([path.basename(targetPath)], path.dirname(targetPath), targetPath);
              return;
            }
            if (!stat.isDirectory()) {
              printEntries([path.basename(targetPath)], path.dirname(targetPath), targetPath);
              return;
            }
            if (!outputFormat && (paths.length > 1 || recursive)) {
              console.log(`${targetPath}:`);
            }
            let entries;
            try {
              entries = fs.readdirSync(targetPath);
            } catch (readErr) {
              console.error(`ls: cannot open directory '${targetPath}': ${readErr.message}`);
              return;
            }
            let filteredEntries = entries;
            if (!allFiles && !almostAll) {
              filteredEntries = entries.filter((e) => !e.startsWith("."));
            }
            if (almostAll) {
              filteredEntries = entries.filter((e) => e !== "." && e !== "..");
            }
            printEntries(filteredEntries, targetPath, targetPath);
            if (recursive) {
              for (const entry of filteredEntries) {
                const fullPath = path.join(targetPath, entry);
                const entryStat = fs.statSync(fullPath);
                if (entryStat.isDirectory()) {
                  if (!outputFormat)
                    console.log("");
                  listPath(fullPath);
                }
              }
            }
          } catch (e) {
            console.error(`ls: cannot access '${targetPath}': ${e.message}`);
          }
        };
        const printEntries = (entries, basePath, originalPath) => {
          let files = entries.map((entry) => {
            const fullPath = path.join(basePath, entry);
            try {
              const stat = fs.statSync(fullPath);
              return { name: entry, stat };
            } catch (e) {
              return { name: entry, stat: null };
            }
          }).filter((file) => file.stat);
          if (sortBySize) {
            files.sort((a, b) => b.stat.size - a.stat.size);
          } else if (sortByTime) {
            files.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
          } else {
            files.sort((a, b) => a.name.localeCompare(b.name));
          }
          if (reverse) {
            files.reverse();
          }
          if (outputFormat) {
            const listing = outputFormatter.formatDirectoryListing(originalPath, files, { showInode, humanReadable });
            allResults.push(listing);
            return;
          }
          const getIndicator = (stat) => {
            if (!classify)
              return "";
            if (stat.isDirectory())
              return "/";
            if (stat.isSymbolicLink())
              return "@";
            if (stat.isSocket())
              return "=";
            if (stat.isFIFO())
              return "|";
            if (stat.mode & 73)
              return "*";
            return "";
          };
          if (longFormat) {
            for (const file of files) {
              const { name, stat } = file;
              const inode = showInode ? `${stat.ino} ` : "";
              const sizeInBlocks = showSize ? `${Math.ceil(stat.size / 1024)} ` : "";
              const mode = stat.mode.toString(8).slice(-3);
              const size = humanReadable ? formatSize(stat.size) : stat.size.toString().padStart(10);
              const mtime = stat.mtime.toLocaleString();
              const indicator = getIndicator(stat);
              const coloredName = colorize(name, stat);
              console.log(`${inode}${sizeInBlocks}${mode} ${size} ${mtime} ${coloredName}${indicator}`);
            }
          } else if (argv.m) {
            const names = files.map((f2) => {
              const indicator = getIndicator(f2.stat);
              const coloredName = colorize(f2.name, f2.stat);
              return `${coloredName}${indicator}`;
            });
            console.log(names.join(", "));
          } else if (argv["1"]) {
            const names = files.map((f2) => {
              const indicator = getIndicator(f2.stat);
              const coloredName = colorize(f2.name, f2.stat);
              return `${coloredName}${indicator}`;
            });
            for (const name of names) {
              const inode = showInode ? `${f.stat.ino} ` : "";
              const sizeInBlocks = showSize ? `${Math.ceil(f.stat.size / 1024)} ` : "";
              console.log(`${inode}${sizeInBlocks}${name}`);
            }
          } else if (argv.C || argv.x) {
            const names = files.map((f2) => {
              const indicator = getIndicator(f2.stat);
              const inode = showInode ? `${f2.stat.ino} ` : "";
              const sizeInBlocks = showSize ? `${Math.ceil(f2.stat.size / 1024)} ` : "";
              const coloredName = colorize(f2.name, f2.stat);
              return `${inode}${sizeInBlocks}${coloredName}${indicator}`;
            });
            const termWidth = process.stdout.columns || 80;
            if (argv.x) {
              let output = "";
              for (const name of names) {
                if (output.length + name.length + 2 > termWidth) {
                  console.log(output);
                  output = "";
                }
                output += name + "  ";
              }
              if (output) {
                console.log(output);
              }
            } else {
              const maxNameLength = Math.max(...names.map((n) => n.length)) + 2;
              const numCols = Math.floor(termWidth / maxNameLength);
              const numRows = Math.ceil(names.length / numCols);
              for (let i = 0;i < numRows; i++) {
                let line = "";
                for (let j = 0;j < numCols; j++) {
                  const index = i + j * numRows;
                  if (index < names.length) {
                    line += names[index].padEnd(maxNameLength);
                  }
                }
                console.log(line);
              }
            }
          } else {
            const names = files.map((f2) => {
              const indicator = getIndicator(f2.stat);
              const inode = showInode ? `${f2.stat.ino} ` : "";
              const sizeInBlocks = showSize ? `${Math.ceil(f2.stat.size / 1024)} ` : "";
              const coloredName = colorize(f2.name, f2.stat);
              return `${inode}${sizeInBlocks}${coloredName}${indicator}`;
            });
            for (const name of names) {
              console.log(name);
            }
          }
        };
        const formatSize = (bytes) => {
          if (bytes === 0)
            return "0B";
          const k = 1024;
          const sizes = ["B", "K", "M", "G", "T"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
        };
        for (let i = 0;i < paths.length; i++) {
          const targetPath = path.resolve(SHELL.cwd, paths[i]);
          listPath(targetPath);
        }
        if (outputFormat) {
          const output = allResults.length === 1 ? allResults[0] : allResults;
          if (outputFormat === "json") {
            console.log(outputFormatter.toJSON(output));
          } else if (outputFormat === "yaml") {
            console.log(outputFormatter.toYAML(output));
          }
        }
        return 0;
      },
      printf: function(args) {
        if (args.includes("--help")) {
          console.log(help.printf);
          return 0;
        }
        if (args.length < 2) {
          console.error("printf: not enough arguments");
          return 1;
        }
        const format = args[1];
        const values = args.slice(2);
        let output = "";
        let valueIdx = 0;
        for (let i = 0;i < format.length; i++) {
          if (format[i] === "\\" && i + 1 < format.length) {
            const esc = format[i + 1];
            if (esc === "n") {
              output += `
`;
              i++;
            } else if (esc === "t") {
              output += "\t";
              i++;
            } else if (esc === "r") {
              output += "\r";
              i++;
            } else if (esc === "b") {
              output += "\b";
              i++;
            } else if (esc === "f") {
              output += "\f";
              i++;
            } else if (esc === "v") {
              output += "\v";
              i++;
            } else if (esc === "\\") {
              output += "\\";
              i++;
            } else if (esc === "0") {
              output += "\x00";
              i++;
            } else {
              output += format[i];
            }
          } else if (format[i] === "%" && i + 1 < format.length) {
            const spec = format[i + 1];
            if (spec === "%") {
              output += "%";
              i++;
            } else if (spec === "s") {
              output += values[valueIdx] || "";
              valueIdx++;
              i++;
            } else if (spec === "d" || spec === "i") {
              const val = parseInt(values[valueIdx] || "0", 10);
              output += val.toString();
              valueIdx++;
              i++;
            } else if (spec === "f") {
              const val = parseFloat(values[valueIdx] || "0");
              output += val.toString();
              valueIdx++;
              i++;
            } else if (spec === "x") {
              const val = parseInt(values[valueIdx] || "0", 10);
              output += val.toString(16);
              valueIdx++;
              i++;
            } else if (spec === "o") {
              const val = parseInt(values[valueIdx] || "0", 10);
              output += val.toString(8);
              valueIdx++;
              i++;
            } else if (spec === "c") {
              const val = values[valueIdx] || "";
              output += val.length > 0 ? val[0] : "";
              valueIdx++;
              i++;
            } else if (spec === "n") {
              i++;
            } else {
              output += "%" + spec;
              i++;
            }
          } else {
            output += format[i];
          }
        }
        writeOutput(output);
        return 0;
      },
      alias: function(args) {
        if (args.includes("--help")) {
          console.log(help.alias);
          return 0;
        }
        if (args.length === 1) {
          for (const alias in SHELL.aliases) {
            console.log(`alias ${alias}='${SHELL.aliases[alias]}'`);
          }
        } else {
          for (let i = 1;i < args.length; i++) {
            const arg = args[i];
            const eq = arg.indexOf("=");
            if (eq > 0) {
              const key = arg.slice(0, eq);
              const val = arg.slice(eq + 1);
              SHELL.aliases[key] = val;
            } else {
              if (arg in SHELL.aliases) {
                console.log(`alias ${arg}='${SHELL.aliases[arg]}'`);
              }
            }
          }
        }
        return 0;
      },
      unalias: function(args) {
        if (args.includes("--help")) {
          console.log(help.unalias);
          return 0;
        }
        if (args.length === 1) {
          console.error("unalias: usage: unalias [-a] name [name ...]");
          return 1;
        }
        for (let i = 1;i < args.length; i++) {
          delete SHELL.aliases[args[i]];
        }
        return 0;
      },
      source: async function(args) {
        if (args.includes("--help")) {
          console.log(help.source);
          return 0;
        }
        if (args.length < 2) {
          console.error("source: usage: source <file>");
          return 1;
        }
        const file = args[1];
        const filePath = path.resolve(SHELL.cwd, expandVars(file));
        try {
          const script = fs.readFileSync(filePath, "utf8");
          const lines = script.split(`
`);
          for (let idx = 0;idx < lines.length; idx++) {
            const line = lines[idx];
            if (line.trim() && !line.trim().startsWith("#")) {
              await runLine(line);
            }
          }
          return 0;
        } catch (e) {
          console.error(`source: ${e.message}`);
          return 1;
        }
      },
      js: async function(args) {
        if (args.includes("--help")) {
          console.log(help.js);
          return 0;
        }
        if (args.length < 2) {
          console.error("js: usage: js <code>");
          return 1;
        }
        const code = args.slice(1).join(" ");
        try {
          const context = {
            env: SHELL.env,
            cwd: SHELL.cwd,
            home: SHELL.env.HOME || process.env.HOME || "/tmp",
            user: (() => {
              try {
                return os.userInfo().username;
              } catch (e) {
                return SHELL.env.USER || SHELL.env.LOGNAME || "user";
              }
            })(),
            cd: (dir) => {
              const target = path.resolve(SHELL.cwd, expandVars(dir));
              try {
                fs.accessSync(target);
                SHELL.cwd = target;
                process.chdir(SHELL.cwd);
                return true;
              } catch (e) {
                return false;
              }
            },
            pwd: () => SHELL.cwd,
            ls: (dir) => {
              const target = dir ? path.resolve(SHELL.cwd, dir) : SHELL.cwd;
              try {
                return fs.readdirSync(target);
              } catch (e) {
                return [];
              }
            },
            readFile: (file) => {
              const target = path.resolve(SHELL.cwd, file);
              return fs.readFileSync(target, "utf8");
            },
            writeFile: (file, content) => {
              const target = path.resolve(SHELL.cwd, file);
              fs.writeFileSync(target, content, "utf8");
              return true;
            }
          };
          const contextKeys = Object.keys(context);
          const contextValues = Object.values(context);
          const hasMultipleStatements = code.includes(`
`) || (code.match(/;/g) || []).length > 1 || code.trim().endsWith(";");
          let result;
          let fn;
          if (hasMultipleStatements) {
            fn = new Function(...contextKeys, `return (async () => { ${code} })()`);
            result = await fn(...contextValues);
          } else {
            try {
              fn = new Function(...contextKeys, `return (async () => { return ${code} })()`);
              result = await fn(...contextValues);
            } catch (e) {
              fn = new Function(...contextKeys, `return (async () => { ${code} })()`);
              result = await fn(...contextValues);
            }
          }
          if (result !== undefined && result !== null) {
            if (typeof result === "object") {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result);
            }
          }
          return 0;
        } catch (e) {
          console.error(`js error: ${e.message}`);
          return 1;
        }
      },
      read: async function(args) {
        if (args.includes("--help")) {
          console.log(help.read);
          return 0;
        }
        if (args.length < 2) {
          console.error("read: usage: read [-p prompt] VAR1 [VAR2 ...]");
          return 1;
        }
        let varNames = [];
        let promptText = "";
        let i = 1;
        if (args[i] === "-p" && i + 1 < args.length) {
          promptText = args[i + 1];
          i += 2;
        }
        while (i < args.length) {
          varNames.push(args[i]);
          i++;
        }
        if (varNames.length === 0) {
          console.error("read: no variable names specified");
          return 1;
        }
        return new Promise((resolve) => {
          if (!rl.paused) {
            rl.pause();
          }
          if (promptText) {
            process.stdout.write(promptText);
          }
          const rlLocal = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
          });
          let resolved = false;
          rlLocal.once("line", (line) => {
            if (!resolved) {
              resolved = true;
              const parts = line.split(/\s+/);
              for (let j = 0;j < varNames.length; j++) {
                SHELL.env[varNames[j]] = parts[j] || "";
              }
              rlLocal.close();
              resolve(0);
            }
          });
          rlLocal.once("close", () => {
            if (!resolved) {
              resolved = true;
              rlLocal.close();
              resolve(0);
            }
          });
          rlLocal.once("error", () => {
            if (!resolved) {
              resolved = true;
              rlLocal.close();
              resolve(1);
            }
          });
        });
      },
      "[": function(args) {
        if (args.includes("--help")) {
          console.log(help["["]);
          return 0;
        }
        if (args[args.length - 1] !== "]") {
          console.error("[: missing ]");
          return 1;
        }
        const expr = args.slice(1, -1);
        if (expr.length === 0) {
          return 1;
        }
        if (expr.length === 3) {
          const [left, op, right] = expr;
          const lVal = expandVars(left);
          const rVal = expandVars(right);
          const lNum = Number(lVal);
          const rNum = Number(rVal);
          let result = false;
          switch (op) {
            case "-eq":
              result = lNum === rNum;
              break;
            case "-ne":
              result = lNum !== rNum;
              break;
            case "-lt":
              result = lNum < rNum;
              break;
            case "-le":
              result = lNum <= rNum;
              break;
            case "-gt":
              result = lNum > rNum;
              break;
            case "-ge":
              result = lNum >= rNum;
              break;
            case "=":
            case "==":
              result = lVal === rVal;
              break;
            case "!=":
              result = lVal !== rVal;
              break;
            case "-z":
              result = lVal.length === 0;
              break;
            case "-n":
              result = lVal.length > 0;
              break;
          }
          return result ? 0 : 1;
        }
        if (expr.length === 1) {
          const val = expandVars(expr[0]);
          return val.length > 0 ? 0 : 1;
        }
        return 1;
      },
      cat: function(args) {
        if (args.includes("--help")) {
          console.log(help.cat);
          return 0;
        }
        if (args.length < 2) {
          console.error("cat: missing file operand");
          return 1;
        }
        for (let i = 1;i < args.length; i++) {
          try {
            const content = fs.readFileSync(args[i], "utf8");
            process.stdout.write(content);
          } catch (e) {
            console.error(`cat: ${args[i]}: ${e.message}`);
            return 1;
          }
        }
        return 0;
      },
      test: function(args) {
        if (args.includes("--help")) {
          console.log(help.test);
          return 0;
        }
        return builtins["["](args.concat("]"));
      },
      declare: function(args) {
        if (args.includes("--help")) {
          console.log(`declare [-a] NAME[=VALUE]
Declare or display shell variables and arrays.
Example: declare -a myarr=(one two three)`);
          return 0;
        }
        let i = 1;
        let isArray = false;
        while (i < args.length && args[i].startsWith("-")) {
          if (args[i] === "-a")
            isArray = true;
          i++;
        }
        if (i >= args.length) {
          console.log("Variables:");
          for (const [key, val] of Object.entries(SHELL.env)) {
            console.log(`  ${key}=${val}`);
          }
          console.log("Arrays:");
          for (const [key, arr] of Object.entries(SHELL_ARRAYS)) {
            console.log(`  ${key}=(${arr.join(" ")})`);
          }
          return 0;
        }
        const decl = args[i];
        const assignMatch = decl.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=\((.*)\)$/);
        if (assignMatch) {
          const arrName = assignMatch[1];
          const values = assignMatch[2].trim().split(/\s+/).filter((v) => v);
          SHELL_ARRAYS[arrName] = values;
        } else if (decl.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          if (isArray) {
            SHELL_ARRAYS[decl] = [];
          }
        }
        return 0;
      },
      trap: function(args) {
        if (args.includes("--help")) {
          console.log(`trap [COMMAND] [SIGNAL ...]
Set up traps for signals. Example: trap "cleanup" EXIT`);
          return 0;
        }
        if (args[1] === "-l") {
          console.log("Supported signals: EXIT INT TERM HUP QUIT");
          return 0;
        }
        if (args.length < 3) {
          for (const [sig, cmd] of Object.entries(SHELL_TRAPS)) {
            console.log(`trap -- '${cmd}' ${sig}`);
          }
          return 0;
        }
        const command = args[1];
        for (let i = 2;i < args.length; i++) {
          SHELL_TRAPS[args[i]] = command;
        }
        return 0;
      },
      local: function(args) {
        if (args.includes("--help")) {
          console.log(`local VAR=VALUE
Declare local variables (scope limited to current function).`);
          return 0;
        }
        for (let i = 1;i < args.length; i++) {
          const assignMatch = args[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$/);
          if (assignMatch) {
            SHELL.env[assignMatch[1]] = expandVars(assignMatch[2]);
          }
        }
        return 0;
      },
      dadjoke: async function(args) {
        try {
          const response = await fetch("https://icanhazdadjoke.com/", {
            headers: { Accept: "text/plain" }
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const joke = await response.text();
          writeOutput(joke.trim());
          return 0;
        } catch (e) {
          console.error(`dadjoke: ${e.message}`);
          return 1;
        }
      },
      true: function(args) {
        return 0;
      },
      false: function(args) {
        return 1;
      }
    };
  } catch (e) {
    console.error("Failed to initialize builtins:", e);
  }
  var logPath = null;
  if (process.env.FGSH_LOG) {
    const logLocations = ["/tmp/fgshell-debug.log", "/var/tmp/fgshell-debug.log", (process.env.HOME || "/tmp") + "/fgshell-debug.log"];
    for (const loc of logLocations) {
      try {
        fs.appendFileSync(loc, "[SHELL START] " + new Date().toISOString() + " user=" + (process.env.USER || "unknown") + " PATH=" + (process.env.PATH || "UNSET") + `
`);
        logPath = loc;
        break;
      } catch (e) {}
    }
  }
  var isLoadingRcFile = false;
  var isFilePickerActive = false;
  var filePickerState = null;
  var filePickerResolve = null;
  var commandStartTime = 0;
  var shellPgid = process.pid;
  if (ptctl.available) {
    try {
      ptctl.setpgid(0, 0);
      shellPgid = ptctl.getpgrp();
    } catch (e) {
      debug("Failed to set shell process group:", e.message);
      shellPgid = process.pid;
    }
  }
  var isLoginShell = process.stdin.isTTY && process.stdout.isTTY;
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "",
    completer,
    terminal: isLoginShell && (!process.argv[2] || process.argv[2] === "-c"),
    historySize: 1000
  });
  var originalTtyWrite = rl._ttyWrite.bind(rl);
  rl._ttyWrite = function(s, key) {
    if (isFilePickerActive) {
      return;
    }
    return originalTtyWrite(s, key);
  };
  function debug(...args) {
    const msg = "[DEBUG] " + args.join(" ");
    if (process.env.FGSH_DEBUG) {
      console.error(msg);
    }
    if (logPath) {
      try {
        fs.appendFileSync(logPath, msg + `
`);
      } catch (e) {}
    }
  }
  function completer(line) {
    try {
      const parts = line.split(/\s+/);
      const last = parts[parts.length - 1];
      const dir = path.dirname(last || ".");
      const base = path.basename(last || "");
      const list = fs.readdirSync(path.resolve(SHELL.cwd, dir === "." ? "" : dir));
      const hits = list.filter((f2) => f2.startsWith(base)).map((f2) => dir === "." ? f2 : path.join(dir, f2));
      return [hits.length ? hits : list, last];
    } catch (e) {
      return [[], line];
    }
  }
  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const L = input.length;
    let cur = "";
    let state = "normal";
    while (i < L) {
      const ch = input[i];
      if (state === "single") {
        if (ch === "'")
          state = "normal";
        else
          cur += ch;
      } else if (state === "double") {
        if (ch === '"')
          state = "normal";
        else if (ch === "$") {
          cur += ch;
        } else
          cur += ch;
      } else if (state === "esc") {
        cur += ch;
        state = "normal";
      } else if (ch === "\\") {
        state = "esc";
      } else if (ch === "'") {
        state = "single";
      } else if (ch === '"') {
        state = "double";
      } else if (/\s/.test(ch)) {
        if (cur !== "") {
          tokens.push(cur);
          cur = "";
        }
      } else {
        if ("|&<>".includes(ch)) {
          if (cur !== "") {
            tokens.push(cur);
            cur = "";
          }
          if ((ch === ">" || ch === "<") && input[i + 1] === ">") {
            tokens.push(ch + ">");
            i++;
          } else
            tokens.push(ch);
        } else
          cur += ch;
      }
      i++;
    }
    if (cur !== "")
      tokens.push(cur);
    return tokens;
  }
  function splitCommands(tokens) {
    const cmds = [];
    let cur = { args: [], stdin: null, stdout: null, stdoutAppend: false };
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "|") {
        cmds.push(cur);
        cur = { args: [], stdin: null, stdout: null, stdoutAppend: false };
      } else if (t === ">") {
        const file = tokens[++i];
        if (!file)
          throw new Error("No filename after >");
        cur.stdout = file;
        cur.stdoutAppend = false;
      } else if (t === ">>") {
        const file = tokens[++i];
        if (!file)
          throw new Error("No filename after >>");
        cur.stdout = file;
        cur.stdoutAppend = true;
      } else if (t === "<") {
        const file = tokens[++i];
        if (!file)
          throw new Error("No filename after <");
        cur.stdin = file;
      } else if (t === "&") {
        cur.background = true;
      } else {
        cur.args.push(t);
      }
      i++;
    }
    cmds.push(cur);
    if (cmds.length > 0) {
      const last = cmds[cmds.length - 1];
      if (last.background === undefined)
        last.background = false;
    }
    return cmds;
  }
  function expandVars(str) {
    if (str === "~") {
      return SHELL.env.HOME || process.env.HOME || "/tmp";
    }
    if (str.startsWith("~/")) {
      return (SHELL.env.HOME || process.env.HOME || "/tmp") + str.slice(1);
    }
    str = str.replace(/\$\(\(([^)]+)\)\)/g, (_, expr) => {
      try {
        const expandedExpr = expr.replace(/([A-Za-z_]\w*)/g, (match) => {
          return match in SHELL.env ? SHELL.env[match] : "0";
        });
        const result = Function('"use strict"; return (' + expandedExpr + ")")();
        return result.toString();
      } catch (e) {
        return "0";
      }
    });
    return str.replace(/\$(\w+(?:\[[^\]]*\])?|\{([^}]+)\})/g, (match, a, b) => {
      const expr = b !== undefined ? b : a;
      const arrayMatch = expr.match(/^(\w+)\[([^\]]*)\]$/);
      if (arrayMatch) {
        const arrName = arrayMatch[1];
        const index = arrayMatch[2];
        if (arrName in SHELL_ARRAYS) {
          if (index === "@" || index === "*") {
            return SHELL_ARRAYS[arrName].join(" ");
          }
          const idx = parseInt(index);
          const arr = SHELL_ARRAYS[arrName];
          if (!isNaN(idx) && idx >= 0 && idx < arr.length) {
            return arr[idx];
          }
        }
        return "";
      }
      const key = expr;
      return key in SHELL.env ? SHELL.env[key] : "";
    });
  }
  async function expandCommandSubstitution(str) {
    const regex = /\$\(([^)]+)\)/g;
    let result = str;
    let match;
    const matches = [];
    while ((match = regex.exec(str)) !== null) {
      matches.push({ full: match[0], cmd: match[1], index: match.index });
    }
    for (let i = matches.length - 1;i >= 0; i--) {
      const m = matches[i];
      const output = await executeSubshellCommand(m.cmd);
      result = result.slice(0, m.index) + output.trim() + result.slice(m.index + m.full.length);
    }
    return result;
  }
  function getAccessibleCwd() {
    try {
      fs.accessSync(SHELL.cwd, fs.constants.R_OK);
      return SHELL.cwd;
    } catch (e) {
      if (SHELL.env.HOME) {
        try {
          fs.accessSync(SHELL.env.HOME, fs.constants.R_OK);
          return SHELL.env.HOME;
        } catch (e2) {
          return "/tmp";
        }
      }
      return "/tmp";
    }
  }
  async function executeSubshellCommand(cmdStr) {
    let tokens = tokenize(cmdStr);
    if (tokens.length === 0) {
      return "";
    }
    tokens = expandAliases(tokens);
    tokens = expandGlobs(tokens);
    const cmds = splitCommands(tokens);
    cmds.forEach(expandTokens);
    if (cmds.length === 1 && isBuiltin(cmds[0].args[0])) {
      const name = cmds[0].args[0];
      builtins[name](cmds[0].args);
      return "";
    }
    return new Promise((resolve) => {
      let output = "";
      const lastCmd = cmds[cmds.length - 1];
      const command = lastCmd.args[0];
      const args = lastCmd.args.slice(1);
      const exe = resolveExecutable(command);
      if (!exe) {
        resolve("");
        return;
      }
      const child = spawn(exe, args, {
        cwd: getAccessibleCwd(),
        env: SHELL.env,
        stdio: ["ignore", "pipe", "ignore"]
      });
      child.stdout.on("data", (data) => {
        output += data.toString();
      });
      child.on("exit", () => {
        resolve(output);
      });
    });
  }
  function expandTokens(cmd) {
    cmd.args = cmd.args.map((a) => expandVars(a));
    if (cmd.stdin)
      cmd.stdin = expandVars(cmd.stdin);
    if (cmd.stdout)
      cmd.stdout = expandVars(cmd.stdout);
  }
  function addJob(pids, cmdline, background) {
    const job = { id: SHELL.nextJobId++, pids: Array.isArray(pids) ? pids : [pids], cmdline, status: "running", background: !!background };
    SHELL.jobs.push(job);
    return job;
  }
  function removeJob(job) {
    SHELL.jobs = SHELL.jobs.filter((j) => j !== job);
  }
  function findJobByPid(pid) {
    return SHELL.jobs.find((j) => j.pids.includes(pid));
  }
  function markJobDone(job) {
    job.status = "done";
    removeJob(job);
  }
  function waitForJob(job) {
    return new Promise((resolve) => {
      function check() {
        if (!SHELL.jobs.find((j) => j.id === job.id)) {
          resolve(0);
        } else {
          setTimeout(check, 100);
        }
      }
      check();
    }).then(() => 0);
  }
  async function runLine(line) {
    line = line.trim();
    if (!line) {
      return;
    }
    const isBuiltinCommand = !line.startsWith("history") && !line.startsWith("exit");
    if (isBuiltinCommand) {
      SHELL.history.push(line);
      if (rl.history) {
        rl.history.push(line);
      }
    }
    commandStartTime = Date.now();
    await executeControlFlow(line);
    if (isBuiltinCommand && !isLoadingRcFile) {
      const duration = Date.now() - commandStartTime;
      historyDB.addEntry(line, SHELL.lastExitCode, SHELL.cwd, duration);
    }
  }
  function splitTopLevel(str, sep) {
    const parts = [];
    let cur = "";
    let state = null;
    for (let i = 0;i < str.length; i++) {
      const ch = str[i];
      if (ch === "'" && state !== "double") {
        state = state === "single" ? null : "single";
        cur += ch;
        continue;
      }
      if (ch === '"' && state !== "single") {
        state = state === "double" ? null : "double";
        cur += ch;
        continue;
      }
      if (ch === sep && !state) {
        parts.push(cur);
        cur = "";
      } else
        cur += ch;
    }
    if (cur !== "")
      parts.push(cur);
    return parts;
  }
  function expandAliases(args) {
    if (args.length === 0)
      return args;
    const cmd = args[0];
    if (cmd in SHELL.aliases) {
      const aliasValue = SHELL.aliases[cmd];
      const aliasTokens = tokenize(aliasValue);
      return [...aliasTokens, ...args.slice(1)];
    }
    return args;
  }
  function expandGlobs(args) {
    const newArgs = [];
    for (const arg of args) {
      if (glob.hasMagic(arg)) {
        const files = glob.sync(arg, { cwd: SHELL.cwd });
        if (files.length > 0) {
          newArgs.push(...files);
        } else {
          newArgs.push(arg);
        }
      } else {
        newArgs.push(arg);
      }
    }
    return newArgs;
  }
  var SHELL_FUNCTIONS = {};
  var SHELL_TRAPS = {};
  var CALL_STACK = [];
  function pushCallFrame(funcName, context) {
    CALL_STACK.push({
      type: "function",
      name: funcName,
      context: context || {}
    });
  }
  function popCallFrame() {
    CALL_STACK.pop();
  }
  function formatCallStack() {
    if (CALL_STACK.length === 0)
      return "";
    let stack = `
Call stack:
`;
    for (let i = CALL_STACK.length - 1;i >= 0; i--) {
      const frame = CALL_STACK[i];
      const ctx = frame.context;
      if (ctx && ctx.filename) {
        stack += `  at ${frame.name}() (${ctx.filename}:${ctx.startLine})
`;
      } else {
        stack += `  at ${frame.name}()
`;
      }
    }
    return stack;
  }
  async function executeControlFlow(line, context) {
    const trimmed = line.trim();
    if (trimmed.startsWith("if ")) {
      await executeIf(line, context);
      return;
    } else if (trimmed.startsWith("while ")) {
      await executeWhile(line, context);
      return;
    } else if (trimmed.startsWith("for ")) {
      await executeFor(line, context);
      return;
    } else if (trimmed.startsWith("case ")) {
      await executeCase(line, context);
      return;
    } else if (trimmed.startsWith("function ") || trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/)) {
      await defineFunctionLine(line, context);
      return;
    }
    const logicalChain = parseLogicalChain(line);
    if (logicalChain.length > 1) {
      for (let i = 0;i < logicalChain.length; i++) {
        const { command, operator } = logicalChain[i];
        await executeControlFlow(command, context);
        if (operator === "&&" && SHELL.lastExitCode !== 0) {
          break;
        } else if (operator === "||" && SHELL.lastExitCode === 0) {
          break;
        }
      }
      return;
    }
    const sequences = splitTopLevel(line, ";");
    for (const seq of sequences) {
      const seqTrimmed = seq.trim();
      if (!seqTrimmed)
        continue;
      if (seqTrimmed === "{" || seqTrimmed === "}") {
        continue;
      } else {
        await runSingle(seqTrimmed, context);
      }
    }
  }
  function parseLogicalChain(line) {
    const chain = [];
    let current = "";
    let i = 0;
    let state = null;
    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === "'" && state !== "double") {
        state = state === "single" ? null : "single";
        current += ch;
        i++;
      } else if (ch === '"' && state !== "single") {
        state = state === "double" ? null : "double";
        current += ch;
        i++;
      } else if (!state && ch === "&" && next === "&") {
        if (current.trim()) {
          chain.push({ command: current.trim(), operator: "&&" });
        }
        current = "";
        i += 2;
      } else if (!state && ch === "|" && next === "|") {
        if (current.trim()) {
          chain.push({ command: current.trim(), operator: "||" });
        }
        current = "";
        i += 2;
      } else {
        current += ch;
        i++;
      }
    }
    if (current.trim()) {
      chain.push({ command: current.trim(), operator: null });
    }
    return chain;
  }
  async function executeIf(line, context) {
    const ifMatch = line.match(/^if\s+(.*?)\s*[;]?\s*then\s*([\s\S]*)/i);
    if (!ifMatch) {
      const errMsg = formatError('if: syntax error - expected "then"', context, true);
      console.error(errMsg || "if: syntax error");
      SHELL.lastExitCode = 1;
      return;
    }
    const condition = ifMatch[1].trim();
    const rest = ifMatch[2];
    let thenBody = "";
    let elseBody = "";
    let inElse = false;
    const lines = rest.split(`
`);
    for (let i = 0;i < lines.length; i++) {
      const l = lines[i].trim();
      if (l === "fi")
        break;
      if (l === "else" || l === "elif") {
        inElse = true;
        continue;
      }
      if (inElse)
        elseBody += lines[i] + `
`;
      else
        thenBody += lines[i] + `
`;
    }
    await runSingle(condition, context);
    if (SHELL.lastExitCode === 0) {
      const statements = thenBody.split(`
`).filter((l) => l.trim());
      for (const stmt of statements) {
        await executeControlFlow(stmt, context);
      }
    } else if (elseBody.trim()) {
      const statements = elseBody.split(`
`).filter((l) => l.trim());
      for (const stmt of statements) {
        await executeControlFlow(stmt, context);
      }
    }
  }
  async function executeWhile(line, context) {
    const whileMatch = line.match(/^while\s+(.*?)\s*[;]?\s*do\s*([\s\S]*)/i);
    if (!whileMatch) {
      const errMsg = formatError('while: syntax error - expected "do"', context, true);
      console.error(errMsg || "while: syntax error");
      SHELL.lastExitCode = 1;
      return;
    }
    const condition = whileMatch[1].trim();
    const rest = whileMatch[2];
    let body = "";
    const lines = rest.split(`
`);
    for (let i = 0;i < lines.length; i++) {
      const l = lines[i].trim();
      if (l === "done")
        break;
      body += lines[i] + `
`;
    }
    while (true) {
      await runSingle(condition, context);
      if (SHELL.lastExitCode !== 0)
        break;
      const statements = body.split(`
`).filter((l) => l.trim());
      for (const stmt of statements) {
        await executeControlFlow(stmt, context);
      }
    }
  }
  async function executeFor(line, context) {
    const cStyleMatch = line.match(/^for\s*\(\s*(.+?);(.+?);(.+?)\s*\)\s*do\s*([\s\S]*)/i);
    if (cStyleMatch) {
      const [, init, cond, incr, rest2] = cStyleMatch;
      await runSingle(init.trim(), context);
      let body2 = "";
      const lines2 = rest2.split(`
`);
      for (let i = 0;i < lines2.length; i++) {
        const l = lines2[i].trim();
        if (l === "done")
          break;
        body2 += lines2[i] + `
`;
      }
      while (true) {
        await runSingle(`[ ${cond.trim()} ]`, context);
        if (SHELL.lastExitCode !== 0)
          break;
        const statements = body2.split(`
`).filter((l) => l.trim());
        for (const stmt of statements) {
          await executeControlFlow(stmt, context);
        }
        await runSingle(incr.trim(), context);
      }
      return;
    }
    const forMatch = line.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.*?)\s*[;]?\s*do\s*([\s\S]*)/i);
    if (!forMatch) {
      const errMsg = formatError('for: syntax error - expected "in" and "do"', context, true);
      console.error(errMsg || "for: syntax error");
      SHELL.lastExitCode = 1;
      return;
    }
    const varName = forMatch[1];
    const listExpr = forMatch[2].trim();
    const rest = forMatch[3];
    let body = "";
    const lines = rest.split(`
`);
    for (let i = 0;i < lines.length; i++) {
      const l = lines[i].trim();
      if (l === "done")
        break;
      body += lines[i] + `
`;
    }
    let items = [];
    if (listExpr.startsWith("$")) {
      const varVal = expandVars(listExpr);
      items = varVal.split(/\s+/);
    } else if (listExpr.includes("*") || listExpr.includes("?")) {
      items = glob.sync(listExpr, { cwd: SHELL.cwd });
    } else {
      items = listExpr.trim().split(/\s+/);
    }
    for (const item of items) {
      SHELL.env[varName] = item;
      const statements = body.split(`
`).filter((l) => l.trim());
      for (const stmt of statements) {
        await executeControlFlow(stmt, context);
      }
    }
    SHELL.lastExitCode = 0;
  }
  async function executeCase(line, context) {
    const caseMatch = line.match(/^case\s+(.+?)\s+in\s*([\s\S]*?)esac/i);
    if (!caseMatch) {
      const errMsg = formatError('case: syntax error - expected "in" and "esac"', context, true);
      console.error(errMsg || "case: syntax error");
      SHELL.lastExitCode = 1;
      return;
    }
    let exprStr = caseMatch[1].trim();
    if (exprStr.startsWith('"') && exprStr.endsWith('"') || exprStr.startsWith("'") && exprStr.endsWith("'")) {
      exprStr = exprStr.slice(1, -1);
    }
    const expr = exprStr;
    const cases = caseMatch[2];
    const patterns = [];
    let current = "";
    for (const line2 of cases.split(`
`)) {
      const trimmed = line2.trim();
      if (!trimmed)
        continue;
      if (trimmed.endsWith(")")) {
        const pattern = trimmed.slice(0, -1);
        patterns.push({ pattern, body: "" });
        current = patterns.length - 1;
      } else if (trimmed === ";;") {
        current = -1;
      } else if (current >= 0) {
        patterns[current].body += line2 + `
`;
      }
    }
    for (const p of patterns) {
      if (matchPattern(expr, p.pattern)) {
        const statements = p.body.split(`
`).filter((l) => l.trim());
        for (const stmt of statements) {
          await executeControlFlow(stmt, context);
        }
        break;
      }
    }
    SHELL.lastExitCode = 0;
  }
  function matchPattern(str, pattern) {
    if (pattern === "*")
      return true;
    if (pattern.includes("|")) {
      return pattern.split("|").some((p) => matchPattern(str, p.trim()));
    }
    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    return regex.test(str);
  }
  async function defineFunctionLine(line, context) {
    const funcMatch = line.match(/^(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*{/);
    if (!funcMatch) {
      const errMsg = formatError('function: syntax error - expected "{ ... }"', context, true);
      console.error(errMsg || "function: syntax error");
      SHELL.lastExitCode = 1;
      return;
    }
    const funcName = funcMatch[1];
    let depth = 1;
    let bodyStart = line.indexOf("{") + 1;
    let bodyEnd = bodyStart;
    for (let i = bodyStart;i < line.length; i++) {
      if (line[i] === "{")
        depth++;
      if (line[i] === "}") {
        depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    const body = line.slice(bodyStart, bodyEnd).trim();
    SHELL_FUNCTIONS[funcName] = {
      name: funcName,
      body,
      params: []
    };
    SHELL.lastExitCode = 0;
  }
  async function callFunction(funcName, args, context) {
    if (!(funcName in SHELL_FUNCTIONS)) {
      return null;
    }
    const func = SHELL_FUNCTIONS[funcName];
    pushCallFrame(funcName, context);
    try {
      const savedParams = {};
      for (let i = 1;i <= 9; i++) {
        savedParams[`${i}`] = SHELL.env[i];
      }
      for (let i = 0;i < args.length; i++) {
        SHELL.env[`${i + 1}`] = args[i];
      }
      await executeControlFlow(func.body, context);
      for (let i = 1;i <= 9; i++) {
        if (savedParams[`${i}`] !== undefined) {
          SHELL.env[`${i}`] = savedParams[`${i}`];
        } else {
          delete SHELL.env[`${i}`];
        }
      }
      return SHELL.lastExitCode;
    } finally {
      popCallFrame();
    }
  }
  async function runSingle(line, context) {
    try {
      const arrayMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\((.*)\)$/);
      if (arrayMatch) {
        const arrName = arrayMatch[1];
        const valuesStr = arrayMatch[2].trim();
        const values = valuesStr ? valuesStr.split(/\s+/) : [];
        SHELL_ARRAYS[arrName] = values;
        SHELL.lastExitCode = 0;
        return;
      }
      const assignMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        let value = assignMatch[2];
        value = expandVars(value);
        SHELL.env[varName] = value;
        SHELL.lastExitCode = 0;
        return;
      }
      line = await expandCommandSubstitution(line);
      let tokens = tokenize(line);
      if (tokens.length === 0)
        return;
      if (tokens[0] in SHELL_FUNCTIONS) {
        const funcName = tokens[0];
        const funcArgs = tokens.slice(1);
        const code = await callFunction(funcName, funcArgs, context);
        if (code !== null) {
          SHELL.lastExitCode = code;
          return;
        }
      }
      tokens = expandAliases(tokens);
      tokens = expandGlobs(tokens);
      const cmds = splitCommands(tokens);
      cmds.forEach(expandTokens);
      if (cmds.length === 1 && cmds[0].args[0] && typeof builtins === "object" && cmds[0].args[0] in builtins && !cmds[0].stdin && !cmds[0].stdout && !cmds[0].background) {
        const name = cmds[0].args[0];
        const res = builtins[name](cmds[0].args);
        if (typeof res === "number")
          SHELL.lastExitCode = res;
        else if (res && typeof res.then === "function") {
          const code = await res;
          SHELL.lastExitCode = code || 0;
        }
        return;
      }
      await executePipeline(cmds);
    } catch (e) {
      console.error("Error:", e.message);
      SHELL.lastExitCode = 1;
    }
  }
  function isBuiltin(name) {
    return name && name in builtins;
  }
  async function executePipeline(cmds) {
    const n = cmds.length;
    const procs = [];
    let pids = [];
    for (let i = 0;i < n; i++) {
      const c = cmds[i];
      const argv = c.args.map((a) => a);
      if (argv.length === 0)
        continue;
      const command = argv[0];
      const args = argv.slice(1);
      const isInteractive = !c.stdin && !c.stdout && !c.background && n === 1 && !isLoadingRcFile;
      let child;
      if (typeof builtins === "object" && command in builtins && typeof builtins[command] === "function") {
        const res = builtins[command]([command, ...args]);
        if (typeof res === "number")
          SHELL.lastExitCode = res;
        else if (res && typeof res.then === "function") {
          const code = await res;
          SHELL.lastExitCode = code || 0;
        }
        continue;
      }
      if (isInteractive) {
        const exe = resolveExecutable(command);
        if (!exe) {
          console.error(`${command}: command not found`);
          SHELL.lastExitCode = 127;
          return;
        }
        rl.pause();
        debug(`Shell PGID: ${shellPgid}, spawning: ${command}`);
        let childProcess;
        let actualExe = exe;
        let actualArgs = args;
        const scriptExecutor = getScriptExecutor(exe);
        if (scriptExecutor) {
          actualExe = scriptExecutor.interpreter;
          actualArgs = [...scriptExecutor.args, ...args];
        }
        try {
          childProcess = spawn(actualExe, actualArgs, {
            cwd: getAccessibleCwd(),
            env: SHELL.env,
            stdio: "inherit",
            detached: command !== "sudo"
          });
        } catch (spawnErr) {
          rl.resume();
          console.error(`Error executing ${command}: ${spawnErr.message}`);
          SHELL.lastExitCode = 127;
          return;
        }
        debug(`Child spawned PID: ${childProcess.pid}`);
        if (ptctl.available && command !== "sudo") {
          try {
            const childPgid = ptctl.getpgid(childProcess.pid);
            debug(`Child process group: ${childPgid}`);
            ptctl.tcsetpgrp(1, childPgid);
            const termFgpg = ptctl.tcgetpgrp(1);
            debug(`Terminal foreground process group: ${termFgpg}`);
          } catch (e) {
            debug("ptctl job control setup error:", e.message);
          }
        }
        const cmdline2 = args.length ? [command, ...args].join(" ") : command;
        const job2 = addJob([childProcess.pid], cmdline2, false);
        pids.push(childProcess.pid);
        await new Promise((resolve) => {
          childProcess.on("exit", (code, signal) => {
            debug(`Child exited with code ${code}, signal ${signal}`);
            SHELL.lastExitCode = code || 0;
            const job3 = findJobByPid(childProcess.pid);
            if (job3) {
              markJobDone(job3);
            }
            if (ptctl.available && command !== "sudo") {
              try {
                debug(`Restoring terminal to shell PGID: ${shellPgid}`);
                ptctl.tcsetpgrp(1, shellPgid);
                const termFgpg = ptctl.tcgetpgrp(1);
                debug(`Terminal foreground process group after restore: ${termFgpg}`);
              } catch (e) {
                debug("ptctl restore error:", e.message);
              }
            }
            if (rl.paused) {
              debug("Resuming readline");
              rl.resume();
              rl.line = "";
              rl.cursor = 0;
            }
            resolve();
          });
          childProcess.on("error", (err) => {
            console.error(`Error executing ${command}:`, err.message);
            SHELL.lastExitCode = 1;
            const job3 = findJobByPid(childProcess.pid);
            if (job3) {
              markJobDone(job3);
            }
            if (rl.paused) {
              rl.resume();
            }
            resolve();
          });
        });
        await prompt();
        return;
      } else {
        const isSingleCommand = n === 1 && !c.stdin && !c.stdout && !c.background;
        const isSudo = command === "sudo";
        let stdio;
        if (isSingleCommand || isSudo) {
          if (isLoadingRcFile) {
            stdio = ["ignore", "inherit", "inherit"];
          } else {
            stdio = "inherit";
          }
          rl.pause();
        } else {
          stdio = ["pipe", "pipe", "pipe"];
          if (i === 0 && c.stdin) {
            try {
              stdio[0] = fs.openSync(path.resolve(SHELL.cwd, c.stdin), "r");
            } catch (e) {
              console.error("Input redirect error:", e.message);
              return;
            }
          }
          if (i === n - 1 && c.stdout) {
            try {
              const flags = c.stdoutAppend ? "a" : "w";
              stdio[1] = fs.openSync(path.resolve(SHELL.cwd, c.stdout), flags);
            } catch (e) {
              console.error("Output redirect error:", e.message);
              return;
            }
          }
        }
        const options = {
          cwd: getAccessibleCwd(),
          env: SHELL.env,
          stdio,
          detached: false
        };
        const exe = resolveExecutable(command);
        if (!exe) {
          console.error(`${command}: command not found`);
          SHELL.lastExitCode = 127;
          return;
        }
        try {
          child = spawn(exe, args, options);
        } catch (spawnErr) {
          console.error(`Error executing ${command}: ${spawnErr.message}`);
          SHELL.lastExitCode = 127;
          if (isSingleCommand && rl.paused) {
            rl.resume();
          }
          return;
        }
        if (!child) {
          console.error("Failed to spawn", exe);
          SHELL.lastExitCode = 1;
          return;
        }
        child._cmdOptions = options;
        if (isSingleCommand) {
          child._resumeRl = true;
        }
      }
      procs.push(child);
      pids.push(child.pid);
      const stdioIsInherited = child._cmdOptions && (child._cmdOptions.stdio === "inherit" || Array.isArray(child._cmdOptions.stdio) && child._cmdOptions.stdio[1] === "inherit");
      if (!isInteractive && child._cmdOptions && !stdioIsInherited) {
        try {
          if (i > 0) {
            const prev = procs[i - 1];
            if (prev.stdout && child.stdin) {
              prev.stdout.pipe(child.stdin);
            }
          }
          if (i === n - 1) {
            if (!c.stdout && child.stdout) {
              child.stdout.pipe(process.stdout);
            }
          }
          if (i === 0 && !c.stdin && procs.length === 1 && !c.background) {
            if (process.stdin.isTTY && child.stdin) {
              process.stdin.pipe(child.stdin);
            }
          }
          if (child.stderr) {
            child.stderr.pipe(process.stderr);
          }
        } catch (e) {
          debug("Piping error:", e.message);
        }
      }
      child.on("exit", (code, signal) => {
        if (child._resumeRl && rl.paused) {
          rl.resume();
        }
        const job2 = findJobByPid(child.pid);
        if (job2) {
          job2.pids = job2.pids.filter((p) => p !== child.pid);
          if (job2.pids.length === 0) {
            markJobDone(job2);
          }
        }
      });
    }
    const cmdline = cmds.map((c) => c.args.join(" ")).join(" | ");
    const background = cmds[cmds.length - 1].background;
    const job = addJob(pids, cmdline, background);
    if (background) {
      console.log(`[${job.id}] ${job.pids[0]}`);
      return;
    } else {
      await waitForJob(job).catch(() => {});
      return;
    }
  }
  function resolveExecutable(cmd) {
    if (cmd.startsWith("/") || cmd.startsWith("./") || cmd.startsWith("../")) {
      try {
        fs.accessSync(cmd, fs.constants.X_OK);
        return cmd;
      } catch (e) {
        return null;
      }
    }
    const PATH = (SHELL.env.PATH || process.env.PATH || "/usr/bin:/bin").split(":");
    for (const p of PATH) {
      const full = path.join(p, cmd);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch (e) {}
    }
    return null;
  }
  function getScriptExecutor(exePath) {
    try {
      const fd = fs.openSync(exePath, "r");
      const buf = Buffer.alloc(256);
      const bytesRead = fs.readSync(fd, buf, 0, 256);
      fs.closeSync(fd);
      const content = buf.toString("utf8", 0, bytesRead);
      const firstLine = content.split(`
`)[0];
      if (firstLine.startsWith("#!")) {
        const shebang = firstLine.substring(2).trim();
        const parts = shebang.split(/\s+/);
        const interpreter = parts[0];
        const interpreterArgs = parts.slice(1);
        return {
          interpreter,
          args: [...interpreterArgs, exePath]
        };
      }
    } catch (e) {}
    return null;
  }
  process.on("SIGINT", () => {
    for (const j of SHELL.jobs) {
      if (!j.background) {
        for (const pid of j.pids) {
          try {
            process.kill(pid, "SIGINT");
          } catch (e) {}
        }
      }
    }
    setImmediate(() => {
      prompt().catch(() => {});
    });
  });
  process.on("exit", () => {
    historyDB.closeDB();
  });
  function readDirAsync(dirPath) {
    return fs.promises.readdir(dirPath, { withFileTypes: true }).then((entries) => {
      return entries.map((dirent) => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory()
      })).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory)
          return -1;
        if (!a.isDirectory && b.isDirectory)
          return 1;
        return a.name.localeCompare(b.name);
      });
    });
  }
  function renderFilePickerOverlay() {
    if (!isFilePickerActive || !filePickerState)
      return;
    const { files, selectedIndex, maxVisible, filterMode, filterQuery } = filePickerState;
    const displayFiles = files;
    const terminalCols = process.stdout.columns || 80;
    if (!filePickerState.firstRender && filePickerState.lastLineCount > 0) {
      for (let i = 0;i < filePickerState.lastLineCount; i++) {
        process.stdout.write("\x1B[A");
        process.stdout.write("\x1B[K");
      }
    } else if (filePickerState.firstRender) {
      filePickerState.firstRender = false;
    }
    let output = "";
    let lineCount = 0;
    const modeIndicator = filterMode ? " [FILTER MODE]" : "";
    output += `\x1B[1mSelect file from ${SHELL.cwd}\x1B[0m${modeIndicator}
`;
    lineCount++;
    output += `(Ctrl+F: filter, arrows: navigate, Enter: select, Esc: cancel)
`;
    lineCount++;
    if (filterMode) {
      output += `Filter: ${filterQuery}
`;
      lineCount++;
    }
    output += "-".repeat(Math.min(80, terminalCols)) + `
`;
    lineCount++;
    const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), displayFiles.length - maxVisible));
    const endIdx = Math.min(startIdx + maxVisible, displayFiles.length);
    if (displayFiles.length === 0) {
      output += `(no files)
`;
      lineCount++;
    } else {
      for (let i = startIdx;i < endIdx; i++) {
        const item = displayFiles[i];
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? "> " : "  ";
        const icon = item.isDirectory ? "[D] " : "[F] ";
        let line = `${prefix}${icon} ${item.name}`;
        if (line.length > terminalCols) {
          line = line.slice(0, terminalCols - 1) + "...";
        }
        if (isSelected) {
          line = `\x1B[7m${line}\x1B[0m`;
        }
        output += line + `
`;
        lineCount++;
      }
    }
    process.stdout.write(output);
    filePickerState.lastLineCount = lineCount;
  }
  function clearFilePickerOverlay() {
    const MAX_LINES_TO_CLEAR = process.stdout.rows || 25;
    process.stdout.write("\x1B7");
    process.stdout.write(`\r
`);
    process.stdout.write(`\x1B[${MAX_LINES_TO_CLEAR}M`);
    process.stdout.write("\x1B8");
  }
  function handleFilePickerKey(str, key) {
    if (!filePickerState)
      return;
    const { files } = filePickerState;
    if (filePickerState.filterMode) {
      if (key.name === "escape") {
        filePickerState.filterMode = false;
        filePickerState.filterQuery = "";
        filePickerState.files = [...filePickerState.allFiles];
        filePickerState.selectedIndex = 0;
        renderFilePickerOverlay();
        return;
      }
      if (key.name === "backspace") {
        if (filePickerState.filterQuery.length > 0) {
          filePickerState.filterQuery = filePickerState.filterQuery.slice(0, -1);
        }
        if (filePickerState.filterQuery.length > 0) {
          const Fuse = require_fuse();
          const fuse = new Fuse(filePickerState.allFiles, {
            keys: ["name"],
            threshold: 0.3
          });
          let results = fuse.search(filePickerState.filterQuery).map((r) => r.item);
          if (results.length === 0) {
            const lowerQuery = filePickerState.filterQuery.toLowerCase();
            results = filePickerState.allFiles.filter((f2) => f2.name.toLowerCase().includes(lowerQuery));
          }
          filePickerState.files = results;
        } else {
          filePickerState.files = [...filePickerState.allFiles];
        }
        filePickerState.selectedIndex = 0;
        renderFilePickerOverlay();
        return;
      }
      if (key.name === "return") {
        const selected = filePickerState.files[filePickerState.selectedIndex];
        if (!selected)
          return;
        if (selected.isDirectory) {
          SHELL.cwd = path.resolve(SHELL.cwd, selected.name);
          readDirAsync(SHELL.cwd).then((newFiles) => {
            filePickerState.files = newFiles;
            filePickerState.allFiles = newFiles;
            filePickerState.filterQuery = "";
            filePickerState.filterMode = false;
            filePickerState.selectedIndex = 0;
            renderFilePickerOverlay();
          });
        } else {
          if (filePickerResolve)
            filePickerResolve(selected.name);
        }
        return;
      }
      if (str) {
        filePickerState.filterQuery += str;
        if (filePickerState.filterQuery.length > 0) {
          const Fuse = require_fuse();
          const fuse = new Fuse(filePickerState.allFiles, {
            keys: ["name"],
            threshold: 0.3
          });
          let results = fuse.search(filePickerState.filterQuery).map((r) => r.item);
          if (results.length === 0) {
            const lowerQuery = filePickerState.filterQuery.toLowerCase();
            results = filePickerState.allFiles.filter((f2) => f2.name.toLowerCase().includes(lowerQuery));
          }
          filePickerState.files = results;
        } else {
          filePickerState.files = [...filePickerState.allFiles];
        }
        filePickerState.selectedIndex = 0;
        renderFilePickerOverlay();
        return;
      }
      if (key && (key.name === "up" || key.name === "down")) {
        if (key.name === "up") {
          filePickerState.selectedIndex = Math.max(0, filePickerState.selectedIndex - 1);
        } else {
          filePickerState.selectedIndex = Math.min(files.length - 1, filePickerState.selectedIndex + 1);
        }
        renderFilePickerOverlay();
        return;
      }
      return;
    }
    if (key.name === "escape" || key.ctrl && key.name === "c") {
      if (filePickerResolve)
        filePickerResolve(null);
      return;
    }
    if (key.ctrl && key.name === "f") {
      filePickerState.filterMode = true;
      filePickerState.filterQuery = "";
      filePickerState.allFiles = [...files];
      renderFilePickerOverlay();
      return;
    }
    if (key.name === "up") {
      filePickerState.selectedIndex = Math.max(0, filePickerState.selectedIndex - 1);
      renderFilePickerOverlay();
    } else if (key.name === "down") {
      filePickerState.selectedIndex = Math.min(filePickerState.files.length - 1, filePickerState.selectedIndex + 1);
      renderFilePickerOverlay();
    } else if (key.name === "left") {
      const parentDir = path.dirname(SHELL.cwd);
      if (parentDir !== SHELL.cwd) {
        SHELL.cwd = parentDir;
        readDirAsync(SHELL.cwd).then((newFiles) => {
          filePickerState.files = newFiles;
          filePickerState.allFiles = newFiles;
          filePickerState.selectedIndex = 0;
          renderFilePickerOverlay();
        });
      }
    } else if (key.name === "right" || key.name === "return") {
      const selected = filePickerState.files[filePickerState.selectedIndex];
      if (!selected)
        return;
      if (selected.isDirectory) {
        SHELL.cwd = path.resolve(SHELL.cwd, selected.name);
        readDirAsync(SHELL.cwd).then((newFiles) => {
          filePickerState.files = newFiles;
          filePickerState.allFiles = newFiles;
          filePickerState.filterQuery = "";
          filePickerState.selectedIndex = 0;
          renderFilePickerOverlay();
        });
      } else {
        if (filePickerResolve)
          filePickerResolve(selected.name);
      }
    }
  }
  async function showFilePicker() {
    if (isFilePickerActive || !process.stdin.isTTY) {
      return null;
    }
    isFilePickerActive = true;
    let files;
    try {
      files = await readDirAsync(SHELL.cwd);
    } catch (e) {
      isFilePickerActive = false;
      return null;
    }
    const terminalRows = process.stdout.rows || 24;
    const maxVisible = Math.min(Math.floor(terminalRows * 0.6), terminalRows - 5);
    filePickerState = {
      files,
      allFiles: files,
      selectedIndex: 0,
      maxVisible,
      filterMode: false,
      filterQuery: "",
      firstRender: true,
      lastLineCount: 0
    };
    return new Promise((resolve) => {
      filePickerResolve = (result) => {
        isFilePickerActive = false;
        clearFilePickerOverlay();
        filePickerState = null;
        filePickerResolve = null;
        rl._refreshLine();
        resolve(result);
      };
      renderFilePickerOverlay();
    });
  }
  function showHistoryPicker() {
    return new Promise(async (resolve) => {
      if (isFilePickerActive || !process.stdin.isTTY) {
        return resolve(null);
      }
      isFilePickerActive = true;
      let allEntries = historyDB.getAll(500);
      let filteredEntries = [...allEntries];
      let searchQuery = "";
      let selectedIndex = 0;
      const terminalRows = process.stdout.rows || 24;
      const terminalCols = process.stdout.columns || 80;
      const maxVisible = Math.min(Math.floor(terminalRows * 0.8), terminalRows - 4);
      process.stdout.write("\x1B[2J\x1B[H");
      process.stdout.write("\x1B[?25l");
      async function renderPicker() {
        process.stdout.write("\x1B[2J\x1B[H");
        process.stdout.write(`\x1B[1mHistory Search (Ctrl+F to search, Ctrl+C to cancel)\x1B[0m
`);
        process.stdout.write(`Filter: ${searchQuery}
`);
        process.stdout.write("-".repeat(Math.min(80, terminalCols)) + `
`);
        const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), filteredEntries.length - maxVisible));
        const endIdx = Math.min(startIdx + maxVisible, filteredEntries.length);
        for (let i = startIdx;i < endIdx; i++) {
          const entry = filteredEntries[i];
          const isSelected = i === selectedIndex;
          const prefix = isSelected ? "> " : "  ";
          const timestamp = new Date(entry.timestamp * 1000).toLocaleString();
          const exitCode = entry.exit_code !== null ? ` [${entry.exit_code}]` : "";
          let cmd = entry.command;
          const maxCmdLength = Math.max(20, terminalCols - 40);
          if (cmd.length > maxCmdLength) {
            cmd = cmd.slice(0, maxCmdLength - 3) + "...";
          }
          let line = `${prefix}${timestamp}${exitCode}  ${cmd}`;
          if (line.length > terminalCols) {
            line = line.slice(0, terminalCols);
          }
          if (isSelected) {
            line = `\x1B[7m${line}\x1B[0m`;
          }
          process.stdout.write(line + `
`);
        }
        if (filteredEntries.length === 0) {
          process.stdout.write(`(no commands found)
`);
        }
      }
      await renderPicker();
      let pickerDone = false;
      const keypressHandler = (str, key) => {
        if (pickerDone)
          return;
        const finalize = (result) => {
          pickerDone = true;
          process.stdin.removeAllListeners("keypress");
          process.stdout.write("\x1B[?25h");
          isFilePickerActive = false;
          resolve(result);
        };
        if (key && (key.name === "escape" || key.ctrl && key.name === "c")) {
          finalize(null);
        } else if (key && key.ctrl && key.name === "f") {
          renderPicker().catch(() => {});
        } else if (key && key.name === "up") {
          selectedIndex = Math.max(0, selectedIndex - 1);
          renderPicker().catch(() => {});
        } else if (key && key.name === "down") {
          selectedIndex = Math.min(filteredEntries.length - 1, filteredEntries.length + 1);
          renderPicker().catch(() => {});
        } else if (key && key.name === "return") {
          const selected = filteredEntries[selectedIndex];
          if (selected) {
            finalize(selected.command);
          }
        } else if (key && key.name === "backspace") {
          if (searchQuery.length > 0) {
            searchQuery = searchQuery.slice(0, -1);
            if (searchQuery.length === 0) {
              filteredEntries = [...allEntries];
            } else {
              const Fuse = require_fuse();
              const fuse = new Fuse(allEntries, {
                keys: ["command"],
                threshold: 0.3
              });
              filteredEntries = fuse.search(searchQuery).map((r) => r.item);
            }
            selectedIndex = 0;
            renderPicker().catch(() => {});
          }
        } else if (str && str.match(/^[a-zA-Z0-9\-_./]$/)) {
          searchQuery += str;
          const Fuse = require_fuse();
          const fuse = new Fuse(allEntries, {
            keys: ["command"],
            threshold: 0.3
          });
          filteredEntries = fuse.search(searchQuery).map((r) => r.item);
          selectedIndex = 0;
          renderPicker().catch(() => {});
        }
      };
      const listeners = process.stdin.listeners("keypress");
      listeners.forEach((l) => process.stdin.removeListener("keypress", l));
      process.stdin.on("keypress", keypressHandler);
      const originalResolve = resolve;
      return new Promise((res) => {
        resolve = (result) => {
          listeners.forEach((l) => process.stdin.on("keypress", l));
          originalResolve(result);
          res(result);
        };
      });
    });
  }
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (str, key) => {
      if (isFilePickerActive) {
        handleFilePickerKey(str, key);
        return;
      }
      if (key && key.ctrl && key.name === "n") {
        if (isFilePickerActive)
          return;
        (async () => {
          try {
            const selectedFile = await showFilePicker();
            if (selectedFile) {
              const line = rl.line;
              const cursor = rl.cursor;
              const needsSpace = line.length > 0 && !line.endsWith(" ");
              const insertText = (needsSpace ? " " : "") + selectedFile.replace(/ /g, "\\ ");
              const left = line.slice(0, cursor);
              const right = line.slice(cursor);
              rl.line = left + insertText + right;
              rl.cursor = left.length + insertText.length;
              rl._refreshLine();
            }
          } catch (e) {
            console.error("Picker error:", e);
          }
        })();
      } else if (key && key.ctrl && key.name === "r") {
        if (isFilePickerActive)
          return;
        const savedLine = rl.line;
        const savedCursor = rl.cursor;
        (async () => {
          try {
            const selectedCommand = await showHistoryPicker();
            rl.line = "";
            rl.cursor = 0;
            if (selectedCommand) {
              rl.line = selectedCommand;
              rl.cursor = selectedCommand.length;
            } else {
              rl.line = savedLine;
              rl.cursor = savedCursor;
            }
            rl._refreshLine();
          } catch (e) {
            console.error("History picker error:", e);
          }
        })();
      }
    });
  }
  async function prompt() {
    let ps1 = SHELL.env.PS1;
    const cyan = "\x1B[1;36m";
    const green = "\x1B[1;32m";
    const red = "\x1B[1;31m";
    const yellow = "\x1B[1;33m";
    const reset = "\x1B[0m";
    let uname;
    try {
      uname = os.userInfo().username;
    } catch (e) {
      uname = SHELL.env.USER || SHELL.env.LOGNAME || "user";
    }
    const base = path.basename(SHELL.cwd);
    let hostname;
    try {
      hostname = os.hostname();
    } catch (e) {
      hostname = SHELL.env.HOSTNAME || "localhost";
    }
    if (!ps1) {
      ps1 = `${cyan}${uname}${reset}:${green}${base}${reset} > `;
    } else {
      ps1 = ps1.replace(/%user%/g, uname).replace(/%host%/g, hostname).replace(/%pwd%/g, SHELL.cwd).replace(/%dir%/g, base).replace(/%cyan%/g, cyan).replace(/%green%/g, green).replace(/%red%/g, red).replace(/%yellow%/g, yellow).replace(/%reset%/g, reset);
      ps1 = expandVars(ps1);
      ps1 = await expandCommandSubstitution(ps1);
    }
    rl.setPrompt(ps1);
    rl.prompt(true);
  }
  function hasUnclosedQuotes(str) {
    let inSingle = false;
    let inDouble = false;
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'" && !inDouble)
        inSingle = !inSingle;
      else if (ch === '"' && !inSingle)
        inDouble = !inDouble;
      i++;
    }
    return inSingle || inDouble;
  }
  if (process.argv[2] === "--version" || process.argv[2] === "-v") {
    console.log(`fgsh version ${VERSION}`);
    process.exit(0);
  }
  if (process.argv[2] === "--help" || process.argv[2] === "-h") {
    console.log("Usage: fgsh [OPTIONS] [SCRIPT] [-c COMMAND]");
    console.log("");
    console.log("A simple interactive shell in Node.js");
    console.log("");
    console.log("Options:");
    console.log("  --version, -v     Display version information and exit");
    console.log("  --help, -h        Display this help message and exit");
    console.log("  -c COMMAND        Execute a command and exit");
    console.log("  SCRIPT            Execute a shell script");
    console.log("");
    console.log("Interactive mode starts if no SCRIPT or -c is specified.");
    process.exit(0);
  }
  var isScriptMode = process.argv[2] && process.argv[2] !== "-c";
  var isCommandMode = process.argv[2] === "-c" && process.argv[3];
  var accumulatedInput = "";
  if (!isScriptMode && !isCommandMode) {
    rl.on("line", async (line) => {
      rl.pause();
      accumulatedInput += (accumulatedInput ? `
` : "") + line;
      if (hasUnclosedQuotes(accumulatedInput)) {
        rl.setPrompt("> ");
        rl.prompt();
        rl.resume();
      } else {
        await runLine(accumulatedInput);
        accumulatedInput = "";
        rl.setPrompt(SHELL.prompt);
        rl.resume();
        await prompt();
      }
    });
    rl.on("SIGINT", () => {});
  }
  rl.on("close", () => {
    console.log();
    process.exit(0);
  });
  function loadHistory() {
    historyDB.initDB();
    const entries = historyDB.getAll(1000);
    for (const e of entries) {
      SHELL.history.push(e.command);
    }
    if (rl.history) {
      rl.history.push(...SHELL.history);
      debug("Loaded", entries.length, "history entries from database");
    }
  }
  async function loadRcFile() {
    let rcFile = path.join(SHELL.env.HOME || process.env.HOME || "/tmp", ".fgshrc");
    try {
      fs.accessSync(rcFile, fs.constants.R_OK);
    } catch (e) {
      try {
        const uid = process.getuid();
        const passwdContent = fs.readFileSync("/etc/passwd", "utf8");
        const lines = passwdContent.split(`
`);
        for (const line of lines) {
          const parts = line.split(":");
          if (parseInt(parts[2]) === uid) {
            const userHome = parts[5];
            const userRcFile = path.join(userHome, ".fgshrc");
            try {
              fs.accessSync(userRcFile, fs.constants.R_OK);
              rcFile = userRcFile;
              break;
            } catch (e2) {}
            break;
          }
        }
      } catch (e2) {}
    }
    if (fs.existsSync(rcFile)) {
      try {
        isLoadingRcFile = true;
        const script = fs.readFileSync(rcFile, "utf8");
        const lines = script.split(`
`);
        for (let idx = 0;idx < lines.length; idx++) {
          const line = lines[idx];
          if (line.trim() && !line.trim().startsWith("#")) {
            await runLine(line);
          }
        }
        isLoadingRcFile = false;
        if (!rl.terminal) {
          rl.resume();
        }
      } catch (e) {
        console.error("Error loading .fgshrc:", e.message);
        isLoadingRcFile = false;
        if (!rl.terminal) {
          rl.resume();
        }
      }
    }
  }
  if (process.argv[2] === "-c" && process.argv[3]) {
    (async () => {
      await runLine(process.argv[3]);
      process.exit(SHELL.lastExitCode);
    })();
  } else if (process.argv[2]) {
    const scriptPath = path.resolve(SHELL.cwd, process.argv[2]);
    try {
      let parseScriptBlocks2 = function(lines2) {
        const blocks = [];
        let idx = 0;
        while (idx < lines2.length) {
          const line = lines2[idx];
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            idx++;
            continue;
          }
          if (trimmed.startsWith("if ") || trimmed.startsWith("while ") || trimmed.startsWith("for ") || trimmed.startsWith("case ")) {
            const block = collectBlock2(lines2, idx);
            blocks.push({
              content: block.content,
              startLine: idx + 1,
              endLine: block.endIdx + 1,
              filename: scriptPath
            });
            idx = block.endIdx + 1;
          } else if (trimmed.startsWith("function ") || trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/)) {
            const block = collectBlock2(lines2, idx);
            blocks.push({
              content: block.content,
              startLine: idx + 1,
              endLine: block.endIdx + 1,
              filename: scriptPath
            });
            idx = block.endIdx + 1;
          } else {
            blocks.push({
              content: line,
              startLine: idx + 1,
              endLine: idx + 1,
              filename: scriptPath
            });
            idx++;
          }
        }
        return blocks;
      }, collectBlock2 = function(lines2, startIdx) {
        const firstLine = lines2[startIdx].trim();
        let content = firstLine;
        let idx = startIdx + 1;
        let depth = 0;
        let closeKeyword = null;
        if (firstLine.startsWith("if "))
          closeKeyword = "fi";
        else if (firstLine.startsWith("while "))
          closeKeyword = "done";
        else if (firstLine.startsWith("for "))
          closeKeyword = "done";
        else if (firstLine.startsWith("case "))
          closeKeyword = "esac";
        else if (firstLine.startsWith("function ") || firstLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/)) {
          depth = 0;
          if (firstLine.includes("{"))
            depth = countBraces2(firstLine);
        }
        if (depth !== null && (firstLine.startsWith("function ") || firstLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/))) {
          while (idx < lines2.length && depth > 0) {
            content += `
` + lines2[idx];
            depth += countBraces2(lines2[idx]);
            idx++;
          }
        } else if (closeKeyword) {
          while (idx < lines2.length) {
            const line = lines2[idx];
            const trimmed = line.trim();
            content += `
` + line;
            if (trimmed === closeKeyword) {
              idx++;
              break;
            }
            idx++;
          }
        }
        return { content, endIdx: idx - 1 };
      }, countBraces2 = function(line) {
        let count = 0;
        for (const ch of line) {
          if (ch === "{")
            count++;
          if (ch === "}")
            count--;
        }
        return count;
      };
      parseScriptBlocks = parseScriptBlocks2, collectBlock = collectBlock2, countBraces = countBraces2;
      const script = fs.readFileSync(scriptPath, "utf8");
      const lines = script.split(`
`);
      rl.removeAllListeners("line");
      rl.pause();
      (async () => {
        try {
          const blocks = parseScriptBlocks2(lines);
          for (const block of blocks) {
            if (block.content && block.content.trim()) {
              await executeControlFlow(block.content, block);
            }
          }
        } catch (e) {
          console.error("Script error:", e.message);
          process.exit(1);
        }
        process.exit(SHELL.lastExitCode);
      })();
    } catch (e) {
      console.error("Error running script:", e.message);
      process.exit(1);
    }
  } else {
    (async () => {
      try {
        loadHistory();
        if (process.stdin.isTTY) {
          await loadRcFile();
        }
        await new Promise((r) => setTimeout(r, 50));
        await prompt();
      } catch (e) {
        console.error("FATAL ERROR in interactive mode:", e.message);
        console.error(e.stack);
        process.exit(1);
      }
    })();
  }
  var parseScriptBlocks;
  var collectBlock;
  var countBraces;
});
export default require_fgshell();
