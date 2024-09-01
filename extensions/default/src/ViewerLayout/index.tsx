import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { ErrorBoundary, LoadingIndicatorProgress, InvestigationalUseDialog } from '@ohif/ui';
import { ServicesManager, HangingProtocolService, CommandsManager } from '@ohif/core';
import { useAppConfig } from '@state';
import ViewerHeader from './ViewerHeader';
import SidePanelWithServices from '../Components/SidePanelWithServices';
import Button from '@mui/material/Button';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';
import CloseIcon from '@mui/icons-material/Close';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';


function ViewerLayout({
  // From Extension Module Params
  extensionManager,
  servicesManager,
  hotkeysManager,
  commandsManager,
  // From Modes
  viewports,
  ViewportGridComp,
  leftPanelClosed = false,
  rightPanelClosed = false,
}): React.FunctionComponent {
  const [appConfig] = useAppConfig();
  let windowWidth = window.innerWidth;
  let isMobile = false;
  if (windowWidth < 768) {
    isMobile = true;
  }
  console.log("isMobile ", isMobile);
  const { panelService, hangingProtocolService } = servicesManager.services;
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(appConfig.showLoadingIndicator);

  const hasPanels = useCallback(
    (side): boolean => !!panelService.getPanels(side).length,
    [panelService]
  );
  const iframeBaseUrl = window.location.origin;

  const [hasRightPanels, setHasRightPanels] = useState(hasPanels('right'));
  const [hasLeftPanels, setHasLeftPanels] = useState(hasPanels('left'));
  const [leftPanelClosedState, setLeftPanelClosed] = useState(leftPanelClosed);
  const [rightPanelClosedState, setRightPanelClosed] = useState(rightPanelClosed);

  const [iframeImageflag, setIframeImageflag] = useState<string>('disableIframeFlag');
  const [iframeWindowflag, setIframeWindowflag] = useState<string>('iframeDisable');
  const [iframeBlockFlag, setIframeBlockFlag] = useState(true);
  //const [stuID, setStuID] = useState("");
  const [stuID, setStuID] = useState("");
  const [defaultLoad, setDefaultLoad] = useState(true);
  const [loadStudentID, setloadStudentID] = useState("");
  const [modality, setModality] = useState("");
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const [isActive, setIsActive] = useState(false);

  const [drEnableFlag, setDrEnableFlag] = useState(false);
  const [drCloseFlag, setDrCloseFlag] = useState(false);


  const [iflf, setIflf] = useState(false);



  /**
   * Set body classes (tailwindcss) that don't allow vertical
   * or horizontal overflow (no scrolling). Also guarantee window
   * is sized to our viewport.
   */
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('active_dark'));

    if (items) {
      setIsActive(items);
    }
  }, []);

  function handleChangeSwitch() {
    localStorage.setItem('active_dark', JSON.stringify(!isActive));
    setIsActive(!isActive);
  }

  const getComponent = id => {
    const entry = extensionManager.getModuleEntry(id);

    if (!entry || !entry.component) {
      throw new Error(
        `${id} is not valid for an extension module or no component found from extension ${id}. Please verify your configuration or ensure that the extension is properly registered. It's also possible that your mode is utilizing a module from an extension that hasn't been included in its dependencies (add the extension to the "extensionDependencies" array in your mode's index.js file). Check the reference string to the extension in your Mode configuration`
      );
    }

    return { entry, content: entry.component };
  };

  useEffect(() => {
    const { unsubscribe } = hangingProtocolService.subscribe(
      HangingProtocolService.EVENTS.PROTOCOL_CHANGED,

      // Todo: right now to set the loading indicator to false, we need to wait for the
      // hangingProtocolService to finish applying the viewport matching to each viewport,
      // however, this might not be the only approach to set the loading indicator to false. we need to explore this further.
      () => {
        setShowLoadingIndicator(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [hangingProtocolService]);

  const getViewportComponentData = viewportComponent => {
    const { entry } = getComponent(viewportComponent.namespace);

    return {
      component: entry.component,
      displaySetsToDisplay: viewportComponent.displaySetsToDisplay,
    };
  };

  useEffect(() => {
    const { unsubscribe } = panelService.subscribe(
      panelService.EVENTS.PANELS_CHANGED,
      ({ options }) => {
        setHasLeftPanels(hasPanels('left'));
        setHasRightPanels(hasPanels('right'));
        if (options?.leftPanelClosed !== undefined) {
          setLeftPanelClosed(options.leftPanelClosed);
        }
        if (options?.rightPanelClosed !== undefined) {
          setRightPanelClosed(options.rightPanelClosed);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [panelService, hasPanels]);

  const viewportComponents = viewports.map(getViewportComponentData);

  const openDraftReport = () => {
    localStorage.setItem('fiftyPerFlag', 'true');
    handleViewerImage();
    setTimeout(() => {
      if (iflf === true) {
        setDefaultLoad(false);
      }
    }, 2000);

  };

  const handleViewerImage = () => {
    //event.preventDefault();

    setDrEnableFlag(true);
    setDrCloseFlag(false);

    let s_id = localStorage.getItem('sid')
    let md_Flag = localStorage.getItem('mdFlag')

    setDefaultLoad(true)
    setloadStudentID(stuID)
    setIframeImageflag("enableIframeFlag");
    setIframeWindowflag('iframeEnable');
    setIframeBlockFlag(false);
    handleClose();

    setStuID(s_id);
    setModality(md_Flag);

  }

  const handleClose = () => {
    setAnchorEl(null);
  };

  const closeImageViewer = (event) => {
    event.preventDefault();

    setDrEnableFlag(false);
    setDrCloseFlag(true);

    setIframeImageflag("disableIframeFlag");
    setIframeWindowflag('iframeDisable');
    setIframeBlockFlag(true);
    setDefaultLoad(false);
  }

  const handleIframeInfo = () => {
    setTimeout(() => {
      if (document.querySelector("iframe").contentWindow.document.getElementsByClassName('mobile-logo') && document.querySelector("iframe").contentWindow.document.getElementsByClassName('mobile-logo').length > 0) {
        document.querySelector("iframe").contentWindow.document.getElementsByClassName('mobile-logo')[0].style.display = "none";
        let elementCls = document.getElementById("imageViewerId").contentWindow.document.getElementsByClassName('bg-black')[0];

        document.querySelector("iframe").contentWindow.document.getElementsByClassName('image-viewer')[0].style.display = "none";

        if (elementCls && isActive) {
          elementCls.classList.remove('bg-black');
          elementCls.classList.add('bg-black-on');
        }

      }
      setIflf(true);
    }, 3000);
    setDefaultLoad(false);
  }

  return (
    <div>
      <div style={{ display: 'flex' }}>
        <ViewerHeader
          hotkeysManager={hotkeysManager}
          extensionManager={extensionManager}
          servicesManager={servicesManager}
          appConfig={appConfig}
        />
        <div>
          <Button disabled={drEnableFlag} style={{ marginTop: '26px', marginLeft: '26px' }} onClick={openDraftReport}>Draft Report</Button>
        </div>
      </div>

      <div style={{ display: 'flex' }}>

        <div
          className={
            isActive
              ? `relative flex w-full flex-row flex-nowrap items-stretch overflow-hidden bg-black ${iframeImageflag} `
              : `relative flex w-full flex-row flex-nowrap items-stretch overflow-hidden bg-black ${iframeImageflag} `
          }

          //className="relative flex w-full flex-row flex-nowrap items-stretch overflow-hidden bg-black"
          style={{ height: 'calc(100vh - 52px' }}
        >
          <React.Fragment>
            {showLoadingIndicator && <LoadingIndicatorProgress className="h-full w-full bg-black" />}
            {/* LEFT SIDEPANELS */}
            {hasLeftPanels ? (
              <ErrorBoundary context="Left Panel">
                <SidePanelWithServices
                  side="left"
                  activeTabIndex={(isMobile ? rightPanelClosedState : leftPanelClosedState) ? null : 0}
                  servicesManager={servicesManager}
                />
              </ErrorBoundary>
            ) : null}
            {/* TOOLBAR + GRID */}
            <div className="flex h-full flex-1 flex-col">
              <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden bg-black">
                <ErrorBoundary context="Grid">
                  <ViewportGridComp
                    servicesManager={servicesManager}
                    viewportComponents={viewportComponents}
                    commandsManager={commandsManager}
                  />
                </ErrorBoundary>
              </div>

            </div>
            {hasRightPanels ? (
              <ErrorBoundary context="Right Panel">
                <SidePanelWithServices
                  side="right"
                  activeTabIndex={rightPanelClosedState ? null : 0}
                  servicesManager={servicesManager}
                />
              </ErrorBoundary>
            ) : null}

          </React.Fragment>
        </div>
        <div
          className={`${iframeWindowflag}${' imageViewerId'}`}
        >

          <CloseIcon disabled={drCloseFlag} style={isActive ? { color: "#ffffff", cursor: 'pointer' } : { color: "green", cursor: 'pointer' }}
            onClick={closeImageViewer} />

          {defaultLoad && (
            <Box sx={{ display: 'flex' }} width="100%" height="92%" >
              <CircularProgress style={isActive ? { color: "#ffffff", margin: 'auto' } : { color: "green", margin: 'auto' }} />
            </Box>
          )
          }


          <iframe id="imageViewerId" onLoad={handleIframeInfo} name="imageViewerId"
            //src={`${iframeBaseUrl}/generate-report/${loadStudentID}/${modality}`}
            src={`${iframeBaseUrl}/generate-report/${stuID}/${modality}`}
            //src={`${iframeBaseUrl}/viewer?StudyInstanceUIDs=${loadStudentID}`}
            width="100%"
            style={defaultLoad ? { height: "0px" } : { height: "92%" }}
          ></iframe>



        </div>
      </div>

      <InvestigationalUseDialog dialogConfiguration={appConfig?.investigationalUseDialog} />

    </div >
  );
}

ViewerLayout.propTypes = {
  // From extension module params
  extensionManager: PropTypes.shape({
    getModuleEntry: PropTypes.func.isRequired,
  }).isRequired,
  commandsManager: PropTypes.instanceOf(CommandsManager),
  servicesManager: PropTypes.instanceOf(ServicesManager),
  // From modes
  leftPanels: PropTypes.array,
  rightPanels: PropTypes.array,
  leftPanelClosed: PropTypes.bool.isRequired,
  rightPanelClosed: PropTypes.bool.isRequired,
  /** Responsible for rendering our grid of viewports; provided by consuming application */
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  viewports: PropTypes.array,
};

export default ViewerLayout;
