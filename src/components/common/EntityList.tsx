import Box from '@mui/material/Grid';
import Stack from '@mui/material/Grid';
import type { Entity as IEntity } from './common.types';
import Entity from './Entity';

type EntityListProps = {
  entities?: IEntity[];
  onEdit: (entity: IEntity) => void;
  onDelete: (entity: IEntity) => void;
};

const boxStyle = { width: '100%' };

const EntityList: React.FC<EntityListProps> = ({ entities, onDelete, onEdit }) => {
  return (
    <Box sx={boxStyle}>
      <Stack spacing={2} rowSpacing={2}>
        {entities && entities.length > 0 && entities.map(entity => (
          <Entity
            key={entity.id}
            entity={entity}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default EntityList;
