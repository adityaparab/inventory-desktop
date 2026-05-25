import React from 'react';
import { useCreateRejection, useEditRejection, useDeleteRejection, useRejections } from '../../queryClient/hooks';
import CreateEntity from '../common/CreateEntity';
import EntityList from '../common/EntityList';
import type { Entity } from '../common/common.types';
const RejectionsContainer: React.FC = () => {
  const placeholder = "Enter Rejection Reason";

  const { mutate: createRejection, isError, error } = useCreateRejection();
  const { mutate: editRejectioin } = useEditRejection();
  const { mutate: deleteRejection } = useDeleteRejection();
  const { data: rejections } = useRejections();

  const handleCreateRejection = (name: string) => {
    createRejection({ name });
  };
  const handleEditRejection = (rejection: Entity) => {
    editRejectioin(rejection);
  };
  const handleDeleteRejection = (rejection: Entity) => {
    deleteRejection(rejection.id);
  };

  return (
    <div>
      <h2>Rejections Management</h2>
      <CreateEntity
        placeholder={placeholder}
        isError={isError}
        error={error}
        onCreate={handleCreateRejection}
      />
      <EntityList
        entities={rejections}
        onEdit={handleEditRejection}
        onDelete={handleDeleteRejection}
      />
    </div>
  );
};

export default RejectionsContainer;