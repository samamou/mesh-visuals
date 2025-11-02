let CANVAS_W = 1000;
let CANVAS_H = 1000;
let NUM_NODES = 200;
let MAX_LINK_DIST = 100;
let NODE_SIZE = 4;
let STEP_SIZE = 5.0;
let EDGE_BOUNCE_PADDING = 30;

let NODE_COLOR = [200, 200, 255];
let LINK_COLOR = [180, 180, 255];
let BG_COLOR = [0, 0, 0];
let CARD_COLOR = [35, 35, 35];

let nodes = [];
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let ffmpeg = null;
let ffmpegLoaded = false;
let recordingDuration = 10;
let recordingTimer = null;
let recordingStartTime = null;

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

function initNodes() {
  nodes = [];
  for (let i = 0; i < NUM_NODES; i++) {
    nodes.push({
      x: random(EDGE_BOUNCE_PADDING, CANVAS_W - EDGE_BOUNCE_PADDING),
      y: random(EDGE_BOUNCE_PADDING, CANVAS_H - EDGE_BOUNCE_PADDING),
      vx: random(-0.5, 0.5),
      vy: random(-0.5, 0.5),
    });
  }
}

function bindControl(id, setter, valId, options = {}) {
  const input = document.getElementById(id);
  const valDisplay = document.getElementById(valId);
  const parse = options.parse || parseInt;
  const format = options.format || (v => v);
  const onChange = options.onChange || (() => {});

  input.addEventListener('input', (e) => {
    const value = parse(e.target.value);
    setter(value);
    valDisplay.textContent = format(value);
    onChange(value);
  });
}

function bindColorControl(id, setter) {
  document.getElementById(id).addEventListener('input', (e) => {
    const rgb = hexToRgb(e.target.value);
    if (rgb) setter(rgb);
  });
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  pixelDensity(2);
  noStroke();

  initNodes();

  bindControl('canvas-width', (v) => { CANVAS_W = v; }, 'canvas-width-val', {
    onChange: () => resizeCanvas(CANVAS_W, CANVAS_H)
  });

  bindControl('canvas-height', (v) => { CANVAS_H = v; }, 'canvas-height-val', {
    onChange: () => resizeCanvas(CANVAS_W, CANVAS_H)
  });

  bindControl('num-nodes', (v) => { NUM_NODES = v; }, 'num-nodes-val', {
    onChange: () => initNodes()
  });

  bindControl('link-dist', (v) => { MAX_LINK_DIST = v; }, 'link-dist-val');
  bindControl('node-size', (v) => { NODE_SIZE = v; }, 'node-size-val', { parse: parseFloat });
  
  bindControl('step-size', (v) => { STEP_SIZE = v; }, 'step-size-val', {
    parse: parseFloat,
    format: v => v.toFixed(1)
  });

  bindControl('edge-padding', (v) => { EDGE_BOUNCE_PADDING = v; }, 'edge-padding-val');

  bindColorControl('node-color', (v) => { NODE_COLOR = v; });
  bindColorControl('link-color', (v) => { LINK_COLOR = v; });
  bindColorControl('bg-color', (v) => { BG_COLOR = v; });
  bindColorControl('card-color', (v) => { CARD_COLOR = v; });

  bindControl('record-duration', (v) => { recordingDuration = v; }, 'record-duration-val');

  setupExportControls();
  setupPresetControls();
}

function setupExportControls() {
  const screenshotBtn = document.getElementById('screenshot-btn');
  const recordBtn = document.getElementById('record-btn');
  const downloadBtn = document.getElementById('download-btn');
  const statusDiv = document.getElementById('recording-status');

  screenshotBtn.addEventListener('click', () => {
    saveCanvas('jittery-nodes', 'png');
  });

  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
      recordBtn.textContent = 'Stop Recording';
      recordBtn.classList.add('recording');
      downloadBtn.disabled = true;
      
      recordingStartTime = Date.now();
      recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const remaining = recordingDuration - elapsed;
        
        if (remaining <= 0) {
          clearInterval(recordingTimer);
          recordingTimer = null;
          stopRecording();
          recordBtn.textContent = 'Start Recording';
          recordBtn.classList.remove('recording');
          downloadBtn.disabled = false;
          statusDiv.textContent = 'Ready to download';
        } else {
          statusDiv.textContent = `Recording... ${remaining}s remaining`;
        }
      }, 100);
      
      statusDiv.textContent = `Recording... ${recordingDuration}s`;
    } else {
      stopRecording();
      recordBtn.textContent = 'Start Recording';
      recordBtn.classList.remove('recording');
      downloadBtn.disabled = false;
      statusDiv.textContent = 'Ready to download';
      
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
    }
  });

  downloadBtn.addEventListener('click', () => {
    downloadRecording();
  });
}

