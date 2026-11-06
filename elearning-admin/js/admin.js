/* ============================================================
   منصة طاهر البيلي — لوحة تحكم الإدارة (النواة: نظرة عامة، الطلاب، الدورات)
   الأقسام المالية والاختبارات والمحتوى والدعم والأمان في admin-extra.js
   ============================================================ */
let admin = null;
const ADM_TITLES = {
  overview:'لوحة التحكم', students:'إدارة الطلاب', courses:'إدارة الدورات', finance:'الاشتراكات والمدفوعات',
  quizzes:'الاختبارات والنتائج', content:'إدارة المحتوى والصفحات', support:'الدعم الفني', security:'الصلاحيات والأمان'
};
const PERM_LABELS = { students:'الطلاب', courses:'الدورات', finance:'المالية', quizzes:'الاختبارات', content:'المحتوى', support:'الدعم', security:'الأمان' };

/* نافذة عامة */
function admOpen(title, bodyHtml, footHtml, wide, xl){
  $('#admTitle').textContent = title;
  $('#admBody').innerHTML = bodyHtml;
  $('#admFoot').innerHTML = footHtml || '';
  $('#admModalBox').className = 'modal' + (xl ? ' xl' : wide ? ' wide' : '');
  openModal('admModal');
}
function admForm(id){ return $(id); }

