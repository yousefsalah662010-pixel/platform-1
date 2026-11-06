/* ============================================================
   منصة طاهر البيلي — تسجيل الدخول وإنشاء الحساب
   ============================================================ */
(function(){
  applyTheme();
  dbLoad();
  $('#logoMark').innerHTML = ic('grad-cap');

  function showTab(name){
    $$('#authTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $('#loginForm').classList.toggle('hidden', name !== 'login');
    $('#registerForm').classList.toggle('hidden', name !== 'register');
  }
  $$('#authTabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#goRegister').addEventListener('click', e => { e.preventDefault(); showTab('register'); });
  $('#goLogin').addEventListener('click', e => { e.preventDefault(); showTab('login'); });

  /* تعبئة الحسابات التجريبية */
  $$('code[data-fill]').forEach(code => code.addEventListener('click', () => {
    const [email, pass] = code.dataset.fill.split('|');
    $('#liEmail').value = email; $('#liPass').value = pass;
  }));

  function err(id, msg){
    const el = $(id);
    if(msg){ el.textContent = msg; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  }

  /* دخول الطالب */
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#liEmail').value.trim(), pass = $('#liPass').value;
    if(!email || !pass){ err('#liErr', 'أدخل البريد الإلكتروني وكلمة المرور'); return; }
    const res = loginStudent(email, pass);
    if(!res.ok){ err('#liErr', res.msg); return; }
    toast('أهلاً بعودتك!');
    setTimeout(() => { location.href = 'dashboard.html'; }, 500);
  });

  /* حساب جديد */
  $('#registerForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#rgName').value.trim(), email = $('#rgEmail').value.trim(),
          phone = $('#rgPhone').value.trim(), p1 = $('#rgPass').value, p2 = $('#rgPass2').value;
    if(name.length < 3){ err('#rgErr', 'أدخل اسمك الكامل (3 أحرف على الأقل)'); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ err('#rgErr', 'أدخل بريداً إلكترونياً صحيحاً'); return; }
    if(p1.length < 6){ err('#rgErr', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if(p1 !== p2){ err('#rgErr', 'كلمتا المرور غير متطابقتين'); return; }
    const res = registerStudent(name, email, phone || '—', p1);
    if(!res.ok){ err('#rgErr', res.msg); return; }
    toast('تم إنشاء حسابك بنجاح، أهلاً بك!');
    setTimeout(() => { location.href = 'dashboard.html'; }, 600);
  });

  /* دخول الإدارة انتقل إلى رابط لوحة الإدارة المنفصل — هذه الصفحة للطلاب فقط */

  /* من الرابط: ?tab=register */
  const sp = new URLSearchParams(location.search);
  if(sp.get('tab') === 'register') showTab('register');

  /* لو مسجل دخول بالفعل */
  const s = getSession();
  if(s){
    if(s.role === 'admin') location.href = '../elearning-admin/index.html';
    else location.href = 'dashboard.html';
  }
})();
