use std::fs;
use tauri::command;

#[command]
pub async fn create_directory_structure(path: String) -> Result<(), String> {
    let paths = [
        format!("{}/originals", path),
        format!("{}/masks", path),
        format!("{}/exports", path),
        format!("{}/ocr", path),
        format!("{}/translations", path),
    ];
    
    for p in paths {
        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    }
    
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