(function(){
  applyTheme();
  dbLoad();
  const s = getSession();
  admin = (s && s.role === 'admin') ? me() : null;

  /* بوابة الدخول: بدون جلسة مدير تظهر شاشة الدخول الخاصة باللوحة هنا */
  if(!admin){
    $('#admGate').classList.remove('hidden');
    $('#gateMark').innerHTML = ic('shield');
    $$('.close-m').forEach(b => b.innerHTML = ic('x'));
    $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
    $$('code[data-fill]').forEach(code => code.addEventListener('click', () => {
      const [email, pass] = code.dataset.fill.split('|');
      $('#gEmail').value = email; $('#gPass').value = pass;
    }));
    $('#gateForm').addEventListener('submit', e => {
      e.preventDefault();
      const email = $('#gEmail').value.trim(), pass = $('#gPass').value, gerr = $('#gErr');
      if(!email || !pass){ gerr.textContent = 'أدخل بريد المشرف وكلمة المرور'; gerr.classList.remove('hidden'); return; }
      const res = loginAdmin(email, pass);
      if(!res.ok){ gerr.textContent = res.msg; gerr.classList.remove('hidden'); return; }
      toast('أهلاً بك في لوحة التحكم');
      setTimeout(() => location.reload(), 400);
    });
    return;
  }
  $('#appRoot').classList.remove('hidden');

  $('#logoMark').innerHTML = ic('shield');
  $('#drawerBtn').innerHTML = ic('menu');
  $$('.close-m').forEach(b => b.innerHTML = ic('x'));
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
  $('#sideUser').innerHTML = avatar(admin.name, 'md') +
    '<div style="min-width:0"><b>' + esc(admin.name) + '</b><span>' + esc(admin.role) + '</span></div>' +
    '<button class="logout" onclick="logout()" aria-label="تسجيل الخروج" title="تسجيل الخروج">' + ic('log-out') + '</button>';

  const unreadMsgs = dbLoad().messages.filter(m => m.status === 'جديد').length;
  const navIcons = { overview:'grid', students:'users', courses:'book-open', finance:'credit-card', quizzes:'target', content:'layers', support:'message', security:'shield' };
  $$('#sideNav a[data-sec]').forEach(a => {
    const sec = a.dataset.sec;
    a.innerHTML = ic(navIcons[sec]) + ' ' + ADM_TITLES[sec] +
      (sec === 'support' && unreadMsgs ? '<span class="nav-count">' + unreadMsgs + '</span>' : '') +
      (sec === 'support' && !unreadMsgs ? '<span class="nav-count" style="display:none"></span>' : '');
  });
  $$('#sideNav a:not([data-sec])').forEach(a => a.innerHTML = ic('arrow-right') + ' عرض الموقع');

  function hasPerm(sec){
    if(admin.main) return true;
    const p = $$('#sideNav a[data-sec]').find(a => a.dataset.sec === sec);
    if(!p) return false;
    const perm = p.dataset.perm;
    return perm === '*' || !!admin.perms[perm];
  }

  function go(sec){
    if(!ADM_TITLES[sec]) sec = 'overview';
    $$('#sideNav a[data-sec]').forEach(a => a.classList.toggle('active', a.dataset.sec === sec));
    $('#appSide').classList.remove('open');
    $('#sideBackdrop').classList.remove('show');
    admin = me();
    if(!admin) return;
    if(!hasPerm(sec)){
      $('#secTitle').textContent = 'صلاحيات';
      $('#secContent').innerHTML = '<div class="perm-denied">' + ic('lock') +
        '<h3>ليس لديك صلاحية الوصول لهذا القسم</h3><p>هذا القسم محجوز للمشرفين المصرح لهم. تواصل مع المدير العام لمنحك الصلاحية.</p></div>';
      return;
    }
    $('#secTitle').textContent = ADM_TITLES[sec];
    renderers[sec]();
    window.scrollTo({ top:0 });
  }
  window.addEventListener('hashchange', () => go(location.hash.replace('#', '')));
  $$('#sideNav a[data-sec]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); location.hash = a.dataset.sec; }));
  $('#drawerBtn').addEventListener('click', () => { $('#appSide').classList.add('open'); $('#sideBackdrop').classList.add('show'); });
  $('#sideBackdrop').addEventListener('click', () => { $('#appSide').classList.remove('open'); $('#sideBackdrop').classList.remove('show'); });

  /* الأقسام الأساسية هنا + أقسام admin-extra.js (المالية/الاختبارات/المحتوى/الدعم/الأمان) */
  const renderers = window.ADM_RENDERERS = Object.assign({}, window.ADM_EXTRA || {}, {

    /* ============ 1) نظرة عامة ============ */
    overview(){
      const st = dbLoad();
      const now = NOW(), month30 = now - 30 * 86400000;
      const newStudents = st.students.filter(x => x.joinedAt >= month30).length;
      const published = st.courses.filter(c => c.published && !c.archived).length;
      const activeEnr = st.students.reduce((a, s2) => a + s2.enrollments.filter(e => e.status === 'active').length, 0);
      const revenue = st.transactions.filter(t => t.status === 'مدفوع').reduce((a, t) => a + t.amount, 0);
      const pending = st.transactions.filter(t => t.status === 'معلق').length;

      $('#secContent').innerHTML =
        '<div class="stat-grid">' +
          admSC('users','bg-blue', fmtNum(st.students.length), 'إجمالي الطلاب', ic('trending','ic-sm') + ' +' + newStudents + ' هذا الشهر') +
          admSC('book-open','bg-teal', fmtNum(published), 'دورات منشورة', ic('layers','ic-sm') + ' ' + st.courses.length + ' إجمالاً') +
          admSC('check-circle','bg-navy', fmtNum(activeEnr), 'اشتراكات نشطة', ic('credit-card','ic-sm') + ' ' + pending + ' بانتظار الدفع') +
          admSC('dollar','bg-amber', fmtNum(revenue) + ' ج.م', 'إجمالي الإيرادات', ic('trending','ic-sm') + ' محصّلة فعلياً') +
        '</div>' +
        '<div class="two-col mt-3">' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('bar-chart') + ' الإيرادات خلال آخر 6 أشهر</h3></div><div class="panel-body"><div class="chart-box" id="revChart"></div></div></div>' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('pie-chart') + ' الاشتراكات حسب التصنيف</h3></div><div class="panel-body"><div class="chart-box" id="catChart"></div></div></div>' +
        '</div>' +
        '<div class="two-col mt-3" style="grid-template-columns:1.4fr 1fr">' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('activity') + ' التسجيلات خلال آخر 14 يوماً</h3></div><div class="panel-body"><div class="chart-box" id="regChart"></div></div></div>' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('zap') + ' آخر الأنشطة الإدارية</h3></div><div class="panel-body"><div class="feed" id="actFeed"></div></div></div>' +
        '</div>' +
        '<div class="panel mt-3"><div class="panel-head"><h3>' + ic('users') + ' أحدث عمليات التسجيل</h3>' +
          '<a class="btn btn-ghost btn-sm" href="#students">كل الطلاب</a></div>' +
          '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr><th>الطالب</th><th>البريد الإلكتروني</th><th>تاريخ الانضمام</th><th>الدورات</th><th>الحالة</th></tr></thead><tbody>' +
          st.students.slice().sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 5).map(x =>
            '<tr><td><div class="cell-main">' + avatar(x.name, 'sm') + x.name + '</div></td><td>' + esc(x.email) + '</td>' +
            '<td>' + fmtDate(x.joinedAt) + '</td><td>' + x.enrollments.length + '</td><td>' + statusBadge(x.active ? 'نشط' : 'موقوف') + '</td></tr>'
          ).join('') + '</tbody></table></div></div></div>';

      /* إيرادات 6 أشهر */
      const labels = [], values = [];
      for(let i = 5; i >= 0; i--){
        const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
        const key = monthKey(dt.getTime());
        labels.push(AR_MONTHS[dt.getMonth()]);
        values.push(st.transactions.filter(t => t.status === 'مدفوع' && monthKey(t.at) === key).reduce((a, t) => a + t.amount, 0));
      }
      barChart($('#revChart'), labels, values, { suffix:' ج.م' });

      /* تصنيفات */
      const catCount = {};
      st.students.forEach(s2 => s2.enrollments.forEach(e => {
        const c = getCourse(e.courseId);
        if(c && e.status === 'active') catCount[c.categoryId] = (catCount[c.categoryId] || 0) + 1;
      }));
      const items = Object.keys(catCount).map((cid, i) => ({ label:getCategory(cid).name, value:catCount[cid], color:PALETTE[i % PALETTE.length] }));
      donutChart($('#catChart'), items.length ? items : [{ label:'لا اشتراكات بعد', value:1, color:'#cbd5e1' }]);

      /* تسجيلات 14 يوم */
      const rLabels = [], rValues = [];
      for(let i = 13; i >= 0; i--){
        const day = new Date(now - i * 86400000);
        rLabels.push(day.getDate() + '/' + (day.getMonth() + 1));
        rValues.push(st.students.filter(s2 => new Date(s2.joinedAt).toDateString() === day.toDateString()).length);
      }
      lineChart($('#regChart'), rLabels, rValues, { color:'#14b8a6' });

      /* الأنشطة */
      $('#actFeed').innerHTML = st.activity.slice(0, 6).map(a => {
        const who = st.admins.find(x => x.id === a.adminId);
        return '<div class="feed-item"><span class="fi">' + ic('zap','ic-sm') + '</span>' +
          '<div><b>' + esc(a.text) + '</b><time>' + esc(who ? who.name : 'النظام') + ' — ' + timeAgo(a.at) + '</time></div></div>';
      }).join('');
    },

    /* ============ 2) إدارة الطلاب ============ */
    students(){
      let query = '';
      render();

      function render(){
        const st = dbLoad();
        const list = st.students.filter(x =>
          !query || x.name.includes(query) || x.email.toLowerCase().includes(query.toLowerCase()));
        $('#secContent').innerHTML =
          '<div class="toolbar">' +
            '<div class="search-box"><span>' + ic('search') + '</span><input type="search" id="stuSearch" placeholder="ابحث بالاسم أو البريد الإلكتروني..." value="' + esc(query) + '"></div>' +
            '<span class="chip">' + ic('users','ic-sm') + ' ' + st.students.length + ' طالب مسجل</span>' +
          '</div>' +
          '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>الطالب</th><th>البريد الإلكتروني</th><th>الهاتف</th><th>تاريخ الانضمام</th><th>الدورات</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
          (list.length ? list.map(x =>
            '<tr><td><div class="cell-main">' + avatar(x.name, 'sm') + '<span>' + esc(x.name) + '</span></div></td>' +
            '<td>' + esc(x.email) + '</td><td>' + esc(x.phone || '—') + '</td><td>' + fmtDate(x.joinedAt) + '</td>' +
            '<td>' + x.enrollments.length + '</td>' +
            '<td><label class="switch" title="تفعيل/إيقاف الحساب"><input type="checkbox" data-active="' + x.id + '" ' + (x.active ? 'checked' : '') + '><span class="track"></span></label></td>' +
            '<td><div class="actions-cell">' +
              '<button class="icon-btn sm" data-view="' + x.id + '" title="عرض الملف">' + ic('eye','ic-sm') + '</button>' +
              '<button class="icon-btn sm" data-edit="' + x.id + '" title="تعديل البيانات">' + ic('edit','ic-sm') + '</button>' +
              '<button class="icon-btn sm danger" data-del="' + x.id + '" title="حذف الطالب">' + ic('trash','ic-sm') + '</button>' +
            '</div></td></tr>'
          ).join('') : '<tr><td colspan="7" class="text-center text-muted" style="padding:34px">لا نتائج مطابقة للبحث</td></tr>') +
          '</tbody></table></div>';

        $('#stuSearch').addEventListener('input', e => { query = e.target.value.trim(); render(); setTimeout(() => { const i = $('#stuSearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 0); });
        $$('[data-active]').forEach(sw => sw.addEventListener('change', () => {
          const x = getStudent(sw.dataset.active);
          x.active = sw.checked; dbSave();
          logActivity((x.active ? 'تفعيل' : 'إيقاف') + ' حساب الطالب "' + x.name + '"');
          toast('تم ' + (x.active ? 'تفعيل' : 'إيقاف') + ' حساب ' + x.name, 'info');
        }));
        $$('[data-view]').forEach(b => b.addEventListener('click', () => viewStudent(b.dataset.view)));
        $$('[data-edit]').forEach(b => b.addEventListener('click', () => editStudent(b.dataset.edit)));
        $$('[data-del]').forEach(b => b.addEventListener('click', () => askDeleteStudent(b.dataset.del)));
      }

      function askDeleteStudent(id){
        const x = getStudent(id); if(!x) return;
        const enrCount = x.enrollments.length;
        const txCount = dbLoad().transactions.filter(t => t.studentId === id).length;
        let detail = '';
        if(enrCount) detail += ' مع اشتراكاته في ' + enrCount + ' دورة (وبنتائج اختباراتها)';
        if(txCount) detail += (enrCount ? ' و' : ' مع ') + txCount + ' عملية دفع';
        confirmAction('حذف الطالب نهائياً',
          'سيتم حذف حساب "' + x.name + '" (' + x.email + ')' + detail + '، مع رسائله وإشعاراته وأسئلته في الدورات. لا يمكن التراجع. هل أنت متأكد؟',
          () => {
            deleteStudent(id);
            logActivity('حذف حساب الطالب "' + x.name + '" نهائياً');
            toast('تم حذف الطالب "' + x.name + '"', 'success');
            render();
          }, 'حذف نهائي');
      }

      function viewStudent(id){
        const x = getStudent(id); if(!x) return;
        const enr = x.enrollments.map(e => ({ e, c:getCourse(e.courseId) })).filter(z => z.c);
        admOpen('الملف الشخصي — ' + x.name,
          '<div class="flex mb-3">' + avatar(x.name, 'lg') + '<div>' +
          '<b style="font-size:17px">' + esc(x.name) + '</b>' + statusBadge(x.active ? 'نشط' : 'موقوف') +
          '<div class="text-muted" style="font-size:13.5px;margin-top:4px">' + esc(x.email) + ' · ' + esc(x.phone || '—') + ' · انضم في ' + fmtDate(x.joinedAt) + '</div></div></div>' +
          '<h4 style="font-size:15px;margin-bottom:10px">الدورات المشترك بها (' + enr.length + ')</h4>' +
          (enr.length ? '<div class="table-wrap"><table class="data" style="min-width:480px"><thead><tr><th>الدورة</th><th>الحالة</th><th>التقدم</th><th>الشهادة</th></tr></thead><tbody>' +
            enr.map(z => '<tr><td>' + esc(z.c.title) + '</td><td>' + statusBadge(ENR_STATUS[z.e.status]) + '</td>' +
            '<td style="min-width:130px"><div class="flex" style="gap:8px">' + progressBar(progressOf(z.e, z.c), true) + '<b style="font-size:12px">' + progressOf(z.e, z.c) + '%</b></div></td>' +
            '<td>' + (z.e.completedAt ? '<span class="badge badge-success">' + ic('check','ic-sm') + ' صدرت</span>' : '—') + '</td></tr>').join('') + '</tbody></table></div>'
          : '<p class="text-muted">لا يشترك الطالب في أي دورة بعد.</p>'),
          '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إغلاق</button>', true);
      }

      function editStudent(id){
        const x = getStudent(id); if(!x) return;
        admOpen('تعديل بيانات الطالب — ' + x.name,
          '<div class="field"><label>الاسم</label><input id="esName" value="' + esc(x.name) + '"></div>' +
          '<div class="form-grid"><div class="field"><label>البريد الإلكتروني</label><input id="esEmail" value="' + esc(x.email) + '"></div>' +
          '<div class="field"><label>الهاتف</label><input id="esPhone" value="' + esc(x.phone || '') + '"></div></div>' +
          '<label class="check-row"><input type="checkbox" id="esActive" ' + (x.active ? 'checked' : '') + '> الحساب مفعّل ويمكنه تسجيل الدخول</label>',
          '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إلغاء</button>' +
          '<button class="btn btn-primary" id="esSave">حفظ التعديلات</button>');
        $('#esSave').addEventListener('click', () => {
          const nm = $('#esName').value.trim(), em = $('#esEmail').value.trim(), ph = $('#esPhone').value.trim();
          if(nm.length < 3){ toast('الاسم قصير جداً', 'error'); return; }
          const st = dbLoad();
          if(st.students.some(o => o.id !== id && o.email.toLowerCase() === em.toLowerCase())){ toast('البريد مستخدم من طالب آخر', 'error'); return; }
          const wasActive = x.active;
          x.name = nm; x.email = em; x.phone = ph; x.active = $('#esActive').checked;
          dbSave();
          if(wasActive !== x.active) logActivity((x.active ? 'تفعيل' : 'إيقاف') + ' حساب الطالب "' + nm + '"');
          else logActivity('تعديل بيانات الطالب "' + nm + '"');
          closeModal('admModal'); toast('تم حفظ التعديلات', 'success'); render();
        });
      }
    },

    /* ============ 3) إدارة الدورات ============ */
    courses(){
      render();

      function render(){
        const st = dbLoad();
        $('#secContent').innerHTML =
          '<div class="toolbar">' +
            '<span class="chip">' + ic('book-open','ic-sm') + ' ' + st.courses.length + ' دورة</span>' +
            '<span class="chip">' + st.courses.filter(c => c.published && !c.archived).length + ' منشورة</span>' +
            '<span class="chip">' + st.courses.filter(c => c.archived).length + ' مؤرشفة</span>' +
            '<button class="btn btn-primary btn-sm" id="addCourseBtn" style="margin-inline-start:auto">' + ic('plus','ic-sm') + ' إضافة دورة جديدة</button>' +
          '</div>' +
          '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>الدورة</th><th>التصنيف</th><th>المحاضر</th><th>الدروس</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
          st.courses.map(c => {
            const cat = getCategory(c.categoryId);
            const status = c.archived ? 'مؤرشف' : (c.published ? 'منشورة' : 'مسودة');
            return '<tr><td><div class="cell-main"><span style="width:44px;height:34px;border-radius:9px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,' + cat.g1 + ',' + cat.g2 + ')">' + ic(cat.icon,'ic-sm') + '</span>' +
              '<span style="max-width:260px">' + esc(c.title) + '</span></div></td>' +
              '<td>' + esc(cat.name) + '</td><td>' + esc(getInstructor(c.instructorId).name) + '</td>' +
              '<td>' + c.lessons.length + '</td><td>' + fmtPrice(c.price) + '</td>' +
              '<td>' + statusBadge(status) + '</td>' +
              '<td><div class="actions-cell">' +
                '<button class="icon-btn sm" data-editc="' + c.id + '" title="تعديل بيانات الدورة">' + ic('edit','ic-sm') + '</button>' +
                '<button class="icon-btn sm" data-lessons="' + c.id + '" title="إدارة الدروس">' + ic('list','ic-sm') + '</button>' +
                '<button class="icon-btn sm" data-pub="' + c.id + '" title="' + (c.published ? 'إلغاء النشر' : 'نشر الدورة') + '">' + ic(c.published ? 'eye-off' : 'eye','ic-sm') + '</button>' +
                '<button class="icon-btn sm" data-arch="' + c.id + '" title="أرشفة">' + ic('archive','ic-sm') + '</button>' +
                '<button class="icon-btn sm danger" data-delc="' + c.id + '" title="حذف">' + ic('trash','ic-sm') + '</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>';

        $('#addCourseBtn').addEventListener('click', () => editCourse(null));
        $$('[data-editc]').forEach(b => b.addEventListener('click', () => editCourse(b.dataset.editc)));
        $$('[data-pub]').forEach(b => b.addEventListener('click', () => {
          const c = getCourse(b.dataset.pub); c.published = !c.published; dbSave();
          logActivity((c.published ? 'نشر' : 'إلغاء نشر') + ' دورة "' + c.title + '"');
          toast(c.published ? 'تم نشر الدورة' : 'أصبحت الدورة مسودة', 'info'); render();
        }));
        $$('[data-arch]').forEach(b => b.addEventListener('click', () => {
          const c = getCourse(b.dataset.arch); c.archived = !c.archived; dbSave();
          logActivity((c.archived ? 'أرشفة' : 'استعادة') + ' دورة "' + c.title + '"');
          toast(c.archived ? 'تمت أرشفة الدورة' : 'تمت استعادة الدورة', 'info'); render();
        }));
        $$('[data-delc]').forEach(b => b.addEventListener('click', () => {
          const c = getCourse(b.dataset.delc);
          const enrolled = dbLoad().students.filter(s2 => s2.enrollments.some(e => e.courseId === c.id)).length;
          confirmAction('حذف الدورة نهائياً', 'سيتم حذف "' + c.title + '" وكل اشتراكات الطلاب فيها (' + enrolled + ' طالب). لا يمكن التراجع. هل أنت متأكد؟', () => {
            const st = dbLoad();
            st.courses = st.courses.filter(x => x.id !== c.id);
            st.quizzes = st.quizzes.filter(q => q.courseId !== c.id);
            st.courseQA = st.courseQA.filter(q => q.courseId !== c.id);
            st.transactions = st.transactions.filter(t => t.courseId !== c.id);
            st.students.forEach(s2 => s2.enrollments = s2.enrollments.filter(e => e.courseId !== c.id));
            dbSave();
            logActivity('حذف دورة "' + c.title + '" نهائياً');
            toast('تم حذف الدورة', 'success'); render();
          }, 'حذف نهائي');
        }));
        $$('[data-lessons]').forEach(b => b.addEventListener('click', () => lessonsManager(b.dataset.lessons)));
      }

      /* نموذج إضافة/تعديل دورة */
      function editCourse(id){
        const st = dbLoad();
        const c = id ? getCourse(id) : {
          id:uid('co'), title:'', desc:'', longDesc:'', categoryId:st.categories[0].id, level:'مبتدئ',
          instructorId:st.instructors[0].id, price:0, rating:0, ratingCount:0, studentsCount:0,
          published:false, archived:false, createdAt:NOW(), outcomes:[], lessons:[]
        };
        admOpen(id ? 'تعديل بيانات الدورة' : 'إضافة دورة جديدة',
          '<div class="field"><label>عنوان الدورة <span class="req">*</span></label><input id="cfTitle" value="' + esc(c.title) + '" placeholder="مثال: أساسيات التصميم الجرافيكي"></div>' +
          '<div class="field"><label>وصف مختصر (يظهر في البطاقات)</label><input id="cfDesc" value="' + esc(c.desc) + '"></div>' +
          '<div class="field"><label>وصف تفصيلي</label><textarea id="cfLong" style="min-height:80px">' + esc(c.longDesc || '') + '</textarea></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>التصنيف</label><select id="cfCat">' + st.categories.map(ct => '<option value="' + ct.id + '" ' + (ct.id === c.categoryId ? 'selected' : '') + '>' + esc(ct.name) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label>المستوى</label><select id="cfLevel">' + ['مبتدئ','متوسط','متقدم'].map(l => '<option ' + (l === c.level ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
            '<div class="field"><label>المحاضر</label><select id="cfInst">' + st.instructors.map(i => '<option value="' + i.id + '" ' + (i.id === c.instructorId ? 'selected' : '') + '>' + esc(i.name) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label>السعر بالجنيه (0 = مجاني)</label><input type="number" id="cfPrice" min="0" value="' + c.price + '"></div>' +
          '</div>' +
          '<div class="field"><label>ماذا سيتعلم الطالب؟ (مخرج في كل سطر)</label><textarea id="cfOut" style="min-height:70px">' + esc((c.outcomes || []).join('\n')) + '</textarea></div>' +
          '<label class="check-row"><input type="checkbox" id="cfPub" ' + (c.published ? 'checked' : '') + '> نشر الدورة وتوفيرها للطلاب فوراً</label>',
          '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إلغاء</button>' +
          '<button class="btn btn-primary" id="cfSave">حفظ الدورة</button>', true);
        $('#cfSave').addEventListener('click', () => {
          const title = $('#cfTitle').value.trim();
          if(title.length < 5){ toast('العنوان قصير جداً (5 أحرف على الأقل)', 'error'); return; }
          const exists = st.courses.some(x => x.id === c.id);
          c.title = title;
          c.desc = $('#cfDesc').value.trim();
          c.longDesc = $('#cfLong').value.trim();
          c.categoryId = $('#cfCat').value;
          c.level = $('#cfLevel').value;
          c.instructorId = $('#cfInst').value;
          c.price = Math.max(0, +$('#cfPrice').value || 0);
          c.outcomes = $('#cfOut').value.split('\n').map(s2 => s2.trim()).filter(Boolean);
          c.published = $('#cfPub').checked;
          if(!exists) st.courses.push(c);
          dbSave();
          logActivity((exists ? 'تعديل' : 'إضافة') + ' دورة "' + c.title + '"');
          closeModal('admModal'); toast('تم حفظ الدورة', 'success'); render();
        });
      }

      /* مدير الدروس */
      function lessonsManager(id){
        const c = getCourse(id); if(!c) return;
        function body(){
          return '<p class="mini-note mb-2">' + ic('info') + ' تنظيم دروس "' + esc(c.title) + '" — عدّل الترتيب والمدة وروابط الفيديو والملفات المرفقة.</p>' +
            c.lessons.map((l, i) =>
              '<div class="lesson-edit-row" data-li="' + l.id + '">' +
              '<div class="le-head"><span class="order">' + (i + 1) + '</span><span>' + esc(l.title) + '</span>' +
              '<span class="le-actions">' +
                '<button class="icon-btn sm" data-up="' + l.id + '" ' + (i === 0 ? 'disabled' : '') + ' title="لأعلى">' + ic('up','ic-sm') + '</button>' +
                '<button class="icon-btn sm" data-dn="' + l.id + '" ' + (i === c.lessons.length - 1 ? 'disabled' : '') + ' title="لأسفل">' + ic('down','ic-sm') + '</button>' +
                '<button class="icon-btn sm danger" data-dell="' + l.id + '" title="حذف الدرس">' + ic('trash','ic-sm') + '</button>' +
              '</span></div>' +
              '<div class="form-grid">' +
                '<div class="field"><label>عنوان الدرس</label><input data-f="title" value="' + esc(l.title) + '"></div>' +
                '<div class="field"><label>المدة (دقائق)</label><input type="number" min="1" data-f="duration" value="' + l.duration + '"></div>' +
                '<div class="field full"><label>رابط الفيديو (mp4)</label><input data-f="video" value="' + esc(l.video || '') + '" placeholder="https://..."></div>' +
                '<div class="field full"><label>وصف الدرس</label><input data-f="desc" value="' + esc(l.desc || '') + '"></div>' +
                '<div class="field"><label>اسم الملف المرفق (اختياري)</label><input data-f="fname" value="' + esc(l.file ? l.file.name : '') + '"></div>' +
                '<div class="field"><label>حجم الملف</label><input data-f="fsize" value="' + esc(l.file ? l.file.size : '') + '" placeholder="1.2 MB"></div>' +
              '</div></div>'
            ).join('') +
            '<button class="btn btn-outline btn-sm" id="addLessonBtn">' + ic('plus','ic-sm') + ' إضافة درس جديد</button>';
        }
        admOpen('إدارة دروس الدورة', body(),
          '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إغلاق</button>' +
          '<button class="btn btn-primary" id="lessonsSave">حفظ جميع التغييرات</button>', true, true);
        $('#addLessonBtn').addEventListener('click', () => {
          c.lessons.push({ id:uid('l'), title:'درس جديد', duration:10, video:'', desc:'', file:null });
          dbSave();
          $('#admBody').innerHTML = body(); bindRows();
          toast('أضف بيانات الدرس ثم اضغط حفظ', 'info');
        });
        function bindRows(){
          $$('[data-up]').forEach(b => b.addEventListener('click', () => {
            const i = c.lessons.findIndex(l => l.id === b.dataset.up);
            if(i > 0){ [c.lessons[i - 1], c.lessons[i]] = [c.lessons[i], c.lessons[i - 1]]; dbSave(); $('#admBody').innerHTML = body(); bindRows(); }
          }));
          $$('[data-dn]').forEach(b => b.addEventListener('click', () => {
            const i = c.lessons.findIndex(l => l.id === b.dataset.dn);
            if(i < c.lessons.length - 1){ [c.lessons[i + 1], c.lessons[i]] = [c.lessons[i], c.lessons[i + 1]]; dbSave(); $('#admBody').innerHTML = body(); bindRows(); }
          }));
          $$('[data-dell]').forEach(b => b.addEventListener('click', () => {
            c.lessons = c.lessons.filter(l => l.id !== b.dataset.dell);
            dbSave(); $('#admBody').innerHTML = body(); bindRows();
            toast('تم حذف الدرس (اضغط حفظ للتثبيت)', 'info');
          }));
        }
        bindRows();
        $('#lessonsSave').addEventListener('click', () => {
          c.lessons.forEach(l => {
            const row = document.querySelector('[data-li="' + l.id + '"]');
            if(!row) return;
            l.title = row.querySelector('[data-f="title"]').value.trim() || l.title;
            l.duration = Math.max(1, +row.querySelector('[data-f="duration"]').value || 1);
            l.video = row.querySelector('[data-f="video"]').value.trim();
            l.desc = row.querySelector('[data-f="desc"]').value.trim();
            const fn = row.querySelector('[data-f="fname"]').value.trim();
            const fs = row.querySelector('[data-f="fsize"]').value.trim();
            l.file = fn ? { name:fn, size:fs || '—' } : null;
          });
          /* تطبيق التقدم على الطلاب: إزالة أي تقدم لدرس محذوف */
          dbLoad().students.forEach(s2 => s2.enrollments.forEach(e => {
            if(e.courseId === c.id) e.progress = e.progress.filter(pid => c.lessons.some(l => l.id === pid));
          }));
          dbSave();
          logActivity('تحديث دروس دورة "' + c.title + '"');
          closeModal('admModal'); toast('تم حفظ جميع الدروس', 'success'); render();
        });
      }
    }
  });

  /* البدء */
  go(location.hash.replace('#', '') || 'overview');
})();
