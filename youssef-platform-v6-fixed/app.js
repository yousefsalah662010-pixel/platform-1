let me = null, courses = [], timerInt = null, examInt = null,
    examAnswers = {}, examData = null, examStart = 0, currentCourse = null, currentViewed = [];
const WA_NUMBER = '201283674859';

const esc = s => String(s??'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const waLink = t => 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(t);
const goTo = id => { document.getElementById(id).scrollIntoView({behavior:'smooth'}); };
const fmtTime = s => { const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);
  return (h?h+' ساعة ':'')+(m?m+' دقيقة ':'')+x+' ثانية'; };

// ═══ نظام تتبع الفيديو ثانية بثانية ═══
// بيتتبع كل ثانية اتشاهدت فعلاً — الثواني اللي بيتسكيبها الطالب مش بتتعد،
// فميركّبش "تمت المشاهدة" إلا لو اتفرج على ~97% من الفيديو ووصل للآخر.
function lessonVideosOf(l){
  let vids = l.videos || [];
  if(vids.length === 0 && l.video_url) vids = [{id:0, lesson_id:l.id, title:'', video_url:l.video_url, description:''}];
  return vids;
}

const VideoTracker = (function(){
  const players = {};
  let ytResolve = null;
  if(typeof window !== 'undefined'){
    window.onYouTubeIframeAPIReady = function(){ if(ytResolve) ytResolve(); };
  }
  function ytReady(){
    if(window.YT && window.YT.Player) return Promise.resolve();
    return new Promise(res => {
      ytResolve = res;
      const iv = setInterval(() => {
        if(window.YT && window.YT.Player){ clearInterval(iv); res(); }
      }, 400);
    });
  }
  function ytId(url){ const m = String(url||'').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : null; }

  function start(o){
    // o: {lessonId, videoId, url, elId, alreadyCompleted, onVideoComplete, onLessonComplete}
    const key = o.lessonId+'-'+o.videoId;
    stop(key);
    const t = {lessonId:o.lessonId, videoId:o.videoId, url:o.url, elId:o.elId,
      type:null, dur:0, watched:new Set(), lastSec:-1, lastSent:0,
      completed:!!o.alreadyCompleted, ytPlayer:null, timer:null,
      onVideoComplete:o.onVideoComplete, onLessonComplete:o.onLessonComplete};
    players[key] = t;
    const yid = ytId(o.url);
    if(yid){
      t.type = 'yt';
      ytReady().then(() => {
        try {
          t.ytPlayer = new YT.Player(o.elId, {
            videoId: yid,
            events: {
              onReady: () => { try { t.dur = Math.floor(t.ytPlayer.getDuration()||0); } catch(_){} },
              onStateChange: (e) => {
                if(e.data === 0){ // انتهى — اضمن آخر الثواني واعمل flush
                  if(t.dur){ for(let s=Math.max(0,t.lastSec); s<=t.dur-1; s++) t.watched.add(s); t.lastSec = t.dur-1; }
                  flush(key);
                } else if(e.data === 2){ // وقفة — حدّث واعمل flush
                  tick(key); flush(key);
                } else { tick(key); }
              }
            }
          });
        } catch(_){ /* تجاهل */ }
      });
      t.timer = setInterval(() => tick(key), 1000);
    } else {
      t.type = 'html5';
      const el = document.getElementById(o.elId);
      if(!el) return;
      el.addEventListener('loadedmetadata', () => { t.dur = Math.floor(el.duration||0); });
      el.addEventListener('timeupdate', () => tick(key));
      el.addEventListener('ended', () => flush(key));
    }
  }

  function tick(key){
    const t = players[key]; if(!t) return;
    let cur = -1;
    try {
      if(t.type === 'yt' && t.ytPlayer && t.ytPlayer.getCurrentTime){
        const st = t.ytPlayer.getPlayerState ? t.ytPlayer.getPlayerState() : 1;
        if(st !== 1) return; // 1 = بيتشغل
        cur = Math.floor(t.ytPlayer.getCurrentTime()||0);
      } else if(t.type === 'html5'){
        const el = document.getElementById(t.elId); if(!el || el.paused) return;
        cur = Math.floor(el.currentTime||0);
      } else return;
    } catch(_){ return; }
    if(t.dur && cur >= t.dur) cur = t.dur - 1;
    if(cur < 0) return;
    const gap = cur - t.lastSec;
    if(gap >= 0 && gap <= 2){
      for(let s = Math.max(0, t.lastSec); s <= cur; s++) t.watched.add(s); // تشغيل متواصل
    } else {
      t.watched.add(cur); // seek — الثواني اللي اتسكيبت مش بتتعد
    }
    t.lastSec = cur;
    updateProgressUI(t);
    const now = Math.floor(Date.now()/1000);
    if(now - t.lastSent >= 8) flush(key);
  }

  async function flush(key){
    const t = players[key]; if(!t || !t.dur) return;
    t.lastSent = Math.floor(Date.now()/1000);
    try {
      const r = await fetch('/api/video-progress', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({lesson_id:t.lessonId, video_id:t.videoId, watched_seconds:t.watched.size, duration:t.dur, last_position:t.lastSec})});
      const d = await r.json();
      if(d.videoCompleted && !t.completed){
        t.completed = true;
        updateProgressUI(t, true);
        if(t.onVideoComplete) t.onVideoComplete(t.videoId);
      }
      if(d.lessonViewed && t.onLessonComplete) t.onLessonComplete(t.lessonId);
    } catch(_){}
  }

  function updateProgressUI(t, forceFull){
    const bar = document.getElementById('vbar-'+t.lessonId+'-'+t.videoId);
    const pct = document.getElementById('vpct-'+t.lessonId+'-'+t.videoId);
    const badge = document.getElementById('vbadge-'+t.lessonId+'-'+t.videoId);
    if(!t.dur) return;
    const p = forceFull || t.completed ? 100 : Math.min(100, Math.round(t.watched.size/t.dur*100));
    if(bar) bar.style.width = p+'%';
    if(pct) pct.textContent = p+'%';
    if(badge){
      if(t.completed){
        badge.textContent = '✅ تمت المشاهدة';
        badge.className = 'vidBadge done';
      } else if(p > 0){
        badge.textContent = '⏳ '+p+'%';
        badge.className = 'vidBadge wip';
      }
    }
  }

  function stop(key){
    const t = players[key]; if(!t) return;
    if(t.timer) clearInterval(t.timer);
    try { if(t.ytPlayer && t.ytPlayer.destroy) t.ytPlayer.destroy(); } catch(_){}
    delete players[key];
  }
  function stopAll(){ Object.keys(players).forEach(stop); }
  return { start, stop, stopAll, flush };
})();

