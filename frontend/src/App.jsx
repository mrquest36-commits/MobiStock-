import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, Bell,
  Boxes, Check, ChevronDown, CircleHelp, Command, Download, LayoutDashboard,
  Menu, MoreHorizontal, Package, Plus, Search, Settings2, ShieldCheck,
  Sparkles, Truck, X, RefreshCw, Clock3, ArrowRight, SlidersHorizontal
} from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const money = n => `GH₵${Number(n || 0).toLocaleString('en-GH', {maximumFractionDigits: 2})}`;
const fmt = n => Number(n || 0).toLocaleString('en-GH');

const initialProducts = [
  {id:1,name:'Royal Aroma Rice 5kg',sku:'GRC-001',category:'Grains',quantity:24,min_stock:8,unit_cost:115,unit_price:145},
  {id:2,name:'Frytol Cooking Oil 1L',sku:'OIL-014',category:'Cooking essentials',quantity:3,min_stock:5,unit_cost:28,unit_price:35},
  {id:3,name:'Peak Milk Powder 400g',sku:'MLK-008',category:'Dairy',quantity:0,min_stock:4,unit_cost:48,unit_price:58},
  {id:4,name:'Gino Tomato Paste 210g',sku:'TMT-022',category:'Canned goods',quantity:18,min_stock:6,unit_cost:8,unit_price:11},
  {id:5,name:'Key Soap 160g',sku:'HYG-006',category:'Household',quantity:26,min_stock:8,unit_cost:7,unit_price:9},
  {id:6,name:'Ideal Evaporated Milk',sku:'MLK-011',category:'Dairy',quantity:7,min_stock:6,unit_cost:13,unit_price:16},
];
const initialMoves = initialProducts.filter(p=>p.quantity>0).map((p,i)=>({
  id:i+1,product_name:p.name,type:'in',quantity:p.quantity,
  created_at:new Date(Date.now()-1000*60*(25+i*37)).toISOString(),
  note:'Illustrative opening balance'
}));

function initials(name='MobiStock Administrator'){return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'M';}

