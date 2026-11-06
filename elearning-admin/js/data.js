/* ============================================================
   منصة طاهر البيلي — طبقة البيانات (قاعدة بيانات تجريبية عبر localStorage)
   في الإنتاج الحقيقي تُستبدل هذه الطبقة بـ Firebase أو Backend مخصص
   مع الحفاظ على نفس أسماء الدوال.
   ============================================================ */

const STATE_KEY = 'taher_state_v2';
const SESSION_KEY = 'taher_session_v2';
const THEME_KEY = 'taher_theme';
const DB_VERSION = 3;


/* أدوات مساعدة عامة */
const NOW = () => Date.now();
const d = n => NOW() + n * 86400000;
let _uidSeq = 1000;
function uid(p){ _uidSeq += 7; return p + '-' + Date.now().toString(36) + String(_uidSeq); }

function fmtNum(n){ return Number(n || 0).toLocaleString('en-US'); }
function fmtPrice(n){ return n === 0 ? 'مجاني' : fmtNum(n) + ' ج.م'; }
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function fmtDate(ts){
  if(!ts) return '—';
  const dt = new Date(ts);
  return dt.getDate() + ' ' + AR_MONTHS[dt.getMonth()] + ' ' + dt.getFullYear();
}
function timeAgo(ts){
  const s = Math.floor((NOW() - ts) / 1000);
  if(s < 60) return 'الآن';
  const m = Math.floor(s / 60); if(m < 60) return 'منذ ' + m + ' دقيقة';
  const h = Math.floor(m / 60); if(h < 24) return 'منذ ' + h + ' ساعة';
  const dd = Math.floor(h / 24); if(dd < 30) return 'منذ ' + dd + ' يوم';
  return fmtDate(ts);
}
function fmtDur(min){
  min = Number(min) || 0;
  if(min < 60) return min + ' دقيقة';
  const h = Math.floor(min / 60), m = min % 60;
  return h + ' ساعة' + (m ? ' و' + m + ' دقيقة' : '');
}
function monthKey(ts){ const dt = new Date(ts); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); }

/* ============================================================
   البيانات الأولية (Seed)
   ============================================================ */
