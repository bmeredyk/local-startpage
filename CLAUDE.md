# CLAUDE.md

A personal browser startpage: Groups (tabs) of Panels that hold Links. Plain HTML and
JavaScript with Bootstrap 5, stored in `localStorage`. Read `README.md` for features and the
export format, and `GLOSSARY.md` for the vocabulary.

## Rules for every change

1. **Add or update JSDoc** on every function you add or change in `app.js`, including inner
   functions. Document params, return value and thrown errors. If you change the data
   model, update the `Link`, `Panel` and `Group` typedefs at the top of the file.
2. **Keep `README.md` up to date** whenever functionality changes: features, the usage
   table, the export format example, the project layout and the third-party table.
3. **Use the glossary's words**: Group (not tab or page), Panel (not section or column),
   Link (not bookmark), Edit mode. Update `GLOSSARY.md` when you introduce or change a
   concept. It holds vocabulary only, never implementation details.
4. **Don't commit unless asked.** After finishing a change, say what changed and ask.

## Hard constraints (the product depends on these)

- **Must work from `file://` with no server.** So: no ES modules (`import`/`export`), no
  `fetch` of local files, no build step, no bundler, no npm runtime dependencies. Scripts are
  plain `<script>` tags, and assets are referenced by relative path.
- **Offline**: every library is vendored in `vendor/`. Never link a CDN from `index.html`.
- **No server, no network calls.** All data lives in `localStorage` (key `startpage.v1`).
- **Never build DOM from strings.** Use the `h()` helper in `app.js` so user text can't be
  parsed as HTML. Never use `innerHTML` or `outerHTML` with user data.
- **Links may use only `http`, `https`, `file` and `mailto`.** Always run URLs through
  `normalizeUrl()`.

## How the code is organized

- `index.html`: markup for the top bar, tab bar and all dialogs, plus the CSS.
- `app.js`: one IIFE. State is `state = {title, groups[].panels[].links[], activeId,
  lastExported}`. The flow is always: mutate `state`, then `save()`, then `render()`.
  `render()` rebuilds the whole page, so never keep references to elements across a render.
- Clicks are handled by **one delegated listener**; buttons carry `data-action="..."`. To add
  an action, add a `case` there and a button with that `data-action`.
- Tooltips: put `data-tip="text"` on an element. Don't use `title`.
- Edit-only UI: add the `edit-only` class. Add `pointer-only` (shown at 768px and wider,
  for drag handles) or `touch-only` (below 768px, for the up/down arrows) as needed.
- Icons are stored as `"<set>:<name>"` (`bi`, `fas`, `far`, `fab`). Always go through
  `normalizeIcon()` when reading data and `iconEl()` when rendering. A bare name means
  Bootstrap Icons.

### Changing the data model

A new field has to be handled in **all** of these places, or it will be lost or unvalidated:
`sanitizePanels` (or `sanitizeData`), the create path, the edit path, `exportJson`, the dialog
that edits it, the renderer, the typedefs, and the README export example. Treat input from
storage and from imported files as untrusted, and validate it in `sanitizeData`. Old saved
data and old exports must keep loading, so give new fields a default and bump `version` only
for a breaking change, with a migration in `sanitizeData`.

## Deployment (GitHub Pages)

The repo `bmeredyk/local-startpage` is public and served by GitHub Pages from the root of
`main` at https://bmeredyk.github.io/local-startpage/. **Pushing `main` deploys it**, so treat
a push as publishing: don't push unless asked.

- The site lives under a **subpath**, so every asset must use a *relative* path (`vendor/...`,
  `app.js`). Never use a leading `/`.
- `.nojekyll` must stay, and `index.html` keeps `<meta name="robots" content="noindex, nofollow">`.
  Don't remove either without asking.
- `localStorage` there is keyed to `bmeredyk.github.io` and separate from the `file://` copy.
  Links with a `file:` URL can't be opened from the hosted page. Keep the README's hosting
  section accurate if any of this changes.
- Commits must use the GitHub no-reply address (set in this repo's local git config), never a
  real email. Pushing needs gh's credentials, because git has no credential helper:
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`.
- After a deploy, hard-refresh to see changes (browsers cache `app.js`). Check the build with
  `gh api repos/bmeredyk/local-startpage/pages/builds/latest --jq .status`.

## Running and testing

There is no test suite. To check a change, serve the folder and use a browser:

```bash
uv run python -m http.server 8765 --bind 127.0.0.1   # run in the background
# open http://127.0.0.1:8765/index.html
pkill -f "http.server 8765"                           # stop it when you're done
```

- Browser automation can't use `localStorage` on `file://` pages (they render as `data:`
  snapshots), so always test through the server. Still make sure nothing you add breaks
  `file://`.
- Tests that need data can seed it by importing a JSON file through the page. Build a `File`,
  put it on `#importFile.files` and dispatch `change`, then click `#confirmOk`.
- Drag and drop can be tested by dispatching `DragEvent`s with a shared `DataTransfer`:
  `dragstart` on the grip handle (`[data-drag]`), then `drop` on the target.
- Bootstrap modals and toasts animate, so wait a few hundred ms before reading state or
  taking screenshots, or you'll see half-faded UI.
- A narrow browser pane (under 768px) shows the phone layout with arrows instead of drag
  handles. Resize the viewport to test the desktop layout, and reset it afterwards.
- After a render, query elements again. A test that holds an element from before the render
  will click a detached node and do nothing.
- Check the console for errors.

## Icon packs and the generated lists

`icons.js` (Bootstrap Icons) and `fa-icons.js` (Font Awesome Free) are **generated, so never
edit them by hand**. The picker is built from them. Full details are in `tools/README.md`.

```bash
tools/update-bootstrap-icons.sh 1.11.3   # download that release, vendor it, regenerate icons.js
tools/update-fontawesome.sh 6.7.2        # same for Font Awesome Free, regenerates fa-icons.js
node tools/gen-bootstrap-icons.mjs       # regenerate icons.js only (vendored files already in place)
```

Running an update script with the version already vendored should leave `git status` clean.
That is a handy check that the tooling still works. After an upgrade, look at
`git diff --stat` for removed icons: a saved icon that no longer exists silently becomes "no
icon". The scripts need network access and `uv` (for Font Awesome). Update the version
numbers in the README's third-party table and in `tools/README.md` examples.

## Vendoring other libraries

Everything in `vendor/` is a pinned release copied from jsDelivr, not installed with npm.
Bootstrap itself has no script. To upgrade it, or to add a new library:

```bash
curl -fsSL -o vendor/bootstrap.min.css      https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css
curl -fsSL -o vendor/bootstrap.bundle.min.js https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js
```

- **Ask the user before downloading** anything new, naming the file, source and size.
- Pin an exact version, keep the license header and any LICENSE file with the vendored
  files, and keep fonts or images in the relative layout the CSS expects (it is why
  `vendor/fontawesome/` has `css/` and `webfonts/` subfolders).
- Put downloaded files you intend to inspect or process in a scratch directory outside the
  repo first, and copy only what you need into `vendor/`.
- Reference assets by relative path in `index.html`, then confirm it still works from `file://`.
- Add the library to the README's third-party table with its version and license.
- Add its full license text and any required attribution to `THIRD_PARTY_NOTICES.md`, and
  check that the license is compatible with this project's MIT license (permissive licenses
  are; copyleft ones such as GPL are not without further thought). Update the notice when
  you upgrade a version. Icons and data derived from a library need the same attribution.
- If a library has a large name list or metadata, generate a trimmed file with a script in
  `tools/` (like the icon generators) and document it in `tools/README.md`.
