import React, { useState, useEffect } from 'react';
import '../../AdminPanel/style.css';
import SideBar from '../SideBar';
import Navbar from '../Navbar';
import Widget from '../Widget';
import BarChart from '../BarChart';
import Users from '../Users';
// import Users from '../Users';

function DashBoard() {
  const [isActive, setIsActive] = useState(false);

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

  return (
    <div className="dashboard">
      <SideBar isActive={isActive} />
      <div className="dashboardContainer">
        <Navbar
          isActive={isActive}
          handleChange={handleChange}
        />
        <div className="widgets">
          <Widget type="user" />
          <Widget type="order" />
          <Widget type="earning" />
          <Widget type="balance" />
        </div>
        <BarChart isActive={isActive} />
      </div>
    </div>
  );
}

export default DashBoard;
