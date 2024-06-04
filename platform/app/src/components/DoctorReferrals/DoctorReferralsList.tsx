
import React, { useState, useEffect } from 'react';
import '../ReportTemplates/report.css';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';
import CreateDoctorReferral from './CreateDoctorReferral';
import './ReferralStyle.css';
import Tooltip from '@mui/material/Tooltip';

function DoctorReferralsList() {
  const [isActive, setIsActive] = useState(false);
  const [showconfirm, setShowConfirm] = useState(false);
  const [referralPopup, setReferralPopup] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [doctorsList, setDoctorsList] = useState([]);
  const [editItem, setEachItem] = useState('');
  // const [editItemId, setEachItemID] = useState('');
  const nodeAppHost = 'http://localhost:3300';
  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('reportsList_ContainerCls');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.add('reportsList_ContainerCls');
    };
  }, []);

  useEffect(() => {
    fetch(`${nodeAppHost}/get_referral_doctors`)
      .then(response => response.json())
      .then(actualData => {
        console.log('actualData ', actualData);
        setDoctorsList(actualData.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);

  useEffect(() => {
    if (isActive) {
      document.body.classList.remove('bg-black');
      document.body.classList.add('bg-black-on');
    } else {
      document.body.classList.remove('bg-black-on');
      document.body.classList.add('bg-black');
    }
  }, [isActive]);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('active_dark'));
    if (items) {
      setIsActive(items);
    }
  }, []);

  function handleChangeSwitch() {
    setIsActive(!isActive);
  }

  useEffect(() => {
    localStorage.setItem('active_dark', JSON.stringify(isActive));
    document.body.classList.remove('bg-black');
  }, [isActive]);

  const handleDeleteTemplate = () => {
    setShowConfirm(true);
  };
  // const handleEditItem = (id, item) => {
  //   setEachItemID(id);
  //   console.log('item', item);
  //   setEachItem(item);
  //   setShowEditConfirm(true);
  // };

  const handleEditItem = docId => {
    const editData = doctorsList.find(item => item.doc_id === docId);
    setEachItem(editData);
    setShowEditConfirm(true);
  };

  const handleCloseConfirmation = () => {
    if (showconfirm) {
      setShowConfirm(false);
    } else if (referralPopup) {
      setReferralPopup(false);
    } else {
      setShowEditConfirm(false);
    }
  };

  return (
    <div>
      <Header
        isSticky
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        screen="ReportTemplateList"
      />
      <div className="reportcontainer">
        <div className="createBtnCls">
          <Link style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              color="success"
              className="createUserCls"
              onClick={() => setReferralPopup(true)}
            >
              Create Referral
            </Button>
          </Link>
        </div>

        <ul className="templatesList">
          {doctorsList &&
            doctorsList.length > 0 &&
            doctorsList.map(item => (
              <li
                key={item.doc_id}
                className={isActive ? 'templatesList_dark' : 'templates-item'}
              >
                <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                  {item.doc_name}
                </strong>
                <br />
                <b style={{ fontWeight: 'bold' }}>{item.doc_specialization}</b>
                <br />
                <b style={{ fontWeight: 'bold' }}>{item.doc_clinic}</b>
                <br />
                <b style={{ fontWeight: 'bold' }}>{item.doc_phone_number}</b>
                <br />
                <b style={{ fontWeight: 'bold' }}>{item.doc_email}</b>
                <br />

                <div className="buttonAdjustCls items-center sm:flex">
                  <Stack
                    direction="row"
                    spacing={2}
                  >
                    <Tooltip title="Edit">
                      <EditIcon
                        style={{ cursor: 'pointer' }}
                        title="Edit"
                        onClick={() => handleEditItem(item.doc_id)}
                      />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <DeleteIcon
                        style={{ cursor: 'pointer' }}
                        title="Delete"
                        onClick={handleDeleteTemplate}
                      />
                    </Tooltip>
                  </Stack>
                </div>
              </li>
            ))}
        </ul>
      </div>
      {showEditConfirm && (
        <CreateDoctorReferral
          open={showEditConfirm}
          handleClose={handleCloseConfirmation}
          screen="EditScreen"
          editData={editItem}
        />
      )}
      {showconfirm && (
        <ConfirmationDialog
          open={showconfirm}
          handleClose={handleCloseConfirmation}
          screen="DoctorReferralsList"
        />
      )}
      {referralPopup && (
        <CreateDoctorReferral
          open={referralPopup}
          handleClose={handleCloseConfirmation}
          screen="CreateScreen"
          setReferralPopup={setReferralPopup}
        />
      )}
    </div>
  );
}

export default DoctorReferralsList;