function buildSeed(){
  const state = {
    _v: DB_VERSION,
    categories: [
      { id:'c1', name:'تطوير الويب', icon:'code', g1:'#2563eb', g2:'#14b8a6' },
      { id:'c2', name:'الذكاء الاصطناعي وتحليل البيانات', icon:'cpu', g1:'#7c3aed', g2:'#2563eb' },
      { id:'c3', name:'التصميم وواجهات المستخدم', icon:'pen-tool', g1:'#e11d48', g2:'#f59e0b' },
      { id:'c4', name:'التسويق الرقمي', icon:'trending', g1:'#0d9488', g2:'#22d3ee' },
      { id:'c5', name:'اللغات', icon:'book-open', g1:'#2563eb', g2:'#7c3aed' },
      { id:'c6', name:'إدارة الأعمال', icon:'briefcase', g1:'#172554', g2:'#2563eb' }
    ],
    instructors: [
      { id:'i1', name:'أ. طاهر البيلي', title:'مؤسس المنصة ومدرّبها' }
    ],
    /* بيانات البداية: منصة جديدة تماماً — الدورات والطلاب يُضافون من لوحة الإدارة */
    courses: [],
    students: [],
    quizzes: [],
    transactions: [],
    messages: [],
    courseQA: [],
    notifications: [],
    faqs: [
      { id:'f1', q:'كيف أسجل في دورة جديدة؟', a:'اختر الدورة من صفحة "الدورات" ثم اضغط "اشترك الآن". الدورات المجانية تُفعّل فوراً، بينما تُراجع الدفع للدورات المدفوعة ويُؤكد اشتراكك سريعاً.' },
      { id:'f2', q:'هل أحصل على شهادة بعد إتمام الدورة؟', a:'نعم، بعد مشاهدة جميع دروس الدورة تُصدر لك شهادة إتمام إلكترونية باسمك يمكنك عرضها أو طباعتها من لوحة الطالب.' },
      { id:'f3', q:'هل يمكنني مشاهدة الدروس من الهاتف؟', a:'بالتأكيد، المنصة مصممة لتعمل بكفاءة كاملة على الهواتف الذكية والأجهزة اللوحية وأجهزة الكمبيوتر.' },
      { id:'f4', q:'ما طرق الدفع المتاحة؟', a:'نوفر حالياً الدفع بالبطاقة البنكية، فودافون كاش، والتحويل البنكي المباشر.' },
      { id:'f5', q:'هل المحتوى متاح مدى الحياة؟', a:'نعم، بعد تأكيد اشتراكك يبقى محتوى الدورة متاحاً في حسابك دون أي حد زمني، وتشمل ذلك أي تحديثات مستقبلية للدورة.' },
      { id:'f6', q:'ماذا أفعل إذا واجهت مشكلة تقنية؟', a:'تواصل معنا من خلال "الدعم الفني" في لوحة الطالب، وسيرد فريقنا على استفسارك خلال 24 ساعة كحد أقصى.' }
    ],
    news: [],
    announcements: [],
    admins: [
      { id:'a1', name:'المدير العام', email:'taher-elbily@gmail.com', password:'037754321', role:'مدير عام', main:true,
        perms:{ students:true, courses:true, finance:true, quizzes:true, content:true, support:true, security:true } }
    ],
    activity: [],
    settings: {
      siteName:'منصة طاهر البيلي',
      heroTitle:'اكتسب مهارة جديدة تغيّر مستقبلك المهني',
      heroSubtitle:'دورات عربية احترافية بجودة عالية مع متابعة تقدمك، واختبارات تفاعلية، وشهادات إتمام — تعلّم في وقتك ومن أي مكان.',
      heroBtn:'ابدأ التعلم الآن',
      stats:{ students:0, hours:0, satisfaction:97 },
      contact:{ email:'taher-elbily@gmail.com', phone:'+201154180355', address:'—' }
    }
  };
  return state;
}

/* ============================================================
   قراءة/كتابة الحالة
   ============================================================ */
let _state = null;
function dbLoad(){
  if(_state) return _state;
  try{
    const raw = localStorage.getItem(STATE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed._v === DB_VERSION){ _state = parsed; return _state; }
    }
  }catch(e){ /* تجاهل وتابع بالتهيئة */ }
  _state = buildSeed();
  dbSave();
  return _state;
}
function dbSave(){
  try{ localStorage.setItem(STATE_KEY, JSON.stringify(_state)); }
  catch(e){ console.warn('تعذر الحفظ في localStorage', e); }
}
function resetDemo(){
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(SESSION_KEY);
  location.href = 'index.html';
}

/* ============================================================
   الجلسة والحسابات
   ============================================================ */
function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null; } }
function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function me(){
  const s = getSession(); if(!s) return null;
  const st = dbLoad();
  if(s.role === 'student') return st.students.find(x => x.id === s.id) || null;
  if(s.role === 'admin') return st.admins.find(x => x.id === s.id) || null;
  return null;
}
function requireStudent(){
  const u = me();
  if(!u || getSession().role !== 'student'){ location.href = 'login.html'; return null; }
  return u;
}
function requireAdmin(){
  const u = me();
  if(!u || getSession().role !== 'admin'){ location.href = 'index.html'; return null; }
  return u;
}
function loginStudent(email, password){
  const st = dbLoad();
  const s = st.students.find(x => x.email.toLowerCase() === email.toLowerCase());
  if(!s) return { ok:false, msg:'لا يوجد حساب بهذا البريد الإلكتروني' };
  if(s.password !== password) return { ok:false, msg:'كلمة المرور غير صحيحة' };
  if(!s.active) return { ok:false, msg:'هذا الحساب موقوف حالياً، تواصل مع الدعم الفني' };
  setSession({ role:'student', id:s.id });
  return { ok:true };
}
function loginAdmin(email, password){
  const st = dbLoad();
  const a = st.admins.find(x => x.email.toLowerCase() === email.toLowerCase());
  if(!a) return { ok:false, msg:'بيانات الدخول غير صحيحة' };
  if(a.password !== password) return { ok:false, msg:'بيانات الدخول غير صحيحة' };
  setSession({ role:'admin', id:a.id });
  logActivity('تسجيل دخول المشرف ' + a.name);
  return { ok:true };
}
function registerStudent(name, email, phone, password){
  const st = dbLoad();
  if(st.students.some(x => x.email.toLowerCase() === email.toLowerCase()) || st.admins.some(x => x.email.toLowerCase() === email.toLowerCase()))
    return { ok:false, msg:'هذا البريد الإلكتروني مستخدم بالفعل' };
  const s = {
    id: uid('s'), name, email, phone, password, active:true, joinedAt:NOW(),
    enrollments:[]
  };
  st.students.push(s);
  addNotification(s.id, 'أهلاً بك في ' + st.settings.siteName, 'تم إنشاء حسابك بنجاح. ابدأ بتصفح الدورات واختر ما يناسب أهدافك.', 'info');
  dbSave();
  setSession({ role:'student', id:s.id });
  return { ok:true };
}

