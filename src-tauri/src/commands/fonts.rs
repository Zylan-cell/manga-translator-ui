use tauri::command;
use std::process::Command;

#[command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        get_windows_fonts()
    }
    
    #[cfg(target_os = "macos")]
    {
        get_macos_fonts()
    }
    
    #[cfg(target_os = "linux")]
    {
        get_linux_fonts()
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(vec![
            "Arial".to_string(),
            "Times New Roman".to_string(),
            "Courier New".to_string(),
            "Verdana".to_string(),
            "Tahoma".to_string(),
            "Helvetica".to_string(),
            "Georgia".to_string(),
            "Comic Sans MS".to_string(),
        ])
    }
}

fn get_windows_fonts() -> Result<Vec<String>, String> {
    let output = Command::new("powershell")
        .args(&["-Command", "Get-ChildItem -Path 'C:\\Windows\\Fonts' | ForEach-Object { $_.Name }"])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        let fonts_str = String::from_utf8_lossy(&output.stdout);
        let fonts: Vec<String> = fonts_str
            .lines()
            .filter(|line| line.ends_with(".ttf") || line.ends_with(".otf"))
            .map(|line| line.replace(".ttf", "").replace(".otf", ""))
            .collect();
        
        Ok(fonts)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}