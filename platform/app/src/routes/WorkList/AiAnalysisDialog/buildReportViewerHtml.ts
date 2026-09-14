/**
 * Builds the standalone AI report viewer (beta) that opens in its own tab.
 *
 * The page is a three-pane reading layout: anomaly tiles on the left, the
 * diagnostic image in the centre, and the finding's metadata on the right. It
 * mirrors the study-reading workflow rather than a document, so a radiologist
 * can move between anomalies without leaving the images.
 *
 * Everything is inlined — data, images, styles and behaviour — because the
 * analysis payload is streamed and never persisted anywhere the new tab could
 * fetch it from.
 */

import {
  AiCompletePayload,
  CONSISTENCY_LABELS,
  EvidenceFinding,
  formatConfidence,
  formatDicomDate,
  getAnomalyFindings,
  getImageSrc,
  summarizeSeverities,
} from './aiReportModel';
import { escapeHtml } from './reportMarkdown';

export type ReportViewerOptions = {
  payload: AiCompletePayload;
  evidence: EvidenceFinding[];
  study: {
    studyInstanceUid: string;
    patientName?: string;
    description?: string;
    date?: string;
  };
  logoUrl: string;
  generatedAt?: Date;
};

type ViewerFinding = {
  id: string;
  name: string;
  severity: string;
  region: string;
  series: string;
  location: string;
  description: string;
  frameKey: string;
  seriesId: string;
  imageMeasurement: string;
  imageScore: string;
  narrativeMeasurement: string;
  narrativeScore: string;
  consistency: string;
  consistencyOk: boolean;
  difference: string;
  isAnomaly: boolean;
  bbox: number[] | null;
  original: string;
  annotated: string;
  heatmap: string;
};

