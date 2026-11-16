// ═══════════ منصة يوسف صلاح - v4.0 اسطوري ═══════════
// build-safe: لا process.exit ولا initDB على مستوى الموديول
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const PORT = process.env.PORT || 3000;

// Pool بيتعمل lazy ومش بيتصل وقت الـ build
// max صغير + idleTimeout قصير = آمن لبيئة serverless (Vercel/Neon)
let pool = null;
function getPool(){
  if(!pool){
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      max: 5,
      idleTimeoutMillis: 10000
    });
    pool.on('error', (err) => { console.error('pg pool error:', err.message); });
  }
  return pool;
}

async function initDB(){
  const p = getPool();
  const ddl = [
    `CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      phone TEXT NOT NULL, parent_phone TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, grade TEXT NOT NULL, gender TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS courses(
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      price INTEGER NOT NULL, emoji TEXT DEFAULT '📚',
      color TEXT DEFAULT 'linear-gradient(135deg,#8b5cf6,#06b6d4)')`,
    `CREATE TABLE IF NOT EXISTS lessons(
      id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL,
      title TEXT NOT NULL, video_url TEXT, description TEXT)`,
    `CREATE TABLE IF NOT EXISTS lesson_videos(
      id SERIAL PRIMARY KEY, lesson_id INTEGER NOT NULL,
      title TEXT, video_url TEXT NOT NULL, description TEXT,
      sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS enrollments(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, course_id INTEGER NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, course_id))`,
    `CREATE TABLE IF NOT EXISTS codes(
      id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, course_id INTEGER NOT NULL,
      used INTEGER DEFAULT 0, used_by INTEGER, item_type TEXT DEFAULT 'course')`,
    `CREATE TABLE IF NOT EXISTS messages(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, text TEXT NOT NULL,
      reply TEXT, created_at TIMESTAMP DEFAULT NOW(), replied_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS books(
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      price INTEGER NOT NULL, emoji TEXT DEFAULT '📖', pdf_url TEXT)`,
    `CREATE TABLE IF NOT EXISTS exams(
      id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL,
      title TEXT NOT NULL, duration_minutes INTEGER DEFAULT 30,
      status TEXT DEFAULT 'closed', created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS questions(
      id SERIAL PRIMARY KEY, exam_id INTEGER NOT NULL,
      type TEXT NOT NULL, text TEXT NOT NULL,
      options TEXT, order_items TEXT, correct TEXT, points INTEGER DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS submissions(
      id SERIAL PRIMARY KEY, exam_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      answers TEXT, score REAL DEFAULT 0, essay_score REAL DEFAULT 0,
      essay_pending INTEGER DEFAULT 0, time_taken INTEGER DEFAULT 0,
      submitted_at TIMESTAMP DEFAULT NOW(), UNIQUE(exam_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS notifications(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, text TEXT NOT NULL,
      read INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS lesson_views(
      user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL,
      viewed_at TIMESTAMP DEFAULT NOW(), PRIMARY KEY(user_id, lesson_id))`,
    `CREATE TABLE IF NOT EXISTS suggestions(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      text TEXT NOT NULL, pic TEXT,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS video_views(
      user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL, video_id INTEGER NOT NULL,
      watched_seconds INTEGER DEFAULT 0, duration INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0, last_position INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY(user_id, lesson_id, video_id))`,
    `CREATE TABLE IF NOT EXISTS behavior_logs(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, course_id INTEGER,
      kind TEXT NOT NULL, note TEXT NOT NULL, by_admin TEXT,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS grades(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, course_id INTEGER,
      title TEXT NOT NULL, score REAL DEFAULT 0, max_score REAL DEFAULT 100,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS parent_tokens(
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(), last_accessed TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY, user_id INTEGER, admin INTEGER DEFAULT 0,
      expires TIMESTAMPTZ NOT NULL)`
  ];
  // ★ نستخدم client واحد من الـ pool ونشغّل الاستعلامات متتابعة عليه
  //   - آمن 100% مع Neon pooled endpoint (pgBouncer transaction mode بيرفض multi-statement)
  //   - بيفتح اتصال واحد بس بدل 19 (مش بيستهلك الـ pool)
  //   - مع maxDuration=60s في vercel.json، 23 استعلام متتابع (~2-3 ثانية) ضمن الميزانية
  const client = await p.connect();
  try {
    for(const q of ddl) await client.query(q);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS attempts_left INTEGER DEFAULT 3`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_call INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_pic TEXT`);
  } finally {
    client.release();
  }
}

async function notify(userId, text){
  await getPool().query('INSERT INTO notifications(user_id,text) VALUES($1,$2)',[userId,text]);
}

async function checkAccumulation(userId, courseId){
  const p = getPool();
  const total = (await p.query('SELECT COUNT(*)::int AS n FROM lessons WHERE course_id=$1',[courseId])).rows[0].n;
  const viewed = (await p.query(`SELECT COUNT(*)::int AS n FROM lesson_views lv
    JOIN lessons l ON l.id=lv.lesson_id WHERE lv.user_id=$1 AND l.course_id=$2`,[userId,courseId])).rows[0].n;
  if(total - viewed < 2) return;
  const u = (await p.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0];
  if(!u || u.disabled) return;
  if(u.attempts_left > 0){
    await notify(userId, `⚠️ لقد راكمت الدرس السابق لديك و لديك ${u.attempts_left} محاولات و بعدها سيتم ابلاغ ولي الامر و في المره الثانيه سيتم الغاء تفعيل حسابك و ستحتاج لمكالمة الدعم عبر ولي الامر علي الرقم 01283674859 لتفعيل الحساب`);
    await p.query('UPDATE users SET attempts_left=$1 WHERE id=$2',[u.attempts_left-1,userId]);
  } else if(!u.parent_call){
    await p.query('UPDATE users SET parent_call=1 WHERE id=$1',[userId]);
    await notify(userId, '📞 تم ابلاغ الإدارة بضرورة الاتصال بولي أمرك — يرجى متابعة الدروس فورًا');
  } else {
    await p.query('UPDATE users SET disabled=1 WHERE id=$1',[userId]);
    await notify(userId, '🚫 تم الغاء تفعيل حسابك لعدم متابعة الدروس — تواصل مع الدعم عبر ولي الأمر لتفعيل الحساب');
  }
}

const app = express();
app.use(express.json());

