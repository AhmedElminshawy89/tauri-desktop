import { useEffect, useState, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Plus, Trash2, Edit3, Eye, Search, Truck,
  Package, AlertTriangle, CheckCircle2, X,
  TrendingUp, Receipt, Loader2,
  Calendar, ShoppingBag, RefreshCw,
  Save, ListPlus, History, Banknote, BadgeCheck,
  ToggleLeft, ToggleRight, CalendarDays, Clock,
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }); } catch { return d; } };
const fmtDT = (d) => { try { return new Date(d).toLocaleString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return d; } };

const paidStatus = (total, paid) => {
  const r = Number(total) - Number(paid);
  if (r <= 0) return { cls: "paid", label: "مدفوع بالكامل" };
  if (Number(paid) > 0) return { cls: "partial", label: "مدفوع جزئياً" };
  return { cls: "unpaid", label: "غير مدفوع" };
};
const mLabel = (m) => ({ cash: "نقداً", bank: "تحويل بنكي", check: "شيك", other: "أخرى" }[m] || m);
const mDot = (m) => ({ cash: "cash", bank: "bank", check: "bank", other: "other" }[m] || "other");

const addMonths = (ds, n) => {
  const d = new Date(ds);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
const buildSchedule = (total, down, count, start, interval) => {
  const rem = total - down;
  const per = count > 0 ? Math.round((rem / count) * 100) / 100 : 0;
  return Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    amount: per,
    due_date: addMonths(start, (i + 1) * interval),
  }));
};

