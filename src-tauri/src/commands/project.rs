use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use serde_json;
use std::fs;
use std::io::Read;
use tauri::command;

use std::io::Write;
use zip::write::ZipWriter;

// Для масок 1-бит PNG
use image::{self, DynamicImage};

#[derive(Debug, Deserialize)]
pub struct ImageData {
    path: String,
    name: String,
    #[serde(rename = "dataUrl")]
    data_url: Option<String>, // NEW: маска и финал
    #[serde(rename = "maskDataUrl")]
    mask_data_url: Option<String>
}#[derive(Debug, Deserialize)]
pub struct FlatImage {
name: String,
#[serde(rename = "dataUrl")]
data_url: String,
}

#[command]
pub async fn create_directory_structure(path: String) -> Result<(), String> {
    let originals_path = format!("{}/originals", path);
    let masks_path = format!("{}/masks", path);
    fs::create_dir_all(&originals_path).map_err(|e| e.to_string())?;
    fs::create_dir_all(&masks_path).map_err(|e| e.to_string())?;

    Ok(())
}
#[command]
pub async fn export_flattened_images(images: Vec<FlatImage>) -> Result<(), String> {
use rfd::FileDialog;let folder = FileDialog::new()
    .set_title("Export Images")
    .pick_folder();

if let Some(dir) = folder {
    for img in images {
        // data:image/png;base64,...
        let name_png = to_png_name(&img.name);
        if let Some(pos) = img.data_url.find(',') {
            let b64 = &img.data_url[pos + 1..];
            if let Ok(bytes) = STANDARD.decode(b64) {
                let full_path = dir.join(&name_png);
                fs::write(full_path, &bytes).map_err(|e| e.to_string())?;
            }
        }
    }
}
Ok(())}
#[command]
pub async fn save_project(project_data: String, output_path: String) -> Result<(), String> {
    fs::write(format!("{}/project.json", output_path), project_data).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn export_images(project_data: String, output_path: String) -> Result<(), String> {
    save_project(project_data, output_path).await
}

// Имя с .png (для маски/финала)
fn to_png_name(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, _ext)) => format!("{}.png", stem),
        None => format!("{}.png", name),
    }
}