function switchTab(t){
  document.getElementById('tabLogin').classList.toggle('active', t==='login');
  document.getElementById('tabSignup').classList.toggle('active', t==='signup');
  document.getElementById('loginForm').classList.toggle('hidden', t!=='login');
  document.getElementById('signupForm').classList.toggle('hidden', t!=='signup');
}

// لما السيرفر مش بيرد JSON أصلاً (404 / function مش منشورة / build فشل)
// بنحاول نجيب التشخيص من /api/health، ولو فشل نظهر رسالة بتقول افتحها بنفسك
async function serverDownMsg(containerId){
  let msg = 'السيرفر مش شغال — افتح الرابط ده في المتصفح لمعرفة السبب: /api/health';
  try {
    const h = await fetch('/api/health');
    const d = await h.json();
    if(d && d.msg) msg = d.msg + (d.detail ? ' — '+d.detail : '');
  } catch(e){ /* health كمان فشل → خلي الرسالة الافتراضية */ }
  const el = document.getElementById(containerId);
  if(el) el.innerHTML = '<div class="error">'+esc(msg)+'</div>';
}

async function doLogin(e){
  e.preventDefault();
  try {
    const r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:loginEmail.value, pass:loginPass.value})});
    const d = await r.json();
    if(d.ok) location.reload();
    else document.getElementById('loginMsg').innerHTML = '<div class="error">'+esc(d.msg)+'</div>';
  } catch(err){
    serverDownMsg('loginMsg');
  }
}

async function doSignup(e){
  e.preventDefault();
  const body = {first:suFirst.value,last:suLast.value,phone:suPhone.value,parent:suParent.value,
    email:suEmail.value,pass:suPass.value,grade:suGrade.value,gender:suGender.value};
  try {
    const r = await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d = await r.json();
    if(d.ok) location.reload();
    else document.getElementById('signupMsg').innerHTML = '<div class="error">'+esc(d.msg)+'</div>';
  } catch(err){
    serverDownMsg('signupMsg');
  }
}

async function doLogout(){ await fetch('/api/logout',{method:'POST'}); location.reload(); }

