// 말씀 카드 이미지(캔버스) 그리기 — 개인 모드·예배당 모드가 함께 씁니다.
(function () {
  const C = {
    night: '#141b3a',
    dusk: '#2b2a5e',
    dawn: '#e98a6b',
    glow: '#f7c873',
    gold: '#c9a34a',
    paper: '#fffaf0',
    ink: '#23253a',
    sub: '#7a6a4f',
  };

  const SERIF = '"Noto Serif KR", serif';
  const SANS = '"Noto Sans KR", sans-serif';

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

  // 새벽 하늘 배경 + 떠오르는 해 + 별
  function drawSky(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.night);
    g.addColorStop(0.55, C.dusk);
    g.addColorStop(1, C.dawn);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sun = ctx.createRadialGradient(W / 2, H * 1.02, 10, W / 2, H * 1.02, W * 0.75);
    sun.addColorStop(0, 'rgba(255,226,150,0.95)');
    sun.addColorStop(0.35, 'rgba(247,200,115,0.45)');
    sun.addColorStop(1, 'rgba(247,200,115,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    // 별: 위치를 고정 시드로 만들어 매번 같은 그림이 나오게 합니다.
    let s = 7;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H * 0.45, r = rnd() * 2.2 + 0.6;
      ctx.fillStyle = `rgba(255,248,225,${0.35 + rnd() * 0.55})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 새싹 문양 (새봄)
  function drawSprout(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.quadraticCurveTo(s * 0.04, 0, 0, -s * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-s * 0.15, -s * 0.35, -s * 0.55, -s * 0.35, -s * 0.6, -s * 0.05);
    ctx.bezierCurveTo(-s * 0.4, s * 0.05, -s * 0.12, s * 0.02, 0, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.1);
    ctx.bezierCurveTo(s * 0.15, -s * 0.5, s * 0.6, -s * 0.55, s * 0.68, -s * 0.2);
    ctx.bezierCurveTo(s * 0.45, -s * 0.05, s * 0.15, -s * 0.05, 0, -s * 0.1); ctx.fill();
    ctx.restore();
  }

  /**
   * 말씀 카드를 캔버스로 그립니다.
   * format: 'story'(1080×1920, 배경화면) | 'post'(1080×1350, 공유용)
   */
  async function render(verse, name, format) {
    await ensureFonts();
    const cfg = window.APP_CONFIG;
    const W = 1080, H = format === 'story' ? 1920 : 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    drawSky(ctx, W, H);

    // 상단 머리글
    const topY = format === 'story' ? 250 : 150;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.glow;
    ctx.font = `700 34px ${SANS}`;
    ctx.fillText(`${cfg.YEAR} ${cfg.CHURCH} 약속의 말씀`, W / 2, topY);
    drawSprout(ctx, W / 2, topY - 70, format === 'story' ? 70 : 54, C.glow);

    // 종이 카드
    const px = 80, pw = W - 160;
    const py = topY + 50;
    const ph = H - py - (format === 'story' ? 280 : 110);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    roundRect(ctx, px, py, pw, ph, 36);
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.restore();
    roundRect(ctx, px + 22, py + 22, pw - 44, ph - 44, 24);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke();

    const innerX = px + 90, innerW = pw - 180;
    let y = py + 120;

    // 이름
    if (name) {
      ctx.fillStyle = C.sub;
      ctx.font = `500 36px ${SANS}`;
      ctx.fillText(`${name} 님께 주신 말씀`, W / 2, y);
      y += 40;
      ctx.strokeStyle = 'rgba(201,163,74,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 60, y); ctx.lineTo(W / 2 + 60, y); ctx.stroke();
      y += 50;
    }

    // 본문 + 장절 + 축복 문장을 한 묶음으로 보고, 카드 안 남은 공간의 가운데에 놓습니다.
    const regionTop = y, regionBottom = py + ph - 70;
    const regionH = regionBottom - regionTop;
    const bl = verse.blessing ? fitText(ctx, verse.blessing, innerW, 110, 34, 26, 500, SANS, 1.5) : null;
    const tailH = 40 /*간격*/ + 48 /*장절*/ + (bl ? 26 + bl.lines.length * bl.lh : 0);
    const fit = fitText(ctx, verse.text, innerW, regionH - tailH, 64, 34, 700, SERIF, 1.62);
    const groupH = fit.lines.length * fit.lh + tailH;
    let ty = regionTop + Math.max(0, (regionH - groupH) / 2) + fit.size;

    ctx.fillStyle = C.ink;
    ctx.font = `700 ${fit.size}px ${SERIF}`;
    for (const ln of fit.lines) { ctx.fillText(ln, W / 2, ty); ty += fit.lh; }

    // 장절
    const refY = ty - fit.lh + fit.size * 0.62 + 40 + 40;
    ctx.fillStyle = C.gold;
    ctx.font = `700 40px ${SERIF}`;
    ctx.fillText(verse.ref, W / 2, refY);

    // 축복 한 줄
    if (bl) {
      ctx.fillStyle = C.sub;
      ctx.font = `500 ${bl.size}px ${SANS}`;
      let by = refY + 26 + bl.lh;
      for (const ln of bl.lines) { ctx.fillText(ln, W / 2, by); by += bl.lh; }
    }

    // 바닥글
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    ctx.font = `500 30px ${SANS}`;
    ctx.fillText(`${cfg.APP_NAME} · 개역개정`, W / 2, H - (format === 'story' ? 150 : 45));
    return cv;
  }

  function toBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }

  window.PromiseCard = { render, toBlob, drawSprout, colors: C };
})();
