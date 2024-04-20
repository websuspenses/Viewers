import React, { useState, useEffect } from 'react';
import { BsPersonFill } from 'react-icons/bs';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';

import Stack from '@mui/material/Stack';
import { data } from '../data/data.js';
import SideBar from '../SideBar';
import Navbar from '../Navbar';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AlertDialog from './AlertDialog';

const Users = () => {
  const [isActive, setIsActive] = useState(false);
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    document.body.classList.add('bg-black-dashboard');
    return () => {
      document.body.classList.remove('bg-black-dashboard');
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      document.body.classList.add('bg-black-darkMode-dashboard');
      document.body.classList.remove('bg-black-dashboard');
    } else {
      document.body.classList.remove('bg-black-darkMode-dashboard');
      document.body.classList.add('bg-black-dashboard');
    }
  }, [isActive]);

  const handleChange = () => {
    setIsActive(!isActive);
  };

  const handleClick = () => {
    setNotify(true);
  };

  const handleClose = () => {
    setNotify(false);
  };
  return (
    <>
      <div className="dashboard">
        <SideBar isActive={isActive} />
        <div className="dashboardContainer">
          <Navbar
            isActive={isActive}
            handleChange={handleChange}
          />
          <div className="min-h-screen bg-gray-100">
            <div className="justify-between-user flex p-4">
              <h6 style={{ fontWeight: '800' }}>Users List</h6>
              <Button
                variant="contained"
                color="success"
                startIcon={<AddCircleOutlineIcon />}
              >
                Create User
              </Button>
            </div>
            <div className="p-4">
              <div className="m-auto w-full overflow-y-auto rounded-lg border bg-white p-4">
                <div className="my-3 grid cursor-pointer grid-cols-2 items-center justify-between p-2 sm:grid-cols-3 md:grid-cols-4">
                  <span>Name</span>
                  <span className="text-right sm:text-left">Email</span>
                  <span className="hidden md:grid">Last Order</span>
                  <span className="hidden sm:grid">Method</span>
                  <span className="hidden sm:grid">Actions</span>
                </div>
                <ul>
                  {data.map((order, id) => (
                    <li
                      key={id}
                      className="my-3 grid cursor-pointer grid-cols-2 items-center justify-between rounded-lg bg-gray-50 p-2 hover:bg-gray-100 sm:grid-cols-3 md:grid-cols-4"
                    >
                      <div className="flex items-center">
                        <div className="rounded-lg bg-purple-100 p-3">
                          <BsPersonFill className="text-purple-800" />
                        </div>
                        <p className="pl-4">{order.name.first + ' ' + order.name.last}</p>
                      </div>
                      <p className="text-right text-gray-600 sm:text-left">
                        {order.name.first}@gmail.com
                      </p>
                      <p className="hidden md:flex">{order.date}</p>
                      <div className="hidden items-center justify-between sm:flex">
                        <p>{order.method}</p>
                        {/* <BsThreeDotsVertical /> */}
                      </div>
                      <div className="hidden items-center justify-between sm:flex">
                        {/* <FaEdit
                          title="edit"
                          style={{ color: 'blue' }}
                        />
                        &nbsp;&nbsp;&nbsp;
                        <MdDelete
                          title="delete"
                          style={{ color: 'red' }}
                        /> */}
                        <Stack
                          direction="row"
                          spacing={2}
                        >
                          <Button
                            variant="contained"
                            color="primary"
                            startIcon={<EditIcon />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={handleClick}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      {notify && (
        <AlertDialog
          open={notify}
          handleClose={handleClose}
        />
      )}
    </>
  );
};

export default Users;
