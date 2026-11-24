import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import EditNoteIcon from '@mui/icons-material/EditNote';

import type { ReviewApi } from '../../routes/WorkList/AiAnalysisDialog/aiReview';
import {
  BACKGROUND_FIELDS,
  BackgroundField,
  HistoryEntry,
  PatientHistory,
  getPatientHistory,
  markNoteEnteredInError,
  sameName,
  savePatientHistory,
} from './patientHistoryApi';
import './patientHistory.css';

type Props = {
  api: ReviewApi;
  patientId: string;
  patientName?: string;
  /** DICOM age ("047Y") and sex, stored with the profile when the user saves. */
  patientAge?: string;
  patientSex?: string;
  /** The study open now: new entries are linked to it, and its entries are marked. */
  studyId?: string;
  readOnly?: boolean;
};

type Form = Record<BackgroundField, string> & { clinical_notes: string };

const EMPTY_FORM: Form = { past_medical_history: '', comorbidities: '', allergies: '', clinical_notes: '' };

const formatWhen = (iso?: string | null) => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const ageOf = (value?: string) => {
  const match = /^0*(\d+)\s*([DWMY])$/i.exec((value || '').trim());
  return match ? `${match[1]}${match[2].toUpperCase()}` : (value || '').trim();
};

/** What an entry changed in the background, compared with the entry before it. */
function changesOf(entry: HistoryEntry, older?: HistoryEntry) {
  return BACKGROUND_FIELDS.filter(({ key }) => (entry[key] || '') !== (older?.[key] || '')).map(({ key, label }) => ({
    label,
    text: entry[key] || '',
  }));
}

/**
 * Patient clinical history across studies: the background as it stands (past
 * medical history, comorbidities, allergies), every earlier entry and note, and
 * a form to update the background and add a note. Loads and saves through
 * teleapp (patientHistoryApi.ts) without blocking the page. A wrong note is
 * marked as entered in error, with a reason (2026-11-24): kept, struck through,
 * no longer sent to the AI.
 */