/** Pulls a `##` section out of the narrative for the reading panel. */
function extractSection(reportText: string, title: RegExp) {
  const sections = (reportText || '').split(/\n(?=##\s)/);
  const match = sections.find(section => title.test(section.replace(/^##\s*/, '')));
  if (!match) {
    return [];
  }

  return match
    .replace(/^##.*\n/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean)
    .map(line => line.replace(/\*\*(.*?)\*\*/g, '$1'));
}

function toViewerFinding(finding: EvidenceFinding): ViewerFinding {
  return {
    id: finding.findingId || finding.name,
    name: finding.name,
    severity: (finding.severity || 'low').toLowerCase(),
    region: finding.region,
    series: finding.seriesLabel,
    location: finding.location,
    description: finding.description,
    frameKey: finding.frameKey,
    seriesId: finding.seriesId,
    imageMeasurement: finding.imageMeasurement.display,
    imageScore: formatConfidence(finding.imageScore),
    narrativeMeasurement: finding.narrativeMeasurement.display,
    narrativeScore: formatConfidence(finding.narrativeScore),
    consistency: CONSISTENCY_LABELS[finding.consistency],
    consistencyOk: finding.consistency === 'match',
    difference:
      finding.differenceMm === null ? 'Pending radiologist measurement' : `${finding.differenceMm} mm`,
    isAnomaly: finding.isAnomaly,
    bbox: finding.bbox,
    original: getImageSrc(finding.originalImage),
    annotated: getImageSrc(finding.annotatedImage || finding.heatmapImage),
    heatmap: getImageSrc(finding.heatmapImage),
  };
}

const VIEWER_CSS = `
  :root {
    --bg: #070f16;
    --panel: #0d1b26;
    --panel-2: #102330;
    --line: rgba(255,255,255,0.09);
    --line-strong: rgba(255,255,255,0.16);
    --teal: #12a58c;
    --teal-dim: rgba(18,165,140,0.14);
    --text: #e8f4f8;
    --muted: #8faec0;
    --muted-2: #6f92a6;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    overflow: hidden;
  }
  button { font: inherit; color: inherit; cursor: pointer; }

  .app { display: flex; flex-direction: column; height: 100vh; }

  /* ---------- top bar ---------- */
  .topbar {
    display: flex; align-items: center; gap: 16px;
    height: 54px; padding: 0 16px; flex: 0 0 auto;
    background: var(--panel); border-bottom: 1px solid var(--line);
  }
  .topbar img.logo { height: 32px; width: auto; }
  .topbar .divider { width: 1px; height: 24px; background: var(--line-strong); }
  .topbar .who { font-weight: 700; font-size: 14px; letter-spacing: 0.01em; }
  .topbar .who span { color: var(--muted); font-weight: 500; margin-left: 10px; font-size: 12px; }
  .topbar .spacer { flex: 1; }
  .topbar .stat { text-align: right; line-height: 1.3; }
  .topbar .stat b { display: block; font-size: 12px; }
  .topbar .stat small { color: var(--muted); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; }
  .beta {
    background: var(--teal-dim); color: #6ee7d0; border: 1px solid rgba(18,165,140,0.4);
    padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
  }

  /* ---------- layout ---------- */
  .body { display: flex; flex: 1 1 auto; min-height: 0; }
  .pane-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px; border-bottom: 1px solid var(--line); flex: 0 0 auto;
  }
  .pane-head h2 { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .collapse {
    background: transparent; border: 1px solid var(--line-strong); border-radius: 5px;
    width: 24px; height: 24px; display: grid; place-items: center; color: var(--muted); font-size: 12px; line-height: 1;
  }
  .collapse:hover { color: var(--text); border-color: var(--teal); }

  /* ---------- left rail ---------- */
  .rail {
    width: 292px; flex: 0 0 292px; background: var(--panel);
    border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0;
    transition: width 0.18s ease, flex-basis 0.18s ease;
  }
  .rail.collapsed { width: 0; flex-basis: 0; border-right: 0; overflow: hidden; }
  .filters { padding: 10px 12px; border-bottom: 1px solid var(--line); flex: 0 0 auto; }
  .filters input {
    width: 100%; background: var(--bg); border: 1px solid var(--line-strong); border-radius: 6px;
    color: var(--text); padding: 7px 9px; font-size: 12px; outline: none;
  }
  .filters input:focus { border-color: var(--teal); }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
  .chip {
    background: transparent; border: 1px solid var(--line-strong); border-radius: 999px;
    padding: 3px 9px; font-size: 10.5px; font-weight: 700; color: var(--muted); letter-spacing: 0.02em;
  }
  .chip[aria-pressed="true"] { background: var(--teal); border-color: var(--teal); color: #05221c; }
  .tiles { overflow-y: auto; flex: 1 1 auto; padding: 8px; }
  .series-group { margin-bottom: 6px; }
  .series-label {
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-2);
    padding: 8px 6px 6px; font-weight: 700;
  }
  .tile {
    display: flex; gap: 10px; width: 100%; text-align: left; align-items: flex-start;
    background: var(--panel-2); border: 1px solid var(--line); border-left: 3px solid transparent;
    border-radius: 6px; padding: 8px; margin-bottom: 6px;
  }
  .tile:hover { border-color: var(--line-strong); }
  .tile[aria-current="true"] { border-color: var(--teal); border-left-color: var(--teal); background: #123040; }
  .tile img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; background: #000; flex: 0 0 auto; }
  .tile .meta { min-width: 0; flex: 1; }
  .tile .tid { font-size: 10px; font-weight: 800; color: var(--teal); letter-spacing: 0.04em; }
  .tile .tname {
    font-size: 12px; font-weight: 600; margin: 2px 0 5px; line-height: 1.3;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .empty { color: var(--muted-2); font-size: 12px; text-align: center; padding: 28px 12px; line-height: 1.6; }

  .sev { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; }
  .sev-critical { background: #c5372c; }
  .sev-high { background: #cc6a11; }
  .sev-medium { background: #97780a; }
  .sev-low { background: #4a6076; }

  /* ---------- centre stage ---------- */
  .stage { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }
  .toolbar {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 9px 14px; border-bottom: 1px solid var(--line); background: var(--panel); flex: 0 0 auto;
  }
  .seg { display: flex; border: 1px solid var(--line-strong); border-radius: 6px; overflow: hidden; }
  .seg button { background: transparent; border: 0; padding: 6px 12px; font-size: 11.5px; font-weight: 700; color: var(--muted); }
  .seg button + button { border-left: 1px solid var(--line-strong); }
  .seg button[aria-pressed="true"] { background: var(--teal); color: #05221c; }
  .toggle {
    display: inline-flex; align-items: center; gap: 7px; background: transparent;
    border: 1px solid var(--line-strong); border-radius: 6px; padding: 6px 11px; font-size: 11.5px; font-weight: 700; color: var(--muted);
  }
  .toggle[aria-pressed="true"] { color: var(--teal); border-color: var(--teal); }
  .toggle .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .nav { display: flex; gap: 6px; margin-left: auto; align-items: center; }
  .nav .count { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .nav button { background: transparent; border: 1px solid var(--line-strong); border-radius: 6px; width: 28px; height: 28px; color: var(--muted); }
  .nav button:hover:not(:disabled) { color: var(--text); border-color: var(--teal); }
  .nav button:disabled { opacity: 0.35; cursor: default; }

  .canvas { flex: 1 1 auto; display: flex; gap: 12px; padding: 16px; min-height: 0; overflow: auto; }
  .view { flex: 1 1 0; display: flex; flex-direction: column; min-width: 0; }
  .view .vlabel {
    font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--muted); padding-bottom: 8px; display: flex; gap: 8px; align-items: center;
  }
  .view .vlabel i { font-style: normal; color: var(--muted-2); letter-spacing: 0; font-weight: 500; text-transform: none; font-size: 11px; }
  .holder {
    flex: 1 1 auto; display: grid; place-items: center; background: #000;
    border: 1px solid var(--line); border-radius: 8px; padding: 10px; min-height: 0; overflow: hidden;
  }
  .frame { position: relative; display: inline-block; max-width: 100%; max-height: 100%; line-height: 0; }
  .frame img { display: block; max-width: 100%; max-height: 62vh; width: auto; height: auto; }
  .cal-box { position: absolute; border: 1px dashed currentColor; pointer-events: none; }
  .cal-line { position: absolute; height: 2px; background: currentColor; pointer-events: none; }
  .cal-tick { position: absolute; width: 2px; background: currentColor; pointer-events: none; }
  .cal-label {
    position: absolute; transform: translate(-50%, -170%); background: #000; color: #fff;
    font-size: 11px; font-weight: 700; padding: 1px 6px; white-space: nowrap; pointer-events: none; border-radius: 2px;
  }
  .human { color: #00ffff; }
  .ai { color: #ffe600; }
  .stage-foot {
    flex: 0 0 auto; padding: 9px 16px; border-top: 1px solid var(--line);
    color: var(--muted-2); font-size: 11px; display: flex; gap: 18px; flex-wrap: wrap; background: var(--panel);
  }
  .stage-foot b { color: var(--muted); font-weight: 600; }

  /* ---------- right panel ---------- */
  .report {
    width: 372px; flex: 0 0 372px; background: var(--panel);
    border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0;
    transition: width 0.18s ease, flex-basis 0.18s ease;
  }
  .report.collapsed { width: 0; flex-basis: 0; border-left: 0; overflow: hidden; }
  .report-scroll { overflow-y: auto; flex: 1 1 auto; }
  .kv { display: grid; grid-template-columns: 132px 1fr; }
  .kv dt { color: var(--muted); padding: 8px 14px; font-size: 11.5px; border-bottom: 1px solid var(--line); }
  .kv dd { margin: 0; padding: 8px 14px; font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); word-break: break-word; }
  .kv dd.flag { color: #ff9b86; }
  .kv dd.ok { color: #5fd3a5; }
  .block { padding: 14px; border-bottom: 1px solid var(--line); }
  .block h3 { margin: 0 0 9px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .verdict { display: flex; gap: 11px; align-items: flex-start; }
  .verdict .big { font-size: 17px; font-weight: 800; line-height: 1.25; }
  .verdict .sub { color: var(--muted); font-size: 11.5px; margin-top: 3px; }
  .sevbar { display: flex; gap: 5px; margin-top: 11px; flex-wrap: wrap; }
  .desc { color: #cfe4ec; font-size: 12.5px; line-height: 1.6; }
  .list { margin: 0; padding-left: 17px; color: #cfe4ec; font-size: 12px; line-height: 1.6; }
  .list li { margin-bottom: 6px; }
  .disclaim { padding: 14px; color: var(--muted-2); font-size: 10.5px; line-height: 1.6; }

  @media (max-width: 1180px) {
    .rail { width: 228px; flex-basis: 228px; }
    .report { width: 310px; flex-basis: 310px; }
  }
`;

export function buildReportViewerHtml(options: ReportViewerOptions) {
  const { payload, evidence, study, logoUrl } = options;
  const findings = evidence.map(toViewerFinding);
  const withEvidence = findings.filter(finding => finding.isAnomaly);
  // Most anomalies never resolve to a frame, so the study total and the subset
  // that carries image evidence are reported as separate numbers.
  const studyAnomalies = getAnomalyFindings(payload.findings_summary || []);
  const counts = summarizeSeverities(studyAnomalies);
  const patient = payload.patient_info || {};
  const studyInfo = payload.study_info || {};
  const reportText = payload.report?.report_text || '';

  const context = {
    findings,
    patient: {
      name: patient.patient_name || study.patientName || 'Not available',
      id: patient.patient_id || '—',
      sex: patient.patient_sex || '—',
      birthDate: formatDicomDate(patient.patient_birth_date),
    },
    study: {
      uid: study.studyInstanceUid,
      date: formatDicomDate(studyInfo.study_date || study.date),
      description: studyInfo.study_description || study.description || 'Medical imaging study',
      series: payload.total_series_analyzed ?? 0,
      frames: payload.total_frames_processed ?? 0,
      reviewed: (payload.findings_summary || []).length,
    },
    counts,
    anomalyCount: studyAnomalies.length,
    evidenceCount: withEvidence.length,
    impression: extractSection(reportText, /^impression/i),
    recommendations: extractSection(reportText, /^recommendation/i),
  };

  // JSON is injected into a script tag, so `<` must not be able to close it.
  const contextJson = JSON.stringify(context).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Report — ${escapeHtml(context.patient.name)}</title>
    <style>${VIEWER_CSS}</style>
  </head>
  <body>
    <div class="app">
      <header class="topbar">
        <img class="logo" src="${logoUrl}" alt="CIAI Teleradiology" />
        <span class="beta">REPORT BETA</span>
        <div class="divider"></div>
        <div class="who">
          ${escapeHtml(context.patient.name)}
          <span>Patient ID ${escapeHtml(context.patient.id)} &nbsp;|&nbsp; ${escapeHtml(
    context.study.date
  )}</span>
        </div>
        <div class="spacer"></div>
        <div class="stat"><b id="topAnomalies">—</b><small>Anomalies</small></div>
        <div class="divider"></div>
        <div class="stat"><b id="topEvidence">—</b><small>With evidence</small></div>
        <div class="divider"></div>
        <div class="stat"><b>${context.study.series} / ${
    context.study.frames
  }</b><small>Series / frames</small></div>
      </header>

      <div class="body">
        <aside class="rail" id="rail">
          <div class="pane-head">
            <h2>Anomalies <span style="color:var(--muted-2);font-weight:600">&middot; image evidence</span></h2>
            <button class="collapse" id="railToggle" title="Hide list" aria-label="Hide list">&laquo;</button>
          </div>
          <div class="filters">
            <input id="search" type="search" placeholder="Search findings, location, series" />
            <div class="chips" id="chips"></div>
          </div>
          <div class="tiles" id="tiles"></div>
        </aside>

        <main class="stage">
          <div class="toolbar">
            <div class="seg" id="modes">
              <button data-mode="compare" aria-pressed="true">Side by side</button>
              <button data-mode="original" aria-pressed="false">Original</button>
              <button data-mode="ai" aria-pressed="false">AI marked</button>
              <button data-mode="heatmap" aria-pressed="false">Heatmap</button>
            </div>
            <button class="toggle" id="markToggle" aria-pressed="true">
              <span class="dot"></span> Markings
            </button>
            <div class="nav">
              <span class="count" id="count">—</span>
              <button id="prev" title="Previous (↑)" aria-label="Previous finding">&uarr;</button>
              <button id="next" title="Next (↓)" aria-label="Next finding">&darr;</button>
            </div>
          </div>
          <div class="canvas" id="canvas"></div>
          <div class="stage-foot" id="foot"></div>
        </main>

        <aside class="report" id="report">
          <div class="pane-head">
            <h2>Reporting</h2>
            <button class="collapse" id="reportToggle" title="Hide panel" aria-label="Hide panel">&raquo;</button>
          </div>
          <div class="report-scroll" id="reportScroll"></div>
        </aside>
      </div>
    </div>

    <script id="ctx" type="application/json">${contextJson}</script>
    <script>
    (function () {
      var ctx = JSON.parse(document.getElementById('ctx').textContent);
      var SEVERITIES = ['critical', 'high', 'medium', 'low'];
      var state = {
        severity: 'all',
        query: '',
        showNormal: false,
        mode: 'compare',
        markings: true,
        selectedId: null,
      };

      function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
      }

      function visibleFindings() {
        var term = state.query.trim().toLowerCase();
        return ctx.findings.filter(function (f) {
          if (!state.showNormal && !f.isAnomaly) return false;
          if (state.severity !== 'all' && f.severity !== state.severity) return false;
          if (!term) return true;
          return [f.id, f.name, f.location, f.series, f.description]
            .join(' ').toLowerCase().indexOf(term) !== -1;
        });
      }

      function current() {
        var list = visibleFindings();
        if (!list.length) return null;
        var found = list.filter(function (f) { return f.id === state.selectedId; })[0];
        return found || list[0];
      }

      /* ---------- left rail ---------- */
      function renderChips() {
        var counts = { all: 0, critical: 0, high: 0, medium: 0, low: 0 };
        ctx.findings.forEach(function (f) {
          if (!state.showNormal && !f.isAnomaly) return;
          counts.all += 1;
          counts[f.severity] = (counts[f.severity] || 0) + 1;
        });

        var html = ['all'].concat(SEVERITIES).map(function (key) {
          if (key !== 'all' && !counts[key]) return '';
          var label = key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1);
          return '<button class="chip" data-sev="' + key + '" aria-pressed="' +
            (state.severity === key) + '">' + label + ' ' + (counts[key] || 0) + '</button>';
        }).join('');

        var normalCount = ctx.findings.length - ctx.findings.filter(function (f) { return f.isAnomaly; }).length;
        if (normalCount) {
          html += '<button class="chip" data-normal="1" aria-pressed="' + state.showNormal +
            '" title="Normal-structure entries reported alongside the anomalies">+ Normal ' + normalCount + '</button>';
        }
        document.getElementById('chips').innerHTML = html;
      }

      function renderTiles() {
        var list = visibleFindings();
        var host = document.getElementById('tiles');

        if (!list.length) {
          host.innerHTML = '<p class="empty">No findings match this filter.</p>';
          return;
        }

        // Group by series so tiles read in acquisition order, as in the viewer.
        var order = [];
        var groups = {};
        list.forEach(function (f) {
          var key = f.series || 'Unassigned series';
          if (!groups[key]) { groups[key] = []; order.push(key); }
          groups[key].push(f);
        });

        var active = current();
        host.innerHTML = order.map(function (key) {
          return '<div class="series-group"><div class="series-label">' + esc(key) + '</div>' +
            groups[key].map(function (f) {
              return '<button class="tile" data-id="' + esc(f.id) + '" aria-current="' +
                (active && active.id === f.id) + '">' +
                (f.annotated ? '<img src="' + f.annotated + '" alt="" loading="lazy" />' : '') +
                '<span class="meta">' +
                  '<span class="tid">' + esc(f.id) + '</span>' +
                  '<span class="tname">' + esc(f.name) + '</span>' +
                  '<span class="sev sev-' + esc(f.severity) + '">' + esc(f.severity) + '</span>' +
                '</span></button>';
            }).join('') + '</div>';
        }).join('');
      }

      /* ---------- centre ---------- */
      function caliper(f, tone, label) {
        if (!state.markings || !f.bbox) return '';
        var b = f.bbox;
        var left = Math.min(b[0], b[2]) * 100, right = Math.max(b[0], b[2]) * 100;
        var top = Math.min(b[1], b[3]) * 100, bottom = Math.max(b[1], b[3]) * 100;
        var w = Math.max(right - left, 0.5), h = Math.max(bottom - top, 0.5);
        var cy = (top + bottom) / 2, cx = (left + right) / 2;
        return '<span class="' + tone + '">' +
          '<span class="cal-box" style="left:' + left + '%;top:' + top + '%;width:' + w + '%;height:' + h + '%"></span>' +
          '<span class="cal-line" style="left:' + left + '%;top:' + cy + '%;width:' + w + '%"></span>' +
          '<span class="cal-tick" style="left:' + left + '%;top:' + (cy - 2) + '%;height:4%"></span>' +
          '<span class="cal-tick" style="left:' + right + '%;top:' + (cy - 2) + '%;height:4%"></span>' +
          '<span class="cal-label" style="left:' + cx + '%;top:' + cy + '%">' + esc(label) + '</span>' +
        '</span>';
      }

      function view(label, hint, src, overlay) {
        var inner = src
          ? '<span class="frame"><img src="' + src + '" alt="' + esc(label) + '" />' + (overlay || '') + '</span>'
          : '<span class="empty">Not returned by the analysis service.</span>';
        return '<section class="view"><div class="vlabel">' + esc(label) +
          (hint ? '<i>' + esc(hint) + '</i>' : '') + '</div><div class="holder">' + inner + '</div></section>';
      }

      function renderCanvas() {
        var f = current();
        var host = document.getElementById('canvas');

        if (!f) {
          host.innerHTML = '<p class="empty">Select a finding to review its images.</p>';
          document.getElementById('foot').innerHTML = '';
          return;
        }

        var measured = f.imageMeasurement !== 'Not measured' ? f.imageMeasurement : 'Pending';
        var html;

        if (state.mode === 'original') {
          html = view('Original diagnostic image', 'no overlay', f.original, '');
        } else if (state.mode === 'ai') {
          html = view('CIAI AI marking', f.imageScore, f.annotated, caliper(f, 'ai', measured));
        } else if (state.mode === 'heatmap') {
          html = view('Heatmap — supporting evidence', 'does not replace the original', f.heatmap, '');
        } else {
          html = view('1. Original', 'unmodified frame', f.original, '') +
                 view('2. CIAI AI marking', f.imageScore, f.annotated, caliper(f, 'ai', measured));
        }

        host.innerHTML = html;
        document.getElementById('foot').innerHTML =
          '<span><b>Frame</b> ' + esc(f.frameKey || '—') + '</span>' +
          '<span><b>Series</b> ' + esc(f.series || '—') + '</span>' +
          '<span><b>Study UID</b> ' + esc(ctx.study.uid) + '</span>';
      }

      /* ---------- right panel ---------- */
      function renderReport() {
        var f = current();
        var host = document.getElementById('reportScroll');
        var sevbar = SEVERITIES.filter(function (s) { return ctx.counts[s]; }).map(function (s) {
          return '<span class="sev sev-' + s + '">' + s + ' ' + ctx.counts[s] + '</span>';
        }).join('');

        var head =
          '<div class="block">' +
            '<dl class="kv" style="grid-template-columns:1fr 1fr;margin:-14px -14px 12px">' +
              '<dd>' + esc(ctx.patient.sex) + '<div style="color:var(--muted);font-weight:400;font-size:10.5px">Sex</div></dd>' +
              '<dd>' + esc(ctx.study.date) + '<div style="color:var(--muted);font-weight:400;font-size:10.5px">Study date</div></dd>' +
            '</dl>' +
            '<div class="verdict">' +
              '<div><div class="big">Study result: ' +
                (ctx.anomalyCount ? 'Positive' : 'No anomalies') + '</div>' +
                '<div class="sub">' + ctx.anomalyCount + ' anomalies from ' + ctx.study.reviewed +
                ' reviewed entries &middot; ' + ctx.evidenceCount + ' with image evidence</div></div>' +
            '</div>' +
            '<div class="sevbar">' + sevbar + '</div>' +
          '</div>';

        if (!f) {
          host.innerHTML = head + '<p class="empty">No finding selected.</p>';
          return;
        }

        var rows = [
          ['Finding ID', esc(f.id), ''],
          ['Severity', '<span class="sev sev-' + esc(f.severity) + '">' + esc(f.severity) + '</span>', ''],
          ['Region', esc(f.region || '—'), ''],
          ['Localization', esc(f.location || '—'), ''],
          ['Image measurement', esc(f.imageMeasurement), ''],
          ['Image AI score', esc(f.imageScore), ''],
          ['Narrative output', esc(f.narrativeMeasurement) + ' / ' + esc(f.narrativeScore), ''],
          ['Consistency', esc(f.consistency), f.consistencyOk ? 'ok' : 'flag'],
          ['Difference', esc(f.difference), ''],
          ['Series', esc(f.series || '—'), ''],
          ['Source frame', esc(f.frameKey || '—'), ''],
        ].map(function (row) {
          return '<dt>' + row[0] + '</dt><dd class="' + row[2] + '">' + row[1] + '</dd>';
        }).join('');

        var list = function (title, items) {
          if (!items || !items.length) return '';
          return '<div class="block"><h3>' + title + '</h3><ol class="list">' +
            items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ol></div>';
        };

        host.innerHTML = head +
          '<div class="block"><h3>' + esc(f.id) + ' — ' + esc(f.name) + '</h3>' +
            (f.description ? '<p class="desc">' + esc(f.description) + '</p>' : '') + '</div>' +
          '<dl class="kv">' + rows + '</dl>' +
          list('Impression', ctx.impression) +
          list('Recommendations', ctx.recommendations) +
          '<p class="disclaim">AI-generated decision support, not a diagnosis. Image-level and ' +
          'narrative values are kept as separate audit fields; disagreements are flagged for ' +
          'radiologist verification rather than reconciled automatically.</p>';
      }

      function renderCounts() {
        var list = visibleFindings();
        var f = current();
        var index = f ? list.map(function (x) { return x.id; }).indexOf(f.id) : -1;
        document.getElementById('count').textContent =
          list.length ? (index + 1) + ' / ' + list.length : '0 / 0';
        document.getElementById('prev').disabled = index <= 0;
        document.getElementById('next').disabled = index < 0 || index >= list.length - 1;
        document.getElementById('topAnomalies').textContent = ctx.anomalyCount;
        document.getElementById('topEvidence').textContent = ctx.evidenceCount;
      }

      function render() {
        renderChips();
        renderTiles();
        renderCanvas();
        renderReport();
        renderCounts();
      }

      function select(id) {
        state.selectedId = id;
        render();
        var tile = document.querySelector('.tile[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
        if (tile && tile.scrollIntoView) tile.scrollIntoView({ block: 'nearest' });
      }

      function step(delta) {
        var list = visibleFindings();
        var f = current();
        if (!f) return;
        var index = list.map(function (x) { return x.id; }).indexOf(f.id) + delta;
        if (index >= 0 && index < list.length) select(list[index].id);
      }

      /* ---------- events ---------- */
      document.getElementById('tiles').addEventListener('click', function (event) {
        var tile = event.target.closest('.tile');
        if (tile) select(tile.getAttribute('data-id'));
      });

      document.getElementById('chips').addEventListener('click', function (event) {
        var chip = event.target.closest('.chip');
        if (!chip) return;
        if (chip.hasAttribute('data-normal')) {
          state.showNormal = !state.showNormal;
        } else {
          state.severity = chip.getAttribute('data-sev');
        }
        render();
      });

      document.getElementById('search').addEventListener('input', function (event) {
        state.query = event.target.value;
        render();
      });

      document.getElementById('modes').addEventListener('click', function (event) {
        var button = event.target.closest('button[data-mode]');
        if (!button) return;
        state.mode = button.getAttribute('data-mode');
        Array.prototype.forEach.call(this.querySelectorAll('button'), function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        renderCanvas();
      });

      document.getElementById('markToggle').addEventListener('click', function () {
        state.markings = !state.markings;
        this.setAttribute('aria-pressed', String(state.markings));
        renderCanvas();
      });

      document.getElementById('prev').addEventListener('click', function () { step(-1); });
      document.getElementById('next').addEventListener('click', function () { step(1); });

      function paneToggle(buttonId, paneId, openGlyph, closedGlyph) {
        document.getElementById(buttonId).addEventListener('click', function () {
          var pane = document.getElementById(paneId);
          var collapsed = pane.classList.toggle('collapsed');
          this.innerHTML = collapsed ? closedGlyph : openGlyph;
          // The button rides inside the pane, so re-mount it on the stage when hidden.
          if (collapsed) { document.querySelector('.toolbar').appendChild(this); }
          else { pane.querySelector('.pane-head').appendChild(this); }
        });
      }
      paneToggle('railToggle', 'rail', '&laquo;', '&raquo;');
      paneToggle('reportToggle', 'report', '&raquo;', '&laquo;');

      document.addEventListener('keydown', function (event) {
        if (event.target.tagName === 'INPUT') return;
        if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); step(1); }
        if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); step(-1); }
      });

      render();
    })();
    </script>
  </body>
</html>`;
}
