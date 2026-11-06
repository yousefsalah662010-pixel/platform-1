/* ============================================================
   منصة طاهر البيلي — رسوم بيانية SVG خفيفة بدون مكتبات خارجية
   ============================================================ */
const PALETTE = ['#2563eb','#14b8a6','#7c3aed','#f59e0b','#e11d48','#0d9488'];

/* رسم أعمدة: عمود لكل قيمة */
function barChart(el, labels, values, opts){
  opts = opts || {};
  const W = 640, H = 300, padB = 46, padT = 26, padX = 10;
  const max = Math.max(...values, 1);
  const iw = (W - padX * 2) / values.length;
  let bars = '', grid = '';
  for(let g = 1; g <= 4; g++){
    const y = padT + (H - padB - padT) * (1 - g / 4);
    grid += '<line x1="' + padX + '" y1="' + y + '" x2="' + (W - padX) + '" y2="' + y + '" stroke="#e2e8f0" stroke-dasharray="4 5" stroke-width="1"/>' +
            '<text x="' + (W - padX) + '" y="' + (y - 5) + '" font-size="10" fill="#94a3b8" text-anchor="end">' + fmtNum(Math.round(max * g / 4)) + '</text>';
  }
  values.forEach((v, i) => {
    const bh = Math.max((H - padB - padT) * (v / max), v > 0 ? 4 : 2);
    const x = padX + i * iw + iw * 0.22, w = iw * 0.56, y = H - padB - bh;
    bars += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + bh + '" rx="7" fill="url(#bargrad)"><title>' + esc(labels[i]) + ': ' + fmtNum(v) + (opts.suffix || '') + '</title></rect>';
    bars += '<text x="' + (x + w / 2) + '" y="' + (H - padB + 17) + '" font-size="11" fill="#64748b" text-anchor="middle" font-weight="700">' + esc(labels[i]) + '</text>';
    if(v > 0) bars += '<text x="' + (x + w / 2) + '" y="' + (y - 7) + '" font-size="11" fill="#334155" text-anchor="middle" font-weight="800">' + fmtNum(v) + '</text>';
  });
  el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="رسم بياني">' +
    '<defs><linearGradient id="bargrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + (opts.color || '#2563eb') + '"/><stop offset="100%" stop-color="#14b8a6"/>' +
    '</linearGradient></defs>' + grid + bars + '</svg>';
}

/* رسم خطي مع مساحة مظللة */
function lineChart(el, labels, values, opts){
  opts = opts || {};
  const W = 640, H = 300, padB = 46, padT = 26, padR = 16;
  const max = Math.max(...values, 1);
  const innerW = W - padR - 20, innerH = H - padB - padT;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const pts = values.map((v, i) => [20 + i * step, padT + innerH * (1 - v / max)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + (H - padB) + ' L' + pts[0][0].toFixed(1) + ',' + (H - padB) + ' Z';
  let labelsSvg = '', grid = '';
  for(let g = 1; g <= 4; g++){
    const y = padT + innerH * (1 - g / 4);
    grid += '<line x1="20" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e2e8f0" stroke-dasharray="4 5"/>';
  }
  const tick = Math.ceil(labels.length / 7);
  labels.forEach((lb, i) => {
    if(i % tick !== 0 && i !== labels.length - 1) return;
    labelsSvg += '<text x="' + pts[i][0].toFixed(1) + '" y="' + (H - padB + 17) + '" font-size="10" fill="#64748b" text-anchor="middle" font-weight="600">' + esc(lb) + '</text>';
  });
  let dots = '';
  pts.forEach(p => { dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4" fill="#fff" stroke="' + (opts.color || '#2563eb') + '" stroke-width="2.4"/>'; });
  el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="رسم بياني خطي">' + grid +
    '<path d="' + area + '" fill="url(#linegrad)" opacity=".18"/>' +
    '<defs><linearGradient id="linegrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + (opts.color || '#2563eb') + '"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>' +
    '<path d="' + path + '" fill="none" stroke="' + (opts.color || '#2563eb') + '" stroke-width="3" stroke-linecap="round"/>' +
    dots + labelsSvg + '</svg>';
}

/* رسم دائري مجوّف */
function donutChart(el, items){
  const total = items.reduce((a, it) => a + it.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let off = 0, segs = '', legend = '';
  items.forEach((it, i) => {
    const frac = it.value / total;
    const len = frac * C;
    segs += '<circle cx="95" cy="95" r="' + R + '" fill="none" stroke="' + (it.color || PALETTE[i % PALETTE.length]) +
      '" stroke-width="26" stroke-dasharray="' + len.toFixed(1) + ' ' + (C - len).toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 95 95)"><title>' +
      esc(it.label) + ': ' + fmtNum(it.value) + '</title></circle>';
    off += len;
    legend += '<li><span class="dot" style="background:' + (it.color || PALETTE[i % PALETTE.length]) + '"></span>' + esc(it.label) +
      '<span class="val">' + fmtNum(it.value) + ' (' + Math.round(frac * 100) + '%)</span></li>';
  });
  el.innerHTML = '<div class="flex" style="gap:22px;flex-wrap:wrap;justify-content:center">' +
    '<svg viewBox="0 0 190 190" style="width:190px;flex-shrink:0" role="img" aria-label="رسم دائري">' +
    '<circle cx="95" cy="95" r="' + R + '" fill="none" stroke="#f1f5f9" stroke-width="26"/>' + segs +
    '<text x="95" y="90" text-anchor="middle" font-size="26" font-weight="900" fill="#1e293b">' + fmtNum(total) + '</text>' +
    '<text x="95" y="112" text-anchor="middle" font-size="12" fill="#64748b" font-weight="700">الإجمالي</text></svg>' +
    '<ul class="legend" style="min-width:200px">' + legend + '</ul></div>';
}
