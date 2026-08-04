import React from 'react';
import { LegacySidePanel, StudyBrowser } from '../../components';
import { DragAndDropProvider } from '../../contextProviders';

import Header from './components/Header';

const Viewer = () => {
  return (
    <DragAndDropProvider>
      <div>
        <Header />
        <div
          className="flex w-full flex-1 flex-row flex-nowrap items-stretch overflow-hidden"
          style={{ height: 'calc(100vh - 52px' }}
        >
          <LegacySidePanel
            side="left"
            activeTabIndex={0}
            tabs={[
              {
                iconName: 'group-layers',
                iconLabel: 'Studies1',
                name: 'studies',
                label: 'Studies1',
                content: () => (
                  <StudyBrowser
                    tabs={[{ name: 'primary', label: 'Studies1', studies: [] }]}
                    activeTabName="primary"
                    expandedStudyInstanceUIDs={[]}
                    activeDisplaySetInstanceUIDs={[]}
                  />
                ),
              },
            ]}
          />
          <div className="h-100 bg-primary-main flex flex-1 items-center justify-center overflow-hidden text-white">
            {/* <ViewportToolbar /> */}
            <div>CONTENT</div>
          </div>
          <LegacySidePanel
            side="right"
            tabs={[
              {
                iconName: 'list-bullets',
                iconLabel: 'Measure',
                name: 'measurements',
                label: 'Measurements',
                content: () => (
                  <div className="flex justify-center p-2 text-white">panel placeholder</div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </DragAndDropProvider>
  );
};

export default Viewer;
