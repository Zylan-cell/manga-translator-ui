// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Команды из `commands/mod.rs`
            commands::fetch_models,
            commands::detect_text_areas,
            commands::detect_panels,
            commands::recognize_images_batch,
            commands::translate_text,
            commands::translate_text_stream,
            commands::translate_deeplx,
            commands::inpaint_image,
            commands::inpaint_text_auto,
            commands::inpaint_lama,
            commands::inpaint_manual_mask,
            commands::fetch_image,
            commands::read_file_b64,
            // Команды из `commands/folder.rs` (с полным путём)
            commands::folder::import_images,
            commands::folder::import_folder,
            // Команды из `commands/fonts.rs` (с полным путём)
            commands::fonts::get_system_fonts,
            // Команды из `commands/project.rs` (с полным путём)
            commands::project::create_directory_structure,
            commands::project::save_project,
            commands::project::export_images,
            commands::project::export_project,
            commands::project::import_project,
            commands::project::export_flattened_images
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
