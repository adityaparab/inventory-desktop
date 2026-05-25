import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type MongoStatus = {
  configured: boolean;
  dbPath: string | null;
  savedDbPath: string;
  configPath: string;
  running: boolean;
  connectionUri: string;
  database: string;
};

type PortProcess = {
  pid: number;
  name: string;
};

type DocumentsResponse = {
  documents: unknown[];
  limit: number;
};

function App() {
  const [status, setStatus] = useState<MongoStatus | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [documents, setDocuments] = useState<unknown[]>([]);
  const [setupPath, setSetupPath] = useState("");
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"documents" | "settings">("documents");
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentLimit, setDocumentLimit] = useState(0);

  const selectedDocumentTitle = useMemo(() => {
    if (!selectedCollection) {
      return "Documents";
    }

    return selectedCollection;
  }, [selectedCollection]);

  async function startDatabaseWithPrompt() {
    const conflict = await invoke<PortProcess | null>("get_mongodb_port_process");

    if (conflict) {
      const shouldTerminate = window.confirm(
        `MongoDB needs port 27017, but it is currently used by ${conflict.name} (PID ${conflict.pid}).\n\nClose that process and continue?`,
      );

      if (!shouldTerminate) {
        setError("MongoDB could not start because port 27017 is busy.");
        return false;
      }

      await invoke("terminate_mongodb_port_process", { pid: conflict.pid });
    }

    const nextStatus = await invoke<MongoStatus>("start_mongodb");
    setStatus(nextStatus);
    setSetupPath(nextStatus.savedDbPath);

    return true;
  }

  async function refreshStatus() {
    setIsLoadingStatus(true);
    setError("");

    try {
      const nextStatus = await invoke<MongoStatus>("get_mongodb_status");
      setStatus(nextStatus);
      setSetupPath(nextStatus.savedDbPath);

      if (nextStatus.configured) {
        const started = await startDatabaseWithPrompt();

        if (started) {
          await loadCollections();
        }
      }
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsLoadingStatus(false);
    }
  }

  async function loadCollections() {
    setIsLoadingCollections(true);
    setError("");

    try {
      const names = await invoke<string[]>("list_collections");
      setCollections(names);

      if (names.length === 0) {
        setSelectedCollection("");
        setDocuments([]);
        return;
      }

      setSelectedCollection((current) => {
        if (current && names.includes(current)) {
          return current;
        }

        void loadDocuments(names[0]);
        return names[0];
      });
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsLoadingCollections(false);
    }
  }

  async function loadDocuments(collectionName: string) {
    setSelectedCollection(collectionName);
    setIsLoadingDocuments(true);
    setError("");

    try {
      const response = await invoke<DocumentsResponse>("list_documents", {
        collection: collectionName,
      });

      setDocuments(response.documents);
      setDocumentLimit(response.limit);
    } catch (caughtError) {
      setError(String(caughtError));
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  async function chooseDataFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "MongoDB data folder",
    });

    if (typeof selected === "string") {
      setSetupPath(selected);
    }
  }

  async function saveDataFolder() {
    setIsLoadingStatus(true);
    setError("");

    try {
      const nextStatus = await invoke<MongoStatus>("set_mongodb_path", {
        path: setupPath,
      });

      setStatus(nextStatus);
      setSetupPath(nextStatus.savedDbPath);

      const started = await startDatabaseWithPrompt();

      if (started) {
        setActiveView("documents");
        await loadCollections();
      }
    } catch (caughtError) {
      setError(String(caughtError));
    } finally {
      setIsLoadingStatus(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  const isConfigured = status?.configured ?? false;
  const isSettingsView = activeView === "settings";
  const showSetupView = !isConfigured && !isSettingsView;

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Collections">
        <div className="brand-block">
          <p className="eyebrow">Inventory</p>
          <h1>{status?.database ?? "inventory"}</h1>
        </div>

        <div className="connection-block">
          <span className={status?.running ? "status-pill is-running" : "status-pill"}>
            {status?.running ? "MongoDB running" : "MongoDB offline"}
          </span>
          <span className="connection-uri">
            {status?.connectionUri ?? "mongodb://127.0.0.1:27017/inventory"}
          </span>
        </div>

        <div className="sidebar-actions">
          <button type="button" onClick={loadCollections} disabled={!isConfigured || isLoadingCollections}>
            Refresh
          </button>
        </div>

        <nav className="collection-list">
          {isLoadingCollections ? <p className="muted">Loading collections</p> : null}

          {!isLoadingCollections && collections.length === 0 ? (
            <p className="muted">No collections</p>
          ) : null}

          {collections.map((collection) => (
            <button
              className={collection === selectedCollection ? "collection-item is-active" : "collection-item"}
              key={collection}
              type="button"
              onClick={() => {
                setActiveView("documents");
                void loadDocuments(collection);
              }}
            >
              <span>{collection}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className={isSettingsView ? "icon-button is-active" : "icon-button"}
            type="button"
            aria-label="Settings"
            title="Settings"
            onClick={() => setActiveView("settings")}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </aside>

      <section className="detail-view">
        <header className="detail-header">
          <div>
            <p className="eyebrow">{isSettingsView ? "Configuration" : "Collection"}</p>
            <h2>{isSettingsView ? "Settings" : selectedDocumentTitle}</h2>
          </div>
          {!isSettingsView ? (
            <button
              type="button"
              onClick={() => selectedCollection && loadDocuments(selectedCollection)}
              disabled={!selectedCollection || isLoadingDocuments}
            >
              Reload
            </button>
          ) : null}
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {showSetupView ? (
          <section className="setup-panel" aria-label="MongoDB data folder setup">
            <div>
              <p className="eyebrow">Setup</p>
              <h2>MongoDB data folder</h2>
              <p className="muted">Config file: {status?.configPath ?? "conf\\config.json"}</p>
            </div>

            <div className="path-row">
              <input
                value={setupPath}
                onChange={(event) => setSetupPath(event.currentTarget.value)}
                placeholder="Choose a local folder"
              />
              <button type="button" onClick={chooseDataFolder}>
                Choose
              </button>
              <button type="button" onClick={saveDataFolder} disabled={!setupPath || isLoadingStatus}>
                Save
              </button>
            </div>
          </section>
        ) : null}

        {isSettingsView ? (
          <section className="setup-panel" aria-label="Settings">
            <div>
              <p className="eyebrow">Database</p>
              <h2>MongoDB data folder</h2>
              <p className="muted">Config file: {status?.configPath ?? "conf\\config.json"}</p>
            </div>

            <div className="path-row">
              <input
                value={setupPath}
                onChange={(event) => setSetupPath(event.currentTarget.value)}
                placeholder="Choose a local folder"
              />
              <button type="button" onClick={chooseDataFolder}>
                Choose
              </button>
              <button type="button" onClick={saveDataFolder} disabled={!setupPath || isLoadingStatus}>
                Save
              </button>
            </div>
          </section>
        ) : null}

        {isConfigured && !isSettingsView ? (
          <section className="documents-panel">
            <div className="documents-toolbar">
              <span>
                {documents.length} document{documents.length === 1 ? "" : "s"}
              </span>
              {documentLimit > 0 ? <span className="muted">Limit {documentLimit}</span> : null}
            </div>

            {isLoadingDocuments ? <p className="muted">Loading documents</p> : null}

            {!isLoadingDocuments && selectedCollection && documents.length === 0 ? (
              <p className="empty-state">No documents in this collection</p>
            ) : null}

            {!isLoadingDocuments && !selectedCollection ? (
              <p className="empty-state">Choose a collection</p>
            ) : null}

            <div className="document-list">
              {documents.map((document, index) => (
                <article className="document-card" key={`${selectedCollection}-${index}`}>
                  <div className="document-index">#{index + 1}</div>
                  <pre>{JSON.stringify(document, null, 2)}</pre>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default App;