/* حذف الطالب نهائياً: اشتراكاته (ومنها نتائج اختباراته) تنحذف مع كائنه، والسجلات المتفرقة المرتبطة به تُنظّف هنا */
function deleteStudent(id){
  const st = dbLoad();
  const i = st.students.findIndex(x => x.id === id);
  if(i === -1) return null;
  const x = st.students.splice(i, 1)[0];
  st.transactions = st.transactions.filter(t => t.studentId !== id);
  st.messages = st.messages.filter(m => m.studentId !== id);
  st.courseQA = st.courseQA.filter(q => q.studentId !== id);
  st.notifications = st.notifications.filter(n => n.studentId !== id);
  const sess = getSession();
  if(sess && sess.role === 'student' && sess.id === id) clearSession();
  dbSave();
  return x;
}

/* ============================================================
   منطق المنصة (اشتراكات، تقدم، اختبارات، إشعارات)
   ============================================================ */
const ENR_STATUS = { active:'نشط', pending:'بانتظار الدفع', rejected:'مرفوض' };
const MSG_STATUS = ['جديد', 'قيد المعالجة', 'تم الرد', 'مؤرشف'];

function getCourse(id){ return dbLoad().courses.find(c => c.id === id); }
function getCategory(id){ return dbLoad().categories.find(c => c.id === id) || { name:'عام', icon:'book-open', g1:'#2563eb', g2:'#14b8a6' }; }
function getInstructor(id){ return dbLoad().instructors.find(i => i.id === id) || { name:'—' }; }
function getStudent(id){ return dbLoad().students.find(s => s.id === id); }
function getQuiz(id){ return dbLoad().quizzes.find(q => q.id === id); }
function liveCourses(){ return dbLoad().courses.filter(c => c.published && !c.archived); }
function courseMinutes(c){ return c.lessons.reduce((a, l) => a + (+l.duration || 0), 0); }

