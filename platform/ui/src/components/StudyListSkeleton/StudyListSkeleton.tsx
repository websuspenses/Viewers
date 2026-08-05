import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import getGridWidthClass from '../../utils/getGridWidthClass';

/**
 * Skeleton placeholder rows shown while the study list is loading, in place
 * of a page-blocking spinner. Column widths mirror `filtersMeta`'s `gridCol`
 * so the shimmering bars roughly line up under the real header/filter row.
 */
const StudyListSkeleton = ({ filtersMeta, rows, isActive }) => {
  return (
    <div className={isActive ? 'bg-black-on bg-primary-dark-on' : 'bg-black'}>
      <div className="container relative m-auto overflow-x-auto pb-6">
        <table className="w-full">
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr
                key={rowIndex}
                className={isActive ? 'bg-primary-dark-on' : 'bg-primary-dark'}
              >
                {filtersMeta.map(({ name, gridCol }) => (
                  <td
                    key={name}
                    className={classnames('px-3 py-3.5', getGridWidthClass(gridCol))}
                  >
                    <div
                      className={classnames(
                        'h-4 animate-pulse rounded',
                        isActive ? 'bg-white/10' : 'bg-black/10',
                        rowIndex % 2 === 0 ? 'w-3/4' : 'w-1/2'
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

StudyListSkeleton.defaultProps = {
  rows: 8,
};

StudyListSkeleton.propTypes = {
  filtersMeta: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      gridCol: PropTypes.number.isRequired,
    })
  ).isRequired,
  rows: PropTypes.number,
  isActive: PropTypes.bool,
};

export default StudyListSkeleton;
