
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import FullscreenExitOutlinedIcon from '@mui/icons-material/FullscreenExitOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import ListOutlinedIcon from '@mui/icons-material/ListOutlined';
// import { DarkModeContext } from '../../context/darkModeContext';
// import { useContext } from 'react';
import React from 'react';
import '../../AdminPanel/style.css';

const Navbar = (props) => {
  // const { dispatch } = useContext(DarkModeContext);
const {isActive, handleChange } = props;

  return (
    <div className={isActive ? 'navbar_darkMode' : 'navbar'}>
      <div className= 'wrapper'>
        <div className='search'>
          <input type='text' placeholder='Search...' />
          <SearchOutlinedIcon />
        </div>
        <div className='items'>
          <div className='item'>
            <LanguageOutlinedIcon className='iconCls' />
            English
          </div>
          <div className='item'>
            <DarkModeOutlinedIcon
              className='iconCls' style={{cursor:'pointer'}}
			  onClick={handleChange}
            />
          </div>
          <div className='item'>
            <FullscreenExitOutlinedIcon className='iconCls' />
          </div>
          <div className='item'>
            <NotificationsNoneOutlinedIcon className='iconCls' />
            <div className='counter'>1</div>
          </div>
          <div className='item'>
            <ChatBubbleOutlineOutlinedIcon className='iconCls' />
            <div className='counter'>2</div>
          </div>
          <div className='item'>
            <ListOutlinedIcon className='iconCls' />
          </div>
          <div className='item'>
            <img
              src='https://images.pexels.com/photos/941693/pexels-photo-941693.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=500'
              alt=""
              className="avatar"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;


