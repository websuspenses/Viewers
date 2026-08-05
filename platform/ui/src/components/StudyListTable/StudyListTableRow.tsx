import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import getGridWidthClass from '../../utils/getGridWidthClass';

import Icon from '../Icon';

const StudyListTableRow = props => {
  const { tableData, isActive } = props;
  const { row, expandedContent, onClickRow, isExpanded } = tableData;

  const dynamicWidth = {
    maxWidth: 'max-content',
  };


  const defaultWidth = {
    maxWidth: 0,
  };
  return (
    <>
      <tr className="select-none">
        <td
          className={
            isActive
              ? classnames('border-0 p-0', {
                'border-secondary-light bg-primary-dark-on border-b': isExpanded,
              })
              : classnames('border-0 p-0', {
                'border-secondary-light bg-primary-dark border-b': isExpanded,
              })
          }
        >
          <div
            className={classnames(
              'w-full transition duration-300',
              {
                'border-primary-light hover:border-secondary-light mb-2 overflow-hidden rounded border':
                  isExpanded,
              },
              {
                'border-transparent': !isExpanded,
              }
            )}
          >
            <table className={classnames('w-full p-4')}>
              <tbody>
                <tr
                  className={
                    isActive
                      ? classnames(
                        'truncate-dark bg-secondary-main-darkMode hover:bg-white/5 cursor-pointer transition-colors duration-150',
                        {
                          'bg-primary-dark-on': !isExpanded,
                        },
                        { 'bg-secondary-dark-on': isExpanded }
                      )
                      : classnames(
                        // Intentionally not `hover:bg-secondary-main`: that exact Tailwind
                        // class name is hijacked by legacy global rules in styles.css
                        // (`.hover\:bg-secondary-main:hover`) into an opaque teal fill that
                        // swallows this row's own teal/dark text and icons on hover.
                        'hover:bg-black/[0.04] cursor-pointer transition-colors duration-150',
                        {
                          'bg-primary-dark': !isExpanded,
                        },
                        { 'bg-secondary-dark': isExpanded }
                      )
                  }
                //onClick={onClickRow}
                >
                  {row.map((cell, index) => {
                    const { content, title, gridCol, key } = cell;
                    const isNumericColumn = key === 'instances';

                    return (
                      <td data-id={title}
                        key={index}
                        className={
                          isActive
                            ? classnames(
                              'px-3 py-3.5 align-middle text-sm leading-5',
                              { 'border-secondary-light-darkMode border-b': !isExpanded },
                              getGridWidthClass(gridCol) + (
                                title === ('In-Progress' || 'Referrel-Sent' || 'Report-Generated ' || 'Emergency') ? ' ' + title : '') || ''
                            )
                            : title === ('In-Progress' || 'Referrel-Sent' || 'Report-Generated ' || 'Emergency') ? classnames(
                              ' ' + title,
                            )
                              : classnames(
                                'truncate px-3 py-3.5 align-middle text-sm leading-5',
                                { 'border-secondary-light border-b': !isExpanded },
                                getGridWidthClass(gridCol) || ''
                              )
                        }
                        // style={{
                        //   maxWidth: 0,
                        // }}
                        style={
                          title === 'In-Progress'
                            ? dynamicWidth
                            : title === 'Refer'
                              ? dynamicWidth
                              : title === 'Generate Reports'
                                ? dynamicWidth
                                : title === 'Save to Cloud'
                                  ? dynamicWidth
                                  : defaultWidth
                        }
                        title={title}
                      >
                        <div
                          className={classnames('flex items-center', {
                            'justify-end tabular-nums': isNumericColumn,
                          })}
                        >
                          {index === 0 && (
                            <div>
                              {/* <Icon
                                name={isExpanded ? 'chevron-down' : 'chevron-right'}
                                className="mr-4 inline-flex emergency-status"
                              /> */}
                            </div>
                          )}
                          <div
                            className={classnames({ 'overflow-hidden': true }, { truncate: true })}
                          >
                            {content}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && (
                  <tr
                    className={
                      isActive
                        ? 'bg-black-on max-h-0 w-full select-text overflow-hidden'
                        : 'max-h-0 w-full select-text overflow-hidden bg-black'
                    }
                  >
                    <td colSpan={row.length}>{expandedContent}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </>
  );
};

StudyListTableRow.propTypes = {
  tableData: PropTypes.shape({
    /** A table row represented by an array of "cell" objects */
    row: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        /** Optional content to render in row's cell */
        content: PropTypes.node,
        /** Title attribute to use for provided content */
        title: PropTypes.string,
        gridCol: PropTypes.number.isRequired,
      })
    ).isRequired,
    expandedContent: PropTypes.node.isRequired,
    onClickRow: PropTypes.func.isRequired,
    isExpanded: PropTypes.bool.isRequired,
  }),
};

export default StudyListTableRow;
