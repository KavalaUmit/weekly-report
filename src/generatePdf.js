import { jsPDF } from 'jspdf';

const STATUS_ROWS = [
  { key: 'highlight',   label: 'Highlights',                    r: 108, g: 195, b: 108 },
  { key: 'lowlight',    label: 'Lowlights',                     r: 230, g: 160, b:  50 },
  { key: 'waiting',     label: 'Waiting For\nExecutive Support', r:  50, g:  80, b: 160 },
  { key: 'information', label: 'Information',                    r:  40, g: 180, b: 180 },
  { key: 'progress',    label: 'Progress',                      r:  16, g: 185, b: 129 },
];

// Returns the Monday of the week AFTER weekNumber (i.e. "next Monday")
function getNextMonday(weekNumber, year) {
  const jan1     = new Date(year, 0, 1);
  const jan1Day  = jan1.getDay(); // 0=Sun,1=Mon,...6=Sat
  const toMon    = jan1Day === 0 ? 1 : jan1Day === 1 ? 0 : 8 - jan1Day;
  const week1Mon = new Date(year, 0, 1 + toMon);
  const nextMon  = new Date(week1Mon);
  nextMon.setDate(week1Mon.getDate() + weekNumber * 7); // week N+1 Monday
  return nextMon;
}

function formatDate(d) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

async function loadFontBase64(url) {
  const res    = await fetch(url);
  const buf    = await res.arrayBuffer();
  const bytes  = new Uint8Array(buf);
  let binary   = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function formatPdfDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function parseBoldSegments(text) {
  const segs = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
    segs.push({ text: m[1], bold: true });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ text: text.slice(last), bold: false });
  return segs;
}

// Split bold-marked text into word-level tokens preserving bold flag
function getBoldTokens(text) {
  const tokens = [];
  parseBoldSegments(text).forEach(seg => {
    let i = 0;
    const raw = seg.text;
    while (i < raw.length) {
      const sp = raw.indexOf(' ', i);
      if (sp === -1) { tokens.push({ text: raw.slice(i), bold: seg.bold }); break; }
      tokens.push({ text: raw.slice(i, sp + 1), bold: seg.bold });
      i = sp + 1;
    }
  });
  return tokens;
}

// Count how many lines bold-marked text occupies at given maxWidth
function measureBoldLines(doc, text, maxWidth) {
  if (!text.includes('**')) {
    doc.setFont('Calibri', 'normal');
    return doc.splitTextToSize(text, maxWidth).length;
  }
  let cx = 0, lines = 1;
  getBoldTokens(text).forEach(tok => {
    doc.setFont('Calibri', tok.bold ? 'bold' : 'normal');
    const w = doc.getTextWidth(tok.text);
    if (cx > 0 && cx + w > maxWidth) { cx = 0; lines++; }
    cx += w;
  });
  doc.setFont('Calibri', 'normal');
  return lines;
}

// Render bold-marked text with proper word-level line wrapping
function renderBoldWrapped(doc, text, x, y, maxWidth, lineH) {
  if (!text.includes('**')) {
    doc.setFont('Calibri', 'normal');
    const wrapped = doc.splitTextToSize(text, maxWidth);
    doc.text(wrapped, x, y);
    return wrapped.length;
  }
  let cx = 0, curY = y, lines = 1;
  getBoldTokens(text).forEach(tok => {
    doc.setFont('Calibri', tok.bold ? 'bold' : 'normal');
    const w = doc.getTextWidth(tok.text);
    if (cx > 0 && cx + w > maxWidth) { cx = 0; curY += lineH; lines++; }
    doc.text(tok.text, x + cx, curY);
    cx += w;
  });
  doc.setFont('Calibri', 'normal');
  return lines;
}

function getImgFormat(dataUrl) {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return 'PNG';
}

