import React from 'react';
import '../../AdminPanel/style.css';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import SettingsSystemDaydreamOutlinedIcon from '@mui/icons-material/SettingsSystemDaydreamOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import { Link } from 'react-router-dom';
import WorkListIcon from '@mui/icons-material/WorkOutlineOutlined';

const Sidebar = props => {
  const { isActive } = props;

  return (
    <div className={isActive ? 'sidebar_darkMode' : 'sidebar'}>
      <div className="top">
        <Link
          to="/"
          style={{ textDecoration: 'none' }}
        >
          <div className="ml-4">
            <img
              width="250"
              height="140"
              src="./ohif-whitebg-logo.svg"
            />
          </div>
        </Link>
      </div>
      <hr />
      <div className="center">
        <ul>
          <p className="title">MAIN</p>
          <Link
            to="/dashboard"
            style={{ textDecoration: 'none' }}
          >
            <li>
              <DashboardIcon className="iconCls" />
              <span>Dashboard</span>
            </li>
          </Link>
          <p className="title">LISTS</p>
          <Link
            to="/workList"
            style={{ textDecoration: 'none' }}
          >
            <li>
              <WorkListIcon className="iconCls" />
              <span>WorkList</span>
            </li>
          </Link>
          <Link
            to="/users"
            style={{ textDecoration: 'none' }}
          >
            <li>
              <PersonOutlineIcon className="iconCls" />
              <span>Users</span>
            </li>
          </Link>
          <li>
            <CreditCardIcon className="iconCls" />
            <span>Orders</span>
          </li>
          <li>
            <LocalShippingIcon className="iconCls" />
            <span>Delivery</span>
          </li>
          <p className="title">USEFUL</p>
          <li>
            <InsertChartIcon className="iconCls" />
            <span>Stats</span>
          </li>
          <li>
            <NotificationsNoneIcon className="iconCls" />
            <span>Notifications</span>
          </li>
          <p className="title">SERVICE</p>
          <li>
            <SettingsSystemDaydreamOutlinedIcon className="iconCls" />
            <span>System Health</span>
          </li>
          <li>
            <PsychologyOutlinedIcon className="iconCls" />
            <span>Logs</span>
          </li>
          <li>
            <SettingsApplicationsIcon className="iconCls" />
            <span>Settings</span>
          </li>
          <p className="title">USER</p>
		  <Link
            to="/"
            style={{ textDecoration: 'none' }}
          >
			<li>
            <AccountCircleOutlinedIcon className="iconCls" />
            <span>Profile</span>
          </li>
          </Link>
        
		  <Link
            to="/"
            style={{ textDecoration: 'none' }}
          >
			<li>
            <ExitToAppIcon className="iconCls" />
            <span>Logout</span>
          </li>
          </Link>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
