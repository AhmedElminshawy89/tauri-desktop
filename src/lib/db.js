import Database from "@tauri-apps/plugin-sql";

export const getDb = async () => {
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

    // جدول الفواتير (تأكد من وجود installments_count هنا)
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
      FOREIGN KEY (customer_id) REFERENCES customers(id)
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
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
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
      FOREIGN KEY (product_id) REFERENCES products(id)
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
// أضف هذه الجداول داخل مصفوفة tables في ملف getDb
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
);`
  ];

  // 3. تنفيذ إنشاء الجداول (في حال لم تكن موجودة)
  for (const table of tables) {
    await db.execute(table);
  }



  // 5. إعدادات افتراضية للمحل
  await db.execute(
    `INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('shop_name', 'كودينج كورنر ستور'), 
    ('last_backup', 'لم يتم النسخ بعد');`
  );

  return db;
};