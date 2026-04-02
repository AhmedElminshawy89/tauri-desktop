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
      {
        key: "delete_bill",
        label: "حذف الفواتير",
        desc: "حذف نهائي لا يُسترد",
      },
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
      {
        key: "installments",
        label: "تحصيل الأقساط",
        desc: "المديونيات والأقساط",
      },
      { key: "expenses", label: "المصروفات", desc: "تسجيل المصاريف" },
      { key: "reports", label: "التقارير", desc: "الأرباح والإحصاءات" },
      {
        key: "accounts",
        label: "إدارة الحسابات",
        desc: "المستخدمون والصلاحيات",
      },
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
  const [showUpdateModal, setShowUpdateModal] = useState(false);
const [editingUser, setEditingUser] = useState(null); // Stores the user data being edited
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

  const openUpdateModal = (user) => {
  setEditingUser({
    id: user.id,
    username: user.username,
    password: "", 
    role: user.role
  });
  setShowUpdateModal(true);
};
// عند فتح المودال للتعديل
const openEditModal = (user) => {
  setEditingUser(user); // نضع بيانات المستخدم هنا
  setNewUser({ username: user.username, password: "", role: user.role }); // كلمة المرور فارغة اختيارياً
  setShowAddModal(true);
};

// عند فتح المودال للإضافة
const openAddModal = () => {
  setEditingUser(null); 
  setNewUser({ username: "", password: "", role: "User" });
  setShowAddModal(true);
};

const updateUser = async () => {
  // التحقق من وجود اسم مستخدم قبل الإرسال
  if (!newUser.username.trim()) {
    return showToast("اسم المستخدم مطلوب", "warning");
  }

  try {
    const db = await getDb();
    
    // تحديث اليوزر باسمه ورتبته فقط
    await db.execute(
      "UPDATE users SET username = $1, role = $2 WHERE id = $3",
      [newUser.username.trim(), newUser.role, editingUser.id]
    );

    showToast("تم تحديث البيانات بنجاح", "success");
    
    // إغلاق المودال وتصفير الحالة
    setShowAddModal(false);
    setEditingUser(null);
    setNewUser({ username: "", password: "", role: "User" });
    
    // تحديث الجدول
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
      // إنشاء سجل صلاحيات افتراضي
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
      const check = await db.select(
        "SELECT password FROM users WHERE id = $1",
        [passForm.id]
      );
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
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <User size={26} style={{ color: "#60a5fa" }} />
            <h2 className="main-title">إدارة الحسابات والصلاحيات</h2>
          </div>
          <p className="sub-title">تحكم دقيق في ما يراه ويفعله كل مستخدم</p>
        </div>
        <div className="header-actions-group">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-save"
          >
            <Plus size={16} /> إضافة مستخدم
          </button>
        </div>
      </div>

      {/* Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* ── User List ── */}
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
            <div
              style={{ color: "#475569", fontSize: "13px", padding: "20px 0" }}
            >
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
  onClick={() => {
    // 1. تحديد المستخدم الذي يتم تعديله
    setEditingUser(u); 
    // 2. تعبئة الحقول بالبيانات الحالية (مع ترك كلمة المرور فارغة)
    setNewUser({ 
      username: u.username, 
      password: "", 
      role: u.role 
    });
    // 3. فتح المودال المشترك
    setShowAddModal(true);
  }}
  style={{
    background: "#1e3a5f",
    border: "1px solid rgba(59, 130, 246, 0.2)", // إضافة إطار خفيف ليعطي مظهر احترافي
    color: "#60a5fa", // تغيير اللون للأزرق ليتناسب مع أيقونة التعديل
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease", // إضافة أنيميشن بسيط عند الهوفر
  }}
  // إضافة تأثير عند مرور الماوس
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
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
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
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "2px",
                      }}
                    >
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
                    <Save size={16} />{" "}
                    {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                  </button>
                  <button
                    onClick={() => {
                      setDraftPerms({
                        ...DEFAULT_PERMS,
                        ...selectedUser.perms,
                      });
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
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#f59e0b",
                        alignSelf: "center",
                      }}
                    >
                      يوجد تغييرات غير محفوظة
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

{showAddModal && (
  <div
    onClick={() => {
      setShowAddModal(false);
      setEditingUser(null);
    }}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#0f1424",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px",
        padding: "28px",
        width: "420px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
          {editingUser ? "تعديل بيانات الحساب" : "إنشاء حساب جديد"}
        </h3>
        <button
          onClick={() => {
            setShowAddModal(false);
            setEditingUser(null);
          }}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* حقل اسم المستخدم - يظهر في الحالتين */}
<div style={{ marginBottom: "14px" }}>
  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
    اسم المستخدم
  </label>
  <input
    type="text"
    value={newUser.username}
    onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value }))}
    style={{
      width: "100%",
      background: "#080a10",
      border: "1px solid #2d364f",
      color: "white",
      borderRadius: "10px",
      padding: "11px 14px",
      fontSize: "14px",
      outline: "none"
    }}
  />
