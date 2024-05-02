import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import ErrorBoundary from '../../components/AdminPanel/ErrorBoundary/ErrorBoundary';
import ErrorBoundaryMessage from '../../components/AdminPanel/ErrorBoundary/ErrorBoundaryMessage';
import Alert from '@mui/material/Alert';
import CheckIcon from '@mui/icons-material/Check';


export default function Login() {

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [errorMessage, setErrorMessage] = useState('');


	const navigate = useNavigate();

	//   // Set body style
	useEffect(() => {
		document.body.classList.add('bodyContainer_Cls');
		return () => {
			document.body.classList.remove('bodyContainer_Cls');
		};
	}, []);


	function verifyEmailValidation(value) {
		const emailVal = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g;
		if (value === '') {
			return 'isEmailEmpty';
		}
		else if (!emailVal.test(value)) {
			return true;
		}
		return;
	}

	function handleSubmit(event) {
		event.preventDefault();
		setTimeout(() => {
			setErrorMessage('')
		}, 3000)

		if (verifyEmailValidation(email) === 'isEmailEmpty') {
			setErrorMessage('Please Enter Email ID')
			// alert('Please Enter Email ID');
		}
		else if (verifyEmailValidation(email) === true) {
			setErrorMessage('Please Enter Valid Email ID')
			// alert('Please Enter Valid Email ID');
		}
		else if (password === '') {
			setErrorMessage('Please Enter Password')
			// alert('Please Enter Password');
		}
		else if (password.length !== 8) {
			setErrorMessage('Password Length Should be 8 Characters Only.')
			// alert('Password Length Should be 8 Characters Only.');
		}
		else {
			navigate('/workList');
		}
	}




	return (
		<div>
			{errorMessage &&
				// 	<ErrorBoundary>
				// 	<ErrorBoundaryMessage errorMessage={errorMessage} />
				//   </ErrorBoundary>

				<Alert severity="error">{errorMessage}</Alert>
			}
			<div className='containeralignCls right-panel-active' id='container'>
				<div className='form-container sign-in-container'>
					<form className='formAlignCls'>
						<h1 className='headerAlignCls'>USER LOGIN</h1>
						<input
							className='inputFieldAlignCls'
							type='email'
							placeholder='Email'
							name='email'
							autoComplete='off'
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<input
							className='inputFieldAlignCls'
							type='password'
							name='password'
							placeholder='Password'
							autoComplete='off'
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/><br />
						<div><button type='button' className='buttonAlignCls' value='submit' onClick={handleSubmit}>Sign In</button></div>
					</form>
				</div>

				<div className='overlay-container'>
					<div className='overlay'>
						<div className='overlay-panel overlay-left'>
							<div className='ml-4'>
								<img width='250' height='140' src='./ohif-logo.svg' />
							</div>&nbsp;&nbsp;
							<h1 className='headerCls'>Welcome Back!</h1>
							<p className='containAlignCls'>
								To keep connected with us please login with your personal info
							</p>
						</div>
						<div className='overlay-panel overlay-right'>
							<h1>Hello, Friend!</h1>
							<p>Enter your personal details and start journey with us</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