function setupPresetControls() {
  const resetBtn = document.getElementById('reset-btn');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const loadPresetBtn = document.getElementById('load-preset-btn');
  const loadPresetInput = document.getElementById('load-preset-input');

  resetBtn.addEventListener('click', () => {
    initNodes();
  });

  savePresetBtn.addEventListener('click', () => {
    savePreset();
  });

  loadPresetBtn.addEventListener('click', () => {
    loadPresetInput.click();
  });

  loadPresetInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const preset = JSON.parse(event.target.result);
          loadPreset(preset);
          
          const presetNameInput = document.getElementById('preset-name');
          if (preset.name) {
            presetNameInput.value = preset.name;
          }
        } catch (err) {
          alert('Invalid preset file: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  });
}

function savePreset() {
  const presetNameInput = document.getElementById('preset-name');
  const presetName = presetNameInput.value.trim() || 'cute_bubbles';
  
  const sanitizedName = presetName
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .substring(0, 50);

  const preset = {
    version: '1.0',
    name: presetName,
    timestamp: new Date().toISOString(),
    settings: {
      CANVAS_W,
      CANVAS_H,
      NUM_NODES,
      MAX_LINK_DIST,
      NODE_SIZE,
      STEP_SIZE,
      EDGE_BOUNCE_PADDING,
      NODE_COLOR,
      LINK_COLOR,
      BG_COLOR,
      CARD_COLOR
    }
  };

  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = sanitizedName || 'jittery-nodes-preset';
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadPreset(preset) {
  if (!preset.settings) {
    alert('Invalid preset format');
    return;
  }

  const settings = preset.settings;

  if (settings.CANVAS_W) {
    CANVAS_W = settings.CANVAS_W;
    document.getElementById('canvas-width').value = CANVAS_W;
    document.getElementById('canvas-width-val').textContent = CANVAS_W;
  }

  if (settings.CANVAS_H) {
    CANVAS_H = settings.CANVAS_H;
    document.getElementById('canvas-height').value = CANVAS_H;
    document.getElementById('canvas-height-val').textContent = CANVAS_H;
  }

  resizeCanvas(CANVAS_W, CANVAS_H);

  if (settings.NUM_NODES) {
    NUM_NODES = settings.NUM_NODES;
    document.getElementById('num-nodes').value = NUM_NODES;
    document.getElementById('num-nodes-val').textContent = NUM_NODES;
  }

  if (settings.MAX_LINK_DIST) {
    MAX_LINK_DIST = settings.MAX_LINK_DIST;
    document.getElementById('link-dist').value = MAX_LINK_DIST;
    document.getElementById('link-dist-val').textContent = MAX_LINK_DIST;
  }

  if (settings.NODE_SIZE !== undefined) {
    NODE_SIZE = settings.NODE_SIZE;
    document.getElementById('node-size').value = NODE_SIZE;
    document.getElementById('node-size-val').textContent = NODE_SIZE;
  }

  if (settings.STEP_SIZE !== undefined) {
    STEP_SIZE = settings.STEP_SIZE;
    document.getElementById('step-size').value = STEP_SIZE;
    document.getElementById('step-size-val').textContent = STEP_SIZE.toFixed(1);
  }

  if (settings.EDGE_BOUNCE_PADDING !== undefined) {
    EDGE_BOUNCE_PADDING = settings.EDGE_BOUNCE_PADDING;
    document.getElementById('edge-padding').value = EDGE_BOUNCE_PADDING;
    document.getElementById('edge-padding-val').textContent = EDGE_BOUNCE_PADDING;
  }

  if (settings.NODE_COLOR) {
    NODE_COLOR = settings.NODE_COLOR;
    document.getElementById('node-color').value = rgbToHex(NODE_COLOR);
  }

  if (settings.LINK_COLOR) {
    LINK_COLOR = settings.LINK_COLOR;
    document.getElementById('link-color').value = rgbToHex(LINK_COLOR);
  }

  if (settings.BG_COLOR) {
    BG_COLOR = settings.BG_COLOR;
    document.getElementById('bg-color').value = rgbToHex(BG_COLOR);
  }

  if (settings.CARD_COLOR) {
    CARD_COLOR = settings.CARD_COLOR;
    document.getElementById('card-color').value = rgbToHex(CARD_COLOR);
  }

  initNodes();
}

function rgbToHex(rgb) {
  return '#' + rgb.map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function getSupportedMimeType() {
  const types = [
    'video/mp4',

  ];
  
  for (let type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

async function startRecording() {
  try {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) {
      throw new Error('Canvas not found');
    }
    
    if (!canvasElement.captureStream) {
      throw new Error('captureStream not supported in this browser');
    }

    const fps = 60;
    stream = canvasElement.captureStream(fps);
    recordedChunks = [];
    
    const mimeType = getSupportedMimeType();
    const options = {
      mimeType: mimeType,
      videoBitsPerSecond: 25000000
    };

    if (mimeType.includes('vp9') || mimeType.includes('vp8')) {
      options.videoBitsPerSecond = 25000000;
    }

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const downloadBtn = document.getElementById('download-btn');
      
      if (mimeType.includes('mp4')) {
        const url = URL.createObjectURL(blob);
        downloadBtn.dataset.videoUrl = url;
        downloadBtn.dataset.extension = 'mp4';
      } else {
        downloadBtn.dataset.videoUrl = URL.createObjectURL(blob);
        downloadBtn.dataset.videoBlob = 'webm';
        downloadBtn.dataset.extension = 'webm';
        
        const statusDiv = document.getElementById('recording-status');
        statusDiv.textContent = 'Converting to MP4...';
        
        try {
          const mp4Blob = await convertToMP4(blob);
          downloadBtn.dataset.videoUrl = URL.createObjectURL(mp4Blob);
          downloadBtn.dataset.extension = 'mp4';
          statusDiv.textContent = 'Ready to download (MP4)';
        } catch (err) {
          console.error('Conversion failed:', err);
          statusDiv.textContent = 'Ready to download (WebM) - conversion failed';
        }
      }
    };

    mediaRecorder.start(100);
    isRecording = true;
  } catch (err) {
    console.error('Error starting recording:', err);
    alert('Recording not supported in this browser: ' + err.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    isRecording = false;
  }
}

async function convertToMP4(webmBlob) {
  if (typeof FFmpeg === 'undefined') {
    throw new Error('FFmpeg not loaded');
  }

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

function downloadRecording() {
  const downloadBtn = document.getElementById('download-btn');
  const url = downloadBtn.dataset.videoUrl;
  const extension = downloadBtn.dataset.extension || 'mp4';
  
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `jittery-nodes-${Date.now()}.${extension}`;
    a.click();
  }
}

function setColor(rgb) {
  fill(rgb[0], rgb[1], rgb[2]);
}

function setStrokeColor(rgb, alpha = 255) {
  stroke(rgb[0], rgb[1], rgb[2], alpha);
}

function draw() {
  background(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2]);
  
  noStroke();
  setColor(CARD_COLOR);
  rectMode(CENTER);
  rect(width / 2, height / 2, width - 20, height - 20, 12);

  updateNodes();
  drawLinks();
  drawNodes();
}

function updateNodes() {
  const CARD_PADDING = 20;
  const BOUNCE_DAMPEN = -0.6;
  const WANDER_RANGE = 0.2;

  for (let n of nodes) {
    n.vx += random(-WANDER_RANGE, WANDER_RANGE);
    n.vy += random(-WANDER_RANGE, WANDER_RANGE);
    n.vx = constrain(n.vx, -STEP_SIZE, STEP_SIZE);
    n.vy = constrain(n.vy, -STEP_SIZE, STEP_SIZE);

    n.x += n.vx;
    n.y += n.vy;

    const bounds = {
      left: CARD_PADDING + EDGE_BOUNCE_PADDING,
      right: width - CARD_PADDING - EDGE_BOUNCE_PADDING,
      top: CARD_PADDING + EDGE_BOUNCE_PADDING,
      bottom: height - CARD_PADDING - EDGE_BOUNCE_PADDING
    };

    if (n.x < bounds.left) {
      n.x = bounds.left;
      n.vx *= BOUNCE_DAMPEN;
    } else if (n.x > bounds.right) {
      n.x = bounds.right;
      n.vx *= BOUNCE_DAMPEN;
    }
    if (n.y < bounds.top) {
      n.y = bounds.top;
      n.vy *= BOUNCE_DAMPEN;
    } else if (n.y > bounds.bottom) {
      n.y = bounds.bottom;
      n.vy *= BOUNCE_DAMPEN;
    }
  }
}

function drawLinks() {
  strokeWeight(1);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[i].x - nodes[j].x;
      let dy = nodes[i].y - nodes[j].y;
      let d2 = dx * dx + dy * dy;

      if (d2 < MAX_LINK_DIST * MAX_LINK_DIST) {
        let d = sqrt(d2);
        let alpha = map(d, 0, MAX_LINK_DIST, 200, 0);
        let flickerChance = map(d, 0, MAX_LINK_DIST, 0.95, 0.5);
        
        if (random() < flickerChance) {
          setStrokeColor(LINK_COLOR, alpha);
          line(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        }
      }
    }
  }
}

function drawNodes() {
  noStroke();
  setColor(NODE_COLOR);
  for (let n of nodes) {
    circle(n.x, n.y, NODE_SIZE);
  }
}
