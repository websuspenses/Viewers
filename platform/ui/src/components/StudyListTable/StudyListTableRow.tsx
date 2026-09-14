import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import getGridWidthClass from '../../utils/getGridWidthClass';

/**
 * Columns holding widgets rather than text. They keep their grid width — so
 * they stay aligned with the filter header — but are not truncated, which would
 * clip a status pill or the trailing action button.
 *
 * Every other column gets `max-width: 0`, the standard trick that lets a cell
 * in a fixed-width table actually honour `text-overflow: ellipsis` instead of
 * stretching the column to fit its longest value.
 */
const WIDGET_COLUMNS = new Set(['status', 'actions']);

/** Per-column typography. The patient is the row's subject, so it carries the
 *  weight; supporting values stay in the secondary tone so the eye lands on the
 *  name and the status pill first. */
const CELL_TONE = {
  patientName: 'font-semibold',
  instances: 'tabular-nums',
};

const StudyListTableRow = props => {
  const { tableData, isActive } = props;
  const { row, expandedContent, onClickRow, isExpanded } = tableData;

  return (
    <tr className="select-none">
      <td className="border-0 p-0">
        <div
          className={classnames('w-full transition duration-200', {
            'my-1.5 overflow-hidden rounded-lg ring-1': isExpanded,
            'ring-accent/40': isExpanded && !isActive,
            'ring-accent/30': isExpanded && isActive,
          })}
        >
          <table className="w-full border-separate border-spacing-0">
            <tbody>
              <tr
                className={classnames(
                  'transition-colors duration-150',
                  // Neither `truncate-dark` nor `bg-secondary-main-darkMode` is
                  // used here any more: styles.css paints the first with a flat
                  // `#373737 !important` fill and washed-out text, and turns the
                  // second's hover into a solid teal block. Both overrode the
                  // surface tokens and were the reason dark mode looked nothing
                  // like the rest of the product.
                  isActive
                    ? classnames('hover:bg-white/[0.05]', {
                        'bg-surface-raisedDark': !isExpanded,
                        'bg-surface-overlayDark': isExpanded,
                      })
                    : // Intentionally not `hover:bg-secondary-main`: that exact Tailwind
                      // class name is hijacked by legacy global rules in styles.css
                      // (`.hover\:bg-secondary-main:hover`) into an opaque teal fill that
                      // swallows this row's own teal/dark text and icons on hover.
                      classnames('hover:bg-accent-light/60', {
                        'bg-surface-raised': !isExpanded,
                        'bg-accent-light/40': isExpanded,
                      })
                )}
                // Row-level click expansion stays disabled here, as before: the
                // row's actions are the interaction, and a stray click on a cell
                // should not toggle the detail panel.
              >
                {row.map((cell, index) => {
                  const { content, title, gridCol, key } = cell;
                  const isNumericColumn = key === 'instances';

                  return (
                    <td
                      data-id={title}
                      key={index}
                      className={classnames(
                        'px-4 py-3 align-middle text-[13px] leading-snug',
                        // A single hairline under every cell reads as one
                        // continuous row rule; the expanded row drops it so the
                        // detail panel joins the row it belongs to.
                        !isExpanded && 'border-b',
                        !isExpanded &&
                          (isActive ? 'border-border-subtleDark/70' : 'border-border-subtle'),
                        isActive ? 'text-content-secondaryDark' : 'text-content-secondary',
                        CELL_TONE[key] || '',
                        !WIDGET_COLUMNS.has(key) && 'truncate',
                        getGridWidthClass(gridCol) || ''
                      )}
                      style={WIDGET_COLUMNS.has(key) ? undefined : { maxWidth: 0 }}
                      title={title}
                    >
                      <div
                        className={classnames('flex items-center', {
                          // Counts read as a column of digits, so they align on
                          // their right edge under a right-aligned header.
                          'justify-end tabular-nums': isNumericColumn,
                        })}
                      >
                        <div
                          className={classnames(
                            'min-w-0',
                            !WIDGET_COLUMNS.has(key) && 'truncate'
                          )}
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
                  className={classnames(
                    'max-h-0 w-full select-text overflow-hidden',
                    isActive ? 'bg-black-on' : 'bg-black'
                  )}
                >
                  <td colSpan={row.length}>{expandedContent}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
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
