import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');


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
    if (verifyEmailValidation(email) === 'isEmailEmpty') {
      alert('Please Enter Email ID');
    }
    else if (verifyEmailValidation(email) === true) {
      alert('Please Enter Valid Email ID');
    }
    else if (password === '') {
      alert('Please Enter Password');
    }
    else if (password.length !== 8) {
      alert('Password Length Should be 8 Characters Only.');
    }
    else {
      navigate('/workList');
    }
  }

  return (
    <div>
      <div className='containeralignCls right-panel-active'  id='container'>
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
                <img width='250' height='140'  src='./ohif-logo.svg' />
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
