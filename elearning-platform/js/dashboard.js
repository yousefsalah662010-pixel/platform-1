/* ============================================================
   منصة طاهر البيلي — لوحة الطالب
   ============================================================ */
let student = null;

const SEC_TITLES = {
  overview:'نظرة عامة', courses:'دوراتي', quizzes:'الاختبارات', certificates:'شهاداتي',
  subscriptions:'سجل الاشتراكات', notifications:'الإشعارات', support:'الدعم الفني', settings:'إعدادات الحساب'
};

(function(){
  applyTheme();
  dbLoad();
  const s = getSession();
  student = (s && s.role === 'student') ? me() : null;
  if(!student){ location.href = 'login.html'; return; }

  $('#logoMark').innerHTML = ic('grad-cap');
  $('#drawerBtn').innerHTML = ic('menu');
  $$('.close-m').forEach(b => b.innerHTML = ic('x'));
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
  $('#sideUser').innerHTML = avatar(student.name, 'md') +
    '<div style="min-width:0"><b>' + esc(student.name) + '</b><span>طالب</span></div>' +
    '<button class="logout" onclick="logout()" aria-label="تسجيل الخروج" title="تسجيل الخروج">' + ic('log-out') + '</button>';

  /* عناصر القائمة الجانبية */
  const unread = unreadNotifs(student.id);
  const navIcons = { overview:'grid', courses:'book-open', quizzes:'target', certificates:'award', subscriptions:'credit-card', notifications:'bell', support:'message', settings:'settings' };
  $$('#sideNav a[data-sec]').forEach(a => {
    const sec = a.dataset.sec;
    a.innerHTML = ic(navIcons[sec]) + ' ' + SEC_TITLES[sec] + (sec === 'notifications' && unread ? '<span class="nav-count">' + unread + '</span>' : '') + (sec === 'notifications' && !unread ? '<span class="nav-count hidden"></span>' : '');
    if(sec === 'notifications' && !unread){ const c = a.querySelector('.nav-count'); if(c) c.style.display = 'none'; }
  });
  $$('#sideNav a:not([data-sec])').forEach(a => {
    a.innerHTML = a.getAttribute('href').includes('courses') ? ic('search') + ' استكشف الدورات' : ic('arrow-right') + ' الصفحة الرئيسية';
  });

  const navLabels = { 'استكشف الدورات':'courses.html', 'الصفحة الرئيسية':'index.html' };

  /* تنقل داخلي */
  function go(sec){
    if(!SEC_TITLES[sec]) sec = 'overview';
    $('#secTitle').textContent = SEC_TITLES[sec];
    $$('#sideNav a[data-sec]').forEach(a => a.classList.toggle('active', a.dataset.sec === sec));
    student = me();
    renderers[sec]();
    $('#appSide').classList.remove('open');
    $('#sideBackdrop').classList.remove('show');
    window.scrollTo({ top:0 });
  }
  window.addEventListener('hashchange', () => go(location.hash.replace('#', '')));
  $$('#sideNav a[data-sec]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); location.hash = a.dataset.sec; }));

  $('#drawerBtn').addEventListener('click', () => { $('#appSide').classList.add('open'); $('#sideBackdrop').classList.add('show'); });
  $('#sideBackdrop').addEventListener('click', () => { $('#appSide').classList.remove('open'); $('#sideBackdrop').classList.remove('show'); });

  /* ---------- الأقسام ---------- */
  const renderers = {

    overview(){
      const enr = student.enrollments.map(e => ({ e, c:getCourse(e.courseId) })).filter(x => x.c);
      const active = enr.filter(x => x.e.status === 'active' && !x.e.completedAt);
      const done = enr.filter(x => x.e.completedAt);
      let minutes = 0;
      enr.forEach(x => x.e.progress.forEach(lid => {
        const l = x.c.lessons.find(l => l.id === lid); if(l) minutes += +l.duration || 0;
      }));
      $('#secContent').innerHTML =
        '<div class="stat-grid">' +
          sc('book-open','bg-blue', fmtNum(enr.length), 'إجمالي دوراتي') +
          sc('check-circle','bg-teal', fmtNum(done.length), 'دورات مكتملة') +
          sc('clock','bg-amber', fmtNum(Math.round(minutes / 60)), 'ساعة تعلم') +
          sc('award','bg-violet', fmtNum(done.length), 'شهادات حصلت عليها') +
        '</div>' +
        '<div class="two-col mt-3">' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('play-circle') + ' تابع التعلم من حيث توقفت</h3>' +
            '<a class="btn btn-ghost btn-sm" href="courses.html">استكشف المزيد</a></div><div class="panel-body" id="contArea"></div></div>' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('bell') + ' أحدث الإشعارات</h3></div><div class="panel-body" id="ovNotifs"></div></div>' +
        '</div>';
      $('#contArea').innerHTML = active.length
        ? active.map(x => {
            const pct = progressOf(x.e, x.c);
            const nextL = x.c.lessons.find(l => !x.e.progress.includes(l.id)) || x.c.lessons[0];
            const cat = getCategory(x.c.categoryId);
            return '<div class="continue-card"><div class="cc-cov" style="--g1:' + cat.g1 + ';--g2:' + cat.g2 + '">' + ic(cat.icon) + '</div>' +
              '<div style="flex:1;min-width:0"><b>' + esc(x.c.title) + '</b><span class="sub">الدرس التالي: ' + esc(nextL.title) + '</span>' +
              '<div class="mt-1">' + progressBar(pct, true) + '</div></div>' +
              '<a class="btn btn-primary btn-sm" href="lesson.html?course=' + x.c.id + '&lesson=' + nextL.id + '">' + (pct ? 'متابعة' : 'ابدأ') + '</a></div>';
          }).join('')
        : '<div class="empty-state" style="padding:26px">' + ic('book-open') + '<h3 style="font-size:15px">لا توجد دورات قيد التعلم</h3><p style="font-size:13.5px">ابدأ رحلتك واختر دورتك الأولى الآن.</p>' +
          '<a class="btn btn-primary btn-sm mt-2" href="courses.html">تصفح الدورات</a></div>';
      const notifs = dbLoad().notifications.filter(n => n.studentId === student.id).slice(0, 4);
      $('#ovNotifs').innerHTML = notifs.length
        ? notifs.map(n => notifHtml(n)).join('')
        : '<p class="text-muted" style="font-size:14px">لا إشعارات حتى الآن.</p>';
    },

    courses(){
      const enr = student.enrollments.map(e => ({ e, c:getCourse(e.courseId) })).filter(x => x.c);
      $('#secContent').innerHTML = enr.length
        ? '<div class="grid-2" id="myGrid"></div>'
        : '<div class="empty-state">' + ic('book-open') + '<h3>لم تشترك في أي دورة بعد</h3><p>اختر دورتك الأولى وابدأ رحلة التعلم.</p><a class="btn btn-primary mt-2" href="courses.html">تصفح الدورات</a></div>';
      const grid = $('#myGrid');
      if(!grid) return;
      grid.innerHTML = enr.map(x => {
        const c = x.c, e = x.e, cat = getCategory(c.categoryId), pct = progressOf(e, c);
        return '<div class="my-course-card">' +
          '<div class="my-cover" style="--g1:' + cat.g1 + ';--g2:' + cat.g2 + '">' + ic(cat.icon) + '</div>' +
          '<div class="my-info"><h3>' + esc(c.title) + '</h3>' +
            '<div class="meta"><span>' + ic('play-circle','ic-sm') + e.progress.length + '/' + c.lessons.length + ' دروس</span>' +
            '<span>' + ic('clock','ic-sm') + fmtDur(courseMinutes(c)) + '</span>' +
            '<span>' + ic('calendar','ic-sm') + fmtDate(e.at) + '</span></div>' +
            '<div class="flex-between" style="font-size:12.5px;font-weight:800;margin-bottom:5px"><span>التقدم</span><span style="color:var(--secondary)">' + pct + '%</span></div>' +
            progressBar(pct, true) + '</div>' +
          '<div class="my-actions">' + statusBadge(ENR_STATUS[e.status]) +
            (e.status === 'active' ? '<a class="btn btn-primary btn-sm btn-block" href="lesson.html?course=' + c.id + '">' + (pct ? 'متابعة التعلم' : 'ابدأ الدورة') + '</a>' : '') +
            (e.status === 'pending' ? '<span class="text-muted" style="font-size:12.5px;text-align:center">بانتظار تأكيد الإدارة للدفع</span>' : '') +
            (e.completedAt ? '<a class="btn btn-accent btn-sm btn-block" href="certificate.html?s=' + student.id + '&c=' + c.id + '" target="_blank">' + ic('award','ic-sm') + ' شهادتي</a>' : '') +
          '</div></div>';
      }).join('');
    },

    quizzes(){
      const myCourses = student.enrollments.filter(e => e.status === 'active').map(e => e.courseId);
      const quizzes = dbLoad().quizzes.filter(q => myCourses.includes(q.courseId));
      $('#secContent').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('target') + ' الاختبارات المتاحة لك</h3></div><div class="panel-body" id="qzArea"></div></div>';
      const area = $('#qzArea');
      if(!quizzes.length){
        area.innerHTML = '<div class="empty-state">' + ic('target') + '<h3>لا توجد اختبارات متاحة</h3><p>تظهر هنا اختبارات الدورات التي تشترك بها.</p></div>';
        return;
      }
      area.innerHTML = quizzes.map(q => {
        const c = getCourse(q.courseId);
        const results = student.enrollments.filter(e => e.courseId === q.courseId)[0].quizResults.filter(r => r.quizId === q.id);
        const best = results.length ? Math.max(...results.map(r => r.score)) : null;
        return '<div class="ann-row" style="align-items:center">' +
          '<span class="fi" style="width:44px;height:44px;border-radius:12px;background:var(--info-bg);color:var(--secondary);display:flex;align-items:center;justify-content:center">' + ic('target') + '</span>' +
          '<div style="flex:1"><b style="font-size:15px">' + esc(q.title) + '</b>' +
          '<span style="display:block;font-size:12.5px;color:var(--text-2)">دورة: ' + esc(c.title) + ' — ' + q.questions.length + ' أسئلة — النجاح من ' + q.passGrade + '% — ' + q.durationMin + ' دقيقة</span></div>' +
          (best != null ? statusBadge(best >= q.passGrade ? 'نشط' : 'راسب') + '<span style="font-weight:900;font-size:18px;color:' + (best >= q.passGrade ? 'var(--success)' : 'var(--danger)') + '">' + best + '%</span>' : '') +
          '<button class="btn btn-primary btn-sm" data-quiz="' + q.id + '">' + (results.length ? 'إعادة المحاولة' : 'ابدأ الاختبار') + '</button></div>';
      }).join('');
      $$('[data-quiz]').forEach(b => b.addEventListener('click', () => openQuiz(b.dataset.quiz)));
    },

    certificates(){
      const done = student.enrollments.filter(e => e.completedAt).map(e => ({ e, c:getCourse(e.courseId) }));
      $('#secContent').innerHTML = done.length
        ? '<div class="grid-3">' + done.map(x =>
            '<div class="cert-card"><div class="ci">' + ic('award','ic-lg') + '</div>' +
            '<h3>' + esc(x.c.title) + '</h3>' +
            '<div class="date">أُكملت في ' + fmtDate(x.e.completedAt) + '</div>' +
            '<a class="btn btn-primary btn-sm btn-block" href="certificate.html?s=' + student.id + '&c=' + x.c.id + '" target="_blank">' + ic('eye','ic-sm') + ' عرض وطباعة الشهادة</a></div>'
          ).join('') + '</div>'
        : '<div class="empty-state">' + ic('award') + '<h3>لا توجد شهادات بعد</h3><p>أكمل جميع دروس أي دورة وستصدر شهادتك تلقائياً باسمك.</p><a class="btn btn-primary mt-2" href="courses.html">تصفح الدورات</a></div>';
    },

    subscriptions(){
      const enr = student.enrollments.map(e => ({ e, c:getCourse(e.courseId) })).filter(x => x.c);
      $('#secContent').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('credit-card') + ' سجل اشتراكاتك ودفعاتك</h3></div>' +
        '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>الدورة</th><th>تاريخ الاشتراك</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th><th></th></tr></thead><tbody>' +
        (enr.length ? enr.map(x =>
          '<tr><td><div class="cell-main">' + avatar(x.c.title.slice(0, 2), 'sm') + '<span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.c.title) + '</span></div></td>' +
          '<td>' + fmtDate(x.e.at) + '</td><td>' + (x.e.amount ? fmtPrice(x.e.amount) : '—') + '</td><td>' + esc(x.e.method || '—') + '</td>' +
          '<td>' + statusBadge(ENR_STATUS[x.e.status]) + '</td>' +
          '<td><a class="btn btn-ghost btn-sm" href="lesson.html?course=' + x.c.id + '">عرض</a></td></tr>'
        ).join('') : '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">لا توجد اشتراكات بعد</td></tr>') +
        '</tbody></table></div></div></div>';
    },

    notifications(){
      const list = dbLoad().notifications.filter(n => n.studentId === student.id);
      $('#secContent').innerHTML =
        '<div class="panel"><div class="panel-head"><h3>' + ic('bell') + ' جميع الإشعارات (' + list.length + ')</h3>' +
        '<button class="btn btn-ghost btn-sm" id="readAllBtn">تعليم الكل كمقروء</button></div><div class="panel-body" id="ntArea"></div></div>';
      const area = $('#ntArea');
      area.innerHTML = list.length ? list.map(n => notifHtml(n)).join('')
        : '<div class="empty-state">' + ic('bell') + '<h3>لا إشعارات بعد</h3></div>';
      $('#readAllBtn').addEventListener('click', () => {
        dbLoad().notifications.forEach(n => { if(n.studentId === student.id) n.read = true; });
        dbSave(); toast('تم تعليم جميع الإشعارات كمقروءة', 'info');
        $('#notifCount') && ($('#notifCount').style.display = 'none');
        renderers.notifications();
      });
    },

    support(){
      const msgs = dbLoad().messages.filter(m => m.studentId === student.id);
      $('#secContent').innerHTML =
        '<div class="two-col">' +
        '<div class="panel"><div class="panel-head"><h3>' + ic('send') + ' أرسل رسالة للدعم الفني</h3></div><div class="panel-body">' +
          '<div class="field"><label>الموضوع <span class="req">*</span></label><input type="text" id="supSubject" placeholder="ملخص المشكلة أو الاستفسار"></div>' +
          '<div class="field"><label>تفاصيل الرسالة <span class="req">*</span></label><textarea id="supBody" placeholder="اشرح المشكلة بالتفصيل ليتمكن الفريق من مساعدتك..."></textarea></div>' +
          '<button class="btn btn-primary" id="supSend">' + ic('send','ic-sm') + ' إرسال الرسالة</button>' +
        '</div></div>' +
        '<div class="panel"><div class="panel-head"><h3>' + ic('message') + ' محادثاتك (' + msgs.length + ')</h3></div><div class="panel-body" id="msgArea"></div></div>' +
        '</div>';
      $('#msgArea').innerHTML = msgs.length
        ? msgs.map(m => '<div class="notif-item ' + (m.status === 'جديد' ? '' : '') + '" style="cursor:pointer" data-thread="' + m.id + '">' +
            '<span class="ni-icon">' + ic('message') + '</span><div style="flex:1"><b>' + esc(m.subject) + '</b><p>' + esc(m.body.slice(0, 70)) + (m.body.length > 70 ? '…' : '') + '</p></div>' +
            '<div style="text-align:left">' + statusBadge(m.status) + '<time style="display:block;margin-top:6px">' + timeAgo(m.at) + '</time></div></div>'
          ).join('')
        : '<p class="text-muted" style="font-size:14px">لا محادثات سابقة.</p>';
      $('#supSend').addEventListener('click', () => {
        const sub = $('#supSubject').value.trim(), body = $('#supBody').value.trim();
        if(sub.length < 4 || body.length < 10){ toast('أكمل الموضوع وتفاصيل الرسالة (10 أحرف على الأقل)', 'error'); return; }
        addSupportMessage(student.id, sub, body);
        toast('تم إرسال رسالتك، سيرد عليك الفريق خلال 24 ساعة', 'success');
        renderers.support();
      });
      $$('[data-thread]').forEach(el => el.addEventListener('click', () => openThread(el.dataset.thread)));
    },

    settings(){
      $('#secContent').innerHTML =
        '<div class="two-col">' +
        '<div class="panel"><div class="panel-head"><h3>' + ic('user') + ' البيانات الشخصية</h3></div><div class="panel-body">' +
          '<div class="flex mb-3">' + avatar(student.name, 'lg') + '<div><b style="font-size:16px">' + esc(student.name) + '</b><div class="text-muted" style="font-size:13px">' + esc(student.email) + '</div></div></div>' +
          '<div class="field"><label>الاسم الكامل</label><input type="text" id="pfName" value="' + esc(student.name) + '"></div>' +
          '<div class="field"><label>رقم الهاتف</label><input type="tel" id="pfPhone" value="' + esc(student.phone || '') + '"></div>' +
          '<div class="field"><label>البريد الإلكتروني</label><input type="email" value="' + esc(student.email) + '" disabled></div>' +
          '<p class="mini-note mb-2">' + ic('info') + ' لا يمكن تغيير البريد الإلكتروني في النسخة التجريبية.</p>' +
          '<button class="btn btn-primary" id="pfSave">حفظ التعديلات</button>' +
        '</div></div>' +
        '<div class="panel"><div class="panel-head"><h3>' + ic('lock') + ' تغيير كلمة المرور</h3></div><div class="panel-body">' +
          '<div class="field"><label>كلمة المرور الحالية</label><input type="password" id="pwOld"></div>' +
          '<div class="field"><label>كلمة المرور الجديدة</label><input type="password" id="pwNew"></div>' +
          '<div class="field"><label>تأكيد كلمة المرور الجديدة</label><input type="password" id="pwNew2"></div>' +
          '<button class="btn btn-dark" id="pwSave">تحديث كلمة المرور</button>' +
        '</div></div>' +
        '</div>';
      $('#pfSave').addEventListener('click', () => {
        const nm = $('#pfName').value.trim(), ph = $('#pfPhone').value.trim();
        if(nm.length < 3){ toast('الاسم قصير جداً', 'error'); return; }
        student.name = nm; student.phone = ph; dbSave();
        $('#sideUser').innerHTML = avatar(nm, 'md') + '<div style="min-width:0"><b>' + esc(nm) + '</b><span>طالب</span></div>' +
          '<button class="logout" onclick="logout()" aria-label="تسجيل الخروج">' + ic('log-out') + '</button>';
        toast('تم حفظ بياناتك بنجاح', 'success');
      });
      $('#pwSave').addEventListener('click', () => {
        const o = $('#pwOld').value, n1 = $('#pwNew').value, n2 = $('#pwNew2').value;
        if(o !== student.password){ toast('كلمة المرور الحالية غير صحيحة', 'error'); return; }
        if(n1.length < 6){ toast('كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)', 'error'); return; }
        if(n1 !== n2){ toast('التأكيد غير مطابق', 'error'); return; }
        student.password = n1; dbSave();
        toast('تم تحديث كلمة المرور بنجاح', 'success');
        $('#pwOld').value = $('#pwNew').value = $('#pwNew2').value = '';
      });
    }
  };

  /* ---------- أدوات ---------- */
  function sc(icon, bg, val, label){
    return '<div class="stat-card"><div class="sc-top"><span class="sc-icon ' + bg + '">' + ic(icon,'ic-lg') + '</span></div>' +
      '<div class="sc-val">' + val + '</div><div class="sc-label">' + label + '</div></div>';
  }
  function notifHtml(n){
    return '<div class="notif-item' + (n.read ? '' : ' unread') + '"><span class="ni-icon ' + (n.type === 'success' ? 'success' : n.type === 'warn' ? 'warn' : '') + '">' +
      ic(n.type === 'success' ? 'check-circle' : n.type === 'warn' ? 'clock' : 'bell') + '</span>' +
      '<div style="flex:1"><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p></div><time>' + timeAgo(n.at) + '</time></div>';
  }
  window._renderersRef = renderers;

  /* نافذة الاختبار */
  function openQuiz(qid){
    const q = getQuiz(qid); if(!q) return;
    $('#qmTitle').textContent = q.title;
    $('#qmBody').innerHTML =
      '<p class="mini-note mb-2">' + ic('info') + ' ' + q.questions.length + ' أسئلة — اختر إجابة واحدة لكل سؤال — النجاح من ' + q.passGrade + '%</p>' +
      q.questions.map((qq, i) =>
        '<div class="q-edit"><b style="font-size:14.5px">' + (i + 1) + '. ' + esc(qq.q) + '</b>' +
        '<div class="opts-grid">' + qq.options.map((op, j) =>
          '<label class="opt-row"><input type="radio" name="qq' + i + '" value="' + j + '"><span>' + esc(op) + '</span></label>'
        ).join('') + '</div></div>'
      ).join('');
    $('#qmSubmit').onclick = () => {
      const answers = q.questions.map((qq, i) => {
        const sel = document.querySelector('input[name="qq' + i + '"]:checked');
        return sel ? +sel.value : -1;
      });
      if(answers.includes(-1)){ toast('أجب على جميع الأسئلة أولاً', 'error'); return; }
      const res = submitQuiz(student.id, q.id, answers);
      closeModal('quizModal');
      if(res){
        toast('نتيجتك: ' + res.score + '% — ' + (res.passed ? 'ناجح، أحسنت!' : 'لم تحقق درجة النجاح، حاول مجدداً'), res.passed ? 'success' : 'error');
        renderers.quizzes();
      }
    };
    openModal('quizModal');
  }

  /* نافذة محادثة الدعم */
  let curThread = null;
  function openThread(mid){
    const m = dbLoad().messages.find(x => x.id === mid); if(!m) return;
    curThread = m;
    $('#tmTitle').textContent = m.subject;
    $('#tmBody').innerHTML =
      '<div class="qa-item"><div class="qa-head"><b>رسالتك</b><time>' + fmtDate(m.at) + '</time></div><p>' + esc(m.body) + '</p></div>' +
      '<div style="margin:10px 0">' + statusBadge(m.status) + '</div>' +
      m.replies.map(r => '<div class="qa-reply"><b>' + esc(r.by) + ' — ' + fmtDate(r.at) + '</b><br>' + esc(r.text) + '</div>').join('');
    openModal('threadModal');
  }
  $('#tmSend').innerHTML = ic('send','ic-sm');
  $('#tmSend').addEventListener('click', () => {
    const txt = $('#tmReply').value.trim();
    if(!curThread || txt.length < 2){ toast('اكتب رداً أولاً', 'error'); return; }
    curThread.replies.push({ by:student.name, text:txt, at:NOW() });
    curThread.status = 'قيد المعالجة';
    dbSave();
    $('#tmReply').value = '';
    toast('تم إرسال ردك', 'success');
    openThread(curThread.id);
    renderers.support();
  });

  /* البدء */
  const initial = location.hash.replace('#', '') || 'overview';
  go(initial);
})();
