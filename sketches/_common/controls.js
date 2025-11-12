class ControlPanel {
  constructor(containerId = 'controls') {
    this.container = document.getElementById(containerId);
    this.settings = {};
  }

  bindRange(id, setter, valId, options = {}) {
    const input = document.getElementById(id);
    if (!input) return;
    
    const valDisplay = document.getElementById(valId);
    const parse = options.parse || parseInt;
    const format = options.format || (v => v);

    input.addEventListener('input', (e) => {
      const value = parse(e.target.value);
      setter(value);
      if (valDisplay) valDisplay.textContent = format(value);
      if (options.onChange) options.onChange(value);
    });
  }

  bindColor(id, setter) {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', (e) => {
      const rgb = this.hexToRgb(e.target.value);
      if (rgb) setter(rgb);
    });
  }

  bindButton(id, onClick) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', onClick);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  rgbToHex(rgb) {
    return '#' + rgb.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}

class RecordingControls {
  constructor(panel, options = {}) {
    this.panel = panel;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.recordingDuration = options.duration || 10;
    this.recordingTimer = null;
    this.recordingStartTime = null;
  }

  async start() {
    try {
      const canvasElement = document.querySelector('canvas');
      if (!canvasElement || !canvasElement.captureStream) {
        throw new Error('Canvas capture not supported');
      }

      const fps = 60;
      this.stream = canvasElement.captureStream(fps);
      this.recordedChunks = [];
      
      const mimeType = this.getSupportedMimeType();
      const recorderOptions = {
        mimeType: mimeType,
        videoBitsPerSecond: 25000000
      };

      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const downloadBtn = document.getElementById('download-btn');
        
        if (mimeType.includes('mp4')) {
          downloadBtn.dataset.videoUrl = URL.createObjectURL(blob);
          downloadBtn.dataset.extension = 'mp4';
          if (options.onReady) options.onReady('mp4');
        } else {
          downloadBtn.dataset.videoUrl = URL.createObjectURL(blob);
          if (options.onConvert) {
            try {
              const mp4Blob = await options.onConvert(blob);
              downloadBtn.dataset.videoUrl = URL.createObjectURL(mp4Blob);
              downloadBtn.dataset.extension = 'mp4';
              if (options.onReady) options.onReady('mp4');
            } catch (err) {
              downloadBtn.dataset.extension = 'webm';
              if (options.onReady) options.onReady('webm');
            }
          } else {
            downloadBtn.dataset.extension = 'webm';
            if (options.onReady) options.onReady('webm');
          }
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      if (options.onStart) options.onStart();

      this.recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const remaining = this.recordingDuration - elapsed;
        
        if (options.onUpdate) options.onUpdate(remaining);
        
        if (remaining <= 0) {
          this.stop();
          if (options.onStop) options.onStop();
        }
      }, 100);

      return true;
    } catch (err) {
      console.error('Recording error:', err);
      if (options.onError) options.onError(err);
      return false;
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      this.isRecording = false;
    }
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  getSupportedMimeType() {
    const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (let type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'video/webm';
  }

  download(filename) {
    const downloadBtn = document.getElementById('download-btn');
    const url = downloadBtn.dataset.videoUrl;
    const extension = downloadBtn.dataset.extension || 'mp4';
    
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename || 'recording'}-${Date.now()}.${extension}`;
      a.click();
    }
  }
}

class PresetManager {
  constructor(panel, getSettings, setSettings) {
    this.panel = panel;
    this.getSettings = getSettings;
    this.setSettings = setSettings;
  }

  save(name) {
    const preset = {
      version: '1.0',
      name: name || 'My Preset',
      timestamp: new Date().toISOString(),
      settings: this.getSettings()
    };

    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedName = (name || 'preset').replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 50);
    a.download = `${sanitizedName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async load(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const preset = JSON.parse(event.target.result);
          if (!preset.settings) {
            reject(new Error('Invalid preset format'));
            return;
          }
          this.setSettings(preset.settings);
          resolve(preset.name || null);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
}

function isInputFocused() {
  const activeElement = document.activeElement;
  return activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'SELECT' ||
    activeElement.isContentEditable
  );
}

function setupCommonControls(panel, options = {}) {
  const {
    sketchName = 'sketch',
    onReset = () => {},
    onCanvasResize = null,
    getSettings = () => ({}),
    setSettings = () => {},
    onConvertToMP4 = null
  } = options;

  // Setup Reset button with spacebar support
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', onReset);
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !isInputFocused()) {
        e.preventDefault();
        onReset();
      }
    });
  }

  // Setup Canvas controls
  const canvasWidthInput = document.getElementById('canvas-width');
  const canvasHeightInput = document.getElementById('canvas-height');
  if (canvasWidthInput && canvasHeightInput) {
    panel.bindRange('canvas-width', (v) => {
      if (onCanvasResize) {
        onCanvasResize(v, parseInt(canvasHeightInput.value));
      }
    }, 'canvas-width-val');
    
    panel.bindRange('canvas-height', (v) => {
      if (onCanvasResize) {
        onCanvasResize(parseInt(canvasWidthInput.value), v);
      }
    }, 'canvas-height-val');
  }

  // Setup Recording
  const recorder = new RecordingControls(panel, {
    duration: 10,
    onStart: () => {
      const btn = document.getElementById('record-btn');
      if (btn) {
        btn.textContent = 'Stop Recording';
        btn.classList.add('recording');
      }
      const status = document.getElementById('recording-status');
      if (status) status.textContent = 'Recording...';
    },
    onUpdate: (remaining) => {
      const status = document.getElementById('recording-status');
      if (status) status.textContent = `Recording... ${remaining}s`;
    },
    onStop: () => {
      const btn = document.getElementById('record-btn');
      if (btn) {
        btn.textContent = 'Start Recording';
        btn.classList.remove('recording');
      }
      const downloadBtn = document.getElementById('download-btn');
      if (downloadBtn) downloadBtn.disabled = false;
    },
    onReady: (format) => {
      const status = document.getElementById('recording-status');
      if (status) status.textContent = `Ready (${format.toUpperCase()})`;
    },
    onConvert: onConvertToMP4 || undefined
  });

  // Setup Export controls
  const screenshotBtn = document.getElementById('screenshot-btn');
  if (screenshotBtn) {
    panel.bindButton('screenshot-btn', () => {
      saveCanvas(sketchName, 'png');
    });
  }

  const recordBtn = document.getElementById('record-btn');
  if (recordBtn) {
    panel.bindButton('record-btn', async () => {
      if (!recorder.isRecording) {
        await recorder.start();
      } else {
        recorder.stop();
      }
    });
  }

  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    panel.bindButton('download-btn', () => {
      recorder.download(sketchName);
    });
  }

  const recordDurationInput = document.getElementById('record-duration');
  if (recordDurationInput) {
    panel.bindRange('record-duration', (v) => {
      recorder.recordingDuration = v;
    }, 'record-duration-val');
  }

  // Setup Presets
  const presetManager = new PresetManager(panel, getSettings, setSettings);

  const savePresetBtn = document.getElementById('save-preset-btn');
  if (savePresetBtn) {
    panel.bindButton('save-preset-btn', () => {
      const nameInput = document.getElementById('preset-name');
      const name = nameInput ? nameInput.value.trim() : '';
      presetManager.save(name || `${sketchName}-preset`);
    });
  }

  const loadInput = document.getElementById('load-preset-input');
  const loadBtn = document.getElementById('load-preset-btn');
  if (loadInput && loadBtn) {
    loadBtn.addEventListener('click', () => {
      loadInput.click();
    });

    loadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const name = await presetManager.load(file);
          const nameInput = document.getElementById('preset-name');
          if (nameInput && name) {
            nameInput.value = name;
          }
        } catch (err) {
          alert('Error loading preset: ' + err.message);
        }
      }
      e.target.value = '';
    });
  }

  return { recorder, presetManager };
}
