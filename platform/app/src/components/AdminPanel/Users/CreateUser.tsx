import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { styled } from '@mui/material/styles';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
	'& .MuiDialogContent-root': {
		padding: theme.spacing(2),
	},
	'& .MuiDialogActions-root': {
		padding: theme.spacing(1),
	},
	'& .MuiPaper-root': {
		width:'550px !important',
	  },
}));

function CreateUser(props) {
	const { open, handleClose, initialvalues, setInitialValues, handleClear,handleSubmit } = props;

	useEffect(() => {
	}, []);

	// const addNewUser = async () => {
	// 	try {
	// 		const response = await axios.post('http://localhost:4000/users', userInfo);
	// 		if (response) {
	// 			props.setUserAdded();
	// 		}
	// 	}
	// 	catch (e) {
	// 		console.log(e)
	// 	}
	// }

	return (
		<BootstrapDialog
			aria-labelledby="customized-dialog-title"
			open={open}
		>
			<DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
				Add User
			</DialogTitle>
			<IconButton
				aria-label="close"
				onClick={handleClose}
				sx={{
					position: 'absolute',
					right: 8,
					top: 8,
					color: (theme) => theme.palette.grey[500],
				}}
			>
			<CloseIcon className='closeIconCls' />
			</IconButton>
			<DialogContent>
				<div className='user-view _add-view'>
					<div className='box'>
						<div className='row'>
							<div className='col-sm-12 col-md-6'>
								<p>
									<span>Full Name</span>
									<input
										type='text'
										className='form-control'
										placeholder='Enter Full Name' 
										value={initialvalues.name}
										onChange={e => setInitialValues({ ...initialvalues, name: e.target.value })}
									/>
								</p>
							</div>
							<div className='col-sm-12 col-md-6'>
								<p>
									<span>Username</span>
									<input
										type='text'
										className='form-control'
										placeholder='Enter Username'
										value={initialvalues.username}
										onChange={e => setInitialValues({ ...initialvalues, username: e.target.value })}
									/>
								</p>
							</div>
							<div className='col-sm-12 col-md-6'>
								<p>
									<span>Email Address</span>
									<input
										type='text'
										className='form-control'
										placeholder='Enter Email Address'
										value={initialvalues.email}
										onChange={e => setInitialValues({ ...setInitialValues, email: e.target.value })}
									/>
								</p>
							</div>
							<div className='col-sm-12 col-md-6'>
								<p>
									<span>Phone Number</span>
									<input
										type='text'
										className='form-control'
										placeholder='Enter Phone Number'
										value={initialvalues.phone}
										onChange={e => setInitialValues({ ...initialvalues, phone: e.target.value })}
									/>
								</p>
							</div>
							<div className='col-sm-12 col-md-6'>
								<p>
									<span>Website</span>
									<input
										type='text'
										className='form-control'
										placeholder='Enter Website'
										value={initialvalues.website}
										onChange={e => setInitialValues({ ...initialvalues, website: e.target.value })}
									/>
								</p>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
			<DialogActions>
				<Stack direction="row" spacing={2}>
					<Button variant="contained" color="error" className='borderRadiusCls' onClick={handleClear}>
						Clear
					</Button>
					<Button variant="contained" color="success" className='submitBtnMuiCls borderRadiusCls' onClick={handleSubmit} >
						Submit
					</Button>
				</Stack>
			</DialogActions>
		</BootstrapDialog>
	)
}

export default CreateUser

