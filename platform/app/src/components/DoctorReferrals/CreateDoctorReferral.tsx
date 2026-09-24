import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import isDarkTheme from '../../utils/isDarkTheme';
import { useNavigate } from 'react-router-dom';
import { Dispatch, SetStateAction } from 'react';
import { useAppConfig } from '@state';

interface FormValues {
  doctorId: string;
  doctorName: string;
  specialization: string;
  clinic: string;
  phoneNumber: string;
  email: string;
}

interface FormErrors {
  doctorName?: string;
  specialization?: string;
  clinic?: string;
  phoneNumber?: string;
  email?: string;
}

interface EditData {
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
  screen?: string;
  editData?: EditData;
  setReferralPopup?: Dispatch<SetStateAction<boolean>>;
  sendUpdateMessage: (message: { message: string; status: string }) => void;
  isActive?: boolean;
}

/** One labelled input; styles in ui Modal/ciai-dialog.css. */
function Field({
  label,
  error,
  hint,
  full = false,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  full?: boolean;
}) {
  return (
    <label
      className={`ciai-field${error ? ' ciai-field--error' : ''}${full ? ' ciai-field--full' : ''}`}
    >
      <span>
        {label} <em>*</em>
      </span>
      <input
        autoComplete="off"
        aria-invalid={!!error}
        {...input}
      />
      {error ? (
        <span className="ciai-field__error">{error}</span>
      ) : hint ? (
        <span className="ciai-field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

function CreateDoctorReferral(props: Props) {
  const { open, handleClose, screen, editData, sendUpdateMessage } = props;
  const isDark = props.isActive ?? isDarkTheme();
  const isEdit = screen === 'EditScreen';
  const navigate = useNavigate();
  const [appConfig] = useAppConfig();

  const [initialValues, setInitialValues] = useState<FormValues>({
    doctorId: '',
    doctorName: '',
    specialization: '',
    clinic: '',
    phoneNumber: '',
    email: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  //const nodeAppHost = process.env.REACT_APP_HOST_NAME;
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!initialValues.doctorName.trim()) {
      newErrors.doctorName = 'Doctor name is required';
    }

    if (!initialValues.specialization.trim()) {
      newErrors.specialization = 'Specialization is required';
    }

    if (!initialValues.clinic.trim()) {
      newErrors.clinic = 'Clinic is required';
    }

    if (!initialValues.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\d{10}$/.test(initialValues.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number format';
    }

    if (!initialValues.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(initialValues.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handelChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const { name, value } = event.target;
    setInitialValues(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  useEffect(() => {
    if (editData) {
      setInitialValues({
        doctorId: editData.doc_id,
        doctorName: editData.doc_name,
        specialization: editData.doc_specialization,
        clinic: editData.doc_clinic,
        phoneNumber: editData.doc_phone_number,
        email: editData.doc_email,
      });
    }
  }, [editData]);

  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const sessInfo = JSON.parse(
        sessionStorage.getItem(
          `oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`
        ) || '{}'
      );
      const authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
      const clientId = window.config.oidc[0].client_id;

      let url = `${nodeAppHost}/add_referral_doctor`;
      let apitype = 'create';

      const formData = {
        doc_id: initialValues.doctorId,
        doc_name: initialValues.doctorName,
        doc_specialization: initialValues.specialization,
        doc_clinic: initialValues.clinic,
        doc_phone_number: initialValues.phoneNumber,
        doc_email: initialValues.email,
      };

      if (initialValues.doctorId !== '') {
        apitype = 'update';
        url = `${nodeAppHost}/update_referral_doctor`;
      }

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeaders,
          clientId: clientId,
          realm: clientId,
          isAccess: 'create_referral_doctor',
          labId: sessionStorage.getItem('labId') || '',
          userSub: sessionStorage.getItem('user_sub') || '',
        },
        body: JSON.stringify(formData),
      };

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result) {
        setInitialValues({
          doctorId: '',
          doctorName: '',
          specialization: '',
          clinic: '',
          phoneNumber: '',
          email: '',
        });

        sendUpdateMessage({
          message: apitype === 'update' ? 'Updated Successfully...' : 'Created Successfully...',
          status: 'success',
        });

        handleClose();
        navigate('/doctor-referrals');
      }
    } catch (error) {
      console.error('Error:', error);
      sendUpdateMessage({
        message: error instanceof Error ? error.message : 'Something went wrong...',
        status: 'error',
      });
    }
  };

  const handleResetForm = () => {
    setInitialValues({
      doctorId: '',
      doctorName: '',
      specialization: '',
      clinic: '',
      phoneNumber: '',
      email: '',
    });
    setErrors({});
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="doctor-dialog-title"
      PaperProps={{ className: `ciai-dialog${isDark ? ' ciai-dialog--dark' : ''}` }}
    >
      <div className="ciai-dialog__head">
        <div className="ciai-dialog__icon">
          {isEdit ? <ManageAccountsOutlinedIcon /> : <PersonAddAlt1OutlinedIcon />}
        </div>
        <div className="ciai-dialog__titles">
          <h2
            id="doctor-dialog-title"
            className="ciai-dialog__title"
          >
            {isEdit ? 'Update Doctor Details' : 'Add Doctor Details'}
          </h2>
          <p className="ciai-dialog__subtitle">
            {isEdit
              ? 'Changes apply to future referrals to this specialist.'
              : 'Add a study review specialist you can refer studies to.'}
          </p>
        </div>
        <button
          type="button"
          className="ciai-dialog__close"
          aria-label="Close"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
      </div>
      <form
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="ciai-dialog__body">
          <div className="ciai-form">
            <Field
              label="Doctor name"
              name="doctorName"
              placeholder="Dr. Anitha Reddy"
              value={initialValues.doctorName}
              onChange={handelChangeInput}
              error={errors.doctorName}
            />
            <Field
              label="Specialization"
              name="specialization"
              placeholder="e.g. Neuroradiology"
              value={initialValues.specialization}
              onChange={handelChangeInput}
              error={errors.specialization}
            />
            <Field
              label="Clinic"
              name="clinic"
              placeholder="Hospital or diagnostic centre"
              value={initialValues.clinic}
              onChange={handelChangeInput}
              error={errors.clinic}
            />
            <Field
              label="Phone number"
              name="phoneNumber"
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={initialValues.phoneNumber}
              onChange={handelChangeInput}
              error={errors.phoneNumber}
              hint="10 digits, no spaces"
            />
            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="name@hospital.com"
              value={initialValues.email}
              onChange={handelChangeInput}
              error={errors.email}
              full
            />
          </div>
        </div>
        <div className="ciai-dialog__foot">
          <button
            type="button"
            className="ciai-btn ciai-btn--ghost"
            onClick={handleResetForm}
            disabled={isEdit}
          >
            Clear
          </button>
          <span className="ciai-spacer" />
          <button
            type="button"
            className="ciai-btn"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ciai-btn ciai-btn--primary"
          >
            {isEdit ? 'Update' : 'Submit'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default CreateDoctorReferral;
