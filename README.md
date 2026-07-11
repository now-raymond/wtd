# What's the Diff

A client-side text comparison tool for quickly spotting differences between two inputs.

## Features
- Side-by-side editing and diff viewing
- Line-level diff with word-level highlights
- Change navigation (previous/next diff with current/total counter)
- Minimap with clickable/drag scrolling
- Optional synchronized pane scrolling
- Drag-and-drop file loading
- Swap panes and one-click copy
- Local autosave via `localStorage`
- Optional rich text <-> Markdown copy/paste
- Mobile layout support

## Settings
- `Paste rich text as Markdown`: converts pasted HTML/rich text (web pages, docs, etc.) into Markdown on paste.
- `Copy Markdown as rich text`: when copying, writes both plain text and rendered HTML to the clipboard.

## Quick Start
1. Open `index.html`.
2. Paste or drop text/files into both panes.
3. Switch to **View Diff** to inspect changes.

## Tech
- Vanilla HTML/CSS/JavaScript
- [`jsdiff`](https://github.com/kpdecker/jsdiff) for diffing
- [`turndown`](https://github.com/mixmark-io/turndown) for HTML -> Markdown paste conversion
- [`marked`](https://github.com/markedjs/marked) for Markdown -> HTML copy conversion

## Project Files
- `index.html` - app layout and runtime dependencies
- `app.js` - diff logic and interactions
- `style.css` - main UI styles
- `minimap.css` - minimap styles
- `samples/sample_A.txt`, `samples/sample_B.txt` - sample inputs
