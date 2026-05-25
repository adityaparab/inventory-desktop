import { List, ListItem, ListItemText, Paper, type SxProps } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

const linkStyle: SxProps = { color: 'white' }

const SideNav: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Paper style={{ height: '100%' }}>
      <List>
        <ListItem 
          component={Link} 
          to="/data-entry"
          sx={{ backgroundColor: isActive('/data-entry') ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }}
        >
          <ListItemText primary="Data Entry" sx={linkStyle} />
        </ListItem>
        <ListItem 
          component={Link} 
          to="/records"
          sx={{ backgroundColor: isActive('/records') ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }}
        >
          <ListItemText primary="Records" sx={linkStyle} />
        </ListItem>
        <ListItem 
          component={Link} 
          to="/reports"
          sx={{ backgroundColor: isActive('/reports') ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }}
        >
          <ListItemText primary="Reports" sx={linkStyle} />
        </ListItem>
        <ListItem 
          component={Link} 
          to="/parts"
          sx={{ backgroundColor: isActive('/parts') ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }}
        >
          <ListItemText primary="Parts" sx={linkStyle} />
        </ListItem>
        <ListItem 
          component={Link} 
          to="/rejections"
          sx={{ backgroundColor: isActive('/rejections') ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }}
        >
          <ListItemText primary="Rejections" sx={linkStyle} />
        </ListItem>
        <ListItem 
          component={Link} 
          to="/preferences"
          sx={{ backgroundColor: isActive('/preferences') ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }}
        >
          <ListItemText primary="Preferences" sx={linkStyle} />
        </ListItem>
      </List>
    </Paper>
  );
};

export default SideNav;