function showApp(){
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  renderProfile(); loadReplies(); loadBooks(); loadNotifs();
  loadStudentsCount();
  setInterval(loadNotifs, 25000);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

async function loadNotifs(){
  try {
    const d = await fetch('/api/notifications').then(r=>r.json());
    const b = document.getElementById('nBadge');
    if(d.unread > 0){ b.textContent = d.unread > 99 ? '99+' : d.unread; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  } catch(e){}
}

async function openNotifs(){
  document.getElementById('notifPanel').classList.remove('hidden');
  const d = await fetch('/api/notifications').then(r=>r.json());
  document.getElementById('notifList').innerHTML = d.rows.length ? d.rows.map(n=>
    `<div class="notifRow ${n.read?'':'unread'}">${esc(n.text)}
      <div class="tm">${new Date(n.created_at).toLocaleString('ar-EG')}</div></div>`).join('')
    : '<div class="noReply">مفيش إشعارات لسه</div>';
  await fetch('/api/notifications/read',{method:'POST'});
  document.getElementById('nBadge').classList.add('hidden');
}

function closeNotifs(){
  document.getElementById('notifPanel').classList.add('hidden');
  loadNotifs();
}

function renderProfile(){
  const u = me.user;
  const enrolls = me.enrollments.map(e=>{
    const c = courses.find(x=>x.id===e.course_id);
    const active = new Date(e.expires_at) > new Date();
    return `<div class="profileRow"><span class="lbl">${esc(c?c.name:'كورس')}</span>
      <span class="val">${active?'✅ ساري لـ '+new Date(e.expires_at).toLocaleDateString('ar-EG'):'⌛ منتهي'}</span></div>`;
  }).join('');
  const myBooks = (me.books||[]).map(b=>{
    const bk = allBooks.find(x=>x.id===b.book_id);
    return `<div class="profileRow"><span class="lbl">📖 ${esc(bk?bk.title:'كتاب')}</span>
      <span class="val">✅ مفعّل</span></div>`;
  }).join('');
  document.getElementById('profileCard').innerHTML = `
    ${u.profile_pic ? `<img src="${u.profile_pic}" class="avatar" alt="">` : `<div class="avatarPh">👤</div>`}
    <input type="file" accept="image/*" id="picInput" class="hidden" onchange="pickPic(this); document.getElementById('picName').textContent = this.files[0] ? '✅ ' + this.files[0].name : 'لم يتم اختيار صورة بعد';">
    <button onclick="document.getElementById('picInput').click()" class="miniBtn">📸 تغيير صورتي</button>
    <div id="picName" style="font-size:12px;color:var(--text-mute);margin-bottom:15px;">لم يتم اختيار صورة بعد</div>
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:15px;">محاولاتك المتبقية للتراكم: <b style="color:${u.attempts_left>1?'#6ee7b7':'#fda4af'}">${u.attempts_left ?? 3}</b></div>
    <button onclick="openChangePass()" class="miniBtn" style="margin-bottom:20px;">🔒 تغيير كلمة المرور</button>
    <div class="profileRow"><span class="lbl">الاسم</span><span class="val">${esc(u.first_name+' '+u.last_name)}</span></div>
    <div class="profileRow"><span class="lbl">رقم الهاتف</span><span class="val">${esc(u.phone)}</span></div>
    <div class="profileRow"><span class="lbl">هاتف ولي الأمر</span><span class="val">${esc(u.parent_phone)}</span></div>
    <div class="profileRow"><span class="lbl">البريد الإلكتروني</span><span class="val">${esc(u.email)}</span></div>
    <div class="profileRow"><span class="lbl">السنة الدراسية</span><span class="val">${esc(u.grade)}</span></div>
    <div class="profileRow"><span class="lbl">النوع</span><span class="val">${esc(u.gender)}</span></div>
    ${enrolls?'<h3 style="margin:20px 0 5px;color:#c4b5fd;text-align:right;font-weight:700;">اشتراكاتي:</h3>'+enrolls:''}
    ${myBooks?'<h3 style="margin:20px 0 5px;color:#c4b5fd;text-align:right;font-weight:700;">كتبي:</h3>'+myBooks:''}`;
  const hp = document.getElementById('headerPic');
  if(u.profile_pic) hp.src = u.profile_pic;
}

function pickPic(input){
  const file = input.files[0];
  if(!file) return;
  const rd = new FileReader();
  rd.onload = e => {
    const img = new Image();
    img.onload = async () => {
      const c = document.createElement('canvas');
      c.width = 300; c.height = 300;
      const min = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, 300, 300);
      const data = c.toDataURL('image/jpeg', .75);
      const r = await fetch('/api/upload-pic',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({pic:data})});
      const d = await r.json();
      if(d.ok) renderProfile();
      else alert(d.msg || 'فشل رفع الصورة');
    };
    img.src = e.target.result;
  };
  rd.readAsDataURL(file);
}

let allBooks = [];

