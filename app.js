// ===== Version ===== 
const APP_VERSION = '3.5.1-gh-nosw-tabs-importcsv-bio'; 
// Keys 
const K_TX='budget.transactions.v1', K_BUD='budget.budgets.v1', K_REC='budget.recurrences.v3', K_CUR='budget.currency.v1'; 
const K_LOCK_ENABLED='budget.lock.enabled.v1', K_WEBAUTHN_CRED='budget.lock.cred.v1', K_LOCK_PIN='budget.lock.pin.v1'; 
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}, save=(k,v)=>localStorage.setItem(k,JSON.stringify(v)); 
const on=(el,evt,fn)=>{if(el) el.addEventListener(evt,fn)}; 
const b64uToBytes=(str)=>Uint8Array.from(atob(str.replace(/\-/g,'+').replace(/\_/g,'/')),c=>c.charCodeAt(0)); 
const bytesToB64u=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); 
let transactions=load(K_TX,[]), budgets=load(K_BUD,{}), recurrences=load(K_REC,[]), currency=load(K_CUR,'EUR'); 
const CATS=[ 
 {id:'logement',label:'Logement',emoji:'🏠',color:'#3b82f6'}, 
 {id:'transport',label:'Transport',emoji:'🚗',color:'#f59e0b'}, 
 {id:'alimentation',label:'Alimentation',emoji:'🍽️',color:'#22c55e'}, 
 {id:'sante',label:'Santé',emoji:'🩺',color:'#ef4444'}, 
 {id:'loisirs',label:'Loisirs',emoji:'🎮',color:'#a855f7'}, 
 {id:'shopping',label:'Shopping',emoji:'🛍️',color:'#ec4899'}, 
 {id:'factures',label:'Factures',emoji:'📄',color:'#14b8a6'}, 
 {id:'assurances',label:'Assurances',emoji:'🛡️',color:'#0ea5e9'}, 
 {id:'salaire',label:'Salaire',emoji:'💶',color:'#84cc16'}, 
 {id:'autres',label:'Autres',emoji:'🧩',color:'#64748b'}, 
]; 
const catOf=id=>CATS.find(c=>c.id===id)
??{emoji:'🧩',label:'Autres',id:'autres',color:'#64748b'}; 
const fmt=a=>{try{return new Intl.NumberFormat(navigator.language,{style:'currency',currency}).format(a)}catch{return a.toFixed(2)+' '+currency}}; 
const ymd=d=>d.toISOString().slice(0,10); 
const parseNum=s=>{if(!s)return NaN;return Number(String(s).replace(',','.').replace(/\s/g,''))}; 
const monthStart=d=>{const x=new Date(d.getFullYear(),d.getMonth(),1);x.setHours(0,0,0,0);return x}; 
const monthEnd=d=>{const x=new Date(d.getFullYear(),d.getMonth()+1,0);x.setHours(23,59,59,999);return x}; 
let current=monthStart(new Date()); 
// DOM 
const elMonth=document.getElementById('monthLabel'); 
const elList=document.getElementById('list'); 
const incomeEl=document.getElementById('income'); 
const expenseEl=document.getElementById('expense'); 
const balanceEl=document.getElementById('balance'); 
const form=document.getElementById('form'); 
const dateInput=document.getElementById('date'); 
const isIncomeInput=document.getElementById('isIncome'); 
const chartCanvas=document.getElementById('chart'); 
const balanceLineCanvas=document.getElementById('balanceLine'); 
const donutCanvas=document.getElementById('donutCat'); 
const recForm=document.getElementById('recForm'); 
const recCat=document.getElementById('recCategory'); 
const recEndType=document.getElementById('recEndType'); 
const recEndDate=document.getElementById('recEndDate'); 
const recCount=document.getElementById('recCount'); 
const recList=document.getElementById('recList'); 
const budgetsList=document.getElementById('budgetsList'); 
const saveBudgetsBtn=document.getElementById('saveBudgets'); 
const alertsBox=document.getElementById('budgetAlerts'); 
const alertsDiv=document.getElementById('alerts'); 
// Tabs 
const tabButtons=[...document.querySelectorAll('.tabbar .tab')]; 
const pages={home:document.getElementById('page-home'),charts:document.getElementById('page-charts'),manage:document.getElementById('page-manage')}; 
function setTab(name){ 
 Object.entries(pages).forEach(([k,el])=>el&&el.classList.toggle('active',k===name)); 
 tabButtons.forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); 
 if(name==='charts'){const list=filteredMonth();drawCategoryBars(list);drawBalanceLine();drawDonut(list);} } 
