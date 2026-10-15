import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import { Header } from '@ohif/ui';
import { useAppConfig } from '@state';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';

import getHeaderMenuOptions from '../../utils/getHeaderMenuOptions';
import { UnsavedChangesDialog, useUnsavedChangesGuard } from '../common/useUnsavedChangesGuard';
import '../ReportTemplates/report.css';
import '../../routes/WorkList/components/worklist.css';
import '../Catalog/catalog.css';
import './generateReport.css';

const FONTS = [
  'Arial', 'Calibri', 'Courier New', 'Georgia', 'Helvetica', 'Sans-Serif', 'Segoe UI',
  'Serif', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
];

// No `plugins` option: suneditor-react registers its own bundled plugins. Passing
// plugins from 'suneditor/src/plugins' mixes two copies of the editor and
// crashes on mount (align plugin reads options the bundled core never sets).
const EDITOR_OPTIONS = {
  minHeight: '58vh',
  height: 'auto',
  defaultStyle: 'font-family: "Segoe UI", Arial, sans-serif; font-size: 15px; line-height: 1.55; color: #111;',
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
    ['fontColor', 'hiliteColor', 'removeFormat'],
    ['outdent', 'indent', 'align', 'list', 'lineHeight'],
    ['table', 'horizontalRule', 'link', 'image'],
    ['fullScreen', 'preview', 'print'],
  ],
  imageRotation: false,
  font: FONTS,
  fontSize: [12, 13, 14, 15, 16, 18, 20],
};

type StudySummary = {
  patientName: string;
  patientAge: string;
  patientSex: string;
  modality: string;
  description: string;
  studyDate: string;
  accession: string;
};
type Source = 'existing' | 'template' | 'blank';

const dicomValue = (study: any, tag: string) => {
  const value = study?.[tag]?.Value?.[0];
  if (value && typeof value === 'object') {
    return String(value.Alphabetic || '').replace(/\^/g, ' ').trim();
  }
  return value == null ? '' : String(value);
};
const formatDicomDate = (value: string) =>
  /^\d{8}$/.test(value || '') ? `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}` : value || '';
const todayDdMmYyyy = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const escapeHtml = (value: string) =>
  String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The patient block a new report starts with (same fields the old page wrote). */
const patientBlock = (study: StudySummary) => `
<p class="patient-info-span" style="width: 200px">
  <b>Patient name :</b>&nbsp;${escapeHtml(study.patientName)}<br />
  <b>Modality :</b>&nbsp;${escapeHtml(study.modality)}<br />
  <b>Study description :</b>&nbsp;${escapeHtml(study.description)}<br />
  <b>Date:</b>&nbsp;${todayDdMmYyyy()}
</p>`;

/**
 * Study Report page: write and submit the report for one study, starting from
 * the existing report or the lab's template for the modality. Submit writes
 * reportRaw, isReportGenerated and the study status, as before.
 */
