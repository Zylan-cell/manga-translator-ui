use font_kit::source::SystemSource;
use tauri::command;

#[command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    let source = SystemSource::new();
    match source.all_families() {
        Ok(families) => {
            let mut font_names = families;
            font_names.sort();
            font_names.dedup(); // Удаляем дубликаты
            Ok(font_names)
        }
        Err(e) => Err(format!("Failed to get system fonts: {}", e)),
    }
}
