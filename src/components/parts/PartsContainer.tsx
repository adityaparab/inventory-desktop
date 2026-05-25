import React from 'react';
import CreateEntity from '../common/CreateEntity';
import EntityList from '../common/EntityList';
import { useCreatePart, useDeletePart, useEditPart, useParts } from '../../queryClient/hooks';
import type { Entity } from '../common/common.types';

const PartsContainer: React.FC = () => {
  const placeholder = "Enter Part Name";

  const { mutate: createPart, isError, error } = useCreatePart();
  const { mutate: editPart } = useEditPart();
  const { mutate: deletePart } = useDeletePart();
  const { data: parts } = useParts();

  const handleCreatePart = (name: string) => {
    createPart({ name });
  };

  const handleEditPart = (part: Entity) => {
    editPart(part);
  };

  const handleDeletePart = (part: Entity) => {
    deletePart(part.id);
  }

  return (
    <div>
      <h2>Parts Management</h2>
      <CreateEntity
        placeholder={placeholder}
        isError={isError}
        error={error}
        onCreate={handleCreatePart}
      />
      <EntityList
        entities={parts}
        onEdit={handleEditPart}
        onDelete={handleDeletePart}
      />
    </div>
  );
};

export default PartsContainer;
