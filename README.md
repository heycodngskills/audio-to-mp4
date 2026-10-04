import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';

const form = document.getElementById('converter-form');
const audioInput = document.getElementById('audio-input');
const imageInput = document.getElementById('image-input');
const imageField = document.getElementById('image-field');
const bitrateInput = document.getElementById('bitrate');
const sizeInput = document.getElementById('size');
const convertButton = document.getElementById('convert-button');
const statusText = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const outputList = document.getElementById('output-list');

const ffmpeg = new FFmpeg();
let ffmpegLoaded = false;

function setStatus(message) {
  statusText.textContent = message;
}

function setProgress(value) {
  progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function toggleImageField() {
  const selectedMode = form.querySelector('input[name="background-type"]:checked').value;
  imageField.classList.toggle('hidden', selectedMode !== 'image');
}

form.querySelectorAll('input[name="background-type"]').forEach((radio) => {
  radio.addEventListener('change', toggleImageField);
});

toggleImageField();

async function loadFfmpeg() {
  if (ffmpegLoaded) return;

  setStatus('Loading FFmpeg…');
  setProgress(10);

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegLoaded = true;
  setProgress(100);
  setStatus('FFmpeg ready.');
}

function downloadLink(filename, url) {
  const item = document.createElement('div');
  item.className = 'output-item';

  const label = document.createElement('span');
  label.textContent = filename;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = 'Download';

  item.append(label, link);
  outputList.appendChild(item);
}

async function processFile(file, mode, bitrate, size) {
  const inputName = file.name.replace(/\s+/g, '_');
  const outputName = inputName.replace(/\.[^/.]+$/, '.mp4');

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  let args = ['-i', inputName, '-vn', '-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart', outputName];

  if (mode === 'black') {
    args = [
      '-f', 'lavfi',
      '-i', `color=c=black:s=${size}:r=2`,
      '-i', inputName,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', bitrate,
      '-shortest',
      '-movflags', '+faststart',
      outputName,
    ];
  }

  if (mode === 'image') {
    const coverFile = imageInput.files[0];
    if (!coverFile) {
      throw new Error('Please choose a cover image for the image background option.');
    }

    const coverName = 'cover.jpg';
    await ffmpeg.writeFile(coverName, await fetchFile(coverFile));

    args = [
      '-loop', '1',
      '-framerate', '2',
      '-i', coverName,
      '-i', inputName,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:a', 'aac',
      '-b:a', bitrate,
      '-shortest',
      '-movflags', '+faststart',
      outputName,
    ];
  }

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  return { filename: outputName, url };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const files = [...audioInput.files || []];
  if (!files.length) {
    setStatus('Please select at least one audio file.');
    return;
  }

  const mode = form.querySelector('input[name="background-type"]:checked').value;
  const bitrate = bitrateInput.value.trim() || '192k';
  const size = sizeInput.value.trim() || '1280x720';

  convertButton.disabled = true;
  outputList.innerHTML = '';
  setProgress(0);
  setStatus('Initializing conversion…');

  try {
    await loadFfmpeg();

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const percent = Math.round((i / files.length) * 100);
      setProgress(percent);
      setStatus(`Converting ${i + 1} of ${files.length}: ${file.name}`);
      const result = await processFile(file, mode, bitrate, size);
      downloadLink(result.filename, result.url);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setStatus(`Done — ${files.length} file(s) converted.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Conversion failed. Try a smaller file or different output settings.');
  } finally {
    convertButton.disabled = false;
  }
});
