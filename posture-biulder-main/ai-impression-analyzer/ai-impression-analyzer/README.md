# AI First Impression Analyzer Pro

Split version of the original single-file `final_project.html` — organized into a
proper project folder so it opens cleanly in VS Code.

## Folder structure

```
ai-impression-analyzer/
├── index.html      # Page structure (head, body, all markup)
├── css/
│   └── style.css   # All custom CSS (previously inline <style>)
├── js/
│   └── script.js   # All app logic (previously inline <script>)
└── README.md
```

## How to run in VS Code

1. Open this folder in VS Code: `File > Open Folder...`
2. Install the **Live Server** extension (if you don't have it):
   - Go to Extensions (Ctrl+Shift+X), search "Live Server", install.
3. Right-click `index.html` → **Open with Live Server**.
   - Or just double-click `index.html` to open it directly in a browser —
     it will still work since all libraries (Tailwind, Chart.js, face-api.js,
     jsPDF, html2canvas, canvas-confetti) load from CDN links in `index.html`.

## Notes

- No build step needed — this is plain HTML/CSS/JS.
- All external libraries (Tailwind CSS, FontAwesome, face-api.js, Chart.js,
  jsPDF, html2canvas, canvas-confetti) are still loaded via CDN `<script>`/`<link>`
  tags inside `index.html`'s `<head>`.
- `js/script.js` is loaded at the end of `<body>` in `index.html`.
