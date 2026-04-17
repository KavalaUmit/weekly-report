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

  const pageW  = 210;
  const pageH  = 297;
  const mL     = 15;
  const mR     = 15;
  const cW     = pageW - mL - mR; // 180 mm

  // ─── HEADER ────────────────────────────────────────────────────────────────
  const hY    = 15;
  const hH    = 28;                 // slightly taller for 14pt lines
  const tealW = cW * 0.55;
  const rightW = cW - tealW;

  // Teal left block
  doc.setFillColor(72, 199, 199);
  doc.rect(mL, hY, tealW, hH, 'F');

  // White right block
  doc.setFillColor(255, 255, 255);
  doc.rect(mL + tealW, hY, rightW, hH, 'F');

  // Logo in right block — scaled to fit with padding
  if (headerLogoPng) {
    const logoMaxH = hH - 6;
    const logoMaxW = rightW - 8;
    const img = new Image();
    img.src = headerLogoPng;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
    let logoW = logoMaxW;
    let logoH = logoW / ratio;
    if (logoH > logoMaxH) { logoH = logoMaxH; logoW = logoH * ratio; }
    const logoX = mL + tealW + (rightW - logoW) / 2;
    const logoY = hY + (hH - logoH) / 2;
    doc.addImage(headerLogoPng, 'PNG', logoX, logoY, logoW, logoH);
  }

  // Week data
  const weekObj   = weeks.find(w => String(w.WeekNumber) === String(formData.week));
  const weekNum   = weekObj ? weekObj.WeekNumber : '';
  const weekYear  = weekObj ? weekObj.Year       : new Date().getFullYear();
  const nextMon   = weekObj ? getNextMonday(weekObj.WeekNumber, weekObj.Year) : new Date();

  // Line 1 – "{UnitName} Haftalık Raporu"
  const line1 = `${userData.UnitName || ''} Haftalık Raporu`;
  doc.setTextColor(255, 255, 255);
  doc.setFont('Calibri', 'bold');
  doc.setFontSize(14);
  doc.text(line1, mL + 5, hY + 11);

  // Line 2 – "{WeekNumber}. Hafta | dd.MM.yyyy"
  const line2 = `${weekNum}. Hafta | ${formatDate(nextMon)}`;
  doc.setFont('Calibri', 'normal');
  doc.setFontSize(14);
  doc.text(line2, mL + 5, hY + 22);

  // Border around header
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(mL, hY, cW, hH);
  doc.line(mL + tealW, hY, mL + tealW, hY + hH);

  // ─── TABLE ─────────────────────────────────────────────────────────────────
  const leftCW  = 45;   // left icon column width
  const rightCW = cW - leftCW;
  const minH    = 32;   // minimum row height mm
  const padX    = 4;
  const padY    = 4;

  let curY = hY + hH;

  const lineH    = 5;   // mm per text line
  const headerH  = 6;   // mm per type-header line
  const groupGap = 3;   // mm gap between type groups
  const maxTextW = rightCW - padX * 2;

  for (const row of STATUS_ROWS) {
    // Collect status-matching actions
    const matched = actions.filter(a => actionStatuses[a.id] === row.key);

    // Group by Tür (type), preserving insertion order
    const byType = {};
    matched.forEach(a => {
      const typeName = a.type || '';
      if (!byType[typeName]) byType[typeName] = [];
      (a.actionItems || [])
        .filter(i => i.type === 'text' && i.value && i.value.trim())
        .forEach(i => byType[typeName].push(i.value.trim()));
    });
    const typeGroups = Object.entries(byType);

    // Measure total right-cell height
    doc.setFontSize(9);
    let contentH = 0;
    typeGroups.forEach(([typeName, bullets], gi) => {
      if (typeName) contentH += headerH;
      bullets.forEach(b => {
        contentH += doc.splitTextToSize('• ' + b, maxTextW).length * lineH;
      });
      if (gi < typeGroups.length - 1) contentH += groupGap;
    });

    const rowH = Math.max(minH, contentH + padY * 2 + 4);

    // Page break check
    if (curY + rowH > pageH - 15) {
      doc.addPage();
      curY = 15;
    }

    // Row background
    doc.setFillColor(251, 252, 255);
    doc.rect(mL, curY, cW, rowH, 'F');

    // Row border
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.rect(mL, curY, cW, rowH);
    doc.line(mL + leftCW, curY, mL + leftCW, curY + rowH);

    // Icon / circle in left cell
    const cx = mL + leftCW / 2;
    const cy = curY + rowH / 2 - 5;
    const cr = 9;
    const iconDataUrlMap = { highlight: highlightIconB64, lowlight: lowlightIconB64, information: informationIconB64, waiting: waitingIconB64, progress: progressIconB64 };
    const iconDataUrl = iconDataUrlMap[row.key];
    if (iconDataUrl) {
      doc.addImage(iconDataUrl, 'PNG', cx - cr, cy - cr, cr * 2, cr * 2);
    } else {
      doc.setFillColor(row.r, row.g, row.b);
      doc.circle(cx, cy, cr, 'F');
    }

    // Status label below icon
    doc.setTextColor(60, 60, 60);
    doc.setFont('Calibri', 'bold');
    doc.setFontSize(7);
    const labelParts = row.label.split('\n');
    labelParts.forEach((part, i) => {
      doc.text(part, cx, cy + cr + 4 + i * 4, { align: 'center' });
    });

    // Right cell — grouped by Tür
    let textY = curY + padY + 5;
    typeGroups.forEach(([typeName, bullets], gi) => {
      // Type header (bold)
      if (typeName) {
        doc.setFont('Calibri', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text(typeName, mL + leftCW + padX, textY);
        textY += headerH;
      }
      // Bullet items
      doc.setFont('Calibri', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      bullets.forEach(b => {
        const wrapped = doc.splitTextToSize('• ' + b, maxTextW);
        doc.text(wrapped, mL + leftCW + padX, textY);
        textY += wrapped.length * lineH;
      });
      if (gi < typeGroups.length - 1) textY += groupGap;
    });

    curY += rowH;
  }

  // Bottom border line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(mL, curY, mL + cW, curY);

  // ─── FOOTER ────────────────────────────────────────────────────────────────
  doc.setFont('Calibri', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  const today = new Date().toLocaleDateString('tr-TR');
  doc.text(`Oluşturulma tarihi: ${today}`, mL, pageH - 8);
  doc.text(userData.FullName || '', pageW - mR, pageH - 8, { align: 'right' });

  // Save
  const name = `Haftalik_Rapor_H${formData.week || 'X'}.pdf`;
  doc.save(name);
}
