import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import StudyListTableRow from './StudyListTableRow';

const StudyListTable = ({ tableDataSource, querying, isActive }) => {
  return (
    <div className={isActive ? 'bg-surface-raisedDark' : 'bg-surface-raised'}>
      <div className="container relative m-auto overflow-x-auto">
        {/*
          Deliberately not `text-white`: legacy styles.css rewrites that class to
          brand teal (#0a7c6c), which turned every value in the worklist — names,
          MRNs, dates — into what looked like a link. Study data is set in the
          neutral content tones instead, leaving teal to mean "interactive".
        */}
        <table
          className={classnames(
            'w-full border-separate border-spacing-0',
            isActive ? 'text-content-primaryDark' : 'text-content-primary'
          )}
        >
          <tbody
            data-cy="study-list-results"
            data-querying={querying}
          >
            {tableDataSource.map((tableData, i) => {
              return (
                <StudyListTableRow
                  tableData={tableData}
                  key={i}
                  isActive={isActive}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

StudyListTable.propTypes = {
  tableDataSource: PropTypes.arrayOf(
    PropTypes.shape({
      row: PropTypes.array.isRequired,
      expandedContent: PropTypes.node.isRequired,
      querying: PropTypes.bool,
      onClickRow: PropTypes.func.isRequired,
      isExpanded: PropTypes.bool.isRequired,
    })
  ),
};

export default StudyListTable;
