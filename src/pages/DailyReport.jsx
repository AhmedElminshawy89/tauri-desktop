import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Calendar,
  DollarSign,
  ShoppingCart,
  Truck,
  TrendingDown,
  RotateCcw,
  Users,
  Eye,
  X,
  Package,
  CreditCard,
  HandCoins,
  Repeat,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const DailyReport = ({ showToast }) => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [returns, setReturns] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalReturns: 0,
    netProfit: 0,
    invoiceCount: 0,
    purchaseCount: 0,
    presentEmployees: 0,
  });
  const [salesDetails, setSalesDetails] = useState({});
  const [purchaseDetails, setPurchaseDetails] = useState({});

  const [detailsModal, setDetailsModal] = useState({ open: false, type: null, data: [], title: "" });
  const [singleModal, setSingleModal] = useState({ open: false, type: null, data: null, details: null });

  const fetchSalesInvoiceDetails = async (invoiceId) => {
    if (salesDetails[invoiceId]) return salesDetails[invoiceId];
    const db = await getDb();
    const items = await db.select(
      `SELECT ii.*, p.name as product_name, pv.size, pv.color
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       LEFT JOIN product_variants pv ON ii.variant_id = pv.id
       WHERE ii.invoice_id = ?`,
      [invoiceId]
    );
    const payments = await db.select(
      "SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date ASC",
      [invoiceId]
    );
    const details = { items, payments };
    setSalesDetails(prev => ({ ...prev, [invoiceId]: details }));
    return details;
  };

  const fetchPurchaseInvoiceDetails = async (purchaseId) => {
    if (purchaseDetails[purchaseId]) return purchaseDetails[purchaseId];
    const db = await getDb();
    const items = await db.select(
      `SELECT pi.*, pv.variant_barcode, p.name as product_name
       FROM purchase_items pi
       LEFT JOIN product_variants pv ON pi.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       WHERE pi.purchase_order_id = ?`,
      [purchaseId]
    );
    const details = { items };
    setPurchaseDetails(prev => ({ ...prev, [purchaseId]: details }));
    return details;
  };

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const salesRes = await db.select(
        `SELECT i.*, e.name as seller_name
         FROM invoices i
         LEFT JOIN employees e ON i.seller_id = e.id
         WHERE i.status = 'completed' AND date(i.created_at) = date(?)
         ORDER BY i.id DESC`,
        [reportDate]
      );
      setSales(salesRes || []);

      const purchasesRes = await db.select(
        `SELECT po.*, s.name as supplier_name
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         WHERE date(po.purchase_date) = date(?)
         ORDER BY po.id DESC`,
        [reportDate]
      );
      setPurchases(purchasesRes || []);

      const expensesRes = await db.select(
        `SELECT e.*, ec.name as category_name
         FROM expenses e
         LEFT JOIN expense_categories ec ON e.category_id = ec.id
         WHERE date(e.expense_date) = date(?)
         ORDER BY e.expense_date DESC`,
        [reportDate]
      );
      setExpenses(expensesRes || []);

      const returnsRes = await db.select(
        `SELECT r.*, i.customer_name, i.invoice_number
         FROM returns r
         JOIN invoices i ON r.invoice_id = i.id
         WHERE date(r.return_date) = date(?)
         ORDER BY r.return_date DESC`,
        [reportDate]
      );
      setReturns(returnsRes || []);

      const attendanceRes = await db.select(
        `SELECT a.*, e.name as employee_name, e.position
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
         WHERE a.date = ?
         ORDER BY a.check_in ASC`,
        [reportDate]
      );
      setAttendance(attendanceRes || []);

      const totalSales = salesRes.reduce((s, inv) => s + (inv.total_after_discount || 0), 0);
      const totalPurchases = purchasesRes.reduce((s, po) => s + (po.total_amount || 0), 0);
      const totalExpenses = expensesRes.reduce((s, exp) => s + (exp.amount || 0), 0);
      const totalReturns = returnsRes.reduce((s, ret) => s + (ret.amount || 0), 0);
      const netProfit = totalSales - totalPurchases - totalExpenses - totalReturns;

      setSummary({
        totalSales,
        totalPurchases,
        totalExpenses,
        totalReturns,
        netProfit,
        invoiceCount: salesRes.length,
        purchaseCount: purchasesRes.length,
        presentEmployees: attendanceRes.length,
      });

      for (const inv of salesRes) {
        await fetchSalesInvoiceDetails(inv.id);
      }
      for (const po of purchasesRes) {
        await fetchPurchaseInvoiceDetails(po.id);
      }
    } catch (err) {
      console.error(err);
      showToast?.("خطأ في تحميل التقرير", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyReport();
  }, [reportDate]);

  const openDetailsModal = (type, data, title) => {
    setDetailsModal({ open: true, type, data, title });
  };

  const openSingleModal = async (type, record) => {
    let details = null;
    if (type === 'sale') details = await fetchSalesInvoiceDetails(record.id);
    if (type === 'purchase') details = await fetchPurchaseInvoiceDetails(record.id);
    setSingleModal({ open: true, type, data: record, details });
  };

  const closeModals = () => {
    setDetailsModal({ open: false, type: null, data: [], title: "" });
    setSingleModal({ open: false, type: null, data: null, details: null });
  };

  const generatePDF = () => {
    const shopName = "كودينج كورنر ستور";
    const reportTitle = `التقرير اليومي - ${new Date(reportDate).toLocaleDateString("ar-EG")}`;

    const salesWithItems = sales.map(inv => ({
      ...inv,
      items: salesDetails[inv.id]?.items || [],
      payments: salesDetails[inv.id]?.payments || []
    }));

    const purchasesWithItems = purchases.map(po => ({
      ...po,
      items: purchaseDetails[po.id]?.items || []
    }));

    const htmlContent = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
      margin: 0;
      padding: 20px;
      color: #1e293b;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3b82f6;
    }
    .shop-name {
      font-size: 26px;
      font-weight: bold;
      color: #0f172a;
    }
    .report-title {
      font-size: 20px;
      color: #475569;
      margin-top: 8px;
    }
    .date {
      font-size: 14px;
      color: #64748b;
      margin-top: 5px;
    }
    .summary-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 30px;
      justify-content: space-between;
    }
    .summary-card {
      flex: 1;
      min-width: 150px;
      background: #f8fafc;
      border-radius: 16px;
      padding: 15px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .summary-label {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .summary-value {
      font-size: 22px;
      font-weight: bold;
    }
    .profit-positive { color: #10b981; }
    .profit-negative { color: #ef4444; }
    .section {
      margin-top: 30px;
      break-inside: avoid;
    }
    .section-title {
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      border-right: 4px solid #3b82f6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: right;
      vertical-align: top;
    }
    th {
      background: #e2e8f0;
      font-weight: 600;
    }
    .sub-table {
      margin-top: 10px;
      margin-bottom: 5px;
      background: #fefce8;
    }
    .sub-table th {
      background: #fde047;
      font-size: 12px;
    }
    .invoice-row {
      background: #ffffff;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 100%;
      }
      .summary-grid {
        break-inside: avoid;
      }
      .section {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="shop-name">${shopName}</div>
    <div class="report-title">التقرير اليومي التفصيلي</div>
    <div class="date">${new Date(reportDate).toLocaleDateString("ar-EG")}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card"><div class="summary-label">إجمالي المبيعات</div><div class="summary-value">${fmt(summary.totalSales)}</div><div>${summary.invoiceCount} فاتورة</div></div>
    <div class="summary-card"><div class="summary-label">إجمالي المشتريات</div><div class="summary-value">${fmt(summary.totalPurchases)}</div><div>${summary.purchaseCount} فاتورة</div></div>
    <div class="summary-card"><div class="summary-label">المصروفات</div><div class="summary-value">${fmt(summary.totalExpenses)}</div></div>
    <div class="summary-card"><div class="summary-label">المرتجعات</div><div class="summary-value">${fmt(summary.totalReturns)}</div></div>
    <div class="summary-card"><div class="summary-label">صافي الربح</div><div class="summary-value ${summary.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${fmt(summary.netProfit)}</div></div>
    <div class="summary-card"><div class="summary-label">حضور الموظفين</div><div class="summary-value">${summary.presentEmployees}</div></div>
  </div>

  <!-- المبيعات -->
  <div class="section">
    <div class="section-title">📊 فواتير المبيعات</div>
    ${salesWithItems.length === 0 ? '<p>لا توجد مبيعات</p>' : `
     <table>
        <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>طريقة الدفع</th><th>الإجمالي</th><th>البائع</th></tr></thead>
        <tbody>
          ${salesWithItems.map(inv => `
            <tr class="invoice-row">
              <td>#${inv.invoice_number}</td>
              <td>${inv.customer_name || 'عميل نقدي'}</td>
              <td>${inv.payment_method === 'cash' ? 'كاش' : inv.payment_method === 'visa' ? 'فيزا' : 'تقسيط'}</td>
              <td>${fmt(inv.total_after_discount)}</td>
              <td>${inv.seller_name || '—'}</td>
            </tr>
            ${inv.items.length ? `
              <tr><td colspan="5" style="padding:0;">
                <table class="sub-table">
                  <thead><tr><th>المنتج</th><th>المقاس/اللون</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    ${inv.items.map(item => `
                      <tr>
                        <td>${item.product_name}</td>
                        <td>${item.size || ''} ${item.color || ''}</td>
                        <td>${item.quantity}</td>
                        <td>${fmt(item.unit_price)}</td>
                        <td>${fmt(item.quantity * item.unit_price)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </td></tr>
            ` : ''}
          `).join('')}
        </tbody>
      </table>
    `}
  </div>

  <!-- المشتريات -->
  <div class="section">
    <div class="section-title">🚚 فواتير المشتريات</div>
    ${purchasesWithItems.length === 0 ? '<p>لا توجد مشتريات</p>' : `
      <table>
        <thead><tr><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
        <tbody>
          ${purchasesWithItems.map(po => `
            <tr class="invoice-row">
              <td>${po.supplier_name}</td>
              <td>${fmt(po.total_amount)}</td>
              <td>${fmt(po.paid_amount)}</td>
              <td class="${po.total_amount - po.paid_amount > 0 ? 'profit-negative' : 'profit-positive'}">${fmt(po.total_amount - po.paid_amount)}</td>
            </tr>
            ${po.items.length ? `
              <tr><td colspan="4" style="padding:0;">
                <table class="sub-table">
                  <thead><tr><th>المنتج</th><th>الكمية</th><th>سعر التكلفة</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    ${po.items.map(item => `
                      <tr>
                        <td>${item.product_name || 'منتج'}</td>
                        <td>${item.quantity}</td>
                        <td>${fmt(item.cost_price)}</td>
                        <td>${fmt(item.quantity * item.cost_price)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </td></tr>
            ` : ''}
          `).join('')}
        </tbody>
      </table>
    `}
  </div>

  <!-- المصروفات -->
  <div class="section">
    <div class="section-title">💰 المصروفات</div>
    ${expenses.length === 0 ? '<p>لا توجد مصروفات</p>' : `
      <table>
        <thead><tr><th>التصنيف</th><th>المبلغ</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${expenses.map(exp => `<tr><td>${exp.category_name || 'بدون تصنيف'}</td><td>${fmt(exp.amount)}</td><td>${exp.note || '—'}</td>`).join('')}
        </tbody>
      </table>
    `}
  </div>

  <!-- المرتجعات -->
  <div class="section">
    <div class="section-title">🔄 المرتجعات</div>
    ${returns.length === 0 ? '<p>لا توجد مرتجعات</p>' : `
      <table>
        <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ المسترد</th></tr></thead>
        <tbody>
          ${returns.map(ret => `<td><td>#${ret.invoice_number}</td><td>${ret.customer_name}</td><td>${fmt(ret.amount)}</td>`).join('')}
        </tbody>
      </table>
    `}
  </div>

  <!-- الحضور -->
  <div class="section">
    <div class="section-title">👥 الحضور والانصراف</div>
    ${attendance.length === 0 ? '<p>لا توجد سجلات حضور</p>' : `
      <table>
        <thead><tr><th>الموظف</th><th>الوظيفة</th><th>حضور</th><th>انصراف</th></tr></thead>
        <tbody>
          ${attendance.map(att => `<td><td>${att.employee_name}</td><td>${att.position || '—'}</td><td>${att.check_in}</td><td>${att.check_out || '—'}</td>`).join('')}
        </tbody>
      </table>
    `}
  </div>

  <div class="footer">
    تم إنشاء هذا التقرير بواسطة نظام كودينج كورنر - جميع الحقوق محفوظة
  </div>
</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlContent);
    iframe.contentDocument.close();

    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  };

  const PaymentIcon = ({ method }) => {
    if (method === "cash") return <HandCoins size={14} />;
    if (method === "visa") return <CreditCard size={14} />;
    return <Repeat size={14} />;
  };

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
        .premium-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
        .card-sales .stat-glow { background: #10b981; }
        .card-purchases .stat-glow { background: #8b5cf6; }
        .card-expenses .stat-glow { background: #f97316; }
        .card-returns .stat-glow { background: #ef4444; }
        .card-profit .stat-glow { background: #fbbf24; }
        .card-attendance .stat-glow { background: #ec4899; }
        .stat-content {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
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
        .card-sales .icon-box { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-purchases .icon-box { color: #a78bfa; background: rgba(139,92,246,0.1); }
        .card-expenses .icon-box { color: #fbbf24; background: rgba(249,115,22,0.1); }
        .card-returns .icon-box { color: #f87171; background: rgba(239,68,68,0.1); }
        .card-profit .icon-box { color: #fcd34d; background: rgba(251,191,36,0.1); }
        .card-attendance .icon-box { color: #f472b6; background: rgba(236,72,153,0.1); }
        .stat-details { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; }
        .stat-value { font-size: 20px; font-weight: 700; color: #f8fafc; }
        .stat-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
        .stat-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 6px 14px;
          border-radius: 30px;
          font-size: 12px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
        }
        .stat-btn:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
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
        .main-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
        }
        .sub-title {
          color: #94a3b8;
          font-size: 0.9rem;
          margin: 4px 0 0;
        }
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .search-neon-wrapper {
          position: relative;
        }
        .search-neon-input {
          background: #0b0f19;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 11px 42px 11px 16px;
          width: 220px;
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
        .btn-primary {
          background: #2563eb;
          color: #ffffff;
        }
        .btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .btn-secondary {
          background: #1e293b;
          color: #94a3b8;
        }
        .btn-secondary:hover {
          background: #334155;
          color: white;
        }
        .cyber-table-container {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .cyber-table {
          width: 100%;
          border-collapse: collapse;
          text-align: right;
        }
        .cyber-table th {
          background: rgba(15, 23, 42, 0.8);
          padding: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
        }
        .cyber-table td {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
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
          max-width: 900px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
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
        .modal-cyber-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: white;
        }
        .modal-close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-close-btn:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .cyber-modal-body {
          overflow-y: auto;
          padding: 24px;
        }
        .cyber-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
          background: rgba(30, 41, 59, 0.5);
          padding: 18px;
          border-radius: 16px;
          margin-bottom: 24px;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          border-bottom: 1px dashed #334155;
          padding-bottom: 6px;
        }
        .detail-label {
          color: #94a3b8;
          font-size: 0.85rem;
        }
        .detail-value {
          font-weight: 600;
          color: #f1f5f9;
        }
        .subtitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1rem;
          font-weight: 600;
          margin: 20px 0 12px;
          color: #cbd5e1;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .text-success { color: #10b981; }
        .text-warning { color: #f97316; }
        .clickable-row { cursor: pointer; transition: background 0.1s; }
        .clickable-row:hover { background: rgba(59,130,246,0.08); }
        .eye-icon { opacity: 0.6; transition: 0.2s; }
        .clickable-row:hover .eye-icon { opacity: 1; color: #60a5fa; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">التقرير اليومي التفصيلي</h2>
          <p className="sub-title">عرض شامل لجميع حركات اليوم مع إمكانية التعمق في التفاصيل</p>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper" style={{ width: "auto" }}>
            <div className="date-picker" style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0b0f19", padding: "8px 16px", borderRadius: "40px" }}>
              <Calendar size={18} />
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="search-neon-input" style={{ width: "160px", padding: "4px 8px", background: "transparent", border: "none" }} />
            </div>
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchDailyReport}>
            عرض
          </button>
          <button className="btn-action-neon btn-primary" onClick={generatePDF}>
            طباعة التقرير (PDF)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cyber-table-container" style={{ textAlign: "center", padding: "60px" }}>
          <div className="loader">جاري تحميل التقرير...</div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="premium-stats-grid">
            <div className="premium-stat-card card-sales">
              <div className="stat-glow"></div>
              <div className="stat-content">
                <div className="icon-box"><ShoppingCart size={24} /></div>
                <div className="stat-details">
                  <div className="stat-label">إجمالي المبيعات</div>
                  <div className="stat-value">{fmt(summary.totalSales)}</div>
                  <div className="stat-sub">{summary.invoiceCount} فاتورة</div>
                </div>
                <button className="stat-btn" onClick={() => openDetailsModal('sales', sales, 'فواتير المبيعات')}>التفاصيل</button>
              </div>
            </div>
            <div className="premium-stat-card card-purchases">
              <div className="stat-glow"></div>
              <div className="stat-content">
                <div className="icon-box"><Truck size={24} /></div>
                <div className="stat-details">
                  <div className="stat-label">إجمالي المشتريات</div>
                  <div className="stat-value">{fmt(summary.totalPurchases)}</div>
                  <div className="stat-sub">{summary.purchaseCount} فاتورة</div>
                </div>
                <button className="stat-btn" onClick={() => openDetailsModal('purchases', purchases, 'فواتير المشتريات')}>التفاصيل</button>
              </div>
            </div>
            <div className="premium-stat-card card-expenses">
              <div className="stat-glow"></div>
              <div className="stat-content">
                <div className="icon-box"><TrendingDown size={24} /></div>
                <div className="stat-details">
                  <div className="stat-label">المصروفات</div>
                  <div className="stat-value">{fmt(summary.totalExpenses)}</div>
                  <div className="stat-sub">إجمالي المصروفات</div>
                </div>
                <button className="stat-btn" onClick={() => openDetailsModal('expenses', expenses, 'المصروفات')}>التفاصيل</button>
              </div>
            </div>
            <div className="premium-stat-card card-returns">
              <div className="stat-glow"></div>
              <div className="stat-content">
                <div className="icon-box"><RotateCcw size={24} /></div>
                <div className="stat-details">
                  <div className="stat-label">المرتجعات</div>
                  <div className="stat-value">{fmt(summary.totalReturns)}</div>
                  <div className="stat-sub">إجمالي المسترد</div>
                </div>
                <button className="stat-btn" onClick={() => openDetailsModal('returns', returns, 'المرتجعات')}>التفاصيل</button>
              </div>
            </div>
            <div className="premium-stat-card card-profit">
              <div className="stat-glow"></div>
              <div className="stat-content">
                <div className="icon-box"><DollarSign size={24} /></div>
                <div className="stat-details">
                  <div className="stat-label">صافي الربح</div>
                  <div className="stat-value" style={{ color: summary.netProfit >= 0 ? '#10b981' : '#ef4444' }}>{fmt(summary.netProfit)}</div>
                  <div className="stat-sub">بعد خصم جميع المصروفات</div>
                </div>
              </div>
            </div>
            <div className="premium-stat-card card-attendance">
              <div className="stat-glow"></div>
              <div className="stat-content">
                <div className="icon-box"><Users size={24} /></div>
                <div className="stat-details">
                  <div className="stat-label">الحضور</div>
                  <div className="stat-value">{summary.presentEmployees}</div>
                  <div className="stat-sub">موظف حاضر</div>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="cyber-table-container" style={{ marginTop: "16px" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={18} /> الحضور والانصراف
              </div>
            </div>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الوظيفة</th>
                  <th>حضور</th>
                  <th>انصراف</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>لا توجد سجلات حضور في هذا اليوم</td></tr>
                ) : (
                  attendance.map(att => (
                    <tr key={att.id} className="cyber-row-main">
                      <td>{att.employee_name}</td>
                      <td>{att.position || '—'}</td>
                      <td>{att.check_in}</td>
                      <td>{att.check_out || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: قائمة التفاصيل */}
      {detailsModal.open && (
        <div className="blur-overlay" onClick={closeModals}>
          <div className="cyber-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>{detailsModal.title}</h3>
              <button className="modal-close-btn" onClick={closeModals}><X size={18} /></button>
            </div>
            <div className="cyber-modal-body">
              <div className="cyber-table-container">
                <table className="cyber-table">
                  <thead>
                    {detailsModal.type === 'sales' && (
                      <tr><th>رقم الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>طريقة الدفع</th><th></th></tr>
                    )}
                    {detailsModal.type === 'purchases' && (
                      <tr><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th></th></tr>
                    )}
                    {detailsModal.type === 'expenses' && (
                      <tr><th>التصنيف</th><th>المبلغ</th><th>ملاحظات</th></tr>
                    )}
                    {detailsModal.type === 'returns' && (
                      <tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ المسترد</th></tr>
                    )}
                  </thead>
                  <tbody>
                    {detailsModal.type === 'sales' && detailsModal.data.map(inv => (
                      <tr key={inv.id} className="clickable-row" onClick={() => { closeModals(); openSingleModal('sale', inv); }}>
                        <td>#{inv.invoice_number}</td>
                        <td>{inv.customer_name || 'عميل نقدي'}</td>
                        <td className="text-success">{fmt(inv.total_after_discount)}</td>
                        <td><PaymentIcon method={inv.payment_method} /> {inv.payment_method === 'cash' ? 'كاش' : inv.payment_method === 'visa' ? 'فيزا' : 'تقسيط'}</td>
                        <td><Eye size={16} className="eye-icon" /></td>
                      </tr>
                    ))}
                    {detailsModal.type === 'purchases' && detailsModal.data.map(po => (
                      <tr key={po.id} className="clickable-row" onClick={() => { closeModals(); openSingleModal('purchase', po); }}>
                        <td>{po.supplier_name}</td>
                        <td>{fmt(po.total_amount)}</td>
                        <td>{fmt(po.paid_amount)}</td>
                        <td className={po.total_amount - po.paid_amount > 0 ? 'text-warning' : 'text-success'}>{fmt(po.total_amount - po.paid_amount)}</td>
                        <td><Eye size={16} className="eye-icon" /></td>
                      </tr>
                    ))}
                    {detailsModal.type === 'expenses' && detailsModal.data.map(exp => (
                      <tr key={exp.id}>
                        <td>{exp.category_name || 'بدون تصنيف'}</td>
                        <td className="text-warning">{fmt(exp.amount)}</td>
                        <td>{exp.note || '—'}</td>
                      </tr>
                    ))}
                    {detailsModal.type === 'returns' && detailsModal.data.map(ret => (
                      <tr key={ret.id}>
                        <td>#{ret.invoice_number}</td>
                        <td>{ret.customer_name}</td>
                        <td className="text-warning">{fmt(ret.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="cyber-modal-footer">
              <button className="cyber-btn-dismiss" onClick={closeModals}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تفاصيل فاتورة مفردة */}
      {singleModal.open && (
        <div className="blur-overlay" onClick={closeModals}>
          <div className="cyber-modal wide-modal" style={{ maxWidth: "950px" }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>{singleModal.type === 'sale' ? `تفاصيل فاتورة #${singleModal.data.invoice_number}` : `تفاصيل فاتورة مشتريات #${singleModal.data.id}`}</h3>
              <button className="modal-close-btn" onClick={closeModals}><X size={18} /></button>
            </div>
            <div className="cyber-modal-body">
              {singleModal.type === 'sale' && (
                <>
                  <div className="detail-grid">
                    <div className="detail-item"><span className="detail-label">العميل:</span><span className="detail-value">{singleModal.data.customer_name || 'عميل نقدي'}</span></div>
                    <div className="detail-item"><span className="detail-label">البائع:</span><span className="detail-value">{singleModal.data.seller_name || '—'}</span></div>
                    <div className="detail-item"><span className="detail-label">طريقة الدفع:</span><span className="detail-value">{singleModal.data.payment_method === 'cash' ? 'كاش' : singleModal.data.payment_method === 'visa' ? 'فيزا' : 'تقسيط'}</span></div>
                    <div className="detail-item"><span className="detail-label">التاريخ:</span><span className="detail-value">{new Date(singleModal.data.created_at).toLocaleString()}</span></div>
                    <div className="detail-item"><span className="detail-label">الإجمالي:</span><span className="detail-value text-success">{fmt(singleModal.data.total_after_discount)}</span></div>
                    <div className="detail-item"><span className="detail-label">المدفوع:</span><span className="detail-value">{fmt(singleModal.data.paid_amount || 0)}</span></div>
                  </div>
                  <div className="subtitle"><Package size={16} /> الأصناف</div>
                  <div className="cyber-table-container">
                    <table className="cyber-table">
                      <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                      <tbody>
                        {singleModal.details?.items?.map((it, i) => (
                          <tr key={i}>
                            <td>{it.product_name}</td>
                            <td>{it.quantity}</td>
                            <td>{fmt(it.unit_price)}</td>
                            <td className="text-success">{fmt(it.quantity * it.unit_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {singleModal.details?.payments?.length > 0 && (
                    <>
                      <div className="subtitle mt-3"><HandCoins size={16} /> سجل المدفوعات</div>
                      <div className="cyber-table-container">
                        <table className="cyber-table">
                          <thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr></thead>
                          <tbody>
                            {singleModal.details.payments.map((p, i) => (
                              <tr key={i}>
                                <td>{new Date(p.payment_date).toLocaleString()}</td>
                                <td className="text-success">{fmt(p.amount_paid)}</td>
                                <td>{p.note || 'تحصيل'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
              {singleModal.type === 'purchase' && (
                <>
                  <div className="detail-grid">
                    <div className="detail-item"><span className="detail-label">المورد:</span><span className="detail-value">{singleModal.data.supplier_name}</span></div>
                    <div className="detail-item"><span className="detail-label">التاريخ:</span><span className="detail-value">{new Date(singleModal.data.purchase_date).toLocaleDateString()}</span></div>
                    <div className="detail-item"><span className="detail-label">الإجمالي:</span><span className="detail-value">{fmt(singleModal.data.total_amount)}</span></div>
                    <div className="detail-item"><span className="detail-label">المدفوع:</span><span className="detail-value">{fmt(singleModal.data.paid_amount)}</span></div>
                    <div className="detail-item"><span className="detail-label">المتبقي:</span><span className="detail-value text-warning">{fmt(singleModal.data.total_amount - singleModal.data.paid_amount)}</span></div>
                  </div>
                  <div className="subtitle"><Package size={16} /> الأصناف</div>
                  <div className="cyber-table-container">
                    <table className="cyber-table">
                      <thead><tr><th>المنتج</th><th>الكمية</th><th>سعر التكلفة</th><th>الإجمالي</th></tr></thead>
                      <tbody>
                        {singleModal.details?.items?.map((it, i) => (
                          <tr key={i}>
                            <td>{it.product_name || 'منتج'}</td>
                            <td>{it.quantity}</td>
                            <td>{fmt(it.cost_price)}</td>
                            <td>{fmt(it.quantity * it.cost_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="cyber-modal-footer">
              <button className="cyber-btn-dismiss" onClick={closeModals}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReport;