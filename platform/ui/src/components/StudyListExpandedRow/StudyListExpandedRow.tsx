import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Table from '../Table';
import TableHead from '../TableHead';
import TableBody from '../TableBody';
import TableRow from '../TableRow';
import TableCell from '../TableCell';

const StudyListExpandedRow = ({ seriesTableColumns, seriesTableDataSource, children, isActive }) => {
  const { t } = useTranslation('StudyList');


  return (
    <div className={isActive ? "w-full bg-expanded-dark py-4 pl-12 pr-2" : "w-full bg-black py-4 pl-12 pr-2"} >
      <div className="block">{children}</div>
      <div className="mt-4">
        <Table>
          <TableHead isActive={isActive}>
            <TableRow>
              {Object.keys(seriesTableColumns).map(columnKey => {
                return <TableCell key={columnKey} isActive={isActive}>{t(seriesTableColumns[columnKey])}</TableCell>;
              })}
            </TableRow>
          </TableHead>

          <TableBody isActive={isActive}>
            {seriesTableDataSource.map((row, i) => (
              <TableRow key={i}>
                {Object.keys(row).map(cellKey => {
                  const content = row[cellKey];
                  return (
                    <TableCell
                      key={cellKey}
                      className={isActive ? "expandTableCellCls" : "truncate"}
                    >
                      {content}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

StudyListExpandedRow.propTypes = {
  seriesTableDataSource: PropTypes.arrayOf(PropTypes.object).isRequired,
  seriesTableColumns: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
};

export default StudyListExpandedRow;
