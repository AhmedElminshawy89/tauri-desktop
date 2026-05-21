import { useState, useEffect } from "react";
import { getDb } from "../lib/db";
import {
  Search,
  Printer,
  Eye,
  Trash2,
  HandCoins,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Repeat,
  User,
  Phone,
  MapPin,
  Tag,
  Calendar,
  RotateCcw,
  Receipt,
  Percent,
  Users,
  Clock,
  DollarSign,
  FileText,
  Package,
  Edit,
  CalendarDays,
  Wallet,
} from "lucide-react";
import EditBill from "./EditBill";

// ─── ثوابت ───────────────────────────────────────────────────────────────────
const PAYMENT_MAP = {
  cash: {
    label: "كاش",
    icon: <HandCoins size={13} />,
    bg: "#dcfce7",
    text: "#166534",
    border: "#bbf7d0",
  },
  visa: {
    label: "فيزا",
    icon: <CreditCard size={13} />,
    bg: "#e0e7ff",
    text: "#3730a3",
    border: "#c7d2fe",
  },
  installment: {
    label: "تقسيط",
    icon: <Repeat size={13} />,
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
  },
};

// ─── حساب الحالة الفعلية للفاتورة ────────────────────────────────────────────
const deriveStatus = (invoice, totalReturned) => {
  const total = Number(invoice.total_after_discount) || 0;
  const returned = Number(totalReturned) || 0;

  if (returned <= 0) {
    return invoice.status === "pending" ? "pending" : "completed";
  }
  if (returned >= total) return "returned";
  return "partial_returned";
};

const STATUS_MAP = {
  completed: {
    label: "مكتملة",
    bg: "#dcfce7",
    text: "#166534",
    border: "#bbf7d0",
  },
  pending: {
    label: "معلقة",
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
  },
  partial_returned: {
    label: "مرتجع جزئي",
    bg: "#dbeafe",
    text: "#1e40af",
    border: "#bfdbfe",
  },
  returned: {
    label: "مرتجع كلي",
    bg: "#fee2e2",
    text: "#991b1b",
    border: "#fecaca",
  },
};

// ─── مكوّن Badge (يُستخدم كما هو) ──────────────────────────────────────────────
const Badge = ({ bg, text, border, icon, label, onClick }) => (
  <span
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "4px 11px",
      borderRadius: "50px",
      fontSize: "12px",
      fontWeight: "700",
      backgroundColor: bg,
      color: text,
      border: `1px solid ${border}`,
      cursor: onClick ? "pointer" : "default",
    }}
  >
    {icon}
    {label}
  </span>
);

// ─── مكوّن InfoRow (داخلي للمودال) ──────────────────────────────────────────
const InfoRow = ({ icon, label, value, valueStyle = {} }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}
  >
    <span style={{ color: "#94a3b8", flexShrink: 0 }}>{icon}</span>
    <span style={{ color: "#94a3b8", minWidth: "150px", fontSize: "13px" }}>
      {label}
    </span>
    <span style={{ fontWeight: "600", ...valueStyle }}>{value}</span>
  </div>
);

