/** Connected technology tree. Python supplies availability; buttons submit orders. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const TREE={width:960,height:748,nodeWidth:200,nodeHeight:112};
const labels={complete:'RESEARCHED',active:'RESEARCHING',ready:'READY',locked:'PREREQUISITES',waiting:'PROJECT BUSY',funding:'NEEDS FUNDING'};
export function treeLayout(catalog){
  const branches=Object.keys(catalog.researchBranches);
  return Object.fromEntries(Object.entries(catalog.research).map(([id,t])=>[id,{x:26+236*branches.indexOf(t.branch),y:108+164*t.tier}]));
}
export function ancestry(catalog,id,found=new Set()){
  if(found.has(id)||!catalog.research[id])return found;
  found.add(id);for(const req of catalog.research[id].requires)ancestry(catalog,req,found);
  return found;
}
export function treeEdges(catalog,selected){
  const layout=treeLayout(catalog),path=ancestry(catalog,selected),edges=[];
  for(const [id,t] of Object.entries(catalog.research)){
    const b=layout[id],x2=b.x+TREE.nodeWidth/2,y2=b.y;
    for(const req of t.requires.length?t.requires:[null]){
      const a=req?layout[req]:{x:TREE.width/2-TREE.nodeWidth/2,y:-78};
      const x1=a.x+TREE.nodeWidth/2,y1=req?a.y+TREE.nodeHeight:34;
      // Route long dependencies through column gutters, never through a card.
      const bend=(y1+y2)/2,gutter=a.x+(x2<x1?-18:TREE.nodeWidth+18);
      const d=!req?`M${x1} ${y1} V52 H${x2} V68 M${x2} 94 V${y2}`:
        x1===x2?`M${x1} ${y1} V${y2}`:
        y2-y1<100?`M${x1} ${y1} V${bend} H${x2} V${y2}`:
        `M${x1} ${y1} V${y1+13} H${gutter} V${y2-13} H${x2} V${y2}`;
      edges.push({from:req,to:id,highlight:path.has(id)&&(!req||path.has(req)),color:catalog.researchBranches[t.branch].color,
        d});
    }
  }
  return edges;
}
export function techTreeView({catalog,state,selected='surveying',data=null,zoom=.85,pending=false}){
  const tech=catalog.research,chosen=tech[selected]?selected:Object.keys(tech)[0],item=tech[chosen],branch=catalog.researchBranches[item.branch];
  const layout=treeLayout(catalog),path=ancestry(catalog,chosen),plan=data?.plans?.[chosen];
  const status=id=>data?.plans?.[id]?.status||(state.tech.includes(id)?'complete':state.research?.id===id?'active':'locked');
  const complete=Object.keys(tech).filter(id=>state.tech.includes(id)).length,ready=Object.values(data?.plans||{}).filter(p=>p.ok).length;
  const current=state.research,active=current&&tech[current.id];
  const progress=current?Math.max(0,Math.min(100,(state.turn-(current.started??current.completesAt-active.turns))/active.turns*100)):0;
  const children=Object.entries(tech).filter(([,t])=>t.requires.includes(chosen));
  return `<section class="rd-screen" aria-label="Technology tree">
    <div class="rd-heading"><div><span class="rd-eyebrow">R&amp;D DIRECTORATE / PROGRAMME EVOLUTION</span><h1>Build the next frontier.</h1><p>Follow the branches. Choose what your programme can do next.</p></div><div class="rd-wallet"><b>${state.science.toLocaleString('en-US')} <small>SCIENCE</small></b><b>${state.credits.toLocaleString('en-US')} <small>CREDITS</small></b></div></div>
    <div class="rd-summary"><span><b>${complete} / ${Object.keys(tech).length}</b> researched</span><span><b>${data?.laboratories??'—'}</b> online labs</span><span><b>${data?ready:'—'}</b> ready projects</span><small>Science comes from labs, surveys and missions.</small></div>
    <div class="rd-project ${current?'is-active':''}">${current?`<span class="rd-project-icon">◈</span><div><small>RESEARCH IN PROGRESS · ONE PROJECT AT A TIME</small><b>${esc(active.name)}</b><span>Completes on turn ${current.completesAt} · ${Math.max(0,current.completesAt-state.turn)} turns remaining</span></div><div class="rd-progress" role="progressbar" aria-label="Research progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div><button data-action="advance" class="button secondary" ${pending?'disabled':''}>ADVANCE TURN →</button>`:`<span class="rd-project-icon">✧</span><div><small>RESEARCH CAPACITY AVAILABLE</small><b>Choose your next breakthrough.</b><span>Early projects use your headquarters. Advanced projects need labs and field experience.</span></div>`}</div>
    <div class="rd-layout"><div class="rd-map-panel"><div class="rd-map-toolbar"><span>TECHNOLOGY PATHWAYS <small>Scroll to explore</small></span><div><button data-action="tech-zoom-out" aria-label="Zoom technology tree out">−</button><output>${Math.round(zoom*100)}%</output><button data-action="tech-zoom-in" aria-label="Zoom technology tree in">+</button><button data-action="tech-fit">FIT</button></div></div>
      <div class="tech-viewport" tabindex="0" aria-label="Scrollable technology tree"><div class="rd-tree-space" style="width:${TREE.width*zoom}px;height:${TREE.height*zoom}px"><div class="rd-tree" style="width:${TREE.width}px;height:${TREE.height}px;transform:scale(${zoom})">
        <div class="rd-origin">✧ MISSION SCIENCE</div><svg class="rd-connectors" viewBox="0 0 ${TREE.width} ${TREE.height}" aria-hidden="true">${treeEdges(catalog,chosen).map(e=>`<path data-from="${e.from||'root'}" data-to="${e.to}" class="${e.highlight?'is-path':''} ${state.tech.includes(e.to)?'is-complete':''}" d="${e.d}" style="--edge:${e.color}"/>`).join('')}</svg>
        ${Object.entries(catalog.researchBranches).map(([id,b],i)=>`<div class="rd-branch" style="left:${26+236*i}px;--branch:${b.color}"><span>${b.icon} ${esc(b.name.toUpperCase())}</span></div>`).join('')}
        ${Object.entries(tech).map(([id,t])=>{const p=layout[id],b=catalog.researchBranches[t.branch],s=status(id);return `<button class="rd-node state-${s} ${chosen===id?'is-selected':''} ${path.has(id)?'is-ancestor':''}" style="left:${p.x}px;top:${p.y}px;--branch:${b.color}" data-action="tech-select" data-id="${id}" aria-pressed="${chosen===id}" aria-label="${esc(t.name)}. ${labels[s]}. ${t.science} science, ${t.credits} credits, ${t.turns} turns."><span class="rd-node-status"><span>${b.icon} ${['I','II','III','IV'][t.tier]}</span>${labels[s]}</span><strong>${esc(t.name)}</strong><span class="rd-node-cost">${t.science} SCI <i>·</i> ${t.credits} CR <i>·</i> ${t.turns} TURNS</span>${s==='complete'?'<span class="rd-node-check">✓</span>':''}</button>`;}).join('')}
      </div></div></div><div class="rd-legend"><span>● Ready</span><span>◈ Researching</span><span>✓ Researched</span><span>○ Prerequisites</span><small>Highlighted lines lead to your selection.</small></div></div>
      <aside class="rd-detail" style="--branch:${branch.color}" aria-label="Selected technology"><span class="rd-eyebrow">${esc(branch.name.toUpperCase())} / TIER ${item.tier+1}</span><h2>${esc(item.name)}</h2><span class="rd-detail-status state-${status(chosen)}">${labels[status(chosen)]}</span><p>${esc(item.description)}</p><h3>What changes</h3><ul class="rd-effects">${item.effects.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>
        <h3>Requirements</h3><ul class="rd-requirements">${plan?.requirements?.length?plan.requirements.map(r=>`<li class="${r.met?'met':''}"><span>${r.met?'✓':'○'}</span>${r.tech?`<button data-action="tech-select" data-id="${r.tech}">${esc(r.label)} ↗</button>`:esc(r.label)}</li>`).join(''):plan?'<li>Headquarters foundation project</li>':'<li>Checking requirements…</li>'}</ul>
        ${item.labs?'<button class="rd-link" data-action="tech-labs">BUILD A RESEARCH LAB ↗</button>':''}
        <div class="rd-detail-cost"><span><b>${item.science}</b> science</span><span><b>${item.credits}</b> credits</span><span><b>${item.turns}</b> turns</span></div>
        <button class="button primary rd-start" data-action="research" data-id="${chosen}" ${pending||!plan?.ok?'disabled':''}>${status(chosen)==='complete'?'TECHNOLOGY ACQUIRED':status(chosen)==='active'?'RESEARCH IN PROGRESS':'START RESEARCH →'}</button><p class="rd-reason" role="status">${esc(data?.error||plan?.reason||(!data?'Checking project requirements…':'Costs are paid once. Benefits activate when research completes.'))}</p>${data?.error?'<button data-action="tech-refresh" class="rd-link">RETRY REQUIREMENTS</button>':''}
        ${children.length?`<h3>Leads to</h3><div class="rd-children">${children.map(([id,t])=>`<button data-action="tech-select" data-id="${id}">${esc(t.name)} →</button>`).join('')}</div>`:''}
      </aside></div></section>`;
}