const PurchasesPage = ({ showToast }) => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalType, setModalType] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: "cash", note: "" });

  const [form, setForm] = useState({
    id: null, supplier_id: "",
    payType: "cash",
    downPayment: 0,
    installCount: 3,
    installInterval: 1,
    installStart: new Date().toISOString().slice(0, 10),
  });
  const [items, setItems] = useState([]);

  const totalAmount = useMemo(() => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.cost_price) || 0), 0), [items]);
  const schedule = useMemo(() => {
    if (form.payType !== "installment") return [];
    return buildSchedule(totalAmount, Number(form.downPayment) || 0, Number(form.installCount) || 1, form.installStart, Number(form.installInterval) || 1);
  }, [totalAmount, form.payType, form.downPayment, form.installCount, form.installStart, form.installInterval]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const ps = await db.select(`
        SELECT po.*, s.name AS supplier_name,
          COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.purchase_order_id=po.id AND sp.status='paid'),0) AS total_paid_actual,
          (SELECT COUNT(*) FROM supplier_payments sp WHERE sp.purchase_order_id=po.id AND sp.status='pending') AS pending_count
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id=s.id
        ORDER BY po.id DESC`);
      setPurchases(ps);
      const ss = await db.select("SELECT * FROM suppliers ORDER BY name");
      setSuppliers(ss);
      const prods = await db.select(`
        SELECT p.id AS product_id, p.name AS product_name, p.cost_price AS product_cost,
               pv.id AS variant_id, pv.color, pv.size, pv.variant_barcode, pv.stock AS variant_stock
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id=p.id
        ORDER BY p.name, pv.color, pv.size`);
      setProducts(prods);
      const cats = await db.select("SELECT * FROM categories ORDER BY name");
      setCategories(cats);
    } catch (err) {
      console.error(err);
      showToast("خطأ في تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return purchases.filter(p => p.supplier_name?.toLowerCase().includes(t) || String(p.id).includes(t) || fmtDate(p.purchase_date).includes(t));
  }, [purchases, searchTerm]);

  const stats = useMemo(() => {
    let total = 0, paid = 0;
    filtered.forEach(p => { total += Number(p.total_amount); paid += Number(p.total_paid_actual); });
    return { count: filtered.length, total, paid, remaining: total - paid };
  }, [filtered]);

  const uniqueProds = useMemo(() => {
    const seen = new Set();
    return products.filter(p => { if (seen.has(p.product_id)) return false; seen.add(p.product_id); return true; });
  }, [products]);

  const variantsOf = (pid) => products.filter(p => p.product_id === Number(pid) && p.variant_id);

  const newEmptyItem = () => ({
    isNew: false, product_id: "", variant_id: "",
    newName: "", newBarcode: "", newCategory: "",
    quantity: 1, cost_price: 0,
  });
  const addItem = () => setItems(p => [...p, newEmptyItem()]);
  const removeItem = idx => setItems(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const toggleMode = idx => setItems(p => p.map((it, i) => i === idx ? { ...newEmptyItem(), isNew: !it.isNew } : it));
  const selectProduct = (idx, pid) => {
    const variants = variantsOf(pid);
    const firstV = variants[0];
    const base = products.find(p => p.product_id === Number(pid));
    setItems(p => p.map((it, i) => i === idx ? {
      ...it, product_id: pid,
      variant_id: firstV?.variant_id || "",
      cost_price: firstV?.product_cost ?? base?.product_cost ?? 0,
    } : it));
  };

  const resetForm = () => setForm({
    id: null, supplier_id: "", payType: "cash", downPayment: 0,
    installCount: 3, installInterval: 1,
    installStart: new Date().toISOString().slice(0, 10),
  });
  const openAdd = () => { resetForm(); setItems([newEmptyItem()]); setModalType("form"); };
  const openEdit = async p => {
    setLoading(true);
    try {
      const db = await getDb();
      const its = await db.select(`SELECT pi.product_id, pi.variant_id, pi.quantity, pi.cost_price FROM purchase_items pi WHERE pi.purchase_order_id=?`, [p.id]);
      setForm({ id: p.id, supplier_id: p.supplier_id, payType: "cash", downPayment: 0, installCount: 3, installInterval: 1, installStart: new Date().toISOString().slice(0, 10) });
      setItems(its.map(i => ({ isNew: false, product_id: i.product_id || "", variant_id: i.variant_id || "", newName: "", newBarcode: "", newCategory: "", quantity: i.quantity, cost_price: i.cost_price })));
      setModalType("form");
    } catch { showToast("خطأ في تحميل الفاتورة", "error"); } finally { setLoading(false); }
  };
  const openView = async p => {
    setLoading(true);
    try {
      const db = await getDb();
      const its = await db.select(`
        SELECT pi.quantity, pi.cost_price, p.name AS product_name, pv.color, pv.size, pv.variant_barcode
        FROM purchase_items pi
        LEFT JOIN products p ON pi.product_id=p.id
        LEFT JOIN product_variants pv ON pi.variant_id=pv.id
        WHERE pi.purchase_order_id=?`, [p.id]);
      const pays = await db.select(`SELECT * FROM supplier_payments WHERE purchase_order_id=? ORDER BY COALESCE(due_date,paid_at) ASC`, [p.id]);
      setViewData({ invoice: p, items: its, payments: pays });
      setModalType("view");
    } catch { showToast("خطأ في تحميل التفاصيل", "error"); } finally { setLoading(false); }
  };
  const openPay = p => {
    const rem = Number(p.total_amount) - Number(p.total_paid_actual);
    setPayTarget(p);
    setPayForm({ amount: rem > 0 ? rem : 0, method: "cash", note: "" });
    setModalType("pay");
  };

  const handleSave = async e => {
    e.preventDefault();
    if (!form.supplier_id) return showToast("اختر المورد", "error");
    if (!items.length) return showToast("أضف صنفاً واحداً على الأقل", "error");
    for (const it of items) {
      if (it.isNew && !it.newName?.trim()) return showToast("أدخل اسم المنتج الجديد", "error");
      if (!it.isNew && !it.product_id) return showToast("اختر منتجاً لكل صنف", "error");
    }
    setSaving(true);
    try {
      const db = await getDb();
      let pid = form.id;

      if (pid) {
        const old = await db.select(`SELECT product_id, variant_id, quantity FROM purchase_items WHERE purchase_order_id=?`, [pid]);
        for (const o of old) {
          if (o.variant_id) await db.execute("UPDATE product_variants SET stock=stock-? WHERE id=?", [o.quantity, o.variant_id]);
          else if (o.product_id) await db.execute("UPDATE products SET stock=stock-? WHERE id=?", [o.quantity, o.product_id]);
        }
        await db.execute("DELETE FROM purchase_items WHERE purchase_order_id=?", [pid]);
        await db.execute("UPDATE purchase_orders SET supplier_id=?, total_amount=?, purchase_date=date('now') WHERE id=?", [form.supplier_id, totalAmount, pid]);
      } else {
        const res = await db.execute("INSERT INTO purchase_orders (supplier_id, total_amount, paid_amount, purchase_date) VALUES (?,?,0,date('now'))", [form.supplier_id, totalAmount]);
        pid = res.lastInsertId;
        const dp = Number(form.downPayment) || 0;
        if (form.payType === "cash") {
          if (dp > 0) {
            await db.execute(`INSERT INTO supplier_payments (purchase_order_id, supplier_id, amount, payment_method, note, paid_at, status) VALUES (?,?,?,'cash','دفعة مقدمة',CURRENT_TIMESTAMP,'paid')`, [pid, form.supplier_id, dp]);
            await db.execute("UPDATE purchase_orders SET paid_amount=? WHERE id=?", [dp, pid]);
          }
        } else {
          if (dp > 0) {
            await db.execute(`INSERT INTO supplier_payments (purchase_order_id, supplier_id, amount, payment_method, note, paid_at, status) VALUES (?,?,?,'cash','دفعة مقدمة',CURRENT_TIMESTAMP,'paid')`, [pid, form.supplier_id, dp]);
            await db.execute("UPDATE purchase_orders SET paid_amount=? WHERE id=?", [dp, pid]);
          }
          for (const inst of schedule) {
            await db.execute(`INSERT INTO supplier_payments (purchase_order_id, supplier_id, amount, is_installment, installment_number, due_date, status) VALUES (?,?,?,1,?,?,'pending')`, [pid, form.supplier_id, inst.amount, inst.num, inst.due_date]);
          }
        }
      }

      for (const item of items) {
        let finalProductId = item.product_id;
        let finalVariantId = item.variant_id || null;

        if (item.isNew) {
          if (item.newBarcode?.trim()) {
            const ex = await db.select("SELECT id FROM products WHERE barcode=? LIMIT 1", [item.newBarcode.trim()]);
            if (ex.length) { finalProductId = ex[0].id; finalVariantId = null; }
          }
          if (!finalProductId || finalProductId === item.product_id) {
            const pr = await db.execute(`INSERT INTO products (name, barcode, category, cost_price, sale_price, stock) VALUES (?,?,?,?,?,0)`, [item.newName.trim(), item.newBarcode?.trim() || null, item.newCategory || null, item.cost_price, Math.round(item.cost_price * 1.3 * 100) / 100]);
            finalProductId = pr.lastInsertId;
            finalVariantId = null;
          }
        }

        if (finalVariantId) {
          await db.execute("UPDATE product_variants SET stock=stock+? WHERE id=?", [item.quantity, finalVariantId]);
          await db.execute("UPDATE products SET cost_price=? WHERE id=?", [item.cost_price, finalProductId]);
        } else {
          await db.execute("UPDATE products SET stock=stock+?, cost_price=? WHERE id=?", [item.quantity, item.cost_price, finalProductId]);
        }
        await db.execute(`INSERT INTO purchase_items (purchase_order_id, product_id, variant_id, quantity, cost_price) VALUES (?,?,?,?,?)`, [pid, finalProductId, finalVariantId, item.quantity, item.cost_price]);
      }

      showToast(form.id ? "تم تحديث الفاتورة ✓" : "تم إضافة الفاتورة ✓", "success");
      setModalType(null);
      fetchData();
    } catch (err) { showToast("خطأ: " + err.message, "error"); } finally { setSaving(false); }
  };

  const handlePaySave = async () => {
    if (Number(payForm.amount) <= 0) return showToast("أدخل مبلغ صحيح", "error");
    const rem = Number(payTarget.total_amount) - Number(payTarget.total_paid_actual);
    if (Number(payForm.amount) > rem + 0.01) return showToast(`المبلغ أكبر من المتبقي (${fmt(rem)} ج.م)`, "error");
    setSaving(true);
    try {
      const db = await getDb();
      await db.execute(`INSERT INTO supplier_payments (purchase_order_id, supplier_id, amount, payment_method, note, paid_at, status) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,'paid')`, [payTarget.id, payTarget.supplier_id, payForm.amount, payForm.method, payForm.note || null]);
      const t = await db.select("SELECT COALESCE(SUM(amount),0) AS s FROM supplier_payments WHERE purchase_order_id=? AND status='paid'", [payTarget.id]);
      await db.execute("UPDATE purchase_orders SET paid_amount=? WHERE id=?", [t[0]?.s || 0, payTarget.id]);
      showToast("تم تسجيل الدفعة ✓", "success");
      setModalType(null);
      fetchData();
    } catch (err) { showToast("خطأ: " + err.message, "error"); } finally { setSaving(false); }
  };

  const payInstall = async (pay, invoiceId) => {
    setSaving(true);
    try {
      const db = await getDb();
      await db.execute("UPDATE supplier_payments SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=?", [pay.id]);
      const t = await db.select("SELECT COALESCE(SUM(amount),0) AS s FROM supplier_payments WHERE purchase_order_id=? AND status='paid'", [invoiceId]);
      await db.execute("UPDATE purchase_orders SET paid_amount=? WHERE id=?", [t[0]?.s || 0, invoiceId]);
      showToast(`تم دفع القسط ${pay.installment_number} ✓`, "success");
      const pays = await db.select("SELECT * FROM supplier_payments WHERE purchase_order_id=? ORDER BY COALESCE(due_date,paid_at) ASC", [invoiceId]);
      setViewData(vd => vd ? { ...vd, payments: pays } : vd);
      fetchData();
    } catch (err) { showToast("خطأ: " + err.message, "error"); } finally { setSaving(false); }
  };

  const deletePay = async (payId, invoiceId) => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM supplier_payments WHERE id=?", [payId]);
      const t = await db.select("SELECT COALESCE(SUM(amount),0) AS s FROM supplier_payments WHERE purchase_order_id=? AND status='paid'", [invoiceId]);
      await db.execute("UPDATE purchase_orders SET paid_amount=? WHERE id=?", [t[0]?.s || 0, invoiceId]);
      showToast("تم الحذف", "success");
      const pays = await db.select("SELECT * FROM supplier_payments WHERE purchase_order_id=? ORDER BY COALESCE(due_date,paid_at) ASC", [invoiceId]);
      setViewData(vd => vd ? { ...vd, payments: pays } : vd);
      fetchData();
    } catch (err) { showToast("خطأ: " + err.message, "error"); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const db = await getDb();
      const old = await db.select(`SELECT product_id, variant_id, quantity FROM purchase_items WHERE purchase_order_id=?`, [deleteTarget.id]);
      for (const o of old) {
        if (o.variant_id) await db.execute("UPDATE product_variants SET stock=stock-? WHERE id=?", [o.quantity, o.variant_id]);
        else if (o.product_id) await db.execute("UPDATE products SET stock=stock-? WHERE id=?", [o.quantity, o.product_id]);
      }
      await db.execute("DELETE FROM supplier_payments WHERE purchase_order_id=?", [deleteTarget.id]);
      await db.execute("DELETE FROM purchase_items WHERE purchase_order_id=?", [deleteTarget.id]);
      await db.execute("DELETE FROM purchase_orders WHERE id=?", [deleteTarget.id]);
      showToast("تم الحذف واسترجاع المخزون ✓", "success");
      setDeleteTarget(null);
      setModalType(null);
      fetchData();
    } catch (err) { showToast("خطأ: " + err.message, "error"); } finally { setLoading(false); }
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
        .card-purple .stat-glow { background: #8b5cf6; }
        .card-green .stat-glow { background: #10b981; }
        .card-amber .stat-glow { background: #f59e0b; }
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
        .card-blue .icon-box { color: #60a5fa; background: rgba(59,130,246,0.1); }
        .card-purple .icon-box { color: #a78bfa; background: rgba(139,92,246,0.1); }
        .card-green .icon-box { color: #34d399; background: rgba(16,185,129,0.1); }
        .card-amber .icon-box { color: #fbbf24; background: rgba(245,158,11,0.1); }
        .stat-details { flex: 1; }
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
        .header-actions-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .search-neon-wrapper { position: relative; }
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
        .btn-primary { background: #2563eb; color: #ffffff; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .btn-secondary { background: #1e293b; color: #94a3b8; }
        .btn-secondary:hover { background: #334155; color: white; }
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
          padding: 14px 16px;
          border-bottom: 1px solid rgba(30,41,59,0.5);
        }
        .cyber-row-main:hover { background: rgba(30, 41, 59, 0.3); }
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
          max-height: 90vh;
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
        .modal-close-btn:hover { background: rgba(255,255,255,0.05); color: white; }
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
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pur-progress-wrap { width: 80px; height: 5px; background: rgba(0,0,0,0.4); border-radius: 3px; overflow: hidden; }
        .pur-progress-bar { height: 100%; border-radius: 3px; transition: width 0.4s; }
        .pur-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
        .pur-tag.orange { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
        .pur-timeline { display: flex; flex-direction: column; gap: 12px; position: relative; }
        .pur-tl-entry { display: flex; align-items: flex-start; gap: 14px; }
        .pur-tl-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 6px; border: 2px solid; background: #0f172a; }
        .pur-tl-dot.cash { border-color: #10b981; box-shadow: 0 0 4px #10b981; }
        .pur-tl-dot.bank { border-color: #3b82f6; }
        .pur-tl-dot.init { border-color: #06b6d4; }
        .pur-tl-dot.pending { border-color: #f59e0b; box-shadow: 0 0 4px #f59e0b; }
        .pur-tl-dot.other { border-color: #8b5cf6; }
        .pur-tl-card { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .pur-tl-card.pending-card { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }
        .pur-tl-left { display: flex; flex-direction: column; gap: 4px; }
        .pur-tl-method { font-size: 13px; font-weight: 600; color: #e2e8f0; }
        .pur-tl-date { font-size: 11px; color: #64748b; }
        .pur-tl-note { font-size: 11px; color: #64748b; font-style: italic; }
        .pur-tl-amount { font-family: monospace; font-weight: 700; font-size: 14px; }
        .pur-tl-amount.paid { color: #34d399; }
        .pur-tl-amount.pending { color: #f59e0b; }
        .pur-tl-del { background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .pur-tl-del:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: #ef4444; }
        .pur-tl-pay-now { font-size: 11px; font-weight: 600; color: #06b6d4; background: rgba(6,182,212,0.1); border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
        .pur-pay-summary { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .pur-pay-summary-item { display: flex; flex-direction: column; gap: 4px; }
        .pur-pay-summary-lbl { font-size: 11px; color: #64748b; }
        .pur-pay-summary-val { font-size: 16px; font-weight: 700; font-family: monospace; }
        .pur-pay-full-btn { font-size: 11px; font-weight: 600; color: #06b6d4; background: rgba(6,182,212,0.1); border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; }
      `}</style>

      {/* Stats Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Receipt size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">عدد الفواتير</div>
              <div className="stat-value">{stats.count}</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-purple">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><TrendingUp size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">إجمالي المشتريات</div>
              <div className="stat-value">{fmt(stats.total)} ج.م</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-green">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><CheckCircle2 size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">المدفوع للموردين</div>
              <div className="stat-value">{fmt(stats.paid)} ج.م</div>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><AlertTriangle size={24} /></div>
            <div className="stat-details">
              <div className="stat-label">المتبقي للموردين</div>
              <div className="stat-value">{fmt(stats.remaining)} ج.م</div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="page-header-container">
        <div className="header-title-section">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="icon-box" style={{ width: 48, height: 48, background: "rgba(59,130,246,0.15)" }}>
              <Truck size={24} style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <h2 className="main-title">فواتير المشتريات</h2>
              <p className="sub-title">إدارة فواتير الموردين والمخزون</p>
            </div>
          </div>
        </div>
        <div className="header-actions-group">
          <div className="search-neon-wrapper">
            <input type="text" placeholder="بحث بالمورد أو رقم الفاتورة..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-neon-input" style={{ width: 260 }} />
            <Search size={15} className="search-icon" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          </div>
          <button className="btn-action-neon btn-secondary" onClick={fetchData}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
          <button className="btn-action-neon btn-primary" onClick={openAdd}>
            <Plus size={18} /> فاتورة جديدة
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th>#</th><th>المورد</th><th>التاريخ</th>
              <th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th>
              <th>التسديد</th><th>الحالة</th>
              <th style={{ textAlign: "center" }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: "center", padding: "50px", color: "#94a3b8" }}>
                <Loader2 size={24} className="spin" style={{ marginLeft: "8px" }} /> جاري التحميل...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>لا توجد فواتير مشتريات</td></tr>
            ) : filtered.map(p => {
              const ap = Number(p.total_paid_actual);
              const rem = Number(p.total_amount) - ap;
              const pct = p.total_amount > 0 ? Math.min(100, (ap / p.total_amount) * 100) : 0;
              const st = paidStatus(p.total_amount, ap);
              return (
                <tr key={p.id} className="cyber-row-main">
                  <td><span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>#{p.id}</span></td>
                  <td><span style={{ fontWeight: 600 }}>{p.supplier_name}</span></td>
                  <td><span style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(p.purchase_date)}</span></td>
                  <td><span className="num-primary">{fmt(p.total_amount)} ج.م</span></td>
                  <td><span className="num-success">{fmt(ap)} ج.م</span></td>
                  <td><span className={rem > 0 ? "num-warning-dim" : "num-success"}>{fmt(rem)} ج.م</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="pur-progress-wrap"><div className="pur-progress-bar" style={{ width: `${pct}%`, background: pct >= 100 ? "#10b981" : pct > 0 ? "#f59e0b" : "#ef4444" }} /></div>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{Math.round(pct)}%</span>
                      {Number(p.pending_count) > 0 && <span className="pur-tag orange"><CalendarDays size={10} /> {p.pending_count}</span>}
                    </div>
                  </td>
                  <td><span className={`pur-status ${st.cls}`}>{st.label}</span></td>
                  <td>
                    <div className="table-actions-cell" style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      <button className="cyber-btn-mini edit" onClick={() => openEdit(p)}><Edit3 size={14} /></button>
                      <button className="cyber-btn-mini edit" onClick={() => openView(p)}><Eye size={14} /></button>
                      <button className="cyber-btn-mini edit" style={{ color: rem > 0 ? "#06b6d4" : "#64748b" }} disabled={rem <= 0} onClick={() => openPay(p)}><Banknote size={14} /></button>
                      <button className="cyber-btn-mini delete" onClick={() => { setDeleteTarget(p); setModalType("delete"); }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {modalType === "form" && (
        <div className="blur-overlay" onClick={() => setModalType(null)}>
          <div className="cyber-modal" style={{ maxWidth: 950 ,  overflow:'auto'}} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3><Package size={18} style={{ marginLeft: "8px" }} /> {form.id ? "تعديل فاتورة مشتريات" : "فاتورة مشتريات جديدة"}</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="cyber-modal-body">
                {/* Supplier */}
                <div className="cyber-input-group" style={{ marginBottom: 16 }}>
                  <label>المورد</label>
                  <select className="premium-select" required value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">-- اختر المورد --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Items */}
                <div>
                  <div className="section-header-mini" style={{ marginBottom: 12 }}><ShoppingBag size={16} /> الأصناف <span style={{ fontSize: 11, color: "#64748b" }}>(زر التبديل ← موجود / جديد)</span></div>
                  <div className="cyber-table-container" style={{ boxShadow: "none", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px 1.9fr 1fr 80px 100px 40px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["", "المنتج", "المقاس/لون/باركود", "الكمية", "التكلفة", ""].map((h, i) => <div key={i} style={{ padding: "8px 10px", fontSize: 11, color: "#64748b", textAlign: i >= 3 ? "center" : "right" }}>{h}</div>)}
                    </div>
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                      {items.map((item, idx) => {
                        const variants = variantsOf(item.product_id);
                        return (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "40px 1.9fr 1fr 80px 100px 40px", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "stretch" }}>
                            <button type="button" style={{ background: "transparent", border: "none", color: item.isNew ? "#f59e0b" : "#60a5fa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => toggleMode(idx)}>{item.isNew ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button>
                            <div style={{ padding: 0 }}>{item.isNew ? <input placeholder="اسم المنتج الجديد *" className="search-neon-input" style={{ width: "100%", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)" }} value={item.newName || ""} onChange={e => updateItem(idx, "newName", e.target.value)} required /> : <select className="premium-select" style={{ width: "100%", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)" }} value={item.product_id} onChange={e => selectProduct(idx, e.target.value)} required><option value="">-- اختر منتج --</option>{uniqueProds.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</select>}</div>
                            <div style={{ padding: 0 }}>
                              {item.isNew ? (
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <input placeholder="باركود (اختياري)" className="search-neon-input" style={{ width: "100%", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }} value={item.newBarcode || ""} onChange={e => updateItem(idx, "newBarcode", e.target.value)} />
                                  <select className="premium-select" style={{ width: "100%", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)" }} value={item.newCategory || ""} onChange={e => updateItem(idx, "newCategory", e.target.value)}><option value="">فئة (اختياري)</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                                </div>
                              ) : variants.length > 0 ? <select className="premium-select" style={{ width: "100%", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)" }} value={item.variant_id} onChange={e => updateItem(idx, "variant_id", e.target.value)}><option value="">بدون مقاس/لون</option>{variants.map(v => <option key={v.variant_id} value={v.variant_id}>{[v.color, v.size].filter(Boolean).join(" / ") || v.variant_barcode || `#${v.variant_id}`}</option>)}</select> : <div style={{ padding: "10px", color: "#64748b", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.05)" }}>—</div>}
                            </div>
                            <div style={{ padding: 0 }}><input type="number" min="1" className="search-neon-input" style={{ width: "100%", textAlign: "center", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)" }} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} required /></div>
                            <div style={{ padding: 0 }}><input type="number" min="0" step="0.01" className="search-neon-input" style={{ width: "100%", textAlign: "center", borderRadius: 0, border: "none", borderRight: "1px solid rgba(255,255,255,0.05)" }} value={item.cost_price} onChange={e => updateItem(idx, "cost_price", parseFloat(e.target.value) || 0)} required /></div>
                            <button type="button" className="cyber-btn-mini delete" style={{ borderRadius: 0, border: "none", background: "transparent", width: "100%", height: "100%" }} onClick={() => removeItem(idx)}><X size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                    <button type="button" className="btn-action-neon btn-secondary" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={addItem}><ListPlus size={14} /> إضافة صنف</button>
                  </div>
                </div>

                {/* Payment Type (new only) */}
                {!form.id && (
                  <div style={{ marginTop: 16 }}>
                    <div className="cyber-input-group" style={{ marginBottom: 12 }}><label>طريقة الدفع للمورد</label></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className={`premium-stat-card ${form.payType === "cash" ? "card-green" : ""}`} style={{ cursor: "pointer", padding: 16 }} onClick={() => setForm(f => ({ ...f, payType: "cash" }))}>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>💵</div>
                        <div style={{ fontWeight: 700 }}>دفع عادي</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>نقداً أو تحويل مع دفعة مقدمة</div>
                      </div>
                      <div className={`premium-stat-card ${form.payType === "installment" ? "card-amber" : ""}`} style={{ cursor: "pointer", padding: 16 }} onClick={() => setForm(f => ({ ...f, payType: "installment" }))}>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>📅</div>
                        <div style={{ fontWeight: 700 }}>تقسيط</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>جدول أقساط بمواعيد محددة</div>
                      </div>
                    </div>
                    <div className="cyber-input-group" style={{ marginTop: 12 }}>
                      <label>{form.payType === "installment" ? "دفعة مقدمة (اختياري)" : "المبلغ المدفوع الآن (اختياري)"}</label>
                      <input type="number" min="0" step="0.01" className="search-neon-input" value={form.downPayment} onChange={e => setForm(f => ({ ...f, downPayment: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    {form.payType === "installment" && (
                      <div style={{ marginTop: 12, background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                          <div><label className="ei-field-label">عدد الأقساط</label><input type="number" min="1" className="search-neon-input" value={form.installCount} onChange={e => setForm(f => ({ ...f, installCount: parseInt(e.target.value) || 1 }))} /></div>
                          <div><label className="ei-field-label">كل كم شهر</label><input type="number" min="1" className="search-neon-input" value={form.installInterval} onChange={e => setForm(f => ({ ...f, installInterval: parseInt(e.target.value) || 1 }))} /></div>
                          <div><label className="ei-field-label">تاريخ القسط الأول</label><input type="date" className="search-neon-input" value={form.installStart} onChange={e => setForm(f => ({ ...f, installStart: e.target.value }))} /></div>
                        </div>
                        {schedule.length > 0 && <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 8 }}>كل قسط: {fmt(schedule[0]?.amount)} ج.م</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="premium-stats-grid" style={{ marginTop: 16, gap: 12 }}>
                  <div className="premium-stat-card card-blue" style={{ padding: 12 }}><div className="stat-label">إجمالي الفاتورة</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalAmount)} ج.م</div></div>
                  <div className="premium-stat-card card-green" style={{ padding: 12 }}><div className="stat-label">مدفوع الآن</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(form.downPayment || 0)} ج.م</div></div>
                  <div className="premium-stat-card card-amber" style={{ padding: 12 }}><div className="stat-label">المتبقي</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalAmount - (form.downPayment || 0))} ج.م</div></div>
                </div>
              </div>
              <div className="cyber-modal-footer">
                <button type="submit" className="cyber-btn-submit" disabled={saving}>{saving ? <><Loader2 size={16} className="spin" /> جاري الحفظ...</> : <><Save size={16} /> حفظ الفاتورة</>}</button>
                <button type="button" className="cyber-btn-dismiss" onClick={() => setModalType(null)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modalType === "view" && viewData && (
        <div className="blur-overlay" onClick={() => setModalType(null)}>
          <div className="cyber-modal" style={{ maxWidth: 800 , overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3><Eye size={18} style={{ marginLeft: "8px" }} /> {viewData.invoice.supplier_name} <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>#{viewData.invoice.id}</span></h3>
              <div style={{ display: "flex", gap: 8 }}>
                {Number(viewData.invoice.total_amount) - Number(viewData.invoice.total_paid_actual) > 0 && <button className="btn-action-neon btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => { setModalType(null); openPay(viewData.invoice); }}><Banknote size={13} /> دفع</button>}
                <button className="btn-action-neon btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => { setModalType(null); openEdit(viewData.invoice); }}><Edit3 size={13} /> تعديل</button>
                <button className="modal-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
              </div>
            </div>
            <div className="cyber-modal-body" >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Calendar size={14} /> {fmtDate(viewData.invoice.purchase_date)}
                <span style={{ flex: 1 }} />
                <span className={`pur-status ${paidStatus(viewData.invoice.total_amount, viewData.invoice.total_paid_actual).cls}`}>{paidStatus(viewData.invoice.total_amount, viewData.invoice.total_paid_actual).label}</span>
                {Number(viewData.invoice.pending_count) > 0 && <span className="pur-tag orange"><Clock size={10} /> {viewData.invoice.pending_count} قسط معلّق</span>}
              </div>
              <div className="premium-stats-grid" style={{ gap: 12, marginBottom: 20 }}>
                <div className="premium-stat-card card-blue" style={{ padding: 12 }}><div className="stat-label">إجمالي الفاتورة</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(viewData.invoice.total_amount)} ج.م</div></div>
                <div className="premium-stat-card card-green" style={{ padding: 12 }}><div className="stat-label">إجمالي المدفوع</div><div className="stat-value" style={{ fontSize: 18, color: "#34d399" }}>{fmt(viewData.invoice.total_paid_actual)} ج.م</div></div>
                <div className="premium-stat-card card-amber" style={{ padding: 12 }}><div className="stat-label">المتبقي</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(Number(viewData.invoice.total_amount) - Number(viewData.invoice.total_paid_actual))} ج.م</div></div>
              </div>
              <div className="section-header-mini" style={{ marginBottom: 12 }}><Package size={14} /> الأصناف</div>
              <div className="cyber-table-container" style={{ marginBottom: 20 }}>
                <table className="cyber-table" style={{ fontSize: 13 }}>
                  <thead><tr><th>المنتج</th><th>المقاس/اللون</th><th style={{ textAlign: "center" }}>الكمية</th><th>سعر التكلفة</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {viewData.items?.map((it, i) => (
                      <tr key={i} className="cyber-row-main">
                        <td>{it.product_name || "منتج"}</td>
                        <td>{[it.color, it.size].filter(Boolean).join(" / ") || it.variant_barcode || "—"}</td>
                        <td style={{ textAlign: "center" }}>{it.quantity} قطعة</td>
                        <td>{fmt(it.cost_price)} ج.م</td>
                        <td className="num-primary">{fmt(it.quantity * it.cost_price)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payments timeline */}
              <div className="section-header-mini" style={{ marginBottom: 12 }}><History size={14} /> سجل الدفعات والأقساط</div>
              {!viewData.payments?.length ? <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>لا توجد دفعات مسجّلة بعد</div> : (
                <div className="pur-timeline">
                  {viewData.payments.map(pay => {
                    const isPending = pay.status === "pending";
                    const dotCls = isPending ? "pending" : (pay.note === "دفعة مقدمة" ? "init" : mDot(pay.payment_method));
                    return (
                      <div className="pur-tl-entry" key={pay.id}>
                        <div style={{ width: 26, display: "flex", justifyContent: "center" }}><div className={`pur-tl-dot ${dotCls}`} /></div>
                        <div className={`pur-tl-card ${isPending ? "pending-card" : ""}`}>
                          <div className="pur-tl-left">
                            <div className="pur-tl-method">{isPending ? `⏳ قسط ${pay.installment_number} — معلّق` : (pay.note === "دفعة مقدمة" ? "دفعة مقدمة عند الإنشاء" : (pay.is_installment ? `✓ قسط ${pay.installment_number} — مدفوع` : mLabel(pay.payment_method)))}</div>
                            <div className="pur-tl-date">{isPending ? `موعد الاستحقاق: ${fmtDate(pay.due_date)}` : fmtDT(pay.paid_at)}</div>
                            {pay.note && !["دفعة مقدمة"].includes(pay.note) && !pay.is_installment && <div className="pur-tl-note">"{pay.note}"</div>}
                          </div>
                          <div className="pur-tl-right">
                            {isPending && <button className="pur-tl-pay-now" onClick={() => payInstall(pay, viewData.invoice.id)}><BadgeCheck size={11} /> دفع الآن</button>}
                            <button className="pur-tl-del" onClick={() => deletePay(pay.id, viewData.invoice.id)}><Trash2 size={11} /></button>
                            <span className={`pur-tl-amount ${isPending ? "pending" : "paid"}`}>{isPending ? "" : "+"}{fmt(pay.amount)} ج.م</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, padding: "12px 16px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}><BadgeCheck size={13} style={{ display: "inline", marginLeft: 4 }} /> إجمالي المدفوع فعلاً</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#34d399", fontSize: 15 }}>{fmt(viewData.payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0))} ج.م</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {modalType === "pay" && payTarget && (
        <div className="blur-overlay" onClick={() => setModalType(null)}>
          <div className="cyber-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header"><h3><Banknote size={18} /> تسجيل دفعة — {payTarget.supplier_name}</h3><button className="modal-close-btn" onClick={() => setModalType(null)}><X size={20} /></button></div>
            <div className="cyber-modal-body">
              <div className="pur-pay-summary">
                {(() => { const ap = Number(payTarget.total_paid_actual); const rem = Number(payTarget.total_amount) - ap; return [["الإجمالي", fmt(payTarget.total_amount), "var(--blue)"], ["المدفوع", fmt(ap), "var(--green)"], ["المتبقي", fmt(rem), "var(--amber)"]].map(s => <div key={s[0]} className="pur-pay-summary-item"><span className="pur-pay-summary-lbl">{s[0]}</span><span className="pur-pay-summary-val" style={{ color: s[2] }}>{s[1]} ج.م</span></div>); })()}
              </div>
              <div className="cyber-input-group"><label>المبلغ</label><input type="number" min="0.01" step="0.01" className="search-neon-input" autoFocus value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /><button className="pur-pay-full-btn" onClick={() => { const rem = Number(payTarget.total_amount) - Number(payTarget.total_paid_actual); setPayForm(f => ({ ...f, amount: rem > 0 ? rem : 0 })); }}><CheckCircle2 size={11} /> دفع الكل ({fmt(Number(payTarget.total_amount) - Number(payTarget.total_paid_actual))} ج.م)</button></div>
              <div className="cyber-input-group"><label>طريقة الدفع</label><select className="premium-select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}><option value="cash">نقداً</option><option value="bank">تحويل بنكي</option><option value="check">شيك</option><option value="other">أخرى</option></select></div>
              <div className="cyber-input-group"><label>ملاحظة (اختياري)</label><input type="text" className="search-neon-input" placeholder="رقم الشيك / رقم التحويل..." value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} /></div>
            </div>
            <div className="cyber-modal-footer"><button className="cyber-btn-submit" style={{ background: "#06b6d4" }} onClick={handlePaySave} disabled={saving}>{saving ? <><Loader2 size={16} className="spin" /> جاري التسجيل...</> : <><BadgeCheck size={16} /> تأكيد الدفعة</>}</button><button className="cyber-btn-dismiss" onClick={() => setModalType(null)}>إلغاء</button></div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modalType === "delete" && deleteTarget && (
        <div className="blur-overlay" onClick={() => { setModalType(null); setDeleteTarget(null); }}>
          <div className="cyber-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-cyber-header"><h3 style={{ color: "#f87171" }}><AlertTriangle size={18} style={{ marginLeft: "8px" }} /> تأكيد الحذف</h3><button className="modal-close-btn" onClick={() => { setModalType(null); setDeleteTarget(null); }}><X size={20} /></button></div>
            <div className="cyber-modal-body" style={{ textAlign: "center" }}>
              <div className="pur-delete-icon-wrap" style={{ width: 56, height: 56, background: "rgba(239,68,68,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><AlertTriangle size={28} color="#f87171" /></div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>حذف فاتورة #{deleteTarget.id}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>مورد <strong>{deleteTarget.supplier_name}</strong> — إجمالي <strong>{fmt(deleteTarget.total_amount)} ج.م</strong><br />سيتم استرجاع المخزون وحذف جميع الدفعات والأقساط. لا يمكن التراجع.</div>
            </div>
            <div className="cyber-modal-footer"><button className="cyber-btn-submit danger-bg" onClick={confirmDelete}>{loading ? <><Loader2 size={15} className="spin" /> جاري...</> : <><Trash2 size={15} /> نعم، احذف</>}</button><button className="cyber-btn-dismiss" onClick={() => { setModalType(null); setDeleteTarget(null); }}>إلغاء</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;