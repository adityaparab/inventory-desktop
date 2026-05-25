import { useState } from "react";
import { Box, Button, FormControl, Grid, ListItemText, TextField } from "@mui/material";
import type { SxProps } from "@mui/material/styles";
import type { Entity } from "./common.types";

const buttonStyle: SxProps = { margin: "0 5px" };
const textContainerStyle: SxProps = { flex: "1" };
const buttonsContainerStyle: SxProps = { display: "flex", flexDirection: "row" };
const containerStyle: SxProps = { margin: "5px 0" };

type EntityProps = {
  entity: Entity;
  onEdit: (entity: Entity) => void;
  onDelete: (entity: Entity) => void;
};

const EntityRow: React.FC<EntityProps> = ({ entity, onDelete, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entity.name);

  const handleEdit = () => {
    onEdit({ ...entity, name });
    setEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${entity.name}"?`)) {
      onDelete(entity);
    }
  };

  return (
    <Grid container columns={2} sx={containerStyle}>
      <Box sx={textContainerStyle}>
        {editing ? (
          <FormControl fullWidth>
            <TextField value={name} onChange={(event) => setName(event.target.value)} />
          </FormControl>
        ) : (
          <ListItemText primary={entity.name} />
        )}
      </Box>
      <Box sx={buttonsContainerStyle}>
        <FormControl sx={buttonsContainerStyle}>
          {!editing ? (
            <>
              <Button sx={buttonStyle} variant="contained" color="primary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button sx={buttonStyle} variant="contained" color="secondary" onClick={handleDelete}>
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button sx={buttonStyle} variant="contained" color="primary" onClick={handleEdit} disabled={!name || name === entity.name}>
                Save
              </Button>
              <Button sx={buttonStyle} variant="contained" color="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          )}
        </FormControl>
      </Box>
    </Grid>
  );
};

export default EntityRow;