export default function PatientHistoryPanel({
  api,
  patientId,
  patientName,
  patientAge,
  patientSex,
  studyId,
  readOnly,
}: Props) {
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  // The entry whose note is being marked as entered in error, and why.
  const [marking, setMarking] = useState<HistoryEntry['history_id'] | null>(null);
  const [reason, setReason] = useState('');
  const [markBusy, setMarkBusy] = useState(false);

  const resetForm = (data: PatientHistory | null) =>
    setForm({
      past_medical_history: data?.background.past_medical_history.text || '',
      comorbidities: data?.background.comorbidities.text || '',
      allergies: data?.background.allergies.text || '',
      clinical_notes: '',
    });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!patientId || !api.authHeaders) {
        setLoading(false);
        setError(patientId ? 'Sign in again to see the patient history.' : 'This study has no patient ID.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await getPatientHistory(api, patientId, signal);
        setHistory(data);
        resetForm(data);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          setError((err as Error).message || 'The history could not be loaded.');
        }
      } finally {
        setLoading(false);
      }
    },
    [api, patientId]
  );

  useEffect(() => {
    const controller = new AbortController();
    setEditing(false);
    setMarking(null);
    setMessage('');
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const dirty = useMemo(
    () =>
      Boolean(form.clinical_notes.trim()) ||
      BACKGROUND_FIELDS.some(({ key }) => form[key].trim() !== (history?.background[key].text || '')),
    [form, history]
  );

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await savePatientHistory(api, patientId, {
        ...form,
        full_name: patientName || '',
        age: ageOf(patientAge),
        sex: (patientSex || '').trim().toUpperCase().slice(0, 1),
        study_id: studyId || '',
      });
      setHistory(data);
      resetForm(data);
      setEditing(false);
      setMessage(data.unchanged ? 'Nothing changed.' : 'Saved.');
    } catch (err) {
      setError((err as Error).message || 'The history could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const markError = async (historyId: HistoryEntry['history_id']) => {
    setMarkBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await markNoteEnteredInError(api, patientId, historyId, reason.trim());
      setHistory(data);
      setMarking(null);
      setReason('');
      setMessage('Note marked as entered in error.');
    } catch (err) {
      setError((err as Error).message || 'The note could not be marked.');
    } finally {
      setMarkBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ph-panel ph-loading">
        <CircularProgress size={18} /> Loading patient history…
      </div>
    );
  }

  const entries = history?.entries || [];
  const storedName = history?.profile?.full_name;

  return (
    <div className="ph-panel">
      {storedName && !sameName(storedName, patientName) && (
        <Alert severity="warning" className="ph-alert">
          Patient ID {patientId} is recorded for <b>{storedName}</b>, not {patientName}. Check that this is the
          same patient before using or adding history.
        </Alert>
      )}
      {error && (
        <Alert
          severity="error"
          className="ph-alert"
          action={
            <Button color="inherit" size="small" onClick={() => load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!editing && (
        <dl className="ph-background">
          {BACKGROUND_FIELDS.map(({ key, label }) => {
            const field = history?.background[key];
            return (
              <div key={key} className="ph-field">
                <dt>{label}</dt>
                <dd className={field?.text ? '' : 'ph-muted'}>{field?.text || 'Not recorded'}</dd>
                {field?.text && field.updated_at && (
                  <dd className="ph-meta">
                    Updated {formatWhen(field.updated_at)}
                    {field.updated_by_name ? ` by ${field.updated_by_name}` : ''}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      )}

      {!readOnly && !editing && (
        <div className="ph-actions">
          <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} onClick={() => setEditing(true)} disabled={!!error && !history}>
            Update history / add note
          </Button>
          {message && <span className="ph-message">{message}</span>}
        </div>
      )}

      {editing && (
        <div className="ph-form">
          {BACKGROUND_FIELDS.map(({ key, label }) => (
            <TextField
              key={key}
              label={label}
              value={form[key]}
              onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
              multiline
              minRows={2}
              size="small"
              fullWidth
              inputProps={{ maxLength: 4000 }}
            />
          ))}
          <TextField
            label="New clinical note"
            placeholder="Symptoms, referral question, relevant history for this visit…"
            value={form.clinical_notes}
            onChange={event => setForm(current => ({ ...current, clinical_notes: event.target.value }))}
            multiline
            minRows={3}
            size="small"
            fullWidth
            inputProps={{ maxLength: 8000 }}
          />
          <div className="ph-actions">
            <Button size="small" variant="contained" onClick={save} disabled={saving || !dirty}>
              {saving ? <CircularProgress size={14} color="inherit" /> : 'Save'}
            </Button>
            <Button
              size="small"
              onClick={() => {
                resetForm(history);
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="ph-timeline-head">
        Earlier entries <span>{entries.length}</span>
      </div>
      {!entries.length && <p className="ph-muted">No history recorded for this patient yet.</p>}
      <ol className="ph-timeline">
        {entries.map((entry, index) => {
          const changes = changesOf(entry, entries[index + 1]);
          return (
            <li key={entry.history_id}>
              <div className="ph-entry-head">
                <b>{formatWhen(entry.created_at)}</b>
                {entry.created_by_name && <span> · {entry.created_by_name}</span>}
                {entry.study_id && studyId && entry.study_id === studyId && <span className="ph-chip">this study</span>}
                {entry.study_id && entry.study_id !== studyId && <span className="ph-chip ph-chip--muted">earlier study</span>}
              </div>
              {entry.clinical_notes && (
                <p className={entry.entered_in_error ? 'ph-note ph-note--error' : 'ph-note'}>{entry.clinical_notes}</p>
              )}
              {entry.clinical_notes && entry.entered_in_error && (
                <p className="ph-error-mark">
                  <b>Entered in error</b>
                  {entry.entered_in_error.by_name ? ` by ${entry.entered_in_error.by_name}` : ''}
                  {entry.entered_in_error.at ? `, ${formatWhen(entry.entered_in_error.at)}` : ''}:{' '}
                  {entry.entered_in_error.reason}. Not sent to the AI.
                </p>
              )}
              {!readOnly && entry.clinical_notes && !entry.entered_in_error && marking !== entry.history_id && (
                <Button
                  size="small"
                  className="ph-error-btn"
                  onClick={() => {
                    setMarking(entry.history_id);
                    setReason('');
                    setMessage('');
                  }}
                  disabled={markBusy}
                >
                  Entered in error
                </Button>
              )}
              {!readOnly && marking === entry.history_id && (
                <div className="ph-form ph-error-form">
                  <TextField
                    label="Why is this note wrong?"
                    placeholder="e.g. test note, wrong patient, wrong history"
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    size="small"
                    fullWidth
                    autoFocus
                    inputProps={{ maxLength: 1000 }}
                    helperText="The note is kept and shown struck through, and is no longer sent to the AI. This cannot be undone."
                  />
                  <div className="ph-actions">
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={() => markError(entry.history_id)}
                      disabled={markBusy || !reason.trim()}
                    >
                      {markBusy ? <CircularProgress size={14} color="inherit" /> : 'Mark as entered in error'}
                    </Button>
                    <Button size="small" onClick={() => setMarking(null)} disabled={markBusy}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {changes.map(change => (
                <p key={change.label} className="ph-change">
                  <b>{change.label}:</b> {change.text || <i>cleared</i>}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
