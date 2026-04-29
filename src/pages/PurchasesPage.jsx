import { useEffect, useState, useMemo } from "react";
import { getDb } from "../lib/db";
import {
  Plus,
  Trash2,
  Edit3,
  XCircle,
  Package,
  Eye,
  Loader2,
} from "lucide-react";

const PurchasesPage = ({ showToast }) => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    supplier_id: "",
    total_amount: 0,
    paid_amount: 0,
  });

  const [items, setItems] = useState([]);

  // =========================
  // Fetch
  // =========================
  const fetchData = async () => {
    try {
      const db = await getDb();

      const pRes = await db.select(`
        SELECT po.*, s.name as supplier_name 
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        ORDER BY po.id DESC
      `);

      const sRes = await db.select("SELECT * FROM suppliers");

      setPurchases(pRes);
      setSuppliers(sRes);
    } catch {
      showToast("خطأ في تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // =========================
  // حساب الإجمالي
  // =========================
  const totalAmount = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + item.quantity * item.cost,
      0
    );
  }, [items]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, total_amount: totalAmount }));
  }, [totalAmount]);

  // =========================
  // Items
  // =========================
  const addItem = () => {
    setItems([
      ...items,
      { barcode: "", quantity: 1, cost: 0 },
    ]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // =========================
  // Open Modal
  // =========================
  const openAddModal = () => {
    setFormData({
      supplier_id: "",
      total_amount: 0,
      paid_amount: 0,
    });
    setItems([{ barcode: "", quantity: 1, cost: 0 }]);
    setModalType("add");
  };

  // =========================
  // Save
  // =========================
const handleSave = async (e) => {
  e.preventDefault();

  const db = await getDb();

  try {
    let purchaseId = formData.id;

    // =============================
    // 🧨 لو Edit → رجّع القديم
    // =============================
    if (modalType === "edit") {

      const oldItems = await db.select(
        `SELECT pi.quantity, pv.id 
        FROM purchase_items pi
        JOIN product_variants pv ON pv.product_id = pi.product_id
        WHERE pi.purchase_order_id = $1`,
        [purchaseId]
      );

      for (const old of oldItems) {
        await db.execute(
          "UPDATE product_variants SET stock = stock - $1 WHERE id = $2",
          [old.quantity, old.id]
        );


        // if (variant.length) {
        //   await db.execute(
        //     "UPDATE product_variants SET stock = stock - $1 WHERE id = $2",
        //     [old.quantity, variant[0].id]
        //   );
        // }
      }

      // حذف القديم
      await db.execute(
        "DELETE FROM purchase_items WHERE purchase_order_id = $1",
        [purchaseId]
      );
    }

    // =============================
    // 🆕 لو Add
    // =============================
    if (modalType === "add") {
      const res = await db.execute(
        `INSERT INTO purchase_orders (supplier_id,total_amount,paid_amount,purchase_date)
         VALUES ($1,$2,$3,datetime('now'))`,
        [formData.supplier_id, totalAmount, formData.paid_amount]
      );

      purchaseId = res.lastInsertId;
    } else {
      // تحديث الهيدر
      await db.execute(
        `UPDATE purchase_orders 
         SET supplier_id=$1,total_amount=$2,paid_amount=$3 
         WHERE id=$4`,
        [
          formData.supplier_id,
          totalAmount,
          formData.paid_amount,
          purchaseId,
        ]
      );
    }

    // =============================
    // 🧠 Apply الجديد
    // =============================
    for (const item of items) {

      const existingVariant = await db.select(
        "SELECT * FROM product_variants WHERE variant_barcode = $1 LIMIT 1",
        [item.barcode]
      );

      if (existingVariant.length > 0) {
        const variant = existingVariant[0];

        await db.execute(
          "UPDATE product_variants SET stock = stock + $1 WHERE id = $2",
          [item.quantity, variant.id]
        );

        await db.execute(
          "UPDATE products SET cost_price = $1 WHERE id = $2",
          [item.cost, variant.product_id]
        );

        await db.execute(
          `INSERT INTO purchase_items (purchase_order_id, product_id, quantity, cost_price)
           VALUES ($1,$2,$3,$4)`,
          [purchaseId, variant.product_id, item.quantity, item.cost]
        );

      } else {
        // منتج جديد
        const res = await db.execute(
          `INSERT INTO products (name, barcode, cost_price, sale_price, stock)
           VALUES ($1,$2,$3,$4,$5)`,
          ["منتج جديد", item.barcode, item.cost, item.cost * 1.3, item.quantity]
        );

        const productId = res.lastInsertId;

        await db.execute(
          `INSERT INTO product_variants (product_id, stock, variant_barcode)
           VALUES ($1,$2,$3)`,
          [productId, item.quantity, item.barcode]
        );

        await db.execute(
          `INSERT INTO purchase_items (purchase_order_id, product_id, quantity, cost_price)
           VALUES ($1,$2,$3,$4)`,
          [purchaseId, productId, item.quantity, item.cost]
        );
      }
    }

    showToast("تم تحديث الفاتورة بنجاح", "success");
    setModalType(null);
    setItems([]);
    setFormData({
      supplier_id: "",
      total_amount: 0,
      paid_amount: 0,
    });
    fetchData();

  } catch (err) {
    console.error(err);
    showToast("خطأ في التعديل", "error");
  }
};




  const openEditModal = async (purchase) => {
  const db = await getDb();

  const items = await db.select(
    `SELECT pi.*, pv.variant_barcode
     FROM purchase_items pi
     LEFT JOIN product_variants pv 
     ON pv.product_id = pi.product_id
     WHERE pi.purchase_order_id = $1`,
    [purchase.id]
  );

  setFormData({
    id: purchase.id,
    supplier_id: purchase.supplier_id,
    paid_amount: purchase.paid_amount,
  });

  setItems(
    items.map((i) => ({
      barcode: i.variant_barcode || "",
      quantity: i.quantity,
      cost: i.cost_price,
    }))
  );

  setModalType("edit");
};

const filteredPurchases = useMemo(() => {
  return purchases.filter((p) => {
    const term = searchTerm.toLowerCase();

    return (
      p.supplier_name.toLowerCase().includes(term) ||
      p.total_amount.toString().includes(term) ||
      new Date(p.purchase_date)
        .toLocaleDateString()
        .includes(term)
    );
  });
}, [purchases, searchTerm]);


const supplierSummary = useMemo(() => {
  let total = 0;
  let paid = 0;

  filteredPurchases.forEach((p) => {
    total += p.total_amount;
    paid += p.paid_amount;
  });

  return {
    total,
    paid,
    remaining: total - paid,
  };
}, [filteredPurchases]);



const openViewModal = async (purchase) => {
  const db = await getDb();

  const items = await db.select(
    `SELECT pi.*, pv.variant_barcode
     FROM purchase_items pi
     LEFT JOIN product_variants pv 
     ON pv.product_id = pi.product_id
     WHERE pi.purchase_order_id = $1`,
    [purchase.id]
  );

  setViewInvoice({
    ...purchase,
    items,
  });
};



  // =========================
  return (
    <div className="page-container animate-fade-in" dir="rtl">
      
      {/* HEADER */}
      <div className="page-header-container">
        <div className="header-title-section">
          <h2 className="main-title">
            إدارة المشتريات{" "}
            <span className="count-badge">{purchases.length}</span>
          </h2>
          <p className="sub-title">إدارة فواتير الموردين</p>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <input
              placeholder="بحث باسم المورد..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button className="btn-save" onClick={openAddModal}>
            <Plus size={20} /> فاتورة جديدة
          </button>
        </div>
      </div>



      <div className="stats-bar shadow-glow">
  <div className="stat-box">
    <span>إجمالي الفواتير</span>
    <strong>{supplierSummary.total.toFixed(2)} ج.م</strong>
  </div>

  <div className="stat-box">
    <span>المدفوع</span>
    <strong className="text-success">
      {supplierSummary.paid.toFixed(2)} ج.م
    </strong>
  </div>

  <div className="stat-box highlight">
    <span>المتبقي</span>
    <strong className="text-danger">
      {supplierSummary.remaining.toFixed(2)} ج.م
    </strong>
  </div>
</div>

      {/* TABLE */}
      <div className="table-wrapper-premium shadow-glow">
        <table className="custom-table">
          <thead>
            <tr>
              <th>المورد</th>
              <th>التاريخ</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>الإجراءات</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center p-10">
                  <Loader2 className="animate-spin" /> جاري التحميل...
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center p-10">
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              filteredPurchases.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td>
                      <div className="model-info-premium">
                        <span className="model-primary-name">{p.supplier_name}</span>
                        <span className="tag-season">
                          {new Date(p.purchase_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td>
                        <span className="sale-text">{p.total_amount} ج.م</span>
                    </td>
                    <td>
                        <span className="cost-text">{p.paid_amount} ج.م</span>
                    </td>
                    <td>
                        <div
                          className={`stock-badge-modern ${
                            p.total_amount - p.paid_amount > 0 ? "critical" : "ok"
                          }`}
                        >
                          <div className="stock-dot"></div>
                          <span>
                            {(p.total_amount - p.paid_amount).toFixed(2)} ج.م
                          </span>
                        </div>
                    </td>
                    <td className="actions-cell-premium">
                      <button
                        className="action-btn edit"
                        onClick={() => openEditModal(p)}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => setShowDeleteConfirm(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        className="action-btn view"
                        onClick={() => openViewModal(p)}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modalType && (
        <div className="modal-overlay">
          <div className="modal-content-premium form-modal product-width">
            <div className="modal-header">
              <h3>
              {modalType === "add"
                ? "إضافة فاتورة مشتريات"
                : "تعديل الفاتورة"}
            </h3>
            </div>

            <form onSubmit={handleSave} className="premium-form">

              {/* المورد */}
              <div className="input-group">
                <label>المورد</label>
                <select
                  className="premium-select"
                  required
                  value={formData.supplier_id || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplier_id: e.target.value,
                    })
                  }
                >
                  <option value="">اختر المورد</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ITEMS */}
              <div className="variants-header">
                <Package size={18} /> <span>الأصناف</span>
              </div>
              <div className="variants-body custom-scrollbar">
                {items.map((item, index) => (
                  <div key={index} className="variant-row-premium animate-slide-up">
                    <input
                      placeholder="باركود المنتج"
                      value={item.barcode || ""}
                      onChange={(e) =>
                        updateItem(index, "barcode", e.target.value)
                      }
                    />

                    <input
                      type="number"
                      placeholder="الكمية"
                      value={item.quantity || 0}
                      onChange={(e) =>
                        updateItem(index, "quantity", +e.target.value)
                      }
                    />

                    <input
                      type="number"
                      placeholder="سعر التكلفة"
                      value={item.cost || 0}
                      onChange={(e) =>
                        updateItem(index, "cost", +e.target.value)
                      }
                    />

                    <button
                      type="button"
                      className="remove-row-btn"
                      onClick={() => removeItem(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="add-row-btn" onClick={addItem}>
                + إضافة صنف
              </button>

              {/* SUMMARY */}
              <div className="modal-footer">
                <div style={{ width: "100%" }}>
                  <div className="calc-item">
                    <span>الإجمالي</span>
                    <span>{totalAmount.toFixed(2)} ج.م</span>
                  </div>

                  <input
                    type="number"
                    placeholder="المبلغ المدفوع"
                    value={formData.paid_amount || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paid_amount: +e.target.value,
                      })
                    }
                    className="premium-input"
                  />

                  <div className="calc-item total-highlight">
                    <span>المتبقي</span>
                    <span>
                      {(totalAmount - formData.paid_amount).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                <button className="btn-save w-full">
                  حفظ الفاتورة
                </button>

                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setModalType(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {viewInvoice && (
  <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
    <div
      className="modal-content-premium view-modal"
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* HEADER */}
      <div className="view-header">
        <div className="view-title-box">
          <div className="view-icon-bg">
            <Package size={24} color="#60a5fa" />
          </div>
          <div>
            <h3>{viewInvoice.supplier_name}</h3>
            <span className="tag-season-large">
              {new Date(viewInvoice.purchase_date).toLocaleDateString()}
            </span>
          </div>
        </div>

        <button
          className="close-view-btn"
          onClick={() => setViewInvoice(null)}
        >
          ✕
        </button>
      </div>

      {/* STATS */}
      <div className="view-stats-grid">
        <div className="stat-card-mini">
          <span className="label">الإجمالي</span>
          <span className="value text-primary">
            {viewInvoice.total_amount} ج.م
          </span>
        </div>

        <div className="stat-card-mini">
          <span className="label">المدفوع</span>
          <span className="value text-success">
            {viewInvoice.paid_amount} ج.م
          </span>
        </div>

        <div className="stat-card-mini">
          <span className="label">المتبقي</span>
          <span className="value text-danger">
            {(viewInvoice.total_amount - viewInvoice.paid_amount).toFixed(2)} ج.م
          </span>
        </div>
      </div>

      {/* ITEMS */}
      <div className="variants-preview-section">
        <h4 className="section-subtitle">تفاصيل الأصناف</h4>

        <div className="variants-grid-view">
          {viewInvoice.items?.map((item, idx) => (
            <div key={idx} className="variant-card-modern">
              
              <div className="card-top">
                <span className="v-color">
                  باركود: {item.variant_barcode || "-"}
                </span>
                
                <span className="v-size">
                  الكمية: {item.quantity}
                </span>
              </div>

              <div className="card-bottom">
                <div className="v-stock-box">
                  <span className="v-stock">
                    {item.cost_price}
                  </span>
                  <span className="v-unit">ج.م</span>
                </div>

                <code className="v-barcode">
                  إجمالي: {(item.quantity * item.cost_price).toFixed(2)}
                </code>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div className="modal-footer" style={{ marginTop: 20 }}>
        <button
          className="btn-save"
          onClick={() => {
            setViewInvoice(null);
            openEditModal(viewInvoice);
          }}
        >
          تعديل الفاتورة
        </button>
      </div>

    </div>
  </div>
)}


      {/* DELETE */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content-premium form-modal" style={{ maxWidth: 400 }}>
            <h3>حذف الفاتورة؟</h3>
            <button
              className="btn-save"
              onClick={async () => {
                const db = await getDb();
                await db.execute("DELETE FROM purchase_orders WHERE id=$1", [
                  showDeleteConfirm.id,
                ]);
                setShowDeleteConfirm(null);
                fetchData();
              }}
            >
              نعم احذف
            </button>
            <button
              className="btn-cancel"
              onClick={() => setShowDeleteConfirm(null)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;