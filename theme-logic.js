/* ── LIGHT / DARK THEME ───────────────────────────────────────────────────────
   - Remembers the choice in the browser (and never crashes if the browser blocks storage).
   - Works even when the menu is loaded AFTER the page (the old version only looked for the button once,
     at page load, so a menu added later never got its click).
   - Every button with id="theme-toggle" (or data-theme-toggle) works, including a second one in a mobile menu.
   Light = the site's normal look (default). Dark = html[data-theme="dark"] in theme-style.css.
   To follow the visitor's phone/computer setting when they have not chosen yet, change FOLLOW_SYSTEM to true. */
(function () {
  var KEY = 'theme';
  var FOLLOW_SYSTEM = false;
  var root = document.documentElement;
  var BTN = '#theme-toggle, [data-theme-toggle]';

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function pick() {
    var saved = read();
    if (saved === 'light' || saved === 'dark') return saved;
    if (FOLLOW_SYSTEM && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

  var sunIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1V3c0-.55.45-1 1-1zm0 14c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1v-2c0-.55.45-1 1-1zM4.22 5.64c.39-.39 1.02-.39 1.41 0l1.41 1.41c.39.39.39 1.02 0 1.41s-1.02.39-1.41 0L4.22 7.05c-.39-.39-.39-1.02 0-1.41zm12.73 12.73c.39-.39 1.02-.39 1.41 0l1.41 1.41c.39.39.39 1.02 0 1.41s-1.02.39-1.41 0l-1.41-1.41c-.39-.39-.39-1.02 0-1.41zM2 12c0-.55.45-1 1-1h2c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1zm14 0c0-.55.45-1 1-1h2c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1zM5.64 19.78c-.39-.39-.39-1.02 0-1.41l1.41-1.41c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02.39-1.41 0zm12.73-12.73c-.39-.39-.39-1.02 0-1.41l1.41-1.41c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02.39-1.41 0z"/></svg>';
  var moonIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.75 16.25A10.05 10.05 0 0 1 12 22a10 10 0 0 1-10-10A10.05 10.05 0 0 1 7.75 2.25 1 1 0 0 1 9 3.56a8 8 0 0 0 11.44 11.44 1 1 0 0 1 1.31 1.25z"/></svg>';

  // Paint every theme button to match the current theme (safe to call as often as needed)
  function paint() {
    var dark = current() === 'dark';
    var want = dark ? 'sun' : 'moon';
    document.querySelectorAll(BTN).forEach(function (b) {
      if (b.getAttribute('data-icon') !== want) { b.innerHTML = dark ? sunIcon : moonIcon; b.setAttribute('data-icon', want); }
      var fr = root.getAttribute('lang') === 'fr';
      var label = dark ? (fr ? 'Mode clair' : 'Light Mode') : (fr ? 'Mode sombre' : 'Dark Mode');
      b.setAttribute('data-tooltip', label);
      b.setAttribute('aria-label', (fr ? 'Passer en ' : 'Switch to ') + label.toLowerCase());
      b.setAttribute('aria-pressed', dark ? 'true' : 'false');
      if (b.tagName === 'BUTTON' && !b.getAttribute('type')) b.setAttribute('type', 'button');
    });
  }

  function apply(theme, animate) {
    if (animate) { root.classList.add('theme-anim'); setTimeout(function () { root.classList.remove('theme-anim'); }, 380); }
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1524' : '#0d1b2e');
    paint();
  }

  // 1. As early as possible, before the page is drawn (no flash)
  root.setAttribute('data-theme', pick());

  // (the EN | FR switch tells us when the language changes, so the button's label follows)
  window.addEventListener('l4r-lang', function () { paint(); });

  // 2. One listener for the whole page: it catches buttons that arrive later too
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest(BTN) : null;
    if (!b) return;
    e.preventDefault();
    var next = current() === 'dark' ? 'light' : 'dark';
    write(next);
    apply(next, true);
  });

  // 3. Paint the buttons now, when the page is ready, and whenever a menu is added later
  document.addEventListener('DOMContentLoaded', paint);
  if (window.MutationObserver) {
    var queued = false;
    new MutationObserver(function () {
      if (queued) return; queued = true;
      requestAnimationFrame(function () { queued = false; paint(); });
    }).observe(root, { childList: true, subtree: true });
  }

  // 4. Keep other open tabs in step
  window.addEventListener('storage', function (e) { if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue, true); });
  // 5. Coming back with the browser's back button can show an old copy of the page
  window.addEventListener('pageshow', function (e) { if (e.persisted) apply(pick(), false); });
})();

/* ── SCROLL PROGRESS CALCULATOR ───────────────────────────────────────────── */
window.addEventListener('scroll', function() {
  const progressBar = document.getElementById('global-scroll-bar');
  if (!progressBar) return;
  
  const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
  const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  
  if (height > 0) {
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  } else {
    progressBar.style.width = '0%';
  }
});