function App(){
  const [page,setPage]=useState('Overview');
  const [products,setProducts]=useState([]);
  const [moves,setMoves]=useState([]);
  const [summary,setSummary]=useState({});
  const [intelligence,setIntelligence]=useState(null);
  const [settings,setSettings]=useState({shop_name:'Accra Mini Mart',shop_location:'Accra, Ghana',currency:'GHS',owner_name:'MobiStock Administrator',owner_email:'',owner_phone:''});
  const [loading,setLoading]=useState(true);
  const [apiError,setApiError]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('All items');
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState('');
  const [mobileNav,setMobileNav]=useState(false);
  const [busy,setBusy]=useState(false);
  const loadInFlight=useRef(null);
  const refreshQueued=useRef(false);
  const syncChannel=useRef(null);

  const demoFallback=()=>{setProducts(initialProducts);setMoves(initialMoves);setSummary(calc(initialProducts));setIntelligence(null);setLoading(false);};
  function calc(list){
    return {product_count:list.length,total_units:list.reduce((a,p)=>a+Number(p.quantity),0),
      low_stock_count:list.filter(p=>p.quantity>0&&p.quantity<=p.min_stock).length,
      out_of_stock_count:list.filter(p=>p.quantity===0).length,
      stock_value:list.reduce((a,p)=>a+Number(p.quantity)*Number(p.unit_cost||0),0)};
  }
  async function request(path,opts={}){
    const res=await fetch(`${API}${path}`,{...opts,cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache',...(opts.headers||{})}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Something went wrong. Please try again.');
    return data;
  }
  async function load({silent=false}={}){
    // Reuse an in-flight request so focus, polling and user actions do not
    // trigger overlapping refreshes or race to update the same state.
    if(loadInFlight.current){
      if(silent)refreshQueued.current=true;
      return loadInFlight.current;
    }
    if(!silent)setLoading(true);
    setApiError('');
    const task=(async()=>{
      try{
        const [p,m,d,st,ix]=await Promise.all([request('/products'),request('/movements?limit=8'),request('/dashboard'),request('/settings'),request('/intelligence')]);
        setProducts(p.products);setMoves(m.movements);setSummary(d);setSettings(st.settings);setIntelligence(ix);
      }catch(e){
        setApiError(e.message);
        // Only use illustrative fallback data during the initial load.
        // A temporary background failure must not overwrite real records.
        if(!silent)demoFallback();
      }finally{
        if(!silent)setLoading(false);
      }
    })();
    loadInFlight.current=task;
    try{return await task;}
    finally{
      loadInFlight.current=null;
      if(refreshQueued.current){
        refreshQueued.current=false;
        queueMicrotask(()=>load({silent:true}));
      }
    }
  }
  function broadcastDataChange(){
    const message={type:'mobistock:data-changed',timestamp:Date.now()};
    if(syncChannel.current){
      syncChannel.current.postMessage(message);
    }else{
      // Storage events provide a fallback in browsers without BroadcastChannel.
      try{localStorage.setItem('mobistock:data-changed',String(message.timestamp));}catch{}
    }
  }
  useEffect(()=>{
    load();
    const refreshIfVisible=()=>{
      if(document.visibilityState==='visible')load({silent:true});
    };
    const onCrossTabChange=(event)=>{
      if(event?.data?.type==='mobistock:data-changed'&&document.visibilityState==='visible')load({silent:true});
    };
    const onStorageChange=(event)=>{
      if(event.key==='mobistock:data-changed'&&document.visibilityState==='visible')load({silent:true});
    };
    if('BroadcastChannel' in window){
      syncChannel.current=new BroadcastChannel('mobistock-sync');
      syncChannel.current.addEventListener('message',onCrossTabChange);
    }
    window.addEventListener('storage',onStorageChange);
    const interval=window.setInterval(refreshIfVisible,10000);
    window.addEventListener('focus',refreshIfVisible);
    window.addEventListener('pageshow',refreshIfVisible);
    window.addEventListener('online',refreshIfVisible);
    document.addEventListener('visibilitychange',refreshIfVisible);
    return()=>{
      window.clearInterval(interval);
      window.removeEventListener('storage',onStorageChange);
      if(syncChannel.current){
        syncChannel.current.removeEventListener('message',onCrossTabChange);
        syncChannel.current.close();
        syncChannel.current=null;
      }
      window.removeEventListener('focus',refreshIfVisible);
      window.removeEventListener('pageshow',refreshIfVisible);
      window.removeEventListener('online',refreshIfVisible);
      document.removeEventListener('visibilitychange',refreshIfVisible);
    };
  },[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);

  const lowItems=products.filter(p=>p.quantity>0&&p.quantity<=p.min_stock);
  const outItems=products.filter(p=>p.quantity===0);
  const visible=useMemo(()=>products.filter(p=>{
    const match=(p.name+' '+p.sku+' '+p.category).toLowerCase().includes(search.toLowerCase());
    const status=filter==='All items'||(filter==='Low stock'&&p.quantity>0&&p.quantity<=p.min_stock)||(filter==='Out of stock'&&p.quantity===0)||(filter==='In stock'&&p.quantity>p.min_stock);
    return match&&status;
  }),[products,search,filter]);

  function notify(t){setToast(t);}
  async function saveProduct(form){
    setBusy(true);
    try{
      if(apiError) throw new Error('The API is not connected yet. Start the backend and configure the database before saving.');
      if(form.id) await request(`/products/${form.id}`,{method:'PUT',body:JSON.stringify(form)});
      else await request('/products',{method:'POST',body:JSON.stringify(form)});
      broadcastDataChange();
      await load();setModal(null);notify(form.id?'Product updated':'Product added successfully');
    }catch(e){notify(e.message);}finally{setBusy(false);}
  }
  async function movement(form){
    setBusy(true);
    try{
      if(apiError) throw new Error('The API is not connected yet. Start the backend and configure the database before recording movements.');
      await request('/movements',{method:'POST',body:JSON.stringify(form)});
      broadcastDataChange();
      await load();setModal(null);notify('Stock movement recorded');
    }catch(e){notify(e.message);}finally{setBusy(false);}
  }
  async function saveSettings(form){
    setBusy(true);
    try{
      const result=await request('/settings',{method:'PUT',body:JSON.stringify(form)});
      setSettings(result.settings);
      broadcastDataChange();
      notify('Workspace settings updated');
    }catch(e){notify(e.message);}
    finally{setBusy(false);}
  }
  async function resetDemo(){
    if(!confirm('Restore the starter product catalogue and movement history? Current records will be replaced.'))return;
    try{await request('/demo/reset',{method:'POST'});broadcastDataChange();await load();notify('Starter records restored');}
    catch(e){notify(e.message);}
  }
  const nav=[
    {label:'WORKSPACE',items:[['Overview',LayoutDashboard],['Products',Package],['Stock movements',Activity],['Low-stock alerts',Bell]]},
    {label:'INSIGHTS',items:[['Reports',BarChart3]]},
    {label:'PREFERENCES',items:[['Shop settings',Settings2]]}
  ];
  const activePage=page==='Low-stock alerts'?'Low-stock alerts':page;
  const title=page==='Overview'?'Inventory, in clear view.':page;
  const subtitle=page==='Overview'?'A precise view of stock levels, movement and replenishment priorities.':
    page==='Products'?'Manage your catalogue and keep product records accurate.':
    page==='Stock movements'?'A traceable record of stock received and stock removed.':
    page==='Low-stock alerts'?'Products at or below their minimum stock threshold.':
    page==='Reports'?'A clear snapshot of your current inventory position.':'Manage your shop profile and inventory preferences.';
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <div className="brand"><div className="brand-mark"><Boxes size={21}/></div><div><b>mobi<span>stock</span></b><small>INVENTORY CONTROL</small></div><button className="close-nav" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="store-avatar">{(settings.shop_name||"M").slice(0,1).toUpperCase()}</div><div className="workspace-text"><b>{settings.shop_name||"My shop"}</b><small>{settings.shop_location||"Shop location not set"}</small></div><ChevronDown size={15}/></div>
      <nav>{nav.map(group=><div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([label,Icon])=><button key={label} className={`nav-item ${page===label?'active':''}`} onClick={()=>{setPage(label);setMobileNav(false)}}><Icon size={17}/><span>{label}</span>{label==='Low-stock alerts'&&lowItems.length+outItems.length>0&&<i>{lowItems.length+outItems.length}</i>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-box"><div className="help-icon"><CircleHelp size={17}/></div><b>Need a hand?</b><p>Keep your stock records accurate with every movement.</p><button onClick={()=>notify('Tip: record stock-in when goods arrive and stock-out when goods leave.')}>Quick guide <ArrowRight size={13}/></button></div><div className="profile"><button className="profile-edit" onClick={()=>setPage("Shop settings")} aria-label="Edit profile"><div className="profile-avatar">{initials(settings.owner_name)}</div><div><b>{settings.owner_name||"Shop owner"}</b><small>{settings.owner_email||"Edit account profile"}</small></div><MoreHorizontal size={18}/></button></div></div>
    </aside>
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="crumb"><button className="mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={19}/></button><span>Workspace</span><span className="slash">/</span><b>{page}</b></div><div className="top-actions"><div className={`live-status ${apiError?'offline':''}`}><span/>{apiError?'Connection issue':'System online'}</div><button className="icon-btn" title="Refresh data" onClick={load}><RefreshCw size={17}/></button><button className="icon-btn notification" onClick={()=>setPage('Low-stock alerts')}><Bell size={18}/>{lowItems.length+outItems.length>0&&<i/>}</button><button className="top-avatar" title="Edit profile" onClick={()=>setPage("Shop settings")}>{initials(settings.owner_name)}</button></div></header>
      <div className="content">
        {apiError&&<div className="connection-banner"><AlertTriangle size={17}/><span><b>Connection interrupted:</b> Showing temporary sample records. Reconnect to resume saving inventory changes.</span></div>}
        <div className="page-heading"><div><div className={`eyebrow ${page==='Overview'?'intelligence-eyebrow':''}`}><Sparkles size={13}/> {page==='Overview'?'THE MOBISTOCK CONTROL ROOM':page.toUpperCase()}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{page==='Products'&&<button className="btn-primary" onClick={()=>setModal({type:'product'})}><Plus size={16}/> Add product</button>}{page==='Overview'&&<><button className="btn-secondary" onClick={()=>setModal({type:'movement',kind:'out'})}><ArrowUpRight size={16}/> Stock out</button><button className="btn-primary" onClick={()=>setModal({type:'movement',kind:'in'})}><Plus size={16}/> Stock in</button></>}</div></div>

        {page==='Overview'&&<Overview summary={summary} intelligence={intelligence} products={products} moves={moves} lowItems={lowItems} outItems={outItems} setPage={setPage} setModal={setModal} shopName={settings.shop_name} />}
        {page==='Products'&&<Products products={visible} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} setModal={setModal} />}
        {page==='Stock movements'&&<Movements moves={moves} setModal={setModal}/>}
        {page==='Low-stock alerts'&&<Alerts lowItems={lowItems} outItems={outItems} setModal={setModal}/>}
        {page==='Reports'&&<Reports products={products} summary={summary} moves={moves}/>}
        {page==='Shop settings'&&<Settings settings={settings} saveSettings={saveSettings} resetDemo={resetDemo} busy={busy}/>}
      </div>
      <footer className="footer">
        <div className="footer-brand"><div className="footer-mark"><Boxes size={16}/></div><div><b>MobiStock</b><small>INVENTORY CONTROL</small></div></div>
        <div className="footer-message"><b>Know what you have. Know what needs attention.</b><span>Inventory visibility built for the pace of independent retail.</span></div>
        <div className="footer-meta"><span>© 2026 MobiStock</span><span>Made for better stock decisions</span></div>
      </footer>
    </main>
    {modal&&<Modal modal={modal} products={products} onClose={()=>setModal(null)} onSaveProduct={saveProduct} onMovement={movement} busy={busy}/>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}
function Metric({label,value,displayValue,detail,icon:Icon,tone='navy',trend}){
  return <div className={`metric-card tone-${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={18}/></span></div><div className="metric-value">{displayValue??fmt(value)}</div><div className="metric-foot"><span>{detail}</span>{trend&&<b>{trend}</b>}</div></div>;
}
function Status({p}){let t=p.quantity===0?'Out of stock':p.quantity<=p.min_stock?'Low stock':'In stock';return <span className={`status ${p.quantity===0?'out':p.quantity<=p.min_stock?'low':'good'}`}><i/>{t}</span>}
function Overview({summary,intelligence,products,moves,lowItems,outItems,setPage,setModal,shopName}){
  const attention=[...outItems,...lowItems].slice(0,4);
  const max=Math.max(1,...products.map(p=>p.quantity));
  const healthy=Math.max(0,products.length-lowItems.length-outItems.length);
  const healthPct=products.length?Math.round(healthy/products.length*100):0;
  return <div className="page-stack">
    <section className="command-hero">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="hero-pulse"/> LIVE INVENTORY PICTURE <i/></div>
        <h2>Good stock.<br/><em>Clear decisions.</em></h2>
        <p>{shopName||'Your shop'} · A live view of what is moving, what is running low, and where attention is needed.</p>
        <div className="hero-actions"><button onClick={()=>setModal({type:'movement',kind:'in'})}> <Plus size={15}/> Record stock received</button><button className="hero-secondary" onClick={()=>setPage('Reports')}>Explore inventory report <ArrowUpRight size={15}/></button></div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
        <div className="hero-ring"><div className="hero-ring-inner"><Boxes size={29}/><b>{fmt(summary.total_units)}</b><small>UNITS ON HAND</small></div></div>
        <div className="hero-float float-a"><span className="float-dot green"/> {healthy} healthy lines</div>
        <div className="hero-float float-b"><span className="float-dot amber"/> {lowItems.length+outItems.length} need attention</div>
      </div>
      <div className="hero-bottom"><span>INVENTORY HEALTH</span><div className="hero-health-track"><i style={{width:`${healthPct}%`}}/></div><b>{healthPct}%</b><small>products above minimum stock</small></div>
    </section>
    <div className="metric-grid overview-metrics">
      <Metric label="Products tracked" value={summary.product_count} detail="Registered product records" icon={Package} tone="navy"/>
      <Metric label="Inventory value" value={summary.stock_value} displayValue={money(summary.stock_value)} detail="Current stock at recorded cost" icon={BarChart3} tone="green"/>
      <Metric label="Low-stock items" value={summary.low_stock_count} detail="At or below minimum" icon={AlertTriangle} tone="amber"/>
      <Metric label="Out of stock" value={summary.out_of_stock_count} detail="No units remaining" icon={Bell} tone="red"/>
      <Metric label="Units on hand" value={summary.total_units} detail="Current recorded stock quantity" icon={Boxes} tone="blue"/>
    </div>
    <section className="intelligence-stage">
      <div className="intelligence-stage-head">
        <div><div className="stage-kicker"><span/> SIGNALS &amp; STOCK MOVEMENT <i/></div><h2>See the story <em>behind your stock.</em></h2><p>Operational signals calculated from your current balances and recorded stock movements.</p></div>
        <div className="period-stamp"><Clock3 size={13}/> LAST 30 DAYS <span>·</span> LIVE LEDGER</div>
      </div>
      <div className="signal-grid">
        <div className="signal-card signal-flow">
          <div className="signal-card-top"><span className="signal-icon"><ArrowDownLeft size={17}/></span><span className="signal-label">STOCK RECEIVED</span><span className="signal-period">30D</span></div>
          <div className="signal-value">{fmt(intelligence?.inbound_units??0)} <small>units</small></div>
          <div className="signal-track"><i style={{width:`${Math.min(100,((intelligence?.inbound_units||0)/Math.max(1,(intelligence?.inbound_units||0)+(intelligence?.outbound_units||0)))*100)}%`}}/></div>
          <div className="signal-foot"><span>Recorded stock-in activity</span><b className="signal-positive">IN</b></div>
        </div>
        <div className="signal-card signal-outflow">
          <div className="signal-card-top"><span className="signal-icon"><ArrowUpRight size={17}/></span><span className="signal-label">STOCK ISSUED</span><span className="signal-period">30D</span></div>
          <div className="signal-value">{fmt(intelligence?.outbound_units??0)} <small>units</small></div>
          <div className="signal-track"><i style={{width:`${Math.min(100,((intelligence?.outbound_units||0)/Math.max(1,(intelligence?.inbound_units||0)+(intelligence?.outbound_units||0)))*100)}%`}}/></div>
          <div className="signal-foot"><span>Recorded stock-out activity</span><b className="signal-out-label">OUT</b></div>
        </div>
        <div className="signal-card signal-risk">
          <div className="signal-card-top"><span className="signal-icon"><AlertTriangle size={17}/></span><span className="signal-label">REPLENISHMENT GAP</span><span className="signal-period">NOW</span></div>
          <div className="signal-value">{fmt(intelligence?.restock_gap_units??0)} <small>units</small></div>
          <div className="signal-foot"><span>Units needed to reach minimum levels</span><b>{intelligence?.attention_products??(lowItems.length+outItems.length)} SKUs</b></div>
        </div>
        <div className="signal-card signal-health">
          <div className="signal-card-top"><span className="signal-icon"><Activity size={17}/></span><span className="signal-label">STOCK HEALTH</span><span className="signal-period">LIVE</span></div>
          <div className="signal-health-line"><div><b>{intelligence?.health_score??(products.length?Math.round((products.length-lowItems.length-outItems.length)/products.length*100):100)}<small>%</small></b><span>above minimum</span></div><div className="health-orbit"><i/></div></div>
          <div className="signal-foot"><span>{intelligence?.healthy_products??Math.max(0,products.length-lowItems.length-outItems.length)} of {products.length} products in range</span><b>HEALTH</b></div>
        </div>
      </div>
      <div className="intelligence-lower">
        <section className="signal-feature">
          <div className="feature-head"><div><span className="feature-kicker">MOVEMENT LEADERS</span><h3>What is moving?</h3><p>Products with the highest recorded stock-out volume in the last 30 days.</p></div><div className="feature-glyph"><Activity size={22}/></div></div>
          {intelligence?.top_movers?.length? <div className="leader-list">{intelligence.top_movers.slice(0,4).map((p,i)=><div className="leader-row" key={p.product_id}><span className="leader-rank">0{i+1}</span><div className="leader-info"><b>{p.name}</b><small>{p.sku} · {p.cover_days===null?'No stock-out rate':`${p.cover_days} days of current stock at recorded rate`}</small><div className="leader-meter"><i style={{width:`${Math.max(5,p.units_out/Math.max(1,intelligence.top_movers[0].units_out)*100)}%`}}/></div></div><div className="leader-qty"><b>{fmt(p.units_out)}</b><small>units out</small></div></div>)}</div>:<div className="signal-empty"><Activity size={21}/><b>Movement patterns will appear here</b><span>Record stock-out transactions to identify products moving through your shop.</span></div>}
        </section>
        <section className="signal-feature signal-replenishment">
          <div className="feature-head"><div><span className="feature-kicker">ACTION QUEUE</span><h3>Restock radar</h3><p>Priority products at or below their minimum stock level.</p></div><div className="feature-glyph radar-glyph"><Bell size={21}/></div></div>
          {intelligence?.restock_queue?.length? <div className="radar-list">{intelligence.restock_queue.slice(0,4).map(p=><div className="radar-row" key={p.product_id}><span className={`radar-status ${p.status}`}/><div><b>{p.name}</b><small>{p.sku} · {p.quantity} on hand / {p.min_stock} minimum</small></div><strong>{p.gap>0?`+${p.gap}`:'Review'}<small>{p.gap>0?'to minimum':'units'}</small></strong></div>)}</div>:<div className="signal-empty"><Check size={21}/><b>All clear on minimum levels</b><span>No products currently require replenishment against their configured thresholds.</span></div>}
          <button className="feature-link" onClick={()=>setPage('Low-stock alerts')}>Open replenishment watchlist <ArrowRight size={14}/></button>
        </section>
      </div>
      <div className="intelligence-footnote"><ShieldCheck size={14}/><span>Signals are derived from recorded inventory transactions. Stock movement is not necessarily equivalent to verified sales or customer demand.</span></div>
    </section>
    <div className="overview-grid">
      <section className="panel inventory-panel"><div className="panel-head"><div><h2>Stock position</h2><p>Current quantities across your product catalogue</p></div><button className="text-btn" onClick={()=>setPage('Products')}>View catalogue <ArrowRight size={14}/></button></div>
        <div className="stock-list">{products.slice(0,5).map(p=><div className="stock-row" key={p.id}><div className="product-symbol">{p.name.slice(0,1)}</div><div className="stock-product"><b>{p.name}</b><small>{p.category} · {p.sku}</small></div><div className="stock-bar-wrap"><div className="stock-bar"><span style={{width:`${Math.max(2,p.quantity/max*100)}%`,background:p.quantity===0?'#dc6b64':p.quantity<=p.min_stock?'#dba94a':'#1b9a78'}}/></div><small>{p.quantity} units</small></div><Status p={p}/></div>)}</div>
      </section>
      <section className="panel attention-panel"><div className="panel-head"><div><h2>Needs attention</h2><p>Review these items before they run out</p></div><span className="count-pill">{attention.length}</span></div>
        {attention.length? <div className="attention-list">{attention.map(p=><div className="attention-row" key={p.id}><div className={`alert-symbol ${p.quantity===0?'danger':''}`}><AlertTriangle size={16}/></div><div className="attention-name"><b>{p.name}</b><small>{p.quantity===0?'No units remaining':`${p.quantity} left · minimum ${p.min_stock}`}</small></div><button className="mini-action" onClick={()=>setModal({type:'movement',kind:'in',product:p})}>Restock</button></div>)}</div>:<div className="empty-state"><Check size={22}/><b>All clear</b><span>No products need attention.</span></div>}
        <button className="panel-link" onClick={()=>setPage('Low-stock alerts')}>View all alerts <ArrowRight size={14}/></button>
      </section>
    </div>
    <section className="panel movements-panel"><div className="panel-head"><div><h2>Recent stock movements</h2><p>Latest recorded inventory activity</p></div><button className="text-btn" onClick={()=>setPage('Stock movements')}>Full history <ArrowRight size={14}/></button></div><MovementTable moves={moves.slice(0,5)}/></section>
    <div className="insight-strip"><div className="insight-icon"><Sparkles size={18}/></div><div><b>A useful stock habit</b><p>Record every delivery and every stock reduction. Your balances are only as reliable as the movements entered.</p></div><span>OPERATING TIP</span></div>
  </div>;
}
function Products({products,search,setSearch,filter,setFilter,setModal}){
  return <section className="panel table-panel"><div className="toolbar"><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products, SKU or category..."/></div><div className="toolbar-right"><div className="select-wrap"><SlidersHorizontal size={15}/><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All items','In stock','Low stock','Out of stock'].map(x=><option>{x}</option>)}</select></div><button className="btn-primary small" onClick={()=>setModal({type:'product'})}><Plus size={15}/> Add product</button></div></div>
    <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>QUANTITY</th><th>MIN. LEVEL</th><th>STATUS</th><th></th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><div className="table-product"><div className="product-symbol">{p.name.slice(0,1)}</div><b>{p.name}</b></div></td><td className="mono">{p.sku}</td><td>{p.category}</td><td><b>{fmt(p.quantity)}</b></td><td>{p.min_stock}</td><td><Status p={p}/></td><td><button className="row-more" onClick={()=>setModal({type:'product',product:p})}><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table>{!products.length&&<div className="empty-state"><Package size={24}/><b>No products found</b><span>Try another search or change the filter.</span></div>}</div>
    <div className="table-foot">Showing {products.length} product records <span>Quantities reflect the latest recorded movements.</span></div>
  </section>;
}
function MovementTable({moves}){return <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>MOVEMENT</th><th>QUANTITY</th><th>NOTE</th><th>DATE & TIME</th></tr></thead><tbody>{moves.map(m=><tr key={m.id}><td><b>{m.product_name}</b></td><td><span className={`movement-tag ${m.type}`}><i/>{m.type==='in'?'Stock received':'Stock removed'}</span></td><td><b className={m.type==='in'?'positive':'negative'}>{m.type==='in'?'+':'−'}{m.quantity}</b></td><td>{m.note||'—'}</td><td className="date-cell">{new Date(m.created_at).toLocaleString('en-GH',{dateStyle:'medium',timeStyle:'short'})}</td></tr>)}</tbody></table>{!moves.length&&<div className="empty-state">No stock movements have been recorded.</div>}</div>}
function Movements({moves,setModal}){return <section className="panel table-panel"><div className="panel-head pad"><div><h2>Movement history</h2><p>Every stock change is recorded as a separate transaction.</p></div><div className="inline-actions"><button className="btn-secondary small" onClick={()=>setModal({type:'movement',kind:'out'})}><ArrowUpRight size={15}/> Stock out</button><button className="btn-primary small" onClick={()=>setModal({type:'movement',kind:'in'})}><Plus size={15}/> Stock in</button></div></div><MovementTable moves={moves}/></section>}
function Alerts({lowItems,outItems,setModal}){return <div className="page-stack"><div className="alert-summary"><div><AlertTriangle size={20}/><div><b>{lowItems.length+outItems.length} products need attention</b><span>Replenishment should be reviewed against actual shop demand.</span></div></div></div><section className="panel table-panel"><div className="panel-head pad"><div><h2>Replenishment watchlist</h2><p>Items at or below their configured minimum level.</p></div></div><div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>AVAILABLE</th><th>MINIMUM LEVEL</th><th>GAP TO MINIMUM</th><th>STATUS</th><th></th></tr></thead><tbody>{[...outItems,...lowItems].map(p=><tr key={p.id}><td><b>{p.name}</b><div className="subtext">{p.sku}</div></td><td><b>{p.quantity}</b></td><td>{p.min_stock}</td><td className="negative">{Math.max(0,p.min_stock-p.quantity)} units</td><td><Status p={p}/></td><td><button className="btn-secondary tiny" onClick={()=>setModal({type:'movement',kind:'in',product:p})}>Restock</button></td></tr>)}</tbody></table>{!lowItems.length&&!outItems.length&&<div className="empty-state"><Check size={24}/><b>No replenishment alerts</b></div>}</div></section></div>}
function Reports({products,summary,moves}){const cats=Object.entries(products.reduce((a,p)=>(a[p.category]=(a[p.category]||0)+p.quantity,a),{}));return <div className="page-stack"><div className="metric-grid"><Metric label="Stock value at cost" value={money(summary.stock_value)} detail="Estimated from unit cost" icon={BarChart3}/><Metric label="Product categories" value={cats.length} detail="Categories represented" icon={Boxes}/><Metric label="Recorded movements" value={moves.length} detail="Loaded recent activity" icon={Activity}/><Metric label="Units in stock" value={summary.total_units} detail="Current recorded balance" icon={Package}/></div><div className="report-grid"><section className="panel"><div className="panel-head"><div><h2>Quantity by category</h2><p>Current unit distribution</p></div></div><div className="category-bars">{cats.map(([name,val])=><div className="category-row"><div><b>{name}</b><span>{val} units</span></div><div className="stock-bar"><span style={{width:`${Math.max(2,val/Math.max(1,summary.total_units)*100)}%`}}/></div></div>)}</div></section><section className="panel report-note"><div className="report-note-icon"><BarChart3 size={20}/></div><h2>Reading this report</h2><p>Stock value is an estimate based on the unit-cost figures entered for each product. It is not a valuation audit or a profit report.</p><p>For reliable reporting, update product costs and record every stock movement as it occurs.</p></section></div></div>}
function Settings({settings,saveSettings,resetDemo,busy}){
  const [form,setForm]=useState(settings);
  useEffect(()=>setForm(settings),[settings]);
  const change=(key,value)=>setForm(s=>({...s,[key]:value}));
  function submit(e){e.preventDefault();saveSettings(form);}
  return <div className="settings-page">
    <div className="settings-intro"><div className="settings-intro-icon"><Settings2 size={22}/></div><div><span className="eyebrow">WORKSPACE CONFIGURATION</span><h2>Make MobiStock yours.</h2><p>Keep your shop identity and account details accurate. These details personalise your workspace.</p></div></div>
    <form onSubmit={submit} className="settings-form-grid">
      <section className="panel settings-card editable-card">
        <div className="settings-card-head"><div className="settings-icon"><StoreIcon/></div><div><h2>Shop profile</h2><p>Business details displayed across your inventory workspace.</p></div><span className="editable-tag">EDITABLE</span></div>
        <div className="settings-fields">
          <label className="full">Shop / business name<input required maxLength="120" value={form.shop_name||''} onChange={e=>change('shop_name',e.target.value)} placeholder="e.g. Accra Mini Mart"/></label>
          <label className="full">Shop location<input maxLength="160" value={form.shop_location||''} onChange={e=>change('shop_location',e.target.value)} placeholder="Neighbourhood, town or city"/></label>
          <label>Operating currency<select value="GHS" disabled><option value="GHS">Ghana cedi (GH₵)</option></select></label>
        </div>
      </section>
      <section className="panel settings-card editable-card">
        <div className="settings-card-head"><div className="settings-icon"><UserRoundIcon/></div><div><h2>Owner profile</h2><p>Contact and identity details for the person managing this shop.</p></div><span className="editable-tag">EDITABLE</span></div>
        <div className="settings-fields">
          <label className="full">Full name<input required maxLength="120" value={form.owner_name||''} onChange={e=>change('owner_name',e.target.value)} placeholder="Shop owner or manager"/></label>
          <label className="full">Email address<input type="email" maxLength="160" value={form.owner_email||''} onChange={e=>change('owner_email',e.target.value)} placeholder="name@example.com"/></label>
          <label className="full">Phone number<input type="tel" maxLength="40" value={form.owner_phone||''} onChange={e=>change('owner_phone',e.target.value)} placeholder="+233 ..."/></label>
        </div>
      </section>
      <div className="settings-savebar"><span><ShieldCheck size={16}/> Changes are saved to your workspace database.</span><button className="btn-primary" disabled={busy}>{busy?'Saving changes…':<><Check size={15}/> Save profile & shop details</>}</button></div>
    </form>
    <section className="panel settings-card maintenance-card"><div className="settings-icon warning"><RefreshCw size={20}/></div><div className="maintenance-copy"><h2>Data maintenance</h2><p>Restore the starter product catalogue and movement history. This action replaces current inventory records.</p></div><button className="btn-secondary" onClick={resetDemo}><RefreshCw size={15}/> Restore starter records</button></section>
  </div>;
}
function StoreIcon(){return <Boxes size={20}/>}
function UserRoundIcon(){return <CircleHelp size={20}/>}

function Modal({modal,products,onClose,onSaveProduct,onMovement,busy}){
  const isProduct=modal.type==='product';const [form,setForm]=useState(isProduct?(modal.product||{name:'',sku:'',category:'General',quantity:0,min_stock:5,unit_cost:0,unit_price:0}):{product_id:modal.product?.id||'',type:modal.kind||'in',quantity:1,note:''});
  const change=(k,v)=>setForm(f=>({...f,[k]:v}));
  function submit(e){e.preventDefault();if(isProduct)onSaveProduct({...form,quantity:Number(form.quantity),min_stock:Number(form.min_stock),unit_cost:Number(form.unit_cost||0),unit_price:Number(form.unit_price||0)});else onMovement({...form,product_id:Number(form.product_id),quantity:Number(form.quantity)});}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">{isProduct?'PRODUCT CATALOGUE':'INVENTORY TRANSACTION'}</span><h2>{isProduct?(form.id?'Edit product':'Add a product'):(form.type==='in'?'Record stock received':'Record stock removed')}</h2><p>{isProduct?'Keep product details and stock thresholds up to date.':'The transaction will update the recorded stock balance.'}</p></div><button type="button" className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    {isProduct?<div className="form-grid"><label className="full">Product name<input required value={form.name} onChange={e=>change('name',e.target.value)} placeholder="e.g. Royal Aroma Rice 5kg"/></label><label>SKU / code<input required value={form.sku} onChange={e=>change('sku',e.target.value)} placeholder="e.g. GRC-001"/></label><label>Category<input required value={form.category} onChange={e=>change('category',e.target.value)} placeholder="e.g. Grains"/></label><label>Opening quantity<input type="number" min="0" step="1" required value={form.quantity} onChange={e=>change('quantity',e.target.value)} disabled={!!form.id}/></label><label>Minimum stock level<input type="number" min="0" step="1" required value={form.min_stock} onChange={e=>change('min_stock',e.target.value)}/></label><label>Unit cost (GH₵)<input type="number" min="0" step=".01" value={form.unit_cost} onChange={e=>change('unit_cost',e.target.value)}/></label><label>Selling price (GH₵)<input type="number" min="0" step=".01" value={form.unit_price} onChange={e=>change('unit_price',e.target.value)}/></label></div>:<div className="form-grid"><label className="full">Select product<select required value={form.product_id} onChange={e=>change('product_id',e.target.value)}><option value="">Choose a product</option>{products.map(p=><option value={p.id}>{p.name} · {p.quantity} available</option>)}</select></label><label>Movement type<select value={form.type} onChange={e=>change('type',e.target.value)}><option value="in">Stock received (in)</option><option value="out">Stock removed (out)</option></select></label><label>Quantity<input type="number" min="1" step="1" required value={form.quantity} onChange={e=>change('quantity',e.target.value)}/></label><label className="full">Note (optional)<input value={form.note} onChange={e=>change('note',e.target.value)} placeholder="e.g. Supplier delivery or sales"/></label><div className="form-hint full"><AlertTriangle size={15}/> Stock-out quantities cannot exceed the current available balance.</div></div>}
    <div className="modal-actions"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy?'Saving…':isProduct?(form.id?'Save changes':'Add product'):'Record movement'} <ArrowRight size={15}/></button></div>
  </form></div>;
}
export default App;