async function loadBooks(){
  allBooks = await fetch('/api/books').then(r=>r.json());
  document.getElementById('booksGrid').innerHTML = allBooks.length ? allBooks.map(b=>{
    const owned = (me.books||[]).some(x=>x.book_id===b.id);
    let bottom = '';
    if(owned){
      bottom = `<div class="unlockedBadge">✅ تفعيلك ساري</div>
        ${b.pdf_url?`<a class="pdfLink" href="${esc(b.pdf_url)}" target="_blank">⬇️ افتح الكتاب PDF</a>`:'<p style="font-size:12px;color:var(--text-mute);margin-top:8px;">الملف هيضاف قريب</p>'}`;
    } else {
      bottom = `<div class="codeArea">
          <label>عندك رمز التفعيل؟</label>
          <div class="codeRow">
            <input id="bcode-${b.id}" placeholder="رمز الكتاب">
            <button onclick="activateBook(${b.id})">تفعيل</button>
          </div>
          <div class="codeMsg" id="bmsg-${b.id}"></div>
        </div>
        <button class="btnSub" style="margin-top:15px;" onclick="buyBook(${b.id})">💰 شراء الكتاب</button>`;
    }
    return `<div class="courseCard">
      <div class="courseImg" style="background:linear-gradient(135deg,#fbbf24,#f59e0b)">${b.emoji||'📖'}</div>
      <div class="courseBody">
        <h3>${esc(b.title)}</h3>
        <p class="desc">${esc(b.description||'')}</p>
        <div class="price">${b.price} جنيه</div>
        ${bottom}
      </div>
    </div>`;
  }).join('') : '<div class="noReply">مفيش كتب متاحة لسه</div>';
}

function buyBook(id){
  const b = allBooks.find(x=>x.id===id);
  window.open(waLink(`أنا ${me.user.first_name} أريد شراء كتاب ${b.title}`));
}

async function activateBook(bookId){
  const msg = document.getElementById('bmsg-'+bookId);
  const code = document.getElementById('bcode-'+bookId).value.trim();
  const r = await fetch('/api/activate-book',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({bookId, code})});
  const d = await r.json();
  if(d.ok){ msg.style.color='#6ee7b7'; msg.textContent='✅ تم تفعيل الكتاب!'; setTimeout(()=>{loadBooks();renderProfile();},900); }
  else { msg.style.color='#fda4af'; msg.textContent='❌ '+esc(d.msg); }
}

async function loadCourses(){
  const [cs, m] = await Promise.all([
    fetch('/api/courses').then(r=>r.json()),
    fetch('/api/me').then(r=>r.json())
  ]);
  courses = cs; me = m;
  renderProfile();
  document.getElementById('coursesGrid').innerHTML = courses.map(c=>{
    const enr = me.enrollments.find(e=>e.course_id===c.id);
    const active = enr && new Date(enr.expires_at) > new Date();
    const expired = enr && !active;
    let bottom = '';
    if(active){
      bottom = `<div class="unlockedBadge">✅ أنت مشترك — الاشتراك ساري</div>
        <button class="btnEnter" onclick="openCourse(${c.id})">🚀 ادخل الكورس</button>`;
    } else if(expired){
      bottom = `<div class="expiredBadge">⌛ انتهى شهر الاشتراك — كلم المدير للتجديد</div>`;
    } else {
      bottom = `<div class="codeArea">
          <label>عندك رمز؟ اكتبه هنا بعد ما تدفع:</label>
          <div class="codeRow">
            <input id="code-${c.id}" placeholder="رمز الدخول">
            <button onclick="activate(${c.id})">تفعيل</button>
          </div>
          <div class="codeMsg" id="msg-${c.id}"></div>
        </div>
        <button class="btnSub" style="margin-top:15px;" onclick="subscribeCourse(${c.id})">💰 الاشتراك في الكورس</button>`;
    }
    return `<div class="courseCard">
      <div class="courseImg" style="background:${c.color}">${c.emoji}</div>
      <div class="courseBody">
        <h3>${esc(c.name)}</h3>
        <p class="desc">${esc(c.description)}</p>
        <div class="price">${c.price} جنيه</div>
        ${bottom}
      </div>
    </div>`;
  }).join('');
}

function subscribeCourse(id){
  const c = courses.find(x=>x.id===id);
  window.open(waLink(`أنا ${me.user.first_name} أريد الاشتراك في كورس ${c.name}`));
}

function whatsappGeneral(){
  window.open(waLink(`أنا ${me.user.first_name} أريد الاستفسار عن الدفع والاشتراكات`));
}

async function activate(courseId){
  const msg = document.getElementById('msg-'+courseId);
  const code = document.getElementById('code-'+courseId).value.trim();
  const r = await fetch('/api/activate',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({courseId, code})});
  const d = await r.json();
  if(d.ok){ msg.style.color='#6ee7b7'; msg.textContent='✅ تم التفعيل! الكورس اتفتح'; setTimeout(loadCourses,900); }
  else { msg.style.color='#fda4af'; msg.textContent='❌ '+esc(d.msg); }
}

function videoPlaceholder(l, v){
  const elId = 'vp-'+l.id+'-'+v.id;
  const m = String(v.video_url||'').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  if(m) return `<div class="vplayerWrap"><div id="${elId}"></div></div>`; // YouTube API بتعمل replace للـ div
  return `<div class="vplayerWrap"><video id="${elId}" controls preload="metadata"><source src="${esc(v.video_url)}"></video></div>`;
}

