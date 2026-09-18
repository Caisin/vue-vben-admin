mod protocol;
mod queue;
mod scan;
mod session;
use session::{Bootstrap, Desktop, Session};
use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
type Native<'a> = State<'a, Arc<Desktop>>;
type Reply<T> = Result<T, String>;
fn error(e: anyhow::Error) -> String {
    e.to_string()
}
#[tauri::command]
async fn desktop_bootstrap(state: Native<'_>) -> Reply<Bootstrap> {
    state.bootstrap().await.map_err(error)
}
#[tauri::command]
async fn desktop_configure(
    app: tauri::AppHandle,
    state: Native<'_>,
    api_base: String,
) -> Reply<()> {
    state.configure(&app, api_base).await.map_err(error)
}
#[tauri::command]
async fn desktop_import_session(
    app: tauri::AppHandle,
    state: Native<'_>,
    token: String,
) -> Reply<Session> {
    state.import(&app, token).await.map_err(error)
}
#[tauri::command]
async fn desktop_refresh_session(
    app: tauri::AppHandle,
    state: Native<'_>,
    expected: Option<String>,
) -> Reply<Session> {
    state.refresh(&app, expected).await.map_err(error)
}
#[tauri::command]
async fn desktop_clear_session(app: tauri::AppHandle, state: Native<'_>) -> Reply<()> {
    state.clear(&app).await.map_err(error)
}
#[tauri::command]
async fn desktop_jobs(state: Native<'_>) -> Reply<Vec<serde_json::Value>> {
    state.jobs().await.map_err(error)
}
#[tauri::command]
async fn desktop_pause(app: tauri::AppHandle, state: Native<'_>, id: String) -> Reply<()> {
    state.pause(&app, &id).await.map_err(error)
}
#[tauri::command]
async fn desktop_start(
    app: tauri::AppHandle,
    state: Native<'_>,
    id: String,
    edits: Vec<queue::Edit>,
    concurrency: Option<usize>,
) -> Reply<()> {
    state
        .inner()
        .start(app, id, edits, concurrency.unwrap_or(3))
        .await
        .map_err(error)
}
#[tauri::command]
async fn desktop_scan(
    app: tauri::AppHandle,
    state: Native<'_>,
    res: String,
    version: String,
    storage: String,
    local_storage: bool,
    version_name: String,
) -> Reply<Option<serde_json::Value>> {
    if ![&res, &version]
        .iter()
        .all(|v| v.parse::<i64>().is_ok_and(|n| n > 0))
        || storage.is_empty()
        || !storage
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err("资源、版本或存储编号无效".into());
    }
    let identity = state.identity().await.map_err(error)?;
    let dialog = app.dialog().file().set_title("选择当前版本的视频目录");
    let selected = tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_folder())
        .await
        .map_err(|_| "无法打开目录选择器")?;
    let Some(selected) = selected else {
        return Ok(None);
    };
    let root = selected
        .into_path()
        .map_err(|_| "目录路径无效")?
        .canonicalize()
        .map_err(|_| "无法读取目录")?;
    let scan_root = root.clone();
    let items = tauri::async_runtime::spawn_blocking(move || scan::scan(&scan_root))
        .await
        .map_err(|_| "扫描失败")?
        .map_err(error)?;
    let current = state.identity().await.map_err(error)?;
    if current.uid != identity.uid || current.api_base != identity.api_base {
        return Err("扫描期间登录身份发生变化".into());
    }
    let job = queue::Job {
        timing: Default::default(),
        concurrency: 3,
        version_name,
        id: uuid::Uuid::new_v4().to_string(),
        api_base: identity.api_base,
        uid: identity.uid,
        res,
        version,
        storage,
        local_storage,
        name: root
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        root,
        status: "待确认".into(),
        error: String::new(),
        items,
        import_id: None,
    };
    state.add(&app, job).await.map(Some).map_err(error)
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let desktop = Desktop::new(app.path().app_data_dir()?)?;
            app.manage(desktop.clone());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(20)).await;
                    desktop.tick(&handle).await;
                }
            });
            let show =
                tauri::menu::MenuItem::with_id(app, "show", "打开 KX ADM", true, None::<&str>)?;
            let quit = tauri::menu::MenuItem::with_id(
                app,
                "quit",
                "退出（暂停本地上传）",
                true,
                None::<&str>,
            )?;
            let menu = tauri::menu::Menu::with_items(app, &[&show, &quit])?;
            let mut tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("KX ADM · 目录上传后台运行")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            desktop_bootstrap,
            desktop_configure,
            desktop_import_session,
            desktop_refresh_session,
            desktop_clear_session,
            desktop_jobs,
            desktop_scan,
            desktop_start,
            desktop_pause
        ])
        .run(tauri::generate_context!())
        .expect("桌面应用启动失败");
}
