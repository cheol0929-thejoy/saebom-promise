// 말씀 카드 이미지(캔버스) 그리기 — 개인 모드·예배당 모드가 함께 씁니다.
(function () {
  const C = {
    b1: '#1d64b3', b2: '#154f98', b3: '#0d3672', b4: '#0a2856',
    paper: '#ffffff', ink: '#0f2a52', sub: '#5d7192', accent: '#154f98',
    line: 'rgba(21,79,152,0.22)',
  };

  const SERIF = '"Seoul Hangang", "Noto Serif KR", serif';
  const SANS = '"Seoul Hangang", "Noto Serif KR", serif';

  async function ensureFonts() {
    if (!document.fonts) return;
    try {
      await Promise.all([
        document.fonts.load(`700 60px ${SERIF}`, '말씀'),
        document.fonts.load(`500 40px ${SERIF}`, '말씀'),
        document.fonts.load(`500 32px ${SANS}`, '말씀'),
        document.fonts.load(`700 32px ${SANS}`, '말씀'),
      ]);
    } catch (e) { /* 글꼴을 못 받아도 기본 글꼴로 그립니다 */ }
  }

  // 한국어 줄바꿈: 띄어쓰기 단위로 끊고, 한 단어가 너무 길면 글자 단위로 끊습니다.
  function wrap(ctx, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
      if (line) lines.push(line);
      if (ctx.measureText(w).width <= maxWidth) { line = w; continue; }
      let piece = '';
      for (const ch of w) {
        if (ctx.measureText(piece + ch).width > maxWidth) { lines.push(piece); piece = ch; }
        else piece += ch;
      }
      line = piece;
    }
    if (line) lines.push(line);
    return lines;
  }

  // 주어진 상자에 들어갈 때까지 글자 크기를 줄여 가며 줄을 나눕니다.
  function fitText(ctx, text, maxWidth, maxHeight, startSize, minSize, weight, family, lineGap) {
    for (let size = startSize; size >= minSize; size -= 2) {
      ctx.font = `${weight} ${size}px ${family}`;
      const lines = wrap(ctx, text, maxWidth);
      const lh = size * lineGap;
      if (lines.length * lh <= maxHeight) return { size, lines, lh };
    }
    ctx.font = `${weight} ${minSize}px ${family}`;
    return { size: minSize, lines: wrap(ctx, text, maxWidth), lh: minSize * lineGap };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 미세한 종이 결(노이즈) — 한 번 만들어 무늬로 반복
  let grainCanvas = null;
  function grain() {
    if (grainCanvas) return grainCanvas;
    const g = document.createElement('canvas'); g.width = g.height = 160;
    const gx = g.getContext('2d'); const img = gx.createImageData(160, 160);
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < img.data.length; i += 4) { const v = 255 * r(); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    gx.putImageData(img, 0, 0); grainCanvas = g; return g;
  }

  function drawBackground(ctx, W, H) {
    const lg = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, H);
    lg.addColorStop(0, C.b1); lg.addColorStop(0.38, C.b2); lg.addColorStop(0.74, C.b3); lg.addColorStop(1, C.b4);
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

    const bloom = ctx.createRadialGradient(W * 0.5, -H * 0.05, 0, W * 0.5, -H * 0.05, W * 1.05);
    bloom.addColorStop(0, 'rgba(150,200,255,0.34)'); bloom.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H);

    const shade = ctx.createRadialGradient(-W * 0.1, H * 1.05, 0, -W * 0.1, H * 1.05, W * 0.9);
    shade.addColorStop(0, 'rgba(5,20,55,0.5)'); shade.addColorStop(1, 'rgba(5,20,55,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // 네 갈래 새벽별
  function drawStar(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = 'rgba(190,225,255,0.9)'; ctx.shadowBlur = r * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
    ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
    ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0);
    ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
    ctx.fill(); ctx.fill(); ctx.restore();
  }

  // 가장자리로 갈수록 사라지는 가는 수평선 + 별
  function drawHorizon(ctx, W, y, starX, r) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.18, 'rgba(255,255,255,0.3)');
    g.addColorStop(starX / W, 'rgba(255,255,255,0.6)'); g.addColorStop(0.86, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y - 1, W, 2);
    drawStar(ctx, starX, y, r);
  }

  function spaced(ctx, text, x, y, spacing) {
    // 글자 사이를 띄워 가운데 정렬로 쓰기
    const chars = [...text]; const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = x - total / 2; const align = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
    ctx.textAlign = align;
  }

  /**
   * 말씀 카드를 캔버스로 그립니다.
   * format: 'story'(1080×1920, 배경화면) | 'post'(1080×1350, 공유용)
   */
  async function render(verse, name, format) {
    if (format === 'screen') return renderScreen(verse, name);
    await ensureFonts();
    const cfg = window.APP_CONFIG;
    const W = 1080, H = format === 'story' ? 1920 : 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    drawBackground(ctx, W, H);
    ctx.textAlign = 'center';

    // 머리: 수평선과 별, 그 아래 한 줄
    const story = format === 'story';
    const hy = story ? 230 : 92;
    drawHorizon(ctx, W, hy, W * 0.5, story ? 34 : 28);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = `500 ${story ? 30 : 26}px ${SANS}`;
    spaced(ctx, `${cfg.YEAR} ${cfg.CHURCH} 약속의 말씀`, W / 2, hy + (story ? 78 : 62), story ? 8 : 7);

    // 종이 카드
    const px = 76, pw = W - 152;
    const py = hy + (story ? 140 : 108);
    const ph = H - py - (story ? 300 : 96);
    ctx.save();
    ctx.shadowColor = 'rgba(4,16,45,0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    roundRect(ctx, px, py, pw, ph, 30); ctx.fillStyle = C.paper; ctx.fill();
    ctx.restore();
    roundRect(ctx, px + 18, py + 18, pw - 36, ph - 36, 18);
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();

    const innerX = px + 90, innerW = pw - 180;
    let y = py + 120;

    // 이름
    if (name) {
      ctx.fillStyle = C.sub;
      ctx.font = `500 32px ${SANS}`;
      spaced(ctx, `${name} 님께 주신 말씀`, W / 2, y, 3);
      y += 60;
    }

    // 본문 + 장절 + 축복 문장을 한 묶음으로 보고, 카드 안 남은 공간의 가운데에 놓습니다.
    const regionTop = y, regionBottom = py + ph - 70;
    const regionH = regionBottom - regionTop;
    const bl = verse.blessing ? fitText(ctx, verse.blessing, innerW, 110, 34, 26, 500, SANS, 1.5) : null;
    const tailH = 40 /*간격*/ + 48 /*장절*/ + (bl ? 26 + bl.lines.length * bl.lh : 0);
    const fit = fitText(ctx, verse.text, innerW, regionH - tailH, 60, 32, 700, SERIF, 1.7);
    const groupH = fit.lines.length * fit.lh + tailH;
    let ty = regionTop + Math.max(0, (regionH - groupH) / 2) + fit.size;

    ctx.fillStyle = C.ink;
    ctx.font = `700 ${fit.size}px ${SERIF}`;
    for (const ln of fit.lines) { ctx.fillText(ln, W / 2, ty); ty += fit.lh; }

    // 장절 (양옆 가는 선)
    const refY = ty - fit.lh + fit.size * 0.62 + 40 + 40;
    ctx.fillStyle = C.accent;
    ctx.font = `700 38px ${SERIF}`;
    ctx.fillText(verse.ref, W / 2, refY);
    const rw = ctx.measureText(verse.ref).width / 2 + 24;
    ctx.fillStyle = 'rgba(21,79,152,0.35)';
    ctx.fillRect(W / 2 - rw - 36, refY - 13, 36, 2); ctx.fillRect(W / 2 + rw, refY - 13, 36, 2);

    // 축복 한 줄
    if (bl) {
      ctx.fillStyle = C.sub;
      ctx.font = `500 ${bl.size}px ${SANS}`;
      let by = refY + 26 + bl.lh;
      for (const ln of bl.lines) { ctx.fillText(ln, W / 2, by); by += bl.lh; }
    }

    // 바닥글
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `500 24px ${SANS}`;
    spaced(ctx, `${cfg.APP_NAME}  ·  개역개정  ·  서울한강체`, W / 2, H - (story ? 170 : 38), 6);
    return cv;
  }


  // 새봄교회 로고(흰색) — 한 번만 불러 둡니다.
  let logoPromise = null;
  function loadLogo() {
    if (logoPromise) return logoPromise;
    logoPromise = new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = (window.SAEBOM_LOGO_SRC || 'images/saebom-logo.png');
    });
    return logoPromise;
  }

  /**
   * 앱 화면과 같은 모양의 그림(1080×1920):
   * 수평선과 별 → 연도 → '약속의 말씀' → 받은 말씀 → 새봄교회 로고
   */
  async function renderScreen(verse, name) {
    await ensureFonts();
    const cfg = window.APP_CONFIG;
    const W = 1080, H = 1920;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    drawBackground(ctx, W, H);
    ctx.textAlign = 'center';

    drawHorizon(ctx, W, 290, W * 0.5, 52);

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `500 80px ${SERIF}`;
    spaced(ctx, String(cfg.YEAR), W / 2 + 12, 500, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = `500 101px ${SERIF}`;
    spaced(ctx, '약속의 말씀', W / 2, 670, 8);

    // 받은 말씀: 이름 → 본문 → 장절 → 축복 한 줄을 한 묶음으로 가운데에
    const top = 780, bottom = 1560, innerW = 860;
    const nameH = name ? 100 : 0;
    const bl = verse.blessing ? fitText(ctx, verse.blessing, innerW, 150, 44, 34, 500, SANS, 1.6) : null;
    const tailH = 70 + 54 + (bl ? 40 + bl.lines.length * bl.lh : 0);
    const fit = fitText(ctx, verse.text, innerW, bottom - top - nameH - tailH, 66, 40, 700, SERIF, 1.75);
    const groupH = nameH + fit.lines.length * fit.lh + tailH;
    let y = top + Math.max(0, (bottom - top - groupH) / 2);

    if (name) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `500 44px ${SANS}`;
      spaced(ctx, `${name} 님께 주신 말씀`, W / 2, y + 44, 4);
      y += nameH;
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${fit.size}px ${SERIF}`;
    let ty = y + fit.size;
    for (const ln of fit.lines) { ctx.fillText(ln, W / 2, ty); ty += fit.lh; }

    const refY = ty - fit.lh + 70 + 54;
    ctx.font = `700 52px ${SERIF}`;
    ctx.fillText(verse.ref, W / 2, refY);
    const rw = ctx.measureText(verse.ref).width / 2 + 30;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(W / 2 - rw - 64, refY - 17, 64, 2); ctx.fillRect(W / 2 + rw, refY - 17, 64, 2);

    if (bl) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `500 ${bl.size}px ${SANS}`;
      let by = refY + 40 + bl.lh;
      for (const ln of bl.lines) { ctx.fillText(ln, W / 2, by); by += bl.lh; }
    }

    // 맨 아래 가운데 새봄교회 로고
    const logo = await loadLogo();
    if (logo) {
      const lw = 420, lh = lw * logo.naturalHeight / logo.naturalWidth;
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.drawImage(logo, (W - lw) / 2, 1790 - lh, lw, lh);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `500 22px ${SANS}`;
    spaced(ctx, '개역개정  ·  글꼴 서울한강체 ⓒ서울특별시', W / 2, H - 50, 4);
    return cv;
  }

  function toBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }

  window.PromiseCard = { render, toBlob, colors: C };
})();