function lessonHTML(l, viewed){
  const vids = lessonVideosOf(l);
  const vcount = vids.length;
  let media = '';
  if(vcount === 0){
    media = `<div class="videoBox"><div class="icon">🎬</div>مفيش فيديوهات في الدرس ده لسه</div>`;
  } else {
    media = vids.map((v,i) => {
      const p = v.progress || null;
      const done = !!(p && p.completed);
      const pct = (p && p.duration) ? Math.min(100, Math.round((p.watched_seconds||0)/p.duration*100)) : 0;
      const badge = done ? `<span class="vidBadge done">✅ تمت المشاهدة</span>`
                         : (pct>0 ? `<span class="vidBadge wip">⏳ ${pct}%</span>` : `<span class="vidBadge wip">لم تُشاهد بعد</span>`);
      return `<div class="vidRow">
        <div class="vidTitle">${vcount>1?(i+1)+'. ':''}${v.title?esc(v.title):'فيديو'} ${badge}</div>
        ${videoPlaceholder(l, v)}
        <div class="vidProgress"><div id="vbar-${l.id}-${v.id}" style="width:${done?100:pct}%"></div></div>
        <div class="vidPct" id="vpct-${l.id}-${v.id}">${done?100:pct}%</div>
        <div class="watchHint">⚠️ لازم تتفرج على الفيديو كامل (كل ثانية) — الـ skip مش بيتعد، ومش هيكتمل إلا لما تخلصه 100%.</div>
        ${v.description?`<p style="color:var(--text-dim);font-size:13px;line-height:1.7;margin-top:8px;">${esc(v.description)}</p>`:''}
      </div>`;
    }).join('');
  }
  return `<div class="lesson">
    <h4 id="lh-${l.id}">${viewed?'<span class="watchBadge">✅ تم السماع</span> — ':''}${esc(l.title)}${vcount?` <small style="color:var(--text-mute);font-weight:400;font-size:13px;">(${vcount} ${vcount===1?'فيديو':'فيديوهات'})</small>`:''}</h4>
    <div id="vw-${l.id}" class="videoWrap hidden">${media}${l.description?'<p style="margin-top:10px;">'+esc(l.description)+'</p>':''}</div>
    <button class="btnLesson" id="btn-${l.id}" onclick="openLesson(${l.id}, ${viewed?1:0})">▶️ افتح الدرس${vcount?' ('+vcount+' فيديو)':''}</button>
  </div>`;
}

async function openLesson(id, already){
  const wrap = document.getElementById('vw-'+id);
  if(wrap) wrap.classList.remove('hidden');
  const btn = document.getElementById('btn-'+id);
  if(btn) btn.classList.add('hidden');
  const lesson = courseData.find(l => l.id === id);
  if(!lesson) return;
  const vids = lessonVideosOf(lesson);
  if(vids.length === 0){
    // درس ملوش فيديوهات → السيرفر بيوافق على الاكتمال فوراً
    await fetch('/api/lesson-viewed',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({lesson_id:id})});
    markLessonViewedUI(id);
    return;
  }
  // ابدأ تتبع كل فيديو — الصح بيتحط أوتوماتيك لما كل الفيديوهات تكتمل 100%
  vids.forEach(v => {
    VideoTracker.start({
      lessonId:id, videoId:v.id, url:v.video_url, elId:'vp-'+id+'-'+v.id,
      alreadyCompleted: !!(v.progress && v.progress.completed),
      onVideoComplete: () => {},
      onLessonComplete: (lid) => markLessonViewedUI(lid)
    });
  });
}

function markLessonViewedUI(id){
  if(currentViewed.includes(id)) return;
  currentViewed.push(id);
  // حدّث عنوان الدرس بس بشارة الصح (من غير re-render عشان مش هدمّر الفيديوهات اللي شغالة)
  const lesson = courseData.find(l => l.id === id);
  const h = document.getElementById('lh-'+id);
  if(h && lesson){
    const vids = lessonVideosOf(lesson);
    const vcount = vids.length;
    const small = vcount ? ` <small style="color:var(--text-mute);font-weight:400;font-size:13px;">(${vcount} ${vcount===1?'فيديو':'فيديوهات'})</small>` : '';
    h.innerHTML = '<span class="watchBadge">✅ تم السماع</span> — ' + esc(lesson.title) + small;
  }
  // حدّث شريط التقدّم العلوي
  const total = courseData.length;
  const done = courseData.filter(l => currentViewed.includes(l.id)).length;
  const pct = total ? Math.round(done/total*100) : 0;
  const txt = document.getElementById('cpProgressText');
  const bar = document.getElementById('cpProgressBar');
  if(txt) txt.textContent = `أنت سمّعت ${done} من ${total} درس (${pct}%)`;
  if(bar) bar.style.width = pct+'%';
}

