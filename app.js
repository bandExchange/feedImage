const LAYOUT = {
  canvas: { width: 1890, height: 1890 },
  layers: {
    background: { x: 0, y: 0, width: 1890, height: 1890 },
    rect2: { x: 313, y: 229, width: 1265, height: 1432, radius: 120 },
    rect1: { x: 425, y: 270, width: 1041, height: 1350, radius: 80 },
    photo: { x: 732, y: 432, width: 425, height: 425 },
    name: { x: 699, y: 907, width: 494, height: 60, fontSize: 68 },
    investor: { x: 680, y: 983, width: 530, height: 130 },
    logo: { x: 675, y: 1220, width: 540, height: 255 },
  },
};

const CANVAS_SIZE = LAYOUT.canvas.width;

const ASSETS = {
  background: './assets/pfBackground.png',
  investor: './assets/bnxInvestor.png',
  font: './assets/Paperlogy-3Light.ttf',
};

const LOGOS = {
  apex: './assets/apexwhite.png',
  np: './assets/apwhite.png',
  qm: './assets/qmmwhite.png',
};

const LOGO_DRAW_MODE = {
  apex: 'screen',
  np: 'source-over',
  qm: 'screen',
};

const state = {
  photo: null,
  name: '',
  cardColor: { h: 210, s: 42, v: 97 },
  company: null,
};

const images = {};
let fontLoaded = false;

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');

const photoInput = document.getElementById('photoInput');
const nameInput = document.getElementById('nameInput');
const colorSvCanvas = document.getElementById('colorSv');
const colorHueCanvas = document.getElementById('colorHue');
const colorSwatch = document.getElementById('colorSwatch');
const companyTabs = document.getElementById('companyTabs');
const downloadBtn = document.getElementById('downloadBtn');

function loadImage(src) {
  if (images[src]) return images[src];
  images[src] = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      delete images[src];
      reject(new Error(`Failed to load: ${src}`));
    };
    img.src = new URL(src, window.location.href).href;
  });
  return images[src];
}

async function loadFont() {
  if (fontLoaded) return;
  try {
    const face = new FontFace('Paperlogy', `url(${ASSETS.font})`);
    await face.load();
    document.fonts.add(face);
    fontLoaded = true;
  } catch (error) {
    console.warn('폰트 로드 실패, 기본 폰트 사용:', error);
  }
}

function drawImageCover(context, img, area) {
  const ratio = Math.max(area.width / img.width, area.height / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  const x = area.x + (area.width - width) / 2;
  const y = area.y + (area.height - height) / 2;
  context.drawImage(img, x, y, width, height);
}

function drawCircularPhoto(context, img, area) {
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  const radius = area.width / 2;

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  drawImageCover(context, img, area);
  context.restore();
}

function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToCss(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

function updateColorSwatch() {
  if (!colorSwatch) return;
  const [r, g, b] = hsvToRgb(state.cardColor.h, state.cardColor.s, state.cardColor.v);
  colorSwatch.style.background = rgbToCss(r, g, b);
}

function drawSvPlane() {
  if (!colorSvCanvas) return;
  const context = colorSvCanvas.getContext('2d');
  const { width, height } = colorSvCanvas;
  const imageData = context.createImageData(width, height);
  const { data } = imageData;
  const hue = state.cardColor.h;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = (x / (width - 1)) * 100;
      const v = (1 - y / (height - 1)) * 100;
      const [r, g, b] = hsvToRgb(hue, s, v);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  drawSvCursor(context);
}

function drawHueStrip() {
  if (!colorHueCanvas) return;
  const context = colorHueCanvas.getContext('2d');
  const { width, height } = colorHueCanvas;
  const imageData = context.createImageData(width, height);
  const { data } = imageData;

  for (let y = 0; y < height; y += 1) {
    const hue = (y / (height - 1)) * 360;
    const [r, g, b] = hsvToRgb(hue, 100, 100);
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  drawHueCursor(context);
}

function drawSvCursor(context) {
  const { width, height } = colorSvCanvas;
  const x = (state.cardColor.s / 100) * (width - 1);
  const y = (1 - state.cardColor.v / 100) * (height - 1);
  context.save();
  context.strokeStyle = '#fff';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

function drawHueCursor(context) {
  const { width, height } = colorHueCanvas;
  const y = (state.cardColor.h / 360) * (height - 1);
  context.save();
  context.strokeStyle = '#fff';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, y);
  context.lineTo(width, y);
  context.stroke();
  context.restore();
}

function setCardColorFromSv(x, y) {
  const { width, height } = colorSvCanvas;
  state.cardColor.s = Math.max(0, Math.min(100, (x / (width - 1)) * 100));
  state.cardColor.v = Math.max(0, Math.min(100, (1 - y / (height - 1)) * 100));
  onCardColorChange();
}

function setCardColorFromHue(y) {
  const { height } = colorHueCanvas;
  state.cardColor.h = Math.max(0, Math.min(360, (y / (height - 1)) * 360));
  onCardColorChange();
}

function onCardColorChange() {
  updateColorSwatch();
  drawSvPlane();
  drawHueStrip();
  scheduleRender();
}

function bindColorPickerDrag(canvas, onMove) {
  if (!canvas) return;

  const handlePointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    onMove(x, y);
  };

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    handlePointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!canvas.hasPointerCapture(event.pointerId)) return;
    handlePointer(event);
  });
}

function initColorPicker() {
  if (!colorSvCanvas || !colorHueCanvas) return;

  bindColorPickerDrag(colorSvCanvas, (x, y) => setCardColorFromSv(x, y));
  bindColorPickerDrag(colorHueCanvas, (_x, y) => setCardColorFromHue(y));
  updateColorSwatch();
  drawSvPlane();
  drawHueStrip();
}