const SectionTitle = ({ label, color = "#94a3b8", icon }) => (
  <p
    style={{
      color,
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "1px",
      marginBottom: "10px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    }}
  >
    {icon}
    {label}
  </p>
);

const SectionBox = ({ children, borderColor = "rgba(255,255,255,0.08)" }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${borderColor}`,
      borderRadius: "12px",
      padding: "16px",
    }}
  >
    {children}
  </div>
);

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
const SalesLog = ({ showToast }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editInvoiceId, setEditInvoiceId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    invoice: null,
    reason: "",
  });

  // ─── جلب الفواتير ──────────────────────────────────────────────────────────
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      let query = `
        SELECT i.*,
               COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.invoice_id = i.id), 0) AS total_returned,
               e.name AS seller_name,
               e.commission_rate
        FROM invoices i
        LEFT JOIN employees e ON i.seller_id = e.id
        ORDER BY i.id DESC
      `;
      let params = [];

      if (filterDate) {
        query = `
          SELECT i.*,
                 COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.invoice_id = i.id), 0) AS total_returned,
                 e.name AS seller_name,
                 e.commission_rate
          FROM invoices i
          LEFT JOIN employees e ON i.seller_id = e.id
          WHERE date(i.created_at) = ?
          ORDER BY i.id DESC
        `;
        params = [filterDate];
      }

      const results = await db.select(query, params);
      
      let filteredResults = results;
      if (filterStatus) {
        filteredResults = results.filter((inv) => {
          const status = deriveStatus(inv, inv.total_returned);
          return status === filterStatus;
        });
      }
      
      setInvoices(filteredResults);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("خطأ في جلب البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── جلب تفاصيل فاتورة كاملة ─────────────────────────────────────────────────
  const showDetails = async (invoice) => {
    try {
      const db = await getDb();
      
      const items = await db.select(
        `SELECT ii.*, pv.size, pv.color, p.name as product_name 
         FROM invoice_items ii 
         LEFT JOIN products p ON ii.product_id = p.id
         LEFT JOIN product_variants pv ON ii.variant_id = pv.id 
         WHERE ii.invoice_id = ?`,
        [invoice.id]
      );

      const returnsDetails = await db.select(
        `SELECT r.*, p.name AS product_name, pv.size, pv.color
         FROM returns r
         LEFT JOIN products p ON r.product_id = p.id
         LEFT JOIN product_variants pv ON r.variant_id = pv.id
         WHERE r.invoice_id = ?`,
        [invoice.id]
      );

      const paymentHistory = await db.select(
        `SELECT * FROM installment_payments WHERE invoice_id = ? ORDER BY payment_date ASC`,
        [invoice.id]
      );

      const totalReturned = returnsDetails.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0
      );
      
      const totalActualPaid = paymentHistory.reduce(
        (s, p) => s + (Number(p.amount_paid) || 0),
        0
      );
      
      const downPayment = paymentHistory.length > 0 ? paymentHistory[0].amount_paid : 0;

      const returnedQtyMap = {};
      returnsDetails.forEach((r) => {
        const key = `${r.product_id}-${r.variant_id ?? "null"}`;
        returnedQtyMap[key] = (returnedQtyMap[key] || 0) + (Number(r.quantity) || 0);
      });

      const itemsAfterReturn = items.map((item) => {
        const key = `${item.product_id}-${item.variant_id ?? "null"}`;
        const retQty = returnedQtyMap[key] || 0;
        const netQty = Math.max(0, (Number(item.quantity) || 0) - retQty);
        return { ...item, returned_qty: retQty, net_qty: netQty };
      });

      let sellerInfo = null;
      if (invoice.seller_id) {
        const [seller] = await db.select(
          "SELECT id, name, commission_rate, total_sales, phone FROM employees WHERE id = ?",
          [invoice.seller_id]
        );
        sellerInfo = seller;
      }

      setSelectedInvoice({
        ...invoice,
        items: items,
        itemsAfterReturn: itemsAfterReturn,
        returnsDetails: returnsDetails,
        paymentHistory: paymentHistory,
        totalReturned: totalReturned,
        totalActualPaid: totalActualPaid,
        downPayment: downPayment,
        sellerInfo: sellerInfo,
      });
      
    } catch (err) {
      console.error("Error in showDetails:", err);
      if (showToast) showToast("خطأ في تحميل التفاصيل", "error");
    }
  };

  // ─── طباعة الفاتورة ─────────────────────────────────────────────────────
  const printInvoice = (invoice) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString("ar-EG");
    const totalBefore = Number(invoice.total_before_discount) || 0;
    let discountAmount = 0;
    if (invoice.discount_value && invoice.discount_value > 0) {
      if (invoice.discount_type === "percent") {
        discountAmount = (totalBefore * invoice.discount_value) / 100;
      } else {
        discountAmount = Number(invoice.discount_value);
      }
    }
    const totalAfter = Number(invoice.total_after_discount) || 0;
    
    const html = `<!DOCTYPE html>...`; // (keep the same as original)
    
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  };

  const confirmDelete = async () => {
    if (!deleteModal.reason.trim()) {
      if (showToast) showToast("يرجى كتابة سبب الحذف", "warning");
      return;
    }
    try {
      const db = await getDb();
      const inv = deleteModal.invoice;
      
      await db.execute("BEGIN TRANSACTION");
      
      const items = await db.select(
        "SELECT * FROM invoice_items WHERE invoice_id = ?",
        [inv.id]
      );
      const snapshot = JSON.stringify({ items });

      await db.execute(
        `INSERT INTO deleted_invoices 
         (invoice_id, invoice_number, customer_name, total_amount, reason, items_json, deleted_at) 
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          inv.id,
          inv.invoice_number,
          inv.customer_name || "عميل نقدي",
          inv.total_after_discount,
          deleteModal.reason,
          snapshot,
        ]
      );

      await db.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [inv.id]);
      await db.execute("DELETE FROM installment_payments WHERE invoice_id = ?", [inv.id]);
      await db.execute("DELETE FROM installment_plan WHERE invoice_id = ?", [inv.id]);
      await db.execute("DELETE FROM returns WHERE invoice_id = ?", [inv.id]);
      
      for (const item of items) {
        if (item.variant_id) {
          await db.execute("UPDATE product_variants SET stock = stock + ? WHERE id = ?", [
            item.quantity,
            item.variant_id,
          ]);
        } else {
          await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [
            item.quantity,
            item.product_id,
          ]);
        }
      }
      
      await db.execute("DELETE FROM invoices WHERE id = ?", [inv.id]);
      await db.execute("COMMIT");

      if (showToast) showToast("تم الحذف بنجاح", "success");
      setDeleteModal({ show: false, invoice: null, reason: "" });
      fetchInvoices();
    } catch (err) {
      console.error(err);
      try {
        const db = await getDb();
        await db.execute("ROLLBACK");
      } catch (e) {}
      if (showToast) showToast("خطأ في التنفيذ", "error");
    }
  };

  const closeModal = () => setSelectedInvoice(null);
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditInvoiceId(null);
    fetchInvoices();
  };

  const openEditModal = (invoice) => {
    setEditInvoiceId(invoice.id);
    setShowEditModal(true);
    closeModal();
  };

  const filtered = invoices.filter(
    (inv) =>
      (inv.invoice_number || "").includes(searchTerm) ||
      (inv.customer_name || "").includes(searchTerm) ||
      (inv.seller_name || "").includes(searchTerm)
  );

  const stats = {
    total: invoices.reduce((sum, inv) => sum + (inv.total_after_discount || 0), 0),
    count: invoices.length,
    completed: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "completed").length,
    pending: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "pending").length,
    returned: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "returned").length,
    partial_returned: invoices.filter(inv => deriveStatus(inv, inv.total_returned) === "partial_returned").length,
  };

  useEffect(() => {
    fetchInvoices();
    
    const handleStorageChange = (e) => {
      if (e.key === 'invoices_updated' || e.key === 'invoice_updated') {
        console.log("📢 Detected invoice update, refreshing...");
        fetchInvoices();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [filterDate, filterStatus]);

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

      {/* Stats Cards - Premium Glass */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><DollarSign size={24} /></div>
            <div className="stat-details">
              <div className="label">إجمالي المبيعات</div>
              <div className="value">{stats.total.toLocaleString()} ج.م</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><FileText size={24} /></div>
            <div className="stat-details">
              <div className="label">عدد الفواتير</div>
              <div className="value">{stats.count}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><CheckCircle2 size={24} /></div>
            <div className="stat-details">
              <div className="label">مكتملة</div>
              <div className="value">{stats.completed}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Clock size={24} /></div>
            <div className="stat-details">
              <div className="label">معلقة</div>
              <div className="value">{stats.pending}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar - Glassmorphism */}
      <div className="premium-control-bar">
        <div className="title-wrapper">
          <div className="brand-badge">
            <Receipt size={24} />
          </div>
          <div>
            <h2 className="main-title-neon">سجل المبيعات</h2>
            <p className="sub-title-dim">إدارة الفواتير والتحصيلات المالية وتتبع الأداء</p>
          </div>
        </div>
        <div className="actions-wrapper">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="search-neon-input"
            style={{ width: "160px" }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="search-neon-input"
            style={{ width: "160px" }}
          >
            <option value="">كل الحالات</option>
            <option value="completed">مكتملة</option>
            <option value="pending">معلقة</option>
            <option value="partial_returned">مرتجع جزئي</option>
            <option value="returned">مرتجع كلي</option>
          </select>
          <button onClick={() => fetchInvoices()} className="btn-action-neon btn-add">
            <RotateCcw size={16} /> تحديث
          </button>
          <div className="search-neon-wrapper">
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل أو البائع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
            />
            <Search size={16} className="search-icon" />
          </div>
        </div>
      </div>

      {/* Cyber Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>البائع</th>
              <th>نظام الدفع</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th style={{ textAlign: "center" }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="cyber-table-loading">جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="8" className="cyber-table-empty">لا توجد فواتير</td></tr>
            ) : (
              filtered.map((inv) => {
                const pmConfig = PAYMENT_MAP[inv.payment_method] || PAYMENT_MAP.cash;
                const derivedStatus = deriveStatus(inv, inv.total_returned);
                const stConfig = STATUS_MAP[derivedStatus] || STATUS_MAP.completed;

                return (
                  <tr key={inv.id} className="cyber-row-main">
                    <td><span className="id-badge">#{inv.invoice_number}</span></td>
                    <td style={{ fontWeight: "500" }}>{inv.customer_name || "عميل نقدي"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} style={{ color: "#64748b" }} />
                        <span>{inv.seller_name || "—"}</span>
                        {inv.commission_rate > 0 && (
                          <span style={{ fontSize: "11px", color: "#10b981" }}>
                            ({inv.commission_rate}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge
                        {...pmConfig}
                        label={
                          inv.payment_method === "installment"
                            ? `تقسيط (${inv.installments_count})`
                            : pmConfig.label
                        }
                      />
                    </td>
                    <td className="num-primary">{(inv.total_after_discount || 0).toLocaleString()} ج.م</td>
                    <td><Badge {...stConfig} /></td>
                    <td>{new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="table-actions-cell">
                      <button className="cyber-btn-mini edit" onClick={() => showDetails(inv)}>
                        <Eye size={18} />
                      </button>
                      <button className="cyber-btn-mini edit" onClick={() => openEditModal(inv)}>
                        <Edit size={18} />
                      </button>
                      <button
                        className="cyber-btn-mini delete"
                        onClick={() => setDeleteModal({ show: true, invoice: inv, reason: "" })}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* تفاصيل الفاتورة - Modal Glass */}
      {selectedInvoice && (
        <div className="blur-overlay" onClick={(e) => e.target.className === "blur-overlay" && closeModal()}>
          <div className="cyber-modal wide-modal" style={{ maxWidth: "1100px", width: "95%", maxHeight: "90vh", overflow: "hidden" }}>
            <div className="modal-cyber-header">
              <h3><Receipt size={18} style={{ display: "inline", marginLeft: "8px" }} /> تفاصيل فاتورة #{selectedInvoice.invoice_number}</h3>
              <button className="modal-close-btn" onClick={closeModal}>✕</button>
            </div>
            <div style={{ padding: "20px", maxHeight: "calc(90vh - 80px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <SectionBox>
                  <SectionTitle label="بيانات العميل" icon={<User size={14} />} />
                  <InfoRow icon={<User size={15} />} label="الاسم" value={selectedInvoice.customer_name || "عميل نقدي"} />
                  <InfoRow icon={<Phone size={15} />} label="التليفون" value={selectedInvoice.customer_phone || "—"} />
                  <InfoRow icon={<MapPin size={15} />} label="العنوان" value={selectedInvoice.customer_address || "—"} />
                </SectionBox>
                <SectionBox>
                  <SectionTitle label="بيانات الفاتورة" icon={<FileText size={14} />} />
                  <InfoRow icon={<Calendar size={15} />} label="التاريخ" value={new Date(selectedInvoice.created_at).toLocaleDateString("ar-EG")} />
                  <InfoRow icon={<HandCoins size={15} />} label="نظام الدفع" value={<Badge {...(PAYMENT_MAP[selectedInvoice.payment_method] || PAYMENT_MAP.cash)} label={selectedInvoice.payment_method === "installment" ? `تقسيط (${selectedInvoice.installments_count} قسط)` : (PAYMENT_MAP[selectedInvoice.payment_method] || PAYMENT_MAP.cash).label} />} />
                  <InfoRow icon={<Tag size={15} />} label="الحالة" value={<Badge {...(STATUS_MAP[deriveStatus(selectedInvoice, selectedInvoice.totalReturned)] || STATUS_MAP.completed)} />} />
                  <InfoRow icon={<Users size={15} />} label="البائع" value={<span>{selectedInvoice.seller_name || selectedInvoice.sellerInfo?.name || "—"}</span>} />
                </SectionBox>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <SectionBox>
                  <SectionTitle label="الملخص المالي" icon={<DollarSign size={14} />} />
                  <InfoRow icon={<Receipt size={15} />} label="إجمالي قبل الخصم" value={`${(selectedInvoice.total_before_discount || 0).toLocaleString()} ج.م`} />
                  {(selectedInvoice.discount_value || 0) > 0 && (
                    <InfoRow icon={<Percent size={15} />} label={selectedInvoice.discount_type === "percent" ? `خصم ${selectedInvoice.discount_value}%` : "خصم (مبلغ ثابت)"} value={`- ${selectedInvoice.discount_type === "percent" ? ((selectedInvoice.total_before_discount || 0) * selectedInvoice.discount_value) / 100 : selectedInvoice.discount_value} ج.م`} valueStyle={{ color: "#f87171" }} />
                  )}
                  <InfoRow icon={<CheckCircle2 size={15} />} label="إجمالي بعد الخصم" value={`${(selectedInvoice.total_after_discount || 0).toLocaleString()} ج.م`} valueStyle={{ color: "#34d399" }} />
                  <InfoRow icon={<CheckCircle2 size={15} />} label="صافي المحصل" value={`${Math.max(0, (selectedInvoice.total_after_discount || 0) - (selectedInvoice.totalReturned || 0)).toLocaleString()} ج.م`} valueStyle={{ color: "#34d399", fontSize: "16px" }} />
                  {(selectedInvoice.totalReturned || 0) > 0 && (
                    <InfoRow icon={<RotateCcw size={15} />} label="إجمالي المرتجعات" value={`- ${(selectedInvoice.totalReturned || 0).toLocaleString()} ج.م`} valueStyle={{ color: "#fb923c" }} />
                  )}
                </SectionBox>
                {selectedInvoice.payment_method === "installment" && (
                  <SectionBox>
                    <SectionTitle label="تفاصيل الدفع للأقساط" icon={<DollarSign size={14} />} />
                    <InfoRow icon={<Wallet size={15} />} label="المبلغ المدفوع (مقدم)" value={`${(selectedInvoice.downPayment || 0).toLocaleString()} ج.م`} valueStyle={{ color: "#34d399" }} />
                    <InfoRow icon={<AlertCircle size={15} />} label="المتبقي على العميل" value={`${Math.max(0, (selectedInvoice.total_after_discount || 0) - (selectedInvoice.totalActualPaid || 0) - (selectedInvoice.totalReturned || 0)).toLocaleString()} ج.م`} valueStyle={{ color: "#f97316", fontSize: "16px" }} />
                    <InfoRow icon={<Repeat size={15} />} label="عدد المدفوعات" value={`${selectedInvoice.paymentHistory?.length || 0} دفعة`} valueStyle={{ color: "#60a5fa" }} />
                    <InfoRow icon={<CheckCircle2 size={15} />} label="إجمالي المحصل" value={`${(selectedInvoice.totalActualPaid || 0).toLocaleString()} ج.م`} valueStyle={{ color: "#34d399" }} />
                  </SectionBox>
                )}
              </div>

              {selectedInvoice.payment_method === "installment" && selectedInvoice.paymentHistory && selectedInvoice.paymentHistory.length > 0 && (
                <div>
                  <SectionTitle label="سجل التحصيلات" color="#60a5fa" icon={<Clock size={14} />} />
                  <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(96,165,250,0.3)" }}>
                    <table className="cyber-table" style={{ fontSize: "13px" }}>
                      <thead><tr><th>#</th><th>تاريخ الدفع</th><th>المبلغ المدفوع</th><th>ملاحظات</th></tr></thead>
                      <tbody>
                        {selectedInvoice.paymentHistory.map((p, idx) => (
                          <tr key={p.id} className="cyber-row-main">
                            <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                            <td>{new Date(p.payment_date).toLocaleDateString("ar-EG")}</td>
                            <td style={{ color: "#34d399", fontWeight: "bold" }}>+{p.amount_paid.toLocaleString()} ج.م</td>
                            <td style={{ fontSize: "12px", color: "#64748b" }}>{p.note || "تحصيل"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <SectionTitle label="الأصناف المشتراة" icon={<Package size={14} />} />
                  <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <table className="cyber-table" style={{ fontSize: "13px" }}>
                      <thead><tr><th>الصنف</th><th>المقاس / اللون</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                      <tbody>
                        {selectedInvoice.items.map((item) => (
                          <tr key={item.id} className="cyber-row-main">
                            <td>{item.product_name}</td>
                            <td>{item.size || "—"} / {item.color || "—"}</td>
                            <td>{item.quantity}</td>
                            <td>{(item.unit_price || 0).toLocaleString()} ج.م</td>
                            <td className="num-primary">{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()} ج.م</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedInvoice.returnsDetails && selectedInvoice.returnsDetails.length > 0 && (
                <div>
                  <SectionTitle label="الأصناف المرتجعة" color="#fb923c" icon={<RotateCcw size={14} />} />
                  <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(251,146,60,0.3)" }}>
                    <table className="cyber-table" style={{ fontSize: "13px" }}>
                      <thead><tr><th>الصنف</th><th>المقاس / اللون</th><th>الكمية المرتجعة</th><th>قيمة الرجع</th><th>تاريخ الرجع</th></tr></thead>
                      <tbody>
                        {selectedInvoice.returnsDetails.map((r) => (
                          <tr key={r.id} className="cyber-row-main">
                            <td>{r.product_name}</td>
                            <td>{r.size || "—"} / {r.color || "—"}</td>
                            <td style={{ color: "#fb923c", fontWeight: "700" }}>{r.quantity}</td>
                            <td style={{ color: "#f87171" }}>{(r.amount || 0).toLocaleString()} ج.م</td>
                            <td>{new Date(r.return_date).toLocaleDateString("ar-EG")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="cyber-modal-actions end-aligned" style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button className="cyber-btn-submit" onClick={() => printInvoice(selectedInvoice)}><Printer size={18} /> طباعة</button>
                <button className="cyber-btn-submit" onClick={() => openEditModal(selectedInvoice)}><Edit size={18} /> تعديل</button>
                <button className="cyber-btn-dismiss" onClick={closeModal}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال تعديل الفاتورة */}
      {showEditModal && editInvoiceId && (
        <div className="blur-overlay" onClick={closeEditModal}>
          <div className="cyber-modal wide-modal" style={{ maxWidth: "95%", width: "95%", maxHeight: "90vh", overflow: "auto", padding: "0" }} onClick={(e) => e.stopPropagation()}>
            <EditBill invoiceId={editInvoiceId} onBack={closeEditModal} showToast={showToast} />
          </div>
        </div>
      )}

      {/* مودال الحذف */}
      {deleteModal.show && (
        <div className="blur-overlay">
          <div className="cyber-modal" style={{ maxWidth: "400px" }}>
            <div className="modal-cyber-header"><h3>حذف فاتورة</h3></div>
            <div className="cyber-form" style={{ padding: "20px" }}>
              <textarea
                className="search-neon-input"
                placeholder="سبب الحذف..."
                value={deleteModal.reason}
                onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
              <div className="cyber-modal-actions" style={{ marginTop: "15px" }}>
                <button className="cyber-btn-submit danger-bg" onClick={confirmDelete}>تأكيد الحذف</button>
                <button className="cyber-btn-dismiss" onClick={() => setDeleteModal({ show: false, invoice: null, reason: "" })}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesLog;