import React, { useState, useEffect } from 'react';
import '../ReportTemplates/report.css';
import { data } from './reportdata';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header } from '@ohif/ui';

function ReportTemplatesList() {
  const [isActive, setIsActive] = useState(false);

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
          {data.map(item => (
            <li
              key={item.id}
              className={isActive ? 'templatesList_dark' : 'templates-item'}
            >
              <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                {item.title}
              </strong>
              <div className="reports-justify-between items-center sm:flex">
                <Stack
                  direction="row"
                  spacing={2}
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
                  <Button
                    variant="contained"
                    color="success"
                    className="createUserCls"
                    startIcon={<DeleteIcon />}
                  // onClick={handleClick}
                  >
                    Delete
                  </Button>
                </Stack>
              </div>
              <ul>
                {' '}
                <li>{item.Date}</li>
                <li>{item.Type}</li>
                <li>{item.Name}</li>
                <li>{item.Referring}</li>
                <li>{item.Relevantresults}</li>
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ReportTemplatesList;