// Dropdown catégorie 
const catDDBtn=document.getElementById('catDDBtn'); 
const catDDLabel=document.getElementById('catDDLabel'); 
const catDDList=document.getElementById('catDDList'); 
const catHidden=document.getElementById('category'); 
function buildCategoryDropdown(){ 
 if(!catDDList||!catDDBtn||!catHidden||!catDDLabel) return; 
 catDDList.innerHTML=CATS.map(c=>`<div class="dropdown-item" data-id="${c.id}"><span class="dropdown-emoji">${c.emoji}</span><span>${c.label}</span></div>`).join(''); 
 on(catDDList,'click',e=>{const it=e.target.closest('[data-id]');if(!it)return;const id=it.getAttribute('data-id');const c=catOf(id);catHidden.value=id;catDDLabel.textContent=c.label;catDDList.style.display='none';}); 
 on(catDDBtn,'click',()=>{const open=catDDList.style.display!=='none';catDDList.style.display=open?'none':'block'}); 
 on(document,'click',e=>{const within=e.target.closest('.dropdown');if(!within&&catDDList) catDDList.style.display='none';}); 
} 
// ===== Récurrences ===== 
function freqNextDate(dateStr,freq){const base=new Date(dateStr);if(freq==='daily')return ymd(new Date(base.getFullYear(),base.getMonth(),base.getDate()+1));if(freq==='weekly')return ymd(new Date(base.getFullYear(),base.getMonth(),base.getDate()+7));return ymd(new Date(base.getFullYear(),base.getMonth()+1,base.getDate()));} 
function applyRecurrences(){const today=ymd(new Date());let changed=false;for(const r of recurrences){let guard=0;while(!r.ended&&r.nextDate&&r.nextDate<=today){if(r.endType==='until'&&r.endDate&&r.nextDate>r.endDate){r.ended=true;break}if(r.endType==='count'&&r.remaining!=null&&r.remaining<=0){r.ended=true;break}transactions.push({id:crypto.randomUUID(),label:r.label,amount:r.amount,category:r.category,date:r.nextDate,notes:r.notes??'[auto]'});if(r.endType==='count'&&r.remaining!=null){r.remaining-=1}const nd=freqNextDate(r.nextDate,r.freq);if(r.endType==='until'&&r.endDate&&nd>r.endDate){r.nextDate=null;r.ended=true}else if(r.endType==='count'&&r.remaining!=null&&r.remaining<=0){r.nextDate=null;r.ended=true}else{r.nextDate=nd}changed=true;guard++;if(guard>1000)break}}if(changed){save(K_TX,transactions);save(K_REC,recurrences)}} 
// ===== Rendering ===== 
function monthLabel(d){try{return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(d)}catch{const m=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];return m[d.getMonth()]+' '+d.getFullYear()}} 
function filteredMonth(){const s=monthStart(current),e=monthEnd(current);return transactions.filter(tx=>{const dt=new Date(tx.date);return dt>=s&&dt<=e}).sort((a,b)=>new Date(b.date)-new Date(a.date))} 
function totals(list){const inc=list.filter(t=>t.amount>0).reduce((a,t)=>a+t.amount,0);const exp=list.filter(t=>t.amount<0).reduce((a,t)=>a+t.amount,0);return {income:inc,expense:exp,balance:inc+exp}} 
function render(){ 
 if(elMonth) elMonth.textContent=monthLabel(current).replace(/^[a-z]/,m=>m.toUpperCase()); 
 const monthTx=filteredMonth(); 
 const t=totals(monthTx); 
 if(incomeEl) incomeEl.textContent=fmt(t.income); 
 if(expenseEl) expenseEl.textContent=fmt(t.expense); 
 if(balanceEl) balanceEl.textContent=fmt(t.balance); 
 if(elList) elList.innerHTML=monthTx.map(t=>{const c=catOf(t.category);const color=t.amount>=0?'income':'expense';const d=new Date(t.date).toLocaleDateString('fr-FR');return `<div class=\"item\" style=\"display:flex;align-items:center;gap:10px;justify-content:space-between;padding:12px;border-bottom:1px solid #1e293b\"><div style=\"display:flex;align-items:center;gap:10px\"><div class=\"cat\" style=\"font-size:18px\">${c.emoji}</div><div><div>${t.label}</div><div class=\"small\">${c.label} • ${d}${t.notes?` • ${t.notes}`:''}</div></div></div><div class=\"amount ${color}\">${fmt(t.amount)}</div><button class=\"btn danger\" onclick=\"delTx('${t.id}')\">✕</button></div>`}).join(''); 
 if(pages.charts && pages.charts.classList.contains('active')){drawCategoryBars(monthTx);drawBalanceLine();drawDonut(monthTx);} 
 if(alertsBox&&alertsDiv){const byCat={};for(const tx of monthTx){if(tx.amount<0)byCat[tx.category]=(byCat[tx.category]??0)+Math.abs(tx.amount)}const over=Object.entries(budgets).filter(([k,b])=>Number(b)>0&&(byCat[k]??0)>Number(b));if(over.length){alertsBox.style.display='block';alertsDiv.innerHTML=over.map(([k,b])=>{const spent=byCat[k]??0;const c=catOf(k);return `<div class="item" style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:12px;border-bottom:1px solid #1e293b"><div style="display:flex;align-items:center;gap:10px"><div class="cat">${c.emoji}</div><div>${c.label}</div></div><div class="amount expense">${fmt(spent)} / ${fmt(Number(b))}</div></div>`}).join('')}else{alertsBox.style.display='none'}} 
} 
// ===== Graphs ===== 
function setupCanvas(canvas){const dpr=window.devicePixelRatio||1;const W=canvas.clientWidth*dpr;const H=canvas.clientHeight*dpr;canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return {ctx,W:canvas.clientWidth,H:canvas.clientHeight}}; 
function drawCategoryBars(list){ if(!chartCanvas) return; const {ctx,W,H}=setupCanvas(chartCanvas); ctx.clearRect(0,0,W,H); const sums={}; for(const t of list){sums[t.category]=(sums[t.category]??0)+t.amount} const entries=Object.entries(sums).map(([k,v])=>({k,v})).sort((a,b)=>a.v-b.v); const pad=16; const barH=Math.max(18, Math.min(28, (H-pad*2)/Math.max(1,entries.length)-8)); const maxAbs=Math.max(1,...entries.map(e=>Math.abs(e.v))); const mid=W/2; ctx.textBaseline='middle'; ctx.font='12px system-ui'; let y=pad; entries.forEach(e=>{const c=catOf(e.k); const val=e.v; const w=(W/2 - pad) * Math.abs(val)/maxAbs; const x=val>=0? mid : mid - w; ctx.fillStyle=val>=0?'#22c55e':'#ef4444'; ctx.fillRect(x,y,w,barH); ctx.fillStyle='#94a3b8'; ctx.fillText(`${c.emoji} ${c.label}`, 6, y+barH/2); const label=fmt(val); const tw=ctx.measureText(label).width; ctx.fillText(label, W - tw - 6, y+barH/2); y += barH + 8; }); ctx.strokeStyle='#1f2a44'; ctx.beginPath(); ctx.moveTo(mid,0); ctx.lineTo(mid,H); ctx.stroke(); } 
function drawBalanceLine(){ if(!balanceLineCanvas) return; const {ctx,W,H}=setupCanvas(balanceLineCanvas); ctx.clearRect(0,0,W,H); const days={}; for(const t of transactions){days[t.date]=(days[t.date]??0)+t.amount} const entries=Object.entries(days).map(([d,v])=>({d:new Date(d),v})).sort((a,b)=>a.d-b.d); if(entries.length<2){return} let bal=0; const pts=entries.map(e=>{bal+=e.v; return {d:e.d, bal}}); const minX=pts[0].d.getTime(), maxX=pts[pts.length-1].d.getTime(); const minY=Math.min(...pts.map(p=>p.bal)); const maxY=Math.max(...pts.map(p=>p.bal)); const nx=t=> ( (t-minX)/(maxX-minX||1) )*(W-40)+20; const ny=v=> H - ( (v-minY)/(maxY-minY||1) )*(H-30) - 15; ctx.strokeStyle='#60a5fa'; ctx.lineWidth=2; ctx.beginPath(); pts.forEach((p,i)=>{const x=nx(p.d.getTime()), y=ny(p.bal); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)}); ctx.stroke(); } 
function drawDonut(list){ if(!donutCanvas) return; const {ctx,W,H}=setupCanvas(donutCanvas); ctx.clearRect(0,0,W,H); const cx=W/2, cy=H/2; const r=Math.min(W,H)/2*0.7; const ri=r*0.55; const sums={}; for(const t of list){const abs=Math.abs(t.amount); sums[t.category]=(sums[t.category]??0)+abs} const entries=Object.entries(sums).map(([k,v])=>({k,v})).filter(e=>e.v>0); const total=entries.reduce((a,b)=>a+b.v,0); if(total<=0) return; let a0=-Math.PI/2; entries.forEach(e=>{const c=catOf(e.k); const a1=a0 + (e.v/total)*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a0,a1); ctx.closePath(); ctx.fillStyle=c.color; ctx.fill(); a0=a1; }); ctx.globalCompositeOperation='destination-out'; ctx.beginPath(); ctx.arc(cx,cy,ri,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation='source-over'; } 
// ===== Transactions actions ===== 
function addTx(e){ e.preventDefault(); const label=document.getElementById('label').value.trim(); const amountText=document.getElementById('amount').value; const amtRaw=parseNum(amountText); const isIncome=isIncomeInput&&isIncomeInput.checked; const category=(document.getElementById('category')?.value)??'autres'; const date=(document.getElementById('date')?.value)??ymd(new Date()); const notes=document.getElementById('notes').value.trim(); if(!label){alert('Libellé requis');return} if(!isFinite(amtRaw)){alert('Montant invalide');return} const amount=isIncome?Math.abs(amtRaw):-Math.abs(amtRaw); const tx={id:crypto.randomUUID(),label,amount,category,date,notes}; transactions.unshift(tx); save(K_TX,transactions); form.reset(); document.getElementById('date').value=ymd(new Date()); const l=document.getElementById('catDDLabel'); if(l) l.textContent='Autres'; const h=document.getElementById('category'); if(h) h.value='autres'; render(); } 
function delTx(id){ transactions=transactions.filter(t=>t.id!==id); save(K_TX,transactions); render(); } 
// ===== Recurrences CRUD ===== 
function addRecurrence(e){ e.preventDefault(); const label=document.getElementById('recLabel').value.trim(); const amountRaw=parseNum(document.getElementById('recAmount').value); const isIncome=document.getElementById('recIsIncome').checked; const category=recCat?recCat.value:'autres'; const start=document.getElementById('recStart').value??ymd(new Date()); const freq=document.getElementById('recFreq').value; const endType=document.getElementById('recEndType').value; const endDate=document.getElementById('recEndDate').value??null; const count=parseInt(document.getElementById('recCount').value??'0',10); if(!label||!isFinite(amountRaw))return; if(endType==='until'&&!endDate){alert('Choisissez une date de fin.');return} if(endType==='count'&&!(count>0)){alert("Renseignez un nombre d'occurrences (>0).");return} const amount=isIncome?Math.abs(amountRaw):-Math.abs(amountRaw); const rec={id:crypto.randomUUID(),label,amount,category,notes:'',freq,nextDate:start,endType,endDate,remaining:(endType==='count'?count:null),ended:false}; recurrences.push(rec); save(K_REC,recurrences); renderRecurrences(); alert('Récurrence ajoutée'); recForm&&recForm.reset(); } 
function renderRecurrences(){ if(!recList) return; recList.innerHTML=recurrences.map(r=>{ const c=catOf(r.category); const f=r.freq==='monthly'?'Mensuel':r.freq==='weekly'?'Hebdomadaire':'Quotidien'; let endTxt='Sans fin'; if(r.endType==='until') endTxt="Jusqu'au "+r.endDate; if(r.endType==='count') endTxt=(r.remaining!=null?(r.remaining+' restant(s)'):'Compte défini'); const status=r.ended?'<span class="badge">Terminé</span>':''; return `<div class="item" style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:12px;border-bottom:1px solid #1e293b"><div style="display:flex;align-items:center;gap:10px"><div class="cat">${c.emoji}</div><div><div>${r.label}</div><div class="small">${f} • prochaine: ${r.nextDate??'-'} • ${endTxt}</div></div></div><div class="amount ${r.amount>=0?'income':'expense'}">${fmt(r.amount)}</div>${status}<div class="actions"><button class="btn danger" onclick="delRec('${r.id}')">✕</button></div></div>`}).join(''); } 
function delRec(id){ recurrences=recurrences.filter(r=>r.id!==id); save(K_REC,recurrences); renderRecurrences(); } 
function saveBudgets(){ const obj={}; for(const c of CATS){ const el=document.getElementById('bud_'+c.id); const v=parseNum(el&&el.value); if(isFinite(v)&&v>0) obj[c.id]=v } budgets=obj; save(K_BUD,budgets); render(); alert('Budgets enregistrés'); } 
// ===== Month navigation ===== 
function changeMonth(delta){ const d=new Date(current.getFullYear(),current.getMonth()+delta,1); current=monthStart(d); render(); } 
// ===== Import CSV (merge or sync) ===== 
function parseCSV(text){ const rows=[]; let field='', row=[], inQuotes=false; for(let i=0;i<text.length;i++){ const ch=text[i]; if(ch=='"'){ if(inQuotes && text[i+1]=='"'){ field+='"'; i++; } else { inQuotes=!inQuotes; } } else if(ch===',' && !inQuotes){ row.push(field); field=''; } else if((ch=='\n'||ch=='\r') && !inQuotes){ if(field.length||row.length){ row.push(field); rows.push(row); row=[]; field=''; } } else { field+=ch; } } if(field.length||row.length){ row.push(field); rows.push(row); } return rows.filter(r=>r.length && r.some(x=>x!=='')); } 
function slug(s){ return String(s??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').replace(/ /g,'-'); } 
function recKey(obj){ if (obj.key) return obj.key.trim(); return `${slug(obj.label)}_${(obj.category??'autres').toLowerCase()}_${(obj.freq??obj.frequency??'monthly').toLowerCase()}`; } 
function sameRec(a,b){ return ( (a.label??'').trim()===(b.label??'').trim() && Number(a.amount)===Number(b.amount) && (a.category??'').trim()===(b.category??'').trim() && (a.notes??'')===(b.notes??'') && (a.freq??'')===(b.freq??b.frequency??'') && (a.nextDate??a.start_date??'')===(b.nextDate??b.start_date??'') && (a.endType??'')===(b.endType??b.end_type??'') && (a.endDate??'')===(b.endDate??b.end_date??'') && String(a.remaining??'')===String(b.remaining??b.count??'') ); } 
function importRecurrencesCSVFile(file){ const reader=new FileReader(); reader.onload=()=>{ 
 const text=reader.result; const rows=parseCSV(text); if(!rows.length){ alert('CSV vide'); return; } 
 const header=rows.shift().map(h=>h.trim().toLowerCase()); const idx=name=>header.indexOf(name); 
 const required=['label','amount','type','category','start_date','frequency','end_type']; 
 for(const name of required){ if(idx(name)===-1){ alert('Colonne manquante: '+name); return; } } 
 const incoming=[]; 
 for(const r of rows){ 
 const obj={ 
 label:(r[idx('label')]??'').trim(), 
 amount: (((r[idx('type')]??'expense').toLowerCase()==='income') ? Math.abs(parseNum(r[idx('amount')])) : -Math.abs(parseNum(r[idx('amount')])) ), 
 category:(r[idx('category')]??'autres').trim()??'autres', 
 notes: idx('notes')>-1 ? (r[idx('notes')]??'').trim() : '', 
 freq:(r[idx('frequency')]??'monthly').toLowerCase(), 
 nextDate:(r[idx('start_date')]??ymd(new Date())).trim(), 
 endType:(r[idx('end_type')]??'none').toLowerCase(), 
 endDate: idx('end_date')>-1 ? (r[idx('end_date')]??'').trim() : null, 
 remaining: idx('count')>-1 ? (parseInt(r[idx('count')]??'0',10) ?? null) : null, 
 }; 
 if (idx('key')>-1) obj.key = (r[idx('key')]??'').trim(); 
 incoming.push(obj); 
 } 
 const modeSync = document.getElementById('importSyncMode')?.checked !== false; // default true 
 const currentMap = new Map(); for(const r of recurrences){ currentMap.set(recKey(r), r); } 
 const incomingMap = new Map(); for(const r of incoming){ incomingMap.set(recKey(r), r); } 
 const toAdd=[], toUpdate=[], toDelete=[]; 
 for(const [k, inc] of incomingMap.entries()){ 
 const cur = currentMap.get(k); 
 if(!cur){ toAdd.push(inc); } 
 else { 
 if(!sameRec({label:cur.label,amount:cur.amount,category:cur.category,notes:cur.notes,freq:cur.freq,nextDate:cur.nextDate,endType:cur.endType,endDate:cur.endDate,remaining:cur.remaining}, inc)){ 
 toUpdate.push({key:k, cur, inc}); 
 } 
 } 
 } 
 for(const [k, cur] of currentMap.entries()){ 
 if(!incomingMap.has(k)) toDelete.push({key:k, cur}); 
 } 
 const msg=`Synchronisation CSV :\n + Ajouter : ${toAdd.length}\n ~ Mettre à jour : ${toUpdate.length}\n - Supprimer : ${toDelete.length}\n\nContinuer ?`; 
 if(!modeSync){ const msgMerge=`Import (ajout uniquement) : ${toAdd.length} à ajouter. Continuer ?`; if(!confirm(msgMerge)) return; toDelete.length=0; toUpdate.length=0; } 
 else { if(!confirm(msg)) return; } 
 for(const r of toAdd){ const rec={ id:crypto.randomUUID(), label:r.label, amount:r.amount, category:r.category, notes:r.notes, freq:r.freq, nextDate:r.nextDate, endType:r.endType, endDate:r.endDate, remaining:r.remaining, ended:false }; recurrences.push(rec); } 
 for(const u of toUpdate){ const cur=u.cur, inc=u.inc; cur.label=inc.label; cur.amount=inc.amount; cur.category=inc.category; cur.notes=inc.notes; cur.freq=inc.freq; cur.nextDate=inc.nextDate; cur.endType=inc.endType; cur.endDate=inc.endDate; cur.remaining=inc.remaining; cur.ended=false; } 
 if(modeSync && toDelete.length){ const delKeys=new Set(toDelete.map(x=>x.key)); recurrences=recurrences.filter(r=>!delKeys.has(recKey(r))); } 
 save(K_REC, recurrences); renderRecurrences(); alert('Import terminé'); 
}; reader.readAsText(file,'utf-8'); } 
(function initImportCSV(){ const btn=document.getElementById('importRecCSVBtn'); const input=document.getElementById('importRecCSV'); if(!btn||!input) return; btn.addEventListener('click',()=>input.click()); input.addEventListener('change',e=>{ if(e.target.files && e.target.files[0]) importRecurrencesCSVFile(e.target.files[0]); }); })(); 
// ===== Biometrics (WebAuthn) ===== 
function ensureLockOverlay(){ if(document.getElementById('lockOverlay')) return; const ov=document.createElement('div'); ov.id='lockOverlay'; ov.className='lock-overlay'; ov.style.display='none'; ov.innerHTML=` 
 <div class="card" style="max-width:420px;"> 
 <h3 style="margin-top:0">App verrouillée</h3> 
 <div>Authentifiez-vous pour continuer.</div> 
 <div class="actions" style="margin-top:10px"> 
 <button id="unlockFaceBtn" class="btn">Face ID / Touch ID</button> 
 <button id="unlockPinBtn" class="btn secondary">PIN</button> 
 </div> 
 <div id="pinBox" style="margin-top:8px; display:none"> 
 <input id="pinInput" class="input" placeholder="PIN (4-6 chiffres)" inputmode="numeric" /> 
 <div class="actions" style="margin-top:8px"> 
 <button id="pinSubmit" class="btn">Valider PIN</button> 
 </div> 
 </div> 
 </div>`; document.body.appendChild(ov); 
 document.getElementById('unlockPinBtn').addEventListener('click',()=>{ document.getElementById('pinBox').style.display='block'; }); 
 document.getElementById('pinSubmit').addEventListener('click',()=>{ const setPin=localStorage.getItem(K_LOCK_PIN); const input=(document.getElementById('pinInput').value??'').trim(); if(setPin && input && input===setPin){ hideLockOverlay(); } else { alert('PIN invalide'); } }); 
 document.getElementById('unlockFaceBtn').addEventListener('click', performWebAuthnGet); 
} 
function showLockOverlay(){ ensureLockOverlay(); const ov=document.getElementById('lockOverlay'); ov.style.display='flex'; ov.style.position='fixed'; ov.style.inset='0'; ov.style.zIndex='99999'; ov.style.background='rgba(11,18,32,.96)'; ov.style.backdropFilter='blur(6px)'; ov.style.display='flex'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.color='#e2e8f0'; } 
function hideLockOverlay(){ const ov=document.getElementById('lockOverlay'); if(ov) ov.style.display='none'; } 
function randomChallenge(len=32){ const r=new Uint8Array(len); crypto.getRandomValues(r); return r; } 
async function performWebAuthnCreate(){ try{ const pubKey={ challenge:randomChallenge(), rp:{name:'MyMbudGet'}, user:{ id: crypto.getRandomValues(new Uint8Array(16)), name:'local-user', displayName:'Local User' }, pubKeyCredParams:[{type:'public-key', alg:-7}], authenticatorSelection:{ authenticatorAttachment:'platform', residentKey:'required', userVerification:'required' }, timeout:60000 }; 
 const cred=await navigator.credentials.create({ publicKey: pubKey }); const credId=new Uint8Array(cred.rawId); localStorage.setItem(K_WEBAUTHN_CRED, bytesToB64u(credId)); localStorage.setItem(K_LOCK_ENABLED,'1'); alert('Verrouillage Face ID activé'); const wantPin=confirm('Voulez-vous définir un PIN de secours ?'); if(wantPin){ const pin=prompt('Entrez un PIN (4-6 chiffres) :',''); if(pin && /^\d{4,6}$/.test(pin)) localStorage.setItem(K_LOCK_PIN, pin); } showLockOverlay(); } catch(e){ console.error(e); alert('Création de la clé Face ID impossible (HTTPS/compatibilité).'); } } 
async function performWebAuthnGet(){ try{ const storedId=localStorage.getItem(K_WEBAUTHN_CRED); const allow= storedId ? [{type:'public-key', id:b64uToBytes(storedId)}] : undefined; const pubKey={ challenge:randomChallenge(), userVerification:'required', allowCredentials: allow }; const assertion=await navigator.credentials.get({ publicKey: pubKey }); hideLockOverlay(); } catch(e){ console.error(e); alert('Authentification biométrique refusée/indisponible.'); } } 
on(document.getElementById('enableLock'),'click', performWebAuthnCreate); 
on(document.getElementById('unlockNow'),'click', performWebAuthnGet); 
on(document.getElementById('disableLock'),'click',()=>{ localStorage.removeItem(K_LOCK_ENABLED); localStorage.removeItem(K_WEBAUTHN_CRED); alert('Verrouillage désactivé'); hideLockOverlay(); }); 
(function enforceLockOnStart(){ ensureLockOverlay(); if(localStorage.getItem(K_LOCK_ENABLED)==='1'){ showLockOverlay(); } })(); 


// ===== Floating Action Buttons (TX & REC) and ?new= intent handling =====
function setupPlusButtons() {
  // FAB for transaction
  const fabTx = document.createElement('button');
  fabTx.id = 'fabNewTx';
  fabTx.className = 'fab';
  fabTx.title = 'Nouvelle saisie';
  fabTx.setAttribute('aria-label', 'Nouvelle saisie');
  fabTx.textContent = '+';

  // FAB for recurrence
  const fabRec = document.createElement('button');
  fabRec.id = 'fabNewRec';
  fabRec.className = 'fab fab--secondary';
  fabRec.title = 'Nouvelle récurrence';
  fabRec.setAttribute('aria-label', 'Nouvelle récurrence');
  fabRec.textContent = '↻';

  document.body.appendChild(fabTx);
  document.body.appendChild(fabRec);

  // Prepare target URLs
  const base = new URL(window.location.href);
  const urlTx = new URL(base);
  urlTx.searchParams.set('new', 'tx');
  const urlRec = new URL(base);
  urlRec.searchParams.set('new', 'rec');

  const openSmall = (urlStr) => {
    const w = 520, h = 760;
    const left = Math.round((window.screen.width - w) / 2);
    const top = Math.round((window.screen.height - h) / 2);
    window.open(urlStr, '_blank', `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  };

  fabTx.addEventListener('click', () => openSmall(urlTx.toString()));
  fabRec.addEventListener('click', () => openSmall(urlRec.toString()));
}

function handleNewIntent() {
  const params = new URLSearchParams(window.location.search);
  const val = params.get('new');
  if (!val) return;

  if (val === '1' || val === 'tx') {
    setTab('home');
    const d = document.getElementById('date'); if (d) d.value = ymd(new Date());
    const catHidden = document.getElementById('category'); if (catHidden) catHidden.value = 'autres';
    const catLabel = document.getElementById('catDDLabel'); if (catLabel) catLabel.textContent = 'Autres';
    const label = document.getElementById('label'); if (label) label.focus();
  }

  if (val === 'rec') {
    setTab('manage');
    const s = document.getElementById('recStart'); if (s) s.value = ymd(new Date());
    if (recCat) recCat.value = 'autres';
    const recLbl = document.getElementById('recLabel'); if (recLbl) recLbl.focus();
    if (recEndDate) recEndDate.classList.add('hidden');
    if (recCount) recCount.classList.add('hidden');
  }
}

$1 
function init(){ if(dateInput) dateInput.value=ymd(new Date()); tabButtons.forEach(b=>on(b,'click',()=>setTab(b.dataset.tab))); buildCategoryDropdown(); on(recEndType,'change',()=>{ if(recEndDate) recEndDate.classList.toggle('hidden',recEndType.value!=='until'); if(recCount) recCount.classList.toggle('hidden',recEndType.value!=='count'); }); if(recEndDate) recEndDate.classList.add('hidden'); if(recCount) recCount.classList.add('hidden'); if(recCat) recCat.innerHTML=CATS.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join(''); if(budgetsList) budgetsList.innerHTML=CATS.map(c=>{ const v=budgets[c.id]??''; return `<div class="col"><label>${c.emoji} ${c.label}</label><input class="input" id="bud_${c.id}" placeholder="Budget mensuel (ex: 200)" value="${v}"></div>`}).join(''); on(window,'resize',()=>render()); on(document.getElementById('prev'),'click',()=>changeMonth(-1)); on(document.getElementById('next'),'click',()=>changeMonth(1)); on(form,'submit',addTx); on(recForm,'submit',addRecurrence); on(saveBudgetsBtn,'click',saveBudgets); applyRecurrences(); render(); } 
init();