/* ── SMART FORM LOCALSTORAGE STATE MEMORY ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  const forms = document.querySelectorAll('form');
  const pagePath = window.location.pathname;

  forms.forEach((form, formIndex) => {
    const formFields = form.querySelectorAll('input[type="text"], input[type="email"], textarea, select');

    // 1. Restore saved text drafts if they exist in the browser cache
    formFields.forEach(field => {
      const storageKey = `l4r_draft_${pagePath}_f${formIndex}_${field.id || field.name}`;
      const savedValue = localStorage.getItem(storageKey);
      if (savedValue !== null) {
        field.value = savedValue;
      }

      // 2. Listen for typing events and back up data in real-time
      field.addEventListener('input', function() {
        localStorage.setItem(storageKey, this.value);
      });
      field.addEventListener('change', function() {
        localStorage.setItem(storageKey, this.value);
      });
    });

    // 3. Wipe the cache clean when they successfully hit submit (prevents old text from getting stuck)
    form.addEventListener('submit', function() {
      formFields.forEach(field => {
        const storageKey = `l4r_draft_${pagePath}_f${formIndex}_${field.id || field.name}`;
        localStorage.removeItem(storageKey);
      });
    });
  });
});


/*THEME-PROTECT.js */
/* ============================================================
   theme-protect.js — Light 4 Refugee Content Protection
   Link at the bottom of every page's <body>, just before </body>
   Non-blocking, no framework needed, fully vanilla JS.
   ============================================================ */
(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────── */
  const SITE_NAME = 'Light 4 Refugee';
  const SITE_URL = 'https://light4refugee.org';
  const COPY_SUFFIX = '\n\n— Source: ' + SITE_NAME + '\n ' + SITE_URL;

  /* ── 1. AUTO-ATTRIBUTION ON COPY ────────────────────────── */
  document.addEventListener('copy', function (e) {
    var selected = window.getSelection ? window.getSelection().toString() : (document.selection ? document.selection.createRange().text : '');
    if (!selected || selected.trim().length < 30) return;
    try {
      var modified = selected + COPY_SUFFIX;
      e.clipboardData.setData('text/plain', modified);
      e.clipboardData.setData('text/html', '<span>' + escapeHtml(selected) + '</span><p style="font-size:11px;color:#888;margin-top:8px;">— Source: <a href="' + SITE_URL + '">' + SITE_NAME + '</a></p>');
      e.preventDefault();
    } catch (err) {}
  });

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── 2. DISABLE IMAGE DRAG ──────────────────────────────── */
  function protectImages() {
    var images = document.querySelectorAll('img');
    images.forEach(function (img) {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', function (e) { e.preventDefault(); return false; });
      img.addEventListener('contextmenu', function (e) { e.preventDefault(); return false; });
    });
  }
  protectImages();

  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) { if (m.addedNodes.length) protectImages(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ── 3. DEVTOOLS DETECTION ──────────────────────────────── */
  var devtoolsOpen = false;
  var threshold = 160;
  function checkDevTools() {
    var widthDiff = window.outerWidth - window.innerWidth > threshold;
    var heightDiff = window.outerHeight - window.innerHeight > threshold;
    if ((widthDiff || heightDiff) && !devtoolsOpen) {
      devtoolsOpen = true;
      console.log('%c👋 Hey there, developer!', 'font-size:18px;font-weight:bold;color:#f0a500;');
      console.log('%cThis site was built for Light 4 Refugee — a refugee-led NGO.\nContent and code belong to Light 4 Refugee (light4refugee.org).\nIf you\'re curious about how it was built, reach out: info@light4refugee.org', 'font-size:13px;color:#1a1a2e;background:#fff8e6;padding:8px 12px;border-left:4px solid #f0a500;');
    } else if (!widthDiff && !heightDiff) {
      devtoolsOpen = false;
    }
  }
  setInterval(checkDevTools, 1000);

  /* ── 4. PRINT PROTECTION ────────────────────────────────── */
  window.addEventListener('beforeprint', function () {
    var oldNotice = document.getElementById('l4r-print-notice');
    if (oldNotice) oldNotice.remove();
    var notice = document.createElement('div');
    notice.id = 'l4r-print-notice';
    notice.style.cssText = ['background:#0d1b2e', 'color:#f0a500', 'padding:12px 20px', 'font-family:sans-serif', 'font-size:13px', 'text-align:center', 'margin-bottom:20px'].join(';');
    notice.textContent = '© ' + new Date().getFullYear() + ' Light 4 Refugee — light4refugee.org | All rights reserved. Content may not be reproduced without permission.';
    document.body.insertBefore(notice, document.body.firstChild);
  });

  window.addEventListener('afterprint', function () {
    var notice = document.getElementById('l4r-print-notice');
    if (notice) notice.remove();
  });

  /* ── 5. INVISIBLE HONEYPOT LINK ─────────────────────────── */
  var honeypot = document.createElement('a');
  honeypot.href = '/honeypot-l4r-do-not-index';
  honeypot.setAttribute('rel', 'nofollow');
  honeypot.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
  honeypot.setAttribute('aria-hidden', 'true');
  honeypot.setAttribute('tabindex', '-1');
  honeypot.textContent = '';
  document.body.appendChild(honeypot);
})();