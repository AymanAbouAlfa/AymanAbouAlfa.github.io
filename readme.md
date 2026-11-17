# Ayman Abou-Alfa: personal website

An interactive 3D biology lab bench that doubles as the site menu. Click the labelled bottle, flask,
plates, culture tubes, notebook and drawers to open each section.

The whole site is one file, `index.html`, with no dependencies and no network requests.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The built site (this is what GitHub Pages serves) |
| `src/111626_content.js` | All text and links shown in the panels. Edit this to change content or add a section |
| `src/111626_scene.js` | The lab bench: every object is modelled in code |
| `src/111626_core.js`, `src/111626_shaders.js`, `src/111626_app.js` | Maths and geometry helpers, GLSL shaders, renderer and interaction |
| `src/111626_page.html` | Page shell and CSS |
| `111626_build.py` | Builds `index.html` from `src/` |
| `verification/` | Scripts that capture renders and measure frame times in Firefox, and their reports |

## Build

```
python3 111626_build.py            # minified
python3 111626_build.py --no-minify
```

The build needs only Python 3. Its minifier strips comments and whitespace and does not rename identifiers.

## Credits

The idea of a 3D scene as the site menu comes from [Jesse Zhou's ramen-shop portfolio](https://www.jesse-zhou.com/).
No code or assets from it are used. The site was built with Claude Code (Claude Fable 5.2); see the
Acknowledgments drawer on the site.
