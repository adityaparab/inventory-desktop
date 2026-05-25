use mongodb::{
    bson::{doc, oid::ObjectId, Bson, Document},
    options::FindOptions,
    results::{DeleteResult, UpdateResult},
    sync::Client,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State};

const CONFIG_DIR_NAME: &str = ".inventory";
const CONFIG_FILE_NAME: &str = "config.json";
const DATABASE_NAME: &str = "inventory";
const MONGO_HOST: &str = "127.0.0.1";
const MONGO_PORT: u16 = 27017;
const MONGO_URI: &str = "mongodb://127.0.0.1:27017/inventory";
const MONGO_DRIVER_URI: &str =
    "mongodb://127.0.0.1:27017/inventory?serverSelectionTimeoutMS=3000";
const DOCUMENT_LIMIT: i64 = 200;
const PARTS_COLLECTION: &str = "parts";
const REJECTIONS_COLLECTION: &str = "rejections";
const PREFERENCES_COLLECTION: &str = "preferences";
const DATA_ENTRIES_COLLECTION: &str = "dataentries";

#[derive(Clone, Default)]
struct MongoState {
    child: Arc<Mutex<Option<Child>>>,
}

impl Drop for MongoState {
    fn drop(&mut self) {
        if Arc::strong_count(&self.child) == 1 {
            stop_owned_mongodb(self);
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MongoStatus {
    configured: bool,
    db_path: Option<String>,
    saved_db_path: String,
    config_path: String,
    running: bool,
    connection_uri: String,
    database: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PortProcess {
    pid: u32,
    name: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    db_path: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            db_path: String::new(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentsResponse {
    documents: Vec<serde_json::Value>,
    limit: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NamedEntityDto {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreferenceDto {
    name: String,
    value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RejectionItemDto {
    reason: String,
    number_of_rejections: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DataEntryDto {
    date: String,
    shift: String,
    inspector_name: String,
    part: String,
    number_of_parts: i64,
    rejections: Vec<RejectionItemDto>,
    lot_number: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DataEntryFilter {
    part_name: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    load_number_start: Option<String>,
    load_number_end: Option<String>,
    inspector_name: Option<String>,
    rejection_percentage_min: Option<String>,
    rejection_percentage_max: Option<String>,
    all_parts: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NamedEntity {
    id: String,
    name: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Preference {
    id: String,
    name: String,
    value: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RejectionDetail {
    id: String,
    reason: NamedEntity,
    number_of_rejections: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DataEntry {
    id: String,
    date: String,
    shift: String,
    inspector_name: String,
    part: NamedEntity,
    number_of_parts: i64,
    rejections: Vec<RejectionDetail>,
    total_rejections: i64,
    lot_number: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

fn format_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn config_file_path() -> Result<PathBuf, String> {
    let user_profile = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or_else(|| "Could not find the current user's home directory".to_string())?;

    Ok(PathBuf::from(user_profile)
        .join(CONFIG_DIR_NAME)
        .join(CONFIG_FILE_NAME))
}

fn legacy_config_file_path() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(format_error)?;
    let install_dir = exe_path
        .parent()
        .ok_or_else(|| "Could not find the application installation directory".to_string())?;

    Ok(install_dir.join("conf").join(CONFIG_FILE_NAME))
}

fn write_config(config_path: &Path, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(format_error)?;
    }

    let content = serde_json::to_string_pretty(config).map_err(format_error)?;
    fs::write(config_path, format!("{content}\n")).map_err(format_error)
}

fn read_config() -> Result<AppConfig, String> {
    let config_path = config_file_path()?;

    if !config_path.exists() {
        let legacy_path = legacy_config_file_path()?;

        if legacy_path.exists() {
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent).map_err(format_error)?;
            }

            fs::copy(&legacy_path, &config_path).map_err(format_error)?;
        }
    }

    if !config_path.exists() {
        let config = AppConfig::default();
        write_config(&config_path, &config)?;
        return Ok(config);
    }

    let content = fs::read_to_string(&config_path).map_err(format_error)?;
    serde_json::from_str(&content).map_err(format_error)
}

fn configured_db_path(config: &AppConfig) -> Option<PathBuf> {
    let trimmed_path = config.db_path.trim();

    if trimmed_path.is_empty() {
        return None;
    }

    let db_path = PathBuf::from(trimmed_path);

    if db_path.is_absolute() && db_path.is_dir() {
        Some(db_path)
    } else {
        None
    }
}

fn write_db_path_config(db_path: &Path) -> Result<(), String> {
    let config_path = config_file_path()?;
    let config = AppConfig {
        db_path: db_path.display().to_string(),
    };

    write_config(&config_path, &config)
}

fn mongodb_status() -> Result<MongoStatus, String> {
    let config_path = config_file_path()?;
    let config = read_config()?;
    let db_path = configured_db_path(&config);

    Ok(MongoStatus {
        configured: db_path.is_some(),
        db_path: db_path.map(|path| path.display().to_string()),
        saved_db_path: config.db_path,
        config_path: config_path.display().to_string(),
        running: is_mongodb_port_open(),
        connection_uri: MONGO_URI.to_string(),
        database: DATABASE_NAME.to_string(),
    })
}

fn mongod_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let local_binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("mongod.exe");

        if local_binary.exists() {
            return Ok(local_binary);
        }
    }

    let resource_binary = app
        .path()
        .resource_dir()
        .map_err(format_error)?
        .join("binaries")
        .join("mongod.exe");

    if resource_binary.exists() {
        Ok(resource_binary)
    } else {
        Err(format!(
            "MongoDB server binary was not found at {}",
            resource_binary.display()
        ))
    }
}

fn is_mongodb_port_open() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], MONGO_PORT));

    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn owned_mongodb_is_running(state: &MongoState) -> bool {
    let Ok(mut child_guard) = state.child.lock() else {
        return false;
    };

    let Some(child) = child_guard.as_mut() else {
        return false;
    };

    match child.try_wait() {
        Ok(Some(_)) => {
            *child_guard = None;
            false
        }
        Ok(None) => true,
        Err(_) => false,
    }
}

fn find_mongodb_port_process() -> Option<PortProcess> {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "try {{ $c = Get-NetTCPConnection -LocalPort {MONGO_PORT} -EA SilentlyContinue | Select-Object -First 1; if ($c) {{ $p = Get-Process -Id $c.OwningProcess -EA SilentlyContinue; $name = if ($p) {{ $p.Name }} else {{ 'Unknown' }}; Write-Output \"$($c.OwningProcess)|$name\" }} }} catch {{ }}"
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let (pid, name) = text.trim().split_once('|')?;

        Some(PortProcess {
            pid: pid.parse().ok()?,
            name: name.trim().to_string(),
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

fn terminate_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .status()
            .map_err(format_error)?;

        if status.success() {
            Ok(())
        } else {
            Err(format!("Could not terminate process {pid}"))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(format!("Terminating process {pid} is only supported on Windows"))
    }
}

fn wait_for_mongodb() -> Result<(), String> {
    let started_at = Instant::now();

    while started_at.elapsed() < Duration::from_secs(8) {
        if is_mongodb_port_open() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(150));
    }

    Err(format!(
        "MongoDB did not start on {MONGO_HOST}:{MONGO_PORT} before the timeout"
    ))
}

fn stop_owned_mongodb(state: &MongoState) {
    let Ok(mut child_guard) = state.child.lock() else {
        return;
    };

    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn ensure_mongodb_started(app: &AppHandle, state: &MongoState) -> Result<(), String> {
    if is_mongodb_port_open() {
        if owned_mongodb_is_running(state) {
            return Ok(());
        }

        if let Some(process) = find_mongodb_port_process() {
            return Err(format!(
                "Port {MONGO_PORT} is already in use by {} (PID {}).",
                process.name, process.pid
            ));
        }

        return Err(format!("Port {MONGO_PORT} is already in use."));
    }

    {
        let mut child_guard = state.child.lock().map_err(format_error)?;

        if let Some(child) = child_guard.as_mut() {
            match child.try_wait().map_err(format_error)? {
                Some(status) => {
                    *child_guard = None;
                    return Err(format!("MongoDB exited before it was ready: {status}"));
                }
                None => return wait_for_mongodb(),
            }
        }
    }

    let config = read_config()?;
    let db_path = configured_db_path(&config)
        .ok_or_else(|| "MongoDB database folder has not been configured".to_string())?;

    fs::create_dir_all(&db_path).map_err(format_error)?;

    let log_path = db_path.join("mongod.log");
    let mut command = Command::new(mongod_binary_path(app)?);
    command
        .arg("--dbpath")
        .arg(&db_path)
        .arg("--bind_ip")
        .arg(MONGO_HOST)
        .arg("--port")
        .arg(MONGO_PORT.to_string())
        .arg("--logpath")
        .arg(log_path)
        .arg("--logappend")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let child = command.spawn().map_err(format_error)?;

    {
        let mut child_guard = state.child.lock().map_err(format_error)?;
        *child_guard = Some(child);
    }

    wait_for_mongodb()
}

fn inventory_database() -> Result<mongodb::sync::Database, String> {
    let client = Client::with_uri_str(MONGO_DRIVER_URI).map_err(format_error)?;

    Ok(client.database(DATABASE_NAME))
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn normalize_name(value: &str) -> Result<String, String> {
    let normalized = value
        .split_whitespace()
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => {
                    let head = first.to_uppercase().collect::<String>();
                    let tail = chars.as_str().to_lowercase();
                    format!("{head}{tail}")
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    if normalized.is_empty() {
        Err("Name is required".to_string())
    } else {
        Ok(normalized)
    }
}

fn normalize_preference_name(value: &str) -> Result<String, String> {
    let name = value.trim();

    if name.is_empty() {
        Err("Preference name is required".to_string())
    } else {
        Ok(name.to_string())
    }
}

fn parse_object_id(id: &str, label: &str) -> Result<ObjectId, String> {
    ObjectId::parse_str(id).map_err(|_| format!("Invalid {label} id"))
}

fn collection(name: &str) -> Result<mongodb::sync::Collection<Document>, String> {
    Ok(inventory_database()?.collection::<Document>(name))
}

fn document_id(document: &Document) -> Result<String, String> {
    document
        .get_object_id("_id")
        .map(|id| id.to_hex())
        .map_err(format_error)
}

fn named_entity_from_document(document: Document) -> Result<NamedEntity, String> {
    Ok(NamedEntity {
        id: document_id(&document)?,
        name: document.get_str("name").map_err(format_error)?.to_string(),
    })
}

fn preference_from_document(document: Document) -> Result<Preference, String> {
    Ok(Preference {
        id: document_id(&document)?,
        name: document.get_str("name").map_err(format_error)?.to_string(),
        value: document.get_str("value").map_err(format_error)?.to_string(),
    })
}

fn find_named_entity(collection_name: &str, id: ObjectId) -> Result<NamedEntity, String> {
    let document = collection(collection_name)?
        .find_one(doc! { "_id": id }, None)
        .map_err(format_error)?
        .ok_or_else(|| format!("Referenced {collection_name} item was not found"))?;

    named_entity_from_document(document)
}

fn list_named_entities(collection_name: &str) -> Result<Vec<NamedEntity>, String> {
    let cursor = collection(collection_name)?
        .find(doc! {}, FindOptions::builder().sort(doc! { "name": 1 }).build())
        .map_err(format_error)?;
    let mut items = Vec::new();

    for result in cursor {
        items.push(named_entity_from_document(result.map_err(format_error)?)?);
    }

    Ok(items)
}

fn create_named_entity(collection_name: &str, input: NamedEntityDto) -> Result<NamedEntity, String> {
    let normalized_name = normalize_preference_name(&input.name)?;
    let items = collection(collection_name)?;

    if items
        .find_one(doc! { "name": &normalized_name }, None)
        .map_err(format_error)?
        .is_some()
    {
        return Err(format!("{normalized_name} already exists"));
    }

    let inserted = items
        .insert_one(doc! { "name": &normalized_name }, None)
        .map_err(format_error)?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| "MongoDB did not return an inserted id".to_string())?;

    Ok(NamedEntity {
        id: id.to_hex(),
        name: normalized_name,
    })
}

fn update_named_entity(
    collection_name: &str,
    id: String,
    input: NamedEntityDto,
) -> Result<NamedEntity, String> {
    let object_id = parse_object_id(&id, collection_name)?;
    let normalized_name = normalize_name(&input.name)?;
    let items = collection(collection_name)?;

    if items
        .find_one(doc! { "name": &normalized_name, "_id": { "$ne": object_id } }, None)
        .map_err(format_error)?
        .is_some()
    {
        return Err(format!("{normalized_name} already exists"));
    }

    let result: UpdateResult = items
        .update_one(
            doc! { "_id": object_id },
            doc! { "$set": { "name": &normalized_name } },
            None,
        )
        .map_err(format_error)?;

    if result.matched_count == 0 {
        return Err(format!("Item with id {id} was not found"));
    }

    Ok(NamedEntity {
        id,
        name: normalized_name,
    })
}

fn delete_document(collection_name: &str, id: String) -> Result<String, String> {
    let object_id = parse_object_id(&id, collection_name)?;
    let result: DeleteResult = collection(collection_name)?
        .delete_one(doc! { "_id": object_id }, None)
        .map_err(format_error)?;

    if result.deleted_count == 0 {
        Err(format!("Item with id {id} was not found"))
    } else {
        Ok(id)
    }
}

fn data_entry_document(input: DataEntryDto, created_at: Option<String>) -> Result<Document, String> {
    if !matches!(input.shift.as_str(), "Day" | "Night") {
        return Err("Shift must be Day or Night".to_string());
    }
    if input.inspector_name.trim().is_empty() {
        return Err("Inspector name is required".to_string());
    }
    if input.lot_number.trim().is_empty() {
        return Err("Lot number is required".to_string());
    }
    if input.number_of_parts < 0 {
        return Err("Number of parts cannot be negative".to_string());
    }

    let part_id = parse_object_id(&input.part, "part")?;
    let mut rejection_documents = Vec::new();
    let mut total_rejections = 0;

    for item in input.rejections {
        if item.number_of_rejections < 0 {
            return Err("Number of rejections cannot be negative".to_string());
        }

        total_rejections += item.number_of_rejections;
        rejection_documents.push(Bson::Document(doc! {
            "reason": parse_object_id(&item.reason, "rejection")?,
            "numberOfRejections": item.number_of_rejections,
        }));
    }

    let now = now_iso();
    let mut document = doc! {
        "date": input.date,
        "shift": input.shift,
        "inspectorName": input.inspector_name.trim(),
        "part": part_id,
        "numberOfParts": input.number_of_parts,
        "rejections": rejection_documents,
        "totalRejections": total_rejections,
        "lotNumber": input.lot_number.trim(),
        "updatedAt": &now,
    };

    if let Some(created_at) = created_at {
        document.insert("createdAt", created_at);
    } else {
        document.insert("createdAt", now);
    }

    Ok(document)
}

fn object_id_from_bson(value: Option<&Bson>, label: &str) -> Result<ObjectId, String> {
    match value {
        Some(Bson::ObjectId(id)) => Ok(*id),
        Some(Bson::String(id)) => parse_object_id(id, label),
        _ => Err(format!("Missing {label} id")),
    }
}

fn i64_from_document(document: &Document, key: &str) -> i64 {
    document
        .get_i64(key)
        .or_else(|_| document.get_i32(key).map(i64::from))
        .unwrap_or_default()
}

fn string_from_document(document: &Document, key: &str) -> String {
    document.get_str(key).unwrap_or_default().to_string()
}

fn data_entry_from_document(document: Document) -> Result<DataEntry, String> {
    let part = find_named_entity(PARTS_COLLECTION, object_id_from_bson(document.get("part"), "part")?)?;
    let mut rejections = Vec::new();

    if let Ok(items) = document.get_array("rejections") {
        for item in items {
            if let Bson::Document(rejection_document) = item {
                let reason = find_named_entity(
                    REJECTIONS_COLLECTION,
                    object_id_from_bson(rejection_document.get("reason"), "rejection")?,
                )?;
                rejections.push(RejectionDetail {
                    id: reason.id.clone(),
                    reason,
                    number_of_rejections: i64_from_document(
                        rejection_document,
                        "numberOfRejections",
                    ),
                });
            }
        }
    }

    Ok(DataEntry {
        id: document_id(&document)?,
        date: string_from_document(&document, "date"),
        shift: string_from_document(&document, "shift"),
        inspector_name: string_from_document(&document, "inspectorName"),
        part,
        number_of_parts: i64_from_document(&document, "numberOfParts"),
        rejections,
        total_rejections: i64_from_document(&document, "totalRejections"),
        lot_number: string_from_document(&document, "lotNumber"),
        created_at: document.get_str("createdAt").ok().map(str::to_string),
        updated_at: document.get_str("updatedAt").ok().map(str::to_string),
    })
}

fn list_data_entries_with_filter(filter: Option<DataEntryFilter>) -> Result<Vec<DataEntry>, String> {
    let filter = filter.unwrap_or_default();
    let mut query = Document::new();

    if filter.all_parts.as_deref() != Some("true") {
        if let Some(part_name) = filter.part_name.filter(|value| !value.trim().is_empty()) {
            let names = part_name
                .split(',')
                .map(|name| normalize_name(name))
                .collect::<Result<Vec<_>, _>>()?;
            let part_cursor = collection(PARTS_COLLECTION)?
                .find(doc! { "name": { "$in": names } }, None)
                .map_err(format_error)?;
            let mut ids = Vec::new();

            for result in part_cursor {
                ids.push(Bson::ObjectId(result.map_err(format_error)?.get_object_id("_id").map_err(format_error)?));
            }

            if ids.is_empty() {
                return Ok(Vec::new());
            }

            query.insert("part", doc! { "$in": ids });
        }
    }

    if filter.start_date.is_some() || filter.end_date.is_some() {
        let mut date_query = Document::new();
        if let Some(start_date) = filter.start_date.filter(|value| !value.trim().is_empty()) {
            date_query.insert("$gte", start_date);
        }
        if let Some(end_date) = filter.end_date.filter(|value| !value.trim().is_empty()) {
            date_query.insert("$lte", end_date);
        }
        query.insert("date", date_query);
    }

    if filter.load_number_start.is_some() || filter.load_number_end.is_some() {
        let mut lot_query = Document::new();
        if let Some(start) = filter.load_number_start.filter(|value| !value.trim().is_empty()) {
            lot_query.insert("$gte", start);
        }
        if let Some(end) = filter.load_number_end.filter(|value| !value.trim().is_empty()) {
            lot_query.insert("$lte", end);
        }
        query.insert("lotNumber", lot_query);
    }

    if let Some(inspector_name) = filter.inspector_name.filter(|value| !value.trim().is_empty()) {
        query.insert(
            "inspectorName",
            doc! { "$regex": inspector_name, "$options": "i" },
        );
    }

    let cursor = collection(DATA_ENTRIES_COLLECTION)?
        .find(query, FindOptions::builder().sort(doc! { "date": -1 }).build())
        .map_err(format_error)?;
    let mut entries = Vec::new();

    for result in cursor {
        entries.push(data_entry_from_document(result.map_err(format_error)?)?);
    }

    let min_percentage = filter
        .rejection_percentage_min
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok());
    let max_percentage = filter
        .rejection_percentage_max
        .as_deref()
        .and_then(|value| value.parse::<f64>().ok());

    if min_percentage.is_some() || max_percentage.is_some() {
        entries.retain(|entry| {
            let percentage = if entry.number_of_parts > 0 {
                (entry.total_rejections as f64 / entry.number_of_parts as f64) * 100.0
            } else {
                0.0
            };
            percentage >= min_percentage.unwrap_or(0.0) && percentage <= max_percentage.unwrap_or(100.0)
        });
    }

    Ok(entries)
}

#[tauri::command]
fn get_mongodb_status() -> Result<MongoStatus, String> {
    mongodb_status()
}

#[tauri::command]
fn get_mongodb_port_process(state: State<'_, MongoState>) -> Result<Option<PortProcess>, String> {
    if owned_mongodb_is_running(&state) || !is_mongodb_port_open() {
        return Ok(None);
    }

    Ok(find_mongodb_port_process())
}

#[tauri::command]
fn terminate_mongodb_port_process(pid: u32) -> Result<(), String> {
    terminate_process(pid)
}

#[tauri::command]
fn start_mongodb(app: AppHandle, state: State<'_, MongoState>) -> Result<MongoStatus, String> {
    ensure_mongodb_started(&app, &state)?;
    mongodb_status()
}

#[tauri::command]
fn set_mongodb_path(
    path: String,
    state: State<'_, MongoState>,
) -> Result<MongoStatus, String> {
    let trimmed_path = path.trim();

    if trimmed_path.is_empty() {
        return Err("Choose a MongoDB database folder".to_string());
    }

    let db_path = PathBuf::from(trimmed_path);

    if !db_path.is_absolute() {
        return Err("MongoDB database folder must be an absolute path".to_string());
    }

    fs::create_dir_all(&db_path).map_err(format_error)?;
    write_db_path_config(&db_path)?;
    stop_owned_mongodb(&state);

    mongodb_status()
}

#[tauri::command]
fn list_collections(app: AppHandle, state: State<'_, MongoState>) -> Result<Vec<String>, String> {
    ensure_mongodb_started(&app, &state)?;

    let database = inventory_database()?;
    let mut names = database.list_collection_names(None).map_err(format_error)?;
    names.sort_by_key(|name| name.to_lowercase());

    Ok(names)
}

#[tauri::command]
fn list_documents(
    collection: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<DocumentsResponse, String> {
    ensure_mongodb_started(&app, &state)?;

    let collection_name = collection.trim();

    if collection_name.is_empty() {
        return Err("Choose a collection".to_string());
    }

    let database = inventory_database()?;
    let find_options = FindOptions::builder().limit(DOCUMENT_LIMIT).build();
    let cursor = database
        .collection::<Document>(collection_name)
        .find(doc! {}, find_options)
        .map_err(format_error)?;
    let mut documents = Vec::new();

    for result in cursor {
        let document = result.map_err(format_error)?;
        documents.push(serde_json::to_value(document).map_err(format_error)?);
    }

    Ok(DocumentsResponse {
        documents,
        limit: DOCUMENT_LIMIT,
    })
}

#[tauri::command]
fn list_parts(app: AppHandle, state: State<'_, MongoState>) -> Result<Vec<NamedEntity>, String> {
    ensure_mongodb_started(&app, &state)?;
    list_named_entities(PARTS_COLLECTION)
}

#[tauri::command]
fn create_part(
    input: NamedEntityDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<NamedEntity, String> {
    ensure_mongodb_started(&app, &state)?;
    create_named_entity(PARTS_COLLECTION, input)
}

#[tauri::command]
fn get_part(id: String, app: AppHandle, state: State<'_, MongoState>) -> Result<NamedEntity, String> {
    ensure_mongodb_started(&app, &state)?;
    find_named_entity(PARTS_COLLECTION, parse_object_id(&id, "part")?)
}

#[tauri::command]
fn update_part(
    id: String,
    input: NamedEntityDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<NamedEntity, String> {
    ensure_mongodb_started(&app, &state)?;
    update_named_entity(PARTS_COLLECTION, id, input)
}

#[tauri::command]
fn delete_part(id: String, app: AppHandle, state: State<'_, MongoState>) -> Result<String, String> {
    ensure_mongodb_started(&app, &state)?;
    delete_document(PARTS_COLLECTION, id)
}

#[tauri::command]
fn list_rejections(app: AppHandle, state: State<'_, MongoState>) -> Result<Vec<NamedEntity>, String> {
    ensure_mongodb_started(&app, &state)?;
    list_named_entities(REJECTIONS_COLLECTION)
}

#[tauri::command]
fn create_rejection(
    input: NamedEntityDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<NamedEntity, String> {
    ensure_mongodb_started(&app, &state)?;
    create_named_entity(REJECTIONS_COLLECTION, input)
}

#[tauri::command]
fn get_rejection(
    id: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<NamedEntity, String> {
    ensure_mongodb_started(&app, &state)?;
    find_named_entity(REJECTIONS_COLLECTION, parse_object_id(&id, "rejection")?)
}

#[tauri::command]
fn update_rejection(
    id: String,
    input: NamedEntityDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<NamedEntity, String> {
    ensure_mongodb_started(&app, &state)?;
    update_named_entity(REJECTIONS_COLLECTION, id, input)
}

#[tauri::command]
fn delete_rejection(
    id: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<String, String> {
    ensure_mongodb_started(&app, &state)?;
    delete_document(REJECTIONS_COLLECTION, id)
}

#[tauri::command]
fn list_preferences(app: AppHandle, state: State<'_, MongoState>) -> Result<Vec<Preference>, String> {
    ensure_mongodb_started(&app, &state)?;
    let cursor = collection(PREFERENCES_COLLECTION)?
        .find(doc! {}, FindOptions::builder().sort(doc! { "name": 1 }).build())
        .map_err(format_error)?;
    let mut preferences = Vec::new();

    for result in cursor {
        preferences.push(preference_from_document(result.map_err(format_error)?)?);
    }

    Ok(preferences)
}

#[tauri::command]
fn create_preference(
    input: PreferenceDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<Preference, String> {
    ensure_mongodb_started(&app, &state)?;
    let normalized_name = normalize_name(&input.name)?;
    if input.value.trim().is_empty() {
        return Err("Preference value is required".to_string());
    }

    let preferences = collection(PREFERENCES_COLLECTION)?;
    if preferences
        .find_one(doc! { "name": &normalized_name }, None)
        .map_err(format_error)?
        .is_some()
    {
        return Err(format!("{normalized_name} already exists"));
    }

    let inserted = preferences
        .insert_one(doc! { "name": &normalized_name, "value": input.value.trim() }, None)
        .map_err(format_error)?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| "MongoDB did not return an inserted id".to_string())?;

    Ok(Preference {
        id: id.to_hex(),
        name: normalized_name,
        value: input.value.trim().to_string(),
    })
}

#[tauri::command]
fn get_preference(
    name: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<Preference, String> {
    ensure_mongodb_started(&app, &state)?;
    let normalized_name = normalize_preference_name(&name)?;
    let document = collection(PREFERENCES_COLLECTION)?
        .find_one(doc! { "name": normalized_name }, None)
        .map_err(format_error)?
        .ok_or_else(|| format!("Preference {name} was not found"))?;

    preference_from_document(document)
}

#[tauri::command]
fn update_preference(
    name: String,
    value: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<Preference, String> {
    ensure_mongodb_started(&app, &state)?;
    let normalized_name = normalize_preference_name(&name)?;
    if value.trim().is_empty() {
        return Err("Preference value is required".to_string());
    }

    let preferences = collection(PREFERENCES_COLLECTION)?;
    let result = preferences
        .update_one(
            doc! { "name": &normalized_name },
            doc! { "$set": { "value": value.trim() } },
            None,
        )
        .map_err(format_error)?;

    if result.matched_count == 0 {
        return Err(format!("Preference {name} was not found"));
    }

    let document = preferences
        .find_one(doc! { "name": normalized_name }, None)
        .map_err(format_error)?
        .ok_or_else(|| format!("Preference {name} was not found"))?;

    preference_from_document(document)
}

#[tauri::command]
fn delete_preference(
    name: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<String, String> {
    ensure_mongodb_started(&app, &state)?;
    let normalized_name = normalize_preference_name(&name)?;
    let result = collection(PREFERENCES_COLLECTION)?
        .delete_one(doc! { "name": &normalized_name }, None)
        .map_err(format_error)?;

    if result.deleted_count == 0 {
        Err(format!("Preference {name} was not found"))
    } else {
        Ok(normalized_name)
    }
}

#[tauri::command]
fn list_data_entries(app: AppHandle, state: State<'_, MongoState>) -> Result<Vec<DataEntry>, String> {
    ensure_mongodb_started(&app, &state)?;
    list_data_entries_with_filter(None)
}

#[tauri::command]
fn filter_data_entries(
    filter: DataEntryFilter,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<Vec<DataEntry>, String> {
    ensure_mongodb_started(&app, &state)?;
    list_data_entries_with_filter(Some(filter))
}

#[tauri::command]
fn create_data_entry(
    input: DataEntryDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<DataEntry, String> {
    ensure_mongodb_started(&app, &state)?;
    let document = data_entry_document(input, None)?;
    let entries = collection(DATA_ENTRIES_COLLECTION)?;
    let inserted = entries.insert_one(document, None).map_err(format_error)?;
    let object_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| "MongoDB did not return an inserted id".to_string())?;
    let saved = entries
        .find_one(doc! { "_id": object_id }, None)
        .map_err(format_error)?
        .ok_or_else(|| "Created data entry was not found".to_string())?;

    data_entry_from_document(saved)
}

#[tauri::command]
fn get_data_entry(id: String, app: AppHandle, state: State<'_, MongoState>) -> Result<DataEntry, String> {
    ensure_mongodb_started(&app, &state)?;
    let object_id = parse_object_id(&id, "data entry")?;
    let document = collection(DATA_ENTRIES_COLLECTION)?
        .find_one(doc! { "_id": object_id }, None)
        .map_err(format_error)?
        .ok_or_else(|| format!("Data entry with id {id} was not found"))?;

    data_entry_from_document(document)
}

#[tauri::command]
fn update_data_entry(
    id: String,
    input: DataEntryDto,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<DataEntry, String> {
    ensure_mongodb_started(&app, &state)?;
    let object_id = parse_object_id(&id, "data entry")?;
    let entries = collection(DATA_ENTRIES_COLLECTION)?;
    let existing = entries
        .find_one(doc! { "_id": object_id }, None)
        .map_err(format_error)?
        .ok_or_else(|| format!("Data entry with id {id} was not found"))?;
    let created_at = existing.get_str("createdAt").ok().map(str::to_string);
    let mut replacement = data_entry_document(input, created_at)?;
    replacement.insert("_id", object_id);

    entries
        .replace_one(doc! { "_id": object_id }, replacement, None)
        .map_err(format_error)?;

    get_data_entry(id, app, state)
}

#[tauri::command]
fn delete_data_entry(
    id: String,
    app: AppHandle,
    state: State<'_, MongoState>,
) -> Result<String, String> {
    ensure_mongodb_started(&app, &state)?;
    delete_document(DATA_ENTRIES_COLLECTION, id)
}

#[tauri::command]
fn save_report_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let trimmed_path = path.trim();

    if trimmed_path.is_empty() {
        return Err("Choose a file path".to_string());
    }

    fs::write(trimmed_path, bytes).map_err(format_error)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MongoState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_mongodb_status,
            get_mongodb_port_process,
            terminate_mongodb_port_process,
            start_mongodb,
            set_mongodb_path,
            list_collections,
            list_documents,
            list_parts,
            create_part,
            get_part,
            update_part,
            delete_part,
            list_rejections,
            create_rejection,
            get_rejection,
            update_rejection,
            delete_rejection,
            list_preferences,
            create_preference,
            get_preference,
            update_preference,
            delete_preference,
            list_data_entries,
            filter_data_entries,
            create_data_entry,
            get_data_entry,
            update_data_entry,
            delete_data_entry,
            save_report_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<MongoState>();
                stop_owned_mongodb(&state);
            }
        });
}