function renderLessons(){
  const box = document.getElementById('cpLessons');
  const total = courseData.length;
  const done = courseData.filter(l=>currentViewed.includes(l.id)).length;
  const pct = total ? Math.round(done/total*100) : 0;
  box.innerHTML = `<div id="cpProgressText" style="margin-bottom:15px;font-weight:700;color:#c4b5fd;text-align:center;">
      أنت سمّعت ${done} من ${total} درس (${pct}%)</div>
    <div class="progressBar"><div id="cpProgressBar" style="width:${pct}%"></div></div>` +
    (courseData.length ? courseData.map(l=>lessonHTML(l, currentViewed.includes(l.id))).join('')
      : '<div class="noReply">مفيش دروس لسه</div>');
}

function cpTab(t){
  ['lessons','exam','honor'].forEach(x=>{
    document.getElementById('cpTab-'+x).classList.toggle('active', x===t);
    document.getElementById('cp'+x.charAt(0).toUpperCase()+x.slice(1)).classList.toggle('hidden', x!==t);
  });
  if(t==='exam') loadExam();
  if(t==='honor') loadHonor();
}

let courseData = [];

async function openCourse(id){
  currentCourse = id;
  const r = await fetch('/api/course/'+id);
  if(!r.ok){ const d = await r.json(); alert(d.error); return; }
  const d = await r.json();
  const c = courses.find(x=>x.id===id);
  document.getElementById('cpTitle').textContent = c.name;
  courseData = d.lessons;
  currentViewed = d.viewed || [];
  renderLessons();
  document.getElementById('coursePage').classList.remove('hidden');
  cpTab('lessons');
  window.scrollTo(0,0);
}

function closeCourse(){
  clearInterval(timerInt); clearInterval(examInt);
  VideoTracker.stopAll();
  document.getElementById('coursePage').classList.add('hidden');
  loadCourses();
}

const typeNames = {mcq:'اختيار من متعدد', truefalse:'صح وغلط', order:'ترتيب', essay:'مقالي'};

async function loadExam(){
  const box = document.getElementById('cpExam');
  box.innerHTML = '<div class="noReply">جاري التحميل...</div>';
  const r = await fetch('/api/exam/'+currentCourse);
  examData = await r.json();
  if(examData.status==='none'){
    box.innerHTML = '<div class="noReply">مفيش امتحان متاح في الكورس ده حاليًا</div>'; return;
  }
  if(examData.status==='closed'){
    box.innerHTML = '<div class="noReply">🔒 الامتحان مقفول حاليًا — استنى إعلان المدير</div>'; return;
  }
  if(examData.status==='results'){
    box.innerHTML = `<div class="noReply">📊 نتائج الامتحان ظهرت في <b>لوحة الشرف 🏆</b> — انتقل ليها من فوق!</div>`; return;
  }
  if(examData.status==='submitted'){
    box.innerHTML = `<div class="examIntro"><h3>✅ سلمت الامتحان</h3>
      <p>درجتك الحالية: <b>${examData.score}</b>${examData.essayPending?'<br><small style="color:var(--gold);">فيه سؤال مقالي هيصححه المدير — الدرجة النهائية تظهر في لوحة الشرف</small>':''}</p></div>`;
    return;
  }
  examAnswers = {}; examStart = Date.now();
  box.innerHTML = `
    <div class="examIntro" style="margin-bottom:20px;">
      <h3>📝 ${esc(examData.examTitle)}</h3>
      <p>مدة الامتحان: <b>${examData.duration} دقيقة</b> — بمجرد ما تدوس "بدأ" العداد هيبدأ ومش هيتوقف!</p>
      <p style="color:#fda4af;font-weight:700;">سلم مرة واحدة بس — مفيش رجوع!</p>
      <button class="btnMain" style="max-width:250px;" onclick="beginExam()">🚀 بدأ الامتحان</button>
    </div>
    <div id="examQuestions" class="hidden"></div>`;
}

function beginExam(){
  document.getElementById('examQuestions').classList.remove('hidden');
  renderExamQuestions();
  let left = examData.duration * 60;
  const tEl = document.getElementById('cpTitle');
  examInt = setInterval(()=>{
    left--;
    if(left<=0){ clearInterval(examInt); submitExam(true); return; }
    const m=Math.floor(left/60), s=left%60;
    if(tEl) tEl.textContent = '⏰ ' + m + ':' + String(s).padStart(2,'0');
  }, 1000);
  window.scrollTo(0,0);
}

