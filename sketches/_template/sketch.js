// Template sketch using shared controls
// Replace these with your sketch-specific variables
let CANVAS_W = 800;
let CANVAS_H = 800;
let SHAPE_COLOR = [255, 255, 255];
let BG_COLOR = [15, 15, 15];
let ROTATION = 0;

const panel = new ControlPanel('controls');
let recorder = null;
let presetManager = null;

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  pixelDensity(2);

  // Setup common controls (Reset, Canvas, Export, Colors, Presets)
  const common = setupCommonControls(panel, {
    sketchName: 'template-sketch',
    onReset: () => {
      // Add your reset logic here
      ROTATION = 0;
    },
    onCanvasResize: (w, h) => {
      CANVAS_W = w;
      CANVAS_H = h;
      resizeCanvas(w, h);
    },
    getSettings: () => ({
      // Return all settings that should be saved in presets
      CANVAS_W,
      CANVAS_H,
      SHAPE_COLOR,
      BG_COLOR
    }),
    setSettings: (settings) => {
      // Restore settings from preset
      if (settings.CANVAS_W !== undefined) {
        CANVAS_W = settings.CANVAS_W;
        document.getElementById('canvas-width').value = CANVAS_W;
        document.getElementById('canvas-width-val').textContent = CANVAS_W;
      }
      if (settings.CANVAS_H !== undefined) {
        CANVAS_H = settings.CANVAS_H;
        document.getElementById('canvas-height').value = CANVAS_H;
        document.getElementById('canvas-height-val').textContent = CANVAS_H;
      }
      if (settings.SHAPE_COLOR) {
        SHAPE_COLOR = settings.SHAPE_COLOR;
        document.getElementById('shape-color').value = panel.rgbToHex(SHAPE_COLOR);
      }
      if (settings.BG_COLOR) {
        BG_COLOR = settings.BG_COLOR;
        document.getElementById('bg-color').value = panel.rgbToHex(BG_COLOR);
      }
      // Resize canvas if dimensions changed
      if (settings.CANVAS_W || settings.CANVAS_H) {
        resizeCanvas(CANVAS_W, CANVAS_H);
      }
    },
    onConvertToMP4: async (webmBlob) => {
      // Optional: Add MP4 conversion if FFmpeg is available
      if (typeof FFmpeg === 'undefined') {
        throw new Error('FFmpeg not loaded');
      }
      return await convertToMP4(webmBlob);
    }
  });

  recorder = common.recorder;
  presetManager = common.presetManager;

  // Bind your custom controls here
  // Example:
  // panel.bindRange('my-control', (v) => { MY_VAR = v; }, 'my-control-val');
  // panel.bindColor('my-color', (v) => { MY_COLOR = v; });

  // Bind common color controls
  panel.bindColor('shape-color', (v) => { SHAPE_COLOR = v; });
  panel.bindColor('bg-color', (v) => { BG_COLOR = v; });
}

function draw() {
  background(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2]);

  // Your drawing code here
  ROTATION += 1;
  
  push();
  translate(width / 2, height / 2);
  rotate(radians(ROTATION));
  
  fill(SHAPE_COLOR[0], SHAPE_COLOR[1], SHAPE_COLOR[2]);
  noStroke();
  rectMode(CENTER);
  rect(0, 0, 100, 100);
  
  pop();
}

// Optional: MP4 conversion function
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

