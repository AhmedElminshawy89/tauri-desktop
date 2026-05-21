import Database from "@tauri-apps/plugin-sql";

export const getDb = async () => {
  try {
    const db = await Database.load("sqlite:accounts_v2.db");

    /* ═══════════════════════════════════════════════
       هيكل الجداول الكامل
    ═══════════════════════════════════════════════ */
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
      );`,

      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`,

      `CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        target_id INTEGER,
        discount_type TEXT,
        discount_value REAL,
        min_quantity INTEGER DEFAULT 1,
        free_quantity INTEGER DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        category TEXT,
        cost_price REAL,
        sale_price REAL,
        season TEXT,
        stock INTEGER DEFAULT 0
      );`,

      `CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        color TEXT,
        size TEXT,
        stock INTEGER DEFAULT 0,
        variant_barcode TEXT UNIQUE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        address TEXT,
        points INTEGER DEFAULT 0
      );`,

      `CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE,
        customer_id INTEGER,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        total_before_discount REAL,
        discount_value REAL,
        discount_type TEXT,
        total_after_discount REAL,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        installments_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'completed',
        seller_id INTEGER,
        seller_name TEXT,
        commission_amount REAL DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (seller_id) REFERENCES employees(id)
      );`,

      `CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        product_id INTEGER,
        variant_id INTEGER,
        product_name TEXT,
        quantity INTEGER,
        unit_price REAL,
        total_price REAL,
        cost_price_at_sale REAL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
      );`,

      `CREATE TABLE IF NOT EXISTS installment_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        customer_id INTEGER,
        due_date DATE,
        amount_due REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        payment_date TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );`,

      `CREATE TABLE IF NOT EXISTS installment_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        customer_id INTEGER,
        amount_paid REAL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method TEXT DEFAULT 'cash',
        transaction_type TEXT DEFAULT 'installment',
        note TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );`,

      `CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        product_id INTEGER,
        variant_id INTEGER,
        quantity INTEGER,
        amount REAL,
        return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
      );`,

      `CREATE TABLE IF NOT EXISTS deleted_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        invoice_number TEXT,
        customer_name TEXT,
        total_amount REAL,
        reason TEXT,
        items_json TEXT,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        cashier INTEGER DEFAULT 1,
        edit_bill INTEGER DEFAULT 0,
        delete_bill INTEGER DEFAULT 0,
        returns INTEGER DEFAULT 1,
        on_hold INTEGER DEFAULT 1,
        products INTEGER DEFAULT 0,
        inventory INTEGER DEFAULT 0,
        barcode INTEGER DEFAULT 1,
        suppliers INTEGER DEFAULT 0,
        safe INTEGER DEFAULT 0,
        installments INTEGER DEFAULT 0,
        expenses INTEGER DEFAULT 0,
        reports INTEGER DEFAULT 0,
        accounts INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        amount REAL NOT NULL,
        note TEXT,
        expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id)
      );`,

      `CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT,
        phone TEXT,
        salary REAL,
        commission_rate REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        last_sale_date DATE,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        date DATE NOT NULL,
        check_in TEXT,
        check_out TEXT,
        status TEXT DEFAULT 'present',
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS employee_sales_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        month INTEGER,
        year INTEGER,
        total_sales REAL DEFAULT 0,
        invoice_count INTEGER DEFAULT 0,
        total_commission REAL DEFAULT 0,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, month, year)
      );`,

      `CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        balance REAL DEFAULT 0
      );`,

      /* ─── جدول فواتير المشتريات ─── */
      `CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        purchase_date DATE NOT NULL,
        status TEXT DEFAULT 'completed',
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );`,

      /* ─── تفاصيل المشتريات — يشمل variant_id ─── */
      `CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER,
        product_id INTEGER,
        variant_id INTEGER,
        quantity INTEGER NOT NULL,
        cost_price REAL NOT NULL,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
      );`,

      /* ─── دفعات الموردين — نظام الدفعات والأقساط ─── */
      `CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        note TEXT,
        is_installment INTEGER DEFAULT 0,
        installment_number INTEGER,
        due_date DATE,
        paid_at TIMESTAMP,
        status TEXT DEFAULT 'paid',
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );`,
    ];

    /* ─── تنفيذ إنشاء الجداول ─── */
    for (const sql of tables) {
      if (sql && sql.trim()) {
        try { await db.execute(sql); }
        catch (e) { console.error("Table creation error:", e); }
      }
    }

    /* ═══════════════════════════════════════════════
       إضافة الأعمدة المفقودة (للقواعد القديمة)
    ═══════════════════════════════════════════════ */

    // دالة مساعدة لإضافة عمود إن لم يكن موجوداً
    const addColIfMissing = async (table, col, def) => {
      try {
        const cols = await db.select(`PRAGMA table_info(${table})`);
        if (!cols.some(c => c.name === col)) {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
          console.log(`✅ أُضيف عمود ${col} إلى ${table}`);
        }
      } catch (e) { console.log(`addCol ${table}.${col}:`, e.message); }
    };

    // invoice_items
    await addColIfMissing("invoice_items",  "cost_price_at_sale", "REAL");
    await addColIfMissing("invoice_items",  "variant_id",         "INTEGER");

    // invoices
    await addColIfMissing("invoices", "seller_id",        "INTEGER");
    await addColIfMissing("invoices", "seller_name",      "TEXT");
    await addColIfMissing("invoices", "commission_amount","REAL DEFAULT 0");

    // employees
    await addColIfMissing("employees", "commission_rate", "REAL DEFAULT 0");
    await addColIfMissing("employees", "total_sales",     "REAL DEFAULT 0");
    await addColIfMissing("employees", "last_sale_date",  "DATE");

    // installment_plan
    await addColIfMissing("installment_plan", "amount_due",    "REAL DEFAULT 0");
    await addColIfMissing("installment_plan", "status",        "TEXT DEFAULT 'pending'");
    await addColIfMissing("installment_plan", "payment_date",  "TIMESTAMP");

    // purchase_items — أهم عمود للربط الصحيح بالمنتجات
    await addColIfMissing("purchase_items", "variant_id", "INTEGER");

    // supplier_payments — أعمدة نظام الأقساط
    await addColIfMissing("supplier_payments", "is_installment",     "INTEGER DEFAULT 0");
    await addColIfMissing("supplier_payments", "installment_number", "INTEGER");
    await addColIfMissing("supplier_payments", "due_date",           "DATE");
    await addColIfMissing("supplier_payments", "paid_at",            "TIMESTAMP");
    await addColIfMissing("supplier_payments", "status",             "TEXT DEFAULT 'paid'");

    /* ═══════════════════════════════════════════════
       بيانات افتراضية
    ═══════════════════════════════════════════════ */
    await db.execute(`
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('shop_name', 'كودينج كورنر ستور'),
        ('last_backup', 'لم يتم النسخ بعد')
    `);

    const empCount = await db.select(
      "SELECT COUNT(*) as count FROM employees WHERE is_active = 1"
    );
    if (empCount[0]?.count === 0) {
      await db.execute(`
        INSERT OR IGNORE INTO employees (name, position, commission_rate, is_active)
        VALUES ('مدير النظام', 'مدير', 5, 1)
      `);
    }

    return db;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
};