function getToken(req){
  const m = (req.headers.cookie||'').match(/(?:^|;\s*)sid=([^;]+)/);
  return m ? m[1] : null;
}
app.use(async (req,res,next)=>{
  try {
    const t = getToken(req);
    req.sess = null;
    if(t){
      const r = await getPool().query('SELECT * FROM sessions WHERE token=$1 AND expires>NOW()',[t]);
      req.sess = r.rows[0] || null;
    }
  } catch(e){ req.sess = null; }
  next();
});
async function createSess(res, userId, admin){
  const token = crypto.randomBytes(24).toString('hex');
  await getPool().query('DELETE FROM sessions WHERE expires<NOW()');
  await getPool().query("INSERT INTO sessions(token,user_id,admin,expires) VALUES($1,$2,$3, NOW()+INTERVAL '7 days')",
    [token, userId||null, admin?1:0]);
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
}

function requireLogin(req,res,next){
  if(!req.sess || !req.sess.user_id)
    return res.status(401).json({ok:false,msg:'انتهت الجلسة — سجل دخول تاني',error:'لازم تسجل دخول الأول'});
  req.session = { userId: req.sess.user_id };
  next();
}
function requireAdmin(req,res,next){
  if(!req.sess || !req.sess.admin)
    return res.status(401).json({ok:false,msg:'انتهت جلسة المدير — سجل دخول تاني',error:'صلاحيات مدير مطلوبة'});
  next();
}

// نقطة تشخيص — افتحها في المتصفح: /api/health
// بتقول بالظبط لو DATABASE_URL ناقص أو الاتصال بقاعدة البيانات فشل
app.get('/api/health', async (req,res)=>{
  try {
    if(!process.env.DATABASE_URL)
      return res.status(500).json({ok:false, database:false, configured:false,
        msg:'DATABASE_URL غير مضبوط على Vercel Environment Variables'});
    const p = getPool();
    const r = await p.query('SELECT NOW() as now');
    res.json({ok:true, database:true, configured:true, time:r.rows[0].now});
  } catch(e){
    res.status(500).json({ok:false, database:false, configured:true,
      msg:'فشل الاتصال بقاعدة البيانات — راجع قيمة DATABASE_URL والـ Neon project',
      detail: e && e.message ? String(e.message).slice(0,200) : 'unknown'});
  }
});

