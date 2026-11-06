/* ============================================================
   منصة طاهر البيلي — منطق الصفحة الرئيسية
   ============================================================ */
(function(){
  initPublicPage('home');

  /* الهوية: أيقونات الشعار والأقسام */
  $('#logoMark').innerHTML = ic('grad-cap');
  $('#logoMarkF').innerHTML = ic('grad-cap');
  $('#burger').innerHTML = ic('menu');
  $('#arr1').innerHTML = ic('arrow-left','ic-sm');
  $('#soTw').innerHTML = ic('twitter');
  $('#soFb').innerHTML = ic('facebook');
  $('#soIg').innerHTML = ic('instagram');
  $('#soLi').innerHTML = ic('linkedin');
  $('#soYt').innerHTML = ic('youtube');
  $('#fcMail').innerHTML = ic('mail','ic-sm') + '<span id="ftEmail"></span>';
  $('#fcPhone').innerHTML = ic('phone','ic-sm') + '<span id="ftPhone"></span>';
  $('#fcAddr').innerHTML = ic('map-pin','ic-sm') + '<span id="ftAddress"></span>';
  /* نصوص Hero من إعدادات الإدارة */
  const st = dbLoad().settings;
  $('#heroTag').innerHTML = ic('zap','ic-sm') + ' منصة تعليمية عربية متكاملة';
  $('#heroTitle').innerHTML = esc(st.heroTitle).replace('مهارة', 'مهارة <span class="grad">');
  $('#heroTitle').innerHTML = $('#heroTitle').innerHTML.replace('المهني', 'المهني</span>');
  $('#heroSubtitle').textContent = st.heroSubtitle;
  $('#heroBtn').innerHTML = esc(st.heroBtn) + ' ' + ic('arrow-left','ic-sm');

  const kickers = { k1:'دوراتنا', k2:'مميزاتنا', k3:'كيف تبدأ', k4:'آراء الطلاب', k5:'المدونة', k6:'أسئلة وأجوبة' };
  Object.keys(kickers).forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = ic('zap','ic-sm') + ' ' + kickers[id]; });

  /* الدورات المميزة: الأعلى تقييماً */
  const featured = liveCourses().filter(c => c.ratingCount > 0).sort((a, b) => b.rating - a.rating).slice(0, 3);
  $('#featuredGrid').innerHTML = featured.map(c => courseCardHtml(c,
    '<a class="btn btn-primary btn-sm" href="courses.html?open=' + c.id + '">تفاصيل الدورة</a>' +
    '<a class="btn btn-ghost btn-sm" href="lesson.html?course=' + c.id + '">' + ic('play','ic-sm') + ' معاينة</a>'
  )).join('');
  if(!featured.length){ $('#featured').classList.add('hidden'); }

  /* مميزات المنصة */
  const features = [
    { icon:'video', bg:'bg-blue', t:'فيديوهات تعليمية عالية الجودة', p:'دروس مرئية منظمة تسير من الأساسيات إلى التطبيق العملي، مع إمكانية المشاهدة في أي وقت ومن أي جهاز.' },
    { icon:'trending', bg:'bg-teal', t:'متابعة تقدمك خطوة بخطوة', p:'نسبة إنجاز واضحة لكل دورة، وحفظ تلقائي لمكان توقفك، وقائمة دروس تتابع إنجازك بها.' },
    { icon:'target', bg:'bg-amber', t:'اختبارات وتقييم فوري', p:'اختبارات تفاعلية بعد الوحدات مع درجات ونتائج فورية تساعدك على قياس فهمك بنفسك.' },
    { icon:'award', bg:'bg-violet', t:'شهادات إتمام الدورات', p:'أكمل جميع الدروس واحصل على شهادة إلكترونية باسمك قابلة للطباعة والمشاركة.' },
    { icon:'message', bg:'bg-rose', t:'دعم فني ومناقشات', p:'قسم أسئلة ونقاش لكل دورة، وفريق دعم يرد على استفساراتك خلال 24 ساعة.' },
    { icon:'shield', bg:'bg-navy', t:'إدارة احترافية للمحتوى', p:'فريق الإدارة يحدّث المحتوى ويضيف دورات جديدة باستمرار لضمان جودة ما يصل إليك.' }
  ];
  $('#featuresGrid').innerHTML = features.map(f =>
    '<div class="feature-card"><div class="feature-icon ' + f.bg + '">' + ic(f.icon,'ic-lg') + '</div>' +
    '<h3>' + f.t + '</h3><p>' + f.p + '</p></div>'
  ).join('');

  /* خطوات البدء */
  const steps = [
    { t:'أنشئ حسابك مجاناً', p:'سجّل بالاسم والبريد الإلكتروني في أقل من دقيقة وابدأ فوراً.' },
    { t:'اختر دورتك المناسبة', p:'تصفح الدورات حسب المجال والمستوى والسعر واقرأ تجارب الطلاب.' },
    { t:'شاهد وتدرّب بالتدريج', p:'تابع الدروس بالترتيب، أكمل تمارينها، وتتبع نسبة تقدمك لحظياً.' },
    { t:'اختبر نفسك واحصل على شهادتك', p:'أدِّ الاختبار، أكمل كل الدروس، واستلم شهادتك الإلكترونية.' }
  ];
  $('#stepsRow').innerHTML = steps.map((s, i) =>
    '<div class="step"><div class="num">' + (i + 1) + '</div><h3>' + s.t + '</h3><p>' + s.p + '</p></div>'
  ).join('');

  /* شريط الإحصائيات (أرقام قابلة للتعديل من لوحة الإدارة) */
  const sst = st.stats;
  const stats = [
    { v:sst.students, suffix:'+', label:'طالب وطالبة انضموا إلينا' },
    { v:liveCourses().length, suffix:'', label:'دورة منشورة حالياً' },
    { v:sst.hours, suffix:'+', label:'ساعة تدريبية عربية' },
    { v:sst.satisfaction, suffix:'%', label:'نسبة رضا الطلاب' }
  ];
  $('#statsBand').innerHTML = stats.map(s =>
    '<div class="stat"><b><span class="cnt" data-target="' + s.v + '">0</span>' + s.suffix + '</b><span>' + s.label + '</span></div>'
  ).join('');

  /* عدّادات الهيرو من إعدادات الإدارة */
  [['cntStudents', sst.students], ['cntHours', sst.hours], ['cntSat', sst.satisfaction]].forEach(function(hc){
    const el = document.getElementById(hc[0]);
    if(el) el.dataset.cnt = hc[1];
  });

  /* المقالات */
  const newsColors = [['#2563eb','#14b8a6','zap'], ['#7c3aed','#2563eb','cpu'], ['#0d9488','#22d3ee','trending']];
  $('#newsGrid').innerHTML = dbLoad().news.slice(0, 3).map((n, i) => {
    const cc = newsColors[i % 3];
    return '<article class="news-card"><div class="news-cover" style="background:linear-gradient(135deg,' + cc[0] + ',' + cc[1] + ')">' + ic(cc[2],'ic-lg') + '</div>' +
      '<div class="news-body"><span class="chip">' + ic('calendar','ic-sm') + ' ' + fmtDate(n.at) + '</span>' +
      '<h3>' + esc(n.title) + '</h3><p>' + esc(n.excerpt) + '</p></div></article>';
  }).join('');
  if(!dbLoad().news.length){ $('#news').classList.add('hidden'); }

  /* الأسئلة الشائعة */
  $('#faqList').innerHTML = dbLoad().faqs.map(f =>
    '<details class="faq-item"><summary>' + esc(f.q) + ic('chev-down') + '</summary><p class="faq-a">' + esc(f.a) + '</p></details>'
  ).join('');

  /* عدد الدورات في الهيرو */
  const coursesCnt = $('[data-cnt-courses]');
  if(coursesCnt) coursesCnt.textContent = fmtNum(liveCourses().length);

  /* عدّاد متحرك عند الظهور */
  const counters = $$('.cnt, [data-cnt]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if(!en.isIntersecting) return;
      io.unobserve(en.target);
      const target = +(en.target.dataset.target || en.target.dataset.cnt || 0);
      const t0 = performance.now(), dur = 1400;
      (function tick(t){
        const k = Math.min((t - t0) / dur, 1);
        en.target.textContent = fmtNum(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if(k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold:.4 });
  counters.forEach(c => io.observe(c));
})();
