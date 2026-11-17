"""Build index.html: concatenate src/*.js, minify, and inline everything into the page shell.

Usage:  python3 111626_build.py [--no-minify]

The minifier is built in and needs nothing but Python. It strips comments and redundant whitespace from the
JavaScript, the CSS and the GLSL shader strings; it does not rename identifiers. The source must not contain
regular-expression literals (the scanner treats every "/" as division or the start of a comment).
"""
import gzip
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
PARTS = ["111626_core.js", "111626_shaders.js", "111626_scene.js", "111626_content.js", "111626_app.js"]
PUNCT = set("{}()[];,:=+-*/<>!&|?%^~.")
WORD = re.compile(r"[A-Za-z0-9_$\u0080-￿]+")


def squeeze_glsl(text: str) -> str:
    """Strip comments and whitespace from a GLSL template literal; preprocessor lines keep their own line."""
    out = []
    for line in text.split("\n"):
        line = re.sub(r"//.*$", "", line).strip()
        if not line:
            continue
        if line.startswith("#"):
            out.append("\n" + line + "\n")
        else:
            line = re.sub(r"\s+", " ", line)
            line = re.sub(r" ?([{}();,=+\-*/<>?:!&|]) ?", r"\1", line)
            out.append(line + " ")
    body = "".join(out)
    body = re.sub(r" ?\n ?", "\n", body)
    body = re.sub(r"\n+", "\n", body)
    # a template that begins the shader must start with its #version line; others keep a leading newline so
    # that whatever is concatenated before them cannot run into a preprocessor line
    return body.lstrip("\n") if text.lstrip().startswith("#version") else "\n" + body.strip("\n ") + "\n"


def is_glsl(text: str) -> bool:
    return "void main" in text or text.lstrip().startswith("#version") or "uniform " in text or "gl_Position" in text


def minify_js(src: str) -> str:
    n = len(src)

    def template(i):
        """i is just past the opening backtick. Returns (text including both backticks, index after closing)."""
        parts, j = [], i
        while j < n:
            c = src[j]
            if c == "\\":
                j += 2
            elif c == "`":
                parts.append(src[i:j])
                body = "".join(parts)
                return "`" + (squeeze_glsl(body) if is_glsl(body) else body) + "`", j + 1
            elif c == "$" and src[j + 1] == "{":
                parts.append(src[i:j + 2])
                inner, j = code(j + 2, True)
                parts.append(inner + "}")
                i = j
            else:
                j += 1
        raise SystemExit("unterminated template literal")

    def code(i, in_template):
        """Minify code from i. In a template expression, stop at the matching '}' and return the index after it."""
        toks, depth = [], 0
        while i < n:
            c = src[i]
            if c == "/" and src[i + 1] == "/":
                i = src.index("\n", i)
            elif c == "/" and src[i + 1] == "*":
                i = src.index("*/", i) + 2
            elif c in "'\"":
                j = i + 1
                while src[j] != c:
                    j += 2 if src[j] == "\\" else 1
                toks.append(("raw", src[i:j + 1]))
                i = j + 1
            elif c == "`":
                text, i = template(i + 1)
                toks.append(("raw", text))
            elif c == "\n":
                toks.append(("nl", "\n"))
                i += 1
            elif c in " \t\r":
                toks.append(("ws", " "))
                i += 1
            elif c in PUNCT:
                if in_template and c == "{":
                    depth += 1
                if in_template and c == "}":
                    if depth == 0:
                        return emit(toks), i + 1
                    depth -= 1
                toks.append(("p", c))
                i += 1
            else:
                m = WORD.match(src, i)
                if not m:
                    raise SystemExit(f"unexpected character {c!r} at offset {i}")
                toks.append(("w", m.group(0)))
                i = m.end()
        return emit(toks), i

    def emit(toks):
        # collapse runs of whitespace; a run containing a newline becomes one newline
        merged = []
        for kind, text in toks:
            if kind in ("ws", "nl") and merged and merged[-1][0] in ("ws", "nl"):
                if kind == "nl":
                    merged[-1] = ("nl", "\n")
            else:
                merged.append((kind, text))
        out = []
        for k, (kind, text) in enumerate(merged):
            if kind == "ws":
                prev = merged[k - 1] if k else None
                nxt = merged[k + 1] if k + 1 < len(merged) else None
                if not prev or not nxt:
                    continue
                if prev[0] == "p" or nxt[0] == "p":
                    if prev[1] in "+-" and nxt[1] == prev[1]:     # keep "a - -b" and "a + +b" apart
                        out.append(" ")
                    continue
                out.append(" ")
            elif kind == "nl":
                prev = merged[k - 1] if k else None
                nxt = merged[k + 1] if k + 1 < len(merged) else None
                # a line break is only dropped where no statement can end: after these, or before these
                if not prev or not nxt or prev[1] in "{[(,;:=+-*/<>!&|?%^~." or nxt[1] in ")]}.,;:?=*/<>&|%^":
                    continue
                out.append("\n")
            else:
                out.append(text)
        return "".join(out)

    return code(0, False)[0]


def minify_page(page: str) -> str:
    css = re.search(r"<style>(.*?)</style>", page, re.S).group(1)
    small = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    small = re.sub(r"\s+", " ", small)
    small = re.sub(r" ?([{};,>]) ?", r"\1", small)
    small = re.sub(r": ", ":", small).replace(";}", "}").strip()
    page = page.replace(css, small)
    return re.sub(r">\s+<", "><", page)


def main():
    js = "\n".join((SRC / p).read_text() for p in PARTS)
    js = "(()=>{'use strict';\n" + js + "\n})();"
    raw_js = len(js.encode())
    page = (SRC / "111626_page.html").read_text()
    if "--no-minify" in sys.argv:
        mode = "not minified"
    else:
        js, page, mode = minify_js(js), minify_page(page), "minified (comments and whitespace; identifiers kept)"
    assert "</script" not in js.lower()
    head, tail = page.split("/*__JS__*/")
    html = head + js + tail
    (ROOT / "index.html").write_text(html)
    data = html.encode()
    print(f"index.html  {mode}")
    print(f"  source js : {raw_js:>8,d} bytes")
    print(f"  bundle    : {len(data):>8,d} bytes raw")
    print(f"  gzip -9   : {len(gzip.compress(data, 9)):>8,d} bytes")


if __name__ == "__main__":
    main()
