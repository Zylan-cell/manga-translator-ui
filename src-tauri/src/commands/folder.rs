use crate::commands::ImageInfo;
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use tauri::command;
use rfd::FileDialog;

#[command]
pub async fn import_folder() -> Result<Vec<ImageInfo>, String> {
    let dialog = FileDialog::new()
        .set_title("Select folder with images")
        .pick_folder();

    match dialog {
        Some(folder) => {
            let mut images = Vec::new();
            
            for entry in fs::read_dir(folder).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let path = entry.path();
                
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        let ext_str = ext.to_string_lossy().to_lowercase();
                        if ext_str == "png" || ext_str == "jpg" || ext_str == "jpeg" {
                            let bytes = fs::read(&path).map_err(|e| e.to_string())?;
                            let base64 = general_purpose::STANDARD.encode(&bytes);
                            let data_url = format!("data:image/{};base64,{}", ext_str, base64);
                            
                            // Create thumbnail (упрощенная версия без обработки изображения)
                            let thumb_data_url = data_url.clone();
                            
                            images.push(ImageInfo {
                                name: path.file_name().unwrap().to_str().unwrap().to_string(),
                                path: path.to_str().unwrap().to_string(),
                                data_url,
                                thumbnail: thumb_data_url,
                            });
                        }
                    }
                }
            }
            
            // Sort images by name
            images.sort_by(|a, b| a.name.cmp(&b.name));
            
            Ok(images)
        }
        None => Ok(Vec::new()),
    }
}