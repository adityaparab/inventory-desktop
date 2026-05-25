import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { usePreferences, useCreatePreference, useUpdatePreference, useDeletePreference } from '../../queryClient/hooks';

interface Preference {
  id: string;
  name: string;
  value: string;
}

const PreferencesContainer: React.FC = () => {
  const { data: preferences = [], isLoading, isError, error } = usePreferences();
  const { mutate: createPreference, isPending: isCreating } = useCreatePreference();
  const { mutate: updatePreference, isPending: isUpdating } = useUpdatePreference();
  const { mutate: deletePreference, isPending: isDeleting } = useDeletePreference();

  const [openDialog, setOpenDialog] = useState(false);
  const [editingPreference, setEditingPreference] = useState<Preference | null>(null);
  const [formData, setFormData] = useState({ name: '', value: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenDialog = (preference?: Preference) => {
    if (preference) {
      setEditingPreference(preference);
      setFormData({ name: preference.name, value: preference.value });
    } else {
      setEditingPreference(null);
      setFormData({ name: '', value: '' });
    }
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPreference(null);
    setFormData({ name: '', value: '' });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Preference name is required';
    }
    if (!formData.value.trim()) {
      newErrors.value = 'Preference value is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    if (editingPreference) {
      updatePreference(
        { name: editingPreference.name, value: formData.value },
        {
          onSuccess: () => {
            handleCloseDialog();
          },
        }
      );
    } else {
      createPreference(formData, {
        onSuccess: () => {
          handleCloseDialog();
        },
      });
    }
  };

  const handleDelete = (preference: Preference) => {
    if (window.confirm(`Are you sure you want to delete preference "${preference.name}"?`)) {
      deletePreference(preference.name);
    }
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
        {error instanceof Error ? error.message : 'Failed to load preferences'}
      </Alert>
    );
  }

  return (
    <div>
      <h2>Preferences</h2>
      <Box sx={{ marginBottom: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpenDialog()}
        >
          Add Preference
        </Button>
      </Box>

      {(preferences as Preference[]).length === 0 ? (
        <Alert severity="info">No preferences found</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Value</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(preferences as Preference[]).map((preference) => (
                <TableRow key={preference.id} hover>
                  <TableCell>{preference.name}</TableCell>
                  <TableCell>{preference.value}</TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => handleOpenDialog(preference)}
                      disabled={isUpdating}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDelete(preference)}
                      disabled={isDeleting}
                      sx={{ marginLeft: 1 }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPreference ? 'Edit Preference' : 'Add Preference'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
          <FormControl fullWidth error={!!errors.name}>
            <TextField
              label="Preference Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!errors.name}
              helperText={errors.name}
              disabled={!!editingPreference}
            />
          </FormControl>
          <FormControl fullWidth error={!!errors.value}>
            <TextField
              label="Preference Value"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              error={!!errors.value}
              helperText={errors.value}
              multiline
              rows={4}
            />
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={isCreating || isUpdating}
          >
            {editingPreference ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default PreferencesContainer;
