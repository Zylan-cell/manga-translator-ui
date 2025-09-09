// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::{folder, fonts, project};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Основные команды
            commands::fetch_models,
            commands::detect_text_areas,
            commands::detect_panels,
            commands::recognize_images_batch,
            commands::translate_text,
            commands::translate_text_stream,
            commands::translate_deeplx,
            commands::inpaint_image,
            commands::inpaint_text_auto,
            commands::fetch_image,
            commands::read_file_b64,
            
            // Новые команды
            folder::import_images,
            fonts::get_system_fonts,
            project::create_directory_structure,
            project::save_project,
            project::export_images,
            project::export_project,
            project::import_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}