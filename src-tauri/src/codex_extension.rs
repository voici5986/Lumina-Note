use crate::error::AppError;
use serde::Serialize;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExtensionStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub extension_path: Option<String>,
    pub latest_version: Option<String>,
}

#[derive(Debug, Serialize)]
struct CurrentVersionFile {
    version: String,
}

fn codex_openai_chatgpt_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::InvalidPath(format!("Failed to get app_data_dir: {}", e)))?
        .join("codex")
        .join("extensions")
        .join("openai.chatgpt");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn current_version_path(base: &Path) -> PathBuf {
    base.join("current.json")
}

fn version_dir(base: &Path, version: &str) -> PathBuf {
    base.join("versions").join(version)
}

fn extension_path_for_version(base: &Path, version: &str) -> PathBuf {
    version_dir(base, version).join("extension")
}

fn read_current_version(base: &Path) -> Option<String> {
    let p = current_version_path(base);
    let data = std::fs::read_to_string(p).ok()?;
    let v: serde_json::Value = serde_json::from_str(&data).ok()?;
    v.get("version")?.as_str().map(|s| s.to_string())
}

fn write_current_version(base: &Path, version: &str) -> Result<(), AppError> {
    let p = current_version_path(base);
    let payload = CurrentVersionFile {
        version: version.to_string(),
    };
    std::fs::write(p, serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".into()))?;
    Ok(())
}

async fn marketplace_latest_openai_chatgpt() -> Result<(String, String), AppError> {
    let url = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1";
    let body = json!({
      "filters": [
        { "criteria": [ { "filterType": 7, "value": "openai.chatgpt" } ] }
      ],
      "flags": 103
    });

    let client = reqwest::Client::new();
    let resp = client.post(url).json(&body).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::Network(format!(
            "Marketplace extensionquery failed: {}",
            resp.status()
        )));
    }
    let v: serde_json::Value = resp.json().await?;

    let ext = v
        .get("results")
        .and_then(|x| x.get(0))
        .and_then(|x| x.get("extensions"))
        .and_then(|x| x.get(0))
        .ok_or_else(|| AppError::InvalidPath("Marketplace response missing extensions[0]".into()))?;

    let versions = ext
        .get("versions")
        .and_then(|x| x.as_array())
        .ok_or_else(|| AppError::InvalidPath("Marketplace response missing versions".into()))?;
    let latest = versions
        .get(0)
        .ok_or_else(|| AppError::InvalidPath("Marketplace response versions empty".into()))?;

    let version = latest
        .get("version")
        .and_then(|x| x.as_str())
        .ok_or_else(|| AppError::InvalidPath("Marketplace response missing version".into()))?
        .to_string();

    let files = latest
        .get("files")
        .and_then(|x| x.as_array())
        .ok_or_else(|| AppError::InvalidPath("Marketplace response missing files".into()))?;
    let vsix_url = files
        .iter()
        .find(|f| {
            f.get("assetType")
                .and_then(|x| x.as_str())
                == Some("Microsoft.VisualStudio.Services.VSIXPackage")
        })
        .and_then(|f| f.get("source"))
        .and_then(|x| x.as_str())
        .ok_or_else(|| AppError::InvalidPath("Marketplace response missing VSIX download url".into()))?
        .to_string();

    Ok((version, vsix_url))
}

fn extract_vsix(vsix_path: &Path, out_dir: &Path) -> Result<(), AppError> {
    // Prefer `tar` (Windows 11 ships bsdtar that can extract zip/VSIX).
    let tar = Command::new("tar")
        .arg("-xf")
        .arg(vsix_path)
        .arg("-C")
        .arg(out_dir)
        .status();

    let mut ok = tar.map(|s| s.success()).unwrap_or(false);

    // Fallback for Windows if `tar` is unavailable.
    #[cfg(target_os = "windows")]
    if !ok {
        let cmd = format!(
            "Expand-Archive -LiteralPath '{}' -DestinationPath '{}' -Force",
            vsix_path.display(),
            out_dir.display()
        );
        ok = Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(cmd)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
    }

    // Fallback for Unix-like systems.
    #[cfg(not(target_os = "windows"))]
    if !ok {
        ok = Command::new("unzip")
            .arg("-qq")
            .arg("-o")
            .arg(vsix_path)
            .arg("-d")
            .arg(out_dir)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
    }

    if !ok {
        return Err(AppError::InvalidPath(
            "Failed to extract VSIX (tar/unzip/Expand-Archive)".into(),
        ));
    }

    let pkg = out_dir.join("extension").join("package.json");
    if !pkg.exists() {
        return Err(AppError::InvalidPath(
            "VSIX extracted but extension/package.json not found".into(),
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn codex_extension_get_status(app: AppHandle) -> Result<CodexExtensionStatus, AppError> {
    let base = codex_openai_chatgpt_dir(&app)?;
    let version = read_current_version(&base);
    let extension_path = version
        .as_deref()
        .map(|v| extension_path_for_version(&base, v))
        .map(|p| p.to_string_lossy().to_string());
    let installed = extension_path
        .as_deref()
        .map(|p| Path::new(p).join("package.json").exists())
        .unwrap_or(false);

    let latest_version = match marketplace_latest_openai_chatgpt().await {
        Ok((v, _)) => Some(v),
        Err(_) => None,
    };

    Ok(CodexExtensionStatus {
        installed,
        version,
        extension_path: if installed { extension_path } else { None },
        latest_version,
    })
}

#[tauri::command]
pub async fn codex_extension_install_latest(app: AppHandle) -> Result<CodexExtensionStatus, AppError> {
    let base = codex_openai_chatgpt_dir(&app)?;
    let (version, vsix_url) = marketplace_latest_openai_chatgpt().await?;

    let downloads = base.join("downloads");
    tokio::fs::create_dir_all(&downloads).await?;
    let vsix_path = downloads.join(format!("openai.chatgpt-{}.vsix", version));

    let client = reqwest::Client::new();
    let resp = client.get(vsix_url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::Network(format!(
            "VSIX download failed: {}",
            resp.status()
        )));
    }
    let bytes = resp.bytes().await?;
    tokio::fs::write(&vsix_path, bytes).await?;

    let out_dir = version_dir(&base, &version);
    tokio::fs::create_dir_all(&out_dir).await?;

    let vsix_path_cloned = vsix_path.clone();
    let out_dir_cloned = out_dir.clone();
    tokio::task::spawn_blocking(move || extract_vsix(&vsix_path_cloned, &out_dir_cloned))
        .await
        .map_err(|e| AppError::InvalidPath(format!("VSIX extract task failed: {}", e)))??;

    write_current_version(&base, &version)?;

    Ok(CodexExtensionStatus {
        installed: true,
        version: Some(version.clone()),
        extension_path: Some(extension_path_for_version(&base, &version).to_string_lossy().to_string()),
        latest_version: Some(version),
    })
}
