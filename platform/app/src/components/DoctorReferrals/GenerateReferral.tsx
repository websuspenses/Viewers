import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useNavigate } from 'react-router-dom';
import { useAppConfig } from '@state';

import '../../routes/WorkList/components/worklist.css';
import './generateReferral.css';

interface Doctor {
  doc_id: string;
  doc_name: string;
  doc_specialization: string;
  doc_clinic: string;
  doc_phone_number: string;
  doc_email: string;
}

interface Props {
  open: boolean;
  handleClose: () => void;
  StudyInstanceUId: string;
  /** Shown under the title, e.g. "TEST^ONE · CT · Brain plain". */
  studyLabel?: string;
  /** Worklist dark mode. */
  isActive?: boolean;
}

const NOTE_MAX = 500;

const initials = (name: string) =>
  String(name || '')
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || '?';

const maskPhone = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '';
};

/**
 * Refer a study to a doctor from the lab's referral list. The doctor gets a
 * WhatsApp message with a secure link to the study (teleapp send_study_referral),
 * and the study status becomes "Referral sent".
 */
function GenerateReferral({ open, handleClose, StudyInstanceUId, studyLabel, isActive = false }: Props) {
  const navigate = useNavigate();
  const [appConfig] = useAppConfig();
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';
  const hostName = appConfig.pacsHostURL;
  const clientId = (window as any).config?.oidc?.[0]?.client_id || '';
  const authHeaders = useMemo(() => {
    try {
      const oidc = (window as any).config?.oidc?.[0];
      const session = JSON.parse(sessionStorage.getItem(`oidc.user:${oidc?.authority}:${oidc?.client_id}`) || '{}');
      return session?.access_token ? `${session.token_type || 'Bearer'} ${session.access_token}` : '';
    } catch {
      return '';
    }
  }, []);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const loadDoctors = useCallback(async () => {
    if (!authHeaders) {
      setLoadState('error');
      return;
    }
    setLoadState('loading');
    try {
      const response = await fetch(`${nodeAppHost}/get_referral_doctors`, {
        headers: {
          Authorization: authHeaders,
          clientId,
          realm: clientId,
          'Content-Type': 'application/json',
          isAccess: 'view_referral_doctors_list',
          labId: sessionStorage.getItem('labId') || '',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();
      setDoctors(Array.isArray(body?.data) ? body.data : []);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [authHeaders, clientId, nodeAppHost]);

  useEffect(() => {
    if (open) {
      loadDoctors();
    }
  }, [open, loadDoctors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return doctors;
    }
    return doctors.filter(d =>
      [d.doc_name, d.doc_specialization, d.doc_clinic].some(field => String(field || '').toLowerCase().includes(q))
    );
  }, [doctors, query]);
  const selected = doctors.find(d => String(d.doc_id) === String(selectedId));

  const close = () => {
    if (!sending) {
      handleClose();
    }
  };

  const send = async () => {
    if (!selected || sending) {
      return;
    }
    setSending(true);
    setError('');
    const headers = { 'Content-Type': 'application/json', Authorization: authHeaders, clientId, realm: clientId };
    const pacs = hostName.replace(/\/?$/, '/');
    try {
      const urlResponse = await fetch(`${pacs}studies/${encodeURIComponent(StudyInstanceUId)}/get_cloud_url`, { headers });
      if (!urlResponse.ok) {
        throw new Error("The study link couldn't be created. Is the study sent to the cloud?");
      }
      const { url } = await urlResponse.json();
      const comment = note.trim()
        ? `${note.trim()}\n\nStudy link: ${url}`
        : `Hello Doctor, Could you please check below URL: ${url}`;
      const referral = await fetch(`${nodeAppHost}/send_study_referral`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sr_to_doctor: selected.doc_id,
          sr_requester_comments: comment,
          sr_url: url,
          sr_host_name: nodeAppHost,
        }),
      });
      if (!referral.ok) {
        throw new Error(referral.status === 403
          ? 'Referrals are not enabled for your account.'
          : "The referral couldn't be sent. Try again.");
      }
      const status = await fetch(`${pacs}studies/${encodeURIComponent(StudyInstanceUId)}/update_status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: 'Referral sent' }),
      });
      if (!status.ok) {
        throw new Error('The referral was sent, but the study status could not be updated.');
      }
      setSentTo(selected.doc_name);
      setTimeout(() => {
        handleClose();
        navigate('/workList');
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The referral couldn't be sent.");
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      aria-labelledby="referral-title"
      PaperProps={{ className: classnames('wl-pop', 'rf', isActive && 'wl--dark') }}
    >
      {sentTo ? (
        <div
          className="rf-done"
          role="status"
        >
          <CheckCircleIcon className="rf-done__icon" />
          <h2 className="rf-title">Referral sent</h2>
          <p className="rf-sub">{sentTo} will receive a WhatsApp message with a secure link to this study.</p>
        </div>
      ) : (
        <>
          <header className="rf-head">
            <div>
              <h2
                id="referral-title"
                className="rf-title"
              >
                Refer study to a doctor
              </h2>
              {studyLabel && <p className="rf-sub">{studyLabel}</p>}
            </div>
            <button
              type="button"
              className="rf-close"
              aria-label="Close"
              onClick={close}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="rf-body">
            <label className="rf-search">
              <SearchIcon aria-hidden="true" />
              <input
                id="referral-search"
                type="search"
                placeholder="Search by name, specialty or clinic"
                value={query}
                onChange={event => setQuery(event.target.value)}
                disabled={loadState !== 'ready' || !doctors.length}
                autoFocus
              />
            </label>

            <div
              className="rf-list"
              role="radiogroup"
              aria-label="Doctors"
            >
              {loadState === 'loading' && (
                <div className="rf-state">
                  <CircularProgress size={22} />
                  <span>Loading doctors…</span>
                </div>
              )}
              {loadState === 'error' && (
                <div className="rf-state">
                  <span>The doctor list couldn't be loaded.</span>
                  <button
                    type="button"
                    className="wl-btn"
                    onClick={loadDoctors}
                  >
                    Retry
                  </button>
                </div>
              )}
              {loadState === 'ready' && !doctors.length && (
                <div className="rf-state">
                  <PersonAddAltOutlinedIcon className="rf-state__icon" />
                  <span>No referral doctors yet.</span>
                  <button
                    type="button"
                    className="wl-btn wl-btn--ghost"
                    onClick={() => {
                      handleClose();
                      navigate('/doctor-referrals');
                    }}
                  >
                    Add doctors
                  </button>
                </div>
              )}
              {loadState === 'ready' && doctors.length > 0 && !filtered.length && (
                <div className="rf-state">
                  <span>No doctor matches “{query}”.</span>
                </div>
              )}
              {filtered.map(doctor => {
                const id = String(doctor.doc_id);
                const checked = id === String(selectedId);
                return (
                  <label
                    key={id}
                    className={classnames('rf-doctor', checked && 'is-selected')}
                  >
                    <input
                      type="radio"
                      name="referral-doctor"
                      value={id}
                      checked={checked}
                      onChange={() => {
                        setSelectedId(id);
                        setError('');
                      }}
                    />
                    <span
                      className="rf-avatar"
                      aria-hidden="true"
                    >
                      {initials(doctor.doc_name)}
                    </span>
                    <span className="rf-doctor__text">
                      <span className="rf-doctor__name">{doctor.doc_name}</span>
                      <span className="rf-doctor__meta">
                        {[doctor.doc_specialization, doctor.doc_clinic].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    {maskPhone(doctor.doc_phone_number) && (
                      <span className="rf-doctor__phone">
                        <WhatsAppIcon aria-hidden="true" />
                        {maskPhone(doctor.doc_phone_number)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <label className="rf-note">
              <span>Note to the doctor (optional)</span>
              <textarea
                id="referral-note"
                rows={3}
                maxLength={NOTE_MAX}
                placeholder="e.g. Please review the right temporal finding — patient has a follow-up on Friday."
                value={note}
                onChange={event => setNote(event.target.value)}
              />
              <small>{note.length}/{NOTE_MAX}</small>
            </label>

            {error && (
              <p
                className="rf-error"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <footer className="rf-foot">
            <span className="rf-hint">
              <WhatsAppIcon aria-hidden="true" />
              The doctor gets a WhatsApp message with a secure link.
            </span>
            <span className="wl-spacer" />
            <button
              type="button"
              className="wl-btn"
              onClick={close}
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="wl-btn wl-btn--primary"
              onClick={send}
              disabled={!selected || sending}
            >
              {sending ? <CircularProgress size={14} color="inherit" /> : <SendOutlinedIcon aria-hidden="true" />}
              {sending ? 'Sending…' : selected ? `Refer to ${selected.doc_name}` : 'Choose a doctor'}
            </button>
          </footer>
        </>
      )}
    </Dialog>
  );
}

export default GenerateReferral;
