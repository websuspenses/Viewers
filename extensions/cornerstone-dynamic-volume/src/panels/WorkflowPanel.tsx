import React, { useMemo } from 'react';

function WorkflowPanel({ servicesManager, extensionManager }) {
  const ProgressDropdownWithNewService = useMemo(() => {
    const defaultComponents = extensionManager.getModuleEntry(
      '@ohif/extension-default.customizationModule.default'
    ).value;

    return defaultComponents.find(
      component => component.id === 'progressDropdownWithNewServiceComponent'
    ).component;
  }, [extensionManager]);

  return (
    <div
      data-cy={'workflow-panel'}
      className="bg-secondary-dark mb-1 px-3 py-4"
    >
      <div className="mb-1">Workflow</div>
      <div>
        <ProgressDropdownWithNewService servicesManager={servicesManager} />
      </div>
    </div>
  );
}

export default WorkflowPanel;
