L4R website - EN / FR switch (v2)

PREVIEW OFFLINE (important)
The French files are loaded with fetch(), which browsers block when you
double-click an .html file (file://). Serve the folder instead:
  1. Open a terminal in this folder
  2. python -m http.server 8000
  3. Open http://localhost:8000/index.html  and click FR
Tip: http://localhost:8000/index.html?lang=fr opens straight in French.

- English visitors download nothing extra; French loads only when FR is clicked.
- Form values sent to your servers always stay in English.
- New English text with no French yet: run L4R_LANG.missing() in the browser console,
  add the line to i18n/<page>.fr.json, then bump ?v=2 to ?v=3 in that page's script tag.
