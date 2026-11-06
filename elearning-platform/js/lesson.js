/* ============================================================
   منصة طاهر البيلي — صفحة مشاهدة الدروس
   ============================================================ */
let course = null, curIdx = 0;

(function(){
  applyTheme();
  dbLoad();
  $('#backBtn').innerHTML = ic('arrow-right');
  $('#burger').innerHTML = ic('menu');
  $('#vfIcon').innerHTML = ic('video');
  $('#userArea').innerHTML = me()
    ? '<a class="btn btn-ghost btn-sm" href="dashboard.html">' + ic('grid','ic-sm') + ' لوحتي</a>'
    : '<a class="btn btn-ghost btn-sm" href="login.html">تسجيل الدخول</a>';
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));

  /* تبويبات */
  const tabNames = { desc:'وصف الدرس', files:'الملفات المرفقة', qa:'الأسئلة والنقاش' };
  $$('#tabbar button').forEach(btn => {
    const t = btn.dataset.tab;
    btn.innerHTML = ic(t === 'desc' ? 'file-text' : t === 'files' ? 'folder' : 'message','ic-sm') + ' ' + tabNames[t];
    btn.addEventListener('click', () => {
      $$('#tabbar button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      $$('.tabpane').forEach(p => p.classList.remove('active'));
      $('#pane-' + t).classList.add('active');
    });
  });

  const params = new URLSearchParams(location.search);
  const courseId = params.get('course');
  course = courseId ? getCourse(courseId) : null;
  if(!course){ location.href = 'courses.html'; return; }

  document.title = course.title + ' — منصة طاهر البيلي';
  const user = me(), session = getSession();
  const isStudent = !!(user && session && session.role === 'student');
  const enr = isStudent ? getEnrollment(user.id, course.id) : null;

  /* البوابات */
  function gate(iconName, title, text, actions){
    $('#watchArea').classList.add('hidden');
    $('#gateArea').classList.remove('hidden');
    $('#gateArea').innerHTML = '<div class="gate-panel"><div class="gi">' + ic(iconName,'ic-lg') + '</div>' +
      '<h2>' + title + '</h2><p>' + text + '</p><div class="flex" style="justify-content:center;flex-wrap:wrap">' + actions + '</div></div>';
  }

  if(!isStudent){
    gate('lock', 'هذه الدورة تتطلب تسجيل الدخول', 'سجّل الدخول بحسابك أو أنشئ حساباً جديداً مجاناً لتتمكن من مشاهدة دروس هذه الدورة.',
      '<a class="btn btn-primary" href="login.html">تسجيل الدخول</a><a class="btn btn-ghost" href="login.html?tab=register">إنشاء حساب جديد</a>');
    return;
  }
  if(!enr){
    gate('lock', 'أنت غير مشترك في هذه الدورة', 'اشترك في الدورة الآن للحصول على جميع الدروس والملفات والاختبارات والشهادة.',
      '<a class="btn btn-primary" href="courses.html?open=' + course.id + '">عرض الدورة والاشتراك</a>');
    return;
  }
  if(enr.status === 'pending'){
    gate('clock', 'اشتراكك بانتظار تأكيد الدفع', 'استلمنا طلب اشتراكك في هذه الدورة، وسيراجع فريق الإدارة عملية الدفع ويفعّل اشتراكك قريباً. ستصلك رسالة إشعار عند التفعيل.',
      '<a class="btn btn-ghost" href="dashboard.html">العودة إلى لوحتي</a>');
    return;
  }
  if(enr.status === 'rejected'){
    gate('alert', 'لم يتم تأكيد اشتراكك', 'تعذر تأكيد عملية الدفع لهذه الدورة. تواصل مع الدعم الفني من لوحتك لإعادة المحاولة.',
      '<a class="btn btn-ghost" href="dashboard.html#support">الدعم الفني</a>');
    return;
  }

  /* ---------- واجهة المشاهدة ---------- */
  $('#watchArea').classList.remove('hidden');
  $('#topCourseTitle').textContent = course.title;
  $('#lsTitle').textContent = 'دروس الدورة';
  $('#lsCount').textContent = course.lessons.length + ' دروس';

  const cat = getCategory(course.categoryId);
  document.documentElement.style.setProperty('--g1', cat.g1);

  /* اختيار الدرس الحالي (من الرابط أو أول غير مكتمل) */
  const wanted = params.get('lesson');
  curIdx = 0;
  if(wanted){
    const i = course.lessons.findIndex(l => l.id === wanted);
    if(i >= 0) curIdx = i;
  } else {
    const firstUndone = course.lessons.findIndex(l => !enr.progress.includes(l.id));
    if(firstUndone >= 0) curIdx = firstUndone;
  }

  function isDone(l){ return enr.progress.includes(l.id); }

  function renderSide(){
    $('#lsList').innerHTML = course.lessons.map((l, i) =>
      '<div class="ls-item ' + (isDone(l) ? 'done' : '') + (i === curIdx ? ' active' : '') + '" data-idx="' + i + '">' +
      '<span class="li-idx">' + (isDone(l) ? ic('check','ic-sm') : (i + 1)) + '</span>' +
      '<span class="li-t">' + esc(l.title) + '</span>' +
      '<span class="li-d">' + l.duration + ' د</span></div>'
    ).join('');
    $$('#lsList .ls-item').forEach(el => el.addEventListener('click', () => { curIdx = +el.dataset.idx; loadLesson(); }));
    const pct = progressOf(enr, course);
    $('#sidePct').textContent = pct + '%';
    $('#sideProgress').innerHTML = progressBar(pct);
    $('#topProgress').textContent = 'أكملت ' + pct + '% من الدورة' + (enr.completedAt ? ' — الشهادة متاحة' : '');
  }

  function loadLesson(){
    const l = course.lessons[curIdx];
    document.getElementById('player').src = l.video || '';
    document.getElementById('player').style.display = l.video ? '' : 'none';
    $('#videoFallback').classList.add('hidden');
    $('#lessonTitle').textContent = l.title;
    $('#lessonIdxChip').textContent = 'الدرس ' + (curIdx + 1) + ' من ' + course.lessons.length;
    $('#doneBtn').innerHTML = isDone(l) ? ic('check-circle','ic-sm') + ' مكتمل' : ic('check','ic-sm') + ' تحديد كمكتمل';
    $('#doneBtn').disabled = isDone(l);
    $('#prevBtn').innerHTML = ic('arrow-right','ic-sm') + ' السابق';
    $('#nextBtn').innerHTML = 'التالي ' + ic('arrow-left','ic-sm');
    $('#prevBtn').disabled = curIdx === 0;
    $('#nextBtn').disabled = curIdx === course.lessons.length - 1;
    /* الوصف */
    $('#pane-desc').innerHTML = '<p style="font-size:15px;color:var(--text)">' + esc(l.desc || 'لا يوجد وصف لهذا الدرس بعد.') + '</p>' +
      '<p class="text-muted mt-1" style="font-size:13.5px">' + ic('clock','ic-sm') + ' مدة الدرس: ' + fmtDur(l.duration) + ' — من دورة "' + esc(course.title) + '"</p>';
    /* الملفات */
    $('#pane-files').innerHTML = l.file
      ? '<div class="attach-row"><span class="fi">' + ic('file-text') + '</span><div><b>' + esc(l.file.name) + '</b><span>ملف مرفق — ' + esc(l.file.size) + '</span></div>' +
        '<button class="btn btn-outline btn-sm" data-download>' + ic('download','ic-sm') + ' تحميل الملف</button></div>' +
        '<p class="mini-note">' + ic('info') + ' التحميل التجريبي ينشئ ملفاً نصياً بنفس الاسم لأغراض العرض.</p>'
      : '<div class="empty-state" style="padding:34px">' + ic('folder') + '<h3 style="font-size:15px">لا توجد ملفات مرفقة بهذا الدرس</h3><p style="font-size:13.5px">بعض الدروس تعتمد على الفيديو فقط.</p></div>';
    renderQA();
    renderSide();
    $('#pane-desc').parentElement && null;
  }

  /* تحديد الدرس كمكتمل */
  $('#doneBtn').addEventListener('click', () => {
    const l = course.lessons[curIdx];
    const res = markLessonDone(me().id, course.id, l.id);
    if(res.completed) toast('مبروك! أكملت جميع الدروس — شهادتك متاحة الآن', 'success');
    else toast('تم تحديد الدرس كمكتمل', 'success');
    const enr2 = getEnrollment(me().id, course.id);
    if(res.completed){
      setTimeout(() => { location.href = 'dashboard.html#certificates'; }, 1400);
      return;
    }
    enr.progress = enr2.progress; loadLesson();
  });
  /* تلقائي عند انتهاء الفيديو */
  document.getElementById('player').addEventListener('ended', () => $('#doneBtn').click());
  document.getElementById('player').addEventListener('error', () => $('#videoFallback').classList.remove('hidden'));

  /* التنقل بين الدروس */
  $('#prevBtn').addEventListener('click', () => { if(curIdx > 0){ curIdx--; loadLesson(); } });
  $('#nextBtn').addEventListener('click', () => {
    const l = course.lessons[curIdx];
    if(!isDone(l)) markLessonDone(me().id, course.id, l.id);
    const enr2 = getEnrollment(me().id, course.id);
    enr.progress = enr2.progress;
    if(curIdx < course.lessons.length - 1){ curIdx++; loadLesson(); }
    if(progressOf(enr, course) === 100) toast('مبروك! أكملت جميع الدروس — شهادتك متاحة الآن', 'success');
  });

  /* تحميل الملف التجريبي */
  $('#pane-files').addEventListener('click', e => {
    if(!e.target.closest('[data-download]')) return;
    const l = course.lessons[curIdx];
    const blob = new Blob(['ملف تجريبي من منصة طاهر البيلي\n\nالدرس: ' + l.title + '\nالملف: ' + (l.file ? l.file.name : '')], { type:'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (l.file ? l.file.name.replace(/\.\w+$/, '') : 'ملف-' + l.id) + '.txt';
    a.click(); URL.revokeObjectURL(a.href);
    toast('بدأ تحميل الملف', 'success');
  });

  /* ---------- الأسئلة والنقاش ---------- */
  function renderQA(){
    const list = dbLoad().courseQA.filter(q => q.courseId === course.id);
    $('#qaList').innerHTML = list.length
      ? list.map(q => {
          const s = getStudent(q.studentId);
          return '<div class="qa-item"><div class="qa-head">' + avatar(s ? s.name : '؟', 'sm') + '<b>' + esc(s ? s.name : 'طالب') + '</b><time>' + timeAgo(q.at) + '</time></div>' +
            '<p>' + esc(q.text) + '</p>' +
            q.replies.map(r => '<div class="qa-reply"><b>' + esc(r.by) + ' — ' + timeAgo(r.at) + '</b><br>' + esc(r.text) + '</div>').join('') +
            '</div>';
        }).join('')
      : '<div class="empty-state" style="padding:30px">' + ic('message') + '<h3 style="font-size:15px">لا توجد أسئلة بعد</h3><p style="font-size:13.5px">كن أول من يطرح سؤالاً عن هذا الدرس.</p></div>';
  }
  $('#qaSend').innerHTML = ic('send','ic-sm') + ' إرسال السؤال';
  $('#qaSend').addEventListener('click', () => {
    const txt = $('#qaInput').value.trim();
    if(txt.length < 5){ toast('اكتب سؤالاً واضحاً أولاً', 'error'); return; }
    dbLoad().courseQA.push({ id:uid('qa'), courseId:course.id, studentId:me().id, text:txt, at:NOW(), replies:[] });
    dbSave();
    $('#qaInput').value = '';
    renderQA();
    toast('تم نشر سؤالك في النقاش', 'success');
  });

  loadLesson();
})();
