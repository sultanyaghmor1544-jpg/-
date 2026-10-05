const morningTab=document.querySelector('#morningTab'), eveningTab=document.querySelector('#eveningTab'), list=document.querySelector('#adhkar'), notifyBtn=document.querySelector('#notifyBtn'), nextPrayer=document.querySelector('#nextPrayer');
let mode=localStorage.getItem('thakir-mode')||'morning';

function targetCount(benefit=''){
  const s=String(benefit).trim();
  if(/مائة/.test(s)) return 100;
  if(/عشر/.test(s)) return 10;
  if(/سبع/.test(s)) return 7;
  if(/أربع/.test(s)) return 4;
  if(/ثلاث/.test(s)) return 3;
  if(/مرتين|مرتان/.test(s)) return 2;
  return 1;
}

function getCount(m,i){
  const key=`count-${m}-${i}`;
  const saved=Number.parseInt(localStorage.getItem(key),10);
  if(Number.isFinite(saved) && saved>=0) return saved;
  // Migrate the old yes/no completion state from the first version.
  if(localStorage.getItem(`done-${m}-${i}`)==='1'){
    const target=targetCount((m==='morning'?MORNING:EVENING)[i]?.benefit);
    localStorage.setItem(key,String(target));
    return target;
  }
  return 0;
}

function render(){
  document.body.className=mode;
  morningTab.classList.toggle('active',mode==='morning');
  eveningTab.classList.toggle('active',mode==='evening');
  list.innerHTML='';
  (mode==='morning'?MORNING:EVENING).forEach((z,i)=>{
    const target=targetCount(z.benefit);
    const count=Math.min(getCount(mode,i),target);
    const el=document.createElement('article');
    el.className='zekr';
    el.innerHTML=`<div class="text">${z.text}</div>${z.benefit?`<div class="benefit">${z.benefit}</div>`:''}<button class="mark${count>=target?' done':''}" aria-label="الذكر ${count} من ${target}" ${count>=target?'disabled':''}>${count}/${target}</button>`;
    el.querySelector('.mark').onclick=()=>{
      const next=Math.min(getCount(mode,i)+1,target);
      localStorage.setItem(`count-${mode}-${i}`,String(next));
      render();
    };
    list.appendChild(el);
  });
}

morningTab.onclick=()=>{mode='morning';localStorage.setItem('thakir-mode',mode);render()};
eveningTab.onclick=()=>{mode='evening';localStorage.setItem('thakir-mode',mode);render()};

async function prayerTimes(){
  try{
    const r=await fetch('https://api.aladhan.com/v1/timingsByCity?city=Jeddah&country=Saudi%20Arabia&method=4');
    const j=await r.json();
    const t=j.data.timings;
    nextPrayer.textContent=`الفجر ${t.Fajr}  •  العصر ${t.Asr}`;
    scheduleInPage('fajr',t.Fajr);
    scheduleInPage('asr',t.Asr)
  }catch(e){nextPrayer.textContent='فعّل الإنترنت لحساب وقت الفجر والعصر في جدة'}
}

function scheduleInPage(type,time){
  const [h,m]=time.split(':').map(Number), now=new Date(), target=new Date();
  target.setHours(h,m,0,0);
  if(target<=now)target.setDate(target.getDate()+1);
  const delay=target-now;
  setTimeout(()=>{
    if(Notification.permission==='granted')new Notification(type==='fajr'?'أذكار الصباح':'أذكار المساء',{body:type==='fajr'?'حان وقت أذكار الصباح 🌅':'حان وقت أذكار المساء 🌙',icon:'icon.svg'});
    scheduleInPage(type,time)
  },delay)
}

notifyBtn.onclick=async()=>{
  if(!('Notification'in window)){alert('هذا المتصفح لا يدعم إشعارات الموقع.');return}
  const p=await Notification.requestPermission();
  if(p==='granted'){
    notifyBtn.textContent='✓';
    alert('تم تفعيل الإشعارات. اترك التطبيق مفتوحًا للحصول على التذكير؛ الإشعارات المجدولة في الخلفية على iPhone تحتاج دعم Push من خادم.')
  }
};

if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
render();
prayerTimes();
