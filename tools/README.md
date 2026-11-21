# Icon tooling

The icon picker needs a list of every icon name in each set. Those lists are
generated files, so they must be regenerated whenever an icon set is upgraded.

| Generated file | Contents | Made by |
|---|---|---|
| `icons.js` | Bootstrap Icons names (`window.BI_ICONS`) | `tools/gen-bootstrap-icons.mjs` |
| `fa-icons.js` | Font Awesome Free names plus search keywords (`window.FA_ICONS`) | `tools/gen-fontawesome-icons.py` |

Never edit those two files by hand. The vendored CSS and fonts live in `vendor/`.

## Upgrading an icon set

Both commands download the release from the jsDelivr CDN, replace the vendored
files, and regenerate the name list. They need network access, and `uv` for
Font Awesome (the Python dependencies are declared inside the script).

```bash
tools/update-bootstrap-icons.sh 1.11.3     # Bootstrap Icons: pass the version
tools/update-fontawesome.sh 6.7.2          # Font Awesome Free: pass the version
```

Then:

1. Serve the folder (`uv run python -m http.server 8765`) and open the icon picker in a
   Panel and a Link dialog. Check that icons render and search works.
2. Look at `git diff --stat`. A new release should add icons; a large number of
   removals means a rename, and any saved icon that no longer exists will silently
   drop to "no icon" on the next load or import.
3. Commit the vendored files and the regenerated list together.

## Regenerating only the list

Use this if the vendored files are already in place and you only need the list
rebuilt (for example after editing the generator):

```bash
node tools/gen-bootstrap-icons.mjs
# <package-dir> needs css/all.min.css, webfonts/*.woff2 and metadata/icons.yml
uv run tools/gen-fontawesome-icons.py <package-dir> fa-icons.js
```

`tools/update-fontawesome.sh` builds that `<package-dir>` in a temp folder, which
is why the simplest way to regenerate Font Awesome is to re-run it with the
current version (the output should be byte-identical).

## How the generators work

- **Bootstrap Icons**: reads every `.bi-<name>::before` rule from
  `vendor/bootstrap-icons.min.css`. The version comes from the CSS header comment.
- **Font Awesome Free**: `metadata/icons.yml` lists every icon, including Pro-only
  styles and icons. An icon is kept only if its glyph exists in the Free web font
  for that style (`fa-solid-900`, `fa-regular-400`, `fa-brands-400`), read with
  `fontTools`. Search keywords come from each icon's `search.terms`, `aliases`
  and `label`. Each entry is `[name, "keywords"]`, grouped as `s`, `r`, `b`.
  Both generators stop with an error if far fewer icons than expected are
  found, which usually means the package layout changed.

## How icons are stored

An icon is saved as `<set>:<name>`: `bi:house`, `fas:house`, `far:house`, `fab:github`.
A bare name such as `house` is read as Bootstrap Icons (the format from before
Font Awesome was added). The registry that maps these ids to CSS classes is at the top
of `app.js` (`ICON_SETS`). To add a third icon library, add an entry there, a generated
list, and its CSS in `index.html`.

## Licenses

Font Awesome Free (icons CC BY 4.0, fonts SIL OFL, code MIT) must keep its license
header; the update script preserves `vendor/fontawesome/LICENSE.txt` and the header in
the CSS. Bootstrap Icons is MIT.
