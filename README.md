# Audio to MP4 Converter

A small Flask web app that converts uploaded audio files to MP4 using `ffmpeg`.

## Features
- Upload one or many audio files
- Convert to MP4 using AAC audio
- Optional image background for YouTube-style cover videos
- Optional black video background
- Optional bitrate and black video size controls
- Download converted file(s) directly from the browser

## Requirements
- Python 3.10+
- ffmpeg installed and available on your PATH

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Install ffmpeg:

- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: install from https://ffmpeg.org/download.html and add it to PATH

## Run it

```bash
python app.py
```

Then open:
- http://localhost:5000

## Deploy
This is a Flask app, so it can be deployed to:
- Render
- Railway
- Fly.io
- a VPS

GitHub Pages is not suitable for this because ffmpeg needs to run on a server.

## Notes
The app uses the same conversion logic as the Python CLI script you supplied, wrapped in a simple browser interface.
