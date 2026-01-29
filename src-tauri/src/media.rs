use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{plugin::Builder, plugin::PluginHandle, AppHandle, Runtime};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_media_export);

pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    Builder::new("media")
        .invoke_handler(tauri::generate_handler![export_recording_to_mp4])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api
                    .register_android_plugin("com.jacobrunge.teleprompter", "MediaExportPlugin")?;
                app.manage(MediaPlugin(handle));
            }
            #[cfg(target_os = "ios")]
            {
                let handle = api.register_ios_plugin(init_plugin_media_export)?;
                app.manage(MediaPlugin(handle));
            }
            Ok(())
        })
        .build()
}

#[derive(Clone)]
struct MediaPlugin<R: Runtime>(PluginHandle<R>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportRequest {
    input_path: String,
    output_path: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportResponse {
    output_path: String,
}

#[tauri::command]
async fn export_recording_to_mp4<R: Runtime>(
    app: AppHandle<R>,
    input_path: String,
    output_file_name: Option<String>,
) -> Result<ExportResponse, String> {
    if !cfg!(mobile) {
        return Err("Mobile export is only available on iOS/Android.".into());
    }

    let base_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let input_full = base_dir.join(&input_path);

    let default_name = Path::new(&input_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| format!("{s}.mp4"))
        .unwrap_or_else(|| "export.mp4".to_string());

    let output_relative = match output_file_name {
        Some(name) if name.ends_with(".mp4") => name,
        Some(name) => format!("{name}.mp4"),
        None => default_name,
    };

    let output_full = base_dir.join(&output_relative);
    if let Some(parent) = output_full.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    #[cfg(mobile)]
    {
        let media = app.state::<MediaPlugin<R>>();
        let response = media
            .0
            .run_mobile_plugin_async(
                "exportRecording",
                ExportRequest {
                    input_path: input_full.to_string_lossy().to_string(),
                    output_path: output_full.to_string_lossy().to_string(),
                },
            )
            .await
            .map_err(|err| err.to_string())?;
        return Ok(response);
    }

    #[cfg(not(mobile))]
    {
        Err("Mobile export is only available on iOS/Android.".into())
    }
}
