import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getDb } from "../lib/db";
import {
  Users, Clock, Trash2, Edit, Save, UserPlus, X, AlertCircle,
  Phone, Wallet, Percent, CheckCircle2, Calendar, Search,
  Briefcase, Fingerprint, LogOut, Ban, History
} from "lucide-react";

const AttendanceSystem = ({ showToast }) => {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("log");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingAttId, setEditingAttId] = useState(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [employeeModal, setEmployeeModal] = useState(null);
  const [reportFilter, setReportFilter] = useState({
    empId: "all",
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const emps = await db.select("SELECT * FROM employees ORDER BY name ASC");
      const att = await db.select(`
        SELECT a.*, e.name as emp_name, e.position, e.commission_rate
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        ORDER BY a.date DESC, a.check_in DESC
      `);
      setEmployees(emps || []);
      setAttendance(att || []);
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dailyRecords = useMemo(() => attendance.filter(a => a.date === selectedDate), [attendance, selectedDate]);
  const filteredReports = useMemo(() => attendance.filter(a => {
    const matchEmp = reportFilter.empId === "all" || a.employee_id === parseInt(reportFilter.empId);
    const matchDate = a.date >= reportFilter.start && a.date <= reportFilter.end;
    return matchEmp && matchDate;
  }), [attendance, reportFilter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayPresent = attendance.filter(a => a.date === today && a.check_in !== null && a.status !== 'absent').length;
    const totalCommission = employees.reduce((sum, e) => sum + (e.commission_rate || 0), 0);
    return {
      totalEmployees: employees.length,
      todayPresent,
      totalCommission,
      avgCommission: employees.length ? (totalCommission / employees.length).toFixed(2) : 0
    };
  }, [employees, attendance]);

  const handleCheckIn = async (employeeId) => {
    const existing = attendance.find(a => a.employee_id === employeeId && a.date === selectedDate);
    if (existing && existing.check_in) {
      showToast?.("تم تسجيل الحضور مسبقاً لهذا اليوم", "warning");
      return;
    }
    const nowTime = getCurrentTime();
    try {
      const db = await getDb();
      if (existing) {
        await db.execute("UPDATE attendance SET check_in = ?, status = NULL WHERE id = ?", [nowTime, existing.id]);
      } else {
        await db.execute("INSERT INTO attendance (employee_id, date, check_in, check_out) VALUES (?, ?, ?, ?)", [employeeId, selectedDate, nowTime, null]);
      }
      showToast?.(`تم تسجيل حضور الموظف الساعة ${nowTime}`, "success");
      fetchData();
    } catch (err) {
      showToast?.("فشل تسجيل الحضور", "error");
    }
  };

  const handleCheckOut = async (employeeId) => {
    const record = attendance.find(a => a.employee_id === employeeId && a.date === selectedDate);
    if (!record || !record.check_in) {
      showToast?.("لا يمكن تسجيل الانصراف قبل تسجيل الحضور", "warning");
      return;
    }
    if (record.check_out) {
      showToast?.("تم تسجيل الانصراف مسبقاً لهذا اليوم", "warning");
      return;
    }
    const nowTime = getCurrentTime();
    try {
      const db = await getDb();
      await db.execute("UPDATE attendance SET check_out = ? WHERE id = ?", [nowTime, record.id]);
      showToast?.(`تم تسجيل انصراف الموظف الساعة ${nowTime}`, "success");
      fetchData();
    } catch (err) {
      showToast?.("فشل تسجيل الانصراف", "error");
    }
  };

  const handleAbsent = async (employeeId) => {
    const existing = attendance.find(a => a.employee_id === employeeId && a.date === selectedDate);
    if (existing) {
      showToast?.("هذا الموظف لديه سجل بالفعل لهذا اليوم", "warning");
      return;
    }
    try {
      const db = await getDb();
      await db.execute("INSERT INTO attendance (employee_id, date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)", [employeeId, selectedDate, null, null, 'absent']);
      showToast?.("تم تسجيل غياب الموظف", "success");
      fetchData();
    } catch (err) {
      showToast?.("فشل تسجيل الغياب", "error");
    }
  };

  const updateAttendanceTimes = async (id, newIn, newOut) => {
    try {
      const db = await getDb();
      await db.execute("UPDATE attendance SET check_in = ?, check_out = ? WHERE id = ?", [newIn || null, newOut || null, id]);
      showToast?.("تم تحديث السجلات", "success");
      setEditingAttId(null);
      fetchData();
    } catch (err) {
      showToast?.("خطأ في التحديث", "error");
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const { mode, data } = employeeModal;
    try {
      const db = await getDb();
      if (mode === 'add') {
        await db.execute("INSERT INTO employees (name, position, salary, phone, commission_rate) VALUES (?, ?, ?, ?, ?)", [data.name, data.position, data.salary, data.phone, data.commission_rate || 0]);
        showToast?.("تم إضافة الموظف", "success");
      } else {
        await db.execute("UPDATE employees SET name=?, position=?, salary=?, phone=?, commission_rate=? WHERE id=?", [data.name, data.position, data.salary, data.phone, data.commission_rate || 0, data.id]);
        showToast?.("تم تحديث الموظف", "success");
      }
      setEmployeeModal(null);
      fetchData();
    } catch (err) {
      showToast?.("خطأ في حفظ البيانات", "error");
    }
  };

  const handleDeleteEmployee = async (id, name) => {
    const hasRecords = attendance.some(a => a.employee_id === id);
    if (hasRecords) {
      showToast?.(`لا يمكن حذف "${name}" لأن لديه سجلات حضور`, "error");
      return;
    }
    if (!window.confirm(`هل تريد حذف "${name}" نهائياً؟`)) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM employees WHERE id = ?", [id]);
      showToast?.("تم حذف الموظف", "success");
      fetchData();
    } catch (err) {
      showToast?.("خطأ في الحذف", "error");
    }
  };

  const getStatusDisplay = (record) => {
    if (!record) return { label: "لم يسجل", color: "#64748b", icon: <Clock size={14} /> };
    if (record.status === 'absent') return { label: "غائب", color: "#f87171", icon: <Ban size={14} /> };
    if (record.check_in) {
      const isLate = record.check_in > "09:00";
      return { label: isLate ? "متأخر" : "حاضر", color: isLate ? "#f59e0b" : "#4ade80", icon: isLate ? <AlertCircle size={14} /> : <CheckCircle2 size={14} /> };
    }
    return { label: "لم يسجل", color: "#64748b", icon: <Clock size={14} /> };
  };

  const totalEstimatedCommission = employees.reduce((sum, e) => sum + (e.commission_rate || 0), 0);

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        .page-container {
          padding: 24px;
          background: transparent;
          min-height: 100vh;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
        }
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
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-stat-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 12px 24px -10px rgba(0,0,0,0.6);
        }
        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .stat-card-premium.indigo .stat-icon-wrapper { color: #818cf8; background: rgba(99,102,241,0.1); }
        .stat-card-premium.green .stat-icon-wrapper { color: #34d399; background: rgba(16,185,129,0.1); }
        .stat-card-premium.amber .stat-icon-wrapper { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }
        .page-header-container {
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
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .header-actions-group { display: flex; gap: 12px; align-items: center; }
        .btn-save {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-save:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .btn-add-employee {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: auto !important;
        }
        .btn-add-employee:hover { background: #1d4ed8; transform: translateY(-1px); }
        .btn-cancel {
          background: #1e293b;
          color: #94a3b8;
          padding: 8px 16px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
        }
        .ei-summary {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          overflow: hidden;
        }
        .ei-summary-header {
          padding: 16px 20px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ei-summary-body { padding: 20px; }
        .ei-field-label {
          font-size: 13px;
          color: #94a3b8;
          display: block;
          margin-bottom: 6px;
        }
        .premium-select {
          width: 100%;
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 10px 14px;
          color: #f1f5f9;
          font-size: 14px;
        }
        .table-wrapper-premium {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          overflow: hidden;
        }
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          text-align: right;
        }
        .custom-table th {
          background: rgba(15, 23, 42, 0.8);
          padding: 14px;
          font-size: 13px;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
        }
        .custom-table td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .table-row:hover { background: rgba(30,41,59,0.3); }
        .action-btn {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.2s;
        }
        .action-btn.edit:hover { color: #60a5fa; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .action-btn.delete:hover { color: #f87171; border-color: #ef4444; background: rgba(239,68,68,0.1); }
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
          max-width: 500px;
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
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; }
        .modal-close-btn:hover { color: white; }
        .cyber-form { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .cyber-input-group { display: flex; flex-direction: column; gap: 8px; }
        .cyber-input-group label { font-size: 13px; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
        .cyber-input-group input, .cyber-input-group select {
          background: #070a12;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 12px;
          color: white;
          font-size: 14px;
          transition: border 0.2s;
        }
        .cyber-input-group input:focus, .cyber-input-group select:focus { border-color: #2563eb; outline: none; }
        .cyber-modal-actions { display: flex; gap: 12px; margin-top: 8px; }
        .cyber-btn-submit { flex: 1; padding: 12px; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-submit:hover { background: #1d4ed8; }
        .cyber-btn-dismiss { padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #94a3b8; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-dismiss:hover { background: #334155; color: white; }
        .count-badge {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 12px;
        }
        .ei-badge {
          background: #1e293b;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 12px;
          font-family: monospace;
        }
        .attendance-action-buttons { display: flex; gap: 8px; margin-top: 6px; }
        .btn-attendance {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: 0.2s;
        }
        .btn-checkin { background: #166534; color: #4ade80; border: 1px solid #4ade80; }
        .btn-checkin:hover { background: #14532d; transform: translateY(-1px); }
        .btn-checkout { background: #1e3a5f; color: #60a5fa; border: 1px solid #60a5fa; }
        .btn-checkout:hover { background: #1e2c4a; }
        .btn-absent { background: #450a0a; color: #f87171; border: 1px solid #f87171; }
        .btn-absent:hover { background: #7f1d1d; }
      `}</style>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card indigo">
          <div className="stat-icon-wrapper"><Users size={24} /></div>
          <div><div className="stat-label">إجمالي الموظفين</div><div className="stat-value">{stats.totalEmployees}</div></div>
        </div>
        <div className="premium-stat-card green">
          <div className="stat-icon-wrapper"><CheckCircle2 size={24} /></div>
          <div><div className="stat-label">الحضور اليوم</div><div className="stat-value">{stats.todayPresent}</div></div>
        </div>
        <div className="premium-stat-card amber">
          <div className="stat-icon-wrapper"><Percent size={24} /></div>
          <div><div className="stat-label">إجمالي نسب العمولة</div><div className="stat-value">{totalEstimatedCommission}%</div></div>
        </div>
      </div>

      {/* Header & Tabs */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={28} style={{ color: "#60a5fa" }} />
            <h2 className="main-title">الحضور والانصراف</h2>
          </div>
          <p className="sub-title">تسجيل الحضور والانصراف والغياب بضغطة زر</p>
        </div>
        <div className="header-actions-group">
          <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "12px" }}>
            {[
              { id: "log", label: "التسجيل اليومي" },
              { id: "report", label: "التقارير" },
              { id: "employees", label: "الموظفين" }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "8px 20px", borderRadius: "10px", background: activeTab === tab.id ? "#3b82f6" : "transparent", color: activeTab === tab.id ? "white" : "#94a3b8", border: "none", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Log Tab */}
      {activeTab === "log" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
          <div className="ei-summary">
            <div className="ei-summary-header"><Calendar size={16} /> اختيار التاريخ</div>
            <div className="ei-summary-body">
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="premium-select" style={{ marginBottom: "20px" }} />
              <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>قائمة الموظفين</div>
              <div style={{ maxHeight: "500px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
                {employees.map(emp => {
                  const record = attendance.find(a => a.employee_id === emp.id && a.date === selectedDate);
                  const status = getStatusDisplay(record);
                  return (
                    <div key={emp.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div><div style={{ fontWeight: "bold" }}>{emp.name}</div><div style={{ fontSize: "11px", color: "#94a3b8" }}>{emp.position}</div></div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: `${status.color}15`, padding: "2px 8px", borderRadius: "20px", color: status.color }}>{status.icon} <span style={{ fontSize: "12px" }}>{status.label}</span></div>
                      </div>
                      <div className="attendance-action-buttons">
                        <button className="btn-attendance btn-checkin" onClick={() => handleCheckIn(emp.id)} disabled={record?.status === 'absent' || (record?.check_in && record.check_in !== null)}><Fingerprint size={14} /> حضور</button>
                        <button className="btn-attendance btn-checkout" onClick={() => handleCheckOut(emp.id)} disabled={!record?.check_in || record?.check_out !== null || record?.status === 'absent'}><LogOut size={14} /> انصراف</button>
                        <button className="btn-attendance btn-absent" onClick={() => handleAbsent(emp.id)} disabled={!!record}><Ban size={14} /> غياب</button>
                      </div>
                      {record && record.check_in && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", textAlign: "left" }}>🕒 حضور: {record.check_in} {record.check_out && `| انصراف: ${record.check_out}`}</div>}
                    </div>
                  );
                })}
                {employees.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>لا يوجد موظفون. أضف موظفين أولاً</div>}
              </div>
            </div>
          </div>
          <div className="ei-summary">
            <div className="ei-summary-header" style={{ justifyContent: "space-between" }}><span>سجلات اليوم</span><span className="count-badge">{dailyRecords.length} موظف</span></div>
            <div className="ei-summary-body" style={{ maxHeight: "550px", overflowY: "auto" }}>
              {dailyRecords.length === 0 ? <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>لا توجد سجلات لهذا التاريخ</div> : dailyRecords.map(rec => (
                <div key={rec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div><div style={{ fontWeight: "bold" }}>{rec.emp_name}</div><div style={{ fontSize: "12px", color: "#94a3b8" }}>{rec.position}</div></div>
                  {editingAttId === rec.id ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="time" defaultValue={rec.check_in || ""} onChange={e => setEditIn(e.target.value)} className="premium-select" style={{ width: "70px", padding: "4px" }} />
                      <input type="time" defaultValue={rec.check_out || ""} onChange={e => setEditOut(e.target.value)} className="premium-select" style={{ width: "70px", padding: "4px" }} />
                      <button className="action-btn edit" onClick={() => updateAttendanceTimes(rec.id, editIn, editOut)}><Save size={14} /></button>
                      <button className="action-btn delete" onClick={() => setEditingAttId(null)}><X size={14} /></button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <span className="ei-badge">{rec.check_in || "—"} - {rec.check_out || "—"}{rec.status === 'absent' && <span style={{ color: "#f87171", marginRight: "6px" }}>(غائب)</span>}</span>
                      <button className="action-btn edit" onClick={() => { setEditingAttId(rec.id); setEditIn(rec.check_in || ""); setEditOut(rec.check_out || ""); }}><Edit size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "report" && (
        <div className="ei-summary">
          <div className="ei-summary-header">تقرير الحضور</div>
          <div className="ei-summary-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div><label className="ei-field-label">الموظف</label><select className="premium-select" value={reportFilter.empId} onChange={e => setReportFilter({ ...reportFilter, empId: e.target.value })}><option value="all">كل الموظفين</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><label className="ei-field-label">من تاريخ</label><input type="date" className="premium-select" value={reportFilter.start} onChange={e => setReportFilter({ ...reportFilter, start: e.target.value })} /></div>
              <div><label className="ei-field-label">إلى تاريخ</label><input type="date" className="premium-select" value={reportFilter.end} onChange={e => setReportFilter({ ...reportFilter, end: e.target.value })} /></div>
            </div>
            <div className="table-wrapper-premium">
              <table className="custom-table">
                <thead><tr><th>الموظف</th><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>نسبة العمولة</th><th>الحالة</th></tr></thead>
                <tbody>
                  {filteredReports.length === 0 ? <tr><td colSpan="6" style={{ padding: "40px", textAlign: "center" }}>لا توجد بيانات</td></tr> : filteredReports.map(r => (
                    <tr key={r.id} className="table-row"><td>{r.emp_name}</td><td>{r.date}</td><td>{r.check_in || "—"}</td><td>{r.check_out || "—"}</td><td>{r.commission_rate || 0}%</td><td>{r.status === 'absent' ? "غائب" : (r.check_in ? (r.check_in > "09:00" ? "متأخر" : "حاضر") : "لم يسجل")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === "employees" && (
        <div className="ei-summary">
          <div className="ei-summary-header" style={{ justifyContent: "space-between" }}>
            <span><Users size={16} /> قائمة الموظفين</span>
            <button className="btn-add-employee" onClick={() => setEmployeeModal({ mode: 'add', data: { name: "", position: "", salary: "", phone: "", commission_rate: 0 } })}><UserPlus size={16} /> إضافة موظف</button>
          </div>
          <div className="table-wrapper-premium">
            <table className="custom-table">
              <thead><tr><th>الاسم</th><th>الوظيفة</th><th>الراتب</th><th>الهاتف</th><th>نسبة العمولة</th><th>الإجراءات</th></tr></thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="table-row">
                    <td><span className="model-primary-name">{emp.name}</span></td>
                    <td>{emp.position}</td>
                    <td>{emp.salary?.toLocaleString()} ج.م</td>
                    <td>{emp.phone || "—"}</td>
                    <td>{emp.commission_rate || 0}%</td>
                    <td className="actions-cell-premium" style={{ gap: "8px" }}>
                      <button className="action-btn edit" onClick={() => setEmployeeModal({ mode: 'edit', data: emp })}><Edit size={16} /></button>
                      <button className="action-btn delete" onClick={() => handleDeleteEmployee(emp.id, emp.name)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && <tr><td colSpan="6" style={{ padding: "40px", textAlign: "center" }}>لا يوجد موظفون</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee Modal - fixed glass design */}
      {employeeModal && (
        <div className="blur-overlay" onClick={() => setEmployeeModal(null)}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>{employeeModal.mode === 'add' ? "إضافة موظف جديد" : "تعديل بيانات الموظف"}</h3>
              <button className="modal-close-btn" onClick={() => setEmployeeModal(null)}>✕</button>
            </div>
            <form onSubmit={handleEmployeeSubmit} className="cyber-form">
              <div className="cyber-input-group">
                <label><UserPlus size={14} /> الاسم الكامل</label>
                <input type="text" required value={employeeModal.data.name} onChange={e => setEmployeeModal({ ...employeeModal, data: { ...employeeModal.data, name: e.target.value } })} />
              </div>
              <div className="cyber-input-group">
                <label><Briefcase size={14} /> المسمى الوظيفي</label>
                <input type="text" value={employeeModal.data.position} onChange={e => setEmployeeModal({ ...employeeModal, data: { ...employeeModal.data, position: e.target.value } })} />
              </div>
              <div className="cyber-input-group">
                <label><Wallet size={14} /> الراتب الشهري</label>
                <input type="number" value={employeeModal.data.salary} onChange={e => setEmployeeModal({ ...employeeModal, data: { ...employeeModal.data, salary: e.target.value } })} />
              </div>
              <div className="cyber-input-group">
                <label><Phone size={14} /> رقم الهاتف</label>
                <input type="tel" value={employeeModal.data.phone} onChange={e => setEmployeeModal({ ...employeeModal, data: { ...employeeModal.data, phone: e.target.value } })} />
              </div>
              <div className="cyber-input-group">
                <label><Percent size={14} /> نسبة العمولة (%)</label>
                <input type="number" step="0.01" value={employeeModal.data.commission_rate || 0} onChange={e => setEmployeeModal({ ...employeeModal, data: { ...employeeModal.data, commission_rate: parseFloat(e.target.value) || 0 } })} />
                <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>تُحتسب العمولة من إجمالي مبيعات الموظف</p>
              </div>
              <div className="cyber-modal-actions">
                <button type="submit" className="cyber-btn-submit">حفظ البيانات</button>
                <button type="button" className="cyber-btn-dismiss" onClick={() => setEmployeeModal(null)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceSystem;