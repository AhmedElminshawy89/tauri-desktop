import React, { useState, useRef, useEffect, createPortal } from "react";
import { createPortal as ReactDOMCreatePortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Barcode from "react-barcode";
import JsBarcode from "jsbarcode";
import {
  Printer,
  Package,
  ArrowRight,
  Layout,
  AlertCircle,
  Loader2,
  Search,
  Edit3,
  RefreshCw,
  X,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import { getDb } from "../lib/db";

/* ─────────────────────────────────────────────
   مكون الملصق (للمعاينة البصرية في الشاشة فقط)
───────────────────────────────────────────── */
const ThermalLabel = ({ product, customPrice = null }) => {
  const displayPrice =
    customPrice !== null && !isNaN(customPrice)
      ? customPrice
      : product.sale_price;

  return (
    <div
      style={{
        width: "50mm",
        height: "30mm",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        boxSizing: "border-box",
        background: "white",
        fontFamily: "Arial, sans-serif",
        padding: "1mm",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "7pt",
          fontWeight: "900",
          borderBottom: "0.3mm solid black",
          width: "95%",
          paddingBottom: "0.5mm",
          letterSpacing: "1px",
          color: "#000",
        }}
      >
        CODING CASHIER
      </div>
      <div
        style={{
          fontSize: "9pt",
          fontWeight: "bold",
          margin: "0.5mm 0",
          lineHeight: 0.9,
          color: "#000",
        }}
      >
        {product.name}
      </div>
      <div style={{ fontSize: "6.5pt", color: "#000", margin: "0mm 0" }}>
        {product.size}
        {product.color ? ` | ${product.color}` : ""}
      </div>
      <Barcode
        value={product.barcode}
        width={1.4}
        height={48}
        fontSize={10}
        margin={2}
        displayValue={true}
        format="CODE128"
        background="#ffffff"
        lineColor="#000000"
      />
      <div
        style={{
          fontSize: "10pt",
          color: "#000",
          fontWeight: "900",
          borderTop: "0.3mm dashed black",
          width: "95%",
          paddingTop: "0.5mm",
          marginTop: "0.3mm",
        }}
      >
        {displayPrice} EGP
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   توليد SVG باركود بـ JsBarcode (للطباعة)
───────────────────────────────────────────── */
const makeSvg = (barcode) => {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, barcode, {
      format: "CODE128",
      width: 2.5,
      height: 65,
      displayValue: true,
      fontSize: 12,
      margin: 2,
      background: "#ffffff",
      lineColor: "#000000",
      textAlign: "center",
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
};

/* ─────────────────────────────────────────────
   Portal للملصقات خارج React root تماماً
───────────────────────────────────────────── */
const PrintPortal = ({ product, copies, customPrice }) => {
  const el = useRef(document.createElement("div"));

  useEffect(() => {
    el.current.id = "print-labels-container";
    document.body.appendChild(el.current);
    return () => {
      if (document.body.contains(el.current)) {
        document.body.removeChild(el.current);
      }
    };
  }, []);

  if (!product) return null;

  const displayPrice =
    customPrice && !isNaN(parseFloat(customPrice))
      ? parseFloat(customPrice).toFixed(2)
      : product.sale_price;

  const labels = Array.from({ length: copies }).map((_, i) => {
    const svgString = makeSvg(product.barcode);
    return (
      <div key={i} className="print-label-unit">
        <div className="lab-header">CODING CASHIER</div>
        <div className="lab-name">{product.name}</div>
        <div className="lab-meta">
          {product.size}
          {product.color ? ` - ${product.color}` : ""}
        </div>
        <div
          className="lab-barcode"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
        <div className="lab-price">{displayPrice} EGP</div>
      </div>
    );
  });

  return ReactDOMCreatePortal(labels, el.current);
};

/* ═══════════════════════════════════════════
   الصفحة الرئيسية
═══════════════════════════════════════════ */
const BarcodePrintPage = ({ showToast }) => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customPrice, setCustomPrice] = useState("");
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [recentProducts, setRecentProducts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const searchRef = useRef();
  const dropdownRef = useRef();

  /* ── تحميل المنتجات الحديثة من localStorage ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("recent_barcodes");
      if (saved) setRecentProducts(JSON.parse(saved));
    } catch {}
  }, []);

  /* ── قراءة البيانات المُمرَّرة من صفحة المنتجات ── */
  useEffect(() => {
    try {
      const payload = localStorage.getItem("barcode_print_payload");
      if (payload) {
        const { product, copies: payloadCopies } = JSON.parse(payload);
        if (product && product.barcode) {
          setSelectedProduct(product);
          setCustomPrice(product.sale_price.toString());
          setCopies(payloadCopies || 1);
          // أضفه للحديثة
          setRecentProducts((prev) => {
            const updated = [
              product,
              ...prev.filter((p) => p.barcode !== product.barcode),
            ].slice(0, 10);
            localStorage.setItem("recent_barcodes", JSON.stringify(updated));
            return updated;
          });
          setAutoLoaded(true);
          localStorage.removeItem("barcode_print_payload");
          showToast(`تم تحميل: ${product.name}`, "success");
        }
      }
    } catch {}
  }, []);

  const addToRecent = (product) => {
    setRecentProducts((prev) => {
      const updated = [
        product,
        ...prev.filter((p) => p.barcode !== product.barcode),
      ].slice(0, 10);
      localStorage.setItem("recent_barcodes", JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecent = (barcode) => {
    setRecentProducts((prev) => {
      const updated = prev.filter((p) => p.barcode !== barcode);
      localStorage.setItem("recent_barcodes", JSON.stringify(updated));
      return updated;
    });
  };

  /* ── بحث ── */
  const handleSearch = async () => {
    const query = searchTerm.trim();
    if (!query) return;
    try {
      const db = await getDb();
      const results = await db.select(
        `SELECT p.id AS product_id, p.name, p.sale_price AS base_price,
                v.id AS variant_id, v.size, v.color, v.variant_barcode AS barcode
         FROM product_variants v
         JOIN products p ON v.product_id = p.id
         WHERE v.variant_barcode = $1 OR p.barcode = $1 OR p.name LIKE $2
         LIMIT 10`,
        [query, `%${query}%`]
      );
      if (results?.length > 0) {
        const fmt = (r) => ({
          id: r.variant_id || r.product_id,
          name: r.name,
          size: r.size || "",
          color: r.color || "",
          barcode: r.barcode,
          sale_price: r.base_price,
        });
        if (results.length === 1) {
          const p = fmt(results[0]);
          setSelectedProduct(p);
          setCustomPrice(p.sale_price.toString());
          addToRecent(p);
          setSearchResults([]);
          setSearchTerm("");
          showToast("تم جلب المنتج", "success");
        } else {
          setSearchResults(results.map(fmt));
          setShowDropdown(true);
        }
      } else {
        showToast("المنتج غير موجود", "error");
        setSelectedProduct(null);
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
      showToast("خطأ في قاعدة البيانات", "error");
    }
  };

  const selectProduct = (p) => {
    setSelectedProduct(p);
    setCustomPrice(p.sale_price.toString());
    addToRecent(p);
    setSearchResults([]);
    setSearchTerm("");
    setShowDropdown(false);
    showToast(`تم اختيار: ${p.name}`, "success");
  };

  useEffect(() => {
    const close = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        searchRef.current &&
        !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ── الطباعة ── */
  const handlePrint = async () => {
    if (!selectedProduct || isPrinting) return;
    setIsPrinting(true);
    try {
      await new Promise((r) => setTimeout(r, 150));
      window.print();
      showToast(`✅ تم إرسال ${copies} ملصق للطابعة`, "success");
    } catch (err) {
      showToast(`❌ خطأ: ${err.message}`, "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const previewPrice =
    customPrice && !isNaN(parseFloat(customPrice))
      ? parseFloat(customPrice)
      : selectedProduct?.sale_price;

  /* ══════════════ JSX ══════════════ */
  return (
    <div className="page-container animate-fade-in" dir="rtl">
      <style>{`
        @media print {
          @page { size: 50mm 30mm; margin: 0; }
          body * { visibility: hidden !important; }
          #print-labels-container,
          #print-labels-container * { visibility: visible !important; }
          #print-labels-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 50mm !important;
          }
          .print-label-unit {
            width: 50mm !important; height: 30mm !important;
            display: flex !important; flex-direction: column !important;
            align-items: center !important; justify-content: center !important;
            text-align: center !important; box-sizing: border-box !important;
            background: white !important; font-family: Arial, sans-serif !important;
            padding: 1mm !important; overflow: hidden !important;
            page-break-after: always !important;
          }
          .lab-header { font-size: 7pt !important; font-weight: 900 !important; border-bottom: 0.3mm solid black !important; width: 95% !important; padding-bottom: 0.5mm !important; letter-spacing: 1px !important; }
          .lab-name   { font-size: 9pt !important; font-weight: bold !important; margin: 0.5mm 0 !important; line-height: 1.2 !important; }
          .lab-meta   { font-size: 6.5pt !important; color: #444 !important; margin-bottom: 0.3mm !important; }
          .lab-barcode svg { max-width: 48mm !important; height: auto !important; display: block !important; margin: 0 auto !important; }
          .lab-price  { font-size: 10pt !important; font-weight: 900 !important; border-top: 0.3mm dashed black !important; width: 95% !important; padding-top: 0.5mm !important; margin-top: 0.3mm !important; }
        }

        #print-labels-container { display: none; }
        @media print { #print-labels-container { display: block !important; } }

        .page-container { padding: 24px; background: transparent; min-height: 100vh; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
        .page-header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 20px 28px; background: rgba(30,41,59,0.3); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(8px); }
        .main-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
        .sub-title  { color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0; }
        .premium-control-bar { background: rgba(15,23,42,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 18px 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
        .search-neon-wrapper { position: relative; }
        .search-neon-input { background: #0b0f19; border: 1px solid #1e293b; border-radius: 12px; padding: 11px 16px; width: 280px; color: #f1f5f9; font-size: 13.5px; transition: all .25s ease; }
        .search-neon-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); outline: none; }
        .btn-neon { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s ease; border: none; }
        .btn-blue { background: #2563eb; color: #fff; }
        .btn-blue:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,.3); }
        .btn-blue:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .cyber-card { background: rgba(15,23,42,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,.3); }
        .icon-btn { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.05); transition: all .2s; color: #94a3b8; }
        .icon-btn:hover { background: rgba(59,130,246,.12); border-color: rgba(59,130,246,.3); color: #60a5fa; }

        /* Auto-loaded banner */
        .auto-load-banner {
          display: flex; align-items: center; gap: 10px;
          background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.3);
          border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;
          color: #a78bfa; font-size: 13px;
        }

        .animate-fade-in { animation: fadeIn .3s ease; }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes pulse  { 0%,100% { opacity:1 } 50% { opacity:0.6 } }
      `}</style>

      {/* Portal للطباعة */}
      <PrintPortal product={selectedProduct} copies={copies} customPrice={customPrice} />

      {/* Header */}
      <div className="page-header-container">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            className="icon-btn"
            style={{ width: 40, height: 40 }}
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h2 className="main-title">
              باركود برو{" "}
              <span
                style={{
                  background: "#3b82f6",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  marginRight: 8,
                }}
              >
                طباعة حرارية احترافية
              </span>
            </h2>
            <p className="sub-title">
              ابحث بالباركود أو الاسم، عدل السعر، واطبع ملصقات جاهزة
            </p>
          </div>
        </div>

        {/* بحث */}
        <div ref={searchRef} style={{ position: "relative", width: 450 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="امسح باركود، اكتب اسم المنتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="search-neon-input"
              style={{ flex: 1 }}
              autoFocus={!autoLoaded}
            />
            <button onClick={handleSearch} className="btn-neon btn-blue">
              <Search size={16} /> بحث
            </button>
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="cyber-card"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 8,
                zIndex: 100,
              }}
            >
              {searchResults.map((p, i) => (
                <div
                  key={i}
                  onClick={() => selectProduct(p)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(255,255,255,.05)",
                  }}
                >
                  <div>
                    <strong>{p.name}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {p.size} {p.color}
                    </span>
                  </div>
                  <span style={{ color: "#4ade80", fontWeight: "bold" }}>
                    {p.sale_price} ج.م
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Auto-load banner */}
      {autoLoaded && selectedProduct && (
        <div className="auto-load-banner">
          <Printer size={16} />
          <span>
            تم تحميل <strong>{selectedProduct.name}</strong> — {selectedProduct.size} / {selectedProduct.color} — {copies} نسخة جاهزة للطباعة
          </span>
          <button
            onClick={() => setAutoLoaded(false)}
            style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", marginRight: "auto" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* منتجات حديثة */}
      {recentProducts.length > 0 && (
        <div
          className="premium-control-bar"
          style={{
            padding: "12px 20px",
            justifyContent: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#64748b", fontSize: 13 }}>🕒 حديثة:</span>
          {recentProducts.map((p) => (
            <div
              key={p.barcode}
              onClick={() => selectProduct(p)}
              style={{
                background: selectedProduct?.barcode === p.barcode
                  ? "rgba(124,58,237,0.2)"
                  : "rgba(255,255,255,.05)",
                border: selectedProduct?.barcode === p.barcode
                  ? "1px solid rgba(124,58,237,0.5)"
                  : "1px solid transparent",
                borderRadius: 40,
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <span>{p.name}</span>
              <span style={{ fontSize: 11, color: "#4ade80" }}>{p.sale_price}ج</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeRecent(p.barcode);
                }}
                style={{
                  background: "none", border: "none",
                  color: "#f87171", cursor: "pointer", padding: 0, display: "flex",
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* بيانات المنتج */}
        <div className="cyber-card" style={{ padding: 24 }}>
          <div
            style={{
              color: "#64748b", marginBottom: 20, display: "flex",
              gap: 10, fontSize: 13, textTransform: "uppercase", letterSpacing: 1,
            }}
          >
            <Package size={18} /> بيانات الصنف
          </div>

          {selectedProduct ? (
            <>
              <div style={{ marginBottom: 20 }}>
                {[
                  { label: "الاسم", value: selectedProduct.name },
                  { label: "المقاس", value: selectedProduct.size || "—" },
                  { label: "اللون", value: selectedProduct.color || "—" },
                  { label: "الباركود", value: selectedProduct.barcode },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      borderBottom: "1px solid rgba(255,255,255,.06)",
                      padding: "12px 0", fontSize: 15,
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>{label}:</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              {/* السعر */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block", marginBottom: 8,
                    color: "#94a3b8", fontSize: 14,
                  }}
                >
                  <Edit3 size={14} style={{ display: "inline", marginLeft: 5 }} />
                  السعر على الملصق
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="search-neon-input"
                    style={{ width: 180, textAlign: "center", fontSize: 18 }}
                  />
                  <span style={{ color: "#64748b" }}>ج.م</span>
                  <button
                    onClick={() => setCustomPrice(selectedProduct.sale_price.toString())}
                    className="icon-btn"
                    style={{ padding: "0 12px", width: "auto" }}
                  >
                    <RefreshCw size={14} /> إعادة
                  </button>
                </div>
              </div>

              {/* عدد النسخ */}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: "block", marginBottom: 8,
                    color: "#94a3b8", fontSize: 14,
                  }}
                >
                  عدد الملصقات:
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="icon-btn"
                  >
                    <MinusCircle size={18} />
                  </button>
                  <input
                    type="number" min="1" max="100"
                    value={copies}
                    onChange={(e) =>
                      setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
                    }
                    className="search-neon-input"
                    style={{ width: 100, textAlign: "center", fontSize: 22, padding: 8 }}
                  />
                  <button
                    onClick={() => setCopies(Math.min(100, copies + 1))}
                    className="icon-btn"
                  >
                    <PlusCircle size={18} />
                  </button>
                </div>
              </div>

              {/* زر الطباعة */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="btn-neon btn-blue"
                style={{
                  width: "100%", padding: 16,
                  fontSize: 18, justifyContent: "center",
                }}
              >
                {isPrinting ? (
                  <>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                    جاري الطباعة...
                  </>
                ) : (
                  <>
                    <Printer size={20} /> طباعة {copies} نسخة
                  </>
                )}
              </button>

              <div
                style={{
                  marginTop: 20, fontSize: 12,
                  color: "#475569", textAlign: "center",
                }}
              >
                <AlertCircle size={14} style={{ verticalAlign: "middle", marginLeft: 5 }} />
                تأكد من اختيار الطابعة الحرارية (50×30mm) في إعدادات الطباعة.
              </div>
            </>
          ) : (
            <div
              style={{
                textAlign: "center", padding: "60px 20px", color: "#64748b",
              }}
            >
              <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <p>ابحث عن منتج لبدء الطباعة</p>
            </div>
          )}
        </div>

        {/* معاينة الملصق */}
        <div className="cyber-card" style={{ padding: 24 }}>
          <div
            style={{
              color: "#64748b", marginBottom: 20, display: "flex",
              gap: 10, fontSize: 13, textTransform: "uppercase", letterSpacing: 1,
            }}
          >
            <Layout size={18} /> معاينة الملصق (50×30mm)
          </div>
          <div
            style={{
              background: "#0b0f19", borderRadius: 16, height: 350,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 20,
            }}
          >
            {selectedProduct ? (
              <>
                <div
                  style={{
                    transform: "scale(2.5)",
                    transformOrigin: "center",
                    pointerEvents: "none",
                  }}
                >
                  <ThermalLabel product={selectedProduct} customPrice={previewPrice} />
                </div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 70 }}>
                  ⚡ المعاينة مكبرة 2.5x – الحجم الفعلي 50×30 مم
                </div>
              </>
            ) : (
              <div style={{ color: "#334155", textAlign: "center" }}>
                <Layout size={60} opacity={0.3} />
                <p style={{ marginTop: 15 }}>اختر منتجاً لمعاينة الملصق</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodePrintPage;