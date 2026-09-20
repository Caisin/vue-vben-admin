mod image;
mod protocol;
mod queue;
mod scan;
mod session;
mod tiktok;
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
fn desktop_image_env_status(window: tauri::WebviewWindow) -> Reply<image::ImageEnvStatus> {
    tiktok::local_caller(&window).map_err(error)?;
    Ok(image::env_status())
}
#[tauri::command]
fn desktop_image_set_env(
    window: tauri::WebviewWindow,
    key: String,
) -> Reply<image::ImageEnvStatus> {
    tiktok::local_caller(&window).map_err(error)?;
    image::set_env(&key).map_err(error)
}
#[tauri::command]
async fn desktop_bootstrap(state: Native<'_>, api_base: Option<String>) -> Reply<Bootstrap> {
    state.bootstrap_with_default(api_base).await.map_err(error)
}
#[tauri::command]
async fn desktop_configure(
    app: tauri::AppHandle,
    state: Native<'_>,
    tiktok: State<'_, Arc<tiktok::TikTok>>,
    api_base: String,
) -> Reply<()> {
    tiktok.pause();
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
async fn desktop_restore_session(
    app: tauri::AppHandle,
    state: Native<'_>,
    token: String,
    api_base: String,
    expected_generation: u64,
) -> Reply<Session> {
    state
        .restore(&app, token, api_base, expected_generation)
        .await
        .map_err(error)
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
async fn desktop_clear_session(
    app: tauri::AppHandle,
    state: Native<'_>,
    tiktok: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<()> {
    tiktok.pause();
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
    expected_revision: Option<u64>,
) -> Reply<()> {
    state
        .inner()
        .start(app, id, edits, concurrency.unwrap_or(3), expected_revision)
        .await
        .map_err(error)
}
#[tauri::command]
async fn desktop_update_job(
    app: tauri::AppHandle,
    state: Native<'_>,
    id: String,
    update: queue::JobUpdate,
) -> Reply<serde_json::Value> {
    state.update_job(&app, &id, update).await.map_err(error)
}
#[tauri::command]
async fn desktop_remove_job(state: Native<'_>, id: String, expected_revision: u64) -> Reply<()> {
    state
        .remove_job(&id, expected_revision)
        .await
        .map_err(error)
}
#[tauri::command]
async fn desktop_collapse_job(
    app: tauri::AppHandle,
    state: Native<'_>,
    id: String,
    collapsed: bool,
) -> Reply<serde_json::Value> {
    state
        .collapse_job(&app, &id, collapsed)
        .await
        .map_err(error)
}
#[tauri::command]
async fn desktop_rebind_job(
    app: tauri::AppHandle,
    state: Native<'_>,
    id: String,
    expected_revision: u64,
) -> Reply<serde_json::Value> {
    state
        .rebind_job(&app, &id, expected_revision)
        .await
        .map_err(error)
}
#[tauri::command]
async fn tiktok_pick_directory(
    app: tauri::AppHandle,
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<Option<tiktok::DirectorySelection>> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state.pick_directory(&app).await.map_err(error)
}
#[tauri::command]
async fn tiktok_list(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<Option<tiktok::DirectorySelection>> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    if state.ensure_owner(&key).await.is_err() {
        return Ok(None);
    }

    Ok(state.list().await)
}
#[tauri::command]
async fn tiktok_account(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<tiktok::Account> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state.account().await.map_err(error)
}
#[tauri::command]
async fn tiktok_import_cookie(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
    input: tiktok::CookieInput,
) -> Reply<tiktok::Login> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    state
        .import_cookie(
            input.cookie,
            input.user_agent,
            input.timezone,
            input.expected_account_id,
            format!("{}:{}", owner.api_base, owner.uid),
            input.activate.unwrap_or(true),
        )
        .await
        .map_err(error)
}
#[tauri::command]
async fn tiktok_preview(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, Arc<tiktok::TikTok>>,
    id: String,
    revision: u64,
) -> Reply<String> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    let path = state.preview_path(&id, revision).await.map_err(error)?;
    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|e| error(e.into()))?;
    Ok(path.to_string_lossy().into_owned())
}
#[tauri::command]
async fn tiktok_session(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<Option<tiktok::Login>> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    if state
        .ensure_owner(&format!("{}:{}", owner.api_base, owner.uid))
        .await
        .is_err()
    {
        return Ok(None);
    }
    Ok(state.login_session().await)
}
#[tauri::command]
async fn tiktok_logout(
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<()> {
    tiktok::local_caller(&window).map_err(error)?;
    state.clear_login().await.map_err(error)
}
#[tauri::command]
async fn tiktok_plan(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
    edit: tiktok::PlanEdit,
) -> Reply<tiktok::DirectorySelection> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state.plan(edit).await.map_err(error)
}
#[tauri::command]
async fn tiktok_upload(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
    file_ids: Vec<String>,
    revision: u64,
    account_id: String,
    concurrency: Option<usize>,
) -> Reply<()> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state
        .upload(file_ids, revision, account_id, concurrency.unwrap_or(3))
        .await
        .map_err(error)
}
#[tauri::command]
async fn tiktok_pause(
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
) -> Reply<()> {
    tiktok::local_caller(&window).map_err(error)?;
    state.pause();
    Ok(())
}
#[tauri::command]
async fn tiktok_remove(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
    revision: u64,
) -> Reply<()> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state.remove(revision).await.map_err(error)
}
#[tauri::command]
async fn tiktok_reset_media(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
    id: String,
    revision: u64,
) -> Reply<()> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state.reset_media(&id, revision).await.map_err(error)
}
#[tauri::command]
async fn tiktok_reconcile(
    desktop: Native<'_>,
    window: tauri::WebviewWindow,
    state: State<'_, Arc<tiktok::TikTok>>,
    id: String,
    revision: u64,
    item_id: Option<String>,
) -> Reply<()> {
    tiktok::local_caller(&window).map_err(error)?;
    let owner = desktop.identity().await.map_err(error)?;
    let key = format!("{}:{}", owner.api_base, owner.uid);
    state.ensure_owner(&key).await.map_err(error)?;

    state.reconcile(&id, revision, item_id).await.map_err(error)
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
        revision: 0,
        collapsed: true,
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
            app.manage(tiktok::TikTok::new(app.path().app_data_dir()?)?);
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
            desktop_image_env_status,
            desktop_image_set_env,
            desktop_bootstrap,
            desktop_configure,
            desktop_import_session,
            desktop_restore_session,
            desktop_refresh_session,
            desktop_clear_session,
            desktop_jobs,
            desktop_scan,
            desktop_start,
            desktop_pause,
            desktop_update_job,
            desktop_remove_job,
            desktop_collapse_job,
            desktop_rebind_job,
            tiktok_pick_directory,
            tiktok_upload,
            tiktok_list,
            tiktok_account,
            tiktok_import_cookie,
            tiktok_session,
            tiktok_preview,
            tiktok_logout,
            tiktok_plan,
            tiktok_pause,
            tiktok_remove,
            tiktok_reconcile,
            tiktok_reset_media
        ])
        .run(tauri::generate_context!())
        .expect("桌面应用启动失败");
}
