// EmployeeReports.jsx
import { useState, useEffect } from "react";
import { getDb } from "../lib/db";

const CommissionReport = () => {
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadEmployeeStats = async () => {
    try {
      const db = await getDb();
      const rows = await db.select(
        `SELECT 
          e.id,
          e.name,
          e.commission_rate,
          COALESCE(ess.total_sales, 0) as total_sales,
          COALESCE(ess.invoice_count, 0) as invoice_count,
          COALESCE(ess.total_commission, 0) as total_commission
         FROM employees e
         LEFT JOIN employee_sales_stats ess ON ess.employee_id = e.id 
           AND ess.month = $1 AND ess.year = $2
         WHERE e.is_active = 1
         ORDER BY total_sales DESC`,
        [selectedMonth, selectedYear]
      );
      setMonthlyStats(rows || []);
    } catch (error) {
      console.error("Error loading employee stats:", error);
    }
  };

  useEffect(() => {
    loadEmployeeStats();
  }, [selectedMonth, selectedYear]);

  const totalSales = monthlyStats.reduce((sum, emp) => sum + emp.total_sales, 0);
  const totalCommission = monthlyStats.reduce((sum, emp) => sum + emp.total_commission, 0);

  return (
    <div className="ei-root" dir="rtl">
      <div className="page-header">
        <h2>تقارير المبيعات - الموظفين</h2>
        <div className="filters">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i, 1).toLocaleDateString("ar-EG", { month: "long" })}
              </option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="summary-cards">
        <div className="card">
          <h3>إجمالي المبيعات</h3>
          <div className="amount">{totalSales.toFixed(2)} ج.م</div>
        </div>
        <div className="card">
          <h3>إجمالي العمولات</h3>
          <div className="amount">{totalCommission.toFixed(2)} ج.م</div>
        </div>
      </div>

      <table className="custom-table">
        <thead>
          <tr>
            <th>الموظف</th>
            <th>نسبة العمولة</th>
            <th>عدد الفواتير</th>
            <th>إجمالي المبيعات</th>
            <th>قيمة العمولة</th>
          </tr>
        </thead>
        <tbody>
          {monthlyStats.map(emp => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{emp.commission_rate}%</td>
              <td>{emp.invoice_count}</td>
              <td>{emp.total_sales.toFixed(2)} ج.م</td>
              <td style={{ color: "var(--accent)" }}>{emp.total_commission.toFixed(2)} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CommissionReport;