// Pill Man SLIM — minimalist meal-anchored planner
// Focus: log/edit pill & meal, set plan hours, show Next Pill (plan),
// default 8h reference, and the 3‑hour "DON'T EAT" window.

// ===== Helpers =====
const H = 3600e3; // 1 hour in ms
const $ = id => document.getElementById(id);
const nowTS = () => Date.now();
const two = n => String(n).padStart(2,'0');
const showClock = ts => {
  if (ts == null) return '—';
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${two(m)} ${ap}`;
};

// ===== State & persistence =====
let LAST_PILL_TS = null;  // timestamp (ms)
let LAST_MEAL_TS = null;  // timestamp (ms)
let PLAN_HOURS   = null;  // decimal hours (number)

const LS_KEY = 'pillman_slim_v1';
function saveLocal(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({V:1, P:LAST_PILL_TS, M:LAST_MEAL_TS, PH:PLAN_HOURS}));
  }catch(e){}
}
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY); if(!raw) return;
    const d = JSON.parse(raw);
    if (d && d.V===1){
      LAST_PILL_TS = (typeof d.P === 'number') ? d.P : null;
      LAST_MEAL_TS = (typeof d.M === 'number') ? d.M : null;
      PLAN_HOURS   = (typeof d.PH === 'number') ? d.PH : null;
    }
  }catch(e){}
}

// ===== Core render =====
function render(){
  const now = nowTS();

  // Derived: default (8h) and plan-based next pill
  const defaultNextPill = (LAST_PILL_TS!=null) ? (LAST_PILL_TS + 8*H) : null;
  const nextPillPlan   = (LAST_PILL_TS!=null && typeof PLAN_HOURS==='number')
    ? (LAST_PILL_TS + PLAN_HOURS*H) : null;

  // 3h DON'T EAT window: prefer plan if available; else temporary around last pill
  let noEatStart=null, noEatEnd=null;
  if (nextPillPlan!=null){
    noEatStart = nextPillPlan - 2*H;
    noEatEnd   = nextPillPlan + 1*H;
  } else if (LAST_PILL_TS!=null){
    noEatStart = LAST_PILL_TS - 2*H;
    noEatEnd   = LAST_PILL_TS + 1*H;
  }

  // Top window
  if ($('noeat_range')) $('noeat_range').textContent = (noEatStart!=null && noEatEnd!=null)
    ? `${showClock(noEatStart)} – ${showClock(noEatEnd)}` : '—';

  // Data rows — LAST PILL (time / hours)
  if ($('pill_time'))  $('pill_time').textContent  = LAST_PILL_TS ? showClock(LAST_PILL_TS) : '—';
  if ($('pill_hours')) $('pill_hours').textContent = LAST_PILL_TS ? `${((now - LAST_PILL_TS)/H).toFixed(1)} h` : '—';

  // LAST MEAL
  if ($('meal_time'))  $('meal_time').textContent  = LAST_MEAL_TS ? showClock(LAST_MEAL_TS) : '—';
  if ($('meal_hours')) $('meal_hours').textContent = LAST_MEAL_TS ? `${((now - LAST_MEAL_TS)/H).toFixed(1)} h` : '—';

  // PLAN hours
  if ($('plan_hours')) $('plan_hours').textContent = (typeof PLAN_HOURS==='number') ? `${PLAN_HOURS.toFixed(1)} h` : '—';

  // NEXT PILL (plan) and DEFAULT (8h)
  if ($('next_pill'))          $('next_pill').textContent          = nextPillPlan ? showClock(nextPillPlan) : '—';
  if ($('default_next_pill'))  $('default_next_pill').textContent  = defaultNextPill ? showClock(defaultNextPill) : '—';

  // OFFSET vs PLAN (plan−8)
  if ($('offset_vs_plan')){
    const off = (typeof PLAN_HOURS==='number') ? (PLAN_HOURS - 8) : null;
    $('offset_vs_plan').textContent = (off!=null) ? `${off>=0?'+':''}${off.toFixed(1)} h` : '—';
  }

  // DON'T EAT RANGE (row)
  if ($('noeat_times')) $('noeat_times').textContent = (noEatStart!=null && noEatEnd!=null)
    ? `${showClock(noEatStart)} – ${showClock(noEatEnd)}` : '—';
}

// ===== Input helpers =====
function parseClockInput(text){
  if(!text) return null;
  let s = String(text).trim();
  if(!s) return null;
  // allow trailing 'h' on time-of-day inputs (ignored)
  s = s.replace(/\s*h$/i,'');
  let isAM = false, isPM = false;
  const ampmMatch = s.match(/\s*(am|pm)$/i);
  if (ampmMatch){
    isAM = /am/i.test(ampmMatch[1]);
    isPM = /pm/i.test(ampmMatch[1]);
    s = s.replace(/\s*(am|pm)$/i,'').trim();
  }
  const d = new Date();
  // Case 1: HH:MM
  if (s.includes(':')){
    const [Hh, Mm='0'] = s.split(':');
    let hh = parseInt(Hh,10), mm = parseInt(Mm,10) || 0;
    if (isNaN(hh) || isNaN(mm)) return null;
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
    d.setHours(hh, mm, 0, 0);
    return d.getTime();
  }
  // Case 2: decimal hours like 8.5 (meaning 8:30)
  const f = parseFloat(s);
  if (isNaN(f)) return null;
  let hh = Math.floor(f);
  let mm = Math.round((f - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  if (isPM && hh < 12) hh += 12;
  if (isAM && hh === 12) hh = 0;
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

// ===== Wire controls =====
function wire(){
  const logPill=$('btn_log_pill'), editPill=$('btn_edit_pill');
  const logMeal=$('btn_log_meal'), editMeal=$('btn_edit_meal');
  const setPlan=$('btn_plan');

  if(logPill) logPill.onclick = ()=>{ LAST_PILL_TS = nowTS(); saveLocal(); render(); };
  if(editPill) editPill.onclick = ()=>{
    const cur = LAST_PILL_TS ? showClock(LAST_PILL_TS) : '';
    const inp = prompt('Enter last pill time (HH, HH:MM, or decimal like 8.5):', cur);
    const ts  = parseClockInput(inp);
    if(ts){ LAST_PILL_TS = ts; saveLocal(); render(); }
  };
  if(logMeal) logMeal.onclick = ()=>{ LAST_MEAL_TS = nowTS(); saveLocal(); render(); };
  if(editMeal) editMeal.onclick = ()=>{
    const cur = LAST_MEAL_TS ? showClock(LAST_MEAL_TS) : '';
    const inp = prompt('Enter last meal time (HH, HH:MM, or decimal like 8.5):', cur);
    const ts  = parseClockInput(inp);
    if(ts){ LAST_MEAL_TS = ts; saveLocal(); render(); }
  };
  if(setPlan) setPlan.onclick = ()=>{
    const cur = (typeof PLAN_HOURS==='number') ? PLAN_HOURS.toFixed(1) : '';
    const inp = prompt('Enter pill plan (hours, decimal OK, e.g. 7.5 or 8h):', cur);
    if(inp==null) return;
    const cleaned = String(inp).trim().replace(/h$/i,'');
    const v = Number(cleaned);
    if(!isNaN(v) && v>0){ PLAN_HOURS = v; saveLocal(); render(); }
  };
  const clearBtn=$('btn_clear');
  if(clearBtn) clearBtn.onclick = ()=>{ PLAN_HOURS = null; saveLocal(); render(); };
}

// ===== Boot =====
loadLocal();
wire();
render();
setInterval(render, 15000);
