/**
 * generateWord.js
 * Exports the weekly report as a Word-compatible HTML document (.doc).
 * Mirrors generatePdf.js exactly: same STATUS_ROWS order, grouping logic,
 * header format, sort order, bold markers, sub-entry indentation.
 */

// ── Mirrors PDF STATUS_ROWS (same order, same labels) ────────────────────────
const STATUS_ROWS = [
  { key: 'highlight',   label: 'Highlights',                     r: 108, g: 195, b: 108 },
  { key: 'lowlight',    label: 'Lowlights',                      r: 230, g: 160, b:  50 },
  { key: 'waiting',     label: 'Waiting For\nExecutive Support',  r:  50, g:  80, b: 160 },
  { key: 'information', label: 'Information',                     r:  40, g: 180, b: 180 },
  { key: 'progress',    label: 'Progress',                        r:  16, g: 185, b: 129 },
];

// ── Mirrors formatPdfDate from generatePdf.js ────────────────────────────────
function formatPdfDate(dateStr) {
  if (!dateStr || dateStr.startsWith('1900')) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

// ── Mirrors getNextMonday from generatePdf.js ────────────────────────────────
function getNextMonday(weekNumber, year) {
  const jan1    = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const toMon   = jan1Day === 0 ? 1 : jan1Day === 1 ? 0 : 8 - jan1Day;
  const week1Mon = new Date(year, 0, 1 + toMon);
  const nextMon  = new Date(week1Mon);
  nextMon.setDate(week1Mon.getDate() + weekNumber * 7);
  return nextMon;
}

function formatDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// ── Convert **bold** markers to <b> HTML ─────────────────────────────────────
function parseBold(text) {
  return (text || '').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

// ── rgb(r,g,b) helper ─────────────────────────────────────────────────────────
function rgb(r, g, b) { return `rgb(${r},${g},${b})`; }
function rgba(r, g, b, a) { return `rgba(${r},${g},${b},${a})`; }

// ── Fetch any URL and return a base64 data-URL ────────────────────────────────
function loadAsDataUrl(url) {
  return new Promise(resolve => {
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      })
      .catch(() => resolve(null));
  });
}

