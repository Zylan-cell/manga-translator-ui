use std::fs;
use tauri::command;
use serde_json;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ImageData {
    path: String,
    name: String,
    #[serde(rename = "dataUrl")]
    data_url: Option<String>,
}

#[command]
pub async fn create_directory_structure(path: String) -> Result<(), String> {
    // Simplified structure - only originals folder needed
    let originals_path = format!("{}/originals", path);
    
    fs::create_dir_all(&originals_path).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn save_project(project_data: String, output_path: String) -> Result<(), String> {
    // Сохраняем проект JSON
    fs::write(format!("{}/project.json", output_path), project_data)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub async fn export_images(project_data: String, output_path: String) -> Result<(), String> {
    // Пока просто сохраняем проект
    save_project(project_data, output_path).await
}

#[command]
pub async fn export_project(
    project_data: serde_json::Value,
    image_data: Vec<ImageData>,
) -> Result<(), String> {
    use std::io::Write;
    use zip::write::ZipWriter;
    
    // Use rfd for native file dialog
    use rfd::FileDialog;
    
    let save_path = FileDialog::new()
        .set_title("Export Project")
        .add_filter("Manga Translator Project", &["mtproj"])
        .set_file_name("project.mtproj")
        .save_file();
    
    if let Some(path) = save_path {
        // Create ZIP file in a completely separate scope
        {
            let file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
            let mut zip = ZipWriter::new(file);
            
            // Add project.json with proper structure
            let options = zip::write::FileOptions::<()>::default()
                .compression_method(zip::CompressionMethod::Deflated);
            zip.start_file("project.json", options).map_err(|e| e.to_string())?;
            
            // Pretty print JSON for readability
            let formatted_json = serde_json::to_string_pretty(&project_data)
                .map_err(|e| e.to_string())?;
            zip.write_all(formatted_json.as_bytes()).map_err(|e| e.to_string())?;
            
            // Add originals folder with images
            zip.add_directory("originals/", options).map_err(|e| e.to_string())?;
            
            for img_data in image_data.iter() {
                let file_name = &img_data.name;
                
                if img_data.path.starts_with("temp://") {
                    // Handle base64 images from clipboard/drag-drop
                    if let Some(data_url) = &img_data.data_url {
                        // Extract base64 data from data URL (format: "data:image/png;base64,actualdata")
                        if let Some(comma_pos) = data_url.find(',') {
                            let base64_data = &data_url[comma_pos + 1..];
                            if let Ok(image_bytes) = STANDARD.decode(base64_data) {
                                zip.start_file(&format!("originals/{}", file_name), options)
                                    .map_err(|e| e.to_string())?;
                                zip.write_all(&image_bytes).map_err(|e| e.to_string())?;
                                println!("Exported temp image: {}", file_name);
                            } else {
                                eprintln!("Failed to decode base64 for temp image: {}", file_name);
                            }
                        } else {
                            eprintln!("Invalid data URL format for temp image: {}", file_name);
                        }
                    } else {
                        eprintln!("No data URL provided for temp image: {}", file_name);
                    }
                } else {
                    // Regular file path - try reading the file
                    if let Ok(image_bytes) = fs::read(&img_data.path) {
                        zip.start_file(&format!("originals/{}", file_name), options)
                            .map_err(|e| e.to_string())?;
                        zip.write_all(&image_bytes).map_err(|e| e.to_string())?;
                        println!("Exported file image: {} from {}", file_name, img_data.path);
                    } else if let Some(data_url) = &img_data.data_url {
                        // Fallback to data URL if file path doesn't work
                        if let Some(comma_pos) = data_url.find(',') {
                            let base64_data = &data_url[comma_pos + 1..];
                            if let Ok(image_bytes) = STANDARD.decode(base64_data) {
                                zip.start_file(&format!("originals/{}", file_name), options)
                                    .map_err(|e| e.to_string())?;
                                zip.write_all(&image_bytes).map_err(|e| e.to_string())?;
                                println!("Exported image from dataUrl fallback: {}", file_name);
                            } else {
                                eprintln!("Failed to decode base64 fallback for image: {}", file_name);
                            }
                        } else {
                            eprintln!("Invalid data URL format for fallback image: {}", file_name);
                        }
                    } else {
                        eprintln!("Failed to read image file and no data URL available: {} from {}", file_name, img_data.path);
                    }
                }
            }
            
            // Explicitly finish and flush the ZIP
            let underlying_file = zip.finish().map_err(|e| e.to_string())?;
            // Force sync to disk
            underlying_file.sync_all().map_err(|e| e.to_string())?;
            // Explicitly drop the file handle
            drop(underlying_file);
        }
        
        // Additional wait to ensure Windows releases the file handle completely
        std::thread::sleep(std::time::Duration::from_millis(200));
        
        println!("Project exported successfully to: {:?}", path);
    }
    
    Ok(())
}

#[command]
pub async fn import_project() -> Result<Option<serde_json::Value>, String> {
    use zip::read::ZipArchive;
    use std::io::Read;
    use rfd::FileDialog;
    
    let file_path = FileDialog::new()
        .set_title("Import Project")
        .add_filter("Manga Translator Project", &["mtproj"])
        .pick_file();
    
    if let Some(path) = file_path {
        let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        
        // Read project.json first
        let mut project_file = archive.by_name("project.json").map_err(|e| e.to_string())?;
        let mut project_content = String::new();
        project_file.read_to_string(&mut project_content).map_err(|e| e.to_string())?;
        drop(project_file); // Explicitly drop to release the borrow
        
        let mut project_data: serde_json::Value = serde_json::from_str(&project_content)
            .map_err(|e| e.to_string())?;
        
        // Extract images from originals/ folder and update paths
        if let Some(images) = project_data["images"].as_array_mut() {
            for image in images {
                if let Some(name) = image["name"].as_str() {
                    // Try to find the image in originals/ folder
                    if let Ok(mut img_file) = archive.by_name(&format!("originals/{}", name)) {
                        let mut img_data = Vec::new();
                        img_file.read_to_end(&mut img_data).map_err(|e| e.to_string())?;
                        
                        // Detect image format for proper MIME type
                        let mime_type = if name.to_lowercase().ends_with(".png") {
                            "image/png"
                        } else {
                            "image/jpeg"
                        };
                        
                        // Convert to base64 data URL
                        let base64_data = STANDARD.encode(&img_data);
                        let data_url = format!("data:{};base64,{}", mime_type, base64_data);
                        
                        // Clone name to avoid borrow issues
                        let image_name = name.to_string();
                        image["dataUrl"] = serde_json::Value::String(data_url.clone());
                        image["thumbnail"] = serde_json::Value::String(data_url);
                        image["path"] = serde_json::Value::String(format!("imported/{}", image_name));
                        image["originalPath"] = serde_json::Value::String(format!("imported/{}", image_name));
                    }
                }
            }
        }
        
        return Ok(Some(project_data));
    }
    
    Ok(None)
}