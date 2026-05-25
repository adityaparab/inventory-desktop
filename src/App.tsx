import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Navigate, Route, Routes } from "react-router-dom";
import { Alert, AppBar, Box, Button, CircularProgress, Grid, Paper, TextField, Toolbar, Typography } from "@mui/material";
import DataEntryContainer from "./components/dataEntry/DataEntryContainer";
import PartsContainer from "./components/parts/PartsContainer";
import PreferencesContainer from "./components/preferences/PreferencesContainer";
import RecordsContainer from "./components/records/RecordsContainer";
import RejectionsContainer from "./components/rejections/RejectionsContainer";
import ReportsContainer from "./components/reports/ReportsContainer";
import SideNav from "./components/SideNav";
import "./App.css";

type MongoStatus = {
  configured: boolean;
  dbPath: string | null;
  savedDbPath: string;
  running: boolean;
  connectionUri: string;
  database: string;
};

type PortProcess = {
  pid: number;
  name: string;
};

const App = () => {
  const [status, setStatus] = useState<MongoStatus | null>(null);
  const [setupPath, setSetupPath] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(true);

  const startDatabaseWithPrompt = async () => {
    const conflict = await invoke<PortProcess | null>("get_mongodb_port_process");

    if (conflict) {
      const shouldTerminate = window.confirm(
        `MongoDB needs port 27017, but it is currently used by ${conflict.name} (PID ${conflict.pid}).\n\nClose that process and continue?`,
      );

      if (!shouldTerminate) {
        throw new Error("MongoDB could not start because port 27017 is busy.");
      }

      await invoke("terminate_mongodb_port_process", { pid: conflict.pid });
    }

    const nextStatus = await invoke<MongoStatus>("start_mongodb");
    setStatus(nextStatus);
    setSetupPath(nextStatus.savedDbPath);
  };

  const refreshStatus = async () => {
    setIsStarting(true);
    setError("");

    try {
      const nextStatus = await invoke<MongoStatus>("get_mongodb_status");
      setStatus(nextStatus);
      setSetupPath(nextStatus.savedDbPath);

      if (nextStatus.configured) {
        await startDatabaseWithPrompt();
      }
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsStarting(false);
    }
  };

  const chooseDataFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "MongoDB data folder",
    });

    if (typeof selected === "string") {
      setSetupPath(selected);
    }
  };

  const saveDataFolder = async () => {
    setIsStarting(true);
    setError("");

    try {
      const nextStatus = await invoke<MongoStatus>("set_mongodb_path", { path: setupPath });
      setStatus(nextStatus);
      setSetupPath(nextStatus.savedDbPath);
      await startDatabaseWithPrompt();
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const isConfigured = status?.configured ?? false;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static">
        <Toolbar variant="dense">
          <Typography variant="h6" color="inherit" component="div">
            Inventory Management
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="inherit">
            {status?.running ? "MongoDB running" : "MongoDB offline"}
          </Typography>
        </Toolbar>
      </AppBar>

      {isStarting ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
          <CircularProgress />
        </Box>
      ) : !isConfigured ? (
        <Box sx={{ p: 3 }}>
          <Paper sx={{ p: 3, maxWidth: 860 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Configure MongoDB Storage
            </Typography>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField fullWidth label="MongoDB data folder" value={setupPath} onChange={(event) => setSetupPath(event.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button fullWidth variant="outlined" onClick={chooseDataFolder}>Browse</Button>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button fullWidth variant="contained" onClick={saveDataFolder} disabled={!setupPath.trim()}>Start</Button>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ p: 2 }}>
          {error ? (
            <Grid size={12}>
              <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
            </Grid>
          ) : null}
          <Grid size={{ xs: 12, md: 2 }}>
            <SideNav />
          </Grid>
          <Grid size={{ xs: 12, md: 10 }}>
            <Paper sx={{ p: 2, minHeight: "80vh" }}>
              <Routes>
                <Route path="/data-entry" element={<DataEntryContainer />} />
                <Route path="/records" element={<RecordsContainer />} />
                <Route path="/reports" element={<ReportsContainer />} />
                <Route path="/parts" element={<PartsContainer />} />
                <Route path="/rejections" element={<RejectionsContainer />} />
                <Route path="/preferences" element={<PreferencesContainer />} />
                <Route path="/" element={<Navigate to="/data-entry" replace />} />
              </Routes>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default App;
