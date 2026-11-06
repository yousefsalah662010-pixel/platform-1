/* ============================================================
   المزامنة السحابية عبر Firebase Realtime Database
   ============================================================
   تُفعَّل تلقائيًا فقط عند تعبئة js/firebase-config.js بالقيم.
   الفكرة: أي جهاز يحفظ البيانات (dbSave) يرفع الحالة كاملة
   للسحابة، وكل جهاز آخر متصل يستلمها فورًا ويحدّث نفسه —
   بهذا تظهر الكورسات والرسايل والاشتراكات على كل الأجهزة.

   قواعد حماية البيانات:
   1) الحالة تُخزَّن كنص JSON واحد وليس ككائن، لأن RTDB يحذف
      المفاتيح ذات المصفوفات الفارغة ([]) فيضيع courses/messages.
   2) لا يُرفع قبل استلام أول نسخة من السحابة؛ وإن حُفظ شيء محلي
      قبل وصولها فسيُدمَج معها (عناصر جديدة بمعرّفات جديدة تُضاف،
      ونسخة السحابة هي الأساس) — حتى لا يضيع تسجيل طالب تم في
      لحظة فتح الصفحة الأولى.
   ============================================================ */
(function(){
  'use strict';
  const cfg = (typeof FIREBASE_CONFIG !== 'undefined') ? FIREBASE_CONFIG : null;
  if(!cfg || !cfg.apiKey || !cfg.databaseURL) return; /* لا إعدادات → وضع محلي */
  if(typeof firebase === 'undefined'){ console.warn('مكتبة Firebase لم تُحمَّل'); return; }

  window.TAHER_SYNC_ON = true;

  let applying = false;   /* أثناء تطبيق نسخة قادمة من السحابة */
  let lastJson = null;
  let gotRemote = false;  /* هل استلمنا أول نسخة من السحابة؟ */
  let pendingPush = false;/* يوجد حفظ محلي مؤجل لما يجهز الاتصال */

  const root = firebase.initializeApp(cfg).database().ref('taherState');

  function pushNow(){
    try{ root.set(JSON.stringify(dbLoad())); }
    catch(e){ console.warn('تعذر الرفع للسحابة', e); }
  }

  /* دمج آمن: نسخة السحابة أساس، والعناصر المحلية ذات المعرفات الجديدة تُضاف فقط */
  function mergeState(local, remote){
    try{
      const out = JSON.parse(JSON.stringify(remote));
      for(const k in local){
        if(Array.isArray(local[k]) && Array.isArray(out[k])){
          const ids = {};
          out[k].forEach(function(x){ if(x && x.id) ids[x.id] = 1; });
          local[k].forEach(function(x){ if(x && x.id && !ids[x.id]) out[k].push(x); });
        }
      }
      return out;
    }catch(e){ return remote; }
  }

  /* كل حفظ محلي يُرفع للسحابة — لكن بعد استلام أول نسخة فقط */
  const origSave = dbSave;
  dbSave = function(){
    origSave();
    if(applying) return;
    if(!gotRemote){ pendingPush = true; return; }
    pushNow();
  };

  /* استقبال النسخ الجديدة من الأجهزة الأخرى */
  root.on('value', function(snap){
    const remote = snap.val();
    if(remote === null || remote === undefined){
      gotRemote = true;
      /* قاعدة بيانات فاضية (أول تشغيل): الجهاز الذي يملك كورسات يرفع نسخته كبداية فقط،
         حتى لا يطغى جهاز زائر جديد فاضي على بيانات المدير */
      try{
        const st = dbLoad();
        if(st.courses && st.courses.length) pushNow();
      }catch(e){}
      pendingPush = false;
      return;
    }
    if(typeof remote !== 'string'){
      /* صيغة قديمة (كائن مفكك بفقدان المصفوفات الفارغة): نتجاهلها ونعيد رفع نسختنا الكاملة */
      gotRemote = true;
      if(!applying) pushNow();
      return;
    }
    let state;
    try{ state = JSON.parse(remote); }catch(e){ gotRemote = true; return; }
    gotRemote = true;
    /* لو حُفظ شيء محلي قبل وصول أول نسخة: ادمج ولا تُضيّع التسجيلات الجديدة */
    if(pendingPush){ state = mergeState(dbLoad(), state); }
    const json = JSON.stringify(state);
    if(json === lastJson){ pendingPush = false; return; }
    /* تخطّى الصدى: إن كانت مطابِقة للمحفوظ محليًا فلا داعي لإعادة تطبيق/رسم */
    try{ if(json === JSON.stringify(dbLoad())){ lastJson = json; pendingPush = false; return; } }catch(e){}
    lastJson = json;
    applying = true;
    try{
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      _state = JSON.parse(json);
    }catch(e){ console.warn('تعذر تطبيق النسخة السحابية', e); }
    applying = false;
    pendingPush = false;
    if(json !== remote) pushNow(); /* الدمج أضاف عناصر محلية → ارفع النسخة المدموجة */
    scheduleRefresh();
  });

  /* تحديث الواجهة: نؤجل وهو يكتب في حقل، ولا نقاطع أثناء درس/اختبار */
  function scheduleRefresh(){
    const ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)){
      setTimeout(scheduleRefresh, 3000);
      return;
    }
    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    if(page === 'lesson.html') return; /* التحديثات تظهر عند الانتقال للصفحة التالية */
    setTimeout(function(){ location.reload(); }, 1200);
  }
})();
