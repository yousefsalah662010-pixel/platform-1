/* ============================================================
   منصة طاهر البيلي — صفحة الدورات (بحث + فلاتر + تفاصيل + اشتراك)
   ============================================================ */
let curCourse = null;
let curMethod = 'بطاقة بنكية';
const METHODS = [
  { id:'بطاقة بنكية', icon:'credit-card', note:'تدعم بطاقات فيزا وماستركارد المحلية والدولية.' },
  { id:'فودافون كاش', icon:'phone', note:'حوّل المبلغ على المحفظة 01001234567 وسيتم التأكيد بعد المراجعة.' },
  { id:'تحويل بنكي', icon:'dollar', note:'حوّل على حساب المنصة برقم 1234-5678-90 في أي بنك.' }
];

(function(){
  initPublicPage('courses');
  $('#logoMark').innerHTML = ic('grad-cap');
  $('#burger').innerHTML = ic('menu');
  $('#searchIc').innerHTML = ic('search');
  $$('.close-m').forEach(b => b.innerHTML = ic('x'));
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));

  /* تعبئة قائمة التصنيفات */
  const cats = dbLoad().categories;
  $('#fCategory').innerHTML = '<option value="">كل التصنيفات</option>' + cats.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');

  const state = { q:'', cat:'', level:'', price:'', sort:'rating' };

  function filtered(){
    let list = liveCourses();
    if(state.q){
      const q = state.q.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || getInstructor(c.instructorId).name.includes(state.q));
    }
    if(state.cat) list = list.filter(c => c.categoryId === state.cat);
    if(state.level) list = list.filter(c => c.level === state.level);
    if(state.price === 'free') list = list.filter(c => c.price === 0);
    if(state.price === 'paid') list = list.filter(c => c.price > 0);
    const sorters = {
      rating:(a, b) => b.rating - a.rating,
      popular:(a, b) => b.studentsCount - a.studentsCount,
      new:(a, b) => b.createdAt - a.createdAt,
      priceAsc:(a, b) => a.price - b.price,
      priceDesc:(a, b) => b.price - a.price
    };
    return list.sort(sorters[state.sort]);
  }

  function actionFor(c){
    const u = me(), session = getSession();
    if(!(u && session && session.role === 'student'))
      return '<a class="btn btn-primary btn-sm" href="login.html">اشترك الآن</a>' +
             '<button class="btn btn-ghost btn-sm" onclick="openDetail(\'' + c.id + '\')">تفاصيل</button>';
    const enr = getEnrollment(u.id, c.id);
    if(enr && enr.status === 'active'){
      const pct = progressOf(enr, c);
      return '<a class="btn btn-primary btn-sm" href="lesson.html?course=' + c.id + '">' + (pct > 0 ? 'متابعة ' + pct + '%' : 'ابدأ الدورة') + '</a>' +
             '<button class="btn btn-ghost btn-sm" onclick="openDetail(\'' + c.id + '\')">تفاصيل</button>';
    }
    if(enr && enr.status === 'pending')
      return '<span class="badge badge-warn">' + ic('clock','ic-sm') + ' بانتظار تأكيد الدفع</span>';
    return '<button class="btn btn-primary btn-sm" onclick="startEnroll(\'' + c.id + '\')">' + (c.price === 0 ? 'سجّل مجاناً' : 'اشترك الآن') + '</button>' +
           '<button class="btn btn-ghost btn-sm" onclick="openDetail(\'' + c.id + '\')">تفاصيل</button>';
  }

  function render(){
    const list = filtered();
    $('#resultCount').textContent = 'عرض ' + list.length + ' من أصل ' + liveCourses().length + ' دورة متاحة';
    $('#coursesGrid').innerHTML = list.map(c => courseCardHtml(c, actionFor(c))).join('');
    const empty = $('#emptyState');
    if(list.length === 0){
      empty.classList.remove('hidden');
      empty.innerHTML = ic('search') + '<h3>لا توجد دورات منشورة بعد</h3><p>جرّب تعديل الفلاتر أو كلمات البحث — والدورات الجديدة تُنشر هنا باستمرار.</p>';
    } else empty.classList.add('hidden');
  }

  $('#fSearch').addEventListener('input', e => { state.q = e.target.value.trim(); render(); });
  $('#fCategory').addEventListener('change', e => { state.cat = e.target.value; render(); });
  $('#fLevel').addEventListener('change', e => { state.level = e.target.value; render(); });
  $('#fPrice').addEventListener('change', e => { state.price = e.target.value; render(); });
  $('#fSort').addEventListener('change', e => { state.sort = e.target.value; render(); });

  /* ---------- تفاصيل الدورة ---------- */
  window.openDetail = function(id){
    const c = getCourse(id); if(!c) return;
    curCourse = c;
    const cat = getCategory(c.categoryId), inst = getInstructor(c.instructorId);
    $('#detailBody').innerHTML =
      '<div class="detail-cover" ' + coverStyle(cat) + '>' + ic(cat.icon) + priceBadge(c) + '</div>' +
      '<h3 style="font-size:20px">' + esc(c.title) + '</h3>' +
      '<div class="flex wrap mt-1" style="gap:8px">' +
        '<span class="badge badge-info">' + esc(cat.name) + '</span>' +
        '<span class="badge badge-muted">' + esc(c.level) + '</span>' + statusBadge('نشط') + '</div>' +
      '<p class="text-muted mt-2" style="font-size:14.5px">' + esc(c.longDesc || c.desc) + '</p>' +
      '<div class="flex mt-2" style="gap:18px;flex-wrap:wrap;font-size:13.5px;font-weight:700;color:var(--text-2)">' +
        '<span>' + ic('user','ic-sm') + ' ' + esc(inst.name) + '</span>' +
        '<span>' + ic('clock','ic-sm') + ' ' + fmtDur(courseMinutes(c)) + '</span>' +
        '<span>' + ic('play-circle','ic-sm') + ' ' + c.lessons.length + ' دروس</span>' +
        '<span>' + ic('users','ic-sm') + ' ' + fmtNum(c.studentsCount) + ' طالب</span></div>' +
      '<div class="mt-2">' + starsHtml(c.rating, c.ratingCount) + '</div>' +
      (c.outcomes && c.outcomes.length
        ? '<h4 class="mt-3 mb-1" style="font-size:15.5px">ماذا ستتعلم في هذه الدورة؟</h4>' +
          '<ul class="outcomes">' + c.outcomes.map(o => '<li>' + ic('check-circle') + esc(o) + '</li>').join('') + '</ul>'
        : '') +
      '<h4 class="mt-2 mb-1" style="font-size:15.5px">محتوى الدورة</h4>' +
      c.lessons.map((l, i) =>
        '<div class="curr-item"><span class="ci-idx">' + (i + 1) + '</span>' +
        '<span class="ci-t">' + esc(l.title) + '</span>' +
        '<span class="ci-d">' + (l.file ? ic('file-text','ic-sm') : '') + ic('clock','ic-sm') + l.duration + ' د</span></div>'
      ).join('');
    const u = me(), session = getSession();
    let foot;
    if(!(u && session && session.role === 'student')){
      foot = '<a class="btn btn-ghost" href="login.html">تسجيل الدخول للاشتراك</a>';
    } else {
      const enr = getEnrollment(u.id, c.id);
      if(enr && enr.status === 'active')
        foot = '<a class="btn btn-primary" href="lesson.html?course=' + c.id + '">' + ic('play','ic-sm') + ' الذهاب إلى الدروس</a>';
      else if(enr && enr.status === 'pending')
        foot = '<span class="badge badge-warn" style="font-size:14px;padding:8px 16px">اشتراكك بانتظار تأكيد الدفع</span>';
      else
        foot = '<button class="btn btn-primary" onclick="startEnroll(\'' + c.id + '\')">' + (c.price === 0 ? 'التسجيل مجاناً الآن' : 'الاشتراك — ' + fmtPrice(c.price)) + '</button>';
    }
    $('#detailFoot').innerHTML = foot;
    openModal('detailModal');
  };

  /* ---------- الاشتراك والدفع ---------- */
  window.startEnroll = function(id){
    const c = getCourse(id); if(!c) return;
    closeModal('detailModal');
    curCourse = c;
    if(c.price === 0){
      const res = enroll(me().id, c.id, 'مجاني');
      if(res.ok) toast('تم تفعيل اشتراكك في الدورة، بالتوفيق!');
      render();
      openDetail(id);
      return;
    }
    curMethod = METHODS[0].id;
    $('#payMethods').innerHTML = METHODS.map(m =>
      '<label class="radio-card sel" data-method="' + m.id + '"><input type="radio" name="payMethod" ' + (m.id === curMethod ? 'checked' : '') + '>' +
      ic(m.icon) + '<span>' + m.id + '</span></label>'
    ).join('');
    $('#payNote').innerHTML = ic('info','ic-sm') + ' ' + METHODS[0].note + ' <b>(وضع تجريبي — لن يتم خصم أي مبالغ حقيقية)</b>';
    $$('#payMethods .radio-card').forEach(card => {
      card.addEventListener('click', () => {
        curMethod = card.dataset.method;
        $$('#payMethods .radio-card').forEach(x => { x.classList.remove('sel'); x.querySelector('input').checked = false; });
        card.classList.add('sel'); card.querySelector('input').checked = true;
        const m = METHODS.find(x => x.id === curMethod);
        $('#payNote').innerHTML = ic('info','ic-sm') + ' ' + m.note + ' <b>(وضع تجريبي — لن يتم خصم أي مبالغ حقيقية)</b>';
      });
    });
    $('#payConfirmBtn').innerHTML = 'تأكيد الدفع — ' + fmtPrice(c.price);
    openModal('payModal');
  };

  $('#payConfirmBtn').addEventListener('click', () => {
    if(!curCourse) return;
    const res = enroll(me().id, curCourse.id, curMethod);
    closeModal('payModal');
    if(res.ok){
      toast('تم استلام طلب اشتراكك وسيُفعَّل بعد تأكيد الدفع', 'info');
      render();
      openDetail(curCourse.id);
    } else toast(res.msg, 'error');
  });

  render();

  /* فتح دورة محددة من الرابط ?open=id */
  const openId = new URLSearchParams(location.search).get('open');
  if(openId && getCourse(openId)) openDetail(openId);
})();
