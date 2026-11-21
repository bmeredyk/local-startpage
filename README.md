# Startpage

A personal browser startpage manager. Organize your links into colored **Panels**,
group Panels into **tabs**, and set it as your browser homepage.

It is plain HTML and JavaScript with Bootstrap 5. There is **no server and no build step**.
Everything is stored in your browser's `localStorage`, and you can open `index.html` straight
from disk.

## Features

- **Groups (tabs)** across the top, for example "Personal" and "Work". Add, rename, delete
  and re-order them.
- **Panels** with a title, background color, optional icon and an optional description shown
  above or below the links.
- **Readable text automatically.** Text switches between light and dark to suit the Panel
  color, or you can pick a custom text color.
- **Links** with a name, a URL and an optional icon.
- **Icon picker** with about 4,100 icons: Bootstrap Icons plus Font Awesome Free (solid,
  regular and brands). It has a set filter and keyword search, so "email" finds the
  envelope icons.
- **Editable page title**, used in the top bar and as the browser tab title.
- **Drag and drop** to re-order Panels, re-order Links, and move Links between Panels.
- **Export and import** as JSON, for backups and for moving between browsers or machines.
- **Responsive**, down to a single column on phones. It follows your OS light/dark setting.

## Getting started

Open `index.html` in a browser. That is all.

To use it as your homepage, point the browser's homepage setting at the file, for example
`file:///Users/you/code/Web-Bookmark-Startpage/index.html`. In Chrome this is under
Appearance, "Show home button". In Firefox it is under Home, "Custom URLs".

If you prefer a server, any static one works:

```bash
uv run python -m http.server 8765
# then open http://127.0.0.1:8765/index.html
```

## Using it

Adding is always available, with no mode to switch on:

| To do this | Use |
|---|---|
| Add a link to a Panel | The **+** in the Panel's header |
| Add a link to any Panel in this group | **Add link** in the top bar (pick the Panel in the dialog) |
| Add a Panel | **New panel** in the top bar |
| Add a Group | The **+** at the end of the tab bar |

Everything else is in **Edit mode**. Turn it on with **Edit** in the top bar. Controls
appear on every Panel, Link and tab, and the page title gets a rename pencil:

- **Edit** (pencil) a Panel or Link to change its name, URL, colors, icon, description,
  or which Group or Panel it belongs to.
- **Drag** the grip handle on a Panel to re-order Panels. Drag a Link's handle to re-order
  within a Panel or drop it onto another Panel. Drag a tab to re-order Groups.
- **Delete** with the trash icon. Deleting a Link is immediate, with an **Undo** toast.
  Deleting a Panel that has links, or a Group that has Panels, asks for confirmation.
  The last remaining Group can't be deleted.
- On small screens, where drag and drop doesn't work, up/down arrows replace the handles.

Click **Done** to leave Edit mode. While editing, clicking a link doesn't navigate.

## Hosting on GitHub Pages

The repo is also served as a static site at https://bmeredyk.github.io/local-startpage/
(Pages, branch `main`, root folder). Pushing to `main` deploys it within about a minute. You
can use that address as a homepage on any machine. Things to know:

- **Data is still per browser.** It is never uploaded. A new browser starts empty, so move
  your setup with **Data → Export JSON** and **Import JSON**. The hosted site and the
  `file://` copy have separate storage.
- **`file:` links don't work from the hosted page.** Browsers block web pages from opening
  `file://` links. `http`, `https` and `mailto` links work.
- **Storage is shared by every site under `bmeredyk.github.io`**, because `localStorage` is
  keyed to the host, not the path. Don't host other sites there that you don't trust with
  your startpage data, or move this one to a custom domain.
- The site is public but carries a `noindex` tag, so well-behaved search engines skip it. It
  contains only the app, so never commit personal links to the repo.
- `.nojekyll` stops GitHub from processing the files, and every asset uses a relative path so
  the page works under the `/local-startpage/` subpath.

## Your data

Data lives in your browser's `localStorage` under the key `startpage.v1`. Nothing is sent
anywhere.

**Back up with Data → Export JSON.** `localStorage` belongs to one browser profile and one
origin, and it is cleared if you clear site data. On `file://`, some browsers key it to the
file's path, so moving or renaming the folder can make the page open empty. Your data is
still there under the old location, and an export lets you restore it. The Data menu shows
when you last exported.

**Import replaces everything** after a confirmation. An invalid file is rejected and changes
nothing. Merging is not supported.

### Export format

```json
{
  "version": 2,
  "title": "Startpage",
  "exportedAt": "2026-11-20T20:00:00.000Z",
  "exportedFrom": "file:///Users/you/code/Web-Bookmark-Startpage/index.html",
  "groups": [
    {
      "name": "Home",
      "panels": [
        {
          "title": "News",
          "bg": "#cfd8e3",
          "textColor": null,
          "icon": "fas:newspaper",
          "description": "",
          "descPos": "top",
          "links": [
            { "name": "Hacker News", "url": "https://news.ycombinator.com", "icon": "fab:hacker-news" }
          ]
        }
      ]
    }
  ]
}
```

- `textColor: null` means automatic contrast. `descPos` is `"top"` or `"bottom"`.
- `icon` is `"<set>:<name>"` with set `bi`, `fas`, `far` or `fab`, or `null`. A bare name
  like `house` is read as a Bootstrap icon.
- `exportedAt` and `exportedFrom` are informational and ignored on import. `exportedFrom`
  records where the file came from, which helps you find the original after a move.
- Import also accepts the older version 1 format (a flat `panels` list), which becomes one
  Group named "Home".
- Links may use only `http`, `https`, `file` and `mailto`. A link typed without a scheme gets
  `https://`.

## Project layout

```
index.html          The page: top bar, tab bar, dialogs and styles
app.js              All behavior (JSDoc-documented), one script with no modules
icons.js            Generated list of Bootstrap Icons names
fa-icons.js         Generated list of Font Awesome Free names and search keywords
vendor/             Bootstrap 5.3.3, Bootstrap Icons 1.11.3, Font Awesome Free 6.7.2
tools/              Scripts that upgrade the icon sets and regenerate the two lists
GLOSSARY.md         The project's vocabulary: Startpage, Group, Panel, Link, Edit mode
LICENSE             MIT license for this project's own code
.nojekyll           Empty file telling GitHub Pages not to run Jekyll
THIRD_PARTY_NOTICES.md  Licenses and attributions for everything in vendor/
```

`app.js` is a single script rather than ES modules because browsers block module imports on
`file://`. It builds the DOM with a small `h()` helper instead of `innerHTML`, so user text
is never parsed as HTML. The saved shape is `groups[].panels[].links[]`, defined as
typedefs at the top of `app.js`.

## Developing

There is no build or test tooling. Edit the files and reload the page. To check your work,
serve the folder as shown above, because browser automation tools can't use `localStorage`
on `file://` pages.

To upgrade an icon set and regenerate its name list, see [tools/README.md](tools/README.md).

## Third-party software

All of it is vendored in `vendor/`, so the page works offline.

| Library | Version | License |
|---|---|---|
| [Bootstrap](https://getbootstrap.com/) | 5.3.3 | MIT |
| [Bootstrap Icons](https://icons.getbootstrap.com/) | 1.11.3 | MIT |
| [Font Awesome Free](https://fontawesome.com/) | 6.7.2 | Icons CC BY 4.0, fonts SIL OFL 1.1, code MIT (see `vendor/fontawesome/LICENSE.txt`) |

The full license texts and required attributions are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

MIT. See [LICENSE](LICENSE). The vendored libraries above keep their own licenses.