// ── Load natural image dimensions from a data-URL ────────────────────────────
function loadImageSize(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

export async function generateWord({ actions, actionStatuses, userData, weeks, formData }) {
  const weekObj  = weeks.find(w => String(w.WeekNumber) === String(formData.week));
  const weekNum  = weekObj ? weekObj.WeekNumber : formData.week;
  const nextMon  = weekObj ? getNextMonday(weekObj.WeekNumber, weekObj.Year) : new Date();
  const posNum   = userData.PositionNumber || 0;

  // ── Load status-row icons from pdfimages/ (mirrors PDF icon loading) ─────
  const iconKeys = ['highlight','lowlight','information','waiting','progress'];
  const iconB64  = {};
  await Promise.all(iconKeys.map(async key => {
    iconB64[key] = await loadAsDataUrl(
      `${process.env.PUBLIC_URL}/pdfimages/${key}-icon.png`
    );
  }));

  // ── Pre-load dimensions for every inline image in actions (mirrors PDF) ──
  const imgSizeCache = {};
  const allImgUrls   = new Set();
  actions.forEach(a => (a.actionItems || []).forEach(i => {
    if (i.type === 'image' && i.value) allImgUrls.add(i.value);
  }));
  await Promise.all([...allImgUrls].map(async url => {
    imgSizeCache[url] = await loadImageSize(url);
  }));

  // Right-column content width in pt (A4 595pt − 2×43pt margins − 80pt left col)
  const MAX_IMG_W = 390; // pt
  const MAX_IMG_H = 200; // pt

  // ── Header text — mirrors PDF header logic ──────────────────────────────────
  let headerLine1, headerLine2;
  if (posNum >= 5) {
    headerLine1 = `${weekNum}. HAFTA`;
    headerLine2  = `${formatDate(nextMon)}  —  Haftalık Raporu`;
  } else {
    headerLine1 = posNum === 4 ? (userData.LineName || '') : (userData.UnitName || '');
    headerLine2  = `${weekNum}. Hafta  |  ${formatDate(nextMon)} Haftalık Raporu`;
  }

  // ── Build table rows — mirrors PDF row loop ───────────────────────────────
  const tableRows = STATUS_ROWS.map(row => {
    const matched = actions.filter(a => actionStatuses[a.id] === row.key);
    if (!matched.length) return '';

    // ── Grouping — exact mirror of PDF logic ────────────────────────────────
    const byGroup        = {};
    const groupHeaderMap = {};
    const groupSortMap   = {};

    matched.forEach(a => {
      const typeName    = a.type || '';
      const rawHeader   = a.typeHeader ?? '';
      const useDateHeader = a.includeDate && rawHeader;
      const groupKey    = useDateHeader ? `${typeName}\x00${a.date}` : typeName;

      if (!byGroup[groupKey]) byGroup[groupKey] = [];
      groupHeaderMap[groupKey] = useDateHeader
        ? `${formatPdfDate(a.date)} tarihinde ${rawHeader};`
        : rawHeader;
      groupSortMap[groupKey] = a.typeSortOrder ?? 0;

      // Flatten actionItems into bullets — mirrors PDF bullet push
      (a.actionItems || []).forEach((item, idx) => {
        if (item.type === 'text' && (!item.value || !item.value.trim())) return;
        if (item.type === 'image' && !item.value) return;
        byGroup[groupKey].push({
          type:  item.type,
          value: item.type === 'text' ? item.value.trim() : item.value,
          isSub: idx > 0,
        });
      });
    });

    // ── Sort — empty headers first, then by typeSortOrder ───────────────────
    const typeGroups = Object.entries(byGroup).sort(([ka], [kb]) => {
      const ha = groupHeaderMap[ka] ?? '';
      const hb = groupHeaderMap[kb] ?? '';
      if (!ha && hb) return -1;
      if (ha && !hb) return  1;
      return (groupSortMap[ka] ?? 0) - (groupSortMap[kb] ?? 0);
    });

    // ── Render content HTML ──────────────────────────────────────────────────
    const contentHtml = typeGroups.map(([groupKey], gi) => {
      const header  = groupHeaderMap[groupKey] ?? '';
      const bullets = byGroup[groupKey];
      const gap     = gi < typeGroups.length - 1 ? '<p style="margin:5pt 0 0 0;font-size:4pt;">&nbsp;</p>' : '';

      const headerHtml = header
        ? `<p style="margin:0 0 3pt 0;font-size:9pt;font-weight:bold;color:#1e1e1e;">${header}</p>`
        : '';

      const bulletsHtml = bullets.map(b => {
        if (b.type === 'image') {
          // Clamp to page layout — compute explicit pt dimensions
          const nat    = imgSizeCache[b.value] || { w: 1, h: 1 };
          const ratio  = nat.w / nat.h;
          let imgW = Math.min(MAX_IMG_W, nat.w * 0.75); // px → pt
          let imgH = imgW / ratio;
          if (imgH > MAX_IMG_H) { imgH = MAX_IMG_H; imgW = imgH * ratio; }
          imgW = Math.round(imgW); imgH = Math.round(imgH);
          const ml = b.isSub ? 'margin-left:14pt;' : '';
          return `<p style="margin:2pt 0;${ml}"><img src="${b.value}" width="${imgW}" height="${imgH}" style="display:block;" /></p>`;
        }
        const indent = b.isSub ? 'margin-left:14pt;' : '';
        return `<p style="margin:1pt 0;${indent}font-size:9pt;">&bull;&nbsp;${parseBold(b.value)}</p>`;
      }).join('');

      return headerHtml + bulletsHtml + gap;
    }).join('');

    // ── Left label cell — icon + colour from STATUS_ROWS RGB ─────────────────
    const bg     = rgba(row.r, row.g, row.b, 0.15);
    const border = rgb(row.r, row.g, row.b);
    const iconSrc = iconB64[row.key];
    const iconImg = iconSrc
      ? `<img src="${iconSrc}" width="36" height="36" style="display:block;margin:0 auto 4pt auto;" />`
      : '';
    const labelHtml = row.label.split('\n').map(
      (part, i) => `<p style="margin:${i===0?'0':'2pt'} 0 0 0;font-size:8pt;font-weight:bold;color:${border};">${part}</p>`
    ).join('');

    return `
      <tr>
        <td width="80" style="background:${bg};border:1px solid ${border};text-align:center;vertical-align:middle;padding:8pt 4pt;">
          ${iconImg}${labelHtml}
        </td>
        <td style="border:1px solid #c8d4e0;background:#fbfcff;padding:6pt 10pt;vertical-align:top;">
          ${contentHtml}
        </td>
      </tr>`;
  }).join('');

  const hasContent = STATUS_ROWS.some(r => actions.some(a => actionStatuses[a.id] === r.key));

  // ── Full HTML document ────────────────────────────────────────────────────
  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Haftalık Rapor — ${weekNum}. Hafta</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  @page  { size:A4 portrait; margin:1.5cm 1.8cm; }
  body   { font-family:Calibri,sans-serif; font-size:9pt; color:#222; margin:0; }
  table  { border-collapse:collapse; width:100%; }
  p      { margin:0; padding:0; }
</style>
</head>
<body>

<!-- Header — navy background with teal left accent, mirrors PDF -->
<table style="width:100%;border-collapse:collapse;margin-bottom:10pt;">
  <tr>
    <td width="6" style="background:#48c7c7;padding:0;">&nbsp;</td>
    <td style="background:#0f2850;padding:10pt 14pt;">
      <p style="margin:0;font-size:${posNum>=5?'14':'12'}pt;font-weight:bold;color:white;">${headerLine1}</p>
      <p style="margin:3pt 0 0 0;font-size:9pt;color:#82dcdc;">${headerLine2}</p>
    </td>
  </tr>
</table>

<!-- Content table -->
${hasContent
  ? `<table>${tableRows}</table>`
  : `<p style="color:#888;font-style:italic;font-size:9pt;">Bu hafta için statülü aksiyon bulunmamaktadır.</p>`
}

</body>
</html>`.trim();

  // ── Trigger download ──────────────────────────────────────────────────────
  const blob = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `Haftalik_Rapor_H${weekNum}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
