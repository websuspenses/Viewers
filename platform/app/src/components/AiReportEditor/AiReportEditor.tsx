import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import { Header } from '@ohif/ui';
import { useAppConfig } from '@state';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import HistoryIcon from '@mui/icons-material/History';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import AiReviewBar from '../../routes/WorkList/AiAnalysisDialog/AiReviewBar';
import getHeaderMenuOptions from '../../utils/getHeaderMenuOptions';
import { UnsavedChangesDialog, useUnsavedChangesGuard } from '../common/useUnsavedChangesGuard';
import {
  AiReview,
  DEFAULT_REVIEW_ROLE,
  ReviewApi,
  fetchReviewStatus,
} from '../../routes/WorkList/AiAnalysisDialog/aiReview';
import { fetchFrameImages, fetchReportResult } from '../../routes/WorkList/AiAnalysisDialog/aiPipeline';
import {
  AiCompletePayload,
  AiFindingSummary,
  normalizeAiPayload,
  sortFindingsSummary,
} from '../../routes/WorkList/AiAnalysisDialog/aiReportModel';
import {
  FindingDecision,
  ReportVersionMeta,
  ReportsState,
  StudyHeader,
  getLabTemplate,
  getReportVersion,
  getReports,
  getStudyHeader,
  saveReportVersion,
  writeLegacyReport,
} from './reportsApi';
import {
  aiDraftToHtml,
  buildPrintableReport,
  clearLocalDraft,
  emptyReportHtml,
  htmlToText,
  printReport,
  readLocalDraft,
  removeFindingBlock,
  restoreFindingBlock,
  wordDiffHtml,
  writeLocalDraft,
} from './reportDocument';
import './aiReportEditor.css';

type Source = 'radiologist' | 'ai_draft' | 'template' | 'blank';
type FindingState = { decision: 'kept' | 'removed'; removedHtml?: string };
type FrameView = { loading: boolean; original?: string; marked?: string; error?: boolean };

const EDITOR_OPTIONS = {
  minHeight: '520px',
  height: 'auto',
  defaultStyle: 'font-family: "Segoe UI", Arial, sans-serif; font-size: 15px; line-height: 1.55; color: #111;',
  formats: ['p', 'h2', 'h3', 'h4', 'blockquote'],
  buttonList: [
    ['undo', 'redo'],
    ['formatBlock'],
    ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript'],
    ['list', 'outdent', 'indent', 'align'],
    ['table', 'horizontalRule'],
    ['removeFormat'],
    ['fullScreen'],
  ],
};
const AUTOSAVE_MS = 1500;
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'];

const verifyReason = (description?: string) => {
  const match = /^\[Verify:\s*([^\]]+)\]/.exec(description || '');
  return match ? match[1] : '';
};
const cleanDescription = (description?: string) => (description || '').replace(/^\[Verify:[^\]]*\]\s*/, '');
const findingKey = (finding: AiFindingSummary) => finding.finding_id || `${finding.name}|${finding.frame_key}`;
const versionLabel = (v?: ReportVersionMeta | null) =>
  !v ? '' : v.kind === 'ai_draft' ? `AI draft v${v.version}` : `v${v.version}${v.status !== 'draft' ? ` (${v.status})` : ''}`;
const formatTime = (iso?: string) => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

function useSession() {
  return useMemo(() => {
    try {
      const oidc = (window as any).config?.oidc?.[0];
      const session = JSON.parse(sessionStorage.getItem(`oidc.user:${oidc?.authority}:${oidc?.client_id}`) || '{}');
      return {
        authHeaders: session?.access_token ? `${session.token_type || 'Bearer'} ${session.access_token}` : '',
        roles: (session?.profile?.realm_access?.roles || []) as string[],
      };
    } catch {
      return { authHeaders: '', roles: [] as string[] };
    }
  }, []);
}

/**
 * AI report editor (docs §10, decided 2026-10-15): the AI evidence on the left,
 * the report on the right pre-filled from the AI draft, versions, show-changes,
 * accept / reject, draft PDF and submit. Every save is a new version in teleapp.
 */
