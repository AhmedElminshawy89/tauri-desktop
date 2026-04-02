use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
async fn greet(name: String) -> Result<String, String> {
    Ok(format!("Hello, {}! You've been greeted from Rust!", name))
}

#[tauri::command]
async fn silent_print(app: tauri::AppHandle, html: String) -> Result<(), String> {
    // 1. كتابة HTML في ملف مؤقت حقيقي
    let temp_dir = app.path().temp_dir().map_err(|e| e.to_string())?;
    let temp_file: PathBuf = temp_dir.join("barcode_print.html");
    
    fs::write(&temp_file, &html).map_err(|e| e.to_string())?;
    
    let file_url = format!("file:///{}", temp_file.to_str().unwrap().replace("\\", "/"));

    // 2. بناء نافذة مخفية بـ URL حقيقي
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "print_helper",
        tauri::WebviewUrl::External(file_url.parse().map_err(|e: url::ParseError| e.to_string())?)
    )
    .visible(false)
    .title("Print Helper")
    .inner_size(794.0, 1123.0) // A4 size في pixels
    .build()
    .map_err(|e| e.to_string())?;

    // 3. استنى الصفحة تتحمل كامل قبل الطباعة
    // نستخدم sleep بسيط لضمان render الـ SVG والـ Barcode
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

    // 4. أمر الطباعة الصامتة
    window.eval("window.print();").map_err(|e| e.to_string())?;

    // 5. استنى الطباعة تخلص وبعدين اقفل النافذة
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    window.close().map_err(|e| e.to_string())?;

    // 6. حذف الملف المؤقت
    let _ = fs::remove_file(&temp_file);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            silent_print
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}