const GenerateReport = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const params = useParams();
  const studyUid = params.mrn || '';
  const modalityParam = params.modality || '';
  const reportType = params.type || 's';
  const [appConfig] = useAppConfig();
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';
  const hostName = appConfig.pacsHostURL;
  const clientId = (window as any).config?.oidc?.[0]?.client_id || '';
  const labId = sessionStorage.getItem('labId') || '';

  const [isActive, setIsActive] = useState<boolean>(() => {
    try {
      return Boolean(JSON.parse(localStorage.getItem('active_dark') || 'false'));
    } catch {
      return false;
    }
  });
  const authHeaders = useMemo(() => {
    try {
      const oidc = (window as any).config?.oidc?.[0];
      const session = JSON.parse(sessionStorage.getItem(`oidc.user:${oidc?.authority}:${oidc?.client_id}`) || '{}');
      return session?.access_token ? `${session.token_type || 'Bearer'} ${session.access_token}` : '';
    } catch {
      return '';
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [study, setStudy] = useState<StudySummary | null>(null);
  const [source, setSource] = useState<Source>('blank');
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const contentRef = useRef('');

  const guard = useUnsavedChangesGuard(dirty);
  const goToWorklist = () => guard.leave(() => navigate('/workList', { replace: true }));

  // ---- theme: the switch lives in the settings menu ----
  const toggleTheme = () => {
    setIsActive(current => {
      const next = !current;
      try {
        localStorage.setItem('active_dark', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  useEffect(() => {
    document.body.classList.remove('bg-black', 'bg-black-on', 'reportsList_ContainerCls');
  }, [isActive]);

  // ---- load the report, the study and the template in parallel ----
  const load = useCallback(async () => {
    if (!authHeaders) {
      setLoadError('You are signed out. Sign in again to write the report.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    const pacs = hostName.replace(/\/?$/, '/');
    try {
      const [existing, studyRows, templateBody] = await Promise.all([
        fetch(`${pacs}studies/${encodeURIComponent(studyUid)}/metadata/reportRaw`, { headers: { Authorization: authHeaders } })
          .then(r => (r.ok ? r.json() : null))
          .then(body => (typeof body?.reportRaw === 'string' ? body.reportRaw : ''))
          .catch(() => ''),
        fetch(`${pacs}studies?StudyInstanceUID=${encodeURIComponent(studyUid)}&includefield=00101010,00101040,00081030,00100040,00080061`, {
          headers: { Authorization: authHeaders, Accept: 'application/json' },
        })
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${nodeAppHost}/read_study_template_for_generate/${encodeURIComponent(labId || '0')}/${encodeURIComponent(modalityParam)}/${encodeURIComponent(reportType)}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeaders,
            clientId,
            realm: clientId,
            isAccess: 'read_study_template_for_generate',
            labId,
          },
        })
          .then(r => (r.ok ? r.json() : null))
          .then(body => body?.data?.template_content || '')
          .catch(() => ''),
      ]);
      const row = Array.isArray(studyRows) ? studyRows[0] : null;
      const summary: StudySummary = {
        patientName: dicomValue(row, '00100010'),
        patientAge: dicomValue(row, '00101010'),
        patientSex: dicomValue(row, '00100040'),
        modality: (row?.['00080061']?.Value || []).join('/') || modalityParam,
        description: dicomValue(row, '00081030'),
        studyDate: dicomValue(row, '00080020'),
        accession: dicomValue(row, '00080050'),
      };
      setStudy(summary);

      let html = '';
      let from: Source = 'blank';
      if (existing && existing.replace(/<[^>]*>|&nbsp;|\s/g, '')) {
        html = existing;
        from = 'existing';
      } else {
        html = `${patientBlock(summary)}<br/>${templateBody || '<p><br></p>'}`;
        from = templateBody ? 'template' : 'blank';
      }
      contentRef.current = html;
      setSource(from);
      setInitialHtml(html);
      setEditorKey(key => key + 1);
      setDirty(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, clientId, hostName, labId, modalityParam, nodeAppHost, reportType, studyUid]);

  useEffect(() => {
    load();
  }, [load]);

  const onEditorChange = (content: string) => {
    if (content === contentRef.current) {
      return;
    }
    contentRef.current = content;
    setDirty(true);
  };

  // ---- submit: same writes as before ----
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitting) {
      return;
    }
    const text = contentRef.current.replace(/<[^>]*>|&nbsp;|\s/g, '');
    if (!text) {
      setToast({ severity: 'error', text: 'The report is empty.' });
      return;
    }
    setSubmitting(true);
    const pacs = hostName.replace(/\/?$/, '/');
    const post = (path: string, body: unknown) =>
      fetch(`${pacs}studies/${encodeURIComponent(studyUid)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeaders },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
      });
    try {
      await Promise.all([
        post('addmetadata/reportRaw', { data: contentRef.current }),
        post('addmetadata/isReportGenerated', { data: 'true' }),
      ]);
      await post('update_status', { status: 'Report Generated' });
      sessionStorage.setItem('stuID', studyUid);
      sessionStorage.setItem('isReportGenerated', 'true');
      setDirty(false);
      setToast({ severity: 'success', text: 'Report submitted' });
      const reloadInPlace = localStorage.getItem('fiftyPerFlag') === 'true';
      setTimeout(() => {
        if (reloadInPlace) {
          guard.leaveNow(() => window.location.reload());
        } else {
          guard.leaveNow(() => navigate('/workList', { replace: true }));
        }
      }, 800);
    } catch (error) {
      setToast({ severity: 'error', text: "Couldn't submit the report. Check the connection and try again." });
      setSubmitting(false);
    }
  };

  const menuOptions = getHeaderMenuOptions({
    t,
    isActive,
    handleChangeSwitch: toggleTheme,
    navigate: (path: string) => guard.leave(() => navigate(path, { replace: true })),
    appConfig,
    currentPath: '/generate-report',
  });

  const sourceLabel = {
    existing: 'Editing the submitted report',
    template: `From the ${modalityParam} template`,
    blank: 'No template for this modality',
  }[source];
  const summaryItems: [string, string][] = study
    ? ([
        ['Patient', study.patientName],
        ['Age / Sex', [study.patientAge, study.patientSex].filter(Boolean).join(' / ')],
        ['Modality', study.modality],
        ['Study', study.description],
        ['Study date', formatDicomDate(study.studyDate)],
        ['Accession', study.accession],
      ].filter(([, value]) => value) as [string, string][])
    : [];

  return (
    <div>
      <Header
        isSticky
        menuOptions={menuOptions}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={toggleTheme}
        screen="GenerateReport"
        handleRedirectPage={goToWorklist}
        modalityValue={studyUid}
      />

      <main className={classnames('wl', 'cat', 'gr', isActive && 'wl--dark')}>
        <form
          className="wl-card cat-editor gr-card"
          onSubmit={submit}
        >
          <div className="wl-toolbar">
            <button
              type="button"
              className="cat-back"
              aria-label="Back to worklist"
              onClick={goToWorklist}
            >
              <ArrowBackIcon />
            </button>
            <div>
              <h1 className="wl-title">Study report</h1>
              <p className="cat-editor-sub">Write the report and submit it to mark the study as reported.</p>
            </div>
            <span className="wl-spacer" />
            {!loading && !loadError && (
              <span className={classnames('gr-source', `gr-source--${source}`)}>{sourceLabel}</span>
            )}
            <span
              className={classnames('gr-save-state', dirty && 'is-dirty')}
              aria-live="polite"
            >
              {dirty ? 'Unsaved changes' : ''}
            </span>
            <button
              type="button"
              className="wl-btn"
              onClick={goToWorklist}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="wl-btn wl-btn--primary"
              disabled={loading || !!loadError || submitting}
            >
              {submitting ? <CircularProgress size={14} color="inherit" /> : <SendOutlinedIcon aria-hidden="true" />}
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>

          {summaryItems.length > 0 && (
            <dl className="gr-summary">
              {summaryItems.map(([label, value]) => (
                <div
                  key={label}
                  className="gr-summary__item"
                >
                  <dt>{label}</dt>
                  <dd title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {loading && (
            <div className="gr-loading">
              <CircularProgress size={26} />
              <span>Loading the report…</span>
            </div>
          )}
          {!loading && loadError && (
            <div className="gr-error">
              <Alert
                severity="error"
                action={
                  <button
                    type="button"
                    className="wl-btn"
                    onClick={load}
                  >
                    Retry
                  </button>
                }
              >
                {loadError}
              </Alert>
            </div>
          )}

          {!loading && !loadError && initialHtml !== null && (
            <div className="cat-editor-surface gr-surface">
              <SunEditor
                key={editorKey}
                lang="en"
                setOptions={EDITOR_OPTIONS}
                defaultValue={initialHtml}
                onChange={onEditorChange}
              />
            </div>
          )}
        </form>
      </main>

      <UnsavedChangesDialog
        {...guard.dialogProps}
        dark={isActive}
        message="You have unsaved changes in this report. If you leave now, they will be lost."
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? null : 3000}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity || 'success'}
          onClose={() => setToast(null)}
        >
          {toast?.text}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default GenerateReport;
