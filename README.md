# Audio to MP4

A browser-based app that converts audio files to MP4 using FFmpeg WebAssembly (FFmpeg.wasm). It is designed for GitHub Pages, so no backend server is required.

## Features
- Upload one or more audio files
- Drag and drop support
- Convert to MP4 in the browser
- Audio-only MP4 output
- Optional black background video
- Optional still-image background track
- Download generated MP4 files directly

## Notes
This app runs in the browser, so it is slower and more memory-intensive than a native command-line ffmpeg conversion. Large files may take longer or run into browser limits.

## Usage
1. Open the site in a browser.
2. Select one or more audio files, or drag them onto the page.
3. Pick the conversion mode.
4. Click Convert to MP4.
5. Download the generated MP4 files.

## Deployment
This project is static and can be published directly to GitHub Pages. No server or backend is needed.

## Local development
Because it is static HTML/JavaScript, you can also run it locally with a simple static server if desired:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Important limitation
Browser-based conversion cannot match the full speed and memory of desktop ffmpeg. For very large audio files or many files at once, a native install of ffmpeg is the better option.
