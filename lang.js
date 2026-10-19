/* ── EN | FR LANGUAGE SWITCH ──────────────────────────────────────────────────
   Light 4 Refugee — one page file, two languages.
   - English is the page itself. Nothing extra is downloaded for English visitors except this tiny file.
   - French lives in i18n/<page>.fr.json and is only downloaded when someone picks FR.
   - The choice is remembered in the browser (never crashes if the browser blocks storage).
   - A link like  contact-us.html?lang=fr  opens that page in French (good for sharing).
   - Any text that has no French yet simply stays in English, so editing a page never breaks it.
   - Maintenance helper: open the page in French, press F12, type  L4R_LANG.missing()  to list untranslated text.
   Set FOLLOW_BROWSER to true to open in French automatically for visitors whose browser is set to French. */
(function () {
  'use strict';
  var KEY = 'lang', FOLLOW_BROWSER = false, WAIT_MS = 2500;
  var root = document.documentElement;
  var me = document.currentScript || document.querySelector('script[src*="lang.js"]');
  var src = me ? me.src : '';
  var BASE = src.replace(/[^\/]*$/, '');
  var VER = (src.split('?')[1] || '');

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function wanted() {
    var m = /[?&]lang=(en|fr)\b/.exec(location.search);
    if (m) { write(m[1]); return m[1]; }
    var s = read();
    if (s === 'fr' || s === 'en') return s;
    if (FOLLOW_BROWSER && /^fr/i.test(navigator.language || '')) return 'fr';
    return 'en';
  }
  function pageKey() {
    var p = location.pathname.replace(/\/+$/, '').split('/').pop() || 'index';
    p = p.replace(/\.html?$/i, '');
    return p || 'index';
  }

  /* ---------- which parts of a page are text ---------- */
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, TEXTAREA: 1, IFRAME: 1, CODE: 1, PRE: 1, CANVAS: 1, TEMPLATE: 1 };
  var INLINE = { A: 1, ABBR: 1, B: 1, BDI: 1, BDO: 1, CITE: 1, EM: 1, I: 1, MARK: 1, SMALL: 1, SPAN: 1, STRONG: 1, SUB: 1, SUP: 1, U: 1, TIME: 1, WBR: 1, BR: 1, SVG: 1, IMG: 1, INPUT: 1, LABEL: 1 };
  var LETTERS = /[A-Za-zÀ-ɏ]{2}/;
  var ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];

  function skip(el) {
    return !el || SKIP[el.tagName.toUpperCase()] || !!(el.closest && el.closest('[translate="no"],.notranslate'));
  }
  function skipAttr(el) { return !el || !!(el.closest && el.closest('[translate="no"],.notranslate')); }
  function hasText(el) { return LETTERS.test(el.textContent || ''); }
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }

  /* A "unit" is an element holding its own text plus only small inline pieces (links, bold, icons...).
     Translating the whole unit at once lets the French reorder words around a link or bold word. */
  function isUnit(el) {
    var direct = false, i, n;
    for (i = 0; i < el.childNodes.length; i++) {
      n = el.childNodes[i];
      if (n.nodeType === 3) { if (LETTERS.test(n.nodeValue)) direct = true; }
      else if (n.nodeType === 1 && !INLINE[n.tagName.toUpperCase()]) return false;
    }
    return direct;
  }

  /* Turns a unit into a key such as:  Read our <e1>story</e1> now<x2/>   (links/icons become numbered markers) */
  function ser(el) {
    var s = '', i, n;
    for (i = 0; i < el.childNodes.length; i++) {
      n = el.childNodes[i];
      if (n.nodeType === 3) s += esc(n.nodeValue);
      else if (n.nodeType === 1) {
        var t = n.tagName.toUpperCase();
        if (t === 'BR') s += '<br>';
        else if (t === 'WBR') { /* ignore */ }
        else if (SKIP[t] || !hasText(n)) s += '<x' + idx(el, n) + '/>';
        else s += '<e' + idx(el, n) + '>' + ser(n) + '</e' + idx(el, n) + '>';
      }
    }
    return s;
  }
  function idx(parent, child) {
    var k = 0, i;
    for (i = 0; i < parent.childNodes.length; i++) {
      if (parent.childNodes[i] === child) return k;
      if (parent.childNodes[i].nodeType === 1) k++;
    }
    return k;
  }
  function elKids(el) { return Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 1; }); }

  /* ---------- state ---------- */
  var extracting = false, dict = null, active = false, obs = null, queue = [], raf = 0;
  var savedEl = new Map();    // element -> {orig:[nodes], made:[nodes]}
  var savedTx = new Map();    // text node -> {orig, made}
  var savedAt = [];
  var savedVal = [];          // <option> tags that had no value (we pin their English value so forms still send English)           // [el, attr, original]
  var missed = {};
  var origTitle = document.title;

  /* ---------- reading the French ---------- */
  function tokens(fr) {
    var out = [], re = /<(\/?)(e\d+|x\d+|br)(\/?)>|([^<]+)/g, m;
    while ((m = re.exec(fr))) {
      if (m[4] !== undefined) out.push({ t: 'txt', v: unesc(m[4]) });
      else if (m[2] === 'br') out.push({ t: 'br' });
      else if (m[2].charAt(0) === 'x') out.push({ t: 'x', i: +m[2].slice(1) });
      else out.push({ t: m[1] ? 'close' : 'open', i: +m[2].slice(1) });
    }
    return out;
  }
  function signature(str) { return (str.match(/<(e|x)\d+\/?>/g) || []).sort().join(''); }

  function applyUnit(el, key, fr) {
    var kids = elKids(el);
    if (signature(key.replace(/<\/e/g, '<e')) !== signature(fr.replace(/<\/e/g, '<e'))) { fail(key); return false; }
    var toks = tokens(fr), stack = [{ el: el, nodes: [], kids: kids }], i, tk, top, node;
    var saves = [];
    for (i = 0; i < toks.length; i++) {
      tk = toks[i]; top = stack[stack.length - 1];
      if (tk.t === 'txt') top.nodes.push(document.createTextNode(tk.v));
      else if (tk.t === 'br') top.nodes.push(document.createElement('br'));
      else if (tk.t === 'x') { node = top.kids[tk.i]; if (!node) return fail(key); top.nodes.push(node); }
      else if (tk.t === 'open') { node = top.kids[tk.i]; if (!node) return fail(key); stack.push({ el: node, nodes: [], kids: elKids(node) }); }
      else { var done = stack.pop(); if (!stack.length) return fail(key); stack[stack.length - 1].nodes.push(done.el); saves.push(done); }
    }
    if (stack.length !== 1) return fail(key);
    saves.push(stack[0]);
    saves.forEach(function (s) {
      var cur = savedEl.get(s.el);
      var orig = (cur && sameKids(s.el, cur.made)) ? cur.orig : Array.prototype.slice.call(s.el.childNodes);
      while (s.el.firstChild) s.el.removeChild(s.el.firstChild);
      s.nodes.forEach(function (n) { s.el.appendChild(n); });
      savedEl.set(s.el, { orig: orig, made: s.nodes.slice() });
    });
    return true;
  }
  function sameKids(el, list) {
    if (el.childNodes.length !== list.length) return false;
    for (var i = 0; i < list.length; i++) if (el.childNodes[i] !== list[i]) return false;
    return true;
  }
  function fail(key) { if (window.console) console.warn('[lang] could not place French for:', key.slice(0, 80)); return false; }

  /* exact match first; then patterns such as  "Reference {0}"  (the {0} part is copied across) */
  var pats = null;
  function buildPats() {
    pats = [];
    Object.keys(dict).forEach(function (k) {
      if (k.indexOf('{0}') < 0) return;
      var parts = k.split('{0}').map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      pats.push({ re: new RegExp('^' + parts.join('(.+?)') + '$'), fr: dict[k] });
    });
  }
  function lookup(key) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    if (pats === null) buildPats();
    for (var i = 0; i < pats.length; i++) {
      var m = pats[i].re.exec(key);
      if (m) return pats[i].fr.replace('{0}', function () { return m[1]; });
    }
    /* messages the page builds from several sentences: translate sentence by sentence */
    if (/[.!?]\s+\S/.test(key)) {
      var bits = key.replace(/([.!?])\s+/g, '$1\u0001').split('\u0001'), hit = 0, out = bits.map(function (b) {
        var f = Object.prototype.hasOwnProperty.call(dict, b) ? dict[b] : undefined;
        if (f === undefined) { for (var j = 0; j < pats.length; j++) { var mm = pats[j].re.exec(b); if (mm) { f = pats[j].fr.replace('{0}', function () { return mm[1]; }); break; } } }
        if (f !== undefined) { hit++; return f; }
        return b;
      });
      if (hit) return out.join(' ');
    }
    return undefined;
  }

  function doText(node, quiet) {
    var raw = node.nodeValue, key = norm(raw);
    if (!key || !LETTERS.test(key)) return;
    var sv = savedTx.get(node);
    if (sv && sv.made === raw) return;                 // already French
    var fr = lookup(esc(key));
    if (fr === undefined) { if (!quiet) missed[esc(key)] = 1; return; }
    var lead = /^\s/.test(raw) ? ' ' : '', trail = /\s$/.test(raw) ? ' ' : '';
    var made = lead + unesc(fr) + trail;
    savedTx.set(node, { orig: raw, made: made });
    node.nodeValue = made;
  }

  function walk(el, quiet) {
    if (!el || el.nodeType !== 1 || skip(el)) return;
    var cur = savedEl.get(el);
    if (cur && sameKids(el, cur.made)) return;         // this unit is already French
    if (isUnit(el)) {
      if (!extracting && el.tagName === 'OPTION' && !el.hasAttribute('value')) { savedVal.push(el); el.setAttribute('value', el.value); }  // keep what the form sends in English
      var key = norm(ser(el));
      if (LETTERS.test(key)) {
        var fr = lookup(key);
        if (fr !== undefined) {
          var raw = ser(el);
          var ok = applyUnit(el, key, fr.replace(/^\s+|\s+$/g, ''));
          if (ok) {
            var kids = el.childNodes;
            if (/^\s/.test(raw) && kids[0] && kids[0].nodeType === 3) kids[0].nodeValue = ' ' + kids[0].nodeValue;
            if (/\s$/.test(raw) && kids[kids.length - 1] && kids[kids.length - 1].nodeType === 3) kids[kids.length - 1].nodeValue += ' ';
            var c2 = savedEl.get(el); if (c2) c2.made = Array.prototype.slice.call(el.childNodes);
            return;
          }
        } else { if (!quiet) missed[key] = 1; if (extracting) return; quiet = true; }
      }
    }
    var i, n, kidsNow = Array.prototype.slice.call(el.childNodes);
    for (i = 0; i < kidsNow.length; i++) {
      n = kidsNow[i];
      if (n.nodeType === 3) doText(n, quiet);
      else if (n.nodeType === 1) walk(n, quiet);
    }
  }

  function doAttrs(scope) {
    var els = scope.querySelectorAll ? scope.querySelectorAll('[alt],[title],[placeholder],[aria-label],input[type=submit],input[type=button]') : [];
    var list = Array.prototype.slice.call(els);
    if (scope.nodeType === 1) list.unshift(scope);
    list.forEach(function (el) {
      if (skipAttr(el)) return;
      ATTRS.forEach(function (a) {
        var v = el.getAttribute && el.getAttribute(a);
        if (!v || !LETTERS.test(v)) return;
        var fr = lookup(esc(norm(v)));
        if (fr === undefined) { missed[esc(norm(v))] = 1; return; }
        savedAt.push([el, a, v]); el.setAttribute(a, unesc(fr));
      });
      if (el.tagName === 'INPUT' && /^(submit|button)$/i.test(el.type) && el.value) {
        var f2 = lookup(esc(norm(el.value)));
        if (f2 !== undefined) { savedAt.push([el, 'value', el.value]); el.value = unesc(f2); }
      }
    });
  }
  function doHead() {
    var t = lookup(esc(norm(origTitle)));
    if (t !== undefined) document.title = unesc(t);
    document.querySelectorAll('meta[name="description"],meta[name="keywords"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(function (m) {
      var v = m.getAttribute('content'), fr = v && lookup(esc(norm(v)));
      if (fr !== undefined && fr) { savedAt.push([m, 'content', v]); m.setAttribute('content', unesc(fr)); }
    });
  }

  /* tells other scripts (the light/dark button) that the language changed */
  function ping() { try { window.dispatchEvent(new Event('l4r-lang')); } catch (e) {} }

  function applyAll() {
    stopObs();
    walk(document.body); doAttrs(document.body); doHead();
    root.setAttribute('lang', 'fr');
    startObs();
    ping();
  }
  function restoreAll() {
    stopObs();
    savedEl.forEach(function (v, el) {
      if (!sameKids(el, v.made)) return;               // the page changed it itself; leave it
      while (el.firstChild) el.removeChild(el.firstChild);
      v.orig.forEach(function (n) { el.appendChild(n); });
    });
    savedEl.clear();
    savedTx.forEach(function (v, node) { if (node.nodeValue === v.made) node.nodeValue = v.orig; });
    savedTx.clear();
    savedAt.forEach(function (a) { if (a[0].setAttribute) { if (a[1] === 'value') a[0].value = a[2]; else a[0].setAttribute(a[1], a[2]); } });
    savedAt = [];
    savedVal.forEach(function (o) { o.removeAttribute('value'); }); savedVal = [];
    document.title = origTitle;
    root.setAttribute('lang', 'en');
    ping();
  }

  /* ---------- text the page adds later (button labels, messages) ---------- */
  function startObs() {
    if (!window.MutationObserver || obs) return;
    obs = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        if (r.type === 'characterData') { var p = r.target.parentNode; if (p) queue.push(p); }
        else if (r.type === 'attributes') queue.push(r.target);
        else r.addedNodes.forEach(function (n) { queue.push(n.nodeType === 1 ? n : n.parentNode); });
      });
      if (queue.length && !raf) raf = requestAnimationFrame(flush);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'] });
  }
  function stopObs() { if (obs) { obs.disconnect(); obs = null; } queue = []; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function flush() {
    raf = 0;
    var list = queue; queue = [];
    if (!obs) return;
    obs.disconnect(); obs = null;
    list.forEach(function (n) { if (n && n.isConnected) { walk(n); doAttrs(n); } });
    startObs();
  }

  /* alert() messages written inside the pages */
  var realAlert = window.alert;
  window.alert = function (m) {
    if (active && dict && typeof m === 'string') { var f = lookup(esc(norm(m))); if (f !== undefined) m = unesc(f); }
    return realAlert.call(window, m);
  };

  /* ---------- loading the French ---------- */
  var loading = null;
  function load() {
    if (dict) return Promise.resolve(dict);
    if (loading) return loading;
    loading = fetch(BASE + 'i18n/' + pageKey() + '.fr.json' + (VER ? '?' + VER : ''), { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { dict = d; return d; })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function mark() {
    document.querySelectorAll('.lang-sw button').forEach(function (b) {
      var on = b.getAttribute('data-lang') === (active ? 'fr' : 'en');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('on', on);
    });
  }
  function ready() { root.classList.remove('fr-wait'); }

  function setLang(l, remember) {
    if (remember) write(l);
    if (l === 'fr') {
      load().then(function () { active = true; applyAll(); mark(); ready(); })
        .catch(function () { active = false; mark(); ready(); if (window.console) console.warn('[lang] French file not found for this page'); });
    } else {
      active = false; restoreAll(); mark(); ready();
    }
  }

  /* ---------- the EN | FR button ---------- */
  var css = '.lang-sw{display:inline-flex;align-items:center;height:36px;margin-left:14px;background:rgb(1,11,43);border:1.5px solid rgba(255,255,255,.35);border-top-left-radius:20px;border-bottom-right-radius:20px;overflow:hidden;flex:none}' +
    '.lang-sw button{font:700 .74rem/1 "Source Sans 3",sans-serif;letter-spacing:.6px;color:#fff;background:transparent;border:0;padding:0 11px;height:100%;cursor:pointer;opacity:.8;transition:background .2s,color .2s,opacity .2s}' +
    '.lang-sw button:hover{opacity:1;color:#f0a500}' +
    '.lang-sw button.on{background:#f0a500;color:#0d1b2e;opacity:1;cursor:default}' +
    '.lang-sw button:focus-visible{outline:2px solid #fff;outline-offset:-3px}' +
    '@media (max-width:768px){nav .nav-socials{gap:0}.lang-sw{margin-left:0;margin-right:10px}}' +
    '@media (min-width:769px) and (max-width:1200px){html[lang=fr] .nav-links a,html[lang=fr] .nav-links>li>button{padding:14px 8px;font-size:.84rem}html[lang=fr] .nav-socials{padding-right:8px}html[lang=fr] .lang-sw{margin-left:8px}}' +
    '@media (min-width:769px) and (max-width:1100px){.nav-links a,.nav-links>li>button{padding:14px 6px;font-size:.8rem}.nav-socials{padding-right:6px;gap:3px}.nav-socials .soc-btn{transform:scale(.85)}.lang-sw{margin-left:4px}}' +
    '@media (min-width:769px) and (max-width:900px){html[lang=fr] .nav-socials .soc-btn{display:none}}' +
    '@media (min-width:769px) and (max-width:830px){html[lang=fr] .nav-links a,html[lang=fr] .nav-links>li>button{padding:14px 4px;font-size:.74rem}}' +
    '@media (min-width:1201px){html[lang=fr] .nav-links a,html[lang=fr] .nav-links>li>button{white-space:nowrap}}' +
    '@media (min-width:1101px) and (max-width:1360px){html[lang=fr] .nav-links a,html[lang=fr] .nav-links>li>button{padding:14px 11px;font-size:.9rem}}' +
    '@media (max-width:560px){.group-label{flex-wrap:wrap}.group-label h3{flex-shrink:1;letter-spacing:1px}a[href^="mailto:"]{overflow-wrap:anywhere}html[lang=fr] .form-header,html[lang=fr] .form-header *{overflow-wrap:anywhere;min-width:0}}' +
    '@media (max-width:768px){.top-ctl{margin-left:auto;display:flex;align-items:center;gap:10px;flex:none}.top-ctl .lang-sw{margin:0}.top-ctl #theme-toggle{margin:0!important}html.ctl-top nav .nav-socials{display:none!important}}' +
    'html.fr-wait body{opacity:0}body{transition:opacity .15s}';
  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var box = document.createElement('div');
    box.className = 'lang-sw'; box.setAttribute('translate', 'no'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language / Langue');
    box.innerHTML = '<button type="button" data-lang="en" lang="en" title="English">EN</button><button type="button" data-lang="fr" lang="fr" title="Français">FR</button>';
    var anchor = document.getElementById('theme-toggle') || document.querySelector('[data-theme-toggle]');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor);
    else {
      var s = document.querySelector('.nav-socials');
      if (s) s.insertBefore(box, s.firstChild);
      else { box.style.cssText += ';position:fixed;top:10px;right:10px;z-index:99999'; document.body.appendChild(box); }
    }
    /* phones: EN|FR and the theme button live in the top navy bar, so they are visible without opening the menu */
    try {
      var tbIn = document.querySelector('#topbar .topbar-inner'), th = document.getElementById('theme-toggle'), mq = window.matchMedia('(max-width:768px)');
      if (tbIn && th) {
        var home = th.parentNode, homeNext = th.nextSibling, ctl = document.createElement('div');
        ctl.className = 'top-ctl';
        var place = function () {
          if (mq.matches) { ctl.appendChild(box); ctl.appendChild(th); tbIn.appendChild(ctl); document.documentElement.classList.add('ctl-top'); }
          else { home.insertBefore(th, homeNext && homeNext.parentNode === home ? homeNext : null); home.insertBefore(box, th); if (ctl.parentNode) ctl.parentNode.removeChild(ctl); document.documentElement.classList.remove('ctl-top'); }
        };
        place();
        if (mq.addEventListener) mq.addEventListener('change', place); else if (mq.addListener) mq.addListener(place);
      }
    } catch (e) {}
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-lang]');
      if (!b) return;
      var l = b.getAttribute('data-lang');
      if (l === (active ? 'fr' : 'en')) return;
      setLang(l, true);
    });
  }

  function start() {
    build(); mark();
    if (wanted() === 'fr') setLang('fr', false); else ready();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* small helper for you (the site owner) */
  window.L4R_LANG = {
    set: function (l) { setLang(l, true); },
    missing: function () { var k = Object.keys(missed); console.log(k.length + ' text pieces have no French yet:'); k.forEach(function (x) { console.log(' • ' + x); }); return k; },
    /* used when building the French files: lists every piece of text on this page */
    extract: function () {
      var keys = {};
      var save = dict; dict = {}; extracting = true;
      var oldMiss = missed; missed = {};
      walk(document.body);
      var out = Object.keys(missed);
      var t = norm(origTitle); if (LETTERS.test(t)) out.push(esc(t));
      document.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach(function (el) { if (skipAttr(el)) return; ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v && LETTERS.test(v)) out.push(esc(norm(v))); }); });
      document.querySelectorAll('input[type=submit],input[type=button]').forEach(function (el) { if (el.value && LETTERS.test(el.value)) out.push(esc(norm(el.value))); });
      document.querySelectorAll('meta[name="description"],meta[name="keywords"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(function (m) { var v = m.getAttribute('content'); if (v && LETTERS.test(v)) out.push(esc(norm(v))); });
      dict = save; missed = oldMiss; extracting = false;
      out.forEach(function (k) { keys[k] = 1; });
      return Object.keys(keys);
    }
  };
})();