// Записать 1-битный PNG (Grayscale 1bpp) из GrayImage
fn write_png_1bit<W: std::io::Write>(mut w: W, gray: &image::GrayImage) -> Result<(), String> {
    use png::{BitDepth, ColorType, Encoder};
    let wth = gray.width();
    let hgt = gray.height();
    let mut enc = Encoder::new(&mut w, wth, hgt);
    enc.set_color(ColorType::Grayscale);
    enc.set_depth(BitDepth::One);
    let mut writer = enc.write_header().map_err(|e| e.to_string())?;

    // 8 пикселей в 1 байт
    let rowbytes = ((wth + 7) / 8) as usize;
    let mut buf = vec![0u8; rowbytes * hgt as usize];

    for y in 0..hgt {
        let mut acc: u8 = 0;
        let mut bit: u8 = 0;
        let mut idx = y as usize * rowbytes;

        for x in 0..wth {
            let p = gray.get_pixel(x, y)[0];
            let set = if p >= 128 { 1u8 } else { 0u8 };
            acc |= set << (7 - bit);
            bit += 1;
            if bit == 8 {
                buf[idx] = acc;
                idx += 1;
                acc = 0;
                bit = 0;
            }
        }
        if bit != 0 {
            buf[idx] = acc;
        }
    }

    writer.write_image_data(&buf).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn export_project(
    project_data: serde_json::Value,
    image_data: Vec<ImageData>,
) -> Result<(), String> {
    use rfd::FileDialog;
    let save_path = FileDialog::new()
        .set_title("Export Project")
        .add_filter("Manga Translator Project", &["mtproj"])
        .set_file_name("project.mtproj")
        .save_file();

    if let Some(path) = save_path {
        {
            let file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
            let mut zip = ZipWriter::new(file);

            let options = zip::write::FileOptions::<()>::default()
                .compression_method(zip::CompressionMethod::Deflated);

            // project.json (на фронте уже "version": "2")
            zip.start_file("project.json", options)
                .map_err(|e| e.to_string())?;
            let formatted =
                serde_json::to_string_pretty(&project_data).map_err(|e| e.to_string())?;
            zip.write_all(formatted.as_bytes())
                .map_err(|e| e.to_string())?;

            // Папки
            zip.add_directory("originals/", options)
                .map_err(|e| e.to_string())?;
            zip.add_directory("masks/", options)
                .map_err(|e| e.to_string())?;

            for img in image_data.iter() {
                let file_name = &img.name;

                // ORIGINAL
                if img.path.starts_with("temp://") {
                    if let Some(data_url) = &img.data_url {
                        if let Some(pos) = data_url.find(',') {
                            let b64 = &data_url[pos + 1..];
                            if let Ok(bytes) = STANDARD.decode(b64) {
                                zip.start_file(format!("originals/{}", file_name), options)
                                    .map_err(|e| e.to_string())?;
                                zip.write_all(&bytes).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                } else {
                    if let Ok(bytes) = fs::read(&img.path) {
                        zip.start_file(format!("originals/{}", file_name), options)
                            .map_err(|e| e.to_string())?;
                        zip.write_all(&bytes).map_err(|e| e.to_string())?;
                    } else if let Some(data_url) = &img.data_url {
                        if let Some(pos) = data_url.find(',') {
                            let b64 = &data_url[pos + 1..];
                            if let Ok(bytes) = STANDARD.decode(b64) {
                                zip.start_file(format!("originals/{}", file_name), options)
                                    .map_err(|e| e.to_string())?;
                                zip.write_all(&bytes).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }

                // MASK -> 1‑битный PNG
                if let Some(mask_data_url) = &img.mask_data_url {
                    if let Some(pos) = mask_data_url.find(',') {
                        let b64 = &mask_data_url[pos + 1..];
                        if let Ok(bytes) = STANDARD.decode(b64) {
                            if let Ok(dynimg) = image::load_from_memory(&bytes) {
                                let gray = match dynimg {
                                    DynamicImage::ImageLuma8(g) => g,
                                    _ => dynimg.to_luma8(),
                                };
                                let mask_name = to_png_name(file_name);
                                zip.start_file(format!("masks/{}", mask_name), options)
                                    .map_err(|e| e.to_string())?;
                                let mut out = Vec::<u8>::new();
                                write_png_1bit(&mut out, &gray)?;
                                zip.write_all(&out).map_err(|e| e.to_string())?;
                            } else {
                                // fallback: что дали, то и пишем
                                let mask_name = to_png_name(file_name);
                                zip.start_file(format!("masks/{}", mask_name), options)
                                    .map_err(|e| e.to_string())?;
                                zip.write_all(&bytes).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
            }

            let underlying = zip.finish().map_err(|e| e.to_string())?;
            underlying.sync_all().map_err(|e| e.to_string())?;
            drop(underlying);
        }

        std::thread::sleep(std::time::Duration::from_millis(200));
        println!("Project exported successfully to: {:?}", path);
    }

    Ok(())
}

#[command]
pub async fn import_project() -> Result<Option<serde_json::Value>, String> {
    use rfd::FileDialog;
    use zip::read::ZipArchive;
    let file_path = FileDialog::new()
        .set_title("Import Project")
        .add_filter("Manga Translator Project", &["mtproj"])
        .pick_file();

    if let Some(path) = file_path {
        let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        // project.json
        let mut project_file = archive.by_name("project.json").map_err(|e| e.to_string())?;
        let mut project_content = String::new();
        project_file
            .read_to_string(&mut project_content)
            .map_err(|e| e.to_string())?;
        drop(project_file);

        let mut project_data: serde_json::Value =
            serde_json::from_str(&project_content).map_err(|e| e.to_string())?;

        // Пройтись по images и подставить dataUrl/mask/final
        if let Some(images) = project_data["images"].as_array_mut() {
            for image in images {
                // Клонируем name в String, чтобы не держать заимствование
                let name_opt = image
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let Some(name) = name_opt else {
                    continue;
                };

                // ORIGINAL
                if let Ok(mut f) = archive.by_name(&format!("originals/{}", name)) {
                    let mut buf = Vec::new();
                    f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                    // Выбираем mime по расширению
                    let mime = if name.to_lowercase().ends_with(".png") {
                        "image/png"
                    } else if name.to_lowercase().ends_with(".webp") {
                        "image/webp"
                    } else if name.to_lowercase().ends_with(".gif") {
                        "image/gif"
                    } else if name.to_lowercase().ends_with(".bmp") {
                        "image/bmp"
                    } else if name.to_lowercase().ends_with(".tif")
                        || name.to_lowercase().ends_with(".tiff")
                    {
                        "image/tiff"
                    } else {
                        "image/jpeg"
                    };
                    let b64 = STANDARD.encode(&buf);
                    let data_url = format!("data:{};base64,{}", mime, b64);

                    let image_name = name.clone();
                    image["dataUrl"] = serde_json::Value::String(data_url.clone());
                    image["thumbnail"] = serde_json::Value::String(data_url);
                    image["path"] = serde_json::Value::String(format!("imported/{}", image_name));
                    image["originalPath"] =
                        serde_json::Value::String(format!("imported/{}", image_name));
                }

                // MASK
                let mask_png_name = to_png_name(&name);
                let mut mask_found = false;
                for mask_try in [&mask_png_name[..], &name[..]] {
                    if let Ok(mut mf) = archive.by_name(&format!("masks/{}", mask_try)) {
                        let mut mbuf = Vec::new();
                        mf.read_to_end(&mut mbuf).map_err(|e| e.to_string())?;
                        let b64 = STANDARD.encode(&mbuf);
                        let data_url = format!("data:image/png;base64,{}", b64);
                        image["maskDataUrl"] = serde_json::Value::String(data_url);
                        mask_found = true;
                        break;
                    }
                }
                if !mask_found {
                    image["maskDataUrl"] = serde_json::Value::Null;
                }

                // FINAL
                let final_png_name = to_png_name(&name);
                let mut final_found = false;
                for fin_try in [&final_png_name[..], &name[..]] {
                    if let Ok(mut ff) = archive.by_name(&format!("finals/{}", fin_try)) {
                        let mut fbuf = Vec::new();
                        ff.read_to_end(&mut fbuf).map_err(|e| e.to_string())?;
                        let b64 = STANDARD.encode(&fbuf);
                        let data_url = format!("data:image/png;base64,{}", b64);
                        image["finalDataUrl"] = serde_json::Value::String(data_url);
                        final_found = true;
                        break;
                    }
                }
                if !final_found {
                    image["finalDataUrl"] = serde_json::Value::Null;
                }
            }
        }

        return Ok(Some(project_data));
    }

    Ok(None)
}
