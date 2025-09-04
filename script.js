// ===== Numeric helpers =====
const numUtil = (() => {
    const decPlaces = (x) => {
      const s = x.toString();
      const i = s.indexOf(".");
      return i === -1 ? 0 : s.length - i - 1;
    };
  
    const toScaled = (a, b = null) => {
      const da = decPlaces(a);
      const db = b == null ? 0 : decPlaces(b);
      const scale = 10 ** Math.max(da, db);
      return { a: Math.round(Number(a) * scale), b: b == null ? null : Math.round(Number(b) * scale), scale };
    };
  
    const add = (a, b) => { const {a: ai, b: bi, scale} = toScaled(a,b); return (ai+bi)/scale; };
    const sub = (a, b) => { const {a: ai, b: bi, scale} = toScaled(a,b); return (ai-bi)/scale; };
    const mul = (a, b) => { return Number((Number(a)*Number(b)).toFixed(Math.min(decPlaces(a)+decPlaces(b), 12))); };
    const div = (a, b) => { if(Number(b)===0) return NaN; return Number((Number(a)/Number(b)).toFixed(12)); };
    const clampExp = (n) => { if(!isFinite(n)) return n; const abs=Math.abs(n); if(abs!==0&&(abs<1e-12||abs>1e21)) return n; return n; };
    return { add, sub, mul, div, clampExp };
  })();
  
  // ===== Expression evaluator (shunting-yard) =====
  const evaluator = (() => {
    const precedence = { '+':1,'-':1,'*':2,'/':2 };
    const ops = { '+': numUtil.add, '-': numUtil.sub, '*': numUtil.mul, '/': numUtil.div };
  
    function tokenize(expr) {
      const tokens=[]; let i=0;
      while(i<expr.length){
        const ch=expr[i];
        if(ch===' '){ i++; continue; }
        if(/[0-9.]/.test(ch)){
          let j=i+1; while(j<expr.length&&/[0-9.]/.test(expr[j])) j++;
          tokens.push({type:'num', value: expr.slice(i,j)});
          i=j; continue;
        }
        if(/[+\-*/()]/.test(ch)){ tokens.push({type:'op', value:ch}); i++; continue; }
        i++;
      }
      return tokens;
    }
  
    function toRPN(tokens){
      const out=[], st=[];
      for(const t of tokens){
        if(t.type==='num') out.push(t);
        else if(t.type==='op'){
          const v=t.value;
          if(v==='(') st.push(t);
          else if(v===')'){ while(st.length && st[st.length-1].value!=='(') out.push(st.pop()); st.pop(); }
          else{
            while(st.length){
              const top=st[st.length-1].value;
              if(top!=='(' && precedence[top]>=precedence[v]) out.push(st.pop());
              else break;
            }
            st.push(t);
          }
        }
      }
      while(st.length) out.push(st.pop());
      return out;
    }
  
    function evalRPN(rpn){
      const st=[];
      for(const t of rpn){
        if(t.type==='num') st.push(Number(t.value));
        else { const b=st.pop(), a=st.pop(); st.push(ops[t.value](a,b)); }
      }
      return st.pop();
    }
  
    function evaluate(expression){
      try{ return evalRPN(toRPN(tokenize(expression))); } catch(e){ return NaN; }
    }
  
    return { evaluate };
  })();
  
  // ===== UI =====
  const exprEl=document.getElementById('expr');
  const resultEl=document.getElementById('result');
  const sepToggle=document.getElementById('sepToggle');
  const preciseToggle=document.getElementById('preciseToggle');
  const copyBtn=document.getElementById('copyBtn');
  
  let current='0', expression='', justEvaluated=false;
  
  const formatNumber=(n)=>{
    if(n==null) return '';
    if(!isFinite(n)) return 'Error';
    const useSep=sepToggle.checked;
    let s;
    if(preciseToggle.checked){ s=String(n); if(s.includes('e')) return s; }
    else{ s=Number(n).toLocaleString(undefined,{ maximumFractionDigits:10, useGrouping: useSep }); }
    if(useSep && !s.includes('e')){
      const [intPart, decPart]=s.split('.');
      const withSep=Number(intPart).toLocaleString(undefined,{ useGrouping:true });
      s = decPart? `${withSep}.${decPart}`: withSep;
    }
    if(s.length>24) s=Number(n).toExponential(8);
    return s;
  };
  
  const updateDisplay=()=>{ exprEl.textContent=expression; resultEl.textContent=formatNumber(current); };
  
  const pushNumber=(d)=>{
    if(justEvaluated){ current='0'; expression=''; justEvaluated=false; }
    if(current==='0' && d!=='.') current='';
    if(d==='.' && current.includes('.')) return;
    current+=d; updateDisplay();
  };
  
  const pushOperator=(op)=>{
    if(current.endsWith('.')) current+='0';
    if(justEvaluated) justEvaluated=false;
    if(!expression && current){ expression=current; current='0'; }
    if(/[-+*/]$/.test(expression.trim())) expression=expression.trim().replace(/[-+*/]$/, op);
    else{ expression+=(expression?' ':'')+(current!=='0'?current:'')+' '+op; current='0'; }
    updateDisplay();
  };
  
  const applyPercent=()=>{ const val=Number(current); if(!isNaN(val)){ current=(val/100).toString(); updateDisplay(); } };
  const toggleSign=()=>{ if(current==='0') return; current=current.startsWith('-')? current.slice(1): '-'+current; updateDisplay(); };
  const backspace=()=>{ if(justEvaluated){ clearAll(); return; } current=current.length<=1 || (current.length===2 && current.startsWith('-'))? '0': current.slice(0,-1); updateDisplay(); };
  const clearAll=()=>{ current='0'; expression=''; justEvaluated=false; updateDisplay(); };
  
  const compute=()=>{
    let exprStr=expression; if(current!=='0' || !expression) exprStr=(expression?expression+' ':'')+current;
    if(!exprStr) return;
    const res=evaluator.evaluate(exprStr);
    if(!isFinite(res) || isNaN(res)){ current='Error'; expression=''; }
    else{ current=numUtil.clampExp(res); expression=exprStr+' ='; }
    justEvaluated=true; updateDisplay();
  };
  
  // ===== Events =====
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.dataset.num) return pushNumber(btn.dataset.num);
      if(btn.dataset.dot) return pushNumber('.');
      if(btn.dataset.op) return pushOperator(btn.dataset.op);
      const action=btn.dataset.action;
      if(action==='equals') return compute();
      if(action==='ac') return clearAll();
      if(action==='back') return backspace();
      if(action==='percent') return applyPercent();
    });
  });
  
  copyBtn.addEventListener('click', async()=>{
    const text=String(resultEl.textContent||'');
    try{ await navigator.clipboard.writeText(text); copyBtn.innerHTML='<span>Copied!</span>'; setTimeout(()=>copyBtn.innerHTML='<span>Copy</span>',1200); }
    catch{ copyBtn.innerHTML='<span>Oops</span>'; setTimeout(()=>copyBtn.innerHTML='<span>Copy</span>',1200); }
  });
  
  sepToggle.addEventListener('change', updateDisplay);
  preciseToggle.addEventListener('change', updateDisplay);
  
  window.addEventListener('keydown',(e)=>{
    const k=e.key;
    if(/^[0-9]$/.test(k)){ pushNumber(k); return; }
    if(k==='.'){ pushNumber('.'); return; }
    if(k==='+'||k==='-'||k==='*'||k==='/'){ pushOperator(k); e.preventDefault(); return; }
    if(k==='Enter'||k==='='){ compute(); e.preventDefault(); return; }
    if(k==='Backspace'){ backspace(); e.preventDefault(); return; }
    if(k==='Escape'){ clearAll(); e.preventDefault(); return; }
    if(k==='%'){ applyPercent(); e.preventDefault(); return; }
    if(k==='p' && (e.ctrlKey||e.metaKey)){ applyPercent(); e.preventDefault(); return; }
    if(k==='_'){ toggleSign(); return; }
    if(k==='('||k===')'){
      if(justEvaluated){ expression=''; justEvaluated=false; }
      if(current!=='0'){ expression+=(expression?' ':'')+current; current='0'; }
      expression+=(expression?' ':'')+k; updateDisplay();
    }
  });
  
  // Initialize
  updateDisplay();
  