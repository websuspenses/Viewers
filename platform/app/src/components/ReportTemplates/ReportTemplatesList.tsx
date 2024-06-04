import React, { useState, useEffect } from 'react';
import '../ReportTemplates/report.css';
//import { data } from './reportdata';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';

function ReportTemplatesList() {
  const [isActive, setIsActive] = useState(false);
  const [templateData, setData] = useState([]);
  const [showconfirm, setShowConfirm] = useState(false);

  const labId = 2;
  const nodeAppHost = 'http://localhost:3300';

  useEffect(() => {
    fetch(`${nodeAppHost}/read_templates/${labId}`)
      .then(response => response.json())
      .then(actualData => {
        console.log('actualData ', actualData);
        setData(actualData.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);

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
  const handleCloseConfirmation = () => {
    setShowConfirm(false);
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
          <Link
            to="/create-template"
            style={{ textDecoration: 'none' }}
          >
            <Button
              variant="contained"
              color="success"
              className="createUserCls"
            //</div>onClick={() => setShowAddMode(true)
            >
              Create Template
            </Button>
          </Link>
        </div>
        <ul className="templatesList">
          {/* {templateData[0]} */}
          {templateData.map(item => (
            <li
              key={item.labName}
              className={isActive ? 'templatesList_dark' : 'templates-item'}
            >
              <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                {item.modality}
              </strong>
              <div className="reports-justify-between items-center sm:flex">
                <Stack
                  direction="row"
                  spacing={2}
                >
                  <Link
                    to={`/create-template/${item.modality}/${item.template_id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button
                      variant="contained"
                      color="success"
                      className="createUserCls"
                      startIcon={<EditIcon />}
                    //onClick={() => setShowEditMode(true)}
                    >
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="contained"
                    color="success"
                    className="createUserCls"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteTemplate}
                  >
                    Delete
                  </Button>
                </Stack>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {showconfirm && (
        <ConfirmationDialog
          open={showconfirm}
          handleClose={handleCloseConfirmation}
          screen="ReportTemplatesList"
        />
      )}
    </div>
  );
}

export default ReportTemplatesList;