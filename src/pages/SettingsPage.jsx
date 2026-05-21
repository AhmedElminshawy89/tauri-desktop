import { useState, useEffect } from "react";
import { getDb } from "../lib/db";

const SettingsPage = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  
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

  if (loading) return <div className="page-container animate-fade-in" style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>جاري تحميل البروتوكولات...</div>;

  const Card = ({ title, icon, children, className = "" }) => (
    <div className={`glass-card-premium ${className}`}>
      <div className="card-header-simple">
        <div className="header-dot"></div>
        <span>{icon} {title}</span>
      </div>
      <div>{children}</div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        /* ========== GLASS/CYBER THEME (consistent with all pages) ========== */
        .page-container {
          padding: 24px;
          background: transparent;
          min-height: 100vh;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .glass-card-premium {
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
          transition: all 0.3s ease;
        }
        .glass-card-premium:hover {
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .card-header-simple {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          font-weight: 700;
          color: #f1f5f9;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 12px;
        }
        .header-dot {
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          box-shadow: 0 0 8px #3b82f6;
        }
        .settings-hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding: 20px 28px;
          background: rgba(30, 41, 59, 0.3);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(8px);
        }
        .settings-hero h1 { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .settings-hero p { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .save-all-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .save-all-btn:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .settings-grid-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
        }
        .settings-nav-glass {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .settings-nav-glass button {
          background: transparent;
          border: none;
          padding: 12px 16px;
          width: 100%;
          text-align: right;
          color: #94a3b8;
          border-radius: 12px;
          transition: all 0.2s;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .settings-nav-glass button.active {
          background: rgba(59,130,246,0.15);
          color: #60a5fa;
          border: 1px solid rgba(59,130,246,0.3);
        }
        .settings-nav-glass button:hover {
          background: rgba(255,255,255,0.03);
          color: #cbd5e1;
        }
        .settings-view-viewport {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 16px;
          overflow-y: auto;
          padding: 20px;
        }
        .input-group-modern {
          margin-bottom: 20px;
        }
        .input-group-modern label {
          display: block;
          color: #94a3b8;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .input-group-modern input, .input-group-modern select {
          width: 100%;
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 12px;
          color: #f1f5f9;
          font-size: 14px;
          transition: all 0.2s;
        }
        .input-group-modern input:focus, .input-group-modern select:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .feature-toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
        }
        .feature-toggle h5 { color: white; font-size: 14px; margin: 0; }
        .feature-toggle p { color: #64748b; font-size: 12px; margin: 4px 0 0; }
        .ios-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .ios-switch input { opacity: 0; width: 0; height: 0; }
        .ios-switch .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #334155;
          transition: 0.4s;
          border-radius: 34px;
        }
        .ios-switch .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.4s;
          border-radius: 50%;
        }
        input:checked + .slider { background-color: #10b981; }
        input:checked + .slider:before { transform: translateX(20px); }
        .backup-status-box {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 20px;
        }
        .status-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .status-info .label { color: #94a3b8; font-size: 13px; }
        .status-info .value { color: #60a5fa; font-weight: 600; }
        .backup-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .btn-main-action {
          background: rgba(59,130,246,0.1);
          color: #60a5fa;
          border: 1px solid rgba(59,130,246,0.3);
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: 0.2s;
        }
        .btn-main-action:hover { background: #3b82f6; color: white; }
        .btn-secondary-action {
          background: transparent;
          color: #94a3b8;
          border: 1px solid rgba(148,163,184,0.2);
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-secondary-action:hover { background: rgba(255,255,255,0.05); color: white; }
        .danger-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }
        .danger-btn:hover { background: #dc2626; box-shadow: 0 0 20px rgba(239,68,68,0.4); }
        .flex-1 { flex: 1; }
        .blur-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .cyber-modal {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          overflow: hidden;
        }
        .modal-cyber-header {
          padding: 18px 24px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-cyber-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: white; }
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; font-size: 20px; }
        .cyber-modal-body { padding: 24px; }
        .cyber-modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: flex-end; gap: 12px; }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) {
          .settings-grid-layout { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Hero Section */}
      <div className="settings-hero">
        <div className="hero-content">
          <h1>الإعدادات المركزية</h1>
          <p>تحكم في هوية النظام، بروتوكولات الأمان، وإدارة الأرشفة السيادية.</p>
        </div>
        <button className="save-all-btn" onClick={handleSaveSettings}>
          💾 حفظ التغييرات
        </button>
      </div>

      {/* Layout */}
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

        <div className="settings-view-viewport">
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
            <div className="backup-controls" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <Card title="الأرشفة السيادية" icon="📂" className="flex-1">
                <div className="backup-status-box">
                  <div className="status-info">
                    <span className="label">آخر نسخة احتياطية:</span>
                    <span className="value" style={{ color: '#60a5fa', fontWeight: 'bold' }}>{settings.lastBackup}</span>
                  </div>
                  <div className="backup-btns">
                    <button className="btn-main-action" onClick={handleBackup}>استخراج Backup</button>
                    <button className="btn-secondary-action" onClick={() => document.getElementById('import-db').click()}>استيراد ملف</button>
                    <input type="file" id="import-db" hidden accept=".json" onChange={handleFileChange} />
                  </div>
                </div>
              </Card>

              <Card title="منطقة الإتلاف" icon="☢️" className="flex-1">
                <div className="danger-content">
                  <p style={{ color: '#f87171', fontSize: '0.9rem', marginBottom: '15px' }}>
                    سيؤدي هذا الإجراء لحذف جميع السجلات نهائياً.
                  </p>
                  <button className="danger-btn" onClick={() => setShowDestroyModal(true)}>تدمير البيانات بالكامل</button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="blur-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>تأكيد الاستعادة</h3>
              <button className="modal-close-btn" onClick={() => setShowRestoreModal(false)}>✕</button>
            </div>
            <div className="cyber-modal-body">
              <p>الملف: <strong style={{ color: "#60a5fa" }}>{selectedFile?.name}</strong></p>
              <p style={{ color: "#f87171", marginTop: "12px" }}>سيتم مسح البيانات الحالية وتعويضها ببيانات الملف.</p>
            </div>
            <div className="cyber-modal-footer">
              <button className="btn-secondary-action" onClick={() => setShowRestoreModal(false)}>إلغاء</button>
              <button className="danger-btn" onClick={confirmRestore}>بدأ الاستعادة</button>
            </div>
          </div>
        </div>
      )}

      {/* Destroy Modal */}
      {showDestroyModal && (
        <div className="blur-overlay" onClick={() => setShowDestroyModal(false)}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3 style={{ color: "#f87171" }}>تحذير أمني خطير</h3>
              <button className="modal-close-btn" onClick={() => setShowDestroyModal(false)}>✕</button>
            </div>
            <div className="cyber-modal-body">
              <p style={{ fontSize: "1.1rem", marginBottom: "8px" }}>هل أنت متأكد من "تطهير" كافة السجلات؟</p>
              <p style={{ color: "#64748b" }}>هذا الإجراء سيحذف المبيعات، المنتجات، والعملاء بشكل نهائي.</p>
            </div>
            <div className="cyber-modal-footer">
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