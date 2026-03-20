# PDF Layer Explorer

A static web app for viewing large layered PDFs and quickly toggling layer visibility.

## Features

- Upload a PDF directly in the browser
- Fast single-page rendering (good for large PDFs)
- Zoom controls: slider, buttons, fit-page, 100%
- Pan by dragging
- Layer panel with fast filtering and bulk actions
- Filter updates as you type, with shown/total layer counter
- Shift+Click layer range selection
- Keyboard-first layer workflow (Arrow up/down, H/S hide/show selected)
- Show/Hide selected layers in one action
- Optional layer color estimation (average color per layer on current page)
- Export visible result to PDF with selectable paper size and orientation (A4/A3 standing/lying)

## Run

Use a local static server (recommended):

```powershell
cd hide_layers_in_pdf
python -m http.server 8000
```

Then open:

- http://localhost:8000

## Notes

- Layer controls depend on Optional Content Groups (OCGs) in the PDF.
- If a PDF has no OCGs, the layer list will be empty.
- Color estimation is approximate and based on rendered pixels on the current page.
- Export creates a new PDF from rendered page images using current layer visibility.
- On supported browsers, export uses a native Save dialog to choose folder and filename.

## Keyboard shortcuts

- Left arrow: previous page
- Right arrow: next page
- `+` / `=`: zoom in
- `-`: zoom out
- Up/Down arrow: move layer focus/selection
- Shift + Up/Down: extend layer selection range
- `H`: hide selected layers
- `S`: show selected layers
- Ctrl/Cmd + A: select all filtered layers
- Esc: clear selection (and close view menu if open)
