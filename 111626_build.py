"""Build index.html: concatenate src/*.js, minify if esbuild is available, inline into the page shell.

Usage:  python3 111626_build.py [--no-minify]
Set ESBUILD=/path/to/esbuild (or have `esbuild` on PATH) to minify; otherwise the script inlines readable source.
"""
import gzip
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
PARTS = ["111626_core.js", "111626_shaders.js", "111626_scene.js", "111626_content.js", "111626_app.js"]


def minify_glsl(js: str) -> str:
    """Strip comments and collapse whitespace inside GLSL template literals (those that follow a `= ...` and contain `void main`)."""
    def squeeze(m):
        body = m.group(0)
        if "void main" not in body and "layout(" not in body and "uniform " not in body:
            return body
        out = []
        for line in body.split("\n"):
            line = re.sub(r"//.*$", "", line).strip()
            if not line:
                continue
            out.append(line + ("\n" if line.startswith("#") else " "))
        text = "".join(out)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r" ?([{}();,=+\-*/<>?:]) ?", r"\1", text)
        text = text.replace("\n ", "\n")
        # preprocessor lines need to start on their own line
        text = re.sub(r"(?<!\n)(#(?:version|define|ifdef|ifndef|else|endif))", r"\n\1", text)
        return text.strip(" ") if text.startswith("`") else text
    return re.sub(r"`[^`]*`", squeeze, js)


def main():
    js = "\n".join((SRC / p).read_text() for p in PARTS)
    js = "(()=>{'use strict';\n" + js + "\n})();"
    raw_js = len(js)
    esbuild = os.environ.get("ESBUILD") or shutil.which("esbuild")
    if "--no-minify" not in sys.argv and esbuild:
        js = minify_glsl(js)
        r = subprocess.run([esbuild, "--minify", "--target=es2020", "--loader=js"], input=js, capture_output=True, text=True)
        if r.returncode:
            sys.exit("esbuild failed:\n" + r.stderr)
        js = r.stdout.strip()
        mode = "minified with esbuild"
    else:
        mode = "not minified (esbuild not found or --no-minify)"
    page = (SRC / "111626_page.html").read_text()
    if "--no-minify" not in sys.argv and esbuild:
        css = re.search(r"<style>(.*?)</style>", page, re.S).group(1)
        small = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        small = re.sub(r"\s+", " ", small)
        small = re.sub(r" ?([{};:,>]) ?", r"\1", small).replace(";}", "}").strip()
        page = page.replace(css, small)
        page = re.sub(r">\s+<", "><", page)
    assert "</script" not in js.lower()
    html = page.replace("/*__JS__*/", lambda _: js) if False else page.split("/*__JS__*/")[0] + js + page.split("/*__JS__*/")[1]
    out = ROOT / "index.html"
    out.write_text(html)
    data = html.encode()
    print(f"index.html  {mode}")
    print(f"  source js : {raw_js:>8,d} bytes")
    print(f"  bundle    : {len(data):>8,d} bytes raw")
    print(f"  gzip -9   : {len(gzip.compress(data, 9)):>8,d} bytes")


if __name__ == "__main__":
    main()
