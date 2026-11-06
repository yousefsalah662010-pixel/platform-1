/* ============================================================
   منصة طاهر البيلي — مكونات مشتركة (السمة، النوافذ، التوست، الهيدر...)
   ============================================================ */
function $(sel, root){ return (root || document).querySelector(sel); }
function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- السمة (ليلي/نهاري) ---------- */
function currentTheme(){
  return localStorage.getItem(THEME_KEY) || 'light';
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme', currentTheme());
  $$('[data-theme-toggle]').forEach(btn => {
    btn.innerHTML = ic(currentTheme() === 'dark' ? 'sun' : 'moon');
    btn.setAttribute('aria-label', currentTheme() === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي');
  });
}
function toggleTheme(){
  localStorage.setItem(THEME_KEY, currentTheme() === 'dark' ? 'light' : 'dark');
  applyTheme();
}

/* ---------- الصورة الرمزية ---------- */
const AVATAR_COLORS = ['#2563eb','#14b8a6','#7c3aed','#e11d48','#f59e0b','#0d9488','#172554','#6366f1'];
function avatar(name, size){
  const initials = String(name || '؟').trim().slice(0, 2);
  let h = 0; for(const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return '<span class="avatar ' + size + '" style="background:' + AVATAR_COLORS[h % AVATAR_COLORS.length] + '">' + esc(initials) + '</span>';
}

/* ---------- نجوم التقييم ---------- */
function starsHtml(rating, count){
  rating = Number(rating) || 0;
  let out = '<span class="stars" title="' + rating + ' من 5">';
  for(let i = 1; i <= 5; i++)
    out += ic('star', i <= Math.round(rating) ? '' : 'off');
  if(count != null) out += '<span class="num">' + rating.toFixed(1) + ' (' + fmtNum(count) + ')</span>';
  else out += '<span class="num">' + (rating ? rating.toFixed(1) : 'جديد') + '</span>';
  return out + '</span>';
}

/* ---------- التوست ---------- */
function toast(msg, type){
  let wrap = $('.toast-wrap');
  if(!wrap){ wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'success');
  el.innerHTML = ic(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle') + '<span>' + esc(msg) + '</span>';
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.4s'; setTimeout(() => el.remove(), 420); }, 3200);
}

/* ---------- النوافذ المنبثقة ---------- */
function openModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('click', e => {
  const bd = e.target.closest('.modal-backdrop');
  if(bd && e.target === bd) closeModal(bd.id);
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') $$('.modal-backdrop.open').forEach(m => closeModal(m.id));
});
/* نافذة تأكيد عامة */
function confirmAction(title, msg, onYes, yesLabel){
  if(!$('#confirmModal')){
    const div = document.createElement('div');
    div.id = 'confirmModal';
    div.className = 'modal-backdrop';
    div.innerHTML = '<div class="modal" style="max-width:430px">' +
      '<div class="modal-head"><h3 id="cmTitle"></h3><button class="close-m" data-cm-close>' + ic('x') + '</button></div>' +
      '<div class="modal-body"><p id="cmMsg" class="text-muted"></p></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-cm-close>إلغاء</button><button class="btn btn-danger" id="cmYes"></button></div></div>';
    document.body.appendChild(div);
    div.addEventListener('click', e => { if(e.target.closest('[data-cm-close]')) closeModal('confirmModal'); });
  }
  $('#cmTitle').textContent = title;
  $('#cmMsg').textContent = msg;
  const yes = $('#cmYes');
  yes.textContent = yesLabel || 'تأكيد';
  yes.onclick = () => { closeModal('confirmModal'); onYes(); };
  openModal('confirmModal');
}

/* ---------- عناصر مشتركة ---------- */
function priceBadge(course){
  return course.price === 0
    ? '<span class="price-tag free">مجاني</span>'
    : '<span class="price-tag">' + fmtPrice(course.price) + '</span>';
}
function coverStyle(cat){
  return 'style="--g1:' + cat.g1 + ';--g2:' + cat.g2 + '"';
}
function courseCardHtml(c, actionHtml){
  const cat = getCategory(c.categoryId);
  return '<article class="course-card">' +
    '<div class="cc-cover" ' + coverStyle(cat) + '>' + ic(cat.icon) +
      '<span class="badge badge-primary">' + esc(cat.name) + '</span>' + priceBadge(c) + '</div>' +
    '<div class="cc-body">' +
      '<h3><a href="courses.html?open=' + c.id + '">' + esc(c.title) + '</a></h3>' +
      '<span class="cc-inst">' + ic('user','ic-sm') + esc(getInstructor(c.instructorId).name) + ' · ' + esc(c.level) + '</span>' +
      starsHtml(c.rating, c.ratingCount) +
      '<div class="cc-meta"><span>' + ic('play-circle','ic-sm') + c.lessons.length + ' دروس</span>' +
      '<span>' + ic('clock','ic-sm') + fmtDur(courseMinutes(c)) + '</span>' +
      '<span>' + ic('users','ic-sm') + fmtNum(c.studentsCount) + '</span></div>' +
      '<div class="cc-foot">' + actionHtml + '</div>' +
    '</div></article>';
}

/* ---------- تهيئة الصفحة العامة (هيدر/فوتر) ---------- */
function initPublicPage(active){
  applyTheme();
  dbLoad();
  renderAnnounceBar();
  const nav = $('#mainNav');
  if(nav) $$('a', nav).forEach(a => { if(a.dataset.nav === active) a.classList.add('active'); });
  const burger = $('#burger'), mnav = $('#mobileNav');
  if(burger && mnav){
    burger.addEventListener('click', () => mnav.classList.toggle('open'));
    $$('a', mnav).forEach(a => { if(a.dataset.nav === active) a.classList.add('active'); });
  }
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
  renderAuthArea();
  renderFooterDynamic();
}
function renderAuthArea(){
  const area = $('#authArea'), mArea = $('#authAreaM');
  const u = me();
  const session = getSession();
  let html;
  if(u && session && session.role === 'student'){
    html = '<a class="btn btn-ghost btn-sm" href="dashboard.html">' + ic('grid','ic-sm') + '<span>لوحتي</span></a>' +
           '<button class="btn btn-outline btn-sm" onclick="logout()">' + ic('log-out','ic-sm') + '<span>خروج</span></button>';
  } else if(u && session && session.role === 'admin'){
    /* جلسة مدير على صفحات المنصة: لا روابط للوحة الإدارة هنا — الخروج فقط */
    html = '<button class="btn btn-outline btn-sm" onclick="logout()">' + ic('log-out','ic-sm') + '<span>خروج</span></button>';
  } else {
    html = '<a class="btn btn-ghost btn-sm" href="login.html">تسجيل الدخول</a>' +
           '<a class="btn btn-primary btn-sm" href="login.html?tab=register">إنشاء حساب</a>';
  }
  if(area) area.innerHTML = html;
  if(mArea) mArea.innerHTML = html;
}
function logout(){
  clearSession();
  location.href = 'index.html';
}
function renderAnnounceBar(){
  const bar = $('#announceBar');
  if(!bar) return;
  const ann = dbLoad().announcements.find(a => a.active);
  const dismissed = sessionStorage.getItem('dismissed_ann_' + (ann ? ann.id : ''));
  if(!ann || dismissed){ bar.style.display = 'none'; return; }
  bar.style.display = '';
  bar.innerHTML = '<div class="container">' + esc(ann.text) + '</div>' +
    '<button class="close-a" aria-label="إغلاق" onclick="dismissAnnounce(\'' + ann.id + '\')">' + ic('x','ic-sm') + '</button>';
}
function dismissAnnounce(id){
  sessionStorage.setItem('dismissed_ann_' + id, '1');
  renderAnnounceBar();
}
function renderFooterDynamic(){
  const st = dbLoad().settings;
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('ftEmail', st.contact.email);
  set('ftAddress', st.contact.address);
  /* رقم الهاتف يظهر كرابط واتساب مباشر للطالب */
  const ph = document.getElementById('ftPhone');
  if(ph){
    const digits = String(st.contact.phone || '').replace(/[^0-9]/g, '');
    let intl = digits;
    if(digits.length === 11 && digits.charAt(0) === '0') intl = '20' + digits.slice(1);
    if(intl){
      ph.innerHTML = '<a href="https://wa.me/' + intl + '" target="_blank" rel="noopener" title="تواصل واتساب" style="color:inherit;text-decoration:underline;text-underline-offset:3px">' + esc(st.contact.phone) + '</a>';
    } else {
      ph.textContent = st.contact.phone;
    }
  }
  set('ftYear', String(new Date().getFullYear()));
  const sn = document.getElementById('ftSiteName');
  if(sn) sn.textContent = st.siteName;
  const sn2 = document.getElementById('ftSiteName2');
  if(sn2) sn2.textContent = st.siteName;
}

/* شريط التقدم */
function progressBar(pct, thin){
  return '<div class="progress' + (thin ? ' thin' : '') + '"><span style="width:' + Math.min(100, pct) + '%"></span></div>';
}
/* شارة حالة */
function statusBadge(status){
  const map = {
    'نشط':'badge-success', 'active':'badge-success', 'مدفوع':'badge-success', 'تم الرد':'badge-success',
    'بانتظار الدفع':'badge-warn', 'pending':'badge-warn', 'معلق':'badge-warn', 'قيد المعالجة':'badge-warn',
    'مرفوض':'badge-danger', 'راسب':'badge-danger', 'جديد':'badge-info',
    'مؤرشف':'badge-muted', 'مسودة':'badge-muted', 'مرفوض الدفع':'badge-danger'
  };
  return '<span class="badge ' + (map[status] || 'badge-muted') + '">' + esc(status) + '</span>';
}
