import React, { useState, useEffect } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Dayjs from 'dayjs';
import {
  FormControl,
  TextField,
  Button,
  Box,
  MenuItem,
  Autocomplete,
  Alert,
  CircularProgress,
  FormHelperText,
  Chip,
} from '@mui/material';
import { useCreateDataEntry } from '../../queryClient/hooks';
import { useParts } from '../../queryClient/hooks';
import { useRejections } from '../../queryClient/hooks';
import type { Entity } from '../common/common.types';
import type { DataEntryDto } from '../../queryClient/endpoints';

interface RejectionItem {
  id: string;
  rejection: Entity | null;
  numberOfRejections: string;
}

const DataEntryContainer: React.FC = () => {
  const [formData, setFormData] = useState({
    date: Dayjs(),
    shift: 'Day',
    inspectorName: '',
    part: null as Entity | null,
    numberOfParts: '',
    lotNumber: '',
  });

  const [rejectionItems, setRejectionItems] = useState<RejectionItem[]>([]);
  const [tempRejection, setTempRejection] = useState<Entity | null>(null);
  const [tempNumberOfRejections, setTempNumberOfRejections] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { mutate: createDataEntry, isPending, isError, error } = useCreateDataEntry();
  const { data: parts = [] } = useParts();
  const { data: rejections = [] } = useRejections();

  // Auto-set shift based on current time
  useEffect(() => {
    const currentHour = new Date().getHours();
    const shift = currentHour >= 8 && currentHour < 20 ? 'Day' : 'Night';
    setFormData(prev => ({ ...prev, shift }));
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.inspectorName.trim()) {
      newErrors.inspectorName = 'Inspector name is required';
    }
    if (!formData.part) {
      newErrors.part = 'Please select a part';
    }
    if (!formData.numberOfParts || isNaN(Number(formData.numberOfParts)) || Number(formData.numberOfParts) < 0) {
      newErrors.numberOfParts = 'Please enter a valid number';
    }
    if (!formData.lotNumber.trim()) {
      newErrors.lotNumber = 'Lot number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddRejection = () => {
    if (!tempRejection) {
      setErrors(prev => ({ ...prev, tempRejection: 'Please select a rejection' }));
      return;
    }
    if (!tempNumberOfRejections || isNaN(Number(tempNumberOfRejections)) || Number(tempNumberOfRejections) < 0) {
      setErrors(prev => ({ ...prev, tempNumberOfRejections: 'Please enter a valid number' }));
      return;
    }

    const newItem: RejectionItem = {
      id: Date.now().toString(),
      rejection: tempRejection,
      numberOfRejections: tempNumberOfRejections,
    };

    setRejectionItems([...rejectionItems, newItem]);
    setTempRejection(null);
    setTempNumberOfRejections('');
    setErrors(prev => {
      const { tempRejection: _, tempNumberOfRejections: __, ...rest } = prev;
      return rest;
    });
  };

  const handleDeleteRejection = (id: string) => {
    setRejectionItems(rejectionItems.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    if (!formData.part) {
      return;
    }

    const dataEntryDto: DataEntryDto = {
      date: formData.date.toISOString(),
      shift: formData.shift,
      inspectorName: formData.inspectorName,
      part: formData.part.id,
      numberOfParts: Number(formData.numberOfParts),
      rejections: rejectionItems.map(item => ({
        reason: item.rejection!.id,
        numberOfRejections: Number(item.numberOfRejections),
      })),
      lotNumber: formData.lotNumber,
    };

    createDataEntry(dataEntryDto);
    handleReset();
  };

  const handleReset = () => {
    setFormData({
      date: Dayjs(),
      shift: 'Day',
      inspectorName: '',
      part: null,
      numberOfParts: '',
      lotNumber: '',
    });
    setRejectionItems([]);
    setTempRejection(null);
    setTempNumberOfRejections('');
    setErrors({});
  };

  return (
    <div>
      <h2>Data Entry</h2>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 900,
          margin: '0 auto',
          padding: 2,
        }}
      >
        {isError && (
          <Alert severity="error">
            {error instanceof Error ? error.message : 'Failed to create data entry'}
          </Alert>
        )}

        {/* Row 1: Date and Shift */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth>
              <DatePicker
                label="Select Date"
                value={formData.date}
                onChange={(newValue) =>
                  setFormData({ ...formData, date: newValue || Dayjs() })
                }
                disableFuture
                format='DD-MMM-YYYY'
              />
            </FormControl>
          </Box>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth error={!!errors.shift}>
              <TextField
                select
                label="Enter Shift"
                value={formData.shift}
                onChange={(e) =>
                  setFormData({ ...formData, shift: e.target.value })
                }
              >
                <MenuItem value="Day">Day (8 am to 8 pm)</MenuItem>
                <MenuItem value="Night">Night (8 pm to 8 am)</MenuItem>
              </TextField>
              {errors.shift && <FormHelperText>{errors.shift}</FormHelperText>}
            </FormControl>
          </Box>
        </Box>

        {/* Row 2: Inspector Name and Lot Number */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth error={!!errors.inspectorName}>
              <TextField
                label="Enter Inspector Name"
                value={formData.inspectorName}
                onChange={(e) =>
                  setFormData({ ...formData, inspectorName: e.target.value })
                }
                error={!!errors.inspectorName}
                helperText={errors.inspectorName}
              />
            </FormControl>
          </Box>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth error={!!errors.lotNumber}>
              <TextField
                label="Lot Number"
                value={formData.lotNumber}
                onChange={(e) =>
                  setFormData({ ...formData, lotNumber: e.target.value })
                }
                error={!!errors.lotNumber}
                helperText={errors.lotNumber}
              />
            </FormControl>
          </Box>
        </Box>

        {/* Row 3: Part and Number of Parts */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth error={!!errors.part}>
              <Autocomplete
                options={parts}
                getOptionLabel={(option) => option.name}
                value={formData.part}
                onChange={(_, newValue) =>
                  setFormData({ ...formData, part: newValue })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Part"
                    error={!!errors.part}
                    helperText={errors.part}
                  />
                )}
              />
            </FormControl>
          </Box>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth error={!!errors.numberOfParts}>
              <TextField
                label="Number of Parts"
                type="number"
                value={formData.numberOfParts}
                onChange={(e) =>
                  setFormData({ ...formData, numberOfParts: e.target.value })
                }
                inputProps={{ min: 0 }}
                error={!!errors.numberOfParts}
                helperText={errors.numberOfParts}
              />
            </FormControl>
          </Box>
        </Box>

        {/* Row 4: Rejection and Number of Rejections with Add Button */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1.66 }}>
            <FormControl fullWidth error={!!errors.tempRejection}>
              <Autocomplete
                options={rejections}
                getOptionLabel={(option) => option.name}
                value={tempRejection}
                onChange={(_, newValue) => {
                  setTempRejection(newValue);
                  setErrors(prev => {
                    const { tempRejection: _, ...rest } = prev;
                    return rest;
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Rejection"
                    error={!!errors.tempRejection}
                    helperText={errors.tempRejection}
                  />
                )}
              />
            </FormControl>
          </Box>
          <Box sx={{ flex: 1.33 }}>
            <FormControl fullWidth error={!!errors.tempNumberOfRejections}>
              <TextField
                label="Number of Rejections"
                type="number"
                value={tempNumberOfRejections}
                onChange={(e) => {
                  setTempNumberOfRejections(e.target.value);
                  setErrors(prev => {
                    const { tempNumberOfRejections: _, ...rest } = prev;
                    return rest;
                  });
                }}
                inputProps={{ min: 0 }}
                error={!!errors.tempNumberOfRejections}
                helperText={errors.tempNumberOfRejections}
              />
            </FormControl>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddRejection}
              fullWidth
              sx={{ height: '56px' }}
            >
              Add
            </Button>
          </Box>
        </Box>

        {/* Rejection Items List */}
        {rejectionItems.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              marginTop: 1,
            }}
          >
            {rejectionItems.map((item) => (
              <Chip
                key={item.id}
                label={`${item.rejection?.name} (${item.numberOfRejections})`}
                onDelete={() => handleDeleteRejection(item.id)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}

        {/* Submit and Reset Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', marginTop: 2 }}>
          <Button onClick={handleReset} variant="outlined" sx={{ height: '56px' }}>
            Reset
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isPending}
            sx={{ height: '56px' }}
          >
            {isPending ? <CircularProgress size={24} /> : 'Submit'}
          </Button>
        </Box>
      </Box>
    </div>
  );
};

export default DataEntryContainer;