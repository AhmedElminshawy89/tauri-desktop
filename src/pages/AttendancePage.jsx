import React, { useEffect, useState, useMemo } from "react";
import { getDb } from "../lib/db";
import { 
  Users, Clock, Trash2, Edit, FileText, 
  Save, UserPlus, X, AlertCircle, Briefcase, Phone, Wallet
} from "lucide-react";

const AttendanceSystem = ({ showToast }) => {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("log"); 

  // حالات المودال والتحرير
  const [employeeModal, setEmployeeModal] = useState(null); // { mode: 'add' | 'edit', data: {} }
  const [editingAttId, setEditingAttId] = useState(null);

  // التاريخ الحالي بصيغة YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [manualLog, setManualLog] = useState({
    empId: "", 
    date: todayStr,
    in: "09:00", out: "17:00"
  });

  const [reportFilter, setReportFilter] = useState({ 
    empId: "all", 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: todayStr
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const emps = await db.select("SELECT * FROM employees ORDER BY name ASC");
      const att = await db.select(`
        SELECT a.*, e.name as emp_name, e.position 
        FROM attendance a 
        JOIN employees e ON a.employee_id = e.id 
        ORDER BY a.date DESC, a.check_in DESC
      `);
      setEmployees(emps || []);
      setAttendance(att || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // --- فلترة السجلات لتعرض "اليوم المختار" فقط في تبويب التسجيل ---
  const dailyRecords = useMemo(() => {
    return attendance.filter(a => a.date === manualLog.date);
  }, [attendance, manualLog.date]);

  // --- فلترة التقارير بناءً على اسم الموظف والفترة الزمنية ---
  const filteredReports = useMemo(() => {
    return attendance.filter(a => {
      const matchEmp = reportFilter.empId === "all" || a.employee_id === parseInt(reportFilter.empId);
      const matchDate = a.date >= reportFilter.start && a.date <= reportFilter.end;
      return matchEmp && matchDate;
    });
  }, [attendance, reportFilter]);

  // --- العمليات ---
  const handleSaveAttendance = async () => {
    if (!manualLog.empId) return showToast?.("برجاء اختيار الموظف", "error");
    
    // التحقق من عدم التكرار لنفس الموظف في نفس اليوم
    const isDuplicate = attendance.some(a => a.employee_id === parseInt(manualLog.empId) && a.date === manualLog.date);
    if (isDuplicate) return showToast?.("هذا الموظف مسجل حضور بالفعل في هذا التاريخ", "error");

    const db = await getDb();
    await db.execute("INSERT INTO attendance (employee_id, date, check_in, check_out) VALUES ($1, $2, $3, $4)", 
      [manualLog.empId, manualLog.date, manualLog.in, manualLog.out]);
    
    showToast?.("تم تسجيل الحضور", "success");
    fetchData();
  };

  const updateAttendanceTimes = async (id, newIn, newOut) => {
    const db = await getDb();
    await db.execute("UPDATE attendance SET check_in = $1, check_out = $2 WHERE id = $3", [newIn, newOut, id]);
    showToast?.("تم التحديث بنجاح", "success");
    setEditingAttId(null);
    fetchData();
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const { mode, data } = employeeModal;
    const db = await getDb();
    try {
      if (mode === 'add') {
        await db.execute("INSERT INTO employees (name, position, salary, phone) VALUES ($1, $2, $3, $4)", 
          [data.name, data.position, data.salary, data.phone]);
        showToast?.("تم إضافة الموظف", "success");
      } else {
        await db.execute("UPDATE employees SET name=$1, position=$2, salary=$3, phone=$4 WHERE id=$5", 
          [data.name, data.position, data.salary, data.phone, data.id]);
        showToast?.("تم تحديث البيانات", "success");
      }
      setEmployeeModal(null);
      fetchData();
    } catch { showToast?.("خطأ في معالجة البيانات", "error"); }
  };

  const handleDeleteEmployee = async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM employees WHERE id = $1", [id]);
    showToast?.("تم حذف الموظف", "info");
    fetchData();
  };

  return (
    <div dir="rtl" style={{ padding: '30px', background: '#020617', minHeight: '100vh', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: '900', color: '#3b82f6', letterSpacing: '-0.5px' }}>نظام شؤون الموظفين</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>الإدارة الذكية والتقارير التفصيلية</p>
        </div>
        <div style={tabContainerStyle}>
          {[{id:"log",l:"التسجيل اليومي"}, {id:"report",l:"التقارير"}, {id:"employees",l:"الموظفين"}].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={tabButtonStyle(activeTab === t.id)}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* Tab 1: Daily Log */}
      {activeTab === "log" && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '25px' }}>
          <div style={cardStyle}>
            <h3 style={cardTitle}><AlertCircle size={18} color="#3b82f6"/> تسجيل حضور</h3>
            <div style={formColumn}>
              <label style={labelStyle}>تاريخ السجل</label>
              <input type="date" value={manualLog.date} onChange={e=>setManualLog({...manualLog, date:e.target.value})} style={inputStyle} />
              
              <label style={labelStyle}>الموظف</label>
              <select value={manualLog.empId} onChange={e=>setManualLog({...manualLog, empId:e.target.value})} style={inputStyle}>
                <option value="">اختر الموظف...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              
              <div style={{display:'flex', gap:'10px'}}>
                <div style={{flex:1}}><label style={labelStyle}>حضور</label><input type="time" value={manualLog.in} onChange={e=>setManualLog({...manualLog, in:e.target.value})} style={inputStyle} /></div>
                <div style={{flex:1}}><label style={labelStyle}>انصراف</label><input type="time" value={manualLog.out} onChange={e=>setManualLog({...manualLog, out:e.target.value})} style={inputStyle} /></div>
              </div>
              <button onClick={handleSaveAttendance} style={btnPrimary}>إضافة السجل</button>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
               <h3 style={{margin:0, fontSize:'17px'}}>سجلات تاريخ: {manualLog.date}</h3>
               <span style={countBadgeStyle}>{dailyRecords.length} موظف</span>
            </div>
            <div style={{maxHeight:'450px', overflowY:'auto'}}>
              {dailyRecords.length === 0 ? (
                <div style={{textAlign:'center', padding:'40px', color:'#475569'}}>لا توجد سجلات لهذا التاريخ</div>
              ) : (
                dailyRecords.map(att => (
                  <div key={att.id} style={recordItemStyle}>
                    <div style={{flex: 1}}>
                      <div style={{fontWeight:'bold'}}>{att.emp_name}</div>
                      <div style={{fontSize:'12px', color:'#64748b'}}>{att.position}</div>
                    </div>
                    {editingAttId === att.id ? (
                      <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                        <input type="time" defaultValue={att.check_in} id={`in-${att.id}`} style={smallInputStyle} />
                        <input type="time" defaultValue={att.check_out} id={`out-${att.id}`} style={smallInputStyle} />
                        <button onClick={() => updateAttendanceTimes(att.id, document.getElementById(`in-${att.id}`).value, document.getElementById(`out-${att.id}`).value)} style={saveIconBtn}><Save size={16}/></button>
                      </div>
                    ) : (
                      <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                        <div style={timeBadgeStyle}>{att.check_in} - {att.check_out}</div>
                        <button onClick={() => setEditingAttId(att.id)} style={editIconBtn}><Edit size={16}/></button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Reports */}
      {activeTab === "report" && (
        <div style={cardStyle}>
          <div style={filterHeaderStyle}>
            <div style={{flex:1}}>
              <label style={labelStyle}>الموظف</label>
              <select value={reportFilter.empId} onChange={e=>setReportFilter({...reportFilter, empId:e.target.value})} style={inputStyle}>
                <option value="all">كل الموظفين</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>من</label><input type="date" value={reportFilter.start} onChange={e=>setReportFilter({...reportFilter, start:e.target.value})} style={inputStyle} /></div>
            <div><label style={labelStyle}>إلى</label><input type="date" value={reportFilter.end} onChange={e=>setReportFilter({...reportFilter, end:e.target.value})} style={inputStyle} /></div>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={thStyle}>الموظف</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>الحضور</th>
                <th style={thStyle}>الانصراف</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(r => (
                <tr key={r.id} style={tableRowStyle}><td style={tdStyle}>{r.emp_name}</td><td style={tdStyle}>{r.date}</td><td style={tdStyle}>{r.check_in}</td><td style={tdStyle}>{r.check_out}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Employees Table */}
      {activeTab === "employees" && (
        <div style={cardStyle}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
            <h3 style={{margin:0}}>قائمة الموظفين</h3>
            <button onClick={()=>setEmployeeModal({mode:'add', data:{name:'',position:'',salary:'',phone:''}})} style={btnPrimary}>
              <UserPlus size={18}/> إضافة موظف
            </button>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={thStyle}>الاسم</th>
                <th style={thStyle}>الوظيفة</th>
                <th style={thStyle}>الراتب</th>
                <th style={thStyle}>الهاتف</th>
                <th style={{...thStyle, textAlign:'center'}}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={tableRowStyle}>
                  <td style={{...tdStyle, fontWeight:'bold'}}>{emp.name}</td>
                  <td style={tdStyle}>{emp.position}</td>
                  <td style={{...tdStyle, color:'#10b981'}}>{emp.salary} ج.م</td>
                  <td style={tdStyle}>{emp.phone}</td>
                  <td style={{...tdStyle, textAlign:'center'}}>
                    <div style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                      <button onClick={()=>setEmployeeModal({mode:'edit', data:emp})} style={editIconBtn}><Edit size={16}/></button>
                      <button onClick={()=>handleDeleteEmployee(emp.id)} style={deleteIconBtn}><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Add/Edit Employee */}
      {employeeModal && (
        <div style={modalOverlayStyle}>
          <form onSubmit={handleEmployeeSubmit} style={modalContentStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
              <h3 style={{margin:0}}>{employeeModal.mode === 'add' ? 'إضافة موظف' : 'تعديل بيانات'}</h3>
              <button type="button" onClick={()=>setEmployeeModal(null)} style={{background:'none', border:'none', color:'#64748b', cursor:'pointer'}}><X size={20}/></button>
            </div>
            <div style={formColumn}>
              <input placeholder="الاسم" required value={employeeModal.data.name} onChange={e=>setEmployeeModal({...employeeModal, data:{...employeeModal.data, name:e.target.value}})} style={inputStyle} />
              <input placeholder="المسمى الوظيفي" value={employeeModal.data.position} onChange={e=>setEmployeeModal({...employeeModal, data:{...employeeModal.data, position:e.target.value}})} style={inputStyle} />
              <input type="number" placeholder="الراتب" value={employeeModal.data.salary} onChange={e=>setEmployeeModal({...employeeModal, data:{...employeeModal.data, salary:e.target.value}})} style={inputStyle} />
              <input placeholder="الهاتف" value={employeeModal.data.phone} onChange={e=>setEmployeeModal({...employeeModal, data:{...employeeModal.data, phone:e.target.value}})} style={inputStyle} />
              <button type="submit" style={btnPrimary}>حفظ البيانات</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

// --- Styles ---
const tabContainerStyle = { display: 'flex', background: '#0f172a', padding: '5px', borderRadius: '12px', border: '1px solid #1e293b' };
const tabButtonStyle = (a) => ({ background: a ? '#3b82f6' : 'transparent', color: a ? '#fff' : '#94a3b8', border:'none', padding:'8px 20px', borderRadius:'10px', cursor:'pointer', fontWeight:'bold' });
const cardStyle = { background: '#0f172a', padding: '25px', borderRadius: '24px', border: '1px solid #1e293b' };
const cardTitle = { margin: '0 0 20px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' };
const inputStyle = { width: '100%', padding: '12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff', outline: 'none' };
const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tableHeaderRow = { textAlign: 'right', color: '#94a3b8', borderBottom: '2px solid #1e293b' };
const thStyle = { padding: '15px 10px' };
const tableRowStyle = { borderBottom: '1px solid #1e293b' };
const tdStyle = { padding: '15px 10px' };
const recordItemStyle = { display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #1e293b', alignItems: 'center' };
const timeBadgeStyle = { background: '#1e293b', padding: '6px 12px', borderRadius: '8px', color: '#3b82f6', fontWeight: 'bold' };
const countBadgeStyle = { background: '#3b82f620', color: '#3b82f6', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' };
const editIconBtn = { background: '#3b82f615', border: 'none', color: '#3b82f6', padding: '8px', borderRadius: '8px', cursor: 'pointer' };
const saveIconBtn = { background: '#10b98115', border: 'none', color: '#10b981', padding: '8px', borderRadius: '8px', cursor: 'pointer' };
const deleteIconBtn = { background: '#ef444415', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' };
const labelStyle = { fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block' };
const smallInputStyle = { ...inputStyle, padding: '5px', width: '85px', fontSize: '12px' };
const formColumn = { display: 'flex', flexDirection: 'column', gap: '12px' };
const filterHeaderStyle = { display: 'flex', gap: '15px', marginBottom: '25px', alignItems: 'flex-end' };
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' };
const modalContentStyle = { background: '#0f172a', padding: '30px', borderRadius: '24px', width: '400px', border: '1px solid #1e293b' };

export default AttendanceSystem;