</div>

{/* حقل كلمة المرور - يظهر فقط إذا لم نكن في وضع التعديل */}
{!editingUser && (
  <div style={{ marginBottom: "14px" }}>
    <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
      كلمة المرور
    </label>
    <input
      type="password"
      placeholder="••••••••"
      value={newUser.password}
      onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
      style={{
        width: "100%",
        background: "#080a10",
        border: "1px solid #2d364f",
        color: "white",
        borderRadius: "10px",
        padding: "11px 14px",
        fontSize: "14px",
        outline: "none"
      }}
    />
  </div>
)}

      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            fontSize: "12px",
            color: "#94a3b8",
            display: "block",
            marginBottom: "6px",
          }}
        >
          مستوى الصلاحية
        </label>
        <select
          value={newUser.role}
          onChange={(e) =>
            setNewUser((p) => ({ ...p, role: e.target.value }))
          }
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

      <button
        onClick={editingUser ? updateUser : addUser}
        style={{
          width: "100%",
          padding: "13px",
          background: editingUser ? "#2d5f9e" : "#1e3a5f",
          border: "1px solid #2d5f9e",
          color: "white",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: "700",
          cursor: "pointer",
        }}
      >
        {editingUser ? "حفظ التعديلات" : "إنشاء الحساب"}
      </button>
    </div>
  </div>
)}

      {showPassModal && (
        <div
          onClick={() => setShowPassModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f1424",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px",
              padding: "28px",
              width: "380px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
                تغيير كلمة المرور
              </h3>
              <button
                onClick={() => setShowPassModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>
            {[
              { label: "كلمة المرور الحالية", field: "oldPass" },
              { label: "كلمة المرور الجديدة", field: "newPass" },
            ].map((f) => (
              <div
                key={f.field}
                style={{ marginBottom: "14px", position: "relative" }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  {f.label}
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  value={passForm[f.field]}
                  placeholder="••••••••"
                  onChange={(e) =>
                    setPassForm((p) => ({ ...p, [f.field]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: "#080a10",
                    border: "1px solid #2d364f",
                    color: "white",
                    borderRadius: "10px",
                    padding: "11px 40px 11px 14px",
                    fontSize: "14px",
                    outline: "none",
                  }}
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
            <button
              onClick={changePass}
              style={{
                width: "100%",
                padding: "13px",
                background: "#1c3d2e",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#4ade80",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                marginTop: "6px",
              }}
            >
              تأكيد التغيير
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div
          onClick={() => setShowDeleteModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f1424",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "20px",
              padding: "28px",
              width: "380px",
              textAlign: "center",
            }}
          >
            <Trash2
              size={40}
              style={{ color: "#f87171", marginBottom: "12px" }}
            />
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              حذف حساب "{deleteTarget.username}"؟
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
                marginBottom: "24px",
                lineHeight: "1.6",
              }}
            >
              سيتم حذف الحساب وجميع صلاحياته نهائياً. هذا الإجراء لا يمكن
              التراجع عنه.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={deleteUser}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#f87171",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "700",
                }}
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94a3b8",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
