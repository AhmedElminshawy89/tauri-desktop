import { useEffect, useState, useCallback } from "react";
import { getDb } from "../lib/db";
import {
  ShieldCheck,
  Shield,
  Lock,
  Unlock,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  LayoutDashboard,
  User,
  Edit,
} from "lucide-react";

const PERMISSION_SECTIONS = [
  {
    key: "sales",
    label: "المبيعات",
    perms: [
      { key: "cashier", label: "نقطة البيع", desc: "إتمام فواتير جديدة" },
      { key: "edit_bill", label: "تعديل الفواتير", desc: "تغيير فواتير سابقة" },
      { key: "delete_bill", label: "حذف الفواتير", desc: "حذف نهائي لا يُسترد" },
      { key: "returns", label: "المرتجعات", desc: "استرجاع البضاعة" },
      { key: "on_hold", label: "فواتير معلقة", desc: "حفظ واسترداد الفواتير" },
    ],
  },
  {
    key: "inventory",
    label: "المخزون",
    perms: [
      { key: "products", label: "إدارة المنتجات", desc: "إضافة وتعديل وحذف" },
      { key: "inventory", label: "جرد المخزن", desc: "مراجعة الكميات" },
      { key: "barcode", label: "طباعة الباركود", desc: "ملصقات الأسعار" },
      { key: "suppliers", label: "الموردين", desc: "إدارة وسداد المستحقات" },
    ],
  },
  {
    key: "finance",
    label: "المالية والتقارير",
    perms: [
      { key: "safe", label: "حركة الخزينة", desc: "الإيرادات والمصروفات" },
      { key: "installments", label: "تحصيل الأقساط", desc: "المديونيات والأقساط" },
      { key: "expenses", label: "المصروفات", desc: "تسجيل المصاريف" },
      { key: "reports", label: "التقارير", desc: "الأرباح والإحصاءات" },
      { key: "accounts", label: "إدارة الحسابات", desc: "المستخدمون والصلاحيات" },
    ],
  },
];

const DEFAULT_PERMS = {
  cashier: 1,
  edit_bill: 0,
  delete_bill: 0,
  returns: 1,
  on_hold: 1,
  products: 0,
  inventory: 0,
  barcode: 1,
  suppliers: 0,
  safe: 0,
  installments: 0,
  expenses: 0,
  reports: 0,
  accounts: 0,
};