function drawPhotoPlaceholder(context, area) {
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  const radius = area.width / 2;

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.closePath();
  context.fillStyle = '#b5b5b5';
  context.fill();
  context.restore();
}

function drawRoundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawMainCard(context, cardColor) {
  const { rect1 } = LAYOUT.layers;
  const { x, y, width, height, radius } = rect1;
  const [r, g, b] = hsvToRgb(cardColor.h, cardColor.s, cardColor.v);
  const blurAmount = 28;
  const pad = blurAmount * 2;

  const snapshot = document.createElement('canvas');
  snapshot.width = width + pad * 2;
  snapshot.height = height + pad * 2;
  const snapshotCtx = snapshot.getContext('2d');
  snapshotCtx.drawImage(
    context.canvas,
    x - pad,
    y - pad,
    width + pad * 2,
    height + pad * 2,
    0,
    0,
    snapshot.width,
    snapshot.height,
  );

  const blurred = document.createElement('canvas');
  blurred.width = snapshot.width;
  blurred.height = snapshot.height;
  const blurredCtx = blurred.getContext('2d');
  blurredCtx.filter = `blur(${blurAmount}px)`;
  blurredCtx.drawImage(snapshot, 0, 0);
  blurredCtx.filter = 'none';

  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.14)';
  context.shadowBlur = 42;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 18;
  drawRoundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = 'rgba(0, 0, 0, 0.01)';
  context.fill();
  context.shadowColor = 'transparent';
  context.restore();

  context.save();
  drawRoundedRectPath(context, x, y, width, height, radius);
  context.clip();

  context.drawImage(blurred, x - pad, y - pad);
  context.fillStyle = `rgba(${r}, ${g}, ${b}, 0.38)`;
  context.fillRect(x, y, width, height);

  const frost = context.createLinearGradient(x, y, x, y + height);
  frost.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
  frost.addColorStop(0.45, 'rgba(255, 255, 255, 0.18)');
  frost.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
  context.fillStyle = frost;
  context.fillRect(x, y, width, height);
  context.restore();

  context.save();
  drawRoundedRectPath(context, x, y, width, height, radius);
  context.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  context.lineWidth = 2;
  context.stroke();
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  context.lineWidth = 1;
  context.stroke();

  const highlight = context.createLinearGradient(x, y, x, y + radius * 2);
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.strokeStyle = highlight;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x + radius, y + 1);
  context.lineTo(x + width - radius, y + 1);
  context.stroke();
  context.restore();
}

function drawImageInArea(context, img, area) {
  const scale = Math.min(area.width / img.width, area.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  const x = area.x + (area.width - width) / 2;
  const y = area.y + (area.height - height) / 2;
  context.drawImage(img, x, y, width, height);
}

function drawLogo(context, logoImg, area, company) {
  const scale = Math.min(area.width / logoImg.width, area.height / logoImg.height);
  const width = logoImg.width * scale;
  const height = logoImg.height * scale;
  const x = area.x + (area.width - width) / 2;
  const y = area.y + (area.height - height) / 2;

  context.save();
  context.globalCompositeOperation = LOGO_DRAW_MODE[company] || 'source-over';
  context.drawImage(logoImg, x, y, width, height);
  context.restore();
}

function drawBackground(context, backgroundImg) {
  const { background } = LAYOUT.layers;
  context.drawImage(backgroundImg, background.x, background.y, background.width, background.height);
}

async function render() {
  await loadFont();

  const [backgroundImg, investorImg] = await Promise.all([
    loadImage(ASSETS.background),
    loadImage(ASSETS.investor),
  ]);

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawBackground(ctx, backgroundImg);
  drawMainCard(ctx, state.cardColor);

  const { photo } = LAYOUT.layers;
  if (state.photo) {
    drawCircularPhoto(ctx, state.photo, photo);
  } else {
    drawPhotoPlaceholder(ctx, photo);
  }

  if (state.name.trim()) {
    const { name: nameArea } = LAYOUT.layers;
    ctx.save();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `${nameArea.fontSize}px Paperlogy, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      state.name.trim(),
      nameArea.x + nameArea.width / 2,
      nameArea.y + nameArea.height / 2,
    );
    ctx.restore();
  }

  drawImageInArea(ctx, investorImg, LAYOUT.layers.investor);

  if (state.company) {
    const logoImg = await loadImage(LOGOS[state.company]);
    drawLogo(ctx, logoImg, LAYOUT.layers.logo, state.company);
  }
}

function scheduleRender() {
  render().catch((error) => {
    console.error(error);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = '#c0392b';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('이미지 로드 실패', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 40);
    ctx.fillStyle = '#666';
    ctx.font = '22px sans-serif';
    const hint = window.location.protocol === 'file:'
      ? 'start.sh 로 로컬 서버 실행 후 접속하세요'
      : String(error?.message || '새로고침 후 다시 시도하세요');
    ctx.fillText(hint, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
  });
}

photoInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    state.photo = null;
    scheduleRender();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.photo = img;
      scheduleRender();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

nameInput.addEventListener('input', (event) => {
  state.name = event.target.value;
  scheduleRender();
});

companyTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-company]');
  if (!button) return;

  const company = button.dataset.company;
  state.company = state.company === company ? null : company;

  companyTabs.querySelectorAll('[data-company]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.company === state.company);
  });

  scheduleRender();
});

downloadBtn.addEventListener('click', async () => {
  try {
    await render();
    const link = document.createElement('a');
    link.download = `bnx-profile-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error(error);
  }
});

scheduleRender();
initColorPicker();

if (window.location.protocol === 'file:') {
  const warning = document.getElementById('fileWarning');
  if (warning) warning.hidden = false;
}