app.post('/api/signup', async (req,res)=>{
  const {first,last,phone,parent,email,pass,grade,gender} = req.body;
  if(!first||!last||!phone||!parent||!email||!pass||!grade||!gender)
    return res.json({ok:false,msg:'املأ كل الحقول'});
  if(pass.length < 6) return res.json({ok:false,msg:'الرقم السري لازم 6 حروف على الأقل'});
  const em = email.trim().toLowerCase();
  try {
    const ex = await getPool().query('SELECT id FROM users WHERE email=$1',[em]);
    if(ex.rows.length) return res.json({ok:false,msg:'الإيميل ده مسجل قبل كده'});
    const ins = await getPool().query(
      `INSERT INTO users(first_name,last_name,phone,parent_phone,email,password,grade,gender)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [first.trim(),last.trim(),phone.trim(),parent.trim(),em,bcrypt.hashSync(pass,10),grade,gender]);
    await createSess(res, ins.rows[0].id, false);
    res.json({ok:true});
  } catch(e){ res.json({ok:false,msg:'حصل خطأ، حاول تاني'}); }
});

app.post('/api/login', async (req,res)=>{
  try {
    const em = (req.body.email||'').trim().toLowerCase();
    const r = await getPool().query('SELECT * FROM users WHERE email=$1',[em]);
    const user = r.rows[0];
    if(!user || !bcrypt.compareSync(req.body.pass||'', user.password))
      return res.json({ok:false,msg:'الإيميل أو الرقم السري غلط'});
    if(user.disabled) return res.json({ok:false,msg:'تم تعطيل حسابك — تواصل مع الدعم'});
    await createSess(res, user.id, false);
    res.json({ok:true});
  } catch(e){ res.json({ok:false,msg:'حصل خطأ، حاول تاني'}); }
});

app.post('/api/logout', async (req,res)=>{
  const t = getToken(req);
  if(t) await getPool().query('DELETE FROM sessions WHERE token=$1',[t]);
  res.setHeader('Set-Cookie','sid=; Path=/; HttpOnly; Max-Age=0');
  res.json({ok:true});
});

const cleanUser = u => { const {password, ...rest} = u; return rest; };

app.get('/api/me', requireLogin, async (req,res)=>{
  const u = (await getPool().query('SELECT * FROM users WHERE id=$1',[req.session.userId])).rows[0];
  if(!u) return res.status(401).json({error:'سجل دخول تاني'});
  if(u.disabled) return res.status(403).json({error:'تم تعطيل حسابك — تواصل مع الدعم'});
  const enr = await getPool().query('SELECT course_id, expires_at FROM enrollments WHERE user_id=$1 ORDER BY id',[u.id]);
  const bk = await getPool().query('SELECT course_id AS book_id FROM codes WHERE used_by=$1 AND item_type=$2',[u.id,'book']);
  res.json({user: cleanUser(u), enrollments: enr.rows, books: bk.rows});
});

app.post('/api/upload-pic', requireLogin, async (req,res)=>{
  const pic = String(req.body.pic||'');
  if(!pic.startsWith('data:image/') || pic.length > 900000)
    return res.json({ok:false,msg:'الصورة كبيرة أو غير صالحة'});
  await getPool().query('UPDATE users SET profile_pic=$1 WHERE id=$2',[pic, req.session.userId]);
  res.json({ok:true});
});

app.get('/api/notifications', requireLogin, async (req,res)=>{
  const rows = (await getPool().query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.session.userId])).rows;
  res.json({rows, unread: rows.filter(r=>!r.read).length});
});
app.post('/api/notifications/read', requireLogin, async (req,res)=>{
  await getPool().query('UPDATE notifications SET read=1 WHERE user_id=$1',[req.session.userId]);
  res.json({ok:true});
});
app.get('/api/stats', async (req,res)=>{
  const base = 277;
  const real = (await getPool().query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
  res.json({ students: base + real, realStudents: real });
});
app.get('/api/courses', async (req,res)=>{
  res.json((await getPool().query('SELECT * FROM courses ORDER BY id')).rows);
});

app.post('/api/activate', requireLogin, async (req,res)=>{
  const courseId = Number(req.body.courseId);
  const code = String(req.body.code||'').trim();
  if(!code) return res.json({ok:false,msg:'اكتب الرمز الأول'});
  try {
    const c = (await getPool().query("SELECT * FROM codes WHERE code=$1 AND item_type='course'",[code])).rows[0];
    if(!c || c.course_id !== courseId) return res.json({ok:false,msg:'الرمز غير صحيح'});
    if(c.used) return res.json({ok:false,msg:'الرمز ده مستخدم قبل كده'});
    const ex = await getPool().query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',[req.session.userId,courseId]);
    if(ex.rows.length) return res.json({ok:false,msg:'أنت مشترك في الكورس ده بالفعل'});
    const expires = new Date(Date.now() + 30*24*60*60*1000);
    await getPool().query('INSERT INTO enrollments(user_id,course_id,expires_at) VALUES($1,$2,$3)',[req.session.userId,courseId,expires]);
    await getPool().query('UPDATE codes SET used=1, used_by=$1 WHERE id=$2',[req.session.userId,c.id]);
    res.json({ok:true});
  } catch(e){ res.json({ok:false,msg:'حصل خطأ، حاول تاني'}); }
});

app.get('/api/course/:id', requireLogin, async (req,res)=>{
  const courseId = Number(req.params.id);
  const enr = (await getPool().query('SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2',[req.session.userId,courseId])).rows[0];
  if(!enr) return res.status(403).json({error:'أنت مش مشترك في الكورس ده'});
  if(new Date(enr.expires_at) < new Date()) return res.status(403).json({error:'انتهى شهر الاشتراك'});
  const lessons = (await getPool().query('SELECT * FROM lessons WHERE course_id=$1 ORDER BY id',[courseId])).rows;
  const vids = lessons.length ? (await getPool().query(`SELECT * FROM lesson_videos WHERE lesson_id IN (
      SELECT id FROM lessons WHERE course_id=$1) ORDER BY lesson_id, sort_order, id`,[courseId])).rows : [];
  const byLesson = {};
  vids.forEach(v => { (byLesson[v.lesson_id] = byLesson[v.lesson_id] || []).push(v); });
  lessons.forEach(l => {
    l.videos = byLesson[l.id] || [];
    // backward compat: لو الدرس قديم وليه video_url واحد ومفيهوش صفوف في lesson_videos
    if(l.videos.length === 0 && l.video_url) l.videos = [{id:0, lesson_id:l.id, title:'', video_url:l.video_url, description:''}];
  });
  const vw = await getPool().query('SELECT lesson_id FROM lesson_views WHERE user_id=$1',[req.session.userId]);
  const vp = (await getPool().query(`SELECT lesson_id, video_id, watched_seconds, duration, completed, last_position
    FROM video_views WHERE user_id=$1 AND lesson_id IN (SELECT id FROM lessons WHERE course_id=$2)`,
    [req.session.userId, courseId])).rows;
  const vpMap = {};
  vp.forEach(v => { vpMap[v.lesson_id+'-'+v.video_id] = v; });
  lessons.forEach(l => l.videos.forEach(v => {
    const p = vpMap[l.id+'-'+v.id];
    v.progress = p ? {watched_seconds:p.watched_seconds, duration:p.duration, completed:p.completed, last_position:p.last_position} : null;
  }));
  res.json({lessons, viewed: vw.rows.map(v=>v.lesson_id), expires_at: enr.expires_at});
});

// بترجع true لو كل فيديوهات الدرس اكتملت بالنسبة للطالب (لو الدرس ملوش فيديوهات → true)
async function allLessonVideosComplete(userId, lessonId){
  const l = (await getPool().query('SELECT * FROM lessons WHERE id=$1',[lessonId])).rows[0];
  if(!l) return false;
  const vids = (await getPool().query('SELECT id FROM lesson_videos WHERE lesson_id=$1',[lessonId])).rows;
  let videoRows = vids.map(v=>v.id);
  // backward compat: لو مفيش فيديوهات في lesson_videos بس فيه video_url → فيديو واحد وهمي video_id=0
  if(videoRows.length === 0 && l.video_url) videoRows = [0];
  if(videoRows.length === 0) return true; // درس ملوش فيديوهات → اعتبره مكتمل
  const done = (await getPool().query(`SELECT COUNT(*)::int AS n FROM video_views
    WHERE user_id=$1 AND lesson_id=$2 AND video_id IN (SELECT unnest($3::int[])) AND completed=1`,
    [userId, lessonId, videoRows])).rows[0].n;
  return done === videoRows.length;
}

app.post('/api/video-progress', requireLogin, async (req,res)=>{
  const lid = Number(req.body.lesson_id);
  const vid = Number(req.body.video_id) || 0;
  const watched = Math.max(0, Math.min(Number(req.body.watched_seconds)||0, 7200));
  const duration = Math.max(0, Math.min(Number(req.body.duration)||0, 7200));
  const lastPos = Math.max(0, Math.min(Number(req.body.last_position)||0, 7200));
  const l = (await getPool().query('SELECT * FROM lessons WHERE id=$1',[lid])).rows[0];
  if(!l) return res.json({ok:false});
  const enr = await getPool().query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',[req.session.userId,l.course_id]);
  if(!enr.rows.length) return res.json({ok:false});
  const completed = (duration > 0 && watched >= Math.ceil(duration*0.97) && lastPos >= duration-3) ? 1 : 0;
  const prev = (await getPool().query('SELECT completed FROM video_views WHERE user_id=$1 AND lesson_id=$2 AND video_id=$3',
    [req.session.userId, lid, vid])).rows[0];
  await getPool().query(`INSERT INTO video_views(user_id,lesson_id,video_id,watched_seconds,duration,completed,last_position,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT(user_id,lesson_id,video_id) DO UPDATE SET
      watched_seconds=GREATEST(video_views.watched_seconds, EXCLUDED.watched_seconds),
      duration=GREATEST(video_views.duration, EXCLUDED.duration),
      completed=GREATEST(video_views.completed, EXCLUDED.completed),
      last_position=EXCLUDED.last_position, updated_at=NOW()`,
    [req.session.userId, lid, vid, watched, duration, completed, lastPos]);
  let lessonViewed = false;
  if(completed && !(prev && prev.completed)){
    // الفيديو لسه اكتمل دلوقتي — تحقق من اكتمال كل الفيديوهات
    if(await allLessonVideosComplete(req.session.userId, lid)){
      const ins = await getPool().query('INSERT INTO lesson_views(user_id,lesson_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING lesson_id',
        [req.session.userId, lid]);
      if(ins.rows.length){
        lessonViewed = true;
        const course = (await getPool().query('SELECT name FROM courses WHERE id=$1',[l.course_id])).rows[0];
        await notify(req.session.userId, `✅ خلّصت درس "${l.title}" في كورس ${course?course.name:''} — أحسنت! 🎉`);
        await checkAccumulation(req.session.userId, l.course_id);
      }
    }
  }
  res.json({ok:true, videoCompleted: completed, lessonViewed});
});

app.post('/api/lesson-viewed', requireLogin, async (req,res)=>{
  const lid = Number(req.body.lesson_id);
  const l = (await getPool().query('SELECT * FROM lessons WHERE id=$1',[lid])).rows[0];
  if(!l) return res.json({ok:false});
  const enr = await getPool().query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',[req.session.userId,l.course_id]);
  if(!enr.rows.length) return res.json({ok:false});
  // أمان: ميركّبش صح إلا لو كل الفيديوهات اكتملت (أو الدرس ملوش فيديوهات)
  if(!(await allLessonVideosComplete(req.session.userId, lid))) return res.json({ok:false, msg:'لازم تكمّل كل الفيديوهات الأول'});
  const ins = await getPool().query('INSERT INTO lesson_views(user_id,lesson_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING lesson_id',[req.session.userId, lid]);
  if(ins.rows.length) await checkAccumulation(req.session.userId, l.course_id);
  res.json({ok:true});
});

app.get('/api/exam/:courseId', requireLogin, async (req,res)=>{
  const courseId = Number(req.params.courseId);
  const enr = (await getPool().query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2',[req.session.userId,courseId])).rows[0];
  if(!enr) return res.status(403).json({error:'أنت مش مشترك في الكورس ده'});
  const exam = (await getPool().query('SELECT * FROM exams WHERE course_id=$1 ORDER BY id DESC LIMIT 1',[courseId])).rows[0];
  if(!exam) return res.json({status:'none'});
  if(exam.status==='results') return res.json({status:'results', examTitle: exam.title});
  if(exam.status!=='open') return res.json({status:'closed'});
  const sub = (await getPool().query('SELECT * FROM submissions WHERE exam_id=$1 AND user_id=$2',[exam.id,req.session.userId])).rows[0];
  if(sub) return res.json({status:'submitted', score: sub.score+sub.essay_score, essayPending: !!sub.essay_pending});
  const qs = (await getPool().query('SELECT * FROM questions WHERE exam_id=$1 ORDER BY id',[exam.id])).rows
    .map(q=>{
      const o = {id:q.id, type:q.type, text:q.text, points:q.points};
      if(q.type==='mcq') o.options = JSON.parse(q.options||'[]');
      if(q.type==='order'){
        const items = JSON.parse(q.order_items||'[]');
        for(let i=items.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; }
        o.items = items;
      }
      return o;
    });
  res.json({status:'open', examTitle: exam.title, duration: exam.duration_minutes, questions: qs});
});

app.post('/api/exam/:courseId/submit', requireLogin, async (req,res)=>{
  const courseId = Number(req.params.courseId);
  const exam = (await getPool().query("SELECT * FROM exams WHERE course_id=$1 ORDER BY id DESC LIMIT 1",[courseId])).rows[0];
  if(!exam || exam.status!=='open') return res.json({ok:false,msg:'الامتحان مقفول'});
  const sub = (await getPool().query('SELECT id FROM submissions WHERE exam_id=$1 AND user_id=$2',[exam.id,req.session.userId])).rows[0];
  if(sub) return res.json({ok:false,msg:'أنت سلمت الامتحان ده قبل كده'});
  const answers = Array.isArray(req.body.answers)? req.body.answers : [];
  const timeTaken = Math.max(0, Math.min(Number(req.body.time_taken)||0, 24*60*60));
  const qs = (await getPool().query('SELECT * FROM questions WHERE exam_id=$1',[exam.id])).rows;
  let score = 0, essayPending = 0;
  for(const q of qs){
    const a = answers.find(x=>Number(x.qid)===q.id);
    if(q.type==='mcq' || q.type==='truefalse'){
      if(a && String(a.value??'').trim() === String(q.correct||'').trim()) score += Number(q.points)||1;
    } else if(q.type==='order'){
      if(a && Array.isArray(a.value)){
        const correct = JSON.parse(q.order_items||'[]');
        if(JSON.stringify(a.value)===JSON.stringify(correct)) score += Number(q.points)||1;
      }
    } else if(q.type==='essay'){ essayPending = 1; }
  }
  await getPool().query(
    `INSERT INTO submissions(exam_id,user_id,answers,score,essay_pending,time_taken)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [exam.id, req.session.userId, JSON.stringify(answers), score, essayPending, timeTaken]);
  res.json({ok:true, score, essayPending: !!essayPending});
});

app.get('/api/exam/:courseId/honor', async (req,res)=>{
  const courseId = Number(req.params.courseId);
  const exam = (await getPool().query('SELECT * FROM exams WHERE course_id=$1 ORDER BY id DESC LIMIT 1',[courseId])).rows[0];
  if(!exam || exam.status!=='results') return res.json({status:'closed'});
  const rows = (await getPool().query(
    `SELECT u.first_name, u.last_name, u.grade,
            (s.score+s.essay_score) AS total, s.time_taken, s.essay_pending
     FROM submissions s JOIN users u ON u.id=s.user_id
     WHERE s.exam_id=$1 ORDER BY total DESC, s.time_taken ASC`,[exam.id])).rows;
  res.json({status:'results', examTitle: exam.title, results: rows});
});

app.get('/api/books', async (req,res)=>{
  res.json((await getPool().query('SELECT * FROM books ORDER BY id DESC')).rows);
});
app.post('/api/activate-book', requireLogin, async (req,res)=>{
  const bookId = Number(req.body.bookId);
  const code = String(req.body.code||'').trim();
  const c = (await getPool().query("SELECT * FROM codes WHERE code=$1 AND item_type='book'",[code])).rows[0];
  if(!c || c.course_id !== bookId) return res.json({ok:false,msg:'الرمز غير صحيح'});
  if(c.used) return res.json({ok:false,msg:'الرمز ده مستخدم قبل كده'});
  await getPool().query('UPDATE codes SET used=1, used_by=$1 WHERE id=$2',[req.session.userId,c.id]);
  res.json({ok:true});
});
app.post('/api/suggestion', requireLogin, async (req,res)=>{
  const text = (req.body.text||'').trim();
  const pic = String(req.body.pic||'');
  if(!text) return res.json({ok:false,msg:'اكتب الاقتراح الأول'});
  if(pic && (!pic.startsWith('data:image/') || pic.length > 900000))
    return res.json({ok:false,msg:'الصورة كبيرة أو غير صالحة'});
  await getPool().query('INSERT INTO suggestions(user_id,text,pic) VALUES($1,$2,$3)',
    [req.session.userId, text, pic||null]);
  res.json({ok:true});
});
app.post('/api/support', requireLogin, async (req,res)=>{
  const text = (req.body.text||'').trim();
  if(!text) return res.json({ok:false});
  await getPool().query('INSERT INTO messages(user_id,text) VALUES($1,$2)',[req.session.userId,text]);
  res.json({ok:true});
});
app.get('/api/my-messages', requireLogin, async (req,res)=>{
  res.json((await getPool().query('SELECT * FROM messages WHERE user_id=$1 ORDER BY id DESC',[req.session.userId])).rows);
});

app.post('/api/admin/login', async (req,res)=>{
  if(req.body.username===ADMIN_USER && req.body.password===ADMIN_PASS){
    await createSess(res, null, true);
    return res.json({ok:true});
  }
  res.json({ok:false,msg:'بيانات المدير غلط'});
});
app.post('/api/admin/logout', async (req,res)=>{
  const t = getToken(req);
  if(t) await getPool().query('DELETE FROM sessions WHERE token=$1',[t]);
  res.setHeader('Set-Cookie','sid=; Path=/; HttpOnly; Max-Age=0');
  res.json({ok:true});
});

app.get('/api/admin/messages', requireAdmin, async (req,res)=>{
  res.json((await getPool().query(`SELECT m.*, u.first_name, u.last_name, u.phone, u.email
    FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.id DESC`)).rows);
});
app.post('/api/admin/reply', requireAdmin, async (req,res)=>{
  const m = (await getPool().query('SELECT * FROM messages WHERE id=$1',[Number(req.body.id)])).rows[0];
  await getPool().query('UPDATE messages SET reply=$1, replied_at=$2 WHERE id=$3',
    [req.body.reply, new Date().toLocaleString('ar-EG'), Number(req.body.id)]);
  if(m) await notify(m.user_id, '💬 الدعم رد على رسالتك — افتح قسم "ردود الدعم"');
  res.json({ok:true});
});
app.get('/api/admin/suggestions', requireAdmin, async (req,res)=>{
  const rows = (await getPool().query(`SELECT s.*, u.first_name, u.last_name, u.phone, u.email
    FROM suggestions s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC`)).rows;
  res.json(rows);
});
app.post('/api/admin/suggestions/delete', requireAdmin, async (req,res)=>{
  await getPool().query('DELETE FROM suggestions WHERE id=$1',[Number(req.body.id)]);
  res.json({ok:true});
});
app.get('/api/admin/users', requireAdmin, async (req,res)=>{
  const rows = (await getPool().query(`SELECT u.*,
    (SELECT COUNT(*)::int FROM video_views v WHERE v.user_id=u.id AND v.completed=1) AS watched_videos,
    (SELECT COUNT(*)::int FROM behavior_logs b WHERE b.user_id=u.id) AS behavior_count,
    (SELECT COUNT(*)::int FROM enrollments e WHERE e.user_id=u.id) AS courses_count,
    (SELECT COALESCE(AVG(score * 100.0 / NULLIF(max_points, 0)), 0)::float FROM (
       SELECT g.score AS score, g.max_score AS max_points FROM grades g WHERE g.user_id = u.id
       UNION ALL
       SELECT (s.score + COALESCE(s.essay_score,0)) AS score,
              COALESCE((SELECT SUM(points) FROM questions WHERE exam_id = ex.id), 0) AS max_points
       FROM submissions s JOIN exams ex ON ex.id = s.exam_id
       WHERE s.user_id = u.id AND s.essay_pending = 0
     ) x) AS grade_avg
    FROM users u ORDER BY u.id DESC`)).rows.map(cleanUser);
  res.json(rows);
});
app.post('/api/admin/gen-temp-pass', requireAdmin, async (req,res)=>{
  const uid = Number(req.body.user_id);
  const u = (await getPool().query('SELECT * FROM users WHERE id=$1',[uid])).rows[0];
  if(!u) return res.json({ok:false});
  const temp = 'T' + Math.floor(100000 + Math.random()*900000);
  await getPool().query('UPDATE users SET password=$1 WHERE id=$2',[bcrypt.hashSync(temp,10), uid]);
  await notify(uid, '🔑 تم إعادة تعيين كلمة مرورك من الإدارة — كلمة السر المؤقتة: ' + temp + ' — غيّرها فورًا من الملف الشخصي');
  res.json({ok:true, temp});
});

app.post('/api/change-password', requireLogin, async (req,res)=>{
  const u = (await getPool().query('SELECT * FROM users WHERE id=$1',[req.session.userId])).rows[0];
  if(!u) return res.json({ok:false});
  if(!bcrypt.compareSync(req.body.old_pass||'', u.password))
    return res.json({ok:false,msg:'كلمة السر الحالية غلط'});
  if((req.body.new_pass||'').length < 6)
    return res.json({ok:false,msg:'الجديدة لازم 6 حروف على الأقل'});
  await getPool().query('UPDATE users SET password=$1 WHERE id=$2',
    [bcrypt.hashSync(req.body.new_pass,10), req.session.userId]);
  res.json({ok:true,msg:'تم تغيير كلمة المرور بنجاح!'});
});
app.post('/api/admin/delete-user', requireAdmin, async (req,res)=>{
  const uid = Number(req.body.user_id);
  if(!uid) return res.json({ok:false});
  await getPool().query('DELETE FROM submissions WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM video_views WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM lesson_views WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM behavior_logs WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM grades WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM parent_tokens WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM notifications WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM messages WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM enrollments WHERE user_id=$1',[uid]);
  await getPool().query('DELETE FROM users WHERE id=$1',[uid]);
  res.json({ok:true});
});
app.post('/api/admin/toggle-user', requireAdmin, async (req,res)=>{
  const u = (await getPool().query('SELECT disabled FROM users WHERE id=$1',[Number(req.body.user_id)])).rows[0];
  if(!u) return res.json({ok:false});
  const newVal = u.disabled?0:1;
  await getPool().query('UPDATE users SET disabled=$1 WHERE id=$2',[newVal, Number(req.body.user_id)]);
  if(newVal===0) await getPool().query('UPDATE users SET attempts_left=3, parent_call=0 WHERE id=$1',[Number(req.body.user_id)]);
  res.json({ok:true, disabled:newVal});
});

app.get('/api/admin/courses', requireAdmin, async (req,res)=>{
  res.json((await getPool().query('SELECT * FROM courses ORDER BY id')).rows);
});
app.post('/api/admin/courses', requireAdmin, async (req,res)=>{
  const {name,description,price,emoji} = req.body;
  await getPool().query('INSERT INTO courses(name,description,price,emoji) VALUES($1,$2,$3,$4)',
    [name,description,Number(price)||0,emoji||'📚']);
  const all = (await getPool().query('SELECT id FROM users WHERE disabled=0')).rows;
  for(const u of all) await notify(u.id, `🎓 كورس جديد اتضاف على المنصة: ${name}`);
  res.json({ok:true});
});
app.post('/api/admin/courses/delete', requireAdmin, async (req,res)=>{
  const cid = Number(req.body.id);
  if(!cid) return res.json({ok:false,msg:'معرف الكورس ناقص'});
  await getPool().query('DELETE FROM submissions WHERE exam_id IN (SELECT id FROM exams WHERE course_id=$1)',[cid]);
  await getPool().query('DELETE FROM questions WHERE exam_id IN (SELECT id FROM exams WHERE course_id=$1)',[cid]);
  await getPool().query('DELETE FROM exams WHERE course_id=$1',[cid]);
  await getPool().query('DELETE FROM lesson_views WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id=$1)',[cid]);
  await getPool().query('DELETE FROM lesson_videos WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id=$1)',[cid]);
  await getPool().query('DELETE FROM lessons WHERE course_id=$1',[cid]);
  await getPool().query('DELETE FROM enrollments WHERE course_id=$1',[cid]);
  await getPool().query('DELETE FROM codes WHERE course_id=$1 AND item_type=$2',[cid,'course']);
  await getPool().query('DELETE FROM courses WHERE id=$1',[cid]);
  res.json({ok:true});
});

app.post('/api/admin/codes', requireAdmin, async (req,res)=>{
  const c = String(req.body.code||'').trim().toUpperCase();
  const itemType = (req.body.item_type==='book') ? 'book' : 'course';
  if(!c) return res.json({ok:false,msg:'اكتب الرمز'});
  try {
    await getPool().query('INSERT INTO codes(code,course_id,item_type) VALUES($1,$2,$3)',
      [c, Number(req.body.item_id||req.body.course_id), itemType]);
    res.json({ok:true});
  } catch(e){ res.json({ok:false,msg:'الرمز ده موجود قبل كده'}); }
});
app.get('/api/admin/codes', requireAdmin, async (req,res)=>{
  const itemType = req.query.item_type || 'course';
  const itemId = Number(req.query.item_id || req.query.course_id);
  res.json((await getPool().query(`SELECT c.*, u.first_name AS used_by_name FROM codes c
    LEFT JOIN users u ON u.id=c.used_by
    WHERE c.item_type=$1 AND c.course_id=$2 ORDER BY c.id DESC`,[itemType,itemId])).rows);
});

app.post('/api/admin/lessons', requireAdmin, async (req,res)=>{
  const {course_id,title,description} = req.body;
  if(!title) return res.json({ok:false,msg:'اكتب عنوان الدرس'});
  await getPool().query('INSERT INTO lessons(course_id,title,description) VALUES($1,$2,$3)',
    [Number(course_id), title, description||null]);
  res.json({ok:true});
});
app.get('/api/admin/lessons', requireAdmin, async (req,res)=>{
  const ls = (await getPool().query('SELECT * FROM lessons WHERE course_id=$1 ORDER BY id',[Number(req.query.course_id)])).rows;
  if(ls.length){
    const vids = (await getPool().query(`SELECT * FROM lesson_videos WHERE lesson_id IN (
        SELECT id FROM lessons WHERE course_id=$1) ORDER BY lesson_id, sort_order, id`,[Number(req.query.course_id)])).rows;
    const byLesson = {};
    vids.forEach(v => { (byLesson[v.lesson_id] = byLesson[v.lesson_id] || []).push(v); });
    ls.forEach(l => { l.videos = byLesson[l.id] || []; });
  }
  res.json(ls);
});
app.post('/api/admin/lessons/delete', requireAdmin, async (req,res)=>{
  const lid = Number(req.body.lesson_id);
  if(!lid) return res.json({ok:false,msg:'معرف الدرس ناقص'});
  await getPool().query('DELETE FROM lesson_views WHERE lesson_id=$1',[lid]);
  await getPool().query('DELETE FROM lesson_videos WHERE lesson_id=$1',[lid]);
  await getPool().query('DELETE FROM lessons WHERE id=$1',[lid]);
  res.json({ok:true});
});
app.post('/api/admin/lesson-videos', requireAdmin, async (req,res)=>{
  const {lesson_id,title,video_url,description} = req.body;
  if(!video_url) return res.json({ok:false,msg:'اكتب رابط الفيديو'});
  await getPool().query('INSERT INTO lesson_videos(lesson_id,title,video_url,description) VALUES($1,$2,$3,$4)',
    [Number(lesson_id), title||null, video_url, description||null]);
  const lesson = (await getPool().query('SELECT * FROM lessons WHERE id=$1',[Number(lesson_id)])).rows[0];
  if(lesson){
    const course = (await getPool().query('SELECT name FROM courses WHERE id=$1',[lesson.course_id])).rows[0];
    const enr = (await getPool().query('SELECT user_id FROM enrollments WHERE course_id=$1',[lesson.course_id])).rows;
    for(const e of enr){
      await notify(e.user_id, `🎬 فيديو جديد في درس "${lesson.title}" بكورس ${course?course.name:''}`);
      await checkAccumulation(e.user_id, lesson.course_id);
    }
  }
  res.json({ok:true});
});
app.post('/api/admin/lesson-videos/delete', requireAdmin, async (req,res)=>{
  await getPool().query('DELETE FROM lesson_videos WHERE id=$1',[Number(req.body.id)]);
  res.json({ok:true});
});

app.post('/api/admin/books', requireAdmin, async (req,res)=>{
  const {title,description,price,emoji,pdf_url} = req.body;
  if(!title) return res.json({ok:false,msg:'اكتب اسم الكتاب'});
  await getPool().query('INSERT INTO books(title,description,price,emoji,pdf_url) VALUES($1,$2,$3,$4,$5)',
    [title, description||'', Number(price)||0, emoji||'📖', pdf_url||null]);
  res.json({ok:true});
});
app.get('/api/admin/books', requireAdmin, async (req,res)=>{
  res.json((await getPool().query('SELECT * FROM books ORDER BY id DESC')).rows);
});
app.post('/api/admin/books/delete', requireAdmin, async (req,res)=>{
  await getPool().query('DELETE FROM books WHERE id=$1',[Number(req.body.id)]);
  res.json({ok:true});
});

app.get('/api/admin/exam', requireAdmin, async (req,res)=>{
  const courseId = Number(req.query.course_id);
  const exam = (await getPool().query('SELECT * FROM exams WHERE course_id=$1 ORDER BY id DESC LIMIT 1',[courseId])).rows[0];
  if(!exam) return res.json({exam:null});
  const questions = (await getPool().query('SELECT * FROM questions WHERE exam_id=$1 ORDER BY id',[exam.id])).rows
    .map(q=>({...q, options: q.options?JSON.parse(q.options):null, order_items: q.order_items?JSON.parse(q.order_items):null}));
  const subs = (await getPool().query(
    `SELECT s.*, u.first_name, u.last_name FROM submissions s
     JOIN users u ON u.id=s.user_id WHERE s.exam_id=$1 ORDER BY (s.score+s.essay_score) DESC, s.time_taken ASC`,[exam.id])).rows;
  res.json({exam, questions, submissions: subs});
});
app.post('/api/admin/exam', requireAdmin, async (req,res)=>{
  const courseId = Number(req.body.course_id);
  const old = (await getPool().query('SELECT id FROM exams WHERE course_id=$1',[courseId])).rows[0];
  if(old) return res.json({ok:false,msg:'فيه امتحان موجود للكورس ده — امسحه الأول'});
  await getPool().query('INSERT INTO exams(course_id,title,duration_minutes) VALUES($1,$2,$3)',
    [courseId, req.body.title||'امتحان', Number(req.body.duration_minutes)||30]);
  res.json({ok:true});
});
app.post('/api/admin/exam/status', requireAdmin, async (req,res)=>{
  const st = req.body.status;
  if(!['open','closed','results'].includes(st)) return res.json({ok:false,msg:'حالة غير صحيحة'});
  await getPool().query('UPDATE exams SET status=$1 WHERE id=$2',[st, Number(req.body.exam_id)]);
  if(st==='open'){
    const ex = (await getPool().query('SELECT * FROM exams WHERE id=$1',[Number(req.body.exam_id)])).rows[0];
    if(ex){
      const c = (await getPool().query('SELECT name FROM courses WHERE id=$1',[ex.course_id])).rows[0];
      const enr = (await getPool().query('SELECT user_id FROM enrollments WHERE course_id=$1',[ex.course_id])).rows;
      for(const e of enr) await notify(e.user_id, `📝 تم فتح امتحان في كورس ${c?c.name:''} — ادخل الكورس وابدأ الآن!`);
    }
  }
  res.json({ok:true});
});
app.post('/api/admin/exam/delete', requireAdmin, async (req,res)=>{
  const examId = Number(req.body.exam_id);
  await getPool().query('DELETE FROM submissions WHERE exam_id=$1',[examId]);
  await getPool().query('DELETE FROM questions WHERE exam_id=$1',[examId]);
  await getPool().query('DELETE FROM exams WHERE id=$1',[examId]);
  res.json({ok:true});
});
app.post('/api/admin/exam/question', requireAdmin, async (req,res)=>{
  const {exam_id,type,text,points,options,order_items,correct} = req.body;
  if(!text) return res.json({ok:false,msg:'اكتب نص السؤال'});
  await getPool().query(
    'INSERT INTO questions(exam_id,type,text,points,options,order_items,correct) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [Number(exam_id), type, text, Number(points)||1,
     options?JSON.stringify(options):null,
     order_items?JSON.stringify(order_items):null,
     correct||null]);
  res.json({ok:true});
});
app.post('/api/admin/exam/question/delete', requireAdmin, async (req,res)=>{
  await getPool().query('DELETE FROM questions WHERE id=$1',[Number(req.body.id)]);
  res.json({ok:true});
});
app.post('/api/admin/exam/grade', requireAdmin, async (req,res)=>{
  const subId = Number(req.body.submission_id);
  const grades = req.body.grades || {};
  const essayTotal = Object.values(grades).reduce((a,b)=>a+(Number(b)||0),0);
  await getPool().query('UPDATE submissions SET essay_score=$1, essay_pending=0 WHERE id=$2',[essayTotal, subId]);
  res.json({ok:true});
});

// ═══ ملف الطالب الكامل (بيستخدمه الأدمن + بوابة ولي الأمر) ═══
function gradeLevel(avg){
  if(avg >= 90) return {name:'ممتاز', color:'#22c55e', emoji:'🌟'};
  if(avg >= 75) return {name:'جيد جداً', color:'#84cc16', emoji:'👍'};
  if(avg >= 60) return {name:'جيد', color:'#eab308', emoji:'🙂'};
  if(avg >= 50) return {name:'مقبول', color:'#f97316', emoji:'😐'};
  return {name:'ضعيف', color:'#ef4444', emoji:'⚠️'};
}

async function buildStudentDetail(userId){
  const p = getPool();
  const u = (await p.query('SELECT * FROM users WHERE id=$1',[userId])).rows[0];
  if(!u) return null;
  const enrs = (await p.query(`SELECT e.course_id, e.expires_at, c.name AS course_name, c.emoji
    FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 ORDER BY e.id`,[userId])).rows;
  const courses = [];
  const allScores = [];
  for(const e of enrs){
    const lessons = (await p.query('SELECT id, title, video_url FROM lessons WHERE course_id=$1 ORDER BY id',[e.course_id])).rows;
    let totalVideos = 0, watchedVideos = 0;
    const lessonProgress = [];
    for(const ln of lessons){
      const vids = (await p.query('SELECT id FROM lesson_videos WHERE lesson_id=$1 ORDER BY sort_order, id',[ln.id])).rows;
      let vIds = vids.map(v=>v.id);
      if(vIds.length === 0 && ln.video_url) vIds = [0];
      totalVideos += vIds.length;
      const done = vIds.length ? (await p.query(`SELECT COUNT(*)::int AS n FROM video_views WHERE user_id=$1 AND lesson_id=$2 AND video_id IN (SELECT unnest($3::int[])) AND completed=1`,[userId, ln.id, vIds])).rows[0].n : 0;
      watchedVideos += done;
      const lv = (await p.query('SELECT 1 FROM lesson_views WHERE user_id=$1 AND lesson_id=$2',[userId, ln.id])).rows.length;
      lessonProgress.push({lesson_id:ln.id, title:ln.title, videos_total:vIds.length, videos_watched:done, viewed: lv>0});
    }
    const totalLessons = lessons.length;
    const viewedLessons = lessonProgress.filter(x=>x.viewed).length;
    const examGrades = (await p.query(`SELECT s.id, s.score, s.essay_score, s.essay_pending, s.time_taken, s.submitted_at,
      ex.title AS exam_title, ex.duration_minutes,
      (SELECT SUM(points)::float FROM questions WHERE exam_id=ex.id) AS max_points
      FROM submissions s JOIN exams ex ON ex.id=s.exam_id WHERE ex.course_id=$1 AND s.user_id=$2 ORDER BY s.submitted_at DESC`,[e.course_id, userId])).rows;
    examGrades.forEach(g => {
      if(g.essay_pending === 0 && g.max_points > 0){
        const total = (g.score||0) + (g.essay_score||0);
        allScores.push(total / g.max_points * 100);
      }
    });
    const manualGrades = (await p.query('SELECT id, title, score, max_score, created_at FROM grades WHERE user_id=$1 AND course_id=$2 ORDER BY created_at DESC',[userId, e.course_id])).rows;
    manualGrades.forEach(g => { if(g.max_score > 0) allScores.push(g.score / g.max_score * 100); });
    courses.push({...e, totalLessons, viewedLessons, totalVideos, watchedVideos, lessonProgress, examGrades, manualGrades});
  }
  const behavior = (await p.query(`SELECT b.*, c.name AS course_name FROM behavior_logs b LEFT JOIN courses c ON c.id=b.course_id WHERE b.user_id=$1 ORDER BY b.created_at DESC`,[userId])).rows;
  const gradeAvg = allScores.length ? allScores.reduce((a,b)=>a+b,0)/allScores.length : 0;
  return {
    user: cleanUser(u),
    courses, behavior, gradeAvg, allScoresCount: allScores.length,
    level: gradeLevel(gradeAvg),
    attempts_left: u.attempts_left, parent_call: u.parent_call,
    disabled: u.disabled, created_at: u.created_at
  };
}

app.get('/api/admin/student/:id', requireAdmin, async (req,res)=>{
  const d = await buildStudentDetail(Number(req.params.id));
  if(!d) return res.json({error:'الطالب مش موجود'});
  res.json(d);
});

app.post('/api/admin/behavior', requireAdmin, async (req,res)=>{
  const {user_id, course_id, kind, note} = req.body;
  if(!note) return res.json({ok:false,msg:'اكتب ملاحظة السلوك'});
  const k = ['good','bad','warn'].includes(kind) ? kind : 'warn';
  await getPool().query('INSERT INTO behavior_logs(user_id,course_id,kind,note,by_admin) VALUES($1,$2,$3,$4,$5)',
    [Number(user_id), course_id?Number(course_id):null, k, note, 'admin']);
  const txt = k==='good' ? `🌟 سلوك مميّز: ${note}` : k==='bad' ? `⚠️ ملاحظة سلوك: ${note}` : `📝 تنبيه: ${note}`;
  await notify(Number(user_id), txt);
  res.json({ok:true});
});

app.post('/api/admin/behavior/delete', requireAdmin, async (req,res)=>{
  await getPool().query('DELETE FROM behavior_logs WHERE id=$1',[Number(req.body.id)]);
  res.json({ok:true});
});

app.post('/api/admin/grade', requireAdmin, async (req,res)=>{
  const {user_id, course_id, title, score, max_score} = req.body;
  if(!title) return res.json({ok:false,msg:'اكتب عنوان الدرجة'});
  const sc = Number(score)||0, mx = Number(max_score)||100;
  if(mx <= 0) return res.json({ok:false,msg:'الدرجة النهائية لازم أكبر من صفر'});
  await getPool().query('INSERT INTO grades(user_id,course_id,title,score,max_score) VALUES($1,$2,$3,$4,$5)',
    [Number(user_id), course_id?Number(course_id):null, title, sc, mx]);
  await notify(Number(user_id), `📊 تم تسجيل درجة "${title}": ${sc}/${mx}`);
  res.json({ok:true});
});

app.post('/api/admin/grade/delete', requireAdmin, async (req,res)=>{
  await getPool().query('DELETE FROM grades WHERE id=$1',[Number(req.body.id)]);
  res.json({ok:true});
});

app.post('/api/admin/parent-token', requireAdmin, async (req,res)=>{
  const uid = Number(req.body.user_id);
  const u = (await getPool().query('SELECT first_name,last_name,parent_phone FROM users WHERE id=$1',[uid])).rows[0];
  if(!u) return res.json({ok:false,msg:'الطالب مش موجود'});
  let row = (await getPool().query('SELECT token FROM parent_tokens WHERE user_id=$1',[uid])).rows[0];
  if(!row){
    const token = crypto.randomBytes(16).toString('hex');
    await getPool().query('INSERT INTO parent_tokens(user_id,token) VALUES($1,$2) ON CONFLICT DO NOTHING',[uid, token]);
    row = {token};
  }
  res.json({ok:true, token:row.token, parent_phone:u.parent_phone, name:u.first_name+' '+u.last_name});
});

app.get('/api/parent', async (req,res)=>{
  const t = String(req.query.t||'');
  if(!t || t.length < 16) return res.status(400).json({error:'رابط غير صالح'});
  const pt = (await getPool().query('SELECT * FROM parent_tokens WHERE token=$1',[t])).rows[0];
  if(!pt) return res.status(404).json({error:'الرابط غير صالح أو منتهي'});
  await getPool().query('UPDATE parent_tokens SET last_accessed=NOW() WHERE id=$1',[pt.id]);
  const d = await buildStudentDetail(pt.user_id);
  if(!d) return res.status(404).json({error:'الطالب مش موجود'});
  res.json(d);
});

// ═══ build-safe initialization ═══
// init بيتعمل lazy على أول request — مش وقت الـ build
// ★ لو فشل، نمسح initPromise عشان الـ request الجاي يعيد المحاولة
//   (بدون ده، أول فشل بيخلّي كل request بعده يخبط للأبد)
let initPromise = null;
function ensureInit(){
  if(!initPromise){
    initPromise = initDB().catch(e=>{
      console.error('DB init error:', e && e.message);
      initPromise = null; // اسمح بإعادة المحاولة في الـ request الجاي
      throw e;
    });
  }
  return initPromise;
}

// للـ dev المحلي: شغّل السيرفر على PORT
if(!process.env.VERCEL){
  ensureInit().then(()=>{
    app.listen(PORT, ()=> console.log('SERVER UP ON PORT ' + PORT));
  }).catch(e=>{
    console.log('DB ERROR: ' + e.message);
  });
}

// شبكة أمان: منع انهيار السيرفر بالكامل لو حصل خطأ غير متوقع في endpoint واحد
// (مهم للتشغيل المباشر — خطأ في طلب واحد ميرجعش المنصة كلها)
process.on('unhandledRejection', (err) => {
  console.error('[safety] unhandledRejection:', err && (err.code || ''), err && err.message);
});
process.on('uncaughtException', (err) => {
  console.error('[safety] uncaughtException:', err && (err.code || ''), err && err.message);
});

// Vercel serverless export — init بيتعمل على أول request
// مهم: لو الـ DB فشل، ردّ JSON واضح بدل ما Vercel يرجّع صفحة HTML خطأ
// (صفحة HTML بتخلّي r.json() في العميل يرمي → رسالة "السيرفر مش شغال" العامة)
module.exports = async (req, res) => {
  try {
    await ensureInit();
  } catch(e){
    console.error('ensureInit failed:', e && e.message);
    if(!res.headersSent){
      res.status(500).json({
        ok:false,
        error:'database',
        msg:'فشل الاتصال بقاعدة البيانات — تأكد إن DATABASE_URL متظبط على Vercel Environment Variables وعملت Redeploy',
        detail: e && e.message ? String(e.message).slice(0,200) : 'unknown'
      });
    }
    return;
  }
  app(req, res);
};
