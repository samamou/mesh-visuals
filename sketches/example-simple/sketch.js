// Simple example sketch using shared controls
let SIZE = 100;
let SPEED = 2;
let COLOR = [255, 100, 100];
let BG_COLOR = [20, 20, 30];
let ROTATION = 0;

const panel = new ControlPanel('controls');
let recorder = null;
let presetManager = null;

function setup() {
  createCanvas(800, 800);
  pixelDensity(2);

  // Setup recording
  recorder = new RecordingControls(panel, {
    duration: 10,
    onStart: () => {
      const btn = document.getElementById('record-btn');
      btn.textContent = 'Stop Recording';
      btn.classList.add('recording');
      document.getElementById('recording-status').textContent = 'Recording...';
    },
    onUpdate: (remaining) => {
      document.getElementById('recording-status').textContent = `Recording... ${remaining}s`;
    },
    onStop: () => {
      const btn = document.getElementById('record-btn');
      btn.textContent = 'Start Recording';
      btn.classList.remove('recording');
      document.getElementById('download-btn').disabled = false;
    },
    onReady: (format) => {
      document.getElementById('recording-status').textContent = `Ready (${format.toUpperCase()})`;
    },
    onConvert: async (webmBlob) => {
      if (typeof FFmpeg === 'undefined') {
        throw new Error('FFmpeg not loaded');
      }
      return await convertToMP4(webmBlob);
    }
  });

  // Setup presets
  presetManager = new PresetManager(
    panel,
    () => ({
      SIZE,
      SPEED,
      COLOR,
      BG_COLOR
    }),
    (settings) => {
      if (settings.SIZE !== undefined) {
        SIZE = settings.SIZE;
        document.getElementById('size').value = SIZE;
        document.getElementById('size-val').textContent = SIZE;
      }
      if (settings.SPEED !== undefined) {
        SPEED = settings.SPEED;
        document.getElementById('speed').value = SPEED;
        document.getElementById('speed-val').textContent = SPEED.toFixed(1);
      }
      if (settings.COLOR) {
        COLOR = settings.COLOR;
        document.getElementById('color').value = panel.rgbToHex(COLOR);
      }
      if (settings.BG_COLOR) {
        BG_COLOR = settings.BG_COLOR;
        document.getElementById('bg-color').value = panel.rgbToHex(BG_COLOR);
      }
    }
  );

  // Bind controls
  panel.bindRange('size', (v) => { SIZE = v; }, 'size-val');
  panel.bindRange('speed', (v) => { SPEED = v; }, 'speed-val', {
    parse: parseFloat,
    format: v => v.toFixed(1)
  });
  panel.bindColor('color', (v) => { COLOR = v; });
  panel.bindColor('bg-color', (v) => { BG_COLOR = v; });
  
  panel.bindRange('record-duration', (v) => { recorder.recordingDuration = v; }, 'record-duration-val');

  setupExportControls();
}

function draw() {
  background(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2]);

  ROTATION += SPEED;

  push();
  translate(width / 2, height / 2);
  rotate(radians(ROTATION));

  fill(COLOR[0], COLOR[1], COLOR[2]);
  noStroke();
  rectMode(CENTER);
  rect(0, 0, SIZE, SIZE);

  fill(255);
  circle(SIZE / 2, 0, SIZE / 4);
  circle(-SIZE / 2, 0, SIZE / 4);
  circle(0, SIZE / 2, SIZE / 4);
  circle(0, -SIZE / 2, SIZE / 4);

  pop();
}

function setupExportControls() {
  panel.bindButton('screenshot-btn', () => {
    saveCanvas('simple-sketch', 'png');
  });

  panel.bindButton('record-btn', async () => {
    if (!recorder.isRecording) {
      await recorder.start();
    } else {
      recorder.stop();
    }
  });

  panel.bindButton('download-btn', () => {
    recorder.download('simple-sketch');
  });

  panel.bindButton('reset-btn', () => {
    ROTATION = 0;
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isInputFocused()) {
      e.preventDefault();
      document.getElementById('reset-btn').click();
    }
  });

  panel.bindButton('save-preset-btn', () => {
    const name = document.getElementById('preset-name').value.trim();
    presetManager.save(name || 'simple-preset');
  });

  const loadInput = document.getElementById('load-preset-input');
  loadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const name = await presetManager.load(file);
        if (name) {
          document.getElementById('preset-name').value = name;
        }
      } catch (err) {
        alert('Error loading preset: ' + err.message);
      }
    }
    e.target.value = '';
  });

  const loadBtn = document.getElementById('load-preset-btn');
  loadBtn.addEventListener('click', () => {
    loadInput.click();
  });
}

async function convertToMP4(webmBlob) {
  if (typeof FFmpeg === 'undefined') {
    throw new Error('FFmpeg not loaded');
  }

  let ffmpeg = null;
  let ffmpegLoaded = false;

  if (!ffmpegLoaded) {
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log(message));
    
    const coreResponse = await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js');
    const wasmResponse = await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm');
    
    await ffmpeg.load({
      coreURL: URL.createObjectURL(await coreResponse.blob()),
      wasmURL: URL.createObjectURL(await wasmResponse.blob()),
    });
    ffmpegLoaded = true;
  }

  const inputName = 'input.webm';
  const outputName = 'output.mp4';
  
  const arrayBuffer = await webmBlob.arrayBuffer();
  await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
  await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', outputName]);
  const data = await ffmpeg.readFile(outputName);
  
  return new Blob([data.buffer], { type: 'video/mp4' });
}

function isInputFocused() {
  const activeElement = document.activeElement;
  return activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  );
}
