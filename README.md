# 🏆 أولمبياد الرياضيات - فاقوس

منصة تفاعلية لأولمبياد الرياضيات بإدارة فاقوس، الشرقية.

---

## 🚀 خطوات الإعداد

### 1. إنشاء مشروع Supabase
1. اذهب إلى [supabase.com](https://supabase.com)
2. أنشئ مشروع جديد
3. احفظ **Project URL** و **Anon Key**

### 2. تشغيل قاعدة البيانات
1. افتح **SQL Editor** في Supabase Dashboard
2. انسخ محتوى ملف `database.sql` والصقه
3. اضغط **RUN**

### 3. إيقاف تأكيد الإيميل
1. اذهب إلى **Authentication → Providers → Email**
2. **أوقف** خيار "Confirm email"
3. احفظ

### 4. إعداد المشروع محلياً
```bash
# نسخ ملف الإعدادات
cp .env.example .env

# تعديل .env وضع بياناتك
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# تثبيت الحزم
npm install

# تشغيل المشروع
npm run dev
```

### 5. إنشاء أول سوبر أدمن
1. سجل حساب عادي في الموقع
2. افتح **SQL Editor** في Supabase
3. نفذ الأمر ده (بدّل `your_username`):
```sql
UPDATE profiles SET role = 'superadmin' WHERE username = 'your_username';
```

---

## 📋 المميزات

### للطالب:
- تسجيل دخول بـ username/password
- شوف الأسئلة المنشورة في الوقت الفعلي
- عداد تنازلي لكل سؤال
- إجابة MCQ مرة واحدة فقط
- بعد انتهاء الوقت: ظهور الإجابة الصحيحة
- بروفايل شخصي مع سجل الإجابات والترتيب

### للأدمن/سوبر أدمن:
- نظرة عامة وإحصائيات لحظية
- إضافة أسئلة MCQ مع تحديد الوقت والاستهداف
- نشر/إخفاء الأسئلة
- مشاهدة من أجاب وبأي ترتيب
- إدارة المدارس والفصول (توليد تلقائي ويدوي)
- إدارة المستخدمين (ترقية/تعطيل)
- لوحة شرف كاملة مع تفاصيل الترتيب

---

## 🏗️ التقنيات

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + Framer Motion
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Icons:** Lucide React

---

## 📁 هيكل المشروع

```
src/
├── contexts/AuthContext.tsx    ← نظام المصادقة
├── lib/supabase.ts             ← Supabase client
├── types/index.ts              ← TypeScript types
├── pages/
│   ├── LoginPage.tsx           ← صفحة الدخول
│   ├── RegisterPage.tsx        ← صفحة التسجيل
│   ├── StudentDashboard.tsx    ← واجهة الطالب
│   ├── StudentProfile.tsx      ← بروفايل الطالب
│   └── AdminDashboard.tsx      ← داشبورد الأدمن
└── components/
    └── shared/
        ├── Navbar.tsx
        └── LoadingScreen.tsx
```

---

صُنع بـ ❤️ لتوجيه الرياضيات - فاقوس، الشرقية