const ADMIN_PERMS = Object.fromEntries(
  Object.keys(DEFAULT_PERMS).map((k) => [k, 1])
);

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    style={{
      width: "42px",
      height: "24px",
      borderRadius: "99px",
      border: "none",
      background: checked ? "#166534" : "rgba(255,255,255,0.12)",
      cursor: disabled ? "not-allowed" : "pointer",
      position: "relative",
      transition: "background 0.2s",
      flexShrink: 0,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <span
      style={{
        position: "absolute",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: checked ? "#4ade80" : "rgba(255,255,255,0.5)",
        top: "4px",
        right: checked ? "4px" : "22px",
        transition: "right 0.2s, background 0.2s",
      }}
    />
  </button>
);

const AccountsPage = ({ showToast, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [draftPerms, setDraftPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "User",
  });
  const [passForm, setPassForm] = useState({
    id: null,
    oldPass: "",
    newPass: "",
  });
  const [showPass, setShowPass] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const rows = await db.select(
        "SELECT id, username, role FROM users ORDER BY id ASC"
      );

      const withPerms = await Promise.all(
        rows.map(async (u) => {
          const p = await db.select(
            "SELECT * FROM user_permissions WHERE user_id = $1",
            [u.id]
          );
          return { ...u, perms: p[0] ?? { ...DEFAULT_PERMS, user_id: u.id } };
        })
      );
      setUsers(withPerms);
    } catch (err) {
      console.error(err);
      showToast("خطأ في جلب البيانات", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const selectUser = (u) => {
    setSelectedUser(u);
    setDraftPerms({ ...DEFAULT_PERMS, ...u.perms });
    setDirty(false);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setNewUser({ username: user.username, password: "", role: user.role });
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setNewUser({ username: "", password: "", role: "User" });
    setShowAddModal(true);
  };

  const updateUser = async () => {
    if (!newUser.username.trim()) {
      return showToast("اسم المستخدم مطلوب", "warning");
    }
    try {
      const db = await getDb();
      await db.execute("UPDATE users SET username = $1, role = $2 WHERE id = $3", [
        newUser.username.trim(),
        newUser.role,
        editingUser.id,
      ]);
      showToast("تم تحديث البيانات بنجاح", "success");
      setShowAddModal(false);
      setEditingUser(null);
      setNewUser({ username: "", password: "", role: "User" });
      await fetchUsers();
    } catch (err) {
      console.error("Update Error:", err);
      showToast("فشل التحديث — الاسم قد يكون مستخدماً بالفعل", "error");
    }
  };

  const togglePerm = (key, val) => {
    setDraftPerms((prev) => ({ ...prev, [key]: val ? 1 : 0 }));
    setDirty(true);
  };

  const grantAll = () => {
    setDraftPerms({ ...ADMIN_PERMS });
    setDirty(true);
  };
  const revokeAll = () => {
    setDraftPerms({ ...DEFAULT_PERMS });
    setDirty(true);
  };

  const savePerms = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const db = await getDb();
      const existing = await db.select(
        "SELECT id FROM user_permissions WHERE user_id = $1",
        [selectedUser.id]
      );

      const cols = Object.keys(DEFAULT_PERMS);
      if (existing.length > 0) {
        const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        await db.execute(
          `UPDATE user_permissions SET ${sets} WHERE user_id = $${cols.length + 1}`,
          [...cols.map((c) => draftPerms[c] ?? 0), selectedUser.id]
        );
      } else {
        const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
        await db.execute(
          `INSERT INTO user_permissions (user_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})`,
          [selectedUser.id, ...cols.map((c) => draftPerms[c] ?? 0)]
        );
      }

      showToast(`تم حفظ صلاحيات ${selectedUser.username}`, "success");
      setDirty(false);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      showToast("فشل الحفظ — راجع الكونسول", "error");
    } finally {
      setSaving(false);
    }
  };

  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim())
      return showToast("اسم المستخدم وكلمة المرور مطلوبين", "warning");
    try {
      const db = await getDb();
      const res = await db.execute(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        [newUser.username.trim(), newUser.password, newUser.role]
      );
      const uid = res.lastInsertId;
      const cols = Object.keys(DEFAULT_PERMS);
      const vals = cols.map((c) => DEFAULT_PERMS[c]);
      await db.execute(
        `INSERT INTO user_permissions (user_id, ${cols.join(",")}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(",")})`,
        [uid, ...vals]
      );
      showToast("تم إنشاء الحساب بنجاح", "success");
      setShowAddModal(false);
      setNewUser({ username: "", password: "", role: "User" });
      await fetchUsers();
    } catch (err) {
      showToast("فشل الإنشاء — ربما الاسم مكرر", "error");
    }
  };

  const changePass = async () => {
    if (!passForm.newPass.trim())
      return showToast("كلمة المرور الجديدة فارغة", "warning");
    try {
      const db = await getDb();
      const check = await db.select("SELECT password FROM users WHERE id = $1", [
        passForm.id,
      ]);
      if (check[0]?.password !== passForm.oldPass)
        return showToast("كلمة المرور الحالية غلط", "error");
      await db.execute("UPDATE users SET password = $1 WHERE id = $2", [
        passForm.newPass,
        passForm.id,
      ]);
      showToast("تم تغيير كلمة المرور", "success");
      setShowPassModal(false);
      setPassForm({ id: null, oldPass: "", newPass: "" });
    } catch (err) {
      showToast("فشل تغيير كلمة المرور", "error");
    }
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM users WHERE id = $1", [deleteTarget.id]);
      showToast("تم حذف الحساب", "success");
      if (selectedUser?.id === deleteTarget.id) setSelectedUser(null);
      setShowDeleteModal(false);
      await fetchUsers();
    } catch (err) {
      showToast("فشل الحذف", "error");
    }
  };

  const isAdmin = selectedUser?.role === "Admin";
  const activePerms = isAdmin ? ADMIN_PERMS : draftPerms;

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        /* Core Variable & Layout Overrides */
        .page-container {
          padding: 24px;
          background: transparent;
          min-height: 100vh;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* 1. Premium Stats Cards Styles */
        .premium-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .premium-stat-card {
          position: relative;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 20px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-stat-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 12px 24px -10px rgba(0,0,0,0.6);
        }
        .stat-glow {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          top: -20px;
          right: -20px;
          filter: blur(40px);
          opacity: 0.15;
          transition: opacity 0.3s ease;
        }
        .premium-stat-card:hover .stat-glow { opacity: 0.3; }
        .card-blue .stat-glow { background: #3b82f6; }
        .card-emerald .stat-glow { background: #10b981; }
        .card-cyan .stat-glow { background: #06b6d4; }
        .card-amber .stat-glow { background: #f59e0b; }
        
        .stat-content { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .card-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-emerald .icon-box { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-cyan .icon-box { color: #22d3ee; background: rgba(6,182,212,0.1); }
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
        
        .stat-details { display: flex; flex-direction: column; gap: 4px; }
        .stat-details .label { font-size: 13px; color: #94a3b8; }
        .stat-details .value { font-size: 20px; font-weight: 700; color: #f8fafc; }
        .price-text { font-family: monospace, sans-serif; letter-spacing: -0.5px; }
        .warning-glow { color: #ff9800 !important; text-shadow: 0 0 10px rgba(245,158,11,0.2); }

        /* 2. Modern Blurred Header Control Bar */
        .premium-control-bar {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 18px 24px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }
        .title-wrapper { display: flex; align-items: center; gap: 16px; }
        .brand-badge {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid #334155;
          color: #60a5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.05);
        }
        .main-title-neon { font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; margin: 0; }
        .sub-title-dim { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
        
        .actions-wrapper { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .search-neon-wrapper { position: relative; }
        .search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #475569; }
        .search-neon-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 11px 42px 11px 16px;
          width: 280px;
          color: #f1f5f9;
          font-size: 13.5px;
          transition: all 0.25s ease;
        }
        .search-neon-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
          outline: none;
        }
        .btn-action-neon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .btn-add { background: #2563eb; color: #ffffff; }
        .btn-add:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }

        /* 3. Cyber Punk Table Infrastructure */
        .cyber-table-container {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: right; }
        .cyber-table th {
          background: rgba(15, 23, 42, 0.8);
          padding: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
        }
        .table-th-icon { display: inline; vertical-align: middle; margin-left: 6px; color: #475569; }
        .cyber-row-main {
          border-bottom: 1px solid rgba(30, 41, 59, 0.5);
          transition: background 0.2s ease;
        }
        .cyber-row-main:hover { background: rgba(30, 41, 59, 0.3); }
        .row-active { background: rgba(59, 130, 246, 0.04) !important; }
        .cyber-row-main td { padding: 14px 16px; font-size: 14px; vertical-align: middle; }
        
        .expand-trigger { text-align: center; cursor: pointer; }
        .chevron-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition: all 0.25s ease;
        }
        .cyber-row-main:hover .chevron-circle { border-color: #475569; color: #94a3b8; }
        .chevron-circle.rotated { transform: rotate(-90deg); background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #60a5fa; }
        
        .supplier-identity { display: flex; align-items: center; gap: 12px; }
        .sup-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #1e293b;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          border: 1px solid #334155;
        }
        .sup-name { font-weight: 600; color: #f1f5f9; }
        .phone-badge {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.15);
          color: #34d399;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 13px;
          font-family: monospace;
        }
        .dim-dash { color: #334155; }
        
        /* Financial columns font styling */
        .num-primary { font-family: monospace; font-weight: 600; color: #cbd5e1; }
        .num-success { font-family: monospace; font-weight: 600; color: #34d399; }
        .num-accent { font-family: monospace; font-weight: 600; color: #94a3b8; }
        .num-accent.has-debt { color: #f97316; text-shadow: 0 0 10px rgba(249,115,22,0.1); }
        
        .table-actions-cell { display: flex; gap: 8px; justify-content: center; }
        .cyber-btn-mini {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .cyber-btn-mini.edit { color: #60a5fa; }
        .cyber-btn-mini.edit:hover { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.3); }
        .cyber-btn-mini.delete { color: #f87171; }
        .cyber-btn-mini.delete:hover { background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.3); }
        
        /* 4. Sub-tables Panel Designs */
        .cyber-nested-row { background: #0b0f17; }
        .nested-wrapper { padding: 20px; border-left: 3px solid #2563eb; background: linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(11,15,23,0) 100%); }
        .nested-header { margin-bottom: 14px; }
        .nested-title { display: flex; align-items: center; gap: 8px; }
        .nested-title h4 { margin: 0; font-size: 14px; font-weight: 600; color: #e2e8f0; }
        
        .nested-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .nested-table th { background: #111827; padding: 10px 14px; color: #64748b; border-bottom: 1px solid #1f2937; text-align: right; }
        .nested-body-row { border-bottom: 1px solid rgba(255,255,255,0.02); }
        .nested-body-row:hover { background: rgba(255,255,255,0.01); }
        .nested-body-row td { padding: 12px 14px; font-size: 13.5px; color: #cbd5e1; }
        
        .num-bold { font-family: monospace; font-weight: 700; color: #ffffff; }
        .num-success-dim { font-family: monospace; color: #10b981; }
        .num-warning-dim { font-family: monospace; color: #f59e0b; font-weight: 600; }
        
        .nested-actions { display: flex; gap: 6px; }
        .btn-nested-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          border: none;
          background: #1e293b;
          color: #94a3b8;
          transition: all 0.2s ease;
        }
        .btn-nested-action.view:hover { background: #2563eb; color: white; }
        .btn-nested-action.delete { padding: 6px 8px; color: #f87171; }
        .btn-nested-action.delete:hover { background: rgba(239,68,68,0.2); }

        /* 5. Modals & Overlays Glassmorphism Struct */
        .blur-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 8, 16, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .cyber-modal {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
          overflow: hidden;
        }
        .wide-modal { max-width: 780px; }
        .modal-cyber-header {
          padding: 18px 24px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-cyber-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: white; }
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; }
        .modal-close-btn:hover { color: white; }
        
        .cyber-form { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .cyber-input-group { display: flex; flex-direction: column; gap: 8px; }
        .cyber-input-group label { font-size: 13px; color: #94a3b8; display: inline-flex; align-items: center; gap: 6px; }
        .cyber-input-group input {
          background: #070a12;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 12px;
          color: white;
          font-size: 14px;
          transition: border 0.2s ease;
        }
        .cyber-input-group input:focus { border-color: #2563eb; outline: none; }
        
        .cyber-modal-actions { display: flex; gap: 12px; margin-top: 8px; }
        .cyber-modal-actions.centered { justify-content: center; }
        .cyber-modal-actions.end-aligned { justify-content: flex-end; padding: 16px 24px; background: rgba(0,0,0,0.15); }
        .cyber-btn-submit {
          flex: 1; padding: 12px; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; font-size: 14px; border: none; cursor: pointer; transition: background 0.2s;
        }
        .cyber-btn-submit:hover { background: #1d4ed8; }
        .cyber-btn-submit.danger-bg { background: #ef4444; }
        .cyber-btn-submit.danger-bg:hover { background: #dc2626; }
        .cyber-btn-dismiss {
          padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #94a3b8; font-weight: 600; font-size: 14px; border: none; cursor: pointer;
        }
        .cyber-btn-dismiss:hover { background: #334155; color: white; }
        
        /* System Alerts Config */
        .dialog-alert { max-width: 400px; padding: 24px; text-align: center; }
        .alert-head-icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(245,158,11,0.1); color: #f59e0b; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        .alert-desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 12px 0 24px; }
        
        /* Full Specs View Config */
        .modal-scroll-area { padding: 24px; max-height: 60vh; overflow-y: auto; }
        .spec-invoice-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .spec-card { background: #111827; border: 1px solid #1f2937; padding: 12px; border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
        .spec-card span { font-size: 11.5px; color: #64748b; }
        .spec-card strong { font-size: 14px; font-family: system-ui; }
        
        .spec-section-box { margin-top: 24px; background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.02); border-radius: 12px; padding: 16px; }
        .spec-box-title { font-size: 13.5px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .spec-table { width: 100%; border-collapse: collapse; text-align: right; }
        .spec-table th { font-size: 12px; color: #475569; padding: 8px 12px; border-bottom: 1px solid #1f2937; }
        .spec-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.02); color: #cbd5e1; }
        
        .variant-tag { background: #1e293b; padding: 2px 8px; border-radius: 4px; font-size: 11.5px; color: #94a3b8; }
        .payment-method-tag { background: rgba(59,130,246,0.1); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 11.5px; }
        
        /* Loading Utilities */
        .cyber-loading-card { text-align: center; color: #94a3b8; font-size: 14px; }
        .cyber-table-loading, .cyber-table-empty, .nested-loading, .nested-empty, .spec-empty {
          text-align: center; padding: 40px !important; color: #64748b; font-size: 13.5px;
        }
        .nested-loading, .nested-empty, .spec-empty { padding: 24px !important; }
        
        /* Animation Utility Drivers */
        .animate-scale-up { animation: scaleUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-slide-down { animation: slideDown 0.25s ease-out forwards; }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <User size={26} style={{ color: "#60a5fa" }} />
            <h2 className="main-title">إدارة الحسابات والصلاحيات</h2>
          </div>
          <p className="sub-title">تحكم دقيق في ما يراه ويفعله كل مستخدم</p>
        </div>
        <div className="header-actions-group">
          <button onClick={openAddModal} className="btn-save">
            <Plus size={16} /> إضافة مستخدم
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* User List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#64748b",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            المستخدمون ({users.length})
          </div>
          {loading ? (
            <div style={{ color: "#475569", fontSize: "13px", padding: "20px 0" }}>
              جاري التحميل...
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                onClick={() => selectUser(u)}
                style={{
                  background:
                    selectedUser?.id === u.id
                      ? "rgba(30,58,95,0.8)"
                      : "rgba(22,27,44,0.7)",
                  border:
                    selectedUser?.id === u.id
                      ? "1px solid #2d5f9e"
                      : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "14px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: u.role === "Admin" ? "#3b1f6e" : "#1a2a3a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: u.role === "Admin" ? "#a78bfa" : "#60a5fa",
                    flexShrink: 0,
                  }}
                >
                  {u.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {u.username}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: u.role === "Admin" ? "#a78bfa" : "#64748b",
                      marginTop: "2px",
                    }}
                  >
                    {u.role === "Admin" ? "مدير النظام" : "مستخدم عادي"}
                  </div>
                </div>
                <div
                  style={{ display: "flex", gap: "4px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="تغيير كلمة المرور"
                    onClick={() => {
                      setPassForm({ id: u.id, oldPass: "", newPass: "" });
                      setShowPassModal(true);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "none",
                      color: "#94a3b8",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Lock size={13} />
                  </button>
                  <button
                    title="تعديل بيانات الحساب"
                    onClick={() => openEditModal(u)}
                    style={{
                      background: "#1e3a5f",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      color: "#60a5fa",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#2563eb";
                      e.currentTarget.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#1e3a5f";
                      e.currentTarget.style.color = "#60a5fa";
                    }}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    title="حذف الحساب"
                    onClick={() => {
                      setDeleteTarget(u);
                      setShowDeleteModal(true);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "none",
                      color: "#f87171",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Permissions Panel */}
        <div
          style={{
            background: "rgba(22,27,44,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "20px",
            padding: "24px",
            minHeight: "500px",
          }}
        >
          {!selectedUser ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "450px",
                color: "#334155",
                gap: "12px",
              }}
            >
              <ShieldCheck size={48} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: "14px" }}>
                اختر مستخدماً من القائمة لتعديل صلاحياته
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: isAdmin ? "#3b1f6e" : "#1a2a3a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: isAdmin ? "#a78bfa" : "#60a5fa",
                    }}
                  >
                    {selectedUser.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "700" }}>
                      {selectedUser.username}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      {isAdmin ? (
                        <span style={{ color: "#a78bfa" }}>
                          مدير النظام — صلاحيات كاملة تلقائياً
                        </span>
                      ) : (
                        "تحكم في الأقسام المتاحة"
                      )}
                    </div>
                  </div>
                </div>
                {!isAdmin && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={grantAll}
                      style={{
                        fontSize: "12px",
                        padding: "7px 14px",
                        background: "rgba(34,197,94,0.1)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        color: "#4ade80",
                        borderRadius: "10px",
                        cursor: "pointer",
                      }}
                    >
                      منح الكل
                    </button>
                    <button
                      onClick={revokeAll}
                      style={{
                        fontSize: "12px",
                        padding: "7px 14px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#f87171",
                        borderRadius: "10px",
                        cursor: "pointer",
                      }}
                    >
                      سحب الكل
                    </button>
                  </div>
                )}
              </div>

              {PERMISSION_SECTIONS.map((section) => (
                <div key={section.key} style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "10px",
                    }}
                  >
                    {section.label}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "8px",
                    }}
                  >
                    {section.perms.map((p) => {
                      const enabled = Boolean(activePerms[p.key]);
                      return (
                        <div
                          key={p.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: enabled
                              ? "rgba(34,197,94,0.06)"
                              : "rgba(255,255,255,0.03)",
                            border: enabled
                              ? "1px solid rgba(34,197,94,0.15)"
                              : "1px solid rgba(255,255,255,0.05)",
                            borderRadius: "12px",
                            transition: "all 0.2s",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: "600",
                                color: enabled ? "white" : "#64748b",
                              }}
                            >
                              {p.label}
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#475569",
                                marginTop: "2px",
                              }}
                            >
                              {p.desc}
                            </div>
                          </div>
                          <Toggle
                            checked={enabled}
                            onChange={(val) => togglePerm(p.key, val)}
                            disabled={isAdmin}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!isAdmin && (
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "8px",
                    paddingTop: "16px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <button
                    onClick={savePerms}
                    disabled={!dirty || saving}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "none",
                      background: dirty ? "#166534" : "rgba(255,255,255,0.05)",
                      color: dirty ? "#4ade80" : "#475569",
                      cursor: dirty ? "pointer" : "not-allowed",
                      fontSize: "14px",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                  >
                    <Save size={16} /> {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                  </button>
                  <button
                    onClick={() => {
                      setDraftPerms({ ...DEFAULT_PERMS, ...selectedUser.perms });
                      setDirty(false);
                    }}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    تراجع
                  </button>
                  {dirty && (
                    <span style={{ fontSize: "12px", color: "#f59e0b", alignSelf: "center" }}>
                      يوجد تغييرات غير محفوظة
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div
          onClick={() => {
            setShowAddModal(false);
            setEditingUser(null);
          }}
          className="blur-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-modal"
            style={{ maxWidth: "420px", width: "100%" }}
          >
            <div className="modal-cyber-header">
              <h3>{editingUser ? "تعديل بيانات الحساب" : "إنشاء حساب جديد"}</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                }}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>
            <div className="cyber-form">
              <div className="cyber-input-group">
                <label>اسم المستخدم</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
              {!editingUser && (
                <div className="cyber-input-group">
                  <label>كلمة المرور</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  />
                </div>
              )}
              <div className="cyber-input-group">
                <label>مستوى الصلاحية</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#080a10",
                    border: "1px solid #2d364f",
                    color: "white",
                    borderRadius: "10px",
                    padding: "11px 14px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                >
                  <option value="User">مستخدم عادي — صلاحيات محددة</option>
                  <option value="Admin">مدير النظام — صلاحيات كاملة</option>
                </select>
              </div>
              <div className="cyber-modal-actions">
                <button
                  onClick={editingUser ? updateUser : addUser}
                  className="cyber-btn-submit"
                >
                  {editingUser ? "حفظ التعديلات" : "إنشاء الحساب"}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                  }}
                  className="cyber-btn-dismiss"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPassModal && (
        <div onClick={() => setShowPassModal(false)} className="blur-overlay">
          <div onClick={(e) => e.stopPropagation()} className="cyber-modal">
            <div className="modal-cyber-header">
              <h3>تغيير كلمة المرور</h3>
              <button onClick={() => setShowPassModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <div className="cyber-form">
              {["oldPass", "newPass"].map((f) => (
                <div key={f} className="cyber-input-group" style={{ position: "relative" }}>
                  <label>{f === "oldPass" ? "كلمة المرور الحالية" : "كلمة المرور الجديدة"}</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={passForm[f]}
                    placeholder="••••••••"
                    onChange={(e) => setPassForm((p) => ({ ...p, [f]: e.target.value }))}
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "34px",
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              ))}
              <div className="cyber-modal-actions">
                <button onClick={changePass} className="cyber-btn-submit">
                  تأكيد التغيير
                </button>
                <button onClick={() => setShowPassModal(false)} className="cyber-btn-dismiss">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div onClick={() => setShowDeleteModal(false)} className="blur-overlay">
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-modal"
            style={{ maxWidth: "380px", textAlign: "center" }}
          >
            <div className="modal-cyber-header">
              <h3 style={{ color: "#f87171" }}>حذف حساب "{deleteTarget.username}"؟</h3>
              <button onClick={() => setShowDeleteModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <div className="cyber-form">
              <Trash2 size={40} style={{ color: "#f87171", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.6", textAlign: "center" }}>
                سيتم حذف الحساب وجميع صلاحياته نهائياً. هذا الإجراء لا يمكن التراجع عنه.
              </p>
              <div className="cyber-modal-actions">
                <button onClick={deleteUser} className="cyber-btn-submit danger-bg">
                  تأكيد الحذف
                </button>
                <button onClick={() => setShowDeleteModal(false)} className="cyber-btn-dismiss">
                  تراجع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;