function renderExamQuestions(){
  const box = document.getElementById('examQuestions');
  box.innerHTML = examData.questions.map((q,i)=>{
    let body = '';
    if(q.type==='mcq'){
      body = (q.options||[]).map((op,j)=>
        `<div class="optRow" onclick="pick(${q.id},'${esc(String.fromCharCode(65+j))}',this)">
          <input type="radio" name="q${q.id}"><span>${esc(op)}</span></div>`).join('');
    } else if(q.type==='truefalse'){
      body = `<div class="optRow" onclick="pick(${q.id},'صح',this)"><input type="radio" name="q${q.id}"><span>✅ صح</span></div>
              <div class="optRow" onclick="pick(${q.id},'غلط',this)"><input type="radio" name="q${q.id}"><span>❌ غلط</span></div>`;
    } else if(q.type==='order'){
      body = `<div id="ord-${q.id}">` + (q.items||[]).map((it,j)=>
        `<div class="ordRow" draggable="true" ondragstart="dragS(event)" ondragover="event.preventDefault()"
          ondrop="dropOrd(event,'${q.id}')"><span class="num">${j+1}</span><span>${esc(it)}</span></div>`).join('') + `</div>
        <small style="color:var(--text-mute);">اسحب العناصر لإعادة ترتيبها (الأول فوق)</small>`;
    } else if(q.type==='essay'){
      body = `<textarea class="essayTa" oninput="examAnswers[${q.id}]=examAnswers[${q.id}]||{}; examAnswers[${q.id}].value=this.value"
        placeholder="اكتب إجابتك هنا..."></textarea>`;
    }
    return `<div class="qCard">
      <span class="qNum">سؤال ${i+1} — ${q.points} درجة</span><span class="qType">${typeNames[q.type]||''}</span>
      <h4>${esc(q.text)}</h4>
      ${body}
    </div>`;
  }).join('') + `<button class="btnSubmitExam" onclick="submitExam(false)">📨 تسليم الامتحان</button>`;
}

function pick(qid, val, el){
  examAnswers[qid] = {value: val};
  const card = el.closest('.qCard');
  card.querySelectorAll('.optRow').forEach(r=>r.classList.remove('sel'));
  el.classList.add('sel');
}

let dragEl = null;

function dragS(e){ dragEl = e.target; }

function dropOrd(e, qid){
  e.preventDefault();
  const cont = document.getElementById('ord-'+qid);
  if(!dragEl || !cont || dragEl.parentElement!==cont) return;
  const target = e.target.closest('.ordRow') || cont.lastElementChild;
  cont.insertBefore(dragEl, target === dragEl ? null : (target.nextElementSibling || null));
  if(target === dragEl) cont.insertBefore(dragEl, null);
  [...cont.children].forEach((r,i)=> r.querySelector('.num').textContent = i+1);
  examAnswers[qid] = {value: [...cont.children].map(r=>r.querySelector('span:last-child').textContent)};
}

async function submitExam(auto){
  if(!auto){
    const answered = Object.keys(examAnswers).length;
    if(!confirm(`متأكد من التسليم؟ جاوبت على ${answered} سؤال — مش هتقدر تعدل بعدها!`)) return;
  }
  clearInterval(examInt);
  const timeTaken = Math.floor((Date.now()-examStart)/1000);
  const r = await fetch('/api/exam/'+currentCourse+'/submit',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({answers: Object.entries(examAnswers).map(([qid,v])=>({qid:Number(qid), value:v.value})), time_taken: timeTaken})});
  const d = await r.json();
  if(d.ok){
    document.getElementById('cpExam').innerHTML = `<div class="examIntro"><h3>📨 اتسلم!</h3>
      <p>درجتك: <b>${d.score}</b>${d.essayPending?'<br><small style="color:var(--gold);">فيه مقالي هيصححه المدير — النتيجة النهائية في لوحة الشرف</small>':''}</p></div>`;
  } else {
    alert(d.msg||'حصل خطأ');
    loadExam();
  }
}

async function loadHonor(){
  const box = document.getElementById('cpHonor');
  box.innerHTML = '<div class="noReply">جاري التحميل...</div>';
  const r = await fetch('/api/exam/'+currentCourse+'/honor');
  const d = await r.json();
  if(d.status!=='results'){
    box.innerHTML = '<div class="noReply">🏆 لوحة الشرف بتظهر لما المدير يعلن نتائج الامتحان</div>'; return;
  }
  const medals = ['🥇','🥈','🥉'];
  box.innerHTML = `<h3 style="text-align:center;color:#fff;margin-bottom:8px;">🏆 لوحة الشرف — ${esc(d.examTitle)}</h3>
    <p style="text-align:center;color:var(--text-dim);margin-bottom:20px;font-size:13px;">الترتيب: أعلى درجة ← أقل وقت</p>
    <div class="podium">` + (d.results||[]).map((r,i)=>`
      <div class="honorRow ${i<3?'r'+(i+1):''}">
        <div class="rank">${medals[i]||('#'+(i+1))}</div>
        <div class="name">${esc(r.first_name+' '+r.last_name)}<small>${esc(r.grade||'')}</small></div>
        <div class="sc">${r.total} درجة${r.essay_pending?' ⏳':''}</div>
        <div class="tm">⏱ ${fmtTime(r.time_taken)}</div>
      </div>`).join('') + `</div>`;
}

