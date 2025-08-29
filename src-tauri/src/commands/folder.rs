use crate::commands::ImageInfo;
use tauri::command;
use rfd::FileDialog;

#[command]
pub async fn import_images() -> Result<Vec<ImageInfo>, String> {
    let dialog = FileDialog::new()
        .set_title("Select images")
        .add_filter(
            "Images",
            &["png","jpg","jpeg","webp","bmp","gif","tif","tiff","avif","heic","heif"],
        )
        .pick_files();

    let Some(files) = dialog else {
        return Ok(Vec::new());
    };

    let mut images = Vec::new();
    for path in files {
        if !path.is_file() { continue; }
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        let path_str = path.to_string_lossy().to_string();
        images.push(ImageInfo {
            name,
            path: path_str,
            data_url: String::new(), // лениво грузим позже
            thumbnail: String::new(), // лениво грузим позже
        });
    }
    images.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(images)
}