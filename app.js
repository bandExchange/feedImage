const LAYOUT = {
  canvas: { width: 1890, height: 1890 },
  layers: {
    background: { x: 0, y: 0, width: 1890, height: 1890 },
    rect2: { x: 313, y: 229, width: 1265, height: 1432, radius: 120 },
    rect1: { x: 425, y: 270, width: 1041, height: 1350, radius: 80 },
    photo: { x: 742, y: 442, width: 405, height: 405 },
    name: { x: 699, y: 907, width: 494, height: 60, fontSize: 60 },
    text: { x: 699, y: 998, width: 492, height: 153 },
    logo: { x: 699, y: 1220, width: 492, height: 220 },
  },
};

const CANVAS_SIZE = LAYOUT.canvas.width;

// pffield-clean.png = 그림자 제거된 카드 본체
const CARD_ASSET = {
  offsetX: 0,
  offsetY: 0,
  width: 1041,
  height: 1350,
};

const ASSETS = {
  background: './assets/pfBackground.png',
  field: './assets/pffield-clean.png',
  text: './assets/pfText.png',
  font: './assets/Paperlogy-3Light.ttf',
};

const LOGOS = {
  apex: './assets/apexwhite.png',
  np: './assets/apwhite.png',
  qm: './assets/qmmwhite.png',
};

// NP Games는 검은 배경 포함 원본 그대로 표시
const LOGO_DRAW_MODE = {
  apex: 'screen',
  np: 'source-over',
  qm: 'screen',
};

const state = {
  photo: null,
  name: '',
  cardHue: 0,
  cardSat: 100,
  company: null,
};

const images = {};
let fontLoaded = false;

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');

const photoInput = document.getElementById('photoInput');
const nameInput = document.getElementById('nameInput');
const cardHueInput = document.getElementById('cardHue');
const cardSatInput = document.getElementById('cardSat');
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

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }

  const hue2rgb = (p, q, t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hr = h / 360;

  return [
    Math.round(hue2rgb(p, q, hr + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hr) * 255),
    Math.round(hue2rgb(p, q, hr - 1 / 3) * 255),
  ];
}

function applyHueSaturationToImageData(data, hueShift, satPercent) {
  const satFactor = satPercent / 100;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const [r, g, b] = hslToRgb(h + hueShift, Math.min(100, s * satFactor), l);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

const tintedFieldCache = new Map();

function tintFieldImage(img, hueShift, satPercent) {
  if (!hueShift && satPercent === 100) return img;

  const cacheKey = `${hueShift}-${satPercent}`;
  if (tintedFieldCache.has(cacheKey)) return tintedFieldCache.get(cacheKey);

  const offscreen = document.createElement('canvas');
  offscreen.width = img.width;
  offscreen.height = img.height;
  const context = offscreen.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0);

  let tinted = offscreen;

  try {
    const imageData = context.getImageData(0, 0, offscreen.width, offscreen.height);
    applyHueSaturationToImageData(imageData.data, hueShift, satPercent);
    context.putImageData(imageData, 0, 0);
  } catch (error) {
    const fallback = document.createElement('canvas');
    fallback.width = img.width;
    fallback.height = img.height;
    const fallbackCtx = fallback.getContext('2d');
    fallbackCtx.filter = `hue-rotate(${hueShift}deg) saturate(${satPercent}%)`;
    fallbackCtx.drawImage(img, 0, 0);
    fallbackCtx.filter = 'none';
    tinted = fallback;
  }

  tintedFieldCache.set(cacheKey, tinted);
  return tinted;
}

function getCardAdjustments() {
  return {
    hue: Number(cardHueInput?.value ?? state.cardHue ?? 0),
    sat: Number(cardSatInput?.value ?? state.cardSat ?? 100),
  };
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

function drawMainCard(context, fieldImg, hueShift, satPercent) {
  const tintedField = tintFieldImage(fieldImg, hueShift, satPercent);
  const { rect1 } = LAYOUT.layers;

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.1)';
  context.shadowBlur = 36;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 14;
  context.drawImage(
    tintedField,
    rect1.x,
    rect1.y,
    CARD_ASSET.width,
    CARD_ASSET.height,
  );
  context.restore();
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

  const { hue, sat } = getCardAdjustments();
  state.cardHue = hue;
  state.cardSat = sat;

  const [backgroundImg, fieldImg, textImg] = await Promise.all([
    loadImage(ASSETS.background),
    loadImage(ASSETS.field),
    loadImage(ASSETS.text),
  ]);

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawBackground(ctx, backgroundImg);
  drawMainCard(ctx, fieldImg, hue, sat);

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

  const { text } = LAYOUT.layers;
  ctx.drawImage(textImg, text.x, text.y, text.width, text.height);

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

function handleCardAdjustChange() {
  tintedFieldCache.clear();
  scheduleRender();
}

if (cardHueInput) {
  cardHueInput.addEventListener('input', handleCardAdjustChange);
  cardHueInput.addEventListener('change', handleCardAdjustChange);
}

if (cardSatInput) {
  cardSatInput.addEventListener('input', handleCardAdjustChange);
  cardSatInput.addEventListener('change', handleCardAdjustChange);
}

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

if (window.location.protocol === 'file:') {
  const warning = document.getElementById('fileWarning');
  if (warning) warning.hidden = false;
}
