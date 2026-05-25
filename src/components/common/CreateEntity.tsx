import { useState } from 'react';
import {
  Button,
  FormControl,
  FormHelperText,
  Grid,
  TextField,
} from '@mui/material';

const buttonStyle = {
  padding: '16px'
}

type CreateEntityProps = {
  placeholder: string;
  isError: boolean;
  error: unknown;
  onCreate: (name: string) => void;
};

const CreateEntity = ({ placeholder, isError, error, onCreate }: CreateEntityProps) => {
  const [name, setName] = useState('');
  

  const handleCreateAction = () => {
    onCreate(name);
    setName('');
  };

  return (
    <Grid container>
      <Grid size={10}>
        <FormControl
          fullWidth
          error={isError}
          variant="outlined"
          sx={{ p: 2, gap: 2 }}
        >
          <TextField
            error={isError}
            variant="outlined"
            label={placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {isError && (
            <FormHelperText id="component-error-text">
              {(error as any)?.message}
            </FormHelperText>
          )}
        </FormControl>
      </Grid>
      <Grid size={2}>
        <FormControl fullWidth sx={{ p: 2 }}>
          <Button
            sx={buttonStyle}
            onClick={handleCreateAction}
            variant="outlined"
            size="large"
            disabled={name.trim() === ''}
          >
            Create
          </Button>
        </FormControl>
      </Grid>
    </Grid>
  );
};

export default CreateEntity;
