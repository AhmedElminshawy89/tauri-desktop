import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Barcode from "react-barcode";
import ReactDOMServer from "react-dom/server";
import { 
  Printer, Hash, Package, ArrowRight, Layout, AlertCircle, 
  Loader2, Search, Edit3, RefreshCw, X, PlusCircle, MinusCircle 
} from "lucide-react";
import { getDb } from "../lib/db";

const ThermalLabel = ({ product, customPrice = null }) => {
  const displayPrice = (customPrice !== null && !isNaN(customPrice)) 
    ? customPrice 
    : product.sale_price;
    
  return (
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
        {displayPrice} EGP
      </div>
    </div>
  );
};

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
  const searchRef = useRef();
  const dropdownRef = useRef();

  useEffect(() => {
    const saved = localStorage.getItem("recent_barcodes");
    if (saved) {
      try {
        setRecentProducts(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  const addToRecent = (product) => {
    const updated = [product, ...recentProducts.filter(p => p.barcode !== product.barcode)].slice(0, 10);
    setRecentProducts(updated);
    localStorage.setItem("recent_barcodes", JSON.stringify(updated));
  };

  const removeRecent = (barcode) => {
    const updated = recentProducts.filter(p => p.barcode !== barcode);
    setRecentProducts(updated);
    localStorage.setItem("recent_barcodes", JSON.stringify(updated));
  };

  const handleSearch = async () => {
    const query = searchTerm.trim();
    if (!query) return;

    try {
      const db = await getDb();
      const results = await db.select(
        `SELECT 
          p.id as product_id, p.name, p.sale_price as base_price,
          v.id as variant_id, v.size, v.color, v.variant_barcode as barcode
         FROM product_variants v
         JOIN products p ON v.product_id = p.id
         WHERE v.variant_barcode = $1 OR p.barcode = $1 OR p.name LIKE $2
         LIMIT 10`,
        [query, `%${query}%`]
      );

      if (results && results.length > 0) {
        if (results.length === 1 && (results[0].barcode === query || results[0].product_id)) {
          const product = {
            id: results[0].variant_id || results[0].product_id,
            name: results[0].name,
            size: results[0].size || "",
            color: results[0].color || "",
            barcode: results[0].barcode,
            sale_price: results[0].base_price
          };
          setSelectedProduct(product);
          setCustomPrice(product.sale_price.toString());
          addToRecent(product);
          setSearchResults([]);
          setSearchTerm("");
          showToast("تم جلب المنتج", "success");
        } else {
          const formatted = results.map(r => ({
            id: r.variant_id || r.product_id,
            name: r.name,
            size: r.size || "",
            color: r.color || "",
            barcode: r.barcode,
            sale_price: r.base_price
          }));
          setSearchResults(formatted);
          setShowDropdown(true);
        }
      } else {
        showToast("المنتج غير موجود", "error");
        setSelectedProduct(null);
        setSearchResults([]);
      }
    } catch (error) {
      console.error(error);
      showToast("خطأ في قاعدة البيانات", "error");
    }
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setCustomPrice(product.sale_price.toString());
    addToRecent(product);
    setSearchResults([]);
    setSearchTerm("");
    setShowDropdown(false);
    showToast(`تم اختيار: ${product.name}`, "success");
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && 
          searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const generatePrintHtml = useCallback(() => {
    const displayPrice = customPrice && !isNaN(parseFloat(customPrice)) 
      ? parseFloat(customPrice).toFixed(2) 
      : selectedProduct.sale_price;

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
          <div class="lab-price">${displayPrice} EGP</div>
        </div>
      `;
    }).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 50mm 30mm; margin: 0; }
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: white; }
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
    .lab-header { font-size: 7pt; font-weight: 900; letter-spacing: 1px; border-bottom: 0.3mm solid black; width: 95%; padding-bottom: 0.5mm; }
    .lab-name { font-size: 9pt; font-weight: bold; margin: 0.5mm 0; line-height: 1.2; }
    .lab-meta { font-size: 6.5pt; color: #444; margin-bottom: 0.3mm; }
    .lab-barcode svg { max-width: 48mm; height: auto; }
    .lab-price { font-size: 10pt; font-weight: 900; border-top: 0.3mm dashed black; width: 95%; padding-top: 0.5mm; margin-top: 0.3mm; }
  </style>
</head>
<body>
  ${labelsHtml}
</body>
</html>`;
  }, [selectedProduct, copies, customPrice]);

  const handlePrint = async () => {
    if (!selectedProduct || isPrinting) return;
    setIsPrinting(true);
    try {
      const html = generatePrintHtml();
      // فتح نافذة جديدة بدلاً من iframe لضمان ظهور المحتوى
      const printWindow = window.open('', '_blank', 'width=500,height=400');
      if (!printWindow) {
        showToast("الرجاء السماح للنوافذ المنبثقة للطباعة", "error");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      };
      showToast(`✅ تم إرسال ${copies} ملصق للطابعة`, "success");
    } catch (error) {
      console.error(error);
      showToast(`❌ خطأ في الطباعة: ${error}`, "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const previewPrice = customPrice && !isNaN(parseFloat(customPrice)) 
    ? parseFloat(customPrice) 
    : selectedProduct?.sale_price;

  return (
    <div dir="rtl" style={{
      background: "#080a10",
      minHeight: "100vh",
      color: "white",
      padding: "30px",
      fontFamily: "'Tajawal', 'Cairo', sans-serif"
    }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", flexWrap: "wrap", gap: "15px" }}>
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
              باركود برو <span style={{ background: "#3b82f6", padding: "2px 10px", borderRadius: "20px", fontSize: "12px" }}>طباعة حرارية</span>
            </h1>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>ابحث بالباركود أو الاسم، عدل السعر، واطبع ملصقات جاهزة</p>
          </div>
        </div>

        <div style={{ position: "relative", width: "450px" }} ref={searchRef}>
          <div style={{
            background: "#161b2c", border: "1px solid #2d364f",
            padding: "6px 15px", borderRadius: "50px",
            display: "flex", alignItems: "center", gap: "10px"
          }}>
            <Hash size={18} style={{ color: "#64748b", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="امسح باركود، اكتب اسم المنتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "white", padding: "10px", outline: "none", fontSize: "14px"
              }}
              autoFocus
            />
            <button
              onClick={handleSearch}
              style={{
                background: "#3b82f6", border: "none", color: "white",
                padding: "8px 18px", borderRadius: "50px", cursor: "pointer",
                fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap"
              }}
            >
              <Search size={16} style={{ verticalAlign: "middle" }} /> بحث
            </button>
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div ref={dropdownRef} style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "#1e2538", borderRadius: "16px", marginTop: "8px",
              border: "1px solid #2d364f", zIndex: 100, maxHeight: "300px",
              overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
              {searchResults.map((p, idx) => (
                <div key={idx} onClick={() => selectProduct(p)} style={{
                  padding: "12px 16px", borderBottom: "1px solid #2d364f",
                  cursor: "pointer", transition: "0.2s", display: "flex",
                  justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{p.name}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>{p.size} {p.color}</div>
                  </div>
                  <div style={{ color: "#22c55e", fontWeight: "bold" }}>{p.sale_price} ج.م</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Recent products */}
      {recentProducts.length > 0 && (
        <div style={{ marginBottom: "25px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#64748b", fontSize: "13px" }}>🕒 حديثة:</span>
          {recentProducts.map(p => (
            <div key={p.barcode} style={{
              background: "#1e2538", borderRadius: "40px", padding: "6px 14px",
              display: "inline-flex", alignItems: "center", gap: "8px",
              border: "1px solid #2d364f", cursor: "pointer"
            }} onClick={() => selectProduct(p)}>
              <span>{p.name}</span>
              <span style={{ fontSize: "11px", color: "#22c55e" }}>{p.sale_price}ج</span>
              <button onClick={(e) => { e.stopPropagation(); removeRecent(p.barcode); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0" }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "30px", maxWidth: "1300px", margin: "0 auto"
      }}>
        {/* Left: Product Info */}
        <div style={{
          background: "rgba(22, 27, 44, 0.6)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: "24px",
          padding: "30px", minHeight: "450px"
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

              <div style={{ marginTop: "15px", marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8", fontSize: "14px" }}>
                  <Edit3 size={14} style={{ display: "inline", marginLeft: "5px" }} /> السعر على الملصق
                </label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    style={{
                      background: "#080a10", border: "1px solid #2d364f",
                      color: "white", padding: "12px", borderRadius: "12px",
                      fontSize: "18px", width: "180px", textAlign: "center"
                    }}
                  />
                  <span style={{ color: "#64748b" }}>ج.م</span>
                  <button onClick={() => setCustomPrice(selectedProduct.sale_price.toString())} style={{
                    background: "#2d364f", border: "none", color: "white",
                    padding: "8px 16px", borderRadius: "30px", cursor: "pointer"
                  }}>
                    <RefreshCw size={14} /> إعادة
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "25px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8", fontSize: "14px" }}>
                  عدد الملصقات:
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button onClick={() => setCopies(Math.max(1, copies - 1))} style={{ background: "#1e2538", border: "none", borderRadius: "30px", padding: "8px 14px", cursor: "pointer", color: "white" }}>
                    <MinusCircle size={18} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    style={{
                      background: "#080a10", border: "1px solid #2d364f",
                      color: "white", padding: "12px", width: "100px",
                      borderRadius: "12px", fontSize: "22px", textAlign: "center"
                    }}
                  />
                  <button onClick={() => setCopies(Math.min(100, copies + 1))} style={{ background: "#1e2538", border: "none", borderRadius: "30px", padding: "8px 14px", cursor: "pointer", color: "white" }}>
                    <PlusCircle size={18} />
                  </button>
                </div>
              </div>

              <button
                onClick={handlePrint}
                disabled={isPrinting}
                style={{
                  width: "100%", padding: "20px", borderRadius: "18px",
                  border: "none", background: isPrinting ? "#1e3a6e" : "#3b82f6",
                  color: "white", fontWeight: "bold", fontSize: "18px",
                  cursor: isPrinting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px"
                }}
              >
                {isPrinting ? (
                  <><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> جاري الطباعة...</>
                ) : (
                  <><Printer size={20} /> طباعة {copies} نسخة</>
                )}
              </button>

              <div style={{ marginTop: "20px", fontSize: "12px", color: "#475569", textAlign: "center" }}>
                <AlertCircle size={14} style={{ verticalAlign: "middle", marginLeft: "5px" }} />
                تأكد من اختيار الطابعة الحرارية (50×30mm) في إعدادات الطباعة.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "350px", gap: "15px", color: "#334155" }}>
              <AlertCircle size={50} />
              <p style={{ fontSize: "16px" }}>ابحث عن منتج لبدء الطباعة</p>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div style={{
          background: "rgba(22, 27, 44, 0.6)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: "24px",
          padding: "30px", minHeight: "450px"
        }}>
          <div style={{ color: "#64748b", marginBottom: "25px", display: "flex", gap: "10px", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px" }}>
            <Layout size={18} /> معاينة الملصق (50×30mm)
          </div>

          <div style={{
            background: "#080a10", borderRadius: "20px",
            height: "350px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "20px"
          }}>
            {selectedProduct ? (
              <>
                <div style={{
                  boxShadow: "0 20px 40px rgba(0,0,0,0.7)",
                  transform: "scale(2.5)",
                  transformOrigin: "center",
                  pointerEvents: "none"
                }}>
                  <ThermalLabel product={selectedProduct} customPrice={previewPrice} />
                </div>
                <div style={{ color: "#64748b", fontSize: "12px", marginTop: "70px" }}>
                  ⚡ المعاينة مكبرة 2.5x – الحجم الفعلي 50×30 مم
                </div>
              </>
            ) : (
              <div style={{ color: "#334155", textAlign: "center", padding: "20px" }}>
                <Layout size={60} opacity={0.3} />
                <p style={{ marginTop: "15px" }}>اختر منتجاً لمعاينة الملصق</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
      `}</style>
    </div>
  );
};

export default BarcodePrintPage;