function loadImageDimensions(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ ratio: (img.naturalWidth || 1) / (img.naturalHeight || 1) });
    img.onerror = () => resolve({ ratio: 1 });
    img.src = dataUrl;
  });
}

function loadIconAsPng(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || 64;
      canvas.height = img.naturalHeight || 64;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generatePdf({ actions, actionStatuses, userData, weeks, formData }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ─── LOAD CALIBRI FONTS ────────────────────────────────────────────────────
  try {
    const [regB64, boldB64] = await Promise.all([
      loadFontBase64(process.env.PUBLIC_URL + '/calibri.ttf'),
      loadFontBase64(process.env.PUBLIC_URL + '/calibrib.ttf'),
    ]);
    doc.addFileToVFS('calibri.ttf',  regB64);
    doc.addFileToVFS('calibrib.ttf', boldB64);
    doc.addFont('calibri.ttf',  'Calibri', 'normal');
    doc.addFont('calibrib.ttf', 'Calibri', 'bold');
  } catch (_) {
    // fallback to helvetica if fonts can't be loaded
  }

  // ─── LOAD ICONS (converted to PNG via canvas) ─────────────────────────────
  const [highlightIconB64, lowlightIconB64, informationIconB64, waitingIconB64, progressIconB64, headerLogoPng] =
    await Promise.all([
      loadIconAsPng(process.env.PUBLIC_URL + '/pdfimages/highlight-icon.png'),
      loadIconAsPng(process.env.PUBLIC_URL + '/pdfimages/lowlight-icon.png'),
      loadIconAsPng(process.env.PUBLIC_URL + '/pdfimages/information-icon.png'),
      loadIconAsPng(process.env.PUBLIC_URL + '/pdfimages/waiting-icon.png'),
      loadIconAsPng(process.env.PUBLIC_URL + '/pdfimages/progress-icon.png'),
      loadIconAsPng(process.env.PUBLIC_URL + '/pdfimages/pdf-logo.png'),
    ]);

  // ─── PRE-LOAD INLINE IMAGE DIMENSIONS ───────────────────────────────────────
  const imgRatioCache = {};
  const allImgUrls = new Set();
  actions.forEach(a => (a.actionItems || []).forEach(i => { if (i.type === 'image' && i.value) allImgUrls.add(i.value); }));
  await Promise.all([...allImgUrls].map(async url => {
    imgRatioCache[url] = (await loadImageDimensions(url)).ratio;
  }));

  const pageW  = 210;
  const pageH  = 297;
  const mL     = 15;
  const mR     = 15;
  const cW     = pageW - mL - mR; // 180 mm

  // ─── HEADER (Option A: Navy + Teal accent stripe) ──────────────────────────
  const hY      = 15;
  const hH      = 30;
  const accentW = 4; // mm — left teal stripe

  // Dark navy background
  doc.setFillColor(15, 40, 80);
  doc.rect(mL, hY, cW, hH, 'F');

  // Left teal accent stripe
  doc.setFillColor(72, 199, 199);
  doc.rect(mL, hY, accentW, hH, 'F');

  // Week data
  const weekObj  = weeks.find(w => String(w.WeekNumber) === String(formData.week));
  const weekNum  = weekObj ? weekObj.WeekNumber : '';
  const nextMon  = weekObj ? getNextMonday(weekObj.WeekNumber, weekObj.Year) : new Date();

  const posNum = userData.PositionNumber || 0;
  const cx = mL + cW / 2; // horizontal centre of header

  if (posNum >= 5) {
    // GM — no unit/line; large centred week number + date
    doc.setTextColor(255, 255, 255);
    doc.setFont('Calibri', 'bold');
    doc.setFontSize(17);
    doc.text(`${weekNum}. HAFTA`, cx, hY + 12, { align: 'center' });
    doc.setTextColor(130, 220, 220);
    doc.setFont('Calibri', 'normal');
    doc.setFontSize(11);
    doc.text(`${formatDate(nextMon)}  —  Haftalık Raporu`, cx, hY + 23, { align: 'center' });
  } else {
    // Unit manager / EVP — title line + week info
    const titleText = posNum === 4 ? (userData.LineName || '') : (userData.UnitName || '');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Calibri', 'bold');
    doc.setFontSize(14);
    doc.text(titleText, mL + accentW + 6, hY + 11);
    const line2 = `${weekNum}. Hafta  |  ${formatDate(nextMon)} Haftalık Raporu`;
    doc.setTextColor(130, 220, 220);
    doc.setFont('Calibri', 'normal');
    doc.setFontSize(11);
    doc.text(line2, mL + accentW + 6, hY + 22);
  }

  // Subtle teal bottom border line
  doc.setDrawColor(72, 199, 199);
  doc.setLineWidth(0.5);
  doc.line(mL, hY + hH, mL + cW, hY + hH);

  // ─── TABLE ─────────────────────────────────────────────────────────────────
  const leftCW  = 45;   // left icon column width
  const rightCW = cW - leftCW;
  const minH    = 32;   // minimum row height mm
  const padX    = 4;
  const padY    = 4;

  let curY = hY + hH;

  const lineH    = 3.8; // mm per text line (matches jsPDF ~3.65mm for 9pt)
  const headerH  = 6;   // mm per type-header line
  const groupGap = 3;   // mm gap between type groups
  const subIndent = 4;  // mm extra left indent for sub-entries
  const bulletGap = 1.5; // mm extra gap after each bullet item
  const maxTextW = rightCW - padX * 2;
  const maxImgW   = maxTextW;
  const maxImgH   = 40; // mm — max image height in PDF

  for (const row of STATUS_ROWS) {
    // Collect status-matching actions
    const matched = actions.filter(a => actionStatuses[a.id] === row.key);

    // Group by type+date when IncludeDate=true & Header non-empty, else by type only
    const byGroup = {};
    const groupHeaderMap = {};
    const groupSortMap = {};
    matched.forEach(a => {
      const typeName = a.type || '';
      const rawHeader = a.typeHeader ?? '';
      const useDateHeader = a.includeDate && rawHeader;
      console.log('[PDF DEBUG]', { id: a.id, type: typeName, typeHeader: rawHeader, includeDate: a.includeDate, date: a.date, useDateHeader: !!useDateHeader });
      const groupKey = useDateHeader ? `${typeName}\x00${a.date}` : typeName;
      if (!byGroup[groupKey]) byGroup[groupKey] = [];
      groupHeaderMap[groupKey] = useDateHeader
        ? `${formatPdfDate(a.date)} tarihinde ${rawHeader};`
        : rawHeader;
      groupSortMap[groupKey] = a.typeSortOrder ?? 0;
      (a.actionItems || []).forEach((i, idx) => {
        if (!((i.type === 'text' && i.value && i.value.trim()) || (i.type === 'image' && i.value))) return;
        byGroup[groupKey].push(
          i.type === 'image'
            ? { type: 'image', value: i.value, isSub: idx > 0 }
            : { type: 'text', value: i.value.trim(), isSub: idx > 0 }
        );
      });
    });
    const typeGroups = Object.entries(byGroup)
      .sort(([ka], [kb]) => {
        const ha = groupHeaderMap[ka] ?? '';
        const hb = groupHeaderMap[kb] ?? '';
        if (!ha && hb) return -1;
        if (ha && !hb) return 1;
        return (groupSortMap[ka] ?? 0) - (groupSortMap[kb] ?? 0);
      });

    // ── Layout pass: assign every item to a page segment ─────────────────────
    doc.setFontSize(9);
    const iconDataUrlMap = { highlight: highlightIconB64, lowlight: lowlightIconB64, information: informationIconB64, waiting: waitingIconB64, progress: progressIconB64 };
    const contentBottom = pageH - 15;
    const segments = [];
    let curSeg = { startY: curY, items: [] };
    let y = curY + padY + 5;

    const checkBreak = (neededH) => {
      if (y + neededH > contentBottom && y > curSeg.startY + padY + 5) {
        curSeg.endY = Math.max(y + padY, curSeg.startY + minH);
        segments.push(curSeg);
        curSeg = { startY: 15, items: [] };
        y = 15 + padY + 5;
      }
    };

    typeGroups.forEach(([groupKey, bullets], gi) => {
      const displayHeader = groupHeaderMap[groupKey] ?? '';
      if (displayHeader) {
        checkBreak(headerH);
        curSeg.items.push({ kind: 'header', text: displayHeader, y });
        y += headerH;
      }
      bullets.forEach(b => {
        const indent = b.isSub ? subIndent : 0;
        const bX = mL + leftCW + padX + indent;
        const bW = maxTextW - indent;
        const itemH = b.type === 'image'
          ? Math.min(maxImgH, maxImgW / (imgRatioCache[b.value] || 1)) + lineH
          : measureBoldLines(doc, '• ' + b.value, bW) * lineH + bulletGap;
        checkBreak(itemH);
        curSeg.items.push({ kind: 'bullet', b, bX, bW, y, itemH });
        y += itemH;
      });
      if (gi < typeGroups.length - 1) y += groupGap;
    });
    curSeg.endY = Math.max(y + padY, curSeg.startY + minH);
    segments.push(curSeg);

    // ── Render pass: draw each segment ────────────────────────────────────────
    segments.forEach((seg, si) => {
      if (si > 0) doc.addPage();
      const segH = seg.endY - seg.startY;

      // Background
      doc.setFillColor(251, 252, 255);
      doc.rect(mL, seg.startY, cW, segH, 'F');

      // Borders
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.3);
      doc.rect(mL, seg.startY, cW, segH);
      doc.line(mL + leftCW, seg.startY, mL + leftCW, seg.startY + segH);

      // Icon + label (first segment only)
      if (si === 0) {
        const icx = mL + leftCW / 2;
        const icy = seg.startY + segH / 2 - 5;
        const cr = 9;
        const iconDataUrl = iconDataUrlMap[row.key];
        if (iconDataUrl) {
          doc.addImage(iconDataUrl, 'PNG', icx - cr, icy - cr, cr * 2, cr * 2);
        } else {
          doc.setFillColor(row.r, row.g, row.b);
          doc.circle(icx, icy, cr, 'F');
        }
        doc.setTextColor(60, 60, 60);
        doc.setFont('Calibri', 'bold');
        doc.setFontSize(7);
        row.label.split('\n').forEach((part, i) => {
          doc.text(part, icx, icy + cr + 4 + i * 4, { align: 'center' });
        });
      }

      // Content items
      seg.items.forEach(item => {
        if (item.kind === 'header') {
          doc.setFont('Calibri', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          doc.text(item.text, mL + leftCW + padX, item.y);
        } else {
          doc.setFont('Calibri', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          if (item.b.type === 'image') {
            const ratio = imgRatioCache[item.b.value] || 1;
            let imgW = Math.min(item.bW, 60);
            let imgH = imgW / ratio;
            if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * ratio; }
            const imgX = item.bX + (item.bW - imgW) / 2;
            try { doc.addImage(item.b.value, getImgFormat(item.b.value), imgX, item.y, imgW, imgH); } catch (_) {}
          } else {
            renderBoldWrapped(doc, '• ' + item.b.value, item.bX, item.y, item.bW, lineH);
          }
        }
      });
    });

    curY = segments[segments.length - 1].endY;
  }

  // Bottom border line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(mL, curY, mL + cW, curY);

  // ─── FOOTER ────────────────────────────────────────────────────────────────

  // Save
  const name = `Haftalik_Rapor_H${formData.week || 'X'}.pdf`;
  doc.save(name);
}
