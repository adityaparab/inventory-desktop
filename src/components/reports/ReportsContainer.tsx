import React, { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  Box,
  Button,
  FormControl,
  TextField,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import Dayjs from 'dayjs';
import { useParts } from '../../queryClient/hooks';
import { useFilterDataEntries } from '../../queryClient/hooks';
import { usePreferences } from '../../queryClient/hooks';
import type { FilterDataEntriesParams } from '../../queryClient/endpoints';
import ExcelJS from 'exceljs';

interface DataEntry {
  id: string;
  date: string;
  shift: string;
  inspectorName: string;
  part: {
    id: string;
    name: string;
  };
  numberOfParts: number;
  rejections: Array<{
    reason: {
      id: string;
      name: string;
    };
    numberOfRejections: number;
  }>;
  totalRejections: number;
  lotNumber: string;
}

interface RejectionStats {
  [key: string]: {
    count: number;
    percentage: number;
  };
}

const ReportsContainer: React.FC = () => {
  const [filters, setFilters] = useState<FilterDataEntriesParams>({});
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [dateTimeRange, setDateTimeRange] = useState<[Dayjs.Dayjs | null, Dayjs.Dayjs | null]>([null, null]);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data: parts = [] } = useParts();
  const { data: filteredData = [] } = useFilterDataEntries(filters);
  const { data: preferences = [] } = usePreferences();

  // Extract warning and danger percentages from preferences
  const warningPercentage = useMemo(() => {
    const pref = (preferences as Array<{ name: string; value: string }>).find(p => p.name === 'warningPercentage');
    return pref ? parseFloat(pref.value) : 5; // Default 5%
  }, [preferences]);

  const dangerPercentage = useMemo(() => {
    const pref = (preferences as Array<{ name: string; value: string }>).find(p => p.name === 'dangerPercentage');
    return pref ? parseFloat(pref.value) : 15; // Default 15%
  }, [preferences]);

  const displayData = hasFiltered ? filteredData : [];
  const canApplyFilters =
    selectedParts.length > 0 || dateTimeRange[0] !== null || dateTimeRange[1] !== null;

  const statistics = useMemo(() => {
    if (displayData.length === 0) {
      return {
        totalParts: 0,
        totalRejections: 0,
        cumulativeRejectionPercentage: 0,
        rejectionReasons: {} as RejectionStats,
      };
    }

    const totalParts = (displayData as DataEntry[]).reduce(
      (sum, entry) => sum + entry.numberOfParts,
      0
    );
    const totalRejections = (displayData as DataEntry[]).reduce(
      (sum, entry) => sum + entry.totalRejections,
      0
    );
    const cumulativeRejectionPercentage =
      totalParts > 0 ? (totalRejections / totalParts) * 100 : 0;

    const rejectionReasons: RejectionStats = {};
    (displayData as DataEntry[]).forEach((entry) => {
      entry.rejections.forEach((rejection) => {
        const rejectionName = rejection.reason?.name || 'Unknown';
        if (!rejectionReasons[rejectionName]) {
          rejectionReasons[rejectionName] = { count: 0, percentage: 0 };
        }
        rejectionReasons[rejectionName].count += rejection.numberOfRejections;
      });
    });

    Object.keys(rejectionReasons).forEach((reason) => {
      rejectionReasons[reason].percentage =
        totalRejections > 0
          ? (rejectionReasons[reason].count / totalRejections) * 100
          : 0;
    });

    return {
      totalParts,
      totalRejections,
      cumulativeRejectionPercentage,
      rejectionReasons,
    };
  }, [displayData]);

  const handleFilter = () => {
    const newFilters: FilterDataEntriesParams = {};
    setExportError('');

    // If "All" is selected, set a flag instead of sending part names
    if (selectedParts.includes('All')) {
      newFilters.allParts = 'true';
    } else if (selectedParts.length > 0) {
      newFilters.partName = selectedParts.join(',');
    }

    const [startDateTime, endDateTime] = dateTimeRange;

    if (startDateTime) {
      newFilters.startDate = startDateTime.toISOString();
    }

    if (endDateTime) {
      const endDateTimeAdjusted = endDateTime.clone().second(59).millisecond(999);
      newFilters.endDate = endDateTimeAdjusted.toISOString();
    }

    if (Object.keys(newFilters).length === 0) {
      setHasFiltered(false);
      setFilters({});
      return;
    }

    setFilters(newFilters);
    setHasFiltered(true);
  };

  const handleReset = () => {
    setSelectedParts([]);
    setDateTimeRange([null, null]);
    setFilters({});
    setHasFiltered(false);
    setExportError('');
  };

  const reportFileName = () => `Report-${Dayjs().format('DD-MMM-YYYY_h-mm-a')}.xlsx`;

  const exportToExcel = async () => {
    if (displayData.length === 0) {
      setExportError('No filtered data is available to export.');
      return;
    }

    setIsExporting(true);
    setExportError('');

    try {
    const workbook = new ExcelJS.Workbook();

    // Color definitions based on preferences
    const getColorForPercentage = (percentage: number) => {
      if (percentage >= dangerPercentage) return 'FFFF0000'; // Red
      if (percentage >= warningPercentage) return 'FFFFA500'; // Orange
      return 'FF00B050'; // Green
    };

    // Group data by part
    const dataByPart: { [key: string]: DataEntry[] } = {};
    (displayData as DataEntry[]).forEach((entry) => {
      const partName = entry.part?.name || 'Unknown';
      if (!dataByPart[partName]) {
        dataByPart[partName] = [];
      }
      dataByPart[partName].push(entry);
    });

    // Create a sheet for each part
    for (const [partName, entries] of Object.entries(dataByPart)) {
      const worksheet = workbook.addWorksheet(
        partName.replace(/[\[\]\\?*\/]/g, '_').substring(0, 31)
      );

      const reportData: any[] = [];

      entries.forEach((entry) => {
        if (entry.rejections.length === 0) {
          reportData.push({
            Date: Dayjs(entry.date).format('DD/MM/YYYY HH:mm'),
            Shift: entry.shift,
            'Inspector Name': entry.inspectorName,
            'Load Number': entry.lotNumber,
            'Part Name': entry.part?.name || 'N/A',
            'Number of Parts': entry.numberOfParts,
            'Type of Rejection': 'N/A',
            'Number of Rejections': 0,
            '% of Rejections': 0
          });
        } else {
          entry.rejections.forEach((rejection) => {
            const percentage = (rejection.numberOfRejections / entry.numberOfParts) * 100;
            reportData.push({
              Date: Dayjs(entry.date).format('DD/MM/YYYY HH:mm'),
              Shift: entry.shift,
              'Load Number': entry.lotNumber,
              'Inspector Name': entry.inspectorName,
              'Part Name': entry.part?.name || 'N/A',
              'Number of Parts': entry.numberOfParts,
              'Type of Rejection': rejection.reason?.name || 'N/A',
              'Number of Rejections': rejection.numberOfRejections,
              '% of Rejections': percentage
            });
          });
        }
      });

      // Add headers
      const headers = [
        'Date',
        'Shift',
        'Inspector Name',
        'Load Number',
        'Part Name',
        'Number of Parts',
        'Type of Rejection',
        'Number of Rejections',
        '% of Rejections'
      ];
      worksheet.addRow(headers);

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Add data rows with formatting
      reportData.forEach((row) => {
        const newRow = worksheet.addRow([
          row.Date,
          row.Shift,
          row['Inspector Name'],
          row['Load Number'],
          row['Part Name'],
          row['Number of Parts'],
          row['Type of Rejection'],
          row['Number of Rejections'],
          row['% of Rejections']
        ]);

        // Color the % of Rejections column (column 9)
        const percentageCell = newRow.getCell(9);
        const color = getColorForPercentage(row['% of Rejections']);
        percentageCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };
        percentageCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        percentageCell.numFmt = '0.00"%"';
        percentageCell.alignment = { horizontal: 'center' };
      });

      // Add totals row
      const totalParts = entries.reduce((sum, entry) => sum + entry.numberOfParts, 0);
      const totalRejections = entries.reduce((sum, entry) => sum + entry.totalRejections, 0);
      const cumulativeRejectionPercentage = totalParts > 0 ? (totalRejections / totalParts) * 100 : 0;

      const totalsRow = worksheet.addRow([
        'TOTAL',
        '',
        '',
        '',
        '',
        totalParts,
        '',
        totalRejections,
        cumulativeRejectionPercentage
      ]);

      // Style totals row
      totalsRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
      totalsRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Format totals cells
      const totalPartsCell = totalsRow.getCell(6);
      totalPartsCell.numFmt = '0';
      totalPartsCell.alignment = { horizontal: 'center' };

      const totalRejectionsCell = totalsRow.getCell(8);
      totalRejectionsCell.numFmt = '0';
      totalRejectionsCell.alignment = { horizontal: 'center' };

      const cumulativePercentageCell = totalsRow.getCell(9);
      const totalColor = getColorForPercentage(cumulativeRejectionPercentage);
      cumulativePercentageCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: totalColor }
      };
      cumulativePercentageCell.numFmt = '0.00"%"';
      cumulativePercentageCell.alignment = { horizontal: 'center' };

      // Set column widths
      worksheet.columns = [
        { width: 18 },
        { width: 10 },
        { width: 15 },
        { width: 12 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 }
      ];
    }

    // Save the workbook
      const filePath = await save({
        title: 'Save report',
        defaultPath: reportFileName(),
        filters: [
          {
            name: 'Excel Workbook',
            extensions: ['xlsx'],
          },
        ],
      });

      if (!filePath) {
        return;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      await invoke('save_report_file', { path: filePath, bytes });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <h2>Reports</h2>

      <Box sx={{ marginBottom: 3, padding: 2, borderRadius: 1 }}>
        {exportError ? <Alert severity="error" sx={{ marginBottom: 2 }}>{exportError}</Alert> : null}
        {/* Part Selection Row */}
        <Box sx={{ display: 'flex', gap: 2, marginBottom: 2 }}>
          <FormControl sx={{ minWidth: 300 }}>
            <Autocomplete
              multiple
              options={['All', ...parts.map((part) => part.name)]}
              value={selectedParts.includes('All') ? ['All'] : selectedParts}
              onChange={(_, newValue) => {
                // If "All" is selected, select all parts internally but only show "All"
                if (newValue.includes('All')) {
                  setSelectedParts(['All', ...parts.map((part) => part.name)]);
                }
                // If "All" is deselected when it was the only thing selected, clear all
                else if (selectedParts.includes('All') && !newValue.includes('All')) {
                  setSelectedParts(newValue.filter(v => v !== 'All'));
                } else {
                  setSelectedParts(newValue);
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="Select Parts" size="small" />
              )}
            />
          </FormControl>
        </Box>

        {/* Date/Time Range Row */}
        <Box sx={{ display: 'flex', gap: 2, marginBottom: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <DateTimePicker
              label="Start Date & Time"
              value={dateTimeRange[0]}
              onChange={(newValue: any) =>
                setDateTimeRange([newValue, dateTimeRange[1]])
              }
              slotProps={{ textField: { size: 'small' } }}
              format="DD/MM/YYYY HH:mm"
            />
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <DateTimePicker
              label="End Date & Time"
              value={dateTimeRange[1]}
              onChange={(newValue: any) =>
                setDateTimeRange([dateTimeRange[0], newValue])
              }
              slotProps={{ textField: { size: 'small' } }}
              format="DD/MM/YYYY HH:mm"
            />
          </FormControl>
        </Box>

        {/* Buttons Row */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            onClick={handleFilter}
            variant="contained"
            disabled={!canApplyFilters}
          >
            Apply Filters
          </Button>
          <Button onClick={handleReset} variant="outlined">
            Reset
          </Button>
          {hasFiltered && displayData.length > 0 && (
            <Button onClick={() => exportToExcel()} variant="contained" color="success" disabled={isExporting}>
              Export to Excel
            </Button>
          )}
        </Box>
      </Box>

      {hasFiltered && (
        <>
          <Box sx={{ marginBottom: 3, padding: 2, borderRadius: 1 }}>
            <h3>Summary Statistics</h3>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              <Box>
                <strong>Total Parts:</strong> {statistics.totalParts}
              </Box>
              <Box>
                <strong>Total Rejections:</strong> {statistics.totalRejections}
              </Box>
              <Box>
                <strong>Cumulative Rejection %:</strong>{' '}
                {statistics.cumulativeRejectionPercentage.toFixed(2)}%
              </Box>
            </Box>

            <h4 style={{ marginTop: '1rem' }}>Rejection Breakdown by Reason:</h4>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow >
                    <TableCell><strong>Rejection Reason</strong></TableCell>
                    <TableCell align="right"><strong>Count</strong></TableCell>
                    <TableCell align="right"><strong>Percentage</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(statistics.rejectionReasons).map(([reason, stats]) => (
                    <TableRow key={reason}>
                      <TableCell>{reason}</TableCell>
                      <TableCell align="right">{stats.count}</TableCell>
                      <TableCell align="right">{stats.percentage.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {displayData.length === 0 ? (
            <Alert severity="info">No data entries match the selected filters</Alert>
          ) : (
            <Box>
              <h3>Filtered Data Entries ({displayData.length})</h3>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell><strong>Shift</strong></TableCell>
                      <TableCell><strong>Inspector Name</strong></TableCell>
                      <TableCell><strong>Part</strong></TableCell>
                      <TableCell><strong>Rejection</strong></TableCell>
                      <TableCell align="right"><strong>Number of Parts</strong></TableCell>
                      <TableCell align="right"><strong>Number of Rejections</strong></TableCell>
                      <TableCell><strong>Load Number</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(displayData as DataEntry[]).map((entry) => {
                      // If no rejections, show one row
                      if (entry.rejections.length === 0) {
                        return (
                          <TableRow key={entry.id} hover>
                            <TableCell>{Dayjs(entry.date).format('DD/MM/YYYY HH:mm')}</TableCell>
                            <TableCell>{entry.shift}</TableCell>
                            <TableCell>{entry.inspectorName}</TableCell>
                            <TableCell>{entry.part?.name || 'N/A'}</TableCell>
                            <TableCell>N/A</TableCell>
                            <TableCell align="right">{entry.numberOfParts}</TableCell>
                            <TableCell align="right">0</TableCell>
                            <TableCell>{entry.lotNumber}</TableCell>
                          </TableRow>
                        );
                      }

                      // For each rejection, show a row
                      return entry.rejections.map((rejection, index) => (
                        <TableRow key={`${entry.id}-${index}`} hover>
                          {index === 0 ? (
                            <>
                              <TableCell>{Dayjs(entry.date).format('DD/MM/YYYY HH:mm')}</TableCell>
                              <TableCell>{entry.shift}</TableCell>
                              <TableCell>{entry.inspectorName}</TableCell>
                              <TableCell>{entry.part?.name || 'N/A'}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                            </>
                          )}
                          <TableCell>{rejection.reason?.name || 'N/A'}</TableCell>
                          <TableCell align="right">{index === 0 ? entry.numberOfParts : ''}</TableCell>
                          <TableCell align="right">{rejection.numberOfRejections}</TableCell>
                          <TableCell>{index === 0 ? entry.lotNumber : ''}</TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      )}

      {!hasFiltered && (
        <Alert severity="info">
          Set filters and click "Apply Filters" to view the report
        </Alert>
      )}
    </div>
  );
};

export default ReportsContainer;
