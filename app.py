from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from flask import Flask, render_template, request, send_file
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024

AUDIO_EXTS = {
    ".mp3",
    ".wav",
    ".flac",
    ".ogg",
    ".oga",
    ".opus",
    ".m4a",
    ".aac",
    ".wma",
    ".aiff",
    ".aif",
    ".amr",
    ".webm",
    ".mka",
}


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def allowed_audio(filename: str) -> bool:
    return Path(filename).suffix.lower() in AUDIO_EXTS


def build_command(src: str, dst: str, bitrate: str, image_path: str | None, black_mode: bool, size: str) -> list[str]:
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    audio = ["-c:a", "aac", "-b:a", bitrate]
    tail = ["-movflags", "+faststart", str(dst)]

    if image_path:
        return cmd + [
            "-loop", "1", "-framerate", "2", "-i", image_path,
            "-i", str(src),
            "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            *audio, "-shortest", *tail,
        ]

    if black_mode:
        return cmd + [
            "-f", "lavfi", "-i", f"color=c=black:s={size}:r=2",
            "-i", str(src),
            "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            *audio, "-shortest", *tail,
        ]

    return cmd + ["-i", str(src), "-vn", *audio, *tail]


@app.route("/", methods=["GET", "POST"])
def index():
    if not ffmpeg_available():
        return render_template("index.html", error="ffmpeg is not installed or not on your PATH. Install ffmpeg first.")

    if request.method == "GET":
        return render_template("index.html")

    files = request.files.getlist("audio_files")
    if not files or not any(file.filename for file in files):
        return render_template("index.html", error="Please upload at least one audio file.")

    bitrate = request.form.get("bitrate", "192k")
    black_mode = request.form.get("background_type") == "black"
    size = request.form.get("size", "1280x720")
    image_file = request.files.get("image_file")
    image_path = None

    if request.form.get("background_type") == "image" and image_file and image_file.filename:
        image_path = os.path.join(tempfile.mkdtemp(prefix="audio_to_mp4_image_"), secure_filename(image_file.filename))
        image_file.save(image_path)

    temp_dir = tempfile.mkdtemp(prefix="audio_to_mp4_")
    converted_files = []
    errors = []

    try:
        for upload in files:
            filename = upload.filename
            if not filename:
                continue
            if not allowed_audio(filename):
                errors.append(f"Unsupported file type: {filename}")
                continue

            safe_name = secure_filename(filename)
            src_path = Path(temp_dir) / safe_name
            upload.save(src_path)
            dst_path = Path(temp_dir) / f"{src_path.stem}.mp4"

            cmd = build_command(str(src_path), str(dst_path), bitrate, image_path, black_mode, size)
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                error_text = result.stderr.strip() or result.stdout.strip() or "Unknown ffmpeg error"
                errors.append(f"Failed: {safe_name} — {error_text}")
            else:
                converted_files.append(dst_path)

        if not converted_files:
            return render_template("index.html", error="No files were converted successfully.", details="<br>".join(errors))

        if len(converted_files) == 1:
            response = send_file(converted_files[0], as_attachment=True, download_name=converted_files[0].name)
            response.call_on_close(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
            if image_path and os.path.exists(image_path):
                os.remove(image_path)
            return response

        archive_path = Path(temp_dir) / "converted_mp4s.zip"
        with zipfile.ZipFile(archive_path, "w") as archive:
            for file_path in converted_files:
                archive.write(file_path, arcname=file_path.name)

        response = send_file(archive_path, as_attachment=True, download_name="converted_mp4s.zip")
        response.call_on_close(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
        if image_path and os.path.exists(image_path):
            os.remove(image_path)
        return response
    finally:
        if image_path and os.path.exists(image_path):
            os.remove(image_path)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)






































































































































































































































