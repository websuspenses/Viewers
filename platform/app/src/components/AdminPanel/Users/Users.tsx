import React, { useState, useEffect } from 'react';
import { BsPersonFill } from 'react-icons/bs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SideBar from '../SideBar';
import Navbar from '../Navbar';
import { data } from '../data/data.js';
import ConfirmationDialog from './ConfirmationDialog';
import CreateUser from './CreateUser';
import EditUser from './EditUser';

const Users = () => {

	const [isActive, setIsActive] = useState(false);
	const [notify, setNotify] = useState(false);
	const [showAddMode, setShowAddMode] = useState(false);
	const [showEditMode, setShowEditMode] = useState(false);
	const [initialvalues, setInitialValues] = useState({
		name: '',
		username: '',
		email: '',
		phone: '',
		website: '',
	})

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
		if (showAddMode) {
			setShowAddMode(false)
		}
		else if (showEditMode) {
			setShowEditMode(false)
		}
		else {
			setNotify(false);
		}
	};

	const handleResetForm = () => {
		setInitialValues({ ...initialvalues, name: '', username: '', email: '', phone: '', website: '' })
	}

	const handleSubmit = (event) => {
		event.preventDefault();
		if (initialvalues.name === '') {
			alert("Please Enter Name")
		}
		else if (initialvalues.username === '') {
			alert("Please Enter UserName")
		}
		else if (initialvalues.email === '') {
			alert("Please Enter Email ID")
		}
		else if (initialvalues.phone === '') {
			alert("Please Enter Phone Number")
		}
		else {
			alert("Please Enter Website")
		}

	}


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
								className='createUserCls'
								startIcon={<AddCircleOutlineIcon />}
								onClick={() => setShowAddMode(true)
								}
							>
								Create User
							</Button>
						</div>
						<div className="p-4">
							<div className="m-auto w-full overflow-y-auto rounded-lg border bg-white p-4">
								<div className="my-3 grid cursor-pointer grid-cols-2 items-center justify-between p-2 sm:grid-cols-3 md:grid-cols-4 tabelHeaderCls">
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
														onClick={() => setShowEditMode(true)}
													>
														Edit
													</Button>
													<Button
														variant="contained"
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
								{showAddMode && (<CreateUser open={showAddMode} handleClose={handleClose} initialvalues={initialvalues} setInitialValues={setInitialValues} handleClear={handleResetForm} handleSubmit={handleSubmit} />)}
								{showEditMode && (<EditUser open={showEditMode} handleClose={handleClose} initialvalues={initialvalues} setInitialValues={setInitialValues} handleSubmit={handleSubmit} />)}
								{notify && (<ConfirmationDialog open={notify} handleClose={handleClose} />)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default Users;
