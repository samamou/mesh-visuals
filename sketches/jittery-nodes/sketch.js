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