function getEnrollment(studentId, courseId){
  const s = getStudent(studentId);
  if(!s) return null;
  return s.enrollments.find(e => e.courseId === courseId) || null;
}
function progressOf(enr, course){
  if(!enr || !course) return 0;
  return Math.round((enr.progress.length / Math.max(course.lessons.length, 1)) * 100);
}
function enroll(studentId, courseId, method){
  const st = dbLoad();
  const course = getCourse(courseId);
  const s = getStudent(studentId);
  if(!course || !s || getEnrollment(studentId, courseId)) return { ok:false, msg:'أنت مشترك بالفعل في هذه الدورة' };
  const enr = { courseId, at:NOW(), status:'active', method: method || 'مجاني', amount:course.price, progress:[], completedAt:null, quizResults:[] };
  if(course.price > 0){
    enr.status = 'pending';
    st.transactions.push({ id:uid('t'), studentId, courseId, amount:course.price, method:method || 'بطاقة بنكية', at:NOW(), status:'معلق' });
    addNotification(studentId, 'بانتظار تأكيد الدفع', 'استلمنا طلب اشتراكك في "' + course.title + '" وسيتم تفعيل الاشتراك بعد مراجعة الدفع.', 'warn');
  } else {
    addNotification(studentId, 'تم تفعيل اشتراكك', 'أصبح اشتراكك في "' + course.title + '" نشطاً الآن. بالتوفيق!', 'success');
  }
  s.enrollments.push(enr);
  dbSave();
  return { ok:true, status:enr.status };
}
function confirmPayment(transactionId, approve){
  const st = dbLoad();
  const t = st.transactions.find(x => x.id === transactionId);
  if(!t) return;
  t.status = approve ? 'مدفوع' : 'مرفوض';
  const enr = getEnrollment(t.studentId, t.courseId);
  const course = getCourse(t.courseId);
  if(enr){
    enr.status = approve ? 'active' : 'rejected';
    if(approve) addNotification(t.studentId, 'تم تأكيد اشتراكك', 'اشتراكك في "' + course.title + '" نشط الآن. يمكنك البدء فوراً.', 'success');
    else addNotification(t.studentId, 'لم يتم تأكيد الدفع', 'تعذر تأكيد دفع اشتراكك في "' + course.title + '". تواصل مع الدعم الفني.', 'warn');
  }
  const student = getStudent(t.studentId);
  logActivity((approve ? 'تأكيد دفع اشتراك الطالب "' : 'رفض دفع اشتراك الطالب "') + (student ? student.name : '') + '" في دورة ' + course.title);
  dbSave();
}
function markLessonDone(studentId, courseId, lessonId){
  const enr = getEnrollment(studentId, courseId);
  const course = getCourse(courseId);
  if(!enr || !course || enr.status !== 'active') return { completed:false, pct:0 };
  if(!enr.progress.includes(lessonId)) enr.progress.push(lessonId);
  let justCompleted = false;
  if(!enr.completedAt && enr.progress.length >= course.lessons.length){
    enr.completedAt = NOW();
    justCompleted = true;
    addNotification(studentId, 'شهادتك جاهزة', 'مبروك! أكملت جميع دروس "' + course.title + '" وشهادتك متاحة الآن في لوحتك.', 'success');
  }
  dbSave();
  return { completed:justCompleted, pct:progressOf(enr, course) };
}
function submitQuiz(studentId, quizId, answers){
  const quiz = getQuiz(quizId);
  if(!quiz) return null;
  let correct = 0;
  quiz.questions.forEach((q, i) => { if(answers[i] === q.correct) correct++; });
  const score = Math.round((correct / quiz.questions.length) * 100);
  const passed = score >= quiz.passGrade;
  const enr = getEnrollment(studentId, quiz.courseId);
  if(enr){
    enr.quizResults.push({ quizId, score, passed, at:NOW() });
    addNotification(studentId, passed ? 'نتيجة اختبارك: ناجح' : 'نتيجة اختبارك', 'حصلت على ' + score + '% في "' + quiz.title + '" (النجاح من ' + quiz.passGrade + '%).', passed ? 'success' : 'warn');
    dbSave();
  }
  return { score, passed, correct, total:quiz.questions.length };
}
function addNotification(studentId, title, body, type){
  const st = dbLoad();
  st.notifications.unshift({ id:uid('n'), studentId, title, body, type:type || 'info', at:NOW(), read:false });
  dbSave();
}
function logActivity(text){
  const st = dbLoad();
  const s = getSession();
  st.activity.unshift({ id:uid('ac'), adminId:(s && s.role === 'admin') ? s.id : 'a1', text, at:NOW() });
  if(st.activity.length > 60) st.activity.length = 60;
  dbSave();
}
function addSupportMessage(studentId, subject, body){
  const st = dbLoad();
  st.messages.unshift({ id:uid('msg'), studentId, subject, body, at:NOW(), status:'جديد', replies:[] });
  dbSave();
}
function unreadNotifs(studentId){
  return dbLoad().notifications.filter(n => n.studentId === studentId && !n.read).length;
}
