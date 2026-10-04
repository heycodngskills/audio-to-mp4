import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';

const form = document.getElementById('converter-form');
const dropZone = document.getElementById('drop-zone');
const audioInput = document.getElementById('audio-input');
const fileList = document.getElementById('file-list');
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

function updateSelectedFiles(selected) {
  fileList.innerHTML = '';

  if (!selected.length) {
    fileList.innerHTML = '<p class="muted">No files selected.</p>';
    return;
  }

  selected.forEach((file, index) => {
    const tag = document.createElement('div');
    tag.className = 'file-tag';

    const label = document.createElement('span');
    label.textContent = file.name;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `Remove ${file.name}`);
    removeButton.addEventListener('click', () => {
      const nextFiles = [...selected];
      nextFiles.splice(index, 1);
      updateSelectedFiles(nextFiles);
      audioInput.files = createFileList(nextFiles);
    });

    tag.append(label, removeButton);
    fileList.appendChild(tag);
  });
}

function createFileList(files) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  return dataTransfer.files;
}

function handleFiles(files) {
  const selected = [...(audioInput.files || []), ...files];
  const unique = [];
  const seen = new Set();

  for (const file of selected) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(file);
    }
  }

  audioInput.files = createFileList(unique);
  updateSelectedFiles(unique);
}

function toggleImageField() {
  const selectedMode = form.querySelector('input[name="background-type"]:checked').value;
  imageField.classList.toggle('hidden', selectedMode !== 'image');
}

form.querySelectorAll('input[name="background-type"]').forEach((radio) => {
  radio.addEventListener('change', toggleImageField);
});

audioInput.addEventListener('change', (event) => {
  handleFiles([...event.target.files]);
});

dropZone.addEventListener('click', () => audioInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    audioInput.click();
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
  });
});

dropZone.addEventListener('drop', (event) => {
  const incomingFiles = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith('audio/'));
  if (incomingFiles.length) {
    handleFiles(incomingFiles);
  }
});

toggleImageField();
updateSelectedFiles([]);

async function loadFfmpeg() {
  if (ffmpegLoaded) return;

  setStatus('Loading FFmpeg…');
  setProgress(12);

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegLoaded = true;
  setProgress(100);
  setStatus('FFmpeg ready.');
}

function renderOutput(filename, url) {
  const item = document.createElement('div');
  item.className = 'output-item';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = filename;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = 'Download';

  item.appendChild(name);
  item.appendChild(link);
  outputList.appendChild(item);
}

function makeSafeName(name) {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function processFile(file, mode, bitrate, size) {
  const sourceName = makeSafeName(file.name);
  const outputName = sourceName.replace(/\.[^/.]+$/, '.mp4');

  await ffmpeg.writeFile(sourceName, await fetchFile(file));

  let args = ['-i', sourceName, '-vn', '-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart', outputName];

  if (mode === 'black') {
    args = [
      '-f', 'lavfi',
      '-i', `color=c=black:s=${size}:r=2`,
      '-i', sourceName,
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
    const coverFile = imageInput.files?.[0];
    if (!coverFile) {
      throw new Error('Choose a cover image before using the image background option.');
    }

    const coverName = 'cover-image';
    const coverExt = coverFile.name.includes('.') ? coverFile.name.split('.').pop() : 'jpg';
    const coverPath = `${coverName}.${coverExt}`;
    await ffmpeg.writeFile(coverPath, await fetchFile(coverFile));

    args = [
      '-loop', '1',
      '-framerate', '2',
      '-i', coverPath,
      '-i', sourceName,
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

  const files = [...(audioInput.files || [])];
  if (!files.length) {
    setStatus('Please select at least one audio file.');
    return;
  }

  const mode = form.querySelector('input[name="background-type"]:checked').value;
  const bitrate = bitrateInput.value.trim() || '192k';
  const size = sizeInput.value.trim() || '1280x720';

  convertButton.disabled = true;
  outputList.innerHTML = '<p class="muted">Working…</p>';
  setProgress(0);
  setStatus('Initializing conversion…');

  try {
    await loadFfmpeg();

    outputList.innerHTML = '';

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const percent = Math.round((i / files.length) * 100);
      setProgress(percent);
      setStatus(`Converting ${i + 1} of ${files.length}: ${file.name}`);

      const result = await processFile(file, mode, bitrate, size);
      renderOutput(result.filename, result.url);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setStatus(`Done — ${files.length} file(s) converted.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Conversion failed. Try a smaller file or a different mode.');
    outputList.innerHTML = `<p class="muted">${error.message || 'Conversion failed.'}</p>`;
  } finally {
    convertButton.disabled = false;
  }
});