export default function AiReportEditor() {
  const { studyUid = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [appConfig] = useAppConfig();
  const { authHeaders, roles } = useSession();
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';
  const pacsBase = appConfig.pacsHostURL;
  const api: ReviewApi = useMemo(() => ({ nodeAppHost, authHeaders }), [nodeAppHost, authHeaders]);
  const canEdit = roles.includes(appConfig.aiReviewRole || DEFAULT_REVIEW_ROLE);

  const [isDarkHeader, setIsDarkHeader] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('active_dark') || 'false');
    } catch {
      return false;
    }
  });

  // ---- loaded data ----
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reports, setReports] = useState<ReportsState | null>(null);
  const [header, setHeader] = useState<StudyHeader | null>(null);
  const [aiPayload, setAiPayload] = useState<AiCompletePayload | null>(null);
  const [review, setReview] = useState<AiReview | null>(null);

  // ---- editing state ----
  const editorRef = useRef<any>(null);
  const contentRef = useRef('');
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [source, setSource] = useState<Source>('blank');
  const [baseVersion, setBaseVersion] = useState(0);
  const [basedOn, setBasedOn] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<'' | 'save' | 'submit'>('');
  const [locked, setLocked] = useState(false);
  const [conflict, setConflict] = useState('');
  const [restoreOffer, setRestoreOffer] = useState<{ html: string; savedAt: string } | null>(null);
  const [findingStates, setFindingStates] = useState<Record<string, FindingState>>({});
  const [toast, setToast] = useState<{ severity: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewing, setViewing] = useState<{ meta: ReportVersionMeta; html: string } | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [frames, setFrames] = useState<Record<string, FrameView>>({});
  const [frameMode, setFrameMode] = useState<'marked' | 'original'>('marked');
  const autosaveTimer = useRef<number | undefined>(undefined);
  const stateRef = useRef({ baseVersion, basedOn });
  stateRef.current = { baseVersion, basedOn };

  // Leaving with unsaved changes (Cancel, Worklist, header back, browser Back,
  // closing the tab) asks first; leaving anyway drops the local autosave too.
  const guard = useUnsavedChangesGuard(dirty && canEdit, () => clearLocalDraft(studyUid));
  const goToWorklist = () => guard.leave(() => navigate('/workList', { replace: true }));

  const findings = useMemo(
    () => sortFindingsSummary((aiPayload?.findings_summary || []).slice()),
    [aiPayload]
  );
  const flagged = findings.filter(f => verifyReason(f.description));
  const undecidedFlagged = flagged.filter(f => !findingStates[findingKey(f)]);
  const aiBaselineHtml = useMemo(
    () => (reports?.latest_ai_draft ? aiDraftToHtml(reports.latest_ai_draft.content.sections) : ''),
    [reports]
  );
  const usesAiDraft = source === 'ai_draft' || (source === 'radiologist' && Boolean(reports?.latest_ai_draft));

  // ---- load everything in parallel ----
  const load = useCallback(async () => {
    if (!authHeaders || !studyUid) {
      setLoadError('You are signed out. Sign in again to open the report.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const [reportsState, studyHeader, payload, reviews] = await Promise.all([
        getReports(api, studyUid),
        getStudyHeader(pacsBase, authHeaders, studyUid).catch(() => null),
        fetchReportResult({ baseUrl: pacsBase, studyInstanceUid: studyUid, authHeaders }).catch(() => null),
        fetchReviewStatus(api, [studyUid]).catch(() => ({})),
      ]);
      const currentReview = (reviews as Record<string, AiReview>)[studyUid] || null;
      setReports(reportsState);
      setHeader(studyHeader);
      setAiPayload(normalizeAiPayload(payload));
      setReview(currentReview);
      setLocked(reportsState.finalised);

      // Starting text: latest saved version → AI draft (unless rejected) → lab template → blank.
      let html = '';
      let from: Source = 'blank';
      let base: number | null = null;
      if (reportsState.latest_radiologist) {
        html = reportsState.latest_radiologist.content.html;
        from = 'radiologist';
        base = reportsState.latest_radiologist.report_id;
      } else if (reportsState.latest_ai_draft && currentReview?.decision !== 'rejected') {
        html = aiDraftToHtml(reportsState.latest_ai_draft.content.sections);
        from = 'ai_draft';
        base = reportsState.latest_ai_draft.report_id;
      } else {
        const template = await getLabTemplate(api, studyHeader?.modalities || '');
        html = template || emptyReportHtml();
        from = template ? 'template' : 'blank';
      }
      setSource(from);
      setBasedOn(base);
      setBaseVersion(reportsState.latest_version);
      contentRef.current = html;
      setInitialHtml(html);
      setEditorKey(key => key + 1);
      setDirty(false);
      setConflict('');

      const local = readLocalDraft(studyUid);
      if (local && local.baseVersion === reportsState.latest_version && local.html && local.html !== html) {
        setRestoreOffer({ html: local.html, savedAt: local.savedAt });
      } else {
        setRestoreOffer(null);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [api, authHeaders, pacsBase, studyUid]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- editor wiring ----
  const setEditorHtml = (html: string) => {
    contentRef.current = html;
    editorRef.current?.setContents(html);
    markDirty();
  };

  const markDirty = () => {
    setDirty(true);
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      writeLocalDraft(studyUid, {
        html: contentRef.current,
        baseVersion: stateRef.current.baseVersion,
        basedOn: stateRef.current.basedOn,
        savedAt: new Date().toISOString(),
      });
    }, AUTOSAVE_MS);
  };

  // Content lives in a ref (no re-render per keystroke); only the dirty flag is state.
  const onEditorChange = (content: string) => {
    if (content === contentRef.current) {
      return;
    }
    contentRef.current = content;
    markDirty();
  };

  useEffect(() => () => window.clearTimeout(autosaveTimer.current), []);

  // ---- findings: keep / remove ----
  const decideFinding = (finding: AiFindingSummary, decision: 'kept' | 'removed') => {
    const key = findingKey(finding);
    const current = findingStates[key];
    if (decision === 'removed' && current?.decision !== 'removed') {
      const result = removeFindingBlock(contentRef.current, finding.name || '');
      if (result.found) {
        setEditorHtml(result.html);
        setToast({ severity: 'info', text: `"${finding.name}" removed from the report text` });
      } else {
        setToast({ severity: 'warning', text: `"${finding.name}" is not a separate block in the report — edit the text by hand` });
        markDirty();
      }
      setFindingStates(states => ({ ...states, [key]: { decision, removedHtml: result.removedHtml } }));
      return;
    }
    if (decision === 'kept' && current?.decision === 'removed' && current.removedHtml) {
      setEditorHtml(restoreFindingBlock(contentRef.current, current.removedHtml));
      setToast({ severity: 'info', text: `"${finding.name}" put back under Findings` });
    } else {
      markDirty();
    }
    setFindingStates(states => ({ ...states, [key]: { decision } }));
  };

  const findingDecisions = (): FindingDecision[] =>
    findings
      .filter(f => findingStates[findingKey(f)])
      .map(f => ({
        name: f.name || '',
        severity: f.severity,
        modality: f.modality,
        flags: verifyReason(f.description) ? [verifyReason(f.description)] : [],
        decision: findingStates[findingKey(f)].decision,
      }));

  // ---- evidence images (lazy, cached per frame) ----
  const heatmapPaths = useCallback(
    (frameKey: string) => {
      for (const series of aiPayload?.series_with_findings || []) {
        const heatmap = (series.heatmaps || []).find((h: any) => h.frame_key === frameKey);
        if (heatmap) {
          return {
            heatmapPath: heatmap.output_path,
            annotatedPath: heatmap.gemini_annotated_output_path,
            originalPath: heatmap.original_output_path,
          };
        }
      }
      return {};
    },
    [aiPayload]
  );

  const selectFinding = (finding: AiFindingSummary) => {
    const key = findingKey(finding);
    setSelected(key === selected ? '' : key);
    const frameKey = finding.frame_key;
    if (!frameKey || frames[frameKey]) {
      return;
    }
    setFrames(current => ({ ...current, [frameKey]: { loading: true } }));
    fetchFrameImages({ baseUrl: pacsBase, studyInstanceUid: studyUid, instanceId: frameKey, authHeaders, ...heatmapPaths(frameKey) })
      .then(images =>
        setFrames(current => ({
          ...current,
          [frameKey]: { loading: false, original: images.original, marked: images.heatmap || images.annotated },
        }))
      )
      .catch(() => setFrames(current => ({ ...current, [frameKey]: { loading: false, error: true } })));
  };

  // ---- save / submit ----
  const save = async (mode: 'save' | 'submit') => {
    if (locked || saving) {
      return false;
    }
    setSaving(mode);
    setConflict('');
    const result = await saveReportVersion(api, studyUid, {
      html: contentRef.current,
      based_on_report_id: basedOn,
      expected_version: baseVersion,
      findings: findingDecisions(),
    });
    let ok = false;
    if (result.kind === 'ok' && result.version) {
      const saved = result.version;
      setBaseVersion(saved.version);
      setBasedOn(saved.report_id);
      setSource('radiologist');
      setDirty(false);
      clearLocalDraft(studyUid);
      setReports(current =>
        current ? { ...current, latest_version: saved.version, versions: [saved, ...current.versions] } : current
      );
      if (mode === 'save') {
        const edit = saved.edit_status === 'edited' ? ` · ${Number(saved.edit_percent)}% changed from the AI draft` : '';
        setToast({ severity: 'success', text: `Saved as version ${saved.version}${edit}` });
      }
      ok = true;
    } else if (result.kind === 'unchanged') {
      setDirty(false);
      clearLocalDraft(studyUid);
      if (mode === 'save') {
        setToast({ severity: 'info', text: `No changes since version ${result.latestVersion}` });
      }
      ok = true;
    } else if (result.kind === 'conflict') {
      setConflict(result.message || '');
    } else if (result.kind === 'locked') {
      setLocked(true);
      setToast({ severity: 'error', text: result.message || 'Report is locked' });
    } else {
      setToast({ severity: 'error', text: result.message || 'Could not save' });
    }
    if (mode === 'save') {
      setSaving('');
    }
    return ok;
  };

  const submit = async () => {
    const saved = await save('submit');
    if (!saved) {
      setSaving('');
      return;
    }
    try {
      await writeLegacyReport(pacsBase, authHeaders, studyUid, contentRef.current);
      setSubmitOpen(false);
      setToast({ severity: 'success', text: 'Report submitted' });
      setTimeout(() => guard.leaveNow(() => navigate('/workList', { replace: true })), 900);
    } catch (error) {
      setToast({ severity: 'error', text: 'Saved as a version, but the study could not be marked as reported. Submit again.' });
    } finally {
      setSaving('');
    }
  };

  // Ctrl/Cmd+S saves a version.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (canEdit && !locked) {
          save('save');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- other actions ----
  const startFromTemplate = async () => {
    const template = await getLabTemplate(api, header?.modalities || '');
    setEditorHtml(template || emptyReportHtml());
    setSource(template ? 'template' : 'blank');
    setBasedOn(null);
    setToast({ severity: 'info', text: template ? 'Started from the lab template' : 'No lab template for this modality — started blank' });
  };

  const startFromAiDraft = () => {
    if (!reports?.latest_ai_draft) {
      return;
    }
    setEditorHtml(aiBaselineHtml);
    setSource('ai_draft');
    setBasedOn(reports.latest_ai_draft.report_id);
    setFindingStates({});
  };

  const openVersion = async (meta: ReportVersionMeta) => {
    try {
      const full = await getReportVersion(api, studyUid, meta.version);
      const html = meta.kind === 'ai_draft' ? aiDraftToHtml(full.content.sections || []) : full.content.html;
      setViewing({ meta, html });
    } catch (error) {
      setToast({ severity: 'error', text: error instanceof Error ? error.message : 'Version could not be loaded' });
    }
  };

  const restoreVersion = () => {
    if (!viewing) {
      return;
    }
    setEditorHtml(viewing.html);
    setBasedOn(viewing.meta.report_id);
    setSource(viewing.meta.kind === 'ai_draft' ? 'ai_draft' : 'radiologist');
    setViewing(null);
    setHistoryOpen(false);
    setToast({ severity: 'info', text: `Copied ${versionLabel(viewing.meta)} into the editor — save to keep it` });
  };

  const toggleChanges = () => {
    if (diffHtml !== null) {
      setDiffHtml(null);
      return;
    }
    setDiffHtml(wordDiffHtml(htmlToText(aiBaselineHtml), htmlToText(contentRef.current)));
  };

  const downloadPdf = () => {
    const latest = reports?.versions?.[0];
    const label = dirty || !latest ? 'Draft · unsaved changes' : `Draft · ${versionLabel(latest)}`;
    const ok = printReport(buildPrintableReport({ header, bodyHtml: contentRef.current, isDraft: !locked, versionLabel: label }));
    if (!ok) {
      setToast({ severity: 'warning', text: 'Allow pop-ups for this site to download the PDF' });
    }
  };

  // ---- header: settings menu (theme switch lives inside it) ----
  const toggleHeaderTheme = () => {
    const next = !isDarkHeader;
    setIsDarkHeader(next);
    try {
      localStorage.setItem('active_dark', JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const headerMenu = getHeaderMenuOptions({
    t,
    isActive: isDarkHeader,
    handleChangeSwitch: toggleHeaderTheme,
    navigate: (path: string) => guard.leave(() => navigate(path, { replace: true })),
    appConfig,
    currentPath: '/ai-report',
  });

  // ---- render ----
  const sourceText = {
    radiologist: `Editing version ${baseVersion}`,
    ai_draft: `Started from AI draft v${reports?.latest_ai_draft?.version ?? ''}`,
    template: 'Started from the lab template',
    blank: 'Started blank',
  }[source];
  const reviewChip = !reports?.latest_ai_draft
    ? null
    : review?.decision === 'accepted'
      ? { cls: 'accepted', text: 'AI accepted' }
      : review?.decision === 'rejected'
        ? { cls: 'rejected', text: 'AI rejected' }
        : { cls: 'pending', text: 'AI not reviewed' };
  const submitBlocked = usesAiDraft && undecidedFlagged.length > 0;
  const currentFrame = (() => {
    const finding = findings.find(f => findingKey(f) === selected);
    return finding?.frame_key ? { finding, view: frames[finding.frame_key] } : null;
  })();

  return (
    <div className="are-root">
      <Header
        isSticky
        menuOptions={headerMenu}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isDarkHeader}
        handleChange={toggleHeaderTheme}
        screen="GenerateReport"
        handleRedirectPage={goToWorklist}
        modalityValue={studyUid}
      />

      <div className="are-bar">
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={goToWorklist}
          className="are-back"
        >
          Worklist
        </Button>
        <div className="are-title">
          <div className="are-patient">
            {header?.patientName || 'Study'}
            <span>
              {[header?.modalities, header?.description, header?.studyDate && `${header.studyDate.slice(6, 8)}-${header.studyDate.slice(4, 6)}-${header.studyDate.slice(0, 4)}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <div className="are-status">
            {reviewChip && <span className={`are-chip are-chip--${reviewChip.cls}`}>{reviewChip.text}</span>}
            <span className="are-chip">{locked ? 'Finalised' : sourceText}</span>
            <span className={`are-save-state${dirty ? ' is-dirty' : ''}`}>
              {dirty ? 'Unsaved changes' : reports?.versions?.[0] ? `Saved ${formatTime(reports.versions[0].created_at)}` : ''}
            </span>
          </div>
        </div>
        <div className="are-actions">
          <Tooltip title="Version history">
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setHistoryOpen(true)}
                disabled={!reports?.versions?.length}
              >
                {reports?.versions?.length || 0}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={aiBaselineHtml ? 'Show what changed compared with the AI draft' : 'No AI draft to compare with'}>
            <span>
              <Button
                size="small"
                variant={diffHtml !== null ? 'contained' : 'outlined'}
                startIcon={<CompareArrowsIcon />}
                onClick={toggleChanges}
                disabled={!aiBaselineHtml || loading}
              >
                Changes
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={downloadPdf}
            disabled={loading || initialHtml === null}
          >
            PDF
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={goToWorklist}
            className="are-cancel"
          >
            {canEdit && !locked ? 'Cancel' : 'Close'}
          </Button>
          {canEdit && !locked && (
            <>
              <Tooltip title="Save a new version (Ctrl+S)">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={saving === 'save' ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    onClick={() => save('save')}
                    disabled={!!saving || loading}
                  >
                    Save draft
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={submitBlocked ? `Decide the ${undecidedFlagged.length} finding(s) marked Verify first` : 'Save and mark the study as reported'}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    className="are-primary"
                    startIcon={<SendIcon />}
                    onClick={() => setSubmitOpen(true)}
                    disabled={!!saving || loading || submitBlocked}
                  >
                    Submit report
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="are-loading">
          <CircularProgress size={28} />
          <span>Loading report, versions and AI evidence…</span>
        </div>
      )}
      {!loading && loadError && (
        <Alert
          severity="error"
          className="are-banner"
          action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}
        >
          {loadError}
        </Alert>
      )}

      {!loading && !loadError && (
        <>
          {restoreOffer && (
            <Alert
              severity="info"
              className="are-banner"
              action={
                <>
                  <Button color="inherit" size="small" onClick={() => { setEditorHtml(restoreOffer.html); setRestoreOffer(null); }}>Restore</Button>
                  <Button color="inherit" size="small" onClick={() => { clearLocalDraft(studyUid); setRestoreOffer(null); }}>Discard</Button>
                </>
              }
            >
              Unsaved changes from {formatTime(restoreOffer.savedAt)} were kept on this device.
            </Alert>
          )}
          {conflict && (
            <Alert
              severity="warning"
              className="are-banner"
              action={<Button color="inherit" size="small" onClick={load}>Load latest</Button>}
            >
              {conflict}
            </Alert>
          )}
          {!canEdit && (
            <Alert severity="info" className="are-banner">
              Read only — editing reports needs the radiologist role.
            </Alert>
          )}
          {review?.decision === 'rejected' && source === 'ai_draft' && canEdit && !locked && (
            <Alert
              severity="warning"
              className="are-banner"
              action={<Button color="inherit" size="small" onClick={startFromTemplate}>Use lab template</Button>}
            >
              The AI report was rejected. Start from the lab template instead?
            </Alert>
          )}
          {source !== 'ai_draft' && source !== 'radiologist' && reports?.latest_ai_draft && review?.decision !== 'rejected' && canEdit && !locked && (
            <Alert
              severity="info"
              className="are-banner"
              action={<Button color="inherit" size="small" onClick={startFromAiDraft}>Use AI draft</Button>}
            >
              An AI draft is available for this study.
            </Alert>
          )}

          <div className="are-main">
            {/* ---- AI evidence ---- */}
            <aside className="are-evidence" aria-label="AI evidence">
              <div className="are-evidence__head">
                <h2>AI findings <span>{findings.length}</span></h2>
                {flagged.length > 0 && (
                  <span className="are-verify-count">
                    <WarningAmberIcon fontSize="inherit" /> {undecidedFlagged.length}/{flagged.length} to verify
                  </span>
                )}
              </div>
              {!findings.length && (
                <p className="are-muted">
                  {aiPayload ? 'The AI reported no significant findings.' : 'No AI result for this study.'}
                </p>
              )}
              <ol className="are-findings">
                {findings.map(finding => {
                  const key = findingKey(finding);
                  const state = findingStates[key]?.decision;
                  const reason = verifyReason(finding.description);
                  const severity = SEVERITY_ORDER.includes(String(finding.severity)) ? finding.severity : 'unknown';
                  return (
                    <li
                      key={key}
                      className={`are-finding${selected === key ? ' is-selected' : ''}${state === 'removed' ? ' is-removed' : ''}`}
                    >
                      <button
                        type="button"
                        className="are-finding__main"
                        onClick={() => selectFinding(finding)}
                        aria-expanded={selected === key}
                      >
                        <span className={`are-sev are-sev--${severity}`}>{String(severity).toUpperCase()}</span>
                        <span className="are-finding__name">{finding.name}</span>
                        <span className="are-finding__meta">
                          {[finding.location, finding.marked_box && `marked ${finding.marked_box}`].filter(Boolean).join(' · ')}
                        </span>
                        {reason && <span className="are-finding__verify"><WarningAmberIcon fontSize="inherit" /> {reason}</span>}
                      </button>
                      {canEdit && !locked && (
                        <div className="are-finding__decide" role="group" aria-label={`Keep or remove ${finding.name}`}>
                          <button
                            type="button"
                            className={state === 'kept' ? 'is-on' : ''}
                            aria-pressed={state === 'kept'}
                            onClick={() => decideFinding(finding, 'kept')}
                          >
                            ✓ Keep
                          </button>
                          <button
                            type="button"
                            className={state === 'removed' ? 'is-on is-remove' : ''}
                            aria-pressed={state === 'removed'}
                            onClick={() => decideFinding(finding, 'removed')}
                          >
                            ✕ Remove
                          </button>
                        </div>
                      )}
                      {selected === key && (
                        <div className="are-finding__detail">
                          {cleanDescription(finding.description) && <p>{cleanDescription(finding.description)}</p>}
                          {finding.frame_key ? (
                            <div className="are-frame">
                              <div className="are-frame__tabs" role="tablist">
                                {(['marked', 'original'] as const).map(mode => (
                                  <button
                                    key={mode}
                                    type="button"
                                    role="tab"
                                    aria-selected={frameMode === mode}
                                    className={frameMode === mode ? 'is-on' : ''}
                                    onClick={() => setFrameMode(mode)}
                                  >
                                    {mode === 'marked' ? 'Marked' : 'Original'}
                                  </button>
                                ))}
                              </div>
                              {currentFrame?.view?.loading && <div className="are-frame__empty"><CircularProgress size={20} /></div>}
                              {currentFrame?.view?.error && <div className="are-frame__empty">Image could not be loaded</div>}
                              {currentFrame?.view && !currentFrame.view.loading && !currentFrame.view.error && (
                                (frameMode === 'marked' ? currentFrame.view.marked || currentFrame.view.original : currentFrame.view.original) ? (
                                  <img
                                    alt={`${finding.name} — ${frameMode} image`}
                                    src={frameMode === 'marked' ? currentFrame.view.marked || currentFrame.view.original : currentFrame.view.original}
                                  />
                                ) : (
                                  <div className="are-frame__empty">No image</div>
                                )
                              )}
                            </div>
                          ) : (
                            <p className="are-muted">Not marked on an image.</p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </aside>

            {/* ---- report ---- */}
            <section className="are-report" aria-label="Report">
              {diffHtml !== null ? (
                <div className="are-diff">
                  <div className="are-diff__head">
                    Changes compared with AI draft v{reports?.latest_ai_draft?.version}
                    <span><ins>added</ins> <del>removed</del></span>
                    <Button size="small" onClick={() => setDiffHtml(null)}>Back to editing</Button>
                  </div>
                  <div className="are-diff__body" dangerouslySetInnerHTML={{ __html: diffHtml }} />
                </div>
              ) : null}
              <div className={`are-paper${diffHtml !== null ? ' is-hidden' : ''}`}>
                {initialHtml !== null && (
                  <SunEditor
                    key={editorKey}
                    lang="en"
                    setOptions={EDITOR_OPTIONS}
                    defaultValue={initialHtml}
                    disable={!canEdit || locked}
                    ref={(component: any) => {
                      // suneditor-react 2.16: the core editor (setContents) is `.editor`.
                      editorRef.current = component?.editor || null;
                    }}
                    onChange={onEditorChange}
                  />
                )}
              </div>
            </section>
          </div>

          {reports?.latest_ai_draft && (
            <AiReviewBar
              studyInstanceUid={studyUid}
              api={api}
              review={review}
              canReview={canEdit}
              reportLoaded
              verifyCount={flagged.length}
              onReviewChange={setReview}
            />
          )}
        </>
      )}

      {/* Submit */}
      <Dialog open={submitOpen} onClose={() => !saving && setSubmitOpen(false)} aria-labelledby="are-submit-title">
        <DialogTitle id="are-submit-title">Submit report?</DialogTitle>
        <DialogContent>
          The report is saved as a new version and the study is marked as <b>Report Generated</b> in the
          worklist. You can still open and change it afterwards.
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setSubmitOpen(false)} disabled={!!saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={!!saving}
            startIcon={saving === 'submit' ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version history */}
      <Dialog open={historyOpen} onClose={() => { setHistoryOpen(false); setViewing(null); }} fullWidth maxWidth={viewing ? 'md' : 'sm'}>
        <DialogTitle>{viewing ? versionLabel(viewing.meta) : 'Version history'}</DialogTitle>
        <DialogContent dividers>
          {viewing ? (
            <div className="are-version-view" dangerouslySetInnerHTML={{ __html: viewing.html }} />
          ) : (
            <ol className="are-versions">
              {(reports?.versions || []).map(v => (
                <li key={v.report_id}>
                  <button type="button" onClick={() => openVersion(v)}>
                    <b>{versionLabel(v)}</b>
                    <span>
                      {v.kind === 'ai_draft' ? 'AI' : v.created_by_name || 'Radiologist'} · {formatTime(v.created_at)}
                      {v.edit_status === 'edited' && ` · ${Number(v.edit_percent)}% changed`}
                      {v.edit_status === 'not_edited' && ' · AI text unchanged'}
                      {v.edit_status === 'not_from_ai' && ' · written without the AI draft'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
        <DialogActions>
          {viewing ? (
            <>
              <Button onClick={() => setViewing(null)}>Back</Button>
              {canEdit && !locked && <Button variant="contained" onClick={restoreVersion}>Copy into editor</Button>}
            </>
          ) : (
            <Button onClick={() => setHistoryOpen(false)}>Close</Button>
          )}
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        {...guard.dialogProps}
        dark
        message="You have unsaved changes in this report. If you leave now, they will be lost."
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? null : 3500}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.text}</Alert>
      </Snackbar>
    </div>
  );
}

