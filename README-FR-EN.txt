L4R website - EN / FR switch (v1)

PREVIEW OFFLINE (important)
The French files are loaded with fetch(), which browsers block when you
double-click an .html file (file://). Serve the folder instead:
  1. Open a terminal in this folder
  2. python -m http.server 8000
  3. Open http://localhost:8000/index.html  and click FR (top right)
Tip: http://localhost:8000/index.html?lang=fr opens straight in French.

HOW IT WORKS
- English pages are untouched. French is only downloaded when someone clicks FR
  (7-63 KB per page, one file per page in i18n/). English visitors download nothing extra.
- The choice is remembered (localStorage key "lang") and follows the visitor across pages.
- Form values sent to your servers (tabs, dropdowns) always stay in English.

ADDING / CHANGING TEXT LATER
- Open the page in the browser console and run:  L4R_LANG.missing()
  It lists English text that has no French yet.
- Add each one to i18n/<page>.fr.json as  "English text": "Texte français"
- Then bump the number in <script src="lang.js?v=1"> on that page (v=2, v=3...)
  so visitors' browsers fetch the fresh file.
