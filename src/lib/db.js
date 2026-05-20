import Database from "@tauri-apps/plugin-sql";

export const getDb = async () => {
  try {
    // 1. تحميل قاعدة البيانات (SQLite)
    const db = await Database.load("sqlite:accounts_v2.db");

    // 2. تعريف هيكل الجداول الكامل
    const tables = [
      // جدول المستخدمين
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE, 
        password TEXT NOT NULL, 
        role TEXT DEFAULT 'user'
      );`,

      // جدول الإعدادات
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`,

      // جدول الفئات
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT UNIQUE NOT NULL
      );`,

      // جدول المنتجات
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

      // جدول تفاصيل المقاسات والألوان
      `CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        color TEXT,
        size TEXT,
        stock INTEGER DEFAULT 0,
        variant_barcode TEXT UNIQUE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );`,

      // جدول العملاء
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL, 
        phone TEXT UNIQUE, 
        address TEXT, 
        points INTEGER DEFAULT 0
      );`,

      // جدول الفواتير مع إضافة حقول الموظفين
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

      // جدول أصناف الفاتورة
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

      // جدول خطة الأقساط
      `CREATE TABLE IF NOT EXISTS installment_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        customer_id INTEGER,
        due_date DATE,
        amount_due REAL,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );`,

      // جدول سجل المدفوعات (التحصيلات)
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

      // جداول المرتجعات والمحذوفات
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

      // جدول صلاحيات المستخدمين
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

      // جدول فئات المصروفات
      `CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );`,

      // جدول المصروفات
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        amount REAL NOT NULL,
        note TEXT,
        expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id)
      );`,

      // جدول الموظفين مع إضافة حقول العمولة والمبيعات
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

      // جدول الحضور والانصراف
      `CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        date DATE NOT NULL,
        check_in TEXT,
        check_out TEXT,
        status TEXT DEFAULT 'present',
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );`,

      // جدول إحصائيات مبيعات الموظفين الشهرية
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

      // جدول الموردين
      `CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        balance REAL DEFAULT 0
      );`,

      // جدول فواتير المشتريات (Header)
      `CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        purchase_date DATE NOT NULL,
        status TEXT DEFAULT 'completed',
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );`,

      // جدول تفاصيل المشتريات (Items)
      `CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        cost_price REAL NOT NULL,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );`
    ];

     try {
      const columns = await db.select("PRAGMA table_info(installment_plan)");
      const hasAmountDue = columns.some(col => col.name === 'amount_due');
      if (!hasAmountDue) {
        await db.execute("ALTER TABLE installment_plan ADD COLUMN amount_due REAL DEFAULT 0");
        console.log("✅ تم إضافة عمود amount_due إلى جدول installment_plan");
      }
      const hasStatus = columns.some(col => col.name === 'status');
      if (!hasStatus) {
        await db.execute("ALTER TABLE installment_plan ADD COLUMN status TEXT DEFAULT 'pending'");
        console.log("✅ تم إضافة عمود status إلى جدول installment_plan");
      }
    } catch (err) {
      console.error("خطأ في تحديث هيكل جدول الأقساط:", err);
    }
    // التأكد من وجود عمود payment_date في installment_plan
try {
  const columnsIp = await db.select("PRAGMA table_info(installment_plan)");
  const hasPaymentDate = columnsIp.some(col => col.name === 'payment_date');
  if (!hasPaymentDate) {
    await db.execute("ALTER TABLE installment_plan ADD COLUMN payment_date TIMESTAMP");
    console.log("✅ تم إضافة عمود payment_date إلى جدول installment_plan");
  }
} catch (err) {
  console.error("خطأ في تحديث هيكل جدول الأقساط (payment_date):", err);
}

    // 3. التحقق من صحة المصفوفة وتنفيذ إنشاء الجداول
    if (tables && Array.isArray(tables) && tables.length > 0) {
      for (const table of tables) {
        if (table && typeof table === 'string' && table.trim().length > 0) {
          try {
            await db.execute(table);
          } catch (error) {
            console.error("Error executing SQL:", error);
            // لا نرمي الخطأ لاستمرار إنشاء الجداول الأخرى
          }
        }
      }
    } else {
      console.error("Tables array is invalid or empty");
    }

    // 4. إضافة الأعمدة المفقودة إذا لزم الأمر
    try {
      await db.execute(`ALTER TABLE invoice_items ADD COLUMN cost_price_at_sale REAL;`);
    } catch (error) {
      // تجاهل خطأ العمود الموجود
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column cost_price_at_sale might already exist or other error:", error);
      }
    }

    // إضافة أعمدة الموظفين إلى جدول invoices إذا لم تكن موجودة
    try {
      await db.execute(`ALTER TABLE invoices ADD COLUMN seller_id INTEGER;`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column seller_id might already exist:", error);
      }
    }

    try {
      await db.execute(`ALTER TABLE invoices ADD COLUMN seller_name TEXT;`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column seller_name might already exist:", error);
      }
    }

    try {
      await db.execute(`ALTER TABLE invoices ADD COLUMN commission_amount REAL DEFAULT 0;`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column commission_amount might already exist:", error);
      }
    }

    // إضافة أعمدة الموظفين إلى جدول employees إذا لم تكن موجودة
    try {
      await db.execute(`ALTER TABLE employees ADD COLUMN commission_rate REAL DEFAULT 0;`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column commission_rate might already exist:", error);
      }
    }

    try {
      await db.execute(`ALTER TABLE employees ADD COLUMN total_sales REAL DEFAULT 0;`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column total_sales might already exist:", error);
      }
    }

    try {
      await db.execute(`ALTER TABLE employees ADD COLUMN last_sale_date DATE;`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.log("Column last_sale_date might already exist:", error);
      }
    }

    // 5. إعدادات افتراضية للمحل
    await db.execute(
      `INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('shop_name', 'كودينج كورنر ستور'), 
      ('last_backup', 'لم يتم النسخ بعد');`
    );

    // 6. إضافة موظف افتراضي إذا لم يكن هناك موظفين
    const employeeCount = await db.select("SELECT COUNT(*) as count FROM employees WHERE is_active = 1");
    if (employeeCount && employeeCount[0] && employeeCount[0].count === 0) {
      await db.execute(
        `INSERT OR IGNORE INTO employees (name, position, commission_rate, is_active) 
         VALUES ('مدير النظام', 'مدير', 5, 1)`
      );
    }

    return db;

  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
};