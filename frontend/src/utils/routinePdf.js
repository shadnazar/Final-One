/**
 * routinePdf — turns the on-screen routine report into a shareable PDF.
 *
 * We build a lightweight, printable HTML string (not a screenshot of the
 * dark-themed live page) so the output is high-DPI, selectable text, and
 * looks like a proper clinical hand-out. Rendered once with html2canvas,
 * then paginated across A4 pages by jsPDF.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function buildHtml({ routine, profile, brand }) {
  const stepRow = (step) => {
    if (!step.product) return `
      <tr><td class="idx">•</td><td>
        <div class="row">
          <div>
            <div class="eyebrow">${escapeHtml(step.slot.label)}</div>
            <div class="muted">Pick from shop</div>
          </div>
        </div>
      </td></tr>`;
    const p = step.product;
    return `
      <tr><td class="idx">•</td><td>
        <div class="row">
          <div>
            <div class="eyebrow">${escapeHtml(step.slot.label)}</div>
            <div class="title">${escapeHtml(p.short_name || p.name)}</div>
            <div class="muted">${escapeHtml(p.size || '')}${p.size ? ' · ' : ''}₹${p.prepaid_price ?? p.mrp ?? '—'}</div>
          </div>
        </div>
      </td></tr>`;
  };

  const noteBullets = (routine.specialist_notes || [])
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join('');

  const concernsChips = (profile.concerns || [])
    .map((c) => `<span class="chip">${escapeHtml(c)}</span>`)
    .join('');

  return `
  <div id="pdf-root" style="width: 780px; padding: 32px; background:#fff; color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <style>
      .brand { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:14px; margin-bottom:20px; }
      .brand .name { font-size:20px; font-weight:900; letter-spacing:0.02em; }
      .brand .tag { font-size:11px; color:#059669; letter-spacing:0.24em; font-weight:800; text-transform:uppercase; }
      h1 { font-size:26px; font-weight:900; margin:6px 0 4px; line-height:1.15; }
      h2 { font-size:15px; font-weight:900; margin:18px 0 8px; color:#0f172a; }
      .lede { color:#475569; font-size:12px; line-height:1.5; margin-bottom:14px; }
      .score-card { display:flex; align-items:center; gap:18px; background:linear-gradient(135deg,#ecfdf5,#f0fdfa); border:1px solid #a7f3d0; border-radius:16px; padding:16px 18px; margin-bottom:20px; }
      .score-ring { width:82px; height:82px; border-radius:50%; background:conic-gradient(#10b981 var(--pct), #d1fae5 0); display:flex; align-items:center; justify-content:center; }
      .score-inner { width:64px; height:64px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .score-value { font-size:22px; font-weight:900; color:#047857; line-height:1; }
      .score-label { font-size:8px; letter-spacing:0.24em; color:#64748b; font-weight:800; text-transform:uppercase; margin-top:2px; }
      .score-copy { flex:1; }
      .score-copy .eyebrow { font-size:9px; letter-spacing:0.24em; color:#059669; font-weight:800; text-transform:uppercase; }
      .score-copy h3 { font-size:18px; font-weight:900; margin:2px 0 4px; }
      .score-copy p { font-size:11px; color:#334155; margin:0; line-height:1.45; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:6px; }
      .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px; }
      .card h3 { font-size:14px; font-weight:900; margin:0 0 10px; display:flex; align-items:center; gap:6px; }
      .steps { width:100%; border-collapse:collapse; }
      .steps td { padding:8px 0; vertical-align:top; border-top:1px dashed #e2e8f0; }
      .steps td.idx { width:14px; color:#059669; font-weight:900; }
      .steps tr:first-child td { border-top:none; }
      .eyebrow { font-size:9px; letter-spacing:0.2em; color:#059669; font-weight:800; text-transform:uppercase; }
      .title { font-size:13px; font-weight:800; margin-top:2px; }
      .muted { font-size:11px; color:#64748b; margin-top:2px; }
      .notes { background:#ecfdf5; border:1px solid #a7f3d0; border-radius:14px; padding:14px 16px; margin-top:18px; }
      .notes h3 { margin:0 0 8px; font-size:13px; font-weight:900; }
      .notes ul { margin:0; padding-left:18px; }
      .notes li { font-size:11.5px; line-height:1.55; color:#0f172a; margin-bottom:5px; }
      .meta { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 10px; }
      .chip { display:inline-block; padding:3px 9px; border-radius:999px; background:#fff; border:1px solid #cbd5e1; color:#0f172a; font-size:10px; font-weight:700; }
      .foot { margin-top:22px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:10px; color:#64748b; display:flex; justify-content:space-between; align-items:center; }
      .foot a { color:#059669; text-decoration:none; font-weight:700; }
    </style>

    <div class="brand">
      <div>
        <div class="tag">${escapeHtml(brand.tag)}</div>
        <div class="name">${escapeHtml(brand.name)}</div>
      </div>
      <div style="text-align:right;">
        <div class="tag">Personal Skin Report</div>
        <div style="font-size:11px;color:#64748b;font-weight:600;">${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
      </div>
    </div>

    <h1>Your personal AM &amp; PM routine</h1>
    <p class="lede">Built for <b>${escapeHtml(profile.skin_type)}</b> skin, age band <b>${escapeHtml(profile.age)}</b>, based on ${(profile.concerns || []).length} tracked concerns and a 3-angle skin scan.</p>

    <div class="meta">${concernsChips || '<span class="chip">No specific concerns flagged</span>'}</div>

    <div class="score-card">
      <div class="score-ring" style="--pct: ${(routine.skin_score / 100) * 360}deg">
        <div class="score-inner">
          <div class="score-value">${routine.skin_score}</div>
          <div class="score-label">Score</div>
        </div>
      </div>
      <div class="score-copy">
        <div class="eyebrow">Overall Skin Health</div>
        <h3>${routine.skin_score >= 82 ? 'Excellent baseline' : routine.skin_score >= 65 ? 'Good — room to elevate' : routine.skin_score >= 50 ? 'Needs consistent care' : 'Ready for a full reset'}</h3>
        <p>Based on your 3-angle selfies, ${(profile.concerns || []).length} concern${(profile.concerns || []).length === 1 ? '' : 's'}, skin type (${escapeHtml(profile.skin_type)}) and age band (${escapeHtml(profile.age)}).</p>
      </div>
    </div>

    ${Array.isArray(routine.skin_score_factors) && routine.skin_score_factors.length ? `
    <div class="notes" style="margin-top:0;">
      <h3>Why this score</h3>
      <ul>
        ${routine.skin_score_factors.map(f => {
          const d = Number(f.delta) || 0;
          const sign = d > 0 ? '+' : '';
          const cls = d > 0 ? 'style="color:#047857;font-weight:700"' : d < 0 ? 'style="color:#b91c1c;font-weight:700"' : 'style="color:#6b7280"';
          return `<li>${escapeHtml(f.label)} <span ${cls}>(${sign}${d})</span></li>`;
        }).join('')}
      </ul>
    </div>` : ''}

    <div class="grid">
      <div class="card">
        <h3>☀️ Morning ritual</h3>
        <table class="steps">${(routine.am || []).map(stepRow).join('')}</table>
      </div>
      <div class="card">
        <h3>🌙 Night ritual</h3>
        <table class="steps">${(routine.pm || []).map(stepRow).join('')}</table>
      </div>
    </div>

    ${noteBullets ? `<div class="notes">
      <h3>Specialist notes</h3>
      <ul>${noteBullets}</ul>
    </div>` : ''}

    <div class="foot">
      <div>Generated by Celesta Glow · Personalised for your skin</div>
      <a href="https://celestaglow.com">celestaglow.com</a>
    </div>
  </div>
  `;
}

export async function downloadRoutinePdf({ routine, profile }) {
  const brand = { name: 'Celesta Glow', tag: 'Anti-Aging Specialists' };
  const holder = document.createElement('div');
  // Off-screen render so the printable HTML never flashes on the page
  holder.style.position = 'fixed';
  holder.style.left = '-99999px';
  holder.style.top = '0';
  holder.style.width = '780px';
  holder.style.background = '#ffffff';
  holder.innerHTML = buildHtml({ routine, profile, brand });
  document.body.appendChild(holder);

  try {
    const node = holder.querySelector('#pdf-root');
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 24;                    // 12pt side margin
    const imgH = (canvas.height * imgW) / canvas.width;
    const dataUrl = canvas.toDataURL('image/png');

    // Paginate: draw the tall canvas across as many A4 pages as needed
    let position = 12;
    let remaining = imgH;
    while (remaining > 0) {
      pdf.addImage(dataUrl, 'PNG', 12, position, imgW, imgH, undefined, 'FAST');
      remaining -= (pageH - 24);
      if (remaining > 0) {
        pdf.addPage();
        position = 12 - (imgH - remaining);   // shift the same image up on the next page
      }
    }

    pdf.save(`celesta-glow-skin-report-${Date.now()}.pdf`);
  } finally {
    document.body.removeChild(holder);
  }
}
