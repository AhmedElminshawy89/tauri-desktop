import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Barcode from "react-barcode";
import ReactDOMServer from "react-dom/server";
import { Printer, Hash, Package, ArrowRight, Layout, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { getDb } from "../lib/db";

// ✅ مكوّن الملصق الحراري - مستقل ويُستخدم في المعاينة والطباعة
const ThermalLabel = ({ product }) => (
  <div style={{
    width: "50mm", height: "30mm", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", textAlign: "center",
    boxSizing: "border-box", background: "white", fontFamily: "Arial, sans-serif",
    padding: "1mm", overflow: "hidden"
  }}>
    <div style={{ fontSize: "7pt", fontWeight: "900", borderBottom: "0.3mm solid black", width: "95%", paddingBottom: "0.5mm", letterSpacing: "1px" }}>
      CODING CASHIER
    </div>
    <div style={{ fontSize: "9pt", fontWeight: "bold", margin: "0.5mm 0", lineHeight: 1.2 }}>
      {product.name}
    </div>
    <div style={{ fontSize: "6.5pt", color: "#333", margin: "0.3mm 0" }}>
      {product.size} {product.color ? `| ${product.color}` : ""}
    </div>
    <Barcode
      value={product.barcode}
      width={1.1}
      height={42}
      fontSize={9}
      margin={0}
      displayValue={true}
    />
    <div style={{
      fontSize: "10pt", fontWeight: "900", borderTop: "0.3mm dashed black",
      width: "95%", paddingTop: "0.5mm", marginTop: "0.3mm"
    }}>
      {product.sale_price} EGP
    </div>
  </div>
);

const BarcodePrintPage = ({ showToast }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleSearch = async () => {
    const query = searchTerm.trim();
    if (!query) return;

    try {
      const db = await getDb();
      const result = await db.select(
        `SELECT p.name, p.sale_price, v.size, v.color, v.variant_barcode as barcode
         FROM product_variants v
         JOIN products p ON v.product_id = p.id
         WHERE v.variant_barcode = $1 OR p.barcode = $1 LIMIT 1`,
        [query]
      );

      if (result && result.length > 0) {
        setSelectedProduct(result[0]);
        setSearchTerm("");
        showToast("تم جلب بيانات المنتج", "success");
      } else {
        showToast("المنتج غير موجود بالمخزن", "error");
        setSelectedProduct(null);
      }
    } catch (error) {
      console.error(error);
      showToast("خطأ في قاعدة البيانات", "error");
    }
  };

  // ✅ الحل الصحيح: بناء HTML كامل مع SVG حقيقي من react-barcode
  const handlePrint = async () => {
    if (!selectedProduct || isPrinting) return;
    setIsPrinting(true);

    try {
      // ✅ نولّد SVG الباركود عبر ReactDOMServer بدل innerHTML
      const labelsHtml = Array.from({ length: copies }).map(() => {
        const svgString = ReactDOMServer.renderToStaticMarkup(
          <Barcode
            value={selectedProduct.barcode}
            width={2}
            height={55}
            fontSize={11}
            margin={0}
            displayValue={true}
          />
        );

        return `
          <div class="thermal-label-unit">
            <div class="lab-header">CODING CASHIER</div>
            <div class="lab-name">${selectedProduct.name}</div>
            <div class="lab-meta">${selectedProduct.size}${selectedProduct.color ? " - " + selectedProduct.color : ""}</div>
            <div class="lab-barcode">${svgString}</div>
            <div class="lab-price">${selectedProduct.sale_price} EGP</div>
          </div>
        `;
      }).join("");

      // ✅ HTML كامل ومكتمل مع CSS مدمج
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: 50mm 30mm;
      margin: 0;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background: white;
    }

    .thermal-label-unit {
      width: 50mm;
      height: 30mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      page-break-after: always;
      overflow: hidden;
      padding: 1mm;
    }

    .lab-header {
      font-size: 7pt;
      font-weight: 900;
      letter-spacing: 1px;
      border-bottom: 0.3mm solid black;
      width: 95%;
      padding-bottom: 0.5mm;
    }

    .lab-name {
      font-size: 9pt;
      font-weight: bold;
      margin: 0.5mm 0;
      line-height: 1.2;
    }

    .lab-meta {
      font-size: 6.5pt;
      color: #444;
      margin-bottom: 0.3mm;
    }

    .lab-barcode svg {
      max-width: 48mm;
      height: auto;
    }

    .lab-price {
      font-size: 10pt;
      font-weight: 900;
      border-top: 0.3mm dashed black;
      width: 95%;
      padding-top: 0.5mm;
      margin-top: 0.3mm;
    }
  </style>
</head>
<body>
  ${labelsHtml}
</body>
</html>`;

      await invoke("silent_print", { html: fullHtml });
      showToast(`✅ تم إرسال ${copies} ملصق للطابعة بنجاح`, "success");
    } catch (error) {
      console.error("Print Error:", error);
      showToast(`❌ خطأ في الطباعة: ${error}`, "error");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div dir="rtl" style={{
      background: "#080a10",
      minHeight: "100vh",
      color: "white",
      padding: "30px",
      fontFamily: "'Tajawal', 'Cairo', sans-serif"
    }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: "45px", height: "45px", borderRadius: "50%",
              background: "#161b2c", border: "1px solid #2d364f",
              color: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center"
            }}
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "800" }}>
              Coding Cashier <span style={{ background: "#3b82f6", padding: "2px 10px", borderRadius: "20px", fontSize: "12px" }}>v2.0</span>
            </h1>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>استوديو طباعة الباركود الحراري</p>
          </div>
        </div>

        {/* Search */}
        <div style={{
          background: "#161b2c", border: "1px solid #2d364f",
          padding: "6px 15px", borderRadius: "50px",
          display: "flex", alignItems: "center", width: "420px", gap: "10px"
        }}>
          <Hash size={18} style={{ color: "#64748b", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="امسح أو اكتب الباركود هنا..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "white", padding: "10px", outline: "none", fontSize: "14px"
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              background: "#3b82f6", border: "none", color: "white",
              padding: "8px 18px", borderRadius: "50px", cursor: "pointer",
              fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap"
            }}
          >
            بحث
          </button>
        </div>
      </header>

      {/* Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "30px", maxWidth: "1200px", margin: "0 auto"
      }}>
        {/* Left Card - Product Info */}
        <div style={{
          background: "rgba(22, 27, 44, 0.6)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: "24px",
          padding: "30px", minHeight: "400px"
        }}>
          <div style={{ color: "#64748b", marginBottom: "25px", display: "flex", gap: "10px", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px" }}>
            <Package size={18} /> بيانات الصنف
          </div>

          {selectedProduct ? (
            <div>
              {[
                { label: "الاسم", value: selectedProduct.name },
                { label: "المقاس", value: selectedProduct.size || "—" },
                { label: "اللون", value: selectedProduct.color || "—" },
                { label: "الباركود", value: selectedProduct.barcode },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  padding: "12px 0", fontSize: "16px"
                }}>
                  <span style={{ color: "#94a3b8" }}>{label}:</span>
                  <strong style={{ color: "white" }}>{value}</strong>
                </div>
              ))}

              {/* Price */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                padding: "12px 0"
              }}>
                <span style={{ color: "#94a3b8", fontSize: "16px" }}>السعر:</span>
                <strong style={{ color: "#22c55e", fontSize: "28px" }}>{selectedProduct.sale_price} ج.م</strong>
              </div>

              {/* Copies Input */}
              <div style={{ margin: "25px 0" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#94a3b8", fontSize: "14px" }}>
                  عدد الملصقات:
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  style={{
                    background: "#080a10", border: "1px solid #2d364f",
                    color: "white", padding: "14px", width: "100%",
                    borderRadius: "12px", fontSize: "22px",
                    textAlign: "center", outline: "none"
                  }}
                />
              </div>

              {/* Print Button */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                style={{
                  width: "100%", padding: "20px", borderRadius: "18px",
                  border: "none", background: isPrinting ? "#1e3a6e" : "#3b82f6",
                  color: "white", fontWeight: "bold", fontSize: "18px",
                  cursor: isPrinting ? "not-allowed" : "pointer",
                  boxShadow: isPrinting ? "none" : "0 10px 30px rgba(59, 130, 246, 0.35)",
                  transition: "all 0.3s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px"
                }}
              >
                {isPrinting ? (
                  <><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> جاري الطباعة...</>
                ) : (
                  <><Printer size={20} /> طباعة {copies} نسخة الآن</>
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "15px", color: "#334155" }}>
              <AlertCircle size={50} />
              <p style={{ fontSize: "16px" }}>امسح باركود المنتج للبدء</p>
            </div>
          )}
        </div>

        {/* Right Card - Preview */}
        <div style={{
          background: "rgba(22, 27, 44, 0.6)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: "24px",
          padding: "30px", minHeight: "400px"
        }}>
          <div style={{ color: "#64748b", marginBottom: "25px", display: "flex", gap: "10px", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px" }}>
            <Layout size={18} /> معاينة الملصق الحراري (50×30mm)
          </div>

          <div style={{
            background: "#080a10", borderRadius: "20px",
            height: "320px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "15px"
          }}>
            {selectedProduct ? (
              <>
                {/* معاينة واقعية للملصق */}
                <div style={{
                  boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                  borderRadius: "3px",
                  transform: "scale(2.5)",
                  transformOrigin: "center"
                }}>
                  <ThermalLabel product={selectedProduct} />
                </div>
                <div style={{ color: "#334155", fontSize: "12px", marginTop: "60px" }}>
                  المعاينة بالحجم الحقيقي × 2.5
                </div>
              </>
            ) : (
              <div style={{ color: "#334155", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <Layout size={50} opacity={0.3} />
                <p>المعاينة ستظهر هنا</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>
    </div>
  );
};

export default BarcodePrintPage;