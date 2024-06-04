import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@ohif/ui';

// Route Components
import DataSourceWrapper from './DataSourceWrapper';
import WorkList from './WorkList';
import Local from './Local';
import Debug from './Debug';
import NotFound from './NotFound';
import buildModeRoutes from './buildModeRoutes';
import PrivateRoute from './PrivateRoute';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Login from './Login';
import DashBoard from '../components/AdminPanel/DashBoard';
import Users from '../components/AdminPanel/Users';
import ReportTemplatesList from '../components/ReportTemplates/ReportTemplatesList';
import CreateTemplate from '../components/ReportTemplates/CreateTemplate';
import GenerateReport from '../components/ReportTemplates/GenerateReport';
import DoctorReferralsList from '../components/DoctorReferrals/DoctorReferralsList';
import CreateDoctorReferral from '../components/DoctorReferrals/CreateDoctorReferral';
import GenerateReferral from '../components/DoctorReferrals/GenerateReferral';

const NotFoundServer = ({
  message = 'Unable to query for studies at this time. Check your data source configuration or network connection',
}) => {
  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div>
        <h4>{message}</h4>
      </div>
    </div>
  );
};

NotFoundServer.propTypes = {
  message: PropTypes.string,
};

const NotFoundStudy = () => {
  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div>
        <h4>
          One or more of the requested studies are not available at this time. Return to the{' '}
          <Link
            className="text-primary-light"
            to={'/'}
          >
            study list
          </Link>{' '}
          to select a different study to view.
        </h4>
      </div>
    </div>
  );
};

NotFoundStudy.propTypes = {
  message: PropTypes.string,
};

// TODO: Include "routes" debug route if dev build
const bakedInRoutes = [
  {
    path: '/notfoundserver',
    children: NotFoundServer,
  },
  {
    path: '/notfoundstudy',
    children: NotFoundStudy,
  },
  {
    path: '/debug',
    children: Debug,
  },
  {
    path: '/local',
    children: Local.bind(null, { modePath: '' }), // navigate to the worklist
  },
  {
    path: '/localbasic',
    children: Local.bind(null, { modePath: 'viewer/dicomlocal' }),
  },
  {
    path: '/',
    children: Login,
  },
  {
    path: '/workList',
    children: WorkList,
  },
  {
    path: '/dashboard',
    children: DashBoard,
  },
  {
    path: '/users',
    children: Users,
  },
  {
    path: '/report-templates',
    children: ReportTemplatesList,
  },
  {
    path: '/create-template',
    children: CreateTemplate,
  },
  {
    path: '/create-template/:modality/:template_id',
    children: CreateTemplate,
  },
  {
    path: '/generate-report/:mrn/:modality',
    children: GenerateReport,
  },
  {
    path: '/doctor-referrals',
    children: DoctorReferralsList,
  },
];

// NOT FOUND (404)
const notFoundRoute = { component: NotFound };

const createRoutes = ({
  modes,
  dataSources,
  extensionManager,
  servicesManager,
  commandsManager,
  hotkeysManager,
  routerBasename,
  showStudyList,
}) => {
  const routes =
    buildModeRoutes({
      modes,
      dataSources,
      extensionManager,
      servicesManager,
      commandsManager,
      hotkeysManager,
    }) || [];

  const { customizationService } = servicesManager.services;

  const WorkListRoute = {
    path: '/workList',
    children: DataSourceWrapper,
    private: true,
    props: { children: WorkList, servicesManager, extensionManager },
  };

  const LoginRoute = {
    path: '/',
    children: DataSourceWrapper,
    private: true,
    props: { children: Login, servicesManager, extensionManager },
  };

  const customRoutes = customizationService.getGlobalCustomization('customRoutes');
  const allRoutes = [
    ...routes,
    ...(showStudyList ? [WorkListRoute] : []),
    ...(customRoutes?.routes || [LoginRoute]),
    ...bakedInRoutes,
    customRoutes?.notFoundRoute || notFoundRoute,
  ];

  function RouteWithErrorBoundary({ route, ...rest }) {
    // eslint-disable-next-line react/jsx-props-no-spreading
    return (
      <ErrorBoundary
        context={`Route ${route.path}`}
        fallbackRoute="/"
      >
        <route.children
          {...rest}
          {...route.props}
          route={route}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          hotkeysManager={hotkeysManager}
        />
      </ErrorBoundary>
    );
  }

  const { userAuthenticationService } = servicesManager.services;

  // Note: PrivateRoutes in react-router-dom 6.x should be defined within
  // a Route element
  return (
    <Routes>
      {allRoutes.map((route, i) => {
        return route.private === true ? (
          <Route
            key={i}
            exact
            path={route.path}
            element={
              <PrivateRoute handleUnauthenticated={userAuthenticationService.handleUnauthenticated}>
                <RouteWithErrorBoundary route={route} />
              </PrivateRoute>
            }
          ></Route>
        ) : (
          <Route
            key={i}
            path={route.path}
            element={<RouteWithErrorBoundary route={route} />}
          />
        );
      })}
    </Routes>
  );
};

export default createRoutes;