import React, { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import {
  Plus, Trash2, UserPlus, X, Phone, User, Loader2, Search, Edit, Truck, Building2, AlertTriangle,
  ChevronDown, ChevronLeft, Eye, Receipt, DollarSign, TrendingUp, Calendar, Package, History
} from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " ج.م";

const SuppliersPage = ({ showToast }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, supplier: null });
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [supplierInvoices, setSupplierInvoices] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState({});
  const [deleteInvoiceConfirm, setDeleteInvoiceConfirm] = useState({ show: false, invoice: null, supplierId: null });
  
  const [viewInvoiceModal, setViewInvoiceModal] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await db.select(`
        SELECT 
          s.id,
          s.name,
          s.phone,
          COALESCE((
            SELECT SUM(po.total_amount) 
            FROM purchase_orders po 
            WHERE po.supplier_id = s.id
          ), 0) AS total_purchases,
          COALESCE((
            SELECT SUM(sp.amount) 
            FROM supplier_payments sp 
            WHERE sp.supplier_id = s.id AND sp.status = 'paid'
          ), 0) AS total_paid
        FROM suppliers s
        ORDER BY s.id DESC
      `);
      setSuppliers(rows || []);
    } catch (err) {
      console.error(err);
      showToast("خطأ في تحميل الموردين", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSupplierInvoices = async (supplierId) => {
    if (supplierInvoices[supplierId]) return;
    setLoadingInvoices(prev => ({ ...prev, [supplierId]: true }));
    try {
      const db = await getDb();
      const invoices = await db.select(`
        SELECT 
          po.id,
          po.purchase_date,
          po.total_amount,
          COALESCE((
            SELECT SUM(sp.amount) 
            FROM supplier_payments sp 
            WHERE sp.purchase_order_id = po.id AND sp.status = 'paid'
          ), 0) AS paid_amount
        FROM purchase_orders po
        WHERE po.supplier_id = ?
        ORDER BY po.purchase_date DESC
      `, [supplierId]);
      setSupplierInvoices(prev => ({ ...prev, [supplierId]: invoices }));
    } catch (err) {
      console.error(err);
      showToast("خطأ في تحميل فواتير المورد", "error");
    } finally {
      setLoadingInvoices(prev => ({ ...prev, [supplierId]: false }));
    }
  };

  const toggleExpand = (supplierId) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
    } else {
      setExpandedSupplier(supplierId);
      if (!supplierInvoices[supplierId]) {
        fetchSupplierInvoices(supplierId);
      }
    }
  };

  const fetchInvoiceDetails = async (invoiceId) => {
    setLoadingDetails(true);
    try {
      const db = await getDb();
      const invoiceData = await db.select(`
        SELECT po.*, s.name AS supplier_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.id = ?
      `, [invoiceId]);
      if (!invoiceData.length) throw new Error("الفاتورة غير موجودة");
      const invoice = invoiceData[0];

      const items = await db.select(`
        SELECT pi.quantity, pi.cost_price,
               p.name AS product_name,
               pv.color, pv.size, pv.variant_barcode
        FROM purchase_items pi
        LEFT JOIN products p ON pi.product_id = p.id
        LEFT JOIN product_variants pv ON pi.variant_id = pv.id
        WHERE pi.purchase_order_id = ?
      `, [invoiceId]);

      const payments = await db.select(`
        SELECT * FROM supplier_payments 
        WHERE purchase_order_id = ? 
        ORDER BY COALESCE(due_date, paid_at) ASC
      `, [invoiceId]);

      setInvoiceDetails({ invoice, items, payments });
    } catch (err) {
      console.error(err);
      showToast("خطأ في تحميل تفاصيل الفاتورة", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  const openViewModal = async (invoice) => {
    setViewInvoiceModal(invoice);
    await fetchInvoiceDetails(invoice.id);
  };

  const closeViewModal = () => {
    setViewInvoiceModal(null);
    setInvoiceDetails(null);
  };

  const confirmDeleteInvoice = async () => {
    const { invoice, supplierId } = deleteInvoiceConfirm;
    if (!invoice) return;
    try {
      const db = await getDb();
      const items = await db.select(
        "SELECT variant_id, quantity FROM purchase_items WHERE purchase_order_id = ?",
        [invoice.id]
      );
      for (const item of items) {
        if (item.variant_id) {
          await db.execute("UPDATE product_variants SET stock = stock - ? WHERE id = ?", [item.quantity, item.variant_id]);
        }
      }
      await db.execute("DELETE FROM supplier_payments WHERE purchase_order_id = ?", [invoice.id]);
      await db.execute("DELETE FROM purchase_items WHERE purchase_order_id = ?", [invoice.id]);
      await db.execute("DELETE FROM purchase_orders WHERE id = ?", [invoice.id]);
      showToast("تم حذف الفاتورة واسترجاع المخزون", "success");
      setDeleteInvoiceConfirm({ show: false, invoice: null, supplierId: null });
      await fetchSuppliers();
      if (supplierId) {
        setSupplierInvoices(prev => ({ ...prev, [supplierId]: null }));
        fetchSupplierInvoices(supplierId);
      }
    } catch (err) {
      console.error(err);
      showToast("خطأ في حذف الفاتورة: " + err.message, "error");
    }
  };

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    try {
      const db = await getDb();
      if (editingSupplier) {
        await db.execute("UPDATE suppliers SET name = ?, phone = ? WHERE id = ?", [
          newSupplier.name,
          newSupplier.phone,
          editingSupplier.id,
        ]);
        showToast("تم تحديث المورد بنجاح", "success");
      } else {
        await db.execute("INSERT INTO suppliers (name, phone) VALUES (?, ?)", [
          newSupplier.name,
          newSupplier.phone,
        ]);
        showToast("تم إضافة المورد بنجاح", "success");
      }
      setModalOpen(false);
      setEditingSupplier(null);
      setNewSupplier({ name: "", phone: "" });
      fetchSuppliers();
    } catch (err) {
      showToast("خطأ أثناء الحفظ", "error");
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setNewSupplier({ name: supplier.name, phone: supplier.phone || "" });
    setModalOpen(true);
  };

  const handleDeleteRequest = (supplier) => {
    setDeleteConfirm({ show: true, supplier });
  };

  const confirmDeleteSupplier = async () => {
    const supplier = deleteConfirm.supplier;
    if (!supplier) return;
    try {
      const db = await getDb();
      const related = await db.select(
        "SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1",
        [supplier.id]
      );
      if (related && related.length > 0) {
        showToast("لا يمكن حذف هذا المورد لأنه مرتبط بفواتير مشتريات", "error");
        setDeleteConfirm({ show: false, supplier: null });
        return;
      }
      await db.execute("DELETE FROM suppliers WHERE id = ?", [supplier.id]);
      showToast("تم حذف المورد بنجاح", "success");
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء محاولة الحذف", "error");
    } finally {
      setDeleteConfirm({ show: false, supplier: null });
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm))
  );

  const totalSuppliers = suppliers.length;
  const totalPurchasesAll = suppliers.reduce((s, sup) => s + sup.total_purchases, 0);
  const totalPaidAll = suppliers.reduce((s, sup) => s + sup.total_paid, 0);
  const totalRemaining = totalPurchasesAll - totalPaidAll;

  return (
    <div className="page-container" dir="rtl">
      {/* Premium Glassmorphic Stats Grid */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card card-blue">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><Building2 size={22} /></div>
            <div className="stat-details">
              <span className="label">إجمالي الموردين</span>
              <span className="value font-mono">{totalSuppliers}</span>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-emerald">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><TrendingUp size={22} /></div>
            <div className="stat-details">
              <span className="label">إجمالي المشتريات</span>
              <span className="value price-text">{fmt(totalPurchasesAll)}</span>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-cyan">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><DollarSign size={22} /></div>
            <div className="stat-details">
              <span className="label">إجمالي المدفوع</span>
              <span className="value price-text">{fmt(totalPaidAll)}</span>
            </div>
          </div>
        </div>
        <div className="premium-stat-card card-amber">
          <div className="stat-glow"></div>
          <div className="stat-content">
            <div className="icon-box"><AlertTriangle size={22} /></div>
            <div className="stat-details">
              <span className="label">المتبقي للموردين</span>
              <span className="value price-text warning-glow">{fmt(totalRemaining)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Blurred Header Control Bar */}
      <div className="premium-control-bar">
        <div className="title-wrapper">
          <div className="brand-badge"><Truck size={24} /></div>
          <div>
            <h2 className="main-title-neon">كشف حساب الموردين المتقدم</h2>
            <p className="sub-title-dim">متابعة الفواتير الحية، جدولة المستحقات، وتحليل حركة الحسابات المالية للموردين.</p>
          </div>
        </div>
        <div className="actions-wrapper">
          <div className="search-neon-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="بحث باسم المورد أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-neon-input"
            />
          </div>
          <button
            className="btn-action-neon btn-add"
            onClick={() => {
              setEditingSupplier(null);
              setNewSupplier({ name: "", phone: "" });
              setModalOpen(true);
            }}
          >
            <UserPlus size={18} /> <span>إضافة مورد جديد</span>
          </button>
        </div>
      </div>

      {/* Cyber Table Wrapper */}
      <div className="cyber-table-container">
        <table className="cyber-table">
          <thead>
            <tr>
              <th style={{ width: 60, textAlign: "center" }}>عرض</th>
              <th><User size={15} className="table-th-icon" /> المورد</th>
              <th><Phone size={15} className="table-th-icon" /> رقم الهاتف</th>
              <th>إجمالي المشتريات</th>
              <th>إجمالي المدفوع</th>
              <th>المتبقي عليك</th>
              <th style={{ width: 120, textAlign: "center" }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="cyber-table-loading">
                  <Loader2 size={28} className="animate-spin text-cyan-400" />
                  <span>جاري مزامنة بيانات الموردين...</span>
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan="7" className="cyber-table-empty">لا توجد سجلات موردين مطابقة للبحث حالياً.</td>
              </tr>
            ) : (
              filteredSuppliers.map((sup) => {
                const isExpanded = expandedSupplier === sup.id;
                const remaining = sup.total_purchases - sup.total_paid;
                return (
                  <React.Fragment key={sup.id}>
                    <tr className={`cyber-row-main ${isExpanded ? "row-active" : ""}`}>
                      <td className="expand-trigger" onClick={() => toggleExpand(sup.id)}>
                        <div className={`chevron-circle ${isExpanded ? "rotated" : ""}`}>
                          <ChevronLeft size={16} />
                        </div>
                      </td>
                      <td>
                        <div className="supplier-identity">
                          <span className="sup-avatar">{sup.name.charAt(0)}</span>
                          <span className="sup-name">{sup.name}</span>
                        </div>
                      </td>
                      <td>
                        {sup.phone ? (
                          <span className="phone-badge" dir="ltr">{sup.phone}</span>
                        ) : (
                          <span className="dim-dash">—</span>
                        )}
                      </td>
                      <td className="num-primary">{fmt(sup.total_purchases)}</td>
                      <td className="num-success">{fmt(sup.total_paid)}</td>
                      <td className={`num-accent ${remaining > 0 ? "has-debt" : ""}`}>{fmt(remaining)}</td>
                      <td>
                        <div className="table-actions-cell">
                          <button className="cyber-btn-mini edit" onClick={() => handleEdit(sup)} title="تعديل">
                            <Edit size={14} />
                          </button>
                          <button className="cyber-btn-mini delete" onClick={() => handleDeleteRequest(sup)} title="حذف">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Nested Invoices View */}
                    {isExpanded && (
                      <tr className="cyber-nested-row">
                        <td colSpan="7">
                          <div className="nested-wrapper animate-slide-down">
                            <div className="nested-header">
                              <div className="nested-title">
                                <Receipt size={16} className="text-cyan-400" />
                                <h4>كشف الفواتير التفصيلي الصادر للمورد</h4>
                              </div>
                            </div>
                            
                            {loadingInvoices[sup.id] ? (
                              <div className="nested-loading"><Loader2 size={20} className="animate-spin" /> جاري سحب كشف الفواتير...</div>
                            ) : supplierInvoices[sup.id]?.length === 0 ? (
                              <div className="nested-empty">لم يتم تسجيل أي فواتير مشتريات لهذا المورد بعد.</div>
                            ) : (
                              <table className="nested-table">
                                <thead>
                                  <tr>
                                    <th>كود الفاتورة</th>
                                    <th>تاريخ المعاملة</th>
                                    <th>القيمة الإجمالية</th>
                                    <th>المدفوع نقداً</th>
                                    <th>المتبقي المستحق</th>
                                    <th style={{ textAlign: "center" }}>الخيارات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {supplierInvoices[sup.id]?.map(inv => {
                                    const rem = inv.total_amount - inv.paid_amount;
                                    return (
                                      <tr key={inv.id} className="nested-body-row">
                                        <td className="font-mono text-cyan-400">#{inv.id}</td>
                                        <td>{new Date(inv.purchase_date).toLocaleDateString("ar-EG")}</td>
                                        <td className="num-bold">{fmt(inv.total_amount)}</td>
                                        <td className="num-success-dim">{fmt(inv.paid_amount)}</td>
                                        <td className={rem > 0 ? "num-warning-dim" : "text-slate-400"}>{fmt(rem)}</td>
                                        <td>
                                          <div className="nested-actions">
                                            <button className="btn-nested-action view" onClick={() => openViewModal(inv)}>
                                              <Eye size={13} /> <span>المعاينة</span>
                                            </button>
                                            <button className="btn-nested-action delete" onClick={() => setDeleteInvoiceConfirm({ show: true, invoice: inv, supplierId: sup.id })}>
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Glassmorphic Modal Form */}
      {modalOpen && (
        <div className="blur-overlay" onClick={() => { setModalOpen(false); setEditingSupplier(null); }}>
          <div className="cyber-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <h3>{editingSupplier ? "تحديث ملف المورد المالي" : "إنشاء بطاقة مورد جديد"}</h3>
              <button className="modal-close-btn" onClick={() => { setModalOpen(false); setEditingSupplier(null); }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddOrUpdate} className="cyber-form">
              <div className="cyber-input-group">
                <label><User size={14} /> اسم المورد / الشركة التجارية</label>
                <input type="text" placeholder="مثال: شركة النور للتوريدات" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} required />
              </div>
              <div className="cyber-input-group">
                <label><Phone size={14} /> رقم هاتف التواصل</label>
                <input type="tel" placeholder="01xxxxxxxxx" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
              </div>
              <div className="cyber-modal-actions">
                <button type="submit" className="cyber-btn-submit">{editingSupplier ? "تعديل البيانات المعتمدة" : "إدراج المورد بالسيستم"}</button>
                <button type="button" className="cyber-btn-dismiss" onClick={() => { setModalOpen(false); setEditingSupplier(null); }}>إلغاء الأمر</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Dialogs (Modals) */}
      {deleteConfirm.show && deleteConfirm.supplier && (
        <div className="blur-overlay">
          <div className="cyber-modal dialog-alert animate-scale-up">
            <div className="alert-head-icon"><AlertTriangle size={36} /></div>
            <h3>تأكيد حذف الحساب المورد</h3>
            <p className="alert-desc">هل أنت متأكد من مسح المورد <strong>"{deleteConfirm.supplier.name}"</strong> نهائياً من قاعدة البيانات؟</p>
            <div className="cyber-modal-actions centered">
              <button className="cyber-btn-submit danger-bg" onClick={confirmDeleteSupplier}>نعم، تدمير السجل</button>
              <button className="cyber-btn-dismiss" onClick={() => setDeleteConfirm({ show: false, supplier: null })}>تراجع</button>
            </div>
          </div>
        </div>
      )}

      {deleteInvoiceConfirm.show && deleteInvoiceConfirm.invoice && (
        <div className="blur-overlay">
          <div className="cyber-modal dialog-alert animate-scale-up">
            <div className="alert-head-icon"><AlertTriangle size={36} style={{ color: "#ef4444" }} /></div>
            <h3>تأكيد حذف الفاتورة وعكس المخازن</h3>
            <p className="alert-desc">سيتم حذف فاتورة المشتريات رقم <strong className="text-cyan-400">#{deleteInvoiceConfirm.invoice.id}</strong> بشكل نهائي، <strong>وسيتم استرجاع وعكس كميات المخزون تلقائياً</strong>.</p>
            <div className="cyber-modal-actions centered">
              <button className="cyber-btn-submit danger-bg" onClick={confirmDeleteInvoice}>تأكيد الحذف والعكس</button>
              <button className="cyber-btn-dismiss" onClick={() => setDeleteInvoiceConfirm({ show: false, invoice: null, supplierId: null })}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Full Spec Modal */}
      {viewInvoiceModal && invoiceDetails && (
        <div className="blur-overlay" onClick={closeViewModal}>
          <div className="cyber-modal wide-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cyber-header">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-cyan-400" />
                <h3>مواصفات فاتورة المشتريات رقم #{viewInvoiceModal.id}</h3>
              </div>
              <button className="modal-close-btn" onClick={closeViewModal}><X size={18} /></button>
            </div>
            
            <div className="modal-scroll-area">
              <div className="spec-invoice-cards">
                <div className="spec-card"><span>اسم المورد المعتمد</span><strong>{invoiceDetails.invoice.supplier_name}</strong></div>
                <div className="spec-card"><span>تاريخ التحرير</span><strong>{new Date(invoiceDetails.invoice.purchase_date).toLocaleDateString("ar-EG")}</strong></div>
                <div className="spec-card text-emerald-400"><span>القيمة الإجمالية</span><strong>{fmt(invoiceDetails.invoice.total_amount)}</strong></div>
                <div className="spec-card text-cyan-400"><span>إجمالي المدفوعات</span><strong>{fmt(invoiceDetails.invoice.paid_amount)}</strong></div>
                <div className="spec-card text-amber-500"><span>صافي المتبقي</span><strong>{fmt(invoiceDetails.invoice.total_amount - invoiceDetails.invoice.paid_amount)}</strong></div>
              </div>

              <div className="spec-section-box">
                <div className="spec-box-title"><Package size={15} /> بنود وفهرس المنتجات المدرجة</div>
                {invoiceDetails.items?.length ? (
                  <table className="spec-table">
                    <thead>
                      <tr>
                        <th>بيان المنتج</th>
                        <th>السمات (اللون / المقاس)</th>
                        <th>الكمية الموردة</th>
                        <th>سعر تكلفة القطعة</th>
                        <th>الإجمالي الصافي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDetails.items.map((it, i) => (
                        <tr key={i}>
                          <td className="text-white font-medium">{it.product_name || "منتج غير معرف"}</td>
                          <td><span className="variant-tag">{[it.color, it.size].filter(Boolean).join(" - ") || it.variant_barcode || "—"}</span></td>
                          <td className="text-cyan-400 font-mono">{it.quantity} قطعة</td>
                          <td>{fmt(it.cost_price)}</td>
                          <td className="text-white font-mono">{fmt(it.quantity * it.cost_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className="spec-empty">لا توجد أصناف في هذه الفاتورة.</div>}
              </div>

              <div className="spec-section-box">
                <div className="spec-box-title"><History size={15} /> الأرشيف التاريخي لعمليات السداد</div>
                {invoiceDetails.payments?.length ? (
                  <table className="spec-table">
                    <thead>
                      <tr>
                        <th>توقيت الدفع</th>
                        <th>المبلغ المقبوض</th>
                        <th>طريقة الدفع وسيلة</th>
                        <th>بيان الشروحات والملحوظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDetails.payments.map((p, i) => (
                        <tr key={i}>
                          <td>{p.paid_at ? new Date(p.paid_at).toLocaleString("ar-EG") : (p.due_date ? `استحقاق: ${new Date(p.due_date).toLocaleDateString("ar-EG")}` : "—")}</td>
                          <td className="text-emerald-400 font-bold font-mono">{fmt(p.amount)}</td>
                          <td><span className="payment-method-tag">{p.payment_method === "cash" ? "نقداً كاش" : p.payment_method === "bank" ? "تحويل بنكي" : p.payment_method === "check" ? "شيك بنكي" : "أخرى"}</span></td>
                          <td className="text-slate-400">{p.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className="spec-empty">لم يتم رصد أي دفعات سداد مسجلة لهذه الفاتورة.</div>}
              </div>
            </div>
            <div className="cyber-modal-actions end-aligned">
              <button className="cyber-btn-dismiss" onClick={closeViewModal}>إغلاق النافذة</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Block Screen */}
      {viewInvoiceModal && loadingDetails && (
        <div className="blur-overlay">
          <div className="cyber-loading-card">
            <Loader2 size={32} className="animate-spin text-cyan-400" />
            <p>جاري استدعاء البيانات التفصيلية ومطابقة الحسابات...</p>
          </div>
        </div>
      )}

      {/* Cyber Glassmorphism Stylesheet Container */}
      <style jsx>{`
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
    </div>
  );
};

export default SuppliersPage;