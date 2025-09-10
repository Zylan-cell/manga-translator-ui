use crate::commands::ImageInfo;
use rfd::FileDialog;
use std::fs;
use tauri::command;

#[command]
pub async fn import_images() -> Result<Vec<ImageInfo>, String> {
    let dialog = FileDialog::new()
        .set_title("Select images")
        .add_filter(
            "Images",
            &[
                "png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff", "avif", "heic", "heif",
            ],
        )
        .pick_files();

    let Some(files) = dialog else {
        return Ok(Vec::new());
    };

    let mut images = Vec::new();
    for path in files {
        if !path.is_file() {
            continue;
        }
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        let path_str = path.to_string_lossy().to_string();
        images.push(ImageInfo {
            name,
            path: path_str,
            data_url: String::new(),  // лениво грузим позже
            thumbnail: String::new(), // лениво грузим позже
        });
    }
    images.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(images)
}

#[command]
pub async fn import_folder() -> Result<Vec<ImageInfo>, String> {
    let dialog = FileDialog::new()
        .set_title("Select folder with images")
        .pick_folder();

    let Some(folder) = dialog else {
        return Ok(Vec::new());
    };

    let mut images = Vec::new();
    let image_extensions = [
        "png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff", "avif", "heic", "heif",
    ];

    if let Ok(entries) = fs::read_dir(&folder) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        let ext_str = extension.to_string_lossy().to_lowercase();
                        if image_extensions.contains(&ext_str.as_str()) {
                            let name = path.file_name().unwrap().to_string_lossy().to_string();
                            let path_str = path.to_string_lossy().to_string();
                            images.push(ImageInfo {
                                name,
                                path: path_str,
                                data_url: String::new(),  // lazy load later
                                thumbnail: String::new(), // lazy load later
                            });
                        }
                    }
                }
            }
        }
    }

    images.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(images)
}
