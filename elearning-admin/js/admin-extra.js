/* ============================================================
   منصة طاهر البيلي — أقسام لوحة الإدارة:
   (4) المالية  (5) الاختبارات  (6) المحتوى  (7) الدعم  (8) الصلاحيات
   يُدمج هذا الكائن مع أقسام admin.js عند التشغيل.
   ============================================================ */
window.ADM_EXTRA = {

  /* ============ 4) الاشتراكات والمدفوعات ============ */
  finance(){
    let tab = 'subs';
    const st = dbLoad();
    const paid = st.transactions.filter(t => t.status === 'مدفوع');
    const pending = st.transactions.filter(t => t.status === 'معلق');
    const total = paid.reduce((a, t) => a + t.amount, 0);
    const thisMonth = paid.filter(t => monthKey(t.at) === monthKey(NOW())).reduce((a, t) => a + t.amount, 0);

    $('#secContent').innerHTML =
      '<div class="stat-grid">' +
        admSC('dollar','bg-amber', fmtNum(total) + ' ج.م', 'إجمالي الإيرادات المحصلة') +
        admSC('calendar','bg-blue', fmtNum(thisMonth) + ' ج.م', 'إيرادات هذا الشهر') +
        admSC('clock','bg-violet', String(pending.length), 'دفعات بانتظار التأكيد') +
        admSC('credit-card','bg-teal', String(paid.length), 'معاملة مدفوعة') +
      '</div>' +
      '<div class="toolbar mt-3" style="margin-top:18px">' +
        '<div class="subtabs"><button id="tabSubs" class="active">الاشتراكات</button><button id="tabTrans">سجل المعاملات</button></div>' +
        '<button class="btn btn-outline btn-sm" id="csvBtn" style="margin-inline-start:auto">' + ic('download','ic-sm') + ' تصدير تقرير CSV</button>' +
      '</div>' +
      '<div id="finArea"></div>';

    $('#tabSubs').addEventListener('click', () => { tab = 'subs'; $('#tabSubs').classList.add('active'); $('#tabTrans').classList.remove('active'); render(); });
    $('#tabTrans').addEventListener('click', () => { tab = 'trans'; $('#tabTrans').classList.add('active'); $('#tabSubs').classList.remove('active'); render(); });
    $('#csvBtn').addEventListener('click', exportCSV);
    render();

    function render(){
      const st2 = dbLoad();
      if(tab === 'subs'){
        const rows = [];
        st2.students.forEach(s2 => s2.enrollments.forEach(e => {
          const c = getCourse(e.courseId);
          if(c) rows.push({ s:s2, e, c });
        }));
        rows.sort((a, b) => b.e.at - a.e.at);
        $('#finArea').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('users') + ' جميع اشتراكات الطلاب (' + rows.length + ')</h3></div>' +
          '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>الطالب</th><th>الدورة</th><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
          (rows.length ? rows.map(r =>
            '<tr><td><div class="cell-main">' + avatar(r.s.name, 'sm') + esc(r.s.name) + '</div></td>' +
            '<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.c.title) + '</td>' +
            '<td>' + fmtDate(r.e.at) + '</td><td>' + (r.e.amount ? fmtPrice(r.e.amount) : '—') + '</td><td>' + esc(r.e.method || '—') + '</td>' +
            '<td>' + statusBadge(ENR_STATUS[r.e.status]) + '</td><td><div class="actions-cell">' +
            (r.e.status === 'pending'
              ? '<button class="btn btn-success btn-sm" data-ok="' + r.s.id + '|' + r.c.id + '">' + ic('check','ic-sm') + ' تأكيد الدفع</button>' +
                '<button class="btn btn-danger btn-sm" data-no="' + r.s.id + '|' + r.c.id + '">رفض</button>'
              : '—') + '</div></td></tr>'
          ).join('') : '<tr><td colspan="7" class="text-center text-muted" style="padding:30px">لا اشتراكات بعد</td></tr>') +
          '</tbody></table></div></div></div>';
        $$('[data-ok]').forEach(b => b.addEventListener('click', () => act(b.dataset.ok, true)));
        $$('[data-no]').forEach(b => b.addEventListener('click', () => act(b.dataset.no, false)));
      } else {
        const tx = st2.transactions.slice().sort((a, b) => b.at - a.at);
        $('#finArea').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('credit-card') + ' سجل المعاملات المالية (' + tx.length + ')</h3></div>' +
          '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>الرقم</th><th>الطالب</th><th>الدورة</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>' +
          tx.map(t => {
            const s2 = getStudent(t.studentId), c = getCourse(t.courseId);
            return '<tr><td style="font-weight:800">' + esc(t.id) + '</td><td>' + esc(s2 ? s2.name : '—') + '</td>' +
            '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c ? c.title : '—') + '</td>' +
            '<td>' + fmtPrice(t.amount) + '</td><td>' + esc(t.method) + '</td><td>' + fmtDate(t.at) + '</td>' +
            '<td>' + statusBadge(t.status) + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div>';
      }
    }

    function act(key, approve){
      const [sid, cid] = key.split('|');
      const st2 = dbLoad();
      const t = st2.transactions.find(x => x.studentId === sid && x.courseId === cid && x.status === 'معلق');
      if(t) confirmPayment(t.id, approve);
      else { /* اشتراك مجاني أو معاملة مفقودة */ 
        const enr = getEnrollment(sid, cid);
        if(enr){ enr.status = approve ? 'active' : 'rejected'; dbSave(); }
      }
      toast(approve ? 'تم تأكيد الدفع وتفعيل الاشتراك' : 'تم رفض العملية', approve ? 'success' : 'info');
      render();
    }

    function exportCSV(){
      const rows = [['رقم المعاملة','الطالب','الدورة','المبلغ','طريقة الدفع','التاريخ','الحالة']];
      dbLoad().transactions.forEach(t => {
        const s2 = getStudent(t.studentId), c = getCourse(t.courseId);
        rows.push([t.id, s2 ? s2.name : '', c ? c.title : '', t.amount, t.method, fmtDate(t.at), t.status]);
      });
      const csv = '\ufeff' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
      a.download = 'تقرير-المدفوعات.csv';
      a.click(); URL.revokeObjectURL(a.href);
      toast('تم تصدير التقرير', 'success');
    }
  },

  /* ============ 5) الاختبارات والنتائج ============ */
  quizzes(){
    render();

    function render(){
      const st = dbLoad();
      const results = [];
      st.students.forEach(s2 => s2.enrollments.forEach(e => e.quizResults.forEach(r => {
        const q = getQuiz(r.quizId);
        if(q) results.push({ s:s2, r, q });
      })));
      results.sort((a, b) => b.r.at - a.r.at);

      $('#secContent').innerHTML =
        '<div class="toolbar"><button class="btn btn-primary btn-sm" id="addQuizBtn">' + ic('plus','ic-sm') + ' إنشاء اختبار جديد</button>' +
        '<span class="chip">' + ic('target','ic-sm') + ' ' + st.quizzes.length + ' اختبار</span>' +
        '<span class="chip">' + ic('check-circle','ic-sm') + ' ' + results.length + ' محاولة تسليم</span></div>' +
        '<div class="grid-3" id="quizCards">' +
        (st.quizzes.length ? st.quizzes.map(q => {
          const c = getCourse(q.courseId);
          const att = results.filter(x => x.q.id === q.id);
          const avg = att.length ? Math.round(att.reduce((a, x) => a + x.r.score, 0) / att.length) : 0;
          return '<div class="feature-card" style="padding:20px">' +
            '<div class="flex-between mb-1"><b style="font-size:15.5px">' + esc(q.title) + '</b>' +
            '<span class="le-actions">' +
            '<button class="icon-btn sm" data-editq="' + q.id + '" title="تعديل">' + ic('edit','ic-sm') + '</button>' +
            '<button class="icon-btn sm danger" data-delq="' + q.id + '" title="حذف">' + ic('trash','ic-sm') + '</button></span></div>' +
            '<p class="text-muted" style="font-size:13px;margin-bottom:10px">' + esc(c ? c.title : 'دورة محذوفة') + '</p>' +
            '<div class="cc-meta" style="margin-bottom:12px">' +
            '<span>' + ic('list','ic-sm') + q.questions.length + ' أسئلة</span>' +
            '<span>' + ic('target','ic-sm') + ' النجاح ' + q.passGrade + '%</span>' +
            '<span>' + ic('clock','ic-sm') + q.durationMin + ' د</span></div>' +
            '<div class="flex-between" style="font-size:12.5px;font-weight:700">' +
            '<span class="text-muted">محاولات: ' + att.length + ' — متوسط: ' + (att.length ? avg + '%' : '—') + '</span>' +
            '<span class="badge badge-info">نسبة النجاح ' + (att.length ? Math.round(att.filter(x => x.r.passed).length / att.length * 100) : 0) + '%</span></div></div>';
        }).join('') : '<p class="text-muted">لا اختبارات بعد.</p>') + '</div>' +
        '<div class="panel mt-3"><div class="panel-head"><h3>' + ic('bar-chart') + ' نتائج الطلاب وتقارير الأداء</h3></div>' +
        '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>الطالب</th><th>الاختبار</th><th>الدورة</th><th>الدرجة</th><th>النتيجة</th><th>التاريخ</th></tr></thead><tbody>' +
        (results.length ? results.map(x =>
          '<tr><td><div class="cell-main">' + avatar(x.s.name, 'sm') + esc(x.s.name) + '</div></td>' +
          '<td>' + esc(x.q.title) + '</td><td>' + esc(getCourse(x.q.courseId) ? getCourse(x.q.courseId).title : '—') + '</td>' +
          '<td><b style="font-size:15px;color:' + (x.r.passed ? 'var(--success)' : 'var(--danger)') + '">' + x.r.score + '%</b></td>' +
          '<td>' + statusBadge(x.r.passed ? 'نشط' : 'راسب') + '</td><td>' + fmtDate(x.r.at) + '</td></tr>'
        ).join('') : '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">لا نتائج مسجلة بعد</td></tr>') +
        '</tbody></table></div></div></div>';

      $('#addQuizBtn').addEventListener('click', () => editQuiz(null));
      $$('[data-editq]').forEach(b => b.addEventListener('click', () => editQuiz(b.dataset.editq)));
      $$('[data-delq]').forEach(b => b.addEventListener('click', () => {
        const q = getQuiz(b.dataset.delq);
        confirmAction('حذف الاختبار', 'سيتم حذف "' + q.title + '" وجميع نتائجه. هل أنت متأكد؟', () => {
          const st2 = dbLoad();
          st2.quizzes = st2.quizzes.filter(x => x.id !== q.id);
          st2.students.forEach(s2 => s2.enrollments.forEach(e => e.quizResults = e.quizResults.filter(r => r.quizId !== q.id)));
          dbSave();
          logActivity('حذف اختبار "' + q.title + '"');
          toast('تم حذف الاختبار', 'success'); render();
        }, 'حذف');
      }));
    }

    function editQuiz(id){
      const st = dbLoad();
      const published = st.courses.filter(c => !c.archived);
      const q = id ? getQuiz(id) : {
        id:uid('q'), courseId:published[0] ? published[0].id : '', title:'', passGrade:60, durationMin:15,
        questions:[{ q:'', options:['','','',''], correct:0 }]
      };
      admOpen(id ? 'تعديل الاختبار' : 'إنشاء اختبار جديد',
        '<div class="form-grid">' +
          '<div class="field"><label>الدورة <span class="req">*</span></label><select id="qfCourse">' +
            published.map(c => '<option value="' + c.id + '" ' + (c.id === q.courseId ? 'selected' : '') + '>' + esc(c.title) + '</option>').join('') + '</select></div>' +
          '<div class="field"><label>عنوان الاختبار <span class="req">*</span></label><input id="qfTitle" value="' + esc(q.title) + '"></div>' +
          '<div class="field"><label>درجة النجاح (%)</label><input type="number" min="10" max="100" id="qfPass" value="' + q.passGrade + '"></div>' +
          '<div class="field"><label>المدة (دقائق)</label><input type="number" min="1" id="qfDur" value="' + q.durationMin + '"></div>' +
        '</div>' +
        '<h4 style="font-size:15px;margin-bottom:10px">الأسئلة والإجابات</h4>' +
        '<p class="mini-note mb-2">' + ic('info') + ' حدد خياراً واحداً كإجابة صحيحة لكل سؤال (الدائرة الخضراء).</p>' +
        '<div id="qListArea"></div>' +
        '<button class="btn btn-outline btn-sm" id="addQBtn">' + ic('plus','ic-sm') + ' إضافة سؤال</button>',
        '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إلغاء</button>' +
        '<button class="btn btn-primary" id="qfSave">حفظ الاختبار</button>', true, true);

      function drawQuestions(){
        $('#qListArea').innerHTML = q.questions.map((qq, i) =>
          '<div class="q-edit" data-qi="' + i + '"><div class="q-head"><b>سؤال ' + (i + 1) + '</b>' +
          (q.questions.length > 1 ? '<button class="btn btn-danger btn-sm" data-delq2="' + i + '">' + ic('trash','ic-sm') + ' حذف</button>' : '') + '</div>' +
          '<textarea class="field" data-qf="q" style="min-height:56px" placeholder="نص السؤال...">' + esc(qq.q) + '</textarea>' +
          '<div class="opts-grid">' + qq.options.map((op, j) =>
            '<label class="opt-row' + (qq.correct === j ? ' correct' : '') + '"><input type="radio" name="qc' + i + '" value="' + j + '" ' + (qq.correct === j ? 'checked' : '') + '>' +
            '<input type="text" data-qf="opt" value="' + esc(op) + '" placeholder="الخيار ' + (j + 1) + '"></label>'
          ).join('') + '</div></div>'
        ).join('');
        $$('[data-delq2]').forEach(b => b.addEventListener('click', () => {
          q.questions.splice(+b.dataset.delq2, 1); drawQuestions();
        }));
        $$('[data-qi]').forEach(row => {
          const i = +row.dataset.qi;
          row.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
            q.questions[i].correct = +r.value;
            row.querySelectorAll('.opt-row').forEach((o, j) => o.classList.toggle('correct', j === q.questions[i].correct));
          }));
        });
      }
      drawQuestions();
      $('#addQBtn').addEventListener('click', () => {
        q.questions.push({ q:'', options:['','','',''], correct:0 });
        drawQuestions();
      });

      $('#qfSave').addEventListener('click', () => {
        const title = $('#qfTitle').value.trim();
        if(title.length < 4){ toast('أدخل عنوان الاختبار', 'error'); return; }
        /* قراءة الأسئلة من النموذج */
        const rows = $$('[data-qi]');
        const questions = [];
        for(let i = 0; i < rows.length; i++){
          const row = rows[i];
          const qt = row.querySelector('[data-qf="q"]').value.trim();
          const opts = Array.from(row.querySelectorAll('[data-qf="opt"]')).map(o => o.value.trim());
          const checked = row.querySelector('input[type=radio]:checked');
          if(!qt || opts.some(o => !o)){ toast('أكمل نص السؤال ' + (i + 1) + ' وجميع خياراته', 'error'); return; }
          questions.push({ q:qt, options:opts, correct:checked ? +checked.value : 0 });
        }
        const exists = st.quizzes.some(x => x.id === q.id);
        q.title = title;
        q.courseId = $('#qfCourse').value;
        q.passGrade = Math.min(100, Math.max(10, +$('#qfPass').value || 60));
        q.durationMin = Math.max(1, +$('#qfDur').value || 15);
        q.questions = questions;
        if(!exists) st.quizzes.push(q);
        dbSave();
        logActivity((exists ? 'تعديل' : 'إنشاء') + ' اختبار "' + q.title + '"');
        closeModal('admModal'); toast('تم حفظ الاختبار', 'success'); render();
      });
    }
  },

  /* ============ 6) إدارة المحتوى والصفحات ============ */
  content(){
    let tab = 'settings';
    $('#secContent').innerHTML =
      '<div class="toolbar"><div class="subtabs" id="contTabs">' +
        '<button data-t="settings" class="active">الإعدادات العامة</button>' +
        '<button data-t="anns">الإعلانات والتنبيهات</button>' +
        '<button data-t="faqs">الأسئلة الشائعة</button>' +
        '<button data-t="news">الأخبار والمقالات</button>' +
      '</div></div><div id="contArea"></div>';
    $$('#contTabs button').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.t;
      $$('#contTabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      render();
    }));
    render();

    function render(){
      const st = dbLoad();
      if(tab === 'settings'){
        const s = st.settings;
        $('#contArea').innerHTML = '<div class="panel" style="max-width:760px"><div class="panel-head"><h3>' + ic('settings') + ' محتوى الصفحة الرئيسية وبيانات التواصل</h3></div><div class="panel-body">' +
          '<div class="form-grid">' +
            '<div class="field"><label>اسم المنصة</label><input id="csName" value="' + esc(s.siteName) + '"></div>' +
            '<div class="field"><label>نص زر البدء</label><input id="csBtn" value="' + esc(s.heroBtn) + '"></div>' +
          '</div>' +
          '<div class="field"><label>العنوان الرئيسي (Hero)</label><input id="csTitle" value="' + esc(s.heroTitle) + '"></div>' +
          '<div class="field"><label>النص التعريفي (Hero)</label><textarea id="csSub" style="min-height:64px">' + esc(s.heroSubtitle) + '</textarea></div>' +
          '<h4 style="font-size:14.5px;margin:14px 0 10px">أرقام قسم الإحصائيات</h4>' +
          '<div class="form-grid">' +
            '<div class="field"><label>عدد الطلاب</label><input type="number" id="csStu" value="' + s.stats.students + '"></div>' +
            '<div class="field"><label>عدد الساعات التدريبية</label><input type="number" id="csHrs" value="' + s.stats.hours + '"></div>' +
            '<div class="field"><label>نسبة الرضا %</label><input type="number" id="csSat" value="' + s.stats.satisfaction + '"></div>' +
          '</div>' +
          '<h4 style="font-size:14.5px;margin:14px 0 10px">بيانات التواصل</h4>' +
          '<div class="form-grid">' +
            '<div class="field"><label>البريد الإلكتروني</label><input id="csEmail" value="' + esc(s.contact.email) + '"></div>' +
            '<div class="field"><label>رقم الهاتف</label><input id="csPhone" value="' + esc(s.contact.phone) + '"></div>' +
          '</div>' +
          '<div class="field"><label>العنوان</label><input id="csAddr" value="' + esc(s.contact.address) + '"></div>' +
          '<button class="btn btn-primary" id="csSave">حفظ الإعدادات</button>' +
          '<p class="mini-note mt-2">' + ic('info') + ' تظهر هذه البيانات مباشرة في الصفحة الرئيسية والفوتر بعد الحفظ.</p></div></div>' +
          '<div class="panel mt-3" style="max-width:760px"><div class="panel-head"><h3>' + ic('download') + ' النسخ الاحتياطي ونشر البيانات</h3></div><div class="panel-body">' +
            '<p class="mini-note">' + ic('help') + ' البيانات تُحفظ في متصفح هذا الجهاز فقط. لكي تظهر الكورسات لجميع الطلاب على كل الأجهزة: بعد إضافة الكورسات اضغط "تصدير البيانات" وأرسل الملف الناتج ليتم تحديث الموقع.</p>' +
            '<div class="flex" style="gap:10px;flex-wrap:wrap">' +
              '<button class="btn btn-primary" id="bkExport">' + ic('download','ic-sm') + ' تصدير البيانات (JSON)</button>' +
              '<button class="btn btn-outline" id="bkImportBtn">' + ic('file-text','ic-sm') + ' استيراد نسخة احتياطية</button>' +
              '<input type="file" id="bkImport" accept=".json,application/json" style="display:none">' +
            '</div></div></div>';
        $('#csSave').addEventListener('click', () => {
          s.siteName = $('#csName').value.trim() || s.siteName;
          s.heroBtn = $('#csBtn').value.trim() || s.heroBtn;
          s.heroTitle = $('#csTitle').value.trim() || s.heroTitle;
          s.heroSubtitle = $('#csSub').value.trim();
          s.stats.students = +$('#csStu').value || s.stats.students;
          s.stats.hours = +$('#csHrs').value || s.stats.hours;
          s.stats.satisfaction = Math.min(100, +$('#csSat').value || s.stats.satisfaction);
          s.contact.email = $('#csEmail').value.trim();
          s.contact.phone = $('#csPhone').value.trim();
          s.contact.address = $('#csAddr').value.trim();
          dbSave();
          logActivity('تحديث إعدادات المحتوى العام');
          toast('تم حفظ الإعدادات — ستظهر في الموقع مباشرة', 'success');
        });
        $('#bkExport').addEventListener('click', exportBackup);
        $('#bkImportBtn').addEventListener('click', () => $('#bkImport').click());
        $('#bkImport').addEventListener('change', function(){
          const f = this.files[0];
          if(!f) return;
          const r = new FileReader();
          r.onload = () => {
            try{
              const parsed = JSON.parse(r.result);
              if(!parsed || !Array.isArray(parsed.courses) || !Array.isArray(parsed.students)) throw new Error('bad');
              parsed._v = DB_VERSION;
              localStorage.setItem(STATE_KEY, JSON.stringify(parsed));
              logActivity('استيراد نسخة احتياطية من البيانات');
              toast('تم استيراد البيانات — سيتم تحديث الصفحة', 'success');
              setTimeout(() => location.reload(), 900);
            }catch(e){ toast('الملف غير صالح — تأكد أنه ملف النسخة الاحتياطية', 'error'); }
          };
          r.readAsText(f);
        });
        function exportBackup(){
          const data = JSON.stringify(dbLoad(), null, 2);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([data], { type:'application/json' }));
          a.download = 'taher-backup-' + new Date().toISOString().slice(0,10) + '.json';
          a.click(); URL.revokeObjectURL(a.href);
          logActivity('تصدير نسخة احتياطية من البيانات');
          toast('تم تصدير النسخة الاحتياطية — ابعت الملف لتحديث الموقع', 'success');
        }
      }
      else if(tab === 'anns'){
        $('#contArea').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('megaphone') + ' شريط الإعلانات في أعلى الموقع</h3></div><div class="panel-body">' +
          '<div class="flex mb-3" style="align-items:stretch"><input id="annText" class="input" placeholder="نص الإعلان الجديد..." style="flex:1">' +
          '<button class="btn btn-primary" id="annAdd">' + ic('plus','ic-sm') + ' إضافة</button></div>' +
          (st.announcements.length ? st.announcements.map(a =>
            '<div class="ann-row"><p>' + esc(a.text) + '</p>' +
            '<span class="chip">' + fmtDate(a.at) + '</span>' +
            '<label class="switch" title="إظهار/إخفاء"><input type="checkbox" data-ann="' + a.id + '" ' + (a.active ? 'checked' : '') + '><span class="track"></span></label>' +
            '<button class="icon-btn sm danger" data-annx="' + a.id + '">' + ic('trash','ic-sm') + '</button></div>'
          ).join('') : '<p class="text-muted">لا إعلانات بعد.</p>') + '</div></div>';
        $('#annAdd').addEventListener('click', () => {
          const t = $('#annText').value.trim();
          if(t.length < 5){ toast('اكتب نص الإعلان', 'error'); return; }
          st.announcements.unshift({ id:uid('an'), text:t, active:true, at:NOW() });
          dbSave(); logActivity('إضافة إعلان جديد');
          toast('تمت إضافة الإعلان', 'success'); render();
        });
        $$('[data-ann]').forEach(sw => sw.addEventListener('change', () => {
          const a = st.announcements.find(x => x.id === sw.dataset.ann);
          a.active = sw.checked; dbSave();
          logActivity((a.active ? 'تفعيل' : 'إخفاء') + ' إعلان');
        }));
        $$('[data-annx]').forEach(b => b.addEventListener('click', () => {
          st.announcements = st.announcements.filter(x => x.id !== b.dataset.annx);
          dbSave(); toast('تم حذف الإعلان', 'info'); render();
        }));
      }
      else if(tab === 'faqs'){
        $('#contArea').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('help') + ' الأسئلة الشائعة (' + st.faqs.length + ')</h3>' +
          '<button class="btn btn-primary btn-sm" id="faqAdd">' + ic('plus','ic-sm') + ' إضافة سؤال</button></div><div class="panel-body">' +
          st.faqs.map(f =>
            '<div class="faq-row"><div style="flex:1"><b>' + esc(f.q) + '</b><span class="fr-a">' + esc(f.a) + '</span></div>' +
            '<button class="icon-btn sm" data-fq="' + f.id + '">' + ic('edit','ic-sm') + '</button>' +
            '<button class="icon-btn sm danger" data-fqx="' + f.id + '">' + ic('trash','ic-sm') + '</button></div>'
          ).join('') + '</div></div>';
        $('#faqAdd').addEventListener('click', () => faqModal(null));
        $$('[data-fq]').forEach(b => b.addEventListener('click', () => faqModal(b.dataset.fq)));
        $$('[data-fqx]').forEach(b => b.addEventListener('click', () => {
          st.faqs = st.faqs.filter(x => x.id !== b.dataset.fqx);
          dbSave(); toast('تم حذف السؤال', 'info'); render();
        }));
      }
      else {
        $('#contArea').innerHTML = '<div class="panel"><div class="panel-head"><h3>' + ic('file-text') + ' الأخبار والمقالات التعليمية (' + st.news.length + ')</h3>' +
          '<button class="btn btn-primary btn-sm" id="newsAdd">' + ic('plus','ic-sm') + ' مقال جديد</button></div><div class="panel-body">' +
          st.news.map(n =>
            '<div class="news-row"><div style="flex:1"><b style="font-size:15px">' + esc(n.title) + '</b><span class="fr-a">' + esc(n.excerpt) + '</span>' +
            '<span class="chip mt-1">' + ic('calendar','ic-sm') + ' ' + fmtDate(n.at) + '</span></div>' +
            '<button class="icon-btn sm" data-nw="' + n.id + '">' + ic('edit','ic-sm') + '</button>' +
            '<button class="icon-btn sm danger" data-nwx="' + n.id + '">' + ic('trash','ic-sm') + '</button></div>'
          ).join('') + '</div></div>';
        $('#newsAdd').addEventListener('click', () => newsModal(null));
        $$('[data-nw]').forEach(b => b.addEventListener('click', () => newsModal(b.dataset.nw)));
        $$('[data-nwx]').forEach(b => b.addEventListener('click', () => {
          st.news = st.news.filter(x => x.id !== b.dataset.nwx);
          dbSave(); toast('تم حذف المقال', 'info'); render();
        }));
      }
    }

    function faqModal(id){
      const f = id ? dbLoad().faqs.find(x => x.id === id) : { id:uid('f'), q:'', a:'' };
      admOpen(id ? 'تعديل السؤال' : 'إضافة سؤال شائع',
        '<div class="field"><label>السؤال <span class="req">*</span></label><input id="fmQ" value="' + esc(f.q) + '"></div>' +
        '<div class="field"><label>الإجابة <span class="req">*</span></label><textarea id="fmA">' + esc(f.a) + '</textarea></div>',
        '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إلغاء</button><button class="btn btn-primary" id="fmSave">حفظ</button>');
      $('#fmSave').addEventListener('click', () => {
        const q = $('#fmQ').value.trim(), a = $('#fmA').value.trim();
        if(!q || !a){ toast('أكمل السؤال والإجابة', 'error'); return; }
        f.q = q; f.a = a;
        const st = dbLoad();
        if(!st.faqs.some(x => x.id === f.id)) st.faqs.push(f);
        dbSave(); logActivity('تحديث الأسئلة الشائعة');
        closeModal('admModal'); toast('تم الحفظ', 'success'); render();
      });
    }

    function newsModal(id){
      const n = id ? dbLoad().news.find(x => x.id === id) : { id:uid('nw'), title:'', excerpt:'', body:'', at:NOW() };
      admOpen(id ? 'تعديل المقال' : 'إضافة مقال جديد',
        '<div class="field"><label>عنوان المقال <span class="req">*</span></label><input id="nmT" value="' + esc(n.title) + '"></div>' +
        '<div class="field"><label>مقتطف قصير (يظهر في البطاقة)</label><textarea id="nmE" style="min-height:56px">' + esc(n.excerpt) + '</textarea></div>' +
        '<div class="field"><label>نص المقال الكامل</label><textarea id="nmB" style="min-height:110px">' + esc(n.body || '') + '</textarea></div>',
        '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إلغاء</button><button class="btn btn-primary" id="nmSave">حفظ المقال</button>');
      $('#nmSave').addEventListener('click', () => {
        const t = $('#nmT').value.trim(), e = $('#nmE').value.trim(), b = $('#nmB').value.trim();
        if(t.length < 5 || e.length < 10){ toast('أكمل العنوان والمقتطف', 'error'); return; }
        n.title = t; n.excerpt = e; n.body = b;
        const st = dbLoad();
        if(!st.news.some(x => x.id === n.id)){ n.at = NOW(); st.news.unshift(n); }
        dbSave(); logActivity('تحديث الأخبار والمقالات');
        closeModal('admModal'); toast('تم حفظ المقال', 'success'); render();
      });
    }
  },

  /* ============ 7) الدعم الفني ============ */
  support(){
    render();

    function render(){
      const st = dbLoad();
      const counts = MSG_STATUS.map(s2 => st.messages.filter(m => m.status === s2).length);
      $('#secContent').innerHTML =
        '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">' +
          MSG_STATUS.map((s2, i) => admSC('message', ['bg-blue','bg-amber','bg-teal','bg-navy'][i], String(counts[i]), 'رسائل: ' + s2)).join('') +
        '</div>' +
        '<div class="panel mt-3"><div class="panel-head"><h3>' + ic('message') + ' صندوق رسائل الطلاب</h3></div>' +
        '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>الطالب</th><th>الموضوع</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
        (st.messages.length ? st.messages.map(m => {
          const s2 = getStudent(m.studentId);
          return '<tr><td><div class="cell-main">' + avatar(s2 ? s2.name : '؟', 'sm') + esc(s2 ? s2.name : 'طالب محذوف') + '</div></td>' +
          '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.subject) + '</td>' +
          '<td>' + fmtDate(m.at) + '</td><td>' + statusBadge(m.status) + '</td>' +
          '<td><div class="actions-cell"><button class="btn btn-ghost btn-sm" data-msg="' + m.id + '">' + ic('eye','ic-sm') + ' عرض والرد</button></div></td></tr>';
        }).join('') : '<tr><td colspan="5" class="text-center text-muted" style="padding:30px">لا رسائل حتى الآن</td></tr>') +
        '</tbody></table></div></div></div>';
      $$('[data-msg]').forEach(b => b.addEventListener('click', () => openMsg(b.dataset.msg)));
    }

    function openMsg(id){
      const st = dbLoad();
      const m = st.messages.find(x => x.id === id); if(!m) return;
      const s2 = getStudent(m.studentId);
      admOpen('رسالة دعم — ' + (s2 ? s2.name : 'طالب'),
        '<div class="flex mb-3">' + avatar(s2 ? s2.name : '؟', 'md') + '<div>' +
        '<b>' + esc(s2 ? s2.name : '—') + '</b><div class="text-muted" style="font-size:13px">' + esc(s2 ? s2.email : '') + ' · ' + fmtDate(m.at) + '</div></div>' +
        '<div style="margin-inline-start:auto">' + statusBadge(m.status) + '</div></div>' +
        '<div class="qa-item"><div class="qa-head"><b>نص الرسالة</b></div><p>' + esc(m.body) + '</p></div>' +
        (m.replies.length ? '<h4 style="font-size:14.5px;margin:14px 0 10px">الردود (' + m.replies.length + ')</h4>' +
          m.replies.map(r => '<div class="qa-reply" style="margin-bottom:9px"><b>' + esc(r.by) + ' — ' + fmtDate(r.at) + '</b><br>' + esc(r.text) + '</div>').join('') : '') +
        '<div class="field mt-3"><label>الرد على الطالب</label><textarea id="msgReply" placeholder="اكتب ردك هنا..."></textarea></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>تغيير الحالة</label><select id="msgStatus">' +
            MSG_STATUS.map(s3 => '<option ' + (s3 === m.status ? 'selected' : '') + '>' + s3 + '</option>').join('') + '</select></div>' +
        '</div>',
        '<button class="btn btn-danger" id="msgArchive">' + ic('archive','ic-sm') + ' أرشفة المحادثة</button>' +
        '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إغلاق</button>' +
        '<button class="btn btn-primary" id="msgSend">' + ic('send','ic-sm') + ' إرسال الرد</button>');
      $('#msgSend').addEventListener('click', () => {
        const txt = $('#msgReply').value.trim();
        if(txt.length < 3){ toast('اكتب نص الرد أولاً', 'error'); return; }
        m.replies.push({ by:'إدارة المنصة', text:txt, at:NOW() });
        m.status = $('#msgStatus').value === 'مؤرشف' ? 'تم الرد' : $('#msgStatus').value;
        if(m.status === 'جديد') m.status = 'تم الرد';
        dbSave();
        if(s2) addNotification(s2.id, 'رد جديد على رسالتك', 'رد فريق الدعم على رسالتك "' + m.subject + '"، راجع لوحتك لعرض الرد.', 'info');
        logActivity('الرد على رسالة دعم من "' + (s2 ? s2.name : '') + '"');
        closeModal('admModal'); toast('تم إرسال الرد وإشعار الطالب', 'success'); render();
      });
      $('#msgArchive').addEventListener('click', () => {
        m.status = 'مؤرشف'; dbSave();
        logActivity('أرشفة محادثة دعم');
        closeModal('admModal'); toast('تمت أرشفة المحادثة', 'info'); render();
      });
    }
  },

  /* ============ 8) الصلاحيات والأمان ============ */
  security(){
    render();

    function render(){
      const st = dbLoad();
      $('#secContent').innerHTML =
        '<div class="toolbar"><button class="btn btn-primary btn-sm" id="addAdminBtn">' + ic('plus','ic-sm') + ' إنشاء حساب مشرف</button>' +
        '<button class="btn btn-danger btn-sm" id="resetBtn" style="margin-inline-start:auto">' + ic('refresh','ic-sm') + ' إعادة تعيين البيانات التجريبية</button></div>' +
        '<div class="panel"><div class="panel-head"><h3>' + ic('users') + ' حسابات المشرفين (' + st.admins.length + ')</h3></div>' +
        '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>المشرف</th><th>البريد</th><th>الدور</th><th>الصلاحيات</th><th>إجراءات</th></tr></thead><tbody>' +
        st.admins.map(a =>
          '<tr><td><div class="cell-main">' + avatar(a.name, 'sm') + '<span>' + esc(a.name) +
          (a.main ? ' <span class="badge badge-primary">مالك الحساب</span>' : '') + '</span></div></td>' +
          '<td>' + esc(a.email) + '</td><td>' + esc(a.role) + '</td>' +
          '<td><div class="perm-chips">' + (a.main
            ? '<span class="badge badge-success">كل الصلاحيات</span>'
            : Object.keys(PERM_LABELS).filter(k => a.perms[k]).map(k => '<span class="chip">' + PERM_LABELS[k] + '</span>').join('') || '<span class="chip">بدون صلاحيات</span>') + '</div></td>' +
          '<td><div class="actions-cell">' +
          (a.id === admin.id || a.main ? '<span class="text-muted" style="font-size:12.5px">—</span>'
            : '<button class="icon-btn sm" data-ed="' + a.id + '" title="تعديل">' + ic('edit','ic-sm') + '</button>' +
              '<button class="icon-btn sm danger" data-dl="' + a.id + '" title="حذف">' + ic('trash','ic-sm') + '</button>') +
          '</div></td></tr>'
        ).join('') + '</tbody></table></div></div></div>' +
        '<div class="two-col mt-3">' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('lock') + ' تغيير كلمة مروري</h3></div><div class="panel-body">' +
            '<div class="field"><label>كلمة المرور الحالية</label><input type="password" id="adPwOld"></div>' +
            '<div class="form-grid">' +
              '<div class="field"><label>الجديدة</label><input type="password" id="adPwNew"></div>' +
              '<div class="field"><label>التأكيد</label><input type="password" id="adPwNew2"></div>' +
            '</div>' +
            '<button class="btn btn-dark" id="adPwSave">تحديث كلمة المرور</button></div></div>' +
          '<div class="panel"><div class="panel-head"><h3>' + ic('shield') + ' ملاحظات أمنية</h3></div><div class="panel-body" style="font-size:14px">' +
            '<p class="mb-1">' + ic('check-circle','ic-sm') + ' جميع العمليات الإدارية المهمة تُسجل في سجل النشاط أدناه.</p>' +
            '<p class="mb-1">' + ic('check-circle','ic-sm') + ' كل قسم من أقسام اللوحة محمي بصلاحية مستقلة، ولا يظهر للمشرفين غير المصرح لهم.</p>' +
            '<p class="mb-1">' + ic('check-circle','ic-sm') + ' في النسخة الإنتاجية يُنصح بإضافة تحقق بخطوتين (2FA) وتشفير كلمات المرور (bcrypt).</p>' +
            '<p>' + ic('alert','ic-sm') + ' كلمات المرور هنا محفوظة نصاً لأغراض العرض التجريبي فقط.</p></div></div>' +
        '</div>' +
        '<div class="panel mt-3"><div class="panel-head"><h3>' + ic('activity') + ' سجل العمليات الإدارية (آخر 20)</h3></div>' +
        '<div style="padding:16px"><div class="table-wrap"><table class="data"><thead><tr><th>العملية</th><th>بواسطة</th><th>التاريخ</th></tr></thead><tbody>' +
        st.activity.slice(0, 20).map(a => {
          const who = st.admins.find(x => x.id === a.adminId);
          return '<tr><td>' + esc(a.text) + '</td><td>' + esc(who ? who.name : 'النظام') + '</td><td>' + fmtDate(a.at) + ' — ' + timeAgo(a.at) + '</td></tr>';
        }).join('') + '</tbody></table></div></div></div>';

      $('#addAdminBtn').addEventListener('click', () => admModal(null));
      $$('[data-ed]').forEach(b => b.addEventListener('click', () => admModal(b.dataset.ed)));
      $$('[data-dl]').forEach(b => b.addEventListener('click', () => {
        const a = dbLoad().admins.find(x => x.id === b.dataset.dl);
        confirmAction('حذف حساب المشرف', 'سيتم حذف حساب "' + a.name + '" نهائياً. هل أنت متأكد؟', () => {
          const st2 = dbLoad();
          st2.admins = st2.admins.filter(x => x.id !== a.id);
          dbSave();
          logActivity('حذف حساب المشرف "' + a.name + '"');
          toast('تم حذف الحساب', 'success'); render();
        }, 'حذف');
      }));
      $('#adPwSave').addEventListener('click', () => {
        const o = $('#adPwOld').value, n1 = $('#adPwNew').value, n2 = $('#adPwNew2').value;
        if(o !== admin.password){ toast('كلمة المرور الحالية غير صحيحة', 'error'); return; }
        if(n1.length < 6){ toast('كلمة المرور الجديدة قصيرة', 'error'); return; }
        if(n1 !== n2){ toast('التأكيد غير مطابق', 'error'); return; }
        admin.password = n1; dbSave();
        logActivity('تغيير كلمة مروره الخاصة');
        toast('تم تحديث كلمة المرور', 'success');
        $('#adPwOld').value = $('#adPwNew').value = $('#adPwNew2').value = '';
      });
      $('#resetBtn').addEventListener('click', () => {
        confirmAction('إعادة تعيين البيانات التجريبية', 'سيتم مسح كل التعديلات (طلاب، دورات، مدفوعات...) والعودة للبيانات الأولية. هل أنت متأكد؟', resetDemo, 'إعادة التعيين');
      });
    }

    function admModal(id){
      const st = dbLoad();
      const a = id ? st.admins.find(x => x.id === id) : { id:uid('a'), name:'', email:'', password:'', role:'مشرف', main:false,
        perms:{ students:false, courses:false, finance:false, quizzes:false, content:false, support:false, security:false } };
      admOpen(id ? 'تعديل صلاحيات المشرف' : 'إنشاء حساب مشرف جديد',
        '<div class="form-grid">' +
          '<div class="field"><label>الاسم <span class="req">*</span></label><input id="afName" value="' + esc(a.name) + '"></div>' +
          '<div class="field"><label>المسمى الوظيفي</label><input id="afRole" value="' + esc(a.role) + '"></div>' +
          '<div class="field"><label>البريد الإلكتروني <span class="req">*</span></label><input id="afEmail" value="' + esc(a.email) + '"></div>' +
          '<div class="field"><label>كلمة المرور ' + (id ? '(اتركها فارغة للإبقاء عليها)' : '<span class="req">*</span>') + '</label><input type="text" id="afPass" placeholder="6 أحرف على الأقل"></div>' +
        '</div>' +
        '<label style="font-weight:800;font-size:14px;display:block;margin-bottom:10px">صلاحيات الأقسام</label>' +
        '<div class="form-grid">' + Object.keys(PERM_LABELS).map(k =>
          '<label class="check-row"><input type="checkbox" data-perm="' + k + '" ' + (a.perms[k] ? 'checked' : '') + '> ' + PERM_LABELS[k] + '</label>'
        ).join('') + '</div>',
        '<button class="btn btn-ghost" onclick="closeModal(\'admModal\')">إلغاء</button>' +
        '<button class="btn btn-primary" id="afSave">حفظ الحساب</button>');
      $('#afSave').addEventListener('click', () => {
        const nm = $('#afName').value.trim(), em = $('#afEmail').value.trim(), pw = $('#afPass').value;
        if(nm.length < 3){ toast('أدخل اسم المشرف', 'error'); return; }
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('بريد إلكتروني غير صحيح', 'error'); return; }
        if(st.admins.some(x => x.id !== a.id && x.email.toLowerCase() === em.toLowerCase())){ toast('البريد مستخدم بالفعل', 'error'); return; }
        if(!id && pw.length < 6){ toast('كلمة المرور 6 أحرف على الأقل', 'error'); return; }
        if(id && pw && pw.length < 6){ toast('كلمة المرور الجديدة قصيرة', 'error'); return; }
        a.name = nm; a.email = em; a.role = $('#afRole').value.trim() || 'مشرف';
        if(pw) a.password = pw;
        $$('[data-perm]').forEach(c => a.perms[c.dataset.perm] = c.checked);
        if(!st.admins.some(x => x.id === a.id)) st.admins.push(a);
        dbSave();
        logActivity((id ? 'تعديل صلاحيات' : 'إنشاء حساب') + ' المشرف "' + nm + '"');
        closeModal('admModal'); toast('تم حفظ حساب المشرف', 'success'); render();
      });
    }
  }
};

/* بطاقة إحصائية (مشتركة بين الأقسام) */
function admSC(icon, bg, val, label, trend){
  return '<div class="stat-card"><div class="sc-top"><span class="sc-icon ' + bg + '">' + ic(icon,'ic-lg') + '</span>' +
    (trend ? '<span class="sc-trend text-success">' + trend + '</span>' : '') + '</div>' +
    '<div class="sc-val">' + val + '</div><div class="sc-label">' + label + '</div></div>';
}