async function sendSupport(){
  const t = document.getElementById('supportText').value.trim();
  if(!t) return document.getElementById('supportMsg').innerHTML='<div class="error">اكتب رسالتك الأول</div>';
  await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})});
  document.getElementById('supportText').value='';
  document.getElementById('supportMsg').innerHTML='<div class="success">✅ وصلت رسالتك للإدارة</div>';
  loadReplies();
}

async function loadReplies(){
  const msgs = await fetch('/api/my-messages').then(r=>r.json());
  const withReply = msgs.filter(m=>m.reply);
  document.getElementById('repliesList').innerHTML = withReply.length
    ? withReply.map(m=>`<div class="replyCard">
        <div class="q"><b>رسالتك:</b> ${esc(m.text)}</div>
        <div class="a"><b>رد الدعم:</b> ${esc(m.reply)}</div></div>`).join('')
    : '<div class="noReply">مفيش ردود لسه</div>';
}
function openForgot(){
  const emailEl = document.getElementById('loginEmail');
  const email = emailEl ? emailEl.value.trim() : '';
  window.open('https://wa.me/201283674859?text=' + encodeURIComponent(
    'أنا ...\n' +
    'أريد تغيير كلمة المرور لأني نسيتها\n' +
    'هذا البريد المسجل به: ' + (email || '____ اكتب بريدك هنا ____') + '\n' +
    'هذا رقم الهاتف المسجل به: ____ اكتب رقمك هنا ____'
  ));
}

function openChangePass(){
  document.getElementById('passPanel').classList.remove('hidden');
  document.getElementById('passMsg').innerHTML='';
  document.getElementById('cpOld').value='';
  document.getElementById('cpNew').value='';
  document.getElementById('cpNew2').value='';
}
function closePassPanel(){ document.getElementById('passPanel').classList.add('hidden'); }
async function doChangePass(){
  const m = document.getElementById('passMsg');
  if(document.getElementById('cpNew').value !== document.getElementById('cpNew2').value){
    m.innerHTML='<div class="error">الجديدة والتأكيد مش متطابقين</div>'; return;
  }
  const r = await fetch('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({old_pass:document.getElementById('cpOld').value, new_pass:document.getElementById('cpNew').value})});
  const d = await r.json();
  if(d.ok){
    m.innerHTML='<div class="success">✅ '+esc(d.msg)+'</div>';
    setTimeout(closePassPanel, 1500);
  } else m.innerHTML='<div class="error">'+esc(d.msg)+'</div>';
}
let sugPicData = null;
function openSuggest(){
  document.getElementById('suggestPanel').classList.remove('hidden');
  document.getElementById('sugMsg').innerHTML='';
  document.getElementById('sugText').value='';
  document.getElementById('sugPicName').textContent='';
  document.getElementById('sugPicPreview').classList.add('hidden');
  sugPicData = null;
}
function closeSuggest(){ document.getElementById('suggestPanel').classList.add('hidden'); }
function sugPick(input){
  const file = input.files[0];
  if(!file) return;
  const rd = new FileReader();
  rd.onload = e => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const max = 800;
      const scale = Math.min(1, max/Math.max(img.width, img.height));
      c.width = img.width*scale; c.height = img.height*scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      sugPicData = c.toDataURL('image/jpeg', .7);
      const pv = document.getElementById('sugPicPreview');
      pv.src = sugPicData; pv.classList.remove('hidden');
      document.getElementById('sugPicName').textContent = '✅ ' + file.name;
    };
    img.src = e.target.result;
  };
  rd.readAsDataURL(file);
}
async function sendSuggest(){
  const m = document.getElementById('sugMsg');
  const text = document.getElementById('sugText').value.trim();
  if(!text){ m.innerHTML='<div class="error">اكتب الاقتراح الأول</div>'; return; }
  const r = await fetch('/api/suggestion',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text, pic:sugPicData})});
  const d = await r.json();
  if(d.ok){
    m.innerHTML='<div class="success">✅ وصل اقتراحك للإدارة — شكرًا لمساهمتك في تطوير المنصة!</div>';
    setTimeout(closeSuggest, 1800);
  } else m.innerHTML='<div class="error">'+esc(d.msg)+'</div>';
}
async function loadStudentsCount(){
  try {
    const d = await fetch('/api/stats').then(r=>r.json());
    const h = document.getElementById('studentsCount');
    if(h && d.students) h.textContent = d.students;
    const a = document.getElementById('authStudentsCount');
    if(a && d.students) a.textContent = d.students;
    const s = document.getElementById('subCount');
    if(s && d.students) s.textContent = d.students - 1;
  } catch(e){}
}
window.onload = async ()=>{
  loadStudentsCount();
  const r = await fetch('/api/me');
  if(r.ok){ me = await r.json(); await loadCourses(); showApp(); }
};
