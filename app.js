(() => {
  'use strict';

  const STORAGE_KEY = 'startpage.v1';
  const DEFAULT_BG = '#cfd8e3';
  const SAFE_PROTOCOLS = ['http:', 'https:', 'file:', 'mailto:'];
  const ICONS = window.BI_ICONS || [];
  const ICON_SET = new Set(ICONS);
  const ICON_PAGE = 200;
  const DEFAULT_TITLE = 'Startpage';

  const $ = (sel) => document.querySelector(sel);
  const rootEl = $('#panels');

  // state.groups[].panels[].links[]; activeId is the Group currently shown.
  let state = { title: DEFAULT_TITLE, groups: [], activeId: null, lastExported: null };
  let editMode = false;
  let drag = null;
  let storageWarned = false;

  // ---------- helpers ----------

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

  function autoText(bg) {
    const n = parseInt(bg.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#111111' : '#ffffff';
  }

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }

  const icon = (name) => h('i', { class: 'bi bi-' + name });

  function iconBtn(action, iconName, label, extra = '', disabled = false) {
    return h('button', {
      type: 'button', class: 'icon-btn ' + extra, 'data-action': action,
      'data-tip': label, 'aria-label': label, disabled,
    }, icon(iconName));
  }

  // ---------- URL handling ----------

  function normalizeUrl(input) {
    let s = String(input || '').trim();
    if (!s) return { ok: false, error: 'Enter a URL.' };
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s)
      || /^(mailto|javascript|data|vbscript|blob|about|tel):/i.test(s);
    if (!hasScheme) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch (e) { return { ok: false, error: 'That doesn\'t look like a valid URL.' }; }
    if (!SAFE_PROTOCOLS.includes(u.protocol)) {
      return { ok: false, error: 'Only http, https, file and mailto links are allowed.' };
    }
    return { ok: true, value: s };
  }

  // ---------- persistence ----------

  function sanitizeData(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('This is not a Startpage file.');
    // Version 1 had no Groups: its Panels become a single "Home" Group.
    if (obj.version === 1 && Array.isArray(obj.panels)) {
      return [{ id: uid(), name: 'Home', panels: sanitizePanels(obj.panels) }];
    }
    if (obj.version !== 2 || !Array.isArray(obj.groups)) {
      throw new Error(obj.version > 2 ? 'Unsupported file version: ' + obj.version + '.' : 'This is not a Startpage file (no "groups" list found).');
    }
    if (!obj.groups.length) throw new Error('The file contains no groups.');
    return obj.groups.map((g, i) => {
      if (!g || typeof g.name !== 'string' || !Array.isArray(g.panels)) throw new Error('Group ' + (i + 1) + ' is invalid.');
      return { id: uid(), name: g.name.trim() || 'Untitled', panels: sanitizePanels(g.panels) };
    });
  }

  function sanitizePanels(list) {
    const panels = list.map((p, i) => {
      if (!p || typeof p.title !== 'string') throw new Error('Panel ' + (i + 1) + ' has no title.');
      if (p.links != null && !Array.isArray(p.links)) throw new Error('Panel "' + p.title + '" has an invalid link list.');
      const links = (p.links || []).map((l) => {
        if (!l || typeof l.name !== 'string' || typeof l.url !== 'string') {
          throw new Error('Panel "' + p.title + '" has a link without a name or URL.');
        }
        const r = normalizeUrl(l.url);
        if (!r.ok) throw new Error('Panel "' + p.title + '", link "' + l.name + '": ' + r.error);
        return { id: uid(), name: l.name.trim() || r.value, url: r.value, icon: ICON_SET.has(l.icon) ? l.icon : null };
      });
      return {
        id: uid(),
        title: p.title.trim() || 'Untitled',
        bg: isHex(p.bg) ? p.bg : DEFAULT_BG,
        textColor: isHex(p.textColor) ? p.textColor : null,
        icon: ICON_SET.has(p.icon) ? p.icon : null,
        description: typeof p.description === 'string' ? p.description.trim().slice(0, 2000) : '',
        descPos: p.descPos === 'bottom' ? 'bottom' : 'top',
        links,
      };
    });
    return panels;
  }

  const cleanTitle = (t) => (typeof t === 'string' && t.trim() ? t.trim().slice(0, 60) : DEFAULT_TITLE);

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      state.groups = sanitizeData(parsed);
      state.title = cleanTitle(parsed.title);
      const active = state.groups[parsed.activeGroup];
      state.activeId = (active || state.groups[0]).id;
      state.lastExported = typeof parsed.lastExported === 'string' ? parsed.lastExported : null;
    } catch (e) {
      try { localStorage.setItem(STORAGE_KEY + '.corrupt', raw); } catch (e2) { /* ignore */ }
      setTimeout(() => toast('Saved data could not be read, so the page started empty. The old data was kept under the "' + STORAGE_KEY + '.corrupt" storage key.', { variant: 'danger', delay: 12000 }), 0);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        title: state.title,
        lastExported: state.lastExported,
        activeGroup: state.groups.findIndex((g) => g.id === state.activeId),
        groups: state.groups,
      }));
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        toast('Could not save to browser storage. Changes will be lost when you close this page. Use Data → Export.', { variant: 'danger', delay: 10000 });
      }
    }
  }

  // ---------- toasts & confirm ----------

  function toast(message, { variant = 'dark', action, onAction, delay = 4000 } = {}) {
    const body = h('div', { class: 'toast-body flex-grow-1' }, message);
    const wrap = h('div', { class: 'd-flex align-items-center' }, body);
    if (action) {
      const btn = h('button', { type: 'button', class: 'btn btn-sm btn-light me-2' }, action);
      btn.addEventListener('click', () => { onAction(); bootstrap.Toast.getInstance(el).hide(); });
      wrap.append(btn);
    }
    wrap.append(h('button', { type: 'button', class: 'btn-close btn-close-white me-2', 'data-bs-dismiss': 'toast', 'aria-label': 'Close' }));
    const el = h('div', { class: 'toast border-0 text-bg-' + variant, role: 'alert' }, wrap);
    $('#toasts').append(el);
    el.addEventListener('hidden.bs.toast', () => el.remove());
    new bootstrap.Toast(el, { delay }).show();
  }

  const confirmModal = bootstrap.Modal.getOrCreateInstance($('#confirmModal'));
  function confirmDialog({ title, body, okText = 'Confirm', danger = true }) {
    return new Promise((resolve) => {
      let done = false;
      const el = $('#confirmModal');
      const ok = $('#confirmOk');
      $('#confirmTitle').textContent = title;
      $('#confirmBody').textContent = body;
      ok.textContent = okText;
      ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      ok.onclick = () => { finish(true); confirmModal.hide(); };
      el.addEventListener('hidden.bs.modal', () => finish(false), { once: true });
      confirmModal.show();
    });
  }

  // ---------- rendering ----------

  function render() {
    document.body.classList.toggle('editing', editMode);
    const editBtn = $('#editBtn');
    editBtn.classList.toggle('active', editMode);
    editBtn.classList.toggle('btn-secondary', editMode);
    editBtn.classList.toggle('btn-outline-secondary', !editMode);
    editBtn.setAttribute('aria-pressed', String(editMode));
    editBtn.lastChild.textContent = editMode ? ' Done' : ' Edit';

    const panels = curGroup().panels;
    $('#emptyState').classList.toggle('d-none', panels.length > 0);
    $('#addLinkBtn').disabled = panels.length === 0;
    $('#lastExported').textContent = 'Last exported: ' + (state.lastExported ? new Date(state.lastExported).toLocaleString() : 'never');

    hideTips();
    $('#siteTitle').textContent = state.title;
    document.title = state.title;
    $('#groupTabs').replaceChildren(...state.groups.map(tabEl), addTabEl());
    rootEl.replaceChildren(...panels.map(panelEl));
  }

  function tabEl(g, i) {
    const active = g.id === state.activeId;
    return h('li', { class: 'nav-item', role: 'presentation', 'data-group-id': g.id, draggable: editMode ? 'true' : null },
      h('button', { type: 'button', class: 'nav-link' + (active ? ' active' : ''), role: 'tab', 'aria-selected': String(active), 'data-action': 'group-select' }, g.name),
      h('span', { class: 'tab-tools d-inline-flex' },
        iconBtn('group-left', 'chevron-left', 'Move group left', 'edit-only touch-only', i === 0),
        iconBtn('group-right', 'chevron-right', 'Move group right', 'edit-only touch-only', i === state.groups.length - 1),
        iconBtn('group-edit', 'pencil', 'Rename group', 'edit-only'),
        iconBtn('group-delete', 'trash', 'Delete group', 'edit-only', state.groups.length === 1)));
  }

  function addTabEl() {
    return h('li', { class: 'nav-item' },
      h('button', { type: 'button', class: 'nav-link', 'data-action': 'group-add', 'data-tip': 'Add a new group (tab)', 'aria-label': 'Add a new group' }, icon('plus-lg')));
  }

  function panelEl(p, i) {
    const fg = p.textColor || autoText(p.bg);
    const desc = p.description ? h('div', { class: 'panel-desc panel-desc-' + p.descPos }, p.description) : null;
    return h('div', { class: 'col', 'data-panel-id': p.id },
      h('section', { class: 'card panel', style: 'background-color:' + p.bg + ';color:' + fg },
        h('div', { class: 'panel-header d-flex align-items-start gap-1' },
          h('span', { class: 'icon-btn drag-handle edit-only pointer-only', 'data-drag': 'panel', draggable: 'true', 'data-tip': 'Drag to re-order panels', 'aria-label': 'Drag to re-order panel' }, icon('grip-vertical')),
          h('h2', { class: 'h5 fw-semibold mb-0 flex-grow-1 text-break pt-1' }, p.icon && h('i', { class: 'bi bi-' + p.icon + ' me-2' }), p.title),
          iconBtn('panel-up', 'chevron-up', 'Move panel up', 'edit-only touch-only', i === 0),
          iconBtn('panel-down', 'chevron-down', 'Move panel down', 'edit-only touch-only', i === curGroup().panels.length - 1),
          iconBtn('panel-edit', 'pencil', 'Edit panel', 'edit-only'),
          iconBtn('panel-delete', 'trash', 'Delete panel', 'edit-only'),
          iconBtn('link-add', 'plus-lg', 'Add a link to this panel')),
        p.descPos === 'top' && desc,
        h('ul', { class: 'links list-unstyled mb-0' },
          p.links.map((l, j) => linkEl(l, j, p.links.length)),
          p.links.length === 0 && h('li', { class: 'empty-hint small' }, 'No links yet')),
        p.descPos === 'bottom' && desc));
  }

  function linkEl(l, j, count) {
    return h('li', { class: 'link-item d-flex align-items-center gap-1', 'data-link-id': l.id, draggable: editMode ? 'true' : null },
      h('a', { class: 'link-name flex-grow-1 text-break', href: l.url, draggable: 'false' }, l.icon && h('i', { class: 'bi bi-' + l.icon + ' me-2' }), l.name),
      iconBtn('link-up', 'chevron-up', 'Move link up', 'edit-only touch-only', j === 0),
      iconBtn('link-down', 'chevron-down', 'Move link down', 'edit-only touch-only', j === count - 1),
      iconBtn('link-edit', 'pencil', 'Edit link', 'edit-only'),
      iconBtn('link-delete', 'trash', 'Delete link', 'edit-only'));
  }

  // ---------- state mutations ----------

  const countPanels = (groups) => groups.reduce((n, g) => n + g.panels.length, 0);
  const curGroup = () => state.groups.find((g) => g.id === state.activeId);
  const findPanel = (id) => curGroup().panels.find((p) => p.id === id);

  function moveInArray(arr, from, to) {
    if (to < 0 || to >= arr.length) return;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
  }

  function movePanel(id, targetId, after) {
    const panels = curGroup().panels;
    const from = panels.findIndex((p) => p.id === id);
    const [panel] = panels.splice(from, 1);
    const to = panels.findIndex((p) => p.id === targetId);
    panels.splice(to + (after ? 1 : 0), 0, panel);
  }

  function moveLink(id, toPanelId, targetLinkId, after) {
    let link = null;
    for (const p of curGroup().panels) {
      const idx = p.links.findIndex((l) => l.id === id);
      if (idx !== -1) { [link] = p.links.splice(idx, 1); break; }
    }
    if (!link) return;
    const dest = findPanel(toPanelId);
    const t = targetLinkId ? dest.links.findIndex((l) => l.id === targetLinkId) : -1;
    dest.links.splice(t === -1 ? dest.links.length : t + (after ? 1 : 0), 0, link);
  }

  // ---------- icon picker ----------
  // A searchable grid of Bootstrap Icons, built inside `mount`. Used by the Panel and Link dialogs.

  function createIconPicker(mount, onChange = () => {}) {
    let value = null;
    let matches = [];
    let shown = 0;

    const toggleIcon = h('i', { class: 'bi bi-image' });
    const toggleName = h('span', {}, 'None');
    const toggle = h('button', { type: 'button', class: 'btn btn-outline-secondary', 'aria-expanded': 'false' }, toggleIcon, ' ', toggleName);
    const clear = h('button', { type: 'button', class: 'btn btn-link btn-sm', 'data-tip': 'Remove the icon' }, 'Clear');
    const search = h('input', { type: 'search', class: 'form-control form-control-sm mb-2', placeholder: 'Search icons (e.g. mail, github, cart)', autocomplete: 'off' });
    const grid = h('div', { class: 'icon-grid' });
    const count = h('span', { class: 'small text-body-secondary' });
    const more = h('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary d-none' }, 'Show more');
    const panel = h('div', { class: 'border rounded p-2 mt-2 d-none' },
      search, grid, h('div', { class: 'd-flex align-items-center gap-2 mt-2' }, count, more));
    mount.replaceChildren(h('div', { class: 'd-flex align-items-center gap-2' }, toggle, clear), panel);

    const isOpen = () => !panel.classList.contains('d-none');

    function sync() {
      toggleIcon.className = 'bi bi-' + (value || 'image');
      toggleName.textContent = value || 'None';
      clear.disabled = !value;
    }

    function renderGrid(append) {
      if (!append) { grid.replaceChildren(); shown = 0; grid.scrollTop = 0; }
      const batch = matches.slice(shown, shown + ICON_PAGE);
      grid.append(...batch.map((name) => h('button', {
        type: 'button', 'data-icon': name, 'data-tip': name, 'aria-label': name,
        class: name === value ? 'selected' : null,
      }, h('i', { class: 'bi bi-' + name }))));
      shown += batch.length;
      count.textContent = matches.length ? 'Showing ' + shown + ' of ' + matches.length : 'No icons match.';
      more.classList.toggle('d-none', shown >= matches.length);
    }

    function filter() {
      const terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      matches = ICONS.filter((n) => terms.every((t) => n.includes(t)));
      renderGrid(false);
    }

    function setOpen(open) {
      panel.classList.toggle('d-none', !open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) { filter(); search.focus(); }
    }

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    search.addEventListener('input', filter);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    more.addEventListener('click', () => renderGrid(true));
    clear.addEventListener('click', () => {
      value = null;
      sync();
      if (isOpen()) filter();
      onChange(value);
    });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-icon]');
      if (!b) return;
      value = b.dataset.icon;
      grid.querySelectorAll('.selected').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      sync();
      onChange(value);
    });

    sync();
    return {
      get: () => value,
      // Reset to a value without notifying; also closes and clears the search.
      set(v) { value = v || null; search.value = ''; setOpen(false); sync(); },
    };
  }

  // ---------- link dialog ----------

  const linkModal = bootstrap.Modal.getOrCreateInstance($('#linkModal'));
  let linkCtx = null;
  const linkIcon = createIconPicker($('#linkIconPicker'));

  function setInvalid(input, msg) {
    input.classList.toggle('is-invalid', !!msg);
    if (msg) input.nextElementSibling.textContent = msg;
  }

  function openLinkDialog({ panelId, linkId }) {
    linkCtx = { linkId, fromPanelId: panelId };
    const link = linkId ? findPanel(panelId).links.find((l) => l.id === linkId) : null;
    $('#linkModalTitle').textContent = link ? 'Edit link' : 'Add link';
    $('#linkName').value = link ? link.name : '';
    $('#linkUrl').value = link ? link.url : '';
    linkIcon.set(link ? link.icon : null);
    setInvalid($('#linkName'), null);
    setInvalid($('#linkUrl'), null);
    const sel = $('#linkPanel');
    sel.replaceChildren(...curGroup().panels.map((p) => h('option', { value: p.id }, p.title)));
    sel.value = panelId;
    linkModal.show();
  }

  $('#linkModal').addEventListener('shown.bs.modal', () => $('#linkName').focus());

  $('#linkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameIn = $('#linkName'), urlIn = $('#linkUrl');
    const name = nameIn.value.trim();
    const url = normalizeUrl(urlIn.value);
    setInvalid(nameIn, name ? null : 'Enter a name.');
    setInvalid(urlIn, url.ok ? null : url.error);
    if (!name || !url.ok) return;

    const destId = $('#linkPanel').value;
    if (linkCtx.linkId) {
      const src = findPanel(linkCtx.fromPanelId);
      const link = src.links.find((l) => l.id === linkCtx.linkId);
      link.name = name;
      link.url = url.value;
      link.icon = linkIcon.get();
      if (destId !== src.id) moveLink(link.id, destId, null, true);
    } else {
      findPanel(destId).links.push({ id: uid(), name, url: url.value, icon: linkIcon.get() });
    }
    save();
    render();
    linkModal.hide();
  });

  // ---------- panel dialog ----------

  const panelModal = bootstrap.Modal.getOrCreateInstance($('#panelModal'));
  let panelCtx = null;

  function currentPanelColors() {
    const bg = $('#panelBg').value;
    const custom = $('#textCustom').checked;
    return { bg, fg: custom ? $('#panelText').value : autoText(bg), custom };
  }

  function updatePanelPreview() {
    const { bg, fg, custom } = currentPanelColors();
    $('#panelText').disabled = !custom;
    const prev = $('#panelPreview');
    prev.style.backgroundColor = bg;
    prev.style.color = fg;
    const ic = panelIcon.get();
    prev.replaceChildren(...[ic && h('i', { class: 'bi bi-' + ic }), $('#panelTitle').value.trim() || 'Preview'].filter(Boolean));
  }

  const panelIcon = createIconPicker($('#panelIconPicker'), updatePanelPreview);

  function openPanelDialog(panelId) {
    const p = panelId ? findPanel(panelId) : null;
    panelCtx = { panelId };
    $('#panelModalTitle').textContent = p ? 'Edit panel' : 'New panel';
    const gsel = $('#panelGroup');
    gsel.replaceChildren(...state.groups.map((g) => h('option', { value: g.id }, g.name)));
    gsel.value = state.activeId;
    $('#panelTitle').value = p ? p.title : 'New Panel';
    $('#panelDesc').value = p ? p.description : '';
    $('#panelDescPos').value = p ? p.descPos : 'top';
    $('#panelBg').value = p ? p.bg : DEFAULT_BG;
    $('#textAuto').checked = !(p && p.textColor);
    $('#textCustom').checked = !!(p && p.textColor);
    $('#panelText').value = p && p.textColor ? p.textColor : autoText(p ? p.bg : DEFAULT_BG);
    setInvalid($('#panelTitle'), null);
    panelIcon.set(p ? p.icon : null);
    updatePanelPreview();
    panelModal.show();
  }

  $('#panelModal').addEventListener('shown.bs.modal', () => { $('#panelTitle').focus(); $('#panelTitle').select(); });
  ['input', 'change'].forEach((ev) => $('#panelForm').addEventListener(ev, (e) => {
    // Switching the background while on Auto keeps the custom picker's starting color sensible.
    if (e.target.id === 'panelBg' && !$('#textCustom').checked) $('#panelText').value = autoText($('#panelBg').value);
    updatePanelPreview();
  }));

  $('#panelForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#panelTitle').value.trim();
    setInvalid($('#panelTitle'), title ? null : 'Enter a title.');
    if (!title) return;
    const { bg, custom } = currentPanelColors();
    const description = $('#panelDesc').value.trim();
    const descPos = $('#panelDescPos').value;
    const textColor = custom ? $('#panelText').value : null;
    const destGroup = state.groups.find((g) => g.id === $('#panelGroup').value);
    let moved = false;
    if (panelCtx.panelId) {
      const panel = findPanel(panelCtx.panelId);
      Object.assign(panel, { title, bg, textColor, icon: panelIcon.get(), description, descPos });
      if (destGroup !== curGroup()) {
        const src = curGroup().panels;
        src.splice(src.indexOf(panel), 1);
        destGroup.panels.push(panel);
        moved = true;
      }
    } else {
      destGroup.panels.push({ id: uid(), title, bg, textColor, icon: panelIcon.get(), description, descPos, links: [] });
      if (destGroup !== curGroup()) state.activeId = destGroup.id;
    }
    save();
    render();
    panelModal.hide();
    if (moved) toast('Moved "' + title + '" to ' + destGroup.name + '.');
  });

  // ---------- group dialog ----------

  const groupModal = bootstrap.Modal.getOrCreateInstance($('#groupModal'));
  let groupCtx = null;

  function openGroupDialog(groupId) {
    const g = groupId ? state.groups.find((x) => x.id === groupId) : null;
    groupCtx = { groupId };
    $('#groupModalTitle').textContent = g ? 'Rename group' : 'New group';
    $('#groupName').value = g ? g.name : '';
    setInvalid($('#groupName'), null);
    groupModal.show();
  }

  $('#groupModal').addEventListener('shown.bs.modal', () => { $('#groupName').focus(); $('#groupName').select(); });

  $('#groupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#groupName').value.trim();
    setInvalid($('#groupName'), name ? null : 'Enter a name.');
    if (!name) return;
    if (groupCtx.groupId) {
      state.groups.find((g) => g.id === groupCtx.groupId).name = name;
    } else {
      const g = { id: uid(), name, panels: [] };
      state.groups.push(g);
      state.activeId = g.id;
    }
    save();
    render();
    groupModal.hide();
  });

  // ---------- page title dialog ----------

  const titleModal = bootstrap.Modal.getOrCreateInstance($('#titleModal'));

  $('#titleModal').addEventListener('shown.bs.modal', () => { $('#siteTitleInput').focus(); $('#siteTitleInput').select(); });

  $('#titleForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#siteTitleInput');
    const value = input.value.trim();
    setInvalid(input, value ? null : 'Enter a title.');
    if (!value) return;
    state.title = cleanTitle(value);
    save();
    render();
    titleModal.hide();
  });

  // ---------- export / import ----------

  function exportJson() {
    state.lastExported = new Date().toISOString();
    const out = {
      version: 2,
      title: state.title,
      exportedAt: state.lastExported,
      exportedFrom: location.href,
      groups: state.groups.map((g) => ({
        name: g.name,
        panels: g.panels.map((p) => ({
          title: p.title, bg: p.bg, textColor: p.textColor, icon: p.icon, description: p.description, descPos: p.descPos,
          links: p.links.map((l) => ({ name: l.name, url: l.url, icon: l.icon })),
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'startpage-' + state.lastExported.slice(0, 10) + '.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    save();
    render();
    toast('Exported ' + countPanels(state.groups) + ' panel(s) in ' + state.groups.length + ' group(s).');
  }

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let groups, title;
    try {
      const parsed = JSON.parse(await file.text());
      groups = sanitizeData(parsed);
      title = cleanTitle(parsed.title);
    } catch (err) {
      toast('Import failed: ' + (err instanceof SyntaxError ? 'that file is not valid JSON.' : err.message) + ' Nothing was changed.', { variant: 'danger', delay: 8000 });
      return;
    }
    const linkCount = groups.reduce((n, g) => n + g.panels.reduce((m, p) => m + p.links.length, 0), 0);
    const ok = await confirmDialog({
      title: 'Replace everything?',
      body: 'This will replace your current setup (' + state.groups.length + ' group(s), ' + countPanels(state.groups) + ' panel(s)) with the file\'s ' + groups.length + ' group(s), ' + countPanels(groups) + ' panel(s) and ' + linkCount + ' link(s). Consider exporting first.',
      okText: 'Replace',
    });
    if (!ok) return;
    state.groups = groups;
    state.title = title;
    state.activeId = groups[0].id;
    editMode = false;
    save();
    render();
    toast('Imported ' + groups.length + ' group(s).');
  });

  // ---------- clicks ----------

  document.addEventListener('click', async (e) => {
    if (editMode && e.target.closest('a.link-name')) { e.preventDefault(); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const col = btn.closest('[data-panel-id]');
    const panel = col ? findPanel(col.dataset.panelId) : null;
    const li = btn.closest('[data-link-id]');

    switch (btn.dataset.action) {
      case 'toggle-edit': editMode = !editMode; render(); break;
      case 'new-panel': openPanelDialog(null); break;
      case 'title-edit': $('#siteTitleInput').value = state.title; setInvalid($('#siteTitleInput'), null); titleModal.show(); break;
      case 'add-link-global': openLinkDialog({ panelId: curGroup().panels[0].id }); break;
      case 'group-select': state.activeId = btn.closest('[data-group-id]').dataset.groupId; save(); render(); break;
      case 'group-add': openGroupDialog(null); break;
      case 'group-edit': openGroupDialog(btn.closest('[data-group-id]').dataset.groupId); break;
      case 'group-left':
      case 'group-right': {
        const i = state.groups.findIndex((g) => g.id === btn.closest('[data-group-id]').dataset.groupId);
        moveInArray(state.groups, i, i + (btn.dataset.action === 'group-left' ? -1 : 1));
        save(); render(); break;
      }
      case 'group-delete': {
        const i = state.groups.findIndex((g) => g.id === btn.closest('[data-group-id]').dataset.groupId);
        const g = state.groups[i];
        if (state.groups.length === 1) break;
        if (g.panels.length) {
          const ok = await confirmDialog({
            title: 'Delete group?',
            body: 'Delete "' + g.name + '" with its ' + g.panels.length + ' panel(s) and all their links? This cannot be undone.',
            okText: 'Delete',
          });
          if (!ok) break;
        }
        state.groups.splice(i, 1);
        if (state.activeId === g.id) state.activeId = state.groups[Math.min(i, state.groups.length - 1)].id;
        save(); render(); break;
      }
      case 'export': exportJson(); break;
      case 'import': $('#importFile').click(); break;
      case 'link-add': openLinkDialog({ panelId: panel.id }); break;
      case 'panel-edit': openPanelDialog(panel.id); break;
      case 'panel-up':
      case 'panel-down': {
        const i = curGroup().panels.indexOf(panel);
        moveInArray(curGroup().panels, i, i + (btn.dataset.action === 'panel-up' ? -1 : 1));
        save(); render(); break;
      }
      case 'panel-delete': {
        if (panel.links.length) {
          const ok = await confirmDialog({
            title: 'Delete panel?',
            body: 'Delete "' + panel.title + '" and its ' + panel.links.length + ' link(s)? This cannot be undone.',
            okText: 'Delete',
          });
          if (!ok) break;
        }
        curGroup().panels = curGroup().panels.filter((p) => p !== panel);
        save(); render(); break;
      }
      case 'link-edit': openLinkDialog({ panelId: panel.id, linkId: li.dataset.linkId }); break;
      case 'link-up':
      case 'link-down': {
        const i = panel.links.findIndex((l) => l.id === li.dataset.linkId);
        moveInArray(panel.links, i, i + (btn.dataset.action === 'link-up' ? -1 : 1));
        save(); render(); break;
      }
      case 'link-delete': {
        const idx = panel.links.findIndex((l) => l.id === li.dataset.linkId);
        const [removed] = panel.links.splice(idx, 1);
        const panelId = panel.id;
        save(); render();
        toast('Deleted "' + removed.name + '".', {
          action: 'Undo',
          onAction: () => {
            const p = findPanel(panelId);
            if (!p) return;
            p.links.splice(Math.min(idx, p.links.length), 0, removed);
            save(); render();
          },
          delay: 6000,
        });
        break;
      }
    }
  });

  // ---------- drag and drop (desktop) ----------

  const DROP_CLASSES = ['drop-left', 'drop-right', 'drop-top', 'drop-bottom', 'drop-end'];

  function clearDrag() {
    document.querySelectorAll('.' + DROP_CLASSES.join(',.')).forEach((el) => el.classList.remove(...DROP_CLASSES));
    document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  }

  function resolveDrop(e) {
    if (!drag || drag.type === 'group') return null;
    const col = e.target.closest && e.target.closest('[data-panel-id]');
    if (!col) return null;
    if (drag.type === 'panel') {
      if (col.dataset.panelId === drag.id) return null;
      const r = col.getBoundingClientRect();
      const horizontal = r.width < rootEl.clientWidth * 0.9;
      const after = horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      return { kind: 'panel', el: col.firstElementChild, targetId: col.dataset.panelId, after, horizontal };
    }
    const li = e.target.closest('.link-item');
    if (li) {
      if (li.dataset.linkId === drag.id) return null;
      const r = li.getBoundingClientRect();
      return { kind: 'link', el: li, panelId: col.dataset.panelId, targetId: li.dataset.linkId, after: e.clientY > r.top + r.height / 2 };
    }
    return { kind: 'link-end', el: col.querySelector('.links'), panelId: col.dataset.panelId };
  }

  rootEl.addEventListener('dragstart', (e) => {
    if (!editMode) return;
    const handle = e.target.closest('[data-drag="panel"]');
    const li = e.target.closest('.link-item');
    if (handle) {
      const col = handle.closest('[data-panel-id]');
      drag = { type: 'panel', id: col.dataset.panelId };
      e.dataTransfer.setDragImage(col.firstElementChild, 20, 20);
      col.classList.add('dragging');
    } else if (li) {
      drag = { type: 'link', id: li.dataset.linkId };
      li.classList.add('dragging');
    } else {
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', drag.id);
  });

  rootEl.addEventListener('dragover', (e) => {
    const t = resolveDrop(e);
    if (!t) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.' + DROP_CLASSES.join(',.')).forEach((el) => el.classList.remove(...DROP_CLASSES));
    if (t.kind === 'panel') t.el.classList.add(t.horizontal ? (t.after ? 'drop-right' : 'drop-left') : (t.after ? 'drop-bottom' : 'drop-top'));
    else if (t.kind === 'link') t.el.classList.add(t.after ? 'drop-bottom' : 'drop-top');
    else t.el.classList.add('drop-end');
  });

  rootEl.addEventListener('drop', (e) => {
    const t = resolveDrop(e);
    if (!t) return;
    e.preventDefault();
    if (t.kind === 'panel') movePanel(drag.id, t.targetId, t.after);
    else if (t.kind === 'link') moveLink(drag.id, t.panelId, t.targetId, t.after);
    else moveLink(drag.id, t.panelId, null, true);
    drag = null;
    clearDrag();
    save();
    render();
  });

  rootEl.addEventListener('dragend', () => { drag = null; clearDrag(); });

  // Re-ordering Groups: drag a tab onto another tab.
  const tabsEl = $('#groupTabs');

  function resolveTabDrop(e) {
    if (!drag || drag.type !== 'group') return null;
    const li = e.target.closest('[data-group-id]');
    if (!li || li.dataset.groupId === drag.id) return null;
    const r = li.getBoundingClientRect();
    return { el: li, targetId: li.dataset.groupId, after: e.clientX > r.left + r.width / 2 };
  }

  tabsEl.addEventListener('dragstart', (e) => {
    const li = editMode && e.target.closest && e.target.closest('[data-group-id]');
    if (!li) return;
    drag = { type: 'group', id: li.dataset.groupId };
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', drag.id);
  });

  tabsEl.addEventListener('dragover', (e) => {
    const t = resolveTabDrop(e);
    if (!t) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.drop-left,.drop-right').forEach((el) => el.classList.remove('drop-left', 'drop-right'));
    t.el.classList.add(t.after ? 'drop-right' : 'drop-left');
  });

  tabsEl.addEventListener('drop', (e) => {
    const t = resolveTabDrop(e);
    if (!t) return;
    e.preventDefault();
    const [g] = state.groups.splice(state.groups.findIndex((x) => x.id === drag.id), 1);
    state.groups.splice(state.groups.findIndex((x) => x.id === t.targetId) + (t.after ? 1 : 0), 0, g);
    drag = null;
    clearDrag();
    save();
    render();
  });

  tabsEl.addEventListener('dragend', () => { drag = null; clearDrag(); });

  // ---------- tooltips ----------
  // Any element with data-tip gets a Bootstrap tooltip. The DOM is rebuilt often,
  // so tooltips are created on demand and cleared whenever they could be orphaned.

  // One tooltip at a time. It is disposed (not just hidden) so a re-render or
  // click can never leave an instance that believes it is still showing.
  let tipEl = null;
  let tipInst = null;

  function hideTips() {
    if (tipInst) tipInst.dispose();
    tipInst = tipEl = null;
    document.querySelectorAll('.tooltip').forEach((t) => t.remove());
  }

  function showTip(el) {
    if (el === tipEl) return;
    hideTips();
    tipEl = el;
    tipInst = new bootstrap.Tooltip(el, { title: el.dataset.tip, trigger: 'manual', placement: 'bottom', container: 'body', animation: false });
    tipInst.show();
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && !el.disabled) showTip(el);
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    // Moving between an element's own children (e.g. its icon) is not leaving it.
    if (el && !el.contains(e.relatedTarget)) hideTips();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && el.matches(':focus-visible')) showTip(el);
  });
  document.addEventListener('focusout', hideTips);
  document.addEventListener('click', hideTips, true);
  document.addEventListener('dragstart', hideTips);

  // ---------- init ----------

  load();
  if (!state.groups.length) {
    state.groups.push({ id: uid(), name: 'Home', panels: [] });
    state.activeId = state.groups[0].id;
  }
  render();
})();
