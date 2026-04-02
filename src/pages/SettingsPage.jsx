import { useState, useEffect } from "react";
import { getDb } from "../lib/db";

const SettingsPage = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  
  // حالات التحكم في المودالات
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [settings, setSettings] = useState({
    shopName: "",
    currency: "EGP",
    lastBackup: "",
    requirePasswordOnDelete: true,
    autoLogout: false,
  });

  // --- 1. تحميل الإعدادات عند الفتح ---
  const initSettings = async () => {
    try {
      const db = await getDb();
      const res = await db.select("SELECT * FROM settings");
      const data = {};
      res.forEach((item) => (data[item.key] = item.value));

      setSettings({
        shopName: data.shop_name || "كودينج كورنر ستور",
        currency: data.currency || "EGP",
        lastBackup: data.last_backup || "لم يتم النسخ بعد",
        requirePasswordOnDelete: data.req_pass === "true",
        autoLogout: data.auto_logout === "true",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSettings();
  }, []);

  // --- 2. حفظ الإعدادات العامة ---
  const handleSaveSettings = async () => {
    try {
      const db = await getDb();
      await db.execute(`
        INSERT OR REPLACE INTO settings (key, value) VALUES 
        ('shop_name', $1),
        ('currency', $2),
        ('req_pass', $3),
        ('auto_logout', $4)
      `, [settings.shopName, settings.currency, settings.requirePasswordOnDelete.toString(), settings.autoLogout.toString()]);
      
      showToast("تم حفظ الإعدادات المركزية بنجاح ⚡");
    } catch (err) {
      showToast("خطأ أثناء حفظ الإعدادات", "error");
    }
  };

  // --- 3. بروتوكول النسخ الاحتياطي (Backup) ---
  const handleBackup = async () => {
    try {
      showToast("جاري استخراج السجلات السيادية...");
      const db = await getDb();
      const tables = ["users", "settings", "products", "customers", "invoices", "invoice_items", "returns", "deleted_invoices","categories"];
      const backupData = {};

      for (const table of tables) {
        backupData[table] = await db.select(`SELECT * FROM ${table}`);
      }

      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      const now = new Date().toLocaleString("ar-EG");
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup', ?)", [now]);
      setSettings(prev => ({ ...prev, lastBackup: now }));

      showToast("تم استخراج النسخة الاحتياطية بنجاح", "success");
    } catch (err) {
      showToast("فشل النسخ الاحتياطي", "error");
      console.error(err);
    }
  };

  // --- 4. بروتوكول الاستعادة (Restore) ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setShowRestoreModal(true);
    event.target.value = null;
  };

  const confirmRestore = async () => {
    if (!selectedFile) return;
    try {
      setShowRestoreModal(false);
      showToast("جاري تطهير البيانات القديمة...");
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          const db = await getDb();
          const tables = ["invoice_items", "returns", "deleted_invoices", "invoices", "products", "customers", "users", "settings"];
          for (const table of tables) {
            await db.execute(`DELETE FROM ${table}`);
            await db.execute(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
          }
          for (const table in backupData) {
            const rows = backupData[table];
            if (!rows || rows.length === 0) continue;
            const columns = Object.keys(rows[0]);
            const colNames = columns.join(", ");
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
            for (const row of rows) {
              await db.execute(`INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`, Object.values(row));
            }
          }
          showToast("تم استعادة السيادة على البيانات بنجاح 🚀", "success");
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          showToast("حدث خطأ في بنية ملف النسخة", "error");
        }
      };
      reader.readAsText(selectedFile);
    } catch (err) {
      showToast("فشل في بدء عملية الاستيراد", "error");
    }
  };

  // --- 5. بروتوكول الإتلاف النهائي (بدون Alert) ---
  const confirmDestroy = async () => {
    try {
      setShowDestroyModal(false);
      const db = await getDb();
      const tables = ["invoice_items", "returns", "deleted_invoices", "invoices", "products", "customers", "users"];
      for (const table of tables) {
        await db.execute(`DELETE FROM ${table}`);
        await db.execute(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
      }
      showToast("تم تطهير قاعدة البيانات بالكامل", "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast("فشل في تنفيذ عملية التصفير", "error");
    }
  };

  if (loading) return <div className="loading-screen">جاري تحميل البروتوكولات...</div>;

  const Card = ({ title, icon, children, className = "" }) => (
    <div className={`settings-card animate-slide-up ${className}`}>
      <div className="card-header">
        <span className="card-icon">{icon}</span>
        <h4>{title}</h4>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );

  return (
    <div className="settings-modern-container">
      <header className="settings-hero">
        <div className="hero-content">
          <h1>الإعدادات المركزية</h1>
          <p>تحكم في هوية النظام، بروتوكولات الأمان، وإدارة الأرشفة السيادية.</p>
        </div>
        <button className="save-all-btn" onClick={handleSaveSettings}>
          <span className="icon">💾</span> حفظ التغييرات
        </button>
      </header>

      <div className="settings-grid-layout">
        <nav className="settings-nav-glass">
          <button className={activeTab === "general" ? "active" : ""} onClick={() => setActiveTab("general")}>
            <span className="nav-dot"></span> المتجر الأساسي
          </button>
          <button className={activeTab === "security" ? "active" : ""} onClick={() => setActiveTab("security")}>
            <span className="nav-dot"></span> الأمان والخصوصية
          </button>
          <button className={activeTab === "backup" ? "active" : ""} onClick={() => setActiveTab("backup")}>
            <span className="nav-dot"></span> الداتا والنسخ
          </button>
        </nav>

        <main className="settings-view-viewport">
          <div className="view-scroll-content">
            {activeTab === "general" && (
              <div className="tab-content">
                <Card title="هوية العلامة التجارية" icon="🏢">
                  <div className="input-group-modern">
                    <label>اسم المنشأة</label>
                    <input
                      type="text"
                      value={settings.shopName}
                      onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                    />
                  </div>
                  <div className="input-grid-2">
                    <div className="input-group-modern">
                      <label>العملة الرسمية</label>
                      <select
                        value={settings.currency}
                        onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      >
                        <option value="EGP">جنيه مصري</option>
                        <option value="USD">دولار أمريكي</option>
                      </select>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "security" && (
              <Card title="بروتوكولات الأمان" icon="🛡️">
                <div className="feature-toggle">
                  <div className="text">
                    <h5>حماية العمليات الحساسة</h5>
                    <p>طلب كلمة المرور عند محاولة حذف السجلات.</p>
                  </div>
                  <label className="ios-switch">
                    <input
                      type="checkbox"
                      checked={settings.requirePasswordOnDelete}
                      onChange={() => setSettings({ ...settings, requirePasswordOnDelete: !settings.requirePasswordOnDelete })}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </Card>
            )}

            {activeTab === "backup" && (
              <div className="backup-controls" style={{ display: 'flex', gap: '20px' }}>
                <Card title="الأرشفة السيادية" className="flex-1" icon="📂">
                  <div className="backup-status-box">
                    <div className="status-info">
                      <span className="label">آخر نسخة احتياطية:</span>
                      <span className="value" style={{ color: '#3b82f6', fontWeight: 'bold' }}>{settings.lastBackup}</span>
                    </div>
                    <div className="backup-btns" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <button className="btn-main-action" onClick={handleBackup}>استخراج Backup</button>
                      <button className="btn-secondary-action" onClick={() => document.getElementById('import-db').click()}>استيراد ملف</button>
                      <input type="file" id="import-db" hidden accept=".json" onChange={handleFileChange} />
                    </div>
                  </div>
                </Card>

                <Card title="منطقة الإتلاف" className="danger-card flex-1" icon="☢️">
                  <div className="danger-content">
                    <p style={{ color: '#ff4444', fontSize: '0.9rem', marginBottom: '15px' }}>
                      سيؤدي هذا الإجراء لحذف جميع السجلات نهائياً.
                    </p>
                    <button className="danger-btn" onClick={() => setShowDestroyModal(true)}>تدمير البيانات بالكامل</button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* --- مودال استعادة البيانات (Restore) --- */}
      {showRestoreModal && (
        <div className="modal-overlay">
          <div className="modal-content-premium form-modal">
            <div className="modal-header">
              <h3 style={{ color: '#fff' }}>تأكيد الاستعادة</h3>
            </div>
            <div className="modal-body">
              <p>الملف: <strong style={{ color: '#3b82f6' }}>{selectedFile?.name}</strong></p>
              <p className="danger-text" style={{ color: '#ff4444' }}>سيتم مسح البيانات الحالية وتعويضها ببيانات الملف.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary-action" onClick={() => setShowRestoreModal(false)}>إلغاء</button>
              <button className="danger-btn" onClick={confirmRestore}>بدأ الاستعادة</button>
            </div>
          </div>
        </div>
      )}

      {/* --- مودال تدمير البيانات (Destroy) --- */}
      {showDestroyModal && (
        <div className="modal-overlay">
          <div className="modal-content-premium form-modal">
            <div className="modal-header">
              <h3 style={{ color: '#ff4444' }}>تحذير أمني خطير</h3>
            </div>
            <div className="modal-body">
              <p style={{ color: '#fff', fontSize: '1.1rem' }}>هل أنت متأكد من "تطهير" كافة السجلات؟</p>
              <p style={{ color: '#888' }}>هذا الإجراء سيحذف المبيعات، المنتجات، والعملاء بشكل نهائي.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary-action" onClick={() => setShowDestroyModal(false)}>تراجع فوراً</button>
              <button className="danger-btn" onClick={confirmDestroy}>نعم، تدمير البيانات</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;