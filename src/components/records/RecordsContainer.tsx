import React, { useState, useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useDataEntries, usePreferences, useUpdateDataEntry, useDeleteDataEntry, useParts, useRejections, useFilterDataEntries } from '../../queryClient/hooks';
import Dayjs from 'dayjs';
import type { DataEntryDto, FilterDataEntriesParams } from '../../queryClient/endpoints';

interface RejectionDetail {
  id: string;
  reason: {
    id: string;
    name: string;
  };
  numberOfRejections: number;
}

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
  rejections: RejectionDetail[];
  totalRejections: number;
  lotNumber: string;
  createdAt?: string;
  updatedAt?: string;
}

const ExpandableRow: React.FC<{ row: DataEntry; warningThreshold: number; dangerThreshold: number; onEdit: (row: DataEntry) => void; onDelete: (id: string) => void }> = ({ row, warningThreshold, dangerThreshold, onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const rejectionPercentage = row.numberOfParts > 0 ? (row.totalRejections / row.numberOfParts) * 100 : 0;

  let rowBackgroundColor;
  if (rejectionPercentage >= dangerThreshold) {
    rowBackgroundColor = '#2c0b0e'; // Light red
  } else if (rejectionPercentage >= warningThreshold) {
    rowBackgroundColor = '#332701'; // Light orange
  } else if (rejectionPercentage < warningThreshold) {
    rowBackgroundColor = '#388e3c'; // Default
  }

  const rowStyling = rowBackgroundColor ? { backgroundColor: rowBackgroundColor } : {};

  return (
    <>
      <TableRow hover sx={rowStyling}>
        <TableCell>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? '▼' : '▶'}
          </IconButton>
        </TableCell>
        <TableCell>{Dayjs(row.date).format('DD/MM/YYYY')}</TableCell>
        <TableCell>{row.shift}</TableCell>
        <TableCell>{row.inspectorName}</TableCell>
        <TableCell>{row.part?.name || 'N/A'}</TableCell>
        <TableCell align="right">{row.numberOfParts}</TableCell>
        <TableCell align="right">{row.totalRejections}</TableCell>
        <TableCell align="right">
          {rejectionPercentage.toFixed(2)}%
        </TableCell>
        <TableCell>{row.lotNumber}</TableCell>
        <TableCell align="center">
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'nowrap' }}>
            <Button size="small" onClick={() => onEdit(row)} variant="outlined">
              Edit
            </Button>
            <Button size="small" onClick={() => onDelete(row.id)} variant="outlined" color="error">
              Delete
            </Button>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <h4>Rejection Breakdown</h4>
              {row.rejections && row.rejections.length > 0 ? (
                <Box>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={row.rejections.map((rejection) => ({
                        name: rejection.reason?.name || 'N/A',
                        percentage: row.numberOfParts > 0 ? (rejection.numberOfRejections / row.numberOfParts) * 100 : 0,
                        count: rejection.numberOfRejections
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value) => {
                          if (typeof value === 'number') {
                            return value.toFixed(2) + '%';
                          }
                          return String(value ?? '');
                        }}
                        labelFormatter={(label) => `Rejection Type: ${label}`}
                      />
                      <Legend />
                      <Bar dataKey="percentage" name="% of Rejections" radius={[8, 8, 0, 0]}>
                        {row.rejections.map((_, index) => {
                          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Box sx={{ marginTop: 3 }}>
                    <h4>Rejection Distribution</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={row.rejections.map((rejection) => ({
                            name: rejection.reason?.name || 'N/A',
                            value: row.numberOfParts > 0 ? (rejection.numberOfRejections / row.numberOfParts) * 100 : 0
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value.toFixed(2)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {row.rejections.map((_, index) => {
                            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
                            return <Cell key={`pie-cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => {
                            if (typeof value === 'number') {
                              return value.toFixed(2) + '%';
                            }
                            return String(value ?? '');
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">No rejections recorded</Alert>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const RecordsContainer: React.FC = () => {
  const { data: allDataEntries = [], isLoading, isError, error } = useDataEntries();
  const { data: preferences = [] } = usePreferences();
  const { mutate: updateDataEntry } = useUpdateDataEntry();
  const { mutate: deleteDataEntry } = useDeleteDataEntry();
  const { data: parts = [] } = useParts();
  const { data: rejections = [] } = useRejections();

  // Filter state
  const [filters, setFilters] = useState<FilterDataEntriesParams>({});
  const [hasFiltered, setHasFiltered] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs.Dayjs | null, Dayjs.Dayjs | null]>([null, null]);
  const [loadNumberRange, setLoadNumberRange] = useState<[string, string]>(['', '']);
  const [inspectorNameFilter, setInspectorNameFilter] = useState('');
  const [rejectionPercentageRange, setRejectionPercentageRange] = useState<[string, string]>(['', '']);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);

  const { data: filteredData = [] } = useFilterDataEntries(filters);
  const displayData = hasFiltered ? filteredData : allDataEntries;

  const [editingEntry, setEditingEntry] = useState<DataEntry | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);

  // Extract warning and danger percentages from preferences
  const warningPercentage = useMemo(() => {
    const pref = (preferences as Array<{ name: string; value: string }>).find(p => p.name === 'warningPercentage');
    return pref ? parseFloat(pref.value) : 10; // Default 10%
  }, [preferences]);

  const dangerPercentage = useMemo(() => {
    const pref = (preferences as Array<{ name: string; value: string }>).find(p => p.name === 'dangerPercentage');
    return pref ? parseFloat(pref.value) : 20; // Default 20%
  }, [preferences]);

  const handleApplyFilters = () => {
    const newFilters: FilterDataEntriesParams = {};

    if (selectedParts.length > 0) {
      newFilters.partName = selectedParts.join(',');
    }

    const [startDate, endDate] = dateRange;
    if (startDate) {
      newFilters.startDate = startDate.toISOString();
    }
    if (endDate) {
      newFilters.endDate = endDate.toISOString();
    }

    if (loadNumberRange[0]) {
      newFilters.loadNumberStart = loadNumberRange[0];
    }
    if (loadNumberRange[1]) {
      newFilters.loadNumberEnd = loadNumberRange[1];
    }

    if (inspectorNameFilter) {
      newFilters.inspectorName = inspectorNameFilter;
    }

    if (rejectionPercentageRange[0]) {
      newFilters.rejectionPercentageMin = rejectionPercentageRange[0];
    }
    if (rejectionPercentageRange[1]) {
      newFilters.rejectionPercentageMax = rejectionPercentageRange[1];
    }

    setFilters(newFilters);
    setHasFiltered(true);
  };

  const handleResetFilters = () => {
    setSelectedParts([]);
    setDateRange([null, null]);
    setLoadNumberRange(['', '']);
    setInspectorNameFilter('');
    setRejectionPercentageRange(['', '']);
    setFilters({});
    setHasFiltered(false);
  };

  const handleEditClick = (row: DataEntry) => {
    setEditingEntry(row);
    setEditFormData({
      date: Dayjs(row.date),
      shift: row.shift,
      inspectorName: row.inspectorName,
      part: row.part,
      numberOfParts: row.numberOfParts,
      lotNumber: row.lotNumber,
      rejections: row.rejections.map(r => ({
        id: r.id,
        reason: r.reason,
        numberOfRejections: r.numberOfRejections.toString(),
      })),
    });
    setOpenEditDialog(true);
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      deleteDataEntry(id);
    }
  };

  const handleSaveEdit = () => {
    if (!editingEntry || !editFormData) return;

    const updatedData: DataEntryDto = {
      date: editFormData.date.toISOString(),
      shift: editFormData.shift,
      inspectorName: editFormData.inspectorName,
      part: editFormData.part?.id || '',
      numberOfParts: Number(editFormData.numberOfParts),
      rejections: editFormData.rejections.map((r: any) => ({
        reason: r.reason?.id || '',
        numberOfRejections: Number(r.numberOfRejections),
      })),
      lotNumber: editFormData.lotNumber,
    };

    updateDataEntry({ id: editingEntry.id, dataEntry: updatedData });
    setOpenEditDialog(false);
    setEditingEntry(null);
    setEditFormData(null);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditingEntry(null);
    setEditFormData(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', padding: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : 'Failed to load records'}
      </Alert>
    );
  }

  return (
    <div>
      <h2>Data Entry Records</h2>
      
      {/* Filter Panel */}
      <Box sx={{ marginBottom: 3, padding: 2, border: '1px solid #ddd', borderRadius: 1 }}>
        <h3>Filters</h3>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, marginBottom: 2 }}>
          {/* Part Selection */}
          <Box>
            <Autocomplete
              multiple
              options={parts.map((part) => part.name)}
              value={selectedParts}
              onChange={(_, newValue) => setSelectedParts(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Part Name" size="small" />
              )}
            />
          </Box>

          {/* Inspector Name */}
          <Box>
            <TextField
              label="Inspector Name"
              value={inspectorNameFilter}
              onChange={(e) => setInspectorNameFilter(e.target.value)}
              size="small"
              fullWidth
            />
          </Box>

          {/* Date Range */}
          <Box>
            <DateTimePicker
              label="Start Date & Time"
              value={dateRange[0]}
              onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
              format="DD/MM/YYYY HH:mm"
            />
          </Box>

          <Box>
            <DateTimePicker
              label="End Date & Time"
              value={dateRange[1]}
              onChange={(newValue) => setDateRange([dateRange[0], newValue])}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
              format="DD/MM/YYYY HH:mm"
            />
          </Box>

          {/* Load Number Range */}
          <Box>
            <TextField
              label="Load Number From"
              value={loadNumberRange[0]}
              onChange={(e) => setLoadNumberRange([e.target.value, loadNumberRange[1]])}
              size="small"
              fullWidth
            />
          </Box>

          <Box>
            <TextField
              label="Load Number To"
              value={loadNumberRange[1]}
              onChange={(e) => setLoadNumberRange([loadNumberRange[0], e.target.value])}
              size="small"
              fullWidth
            />
          </Box>

          {/* Rejection Percentage Range */}
          <Box>
            <TextField
              label="Rejection % From"
              type="number"
              inputProps={{ step: '0.01', min: '0', max: '100' }}
              value={rejectionPercentageRange[0]}
              onChange={(e) => setRejectionPercentageRange([e.target.value, rejectionPercentageRange[1]])}
              size="small"
              fullWidth
            />
          </Box>

          <Box>
            <TextField
              label="Rejection % To"
              type="number"
              inputProps={{ step: '0.01', min: '0', max: '100' }}
              value={rejectionPercentageRange[1]}
              onChange={(e) => setRejectionPercentageRange([rejectionPercentageRange[0], e.target.value])}
              size="small"
              fullWidth
            />
          </Box>
        </Box>

        {/* Filter Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button onClick={handleApplyFilters} variant="contained" color="primary">
            Apply Filters
          </Button>
          <Button onClick={handleResetFilters} variant="outlined">
            Reset Filters
          </Button>
          {hasFiltered && (
            <Alert severity="info" sx={{ flex: 1 }}>
              Showing {displayData.length} of {allDataEntries.length} records
            </Alert>
          )}
        </Box>
      </Box>

      {/* Data Table */}
      {displayData.length === 0 ? (
        <Alert severity="info">No data entries found</Alert>
      ) : (
        <Paper>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell style={{ width: '50px' }}></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Shift</strong></TableCell>
                <TableCell><strong>Inspector Name</strong></TableCell>
                <TableCell><strong>Part</strong></TableCell>
                <TableCell align="right"><strong>Number of Parts</strong></TableCell>
                <TableCell align="right"><strong>Total Rejections</strong></TableCell>
                <TableCell align="right"><strong>Rejection %</strong></TableCell>
                <TableCell><strong>Lot Number</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
              {(displayData as DataEntry[]).map((entry) => (
                <ExpandableRow key={entry.id} row={entry} warningThreshold={warningPercentage} dangerThreshold={dangerPercentage} onEdit={handleEditClick} onDelete={handleDeleteClick} />
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Data Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1, maxHeight: '70vh', overflow: 'auto' }}>
          {editFormData && (
            <>
              <TextField
                label="Date"
                type="date"
                value={editFormData.date.format('YYYY-MM-DD')}
                onChange={(e) => setEditFormData({ ...editFormData, date: Dayjs(e.target.value) })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Shift"
                value={editFormData.shift}
                onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
                SelectProps={{
                  native: true,
                }}
              >
                <option value="Day">Day (8 am to 8 pm)</option>
                <option value="Night">Night (8 pm to 8 am)</option>
              </TextField>
              <TextField
                label="Inspector Name"
                value={editFormData.inspectorName}
                onChange={(e) => setEditFormData({ ...editFormData, inspectorName: e.target.value })}
              />
              <Autocomplete
                options={parts as any[]}
                getOptionLabel={(option: any) => option?.name || ''}
                value={editFormData.part}
                onChange={(_, value) => setEditFormData({ ...editFormData, part: value })}
                renderInput={(params) => <TextField {...params} label="Part" />}
              />
              <TextField
                label="Number of Parts"
                type="number"
                value={editFormData.numberOfParts}
                onChange={(e) => setEditFormData({ ...editFormData, numberOfParts: e.target.value })}
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Lot Number"
                value={editFormData.lotNumber}
                onChange={(e) => setEditFormData({ ...editFormData, lotNumber: e.target.value })}
              />

              {/* Rejections Section */}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <h4 style={{ margin: 0 }}>Rejections</h4>
                </Box>
                {editFormData.rejections && editFormData.rejections.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {editFormData.rejections.map((rejection: any, index: number) => (
                      <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                        <Autocomplete
                          options={rejections as any[]}
                          getOptionLabel={(option: any) => option?.name || ''}
                          value={rejection.reason}
                          onChange={(_, value) => {
                            const newRejections = [...editFormData.rejections];
                            newRejections[index].reason = value;
                            setEditFormData({ ...editFormData, rejections: newRejections });
                          }}
                          sx={{ flex: 2 }}
                          renderInput={(params) => <TextField {...params} label="Rejection Reason" size="small" />}
                        />
                        <TextField
                          label="Count"
                          type="number"
                          size="small"
                          value={rejection.numberOfRejections}
                          onChange={(e) => {
                            const newRejections = [...editFormData.rejections];
                            newRejections[index].numberOfRejections = e.target.value;
                            setEditFormData({ ...editFormData, rejections: newRejections });
                          }}
                          inputProps={{ min: 0 }}
                          sx={{ flex: 1 }}
                        />
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            const newRejections = editFormData.rejections.filter((_: any, i: number) => i !== index);
                            setEditFormData({ ...editFormData, rejections: newRejections });
                          }}
                        >
                          Remove
                        </Button>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>No rejections</Alert>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setEditFormData({
                      ...editFormData,
                      rejections: [
                        ...editFormData.rejections,
                        { id: Date.now().toString(), reason: null, numberOfRejections: '' }
                      ]
                    });
                  }}
                  sx={{ mt: 1 }}
                >
                  Add Rejection
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RecordsContainer;
