import React, {
  useState,
  useEffect,
  useMemo,
  Fragment,
  useCallback,
} from "react";
import { getDb } from "../lib/db";
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  FileText,
  TrendingUp,
  Truck,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Banknote,
  X,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const fmtCurrency = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const SuppliersDuesPage = ({ showToast }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [purchaseDetails, setPurchaseDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  // حالة توسيع الفواتير
  const [expandedPurchases, setExpandedPurchases] = useState(new Set());

  // حالة مودال الدفع
  const [paymentModal, setPaymentModal] = useState({
    show: false,
    purchaseId: null,
    supplierId: null,
    supplierName: "",
    remainingAmount: 0,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const togglePurchaseExpand = useCallback((purchaseId) => {
    setExpandedPurchases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(purchaseId)) newSet.delete(purchaseId);
      else newSet.add(purchaseId);
      return newSet;
    });
  }, []);

  // جلب بيانات الموردين
  const fetchSuppliersData = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const tables = await db.select(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('suppliers', 'purchase_orders')
      `);

      const hasSuppliers = tables.some((t) => t.name === "suppliers");
      if (!hasSuppliers) {
        showToast?.("جدول الموردين غير موجود في قاعدة البيانات", "error");
        setSuppliers([]);
        setLoading(false);
        return;
      }

      const rows = await db.select(`
        SELECT 
          s.id,
          s.name,
          s.phone,
          COALESCE(SUM(po.total_amount), 0) as total_purchases,
          COALESCE(SUM(po.paid_amount), 0) as total_paid,
          COUNT(po.id) as purchase_count
        FROM suppliers s
        LEFT JOIN purchase_orders po ON po.supplier_id = s.id
        GROUP BY s.id
        ORDER BY (COALESCE(SUM(po.total_amount), 0) - COALESCE(SUM(po.paid_amount), 0)) DESC
      `);

      const suppliersWithDues = rows.map((sup) => ({
        ...sup,
        remaining: (sup.total_purchases || 0) - (sup.total_paid || 0),
      }));

      setSuppliers(suppliersWithDues);
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      showToast?.(
        "خطأ في تحميل بيانات الموردين: " + (err.message || "غير معروف"),
        "error"
      );
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  // جلب تفاصيل فواتير المشتريات لمورد معين
  const fetchSupplierPurchases = async (supplierId) => {
    if (purchaseDetails[supplierId]) return;

    setLoadingDetails((prev) => ({ ...prev, [supplierId]: true }));
    try {
      const db = await getDb();

      const hasPurchaseOrders = await db.select(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='purchase_orders'
      `);

      if (!hasPurchaseOrders.length) {
        setPurchaseDetails((prev) => ({ ...prev, [supplierId]: [] }));
        setLoadingDetails((prev) => ({ ...prev, [supplierId]: false }));
        return;
      }

      const purchases = await db.select(
        `
        SELECT 
          po.id,
          po.purchase_date,
          po.total_amount,
          po.paid_amount,
          (po.total_amount - po.paid_amount) as remaining_amount
        FROM purchase_orders po
        WHERE po.supplier_id = ?
        ORDER BY po.purchase_date DESC
      `,
        [supplierId]
      );

      const hasSupplierPayments = await db.select(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='supplier_payments'
      `);

      const purchasesWithPayments = await Promise.all(
        purchases.map(async (po) => {
          let payments = [];
          if (hasSupplierPayments.length) {
            payments = await db.select(
              `
            SELECT id, amount, payment_method, paid_at, note, status, due_date, installment_number
            FROM supplier_payments
            WHERE purchase_order_id = ?
            ORDER BY COALESCE(paid_at, due_date) ASC
          `,
              [po.id]
            );
          }
          return { ...po, payments };
        })
      );

      setPurchaseDetails((prev) => ({
        ...prev,
        [supplierId]: purchasesWithPayments,
      }));
    } catch (err) {
      console.error("Error fetching purchases:", err);
      showToast?.("خطأ في تحميل تفاصيل المشتريات", "error");
      setPurchaseDetails((prev) => ({ ...prev, [supplierId]: [] }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [supplierId]: false }));
    }
  };

  useEffect(() => {
    fetchSuppliersData();
  }, []);

  const toggleExpand = async (supplierId) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
    } else {
      setExpandedSupplier(supplierId);
      if (!purchaseDetails[supplierId]) {
        await fetchSupplierPurchases(supplierId);
      }
    }
  };

  // فتح مودال الدفع
  const openPaymentModal = (purchase) => {
    setPaymentModal({
      show: true,
      purchaseId: purchase.id,
      supplierId: purchase.supplier_id,
      supplierName: purchase.supplier_name || "",
      remainingAmount: purchase.remaining_amount,
    });
    setPaymentForm({ amount: "", method: "cash", note: "" });
  };

  // تنفيذ الدفع
  const handlePayment = async () => {
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      showToast?.("يرجى إدخال مبلغ صحيح", "error");
      return;
    }
    if (amount > paymentModal.remainingAmount) {
      showToast?.("المبلغ أكبر من المتبقي المستحق", "error");
      return;
    }

    setSubmitting(true);
    try {
      const db = await getDb();

      // إدخال سجل الدفعة
      await db.execute(
        `
        INSERT INTO supplier_payments
        (purchase_order_id, supplier_id, amount, payment_method, note, paid_at, status)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'paid')
      `,
        [
          paymentModal.purchaseId,
          paymentModal.supplierId,
          amount,
          paymentForm.method,
          paymentForm.note || null,
        ]
      );

      // تحديث المبلغ المدفوع في purchase_orders
      const purchase = await db.select(
        "SELECT paid_amount FROM purchase_orders WHERE id = ?",
        [paymentModal.purchaseId]
      );
      const newPaid = (purchase[0]?.paid_amount || 0) + amount;
      await db.execute(
        "UPDATE purchase_orders SET paid_amount = ? WHERE id = ?",
        [newPaid, paymentModal.purchaseId]
      );

      showToast?.("تم تسجيل الدفعة بنجاح", "success");

      // إعادة تحميل البيانات: تحديث ملخص الموردين وتفاصيل المورد الحالي
      await fetchSuppliersData();
      if (paymentModal.supplierId) {
        // مسح التفاصيل المخزنة لإعادة تحميلها محدثة
        setPurchaseDetails((prev) => {
          const newDetails = { ...prev };
          delete newDetails[paymentModal.supplierId];
          return newDetails;
        });
        await fetchSupplierPurchases(paymentModal.supplierId);
        // إذا كان المورد مفتوحاً حالياً، نبقيه مفتوحاً
        if (expandedSupplier === paymentModal.supplierId) {
          setExpandedSupplier(paymentModal.supplierId);
        }
      }

      setPaymentModal({
        show: false,
        purchaseId: null,
        supplierId: null,
        supplierName: "",
        remainingAmount: 0,
      });
    } catch (err) {
      console.error(err);
      showToast?.("فشل تسجيل الدفعة: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        (s.phone && s.phone.includes(term))
    );
  }, [suppliers, searchTerm]);

  const summary = useMemo(() => {
    const totalPurchases = filteredSuppliers.reduce(
      (s, sup) => s + (sup.total_purchases || 0),
      0
    );
    const totalPaid = filteredSuppliers.reduce(
      (s, sup) => s + (sup.total_paid || 0),
      0
    );
    const totalRemaining = totalPurchases - totalPaid;
    const suppliersWithDebt = filteredSuppliers.filter(
      (sup) => (sup.remaining || 0) > 0.5
    ).length;
    return { totalPurchases, totalPaid, totalRemaining, suppliersWithDebt };
  }, [filteredSuppliers]);

  const getProgressPercent = (paid, total) => {
    if (total === 0) return 0;
    return Math.min(100, (paid / total) * 100);
  };

  if (loading && suppliers.length === 0) {
    return (
      <div
        className="page-container animate-fade-in"
        style={{ textAlign: "center", padding: "80px" }}
      >
        <Loader2 size={40} className="spin" style={{ color: "#8b5cf6" }} />
        <p style={{ marginTop: 16, color: "#94a3b8" }}>
          جاري تحميل بيانات الموردين...
        </p>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        /* نفس الأنماط السابقة مع إضافة أنماط المودال */
        .page-container { padding: 24px; background: transparent; min-height: 100vh; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
        .premium-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 32px; }
        .premium-stat-card { position: relative; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 16px; padding: 18px 20px; overflow: hidden; transition: all 0.3s ease; }
        .premium-stat-card:hover { transform: translateY(-4px); border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.6); }
        .stat-glow { position: absolute; width: 80px; height: 80px; border-radius: 50%; top: -20px; right: -20px; filter: blur(40px); opacity: 0.15; transition: opacity 0.3s ease; }
        .premium-stat-card:hover .stat-glow { opacity: 0.3; }
        .card-purple .stat-glow { background: #8b5cf6; }
        .card-green .stat-glow { background: #10b981; }
        .card-orange .stat-glow { background: #f59e0b; }
        .card-blue .stat-glow { background: #3b82f6; }
        .stat-content { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
        .stat-left { flex: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
        .stat-value { font-size: 22px; font-weight: 700; color: #f8fafc; }
        .stat-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
        .card-purple .stat-icon { color: #a78bfa; background: rgba(139,92,246,0.1); }
        .card-green .stat-icon { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-orange .stat-icon { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .card-blue .stat-icon { color: #60a5fa; background: rgba(59,130,246,0.1); }
        
        .page-header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 20px 28px; background: rgba(30, 41, 59, 0.3); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(8px); }
        .hero-icon { background: linear-gradient(135deg, #8b5cf6, #6d28d9); padding: 12px; border-radius: 16px; box-shadow: 0 0 20px rgba(139,92,246,0.25); display: inline-flex; align-items: center; justify-content: center; margin-left: 16px; }
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .header-actions-group { display: flex; gap: 12px; align-items: center; }
        .search-neon-wrapper { position: relative; }
        .search-neon-input { background: #0b0f19; border: 1px solid #1e293b; border-radius: 40px; padding: 8px 40px 8px 16px; width: 260px; color: #f1f5f9; font-size: 0.85rem; outline: none; transition: all 0.2s; }
        .search-neon-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
        .search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; }
        .btn-action-neon { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 40px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; border: none; background: #1e293b; color: #94a3b8; }
        .btn-action-neon:hover { background: #334155; color: white; }
        .btn-primary { background: #8b5cf6; color: white; }
        .btn-primary:hover { background: #7c3aed; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(139,92,246,0.3); }
        .btn-pay { background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;margin-right: 12px;
    border: none; }
        .btn-pay:hover { background: #059669; transform: translateY(-1px); }
        .cyber-table-container { background: rgba(15, 23, 42, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: right; }
        .cyber-table th { background: rgba(15, 23, 42, 0.8); padding: 16px; font-size: 13px; font-weight: 600; color: #94a3b8; border-bottom: 1px solid #1e293b; }
        .cyber-table td { padding: 14px 16px; border-bottom: 1px solid rgba(30,41,59,0.5); }
        .cyber-row-main:hover { background: rgba(30, 41, 59, 0.3); }
        .supplier-row { cursor: pointer; }
        .supplier-row.active { background: rgba(139,92,246,0.08); }
        .expand-cell { text-align: center; color: #64748b; width: 40px; }
        .arrow-icon { transition: transform 0.2s; display: inline-flex; }
        .arrow-icon.rotated { transform: rotate(-90deg); color: #a78bfa; }
        .debt-positive { color: #f59e0b; font-weight: 700; }
        .debt-zero { color: #34d399; font-weight: 700; }
        .progress-bar-bg { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
        .badge-pending { background: rgba(245,158,11,0.15); color: #fbbf24; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .expandable-row { background: rgba(0,0,0,0.2); }
        .expandable-row td { padding: 0 !important; }
        .expandable-container { padding: 20px 28px; border-top: 1px solid rgba(139,92,246,0.15); }
        .sub-title { font-size: 13px; font-weight: 700; color: #94a3b8; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .purchase-card { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
        .purchase-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; cursor: pointer; background: rgba(255,255,255,0.02); }
        .purchase-details { padding: 16px 18px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.15); }
        .payment-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .payment-row:last-child { border-bottom: none; }
        .payment-amount { color: #34d399; font-weight: 700; }
        .pending-payment { background: rgba(245,158,11,0.1); border-right: 3px solid #f59e0b; }
        .empty-row { text-align: center; padding: 50px !important; color: #64748b; }
        .sub-loading { text-align: center; padding: 20px; color: #64748b; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .font-numeric { font-variant-numeric: tabular-nums; }
        .supplier-name { font-weight: 600; color: #f1f5f9; }
        .supplier-phone { color: #64748b; font-size: 12px; }
        .badge-count { background: rgba(255,255,255,0.05); border-radius: 20px; padding: 2px 8px; font-size: 11px; color: #94a3b8; }

        /* مودال الدفع */
        .blur-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(5, 8, 16, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
        .cyber-modal { background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; width: 100%; max-width: 480px; overflow: hidden; }
        .modal-cyber-header { padding: 18px 24px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
        .modal-cyber-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: white; }
        .modal-close-btn { background: none; border: none; color: #64748b; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .cyber-modal-body { padding: 24px; }
        .cyber-modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: flex-end; gap: 12px; }
        .cyber-input-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .cyber-input-group label { font-size: 13px; color: #94a3b8; }
        .cyber-input-group input, .cyber-input-group select { background: #070a12; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; color: white; font-size: 14px; transition: border 0.2s ease; }
        .cyber-input-group input:focus, .cyber-input-group select:focus { border-color: #2563eb; outline: none; }
        .cyber-btn-submit { flex: 1; padding: 12px; border-radius: 10px; background: #10b981; color: white; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-submit:hover { background: #059669; }
        .cyber-btn-dismiss { padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #94a3b8; font-weight: 600; border: none; cursor: pointer; }
        .cyber-btn-dismiss:hover { background: #334155; color: white; }
      `}</style>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="hero-icon">
              <Truck size={28} />
            </div>
            <div>
              <h2 className="main-title">مستحقات الموردين</h2>
              <p className="sub-title">
                إدارة المبالغ المستحقة للموردين وتتبع المدفوعات
              </p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="بحث باسم المورد أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
            />
            <Search size={15} className="search-icon" />
          </div>
          <button
            className="btn-action-neon btn-primary"
            onClick={fetchSuppliersData}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            تحديث
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-purple">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المشتريات</div>
              <div className="stat-value">
                {fmtCurrency(summary.totalPurchases)}
              </div>
            </div>
            <div className="stat-icon">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-green">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">إجمالي المدفوع</div>
              <div className="stat-value">{fmtCurrency(summary.totalPaid)}</div>
            </div>
            <div className="stat-icon">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-orange">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">المتبقي (المستحق)</div>
              <div className="stat-value">
                {fmtCurrency(summary.totalRemaining)}
              </div>
            </div>
            <div className="stat-icon">
              <AlertCircle size={20} />
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">موردين عليهم متبقي</div>
              <div className="stat-value">{summary.suppliersWithDebt}</div>
            </div>
            <div className="stat-icon">
              <Wallet size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>المورد</th>
              <th>عدد الفواتير</th>
              <th>إجمالي المشتريات</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>نسبة السداد</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length === 0 ? (
              <tr className="cyber-row-main">
                <td colSpan="7" className="empty-row">
                  لا توجد بيانات موردين متاحة
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((sup) => {
                const isExpanded = expandedSupplier === sup.id;
                const percent = getProgressPercent(
                  sup.total_paid,
                  sup.total_purchases
                );
                const hasDebt = (sup.remaining || 0) > 0.5;
                const isLoadingDetail = loadingDetails[sup.id];
                const purchases = purchaseDetails[sup.id] || [];

                return (
                  <Fragment key={sup.id}>
                    <tr
                      className={`cyber-row-main supplier-row ${isExpanded ? "active" : ""}`}
                      onClick={() => toggleExpand(sup.id)}
                    >
                      <td className="expand-cell">
                        <div
                          className={`arrow-icon ${isExpanded ? "rotated" : ""}`}
                        >
                          <ChevronLeft size={16} />
                        </div>
                      </td>
                      <td>
                        <div className="supplier-name">
                          {sup.name || "بدون اسم"}
                        </div>
                        {sup.phone && (
                          <div className="supplier-phone">{sup.phone}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge-count">
                          {sup.purchase_count || 0} فاتورة
                        </span>
                      </td>
                      <td className="font-numeric">
                        {fmtCurrency(sup.total_purchases || 0)}
                      </td>
                      <td className="font-numeric" style={{ color: "#34d399" }}>
                        {fmtCurrency(sup.total_paid || 0)}
                      </td>
                      <td
                        className={`font-numeric ${hasDebt ? "debt-positive" : "debt-zero"}`}
                      >
                        {hasDebt ? fmtCurrency(sup.remaining) : "مسدد بالكامل"}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            className="progress-bar-bg"
                            style={{ width: 100 }}
                          >
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${percent}%`,
                                background:
                                  percent >= 80
                                    ? "#10b981"
                                    : percent >= 50
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              minWidth: 40,
                            }}
                          >
                            {percent.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expandable-row">
                        <td colSpan="7">
                          <div className="expandable-container">
                            <div className="sub-title">
                              <FileText size={14} />{" "}
                              <span>فواتير المشتريات والمدفوعات</span>
                            </div>
                            {isLoadingDetail ? (
                              <div className="sub-loading">
                                <Loader2
                                  size={18}
                                  className="spin"
                                  style={{ marginLeft: 8 }}
                                />{" "}
                                جاري تحميل الفواتير...
                              </div>
                            ) : purchases.length === 0 ? (
                              <div className="sub-loading">
                                لا توجد فواتير مشتريات لهذا المورد
                              </div>
                            ) : (
                              purchases.map((po) => {
                                const isPoExpanded = expandedPurchases.has(
                                  po.id
                                );
                                return (
                                  <div key={po.id} className="purchase-card">
                                    <div
                                      className="purchase-header"
                                      onClick={() =>
                                        togglePurchaseExpand(po.id)
                                      }
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600 }}>
                                          فاتورة #{po.id}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: "#64748b",
                                          }}
                                        >
                                          {po.purchase_date
                                            ? new Date(
                                                po.purchase_date
                                              ).toLocaleDateString("ar-EG")
                                            : "—"}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 20,
                                          alignItems: "center",
                                        }}
                                      >
                                        <div style={{ textAlign: "left",display: "flex",
                                          gap: 20,
                                          alignItems: "center", }}>
                                          <div>
                                            الإجمالي:{" "}
                                            <span
                                              className="font-numeric"
                                              style={{ color: "#60a5fa" }}
                                            >
                                              {fmtCurrency(po.total_amount)}
                                            </span>
                                          </div>
                                          <div>
                                            المدفوع:{" "}
                                            <span
                                              className="font-numeric"
                                              style={{ color: "#34d399" }}
                                            >
                                              {fmtCurrency(po.paid_amount)}
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ textAlign: "left", display: "flex",
                                          gap: 20,
                                          alignItems: "center", }}>
                                          <div>
                                            المتبقي:{" "}
                                            <span
                                              className={`font-numeric ${(po.remaining_amount || 0) > 0 ? "debt-positive" : "debt-zero"}`}
                                            >
                                              {fmtCurrency(po.remaining_amount)}
                                            </span>
                                          </div>
                                          {(po.remaining_amount || 0) > 0.5 && (

                                          <button
                                            className="btn-pay"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openPaymentModal({
                                                ...po,
                                                supplier_id: sup.id,
                                                supplier_name: sup.name,
                                              });
                                            }}
                                            style={{ marginRight: 12,cursor:'pointer' }}
                                          >
                                            <Banknote
                                              size={14}
                                              style={{ marginLeft: 4 }}
                                            />{" "}
                                            دفع
                                          </button>
                                          )}
                                        </div>
                                        <div
                                          className={`arrow-icon ${isPoExpanded ? "rotated" : ""}`}
                                          style={{
                                            transform: isPoExpanded
                                              ? "rotate(-90deg)"
                                              : "none",
                                          }}
                                        >
                                          <ChevronLeft size={14} />
                                        </div>
                                      </div>
                                    </div>
                                    {isPoExpanded && (
                                      <div className="purchase-details">
                                        <div
                                          style={{
                                            fontSize: 12,
                                            color: "#64748b",
                                            marginBottom: 8,
                                          }}
                                        >
                                          سجل الدفعات
                                        </div>
                                        {!po.payments ||
                                        po.payments.length === 0 ? (
                                          <div
                                            style={{
                                              padding: 10,
                                              color: "#64748b",
                                              fontSize: 12,
                                            }}
                                          >
                                            لا توجد دفعات مسجلة لهذه الفاتورة
                                          </div>
                                        ) : (
                                          po.payments.map((pay, i) => (
                                            <div
                                              key={pay.id}
                                              className={`payment-row ${pay.status === "pending" ? "pending-payment" : ""}`}
                                            >
                                              <div>
                                                {pay.status === "pending" ? (
                                                  <span
                                                    style={{ color: "#fbbf24" }}
                                                  >
                                                    ⏳ قسط{" "}
                                                    {pay.installment_number ||
                                                      ""}{" "}
                                                    — معلق
                                                  </span>
                                                ) : (
                                                  <span>
                                                    {pay.payment_method ===
                                                    "cash"
                                                      ? "نقداً"
                                                      : pay.payment_method ===
                                                          "bank"
                                                        ? "تحويل بنكي"
                                                        : pay.payment_method ||
                                                          "دفعة"}
                                                  </span>
                                                )}
                                                {pay.note && (
                                                  <span
                                                    style={{
                                                      fontSize: 11,
                                                      color: "#64748b",
                                                      marginRight: 8,
                                                    }}
                                                  >
                                                    — {pay.note}
                                                  </span>
                                                )}
                                              </div>
                                              <div>
                                                <span className="payment-amount">
                                                  {fmtCurrency(pay.amount)}
                                                </span>
                                                <span
                                                  style={{
                                                    fontSize: 11,
                                                    color: "#64748b",
                                                    marginRight: 8,
                                                  }}
                                                >
                                                  {pay.status === "pending"
                                                    ? ` (الاستحقاق: ${pay.due_date ? new Date(pay.due_date).toLocaleDateString("ar-EG") : "—"})`
                                                    : ` تم ${pay.paid_at ? new Date(pay.paid_at).toLocaleDateString("ar-EG") : "—"}`}
                                                </span>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* مودال الدفع */}
      {paymentModal.show && (
        <div
          className="blur-overlay"
          onClick={() => setPaymentModal((prev) => ({ ...prev, show: false }))}
        >
          <div className="cyber-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>
                <Banknote size={18} style={{ marginLeft: 8 }} /> تسديد مستحقات
              </h3>
              <button
                className="modal-close-btn"
                onClick={() =>
                  setPaymentModal((prev) => ({ ...prev, show: false }))
                }
              >
                <X size={20} />
              </button>
            </div>
            <div className="cyber-modal-body">
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>المورد:</span>
                  <span style={{ fontWeight: 600 }}>
                    {paymentModal.supplierName}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#94a3b8" }}>المتبقي المستحق:</span>
                  <span className="debt-positive">
                    {fmtCurrency(paymentModal.remainingAmount)}
                  </span>
                </div>
              </div>
              <div className="cyber-input-group">
                <label>المبلغ المدفوع</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="أدخل المبلغ"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <div className="cyber-input-group">
                <label>طريقة الدفع</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, method: e.target.value })
                  }
                >
                  <option value="cash">نقداً</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="check">شيك</option>
                </select>
              </div>
              <div className="cyber-input-group">
                <label>ملاحظات (اختياري)</label>
                <input
                  type="text"
                  placeholder="رقم الشيك / إيصال التحويل ..."
                  value={paymentForm.note}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, note: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="cyber-modal-footer">
              <button
                className="cyber-btn-submit"
                onClick={handlePayment}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  "تأكيد الدفع"
                )}
              </button>
              <button
                className="cyber-btn-dismiss"
                onClick={() =>
                  setPaymentModal((prev) => ({ ...prev, show: false }))
                }
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersDuesPage;
