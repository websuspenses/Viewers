import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend,
} from 'chart.js';
import RecentOrders from '../RecentOrders';

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend
);

const BarChart = (props) => {
	const [chartData, setChartData] = useState({
		datasets: [],
	});
	const [chartOptions, setChartOptions] = useState({});
	const {isActive} = props;

	useEffect(() => {
		setChartData({
			labels: ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'],
			datasets: [
				{
					label: 'Sales $',
					data: [18127, 22201, 19490, 17938, 24182, 17842, 22475],
					borderColor: '#0B7C00',
					backgroundColor: '#0B7C69',
				},
			]
		})
		setChartOptions({
			plugins: {
				legend: {
					position: 'top',
				},
				title: {
					display: true,
					text: 'Daily Revenue'
				}
			},
			maintainAspectRatio: false,
			responsive: true
		})
	}, [])

	return (
		<>
			{/* <div className='w-full md:col-span-2 relative lg:h-[70vh] h-[50vh] m-auto p-4 border rounded-lg bg-white'>
        <Bar data={chartData} options={chartOptions} />
      </div> */}
            <div style={{display:'flex'}}>
			<div className={isActive ? "barchartAlignCls_darkMode" : "barchartAlignCls"}>
				<Bar data={chartData} options={chartOptions} />
			</div>
			<div className={isActive ? "barchartAlignCls_darkMode" : "barchartAlignCls"} style={{ width: '40%' }}>
				<RecentOrders />
			</div>
			</div>
		</>
	);
};

export default BarChart;
