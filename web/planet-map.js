/** Canvas strategy map. Geography comes from Python; atmospheric motion is cosmetic. */

const W = 60, H = 30;
const surfaces = {
  mars: {sky:'#130c14', land:'#795044', light:'#c18b68', dark:'#392a32', accent:'#ffb47b', ridge:'#aa7365', ice:'#86bdcb'},
  venus: {sky:'#241710', land:'#8b6348', light:'#e7b876', dark:'#4c342e', accent:'#ffe19c', ridge:'#c78c55', ice:'#c8bb92'},
  mercury: {sky:'#0f1119', land:'#71717c', light:'#b3b4b8', dark:'#303541', accent:'#f4ca87', ridge:'#94919b', ice:'#bfc9cc'},
  europa: {sky:'#101923', land:'#6e919d', light:'#c9e4e2', dark:'#294d62', accent:'#bcf5ff', ridge:'#8cabb3', ice:'#c2e5e9'},
  earth: {sky:'#071b26', land:'#81925a', light:'#9ec1bb', dark:'#253c52', accent:'#c1fff3', ridge:'#6f9392', ice:'#d6efed'},
};

const cameras = new Map();
let activeMap = null;

function hash(x,y,k=1) {
  let z = Math.imul(x + 113, 374761393) + Math.imul(y + 79, 668265263) + Math.imul(k, 1442695041);
  z = Math.imul(z ^ z >>> 13, 1274126177);
  return ((z ^ z >>> 16) >>> 0) / 4294967296;
}
function rgba(hex, alpha=1) {
  let raw=hex.replace('#','');
  return `rgba(${parseInt(raw.slice(0,2),16)},${parseInt(raw.slice(2,4),16)},${parseInt(raw.slice(4,6),16)},${alpha})`;
}
function mixed(hex, other, t) {
  const a=hex.replace('#',''), b=other.replace('#','');
  const v=[0,2,4].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t));
  return '#'+v.map(n=>Math.max(0,Math.min(255,n)).toString(16).padStart(2,'0')).join('');
}
function polygon(ctx, pts, fill, stroke=null, lineWidth=1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath(); ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
}
function box(ctx,x,y,w,h,depth,top,side) {
  polygon(ctx,[[x-w/2,y],[x,y-h/2],[x+w/2,y],[x,y+h/2]],top,'#19303b70',.6);
  polygon(ctx,[[x-w/2,y],[x,y+h/2],[x,y+h/2+depth],[x-w/2,y+depth]],side);
  polygon(ctx,[[x,y+h/2],[x+w/2,y],[x+w/2,y+depth],[x,y+h/2+depth]],mixed(side,'#05080e',.22));
}

class PlanetMap {
  constructor(canvas, minimap, props) {
    this.canvas=canvas;this.minimap=minimap;this.props=props;this.ctx=canvas.getContext('2d');
    this.size=props.size||32;this.palette=surfaces[props.world]||surfaces.mars;
    this.key=`${props.world}:${props.hubId||'unmapped'}`;
    this.cam=cameras.get(this.key)||{x:0,y:90,scale:1.25};cameras.set(this.key,this.cam);
    this.pointer=null;this.dead=false;this.lastFrame=0;this.hover=null;this.events=new AbortController();this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:this.events.signal});
    this.resize=()=>{if(this.dead)return;const r=canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(this.width*dpr);canvas.height=Math.round(this.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.draw();this.drawMini();};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);
    on(canvas,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY<0?1.15:1/1.15,e.offsetX,e.offsetY);},{passive:false});
    on(canvas,'pointerdown',e=>{if(e.button!==0)return;this.pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragged:false};canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);});
    on(canvas,'pointermove',e=>{if(!this.pointer){const next=this.pick(e.offsetX,e.offsetY);if(next!==this.hover){this.hover=next;this.draw(this.lastFrame);}canvas.style.cursor=next!==null?'pointer':'grab';return;}const p=this.pointer;const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY;p.lastX=e.clientX;p.lastY=e.clientY;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>5)p.dragged=true;if(p.dragged){this.cam.x+=dx;this.cam.y+=dy;this.draw();this.drawMini();}});
    on(canvas,'pointerup',e=>{const p=this.pointer;this.pointer=null;canvas.style.cursor='grab';if(p&&!p.dragged){const rect=canvas.getBoundingClientRect();const index=this.pick(e.clientX-rect.left,e.clientY-rect.top);if(index!==null)this.props.onSelect(index);} });
    on(canvas,'pointercancel',()=>{this.pointer=null;canvas.style.cursor='grab';});
    if(minimap)on(minimap,'click',e=>{const r=minimap.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*this.size;const y=(e.clientY-r.top)/r.height*this.size;this.centerOn(x,y);});
    on(canvas,'pointerleave',()=>{this.hover=null;this.draw(this.lastFrame);});
    on(canvas,'keydown',e=>{const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-this.size,ArrowDown:this.size};if(e.key in steps){e.preventDefault();const current=this.props.selection??Math.floor(this.size*this.size/2),next=current+steps[e.key];if(next>=0&&next<this.size*this.size&&!(e.key==='ArrowLeft'&&current%this.size===0)&&!(e.key==='ArrowRight'&&current%this.size===this.size-1)){this.props.onSelect(next);}}});
    this.resize();this.animate=timestamp=>{if(this.dead)return;if(!document.hidden&&timestamp-this.lastFrame>140){this.lastFrame=timestamp;this.draw(timestamp);}this.animation=requestAnimationFrame(this.animate);};this.animation=requestAnimationFrame(this.animate);
  }
  destroy(){this.dead=true;this.events.abort();this.observer.disconnect();cancelAnimationFrame(this.animation);}
  coord(x,y){const shift=this.size/2-.5;return {x:this.width/2+this.cam.x+(x-y)*W/2*this.cam.scale,y:this.height/2+this.cam.y+((x+y)-shift*2)*H/2*this.cam.scale};}
  controlAt(sx,sy){
    if(!this.props.controlHub)return false;
    const mid=Math.floor(this.size/2),pt=this.coord(mid,mid),s=this.cam.scale;
    return Math.abs(sx-pt.x)<=24*s&&sy>=pt.y-57*s&&sy<=pt.y+15*s;
  }
  centerOn(x=this.size/2-.5,y=this.size/2-.5){this.cam.x=-(x-y)*W/2*this.cam.scale;this.cam.y=-((x+y)-(this.size-1))*H/2*this.cam.scale+85;this.draw();this.drawMini();}
  overview(){this.cam.scale=Math.max(.25,Math.min(.7,(this.width-80)/(this.size*W),(this.height-170)/(this.size*H)));this.centerOn();}
  zoom(factor,sx=this.width/2,sy=this.height/2){const prior=this.cam.scale;this.cam.scale=Math.max(.25,Math.min(3.2,prior*factor));const z=this.cam.scale/prior;this.cam.x=sx-this.width/2+(this.cam.x-(sx-this.width/2))*z;this.cam.y=sy-this.height/2+(this.cam.y-(sy-this.height/2))*z;this.draw();this.drawMini();}
  // Shared corner heights keep adjacent diamonds joined into a continuous surface.
  cornerHeight(x,y){
    let sum=0,count=0;
    for(const [dx,dy] of [[0,0],[-1,0],[0,-1],[-1,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx>=0&&ny>=0&&nx<this.size&&ny<this.size){sum+=(this.props.tiles[ny*this.size+nx]?.elevation??1)*9;count++;}
    }
    return sum/Math.max(1,count);
  }
  geometry(x,y){
    const q=this.coord(x,y),s=this.cam.scale,a=W/2*s,b=H/2*s;
    const heights=[this.cornerHeight(x,y),this.cornerHeight(x+1,y),this.cornerHeight(x+1,y+1),this.cornerHeight(x,y+1)];
    return {x:q.x,y:q.y-heights.reduce((a,b)=>a+b,0)/4*s,points:[[q.x,q.y-b-heights[0]*s],[q.x+a,q.y-heights[1]*s],[q.x,q.y+b-heights[2]*s],[q.x-a,q.y-heights[3]*s]],shade:(heights[0]-heights[2]+heights[3]-heights[1])/80};
  }
  pick(sx,sy){
    for(let i=(this.hits?.length||0)-1;i>=0;i--){
      const hit=this.hits[i],t=this.props.tiles[hit.index];
      if(t?.building&&Math.abs(sx-hit.x)<20*this.cam.scale&&sy<hit.y&&sy>hit.y-53*this.cam.scale)return hit.index;
      let inside=false;
      for(let a=0,b=3;a<4;b=a++){
        const [ax,ay]=hit.points[a],[bx,by]=hit.points[b];
        if((ay>sy)!==(by>sy)&&sx<(bx-ax)*(sy-ay)/(by-ay)+ax)inside=!inside;
      }
      if(inside)return hit.index;
    }
    return null;
  }
  features(x,y){return hash(x,y,11);}
  biomeColor(tile){
    if(tile?.biome==='settlement')return this.palette.land;
    return this.props.biomes?.[tile?.biome]?.color||this.palette.land;
  }
  draw(now=0){
    if(!this.width||!this.height)return;
    const c=this.ctx,p=this.palette,w=this.width,h=this.height,s=this.cam.scale;
    const motion=this.props.motion!==false&&!this.reduced.matches&&!document.hidden;
    const time=motion?now/1000:0;
    this.hits=[];
    c.clearRect(0,0,w,h);
    const sky=c.createRadialGradient(w*.5,h*.4,30,w*.5,h*.5,Math.max(w,h));
    sky.addColorStop(0,mixed(p.sky,p.land,.32));sky.addColorStop(1,'#050d18');c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(let sum=0;sum<=2*(this.size-1);sum++){
      for(let x=Math.max(0,sum-this.size+1);x<=Math.min(this.size-1,sum);x++){
        const y=sum-x,index=y*this.size+x,t=this.props.tiles?.[index]||{},pt=this.geometry(x,y);
        if(pt.x<-W*s||pt.x>w+W*s||pt.y<-W*s||pt.y>h+W*s)continue;
        this.hits.push({...pt,index});
        const known=Boolean(t.revealed),biome=t.biome,water=['ocean','water'].includes(biome);
        let base=this.biomeColor(t);
        base=mixed(base,pt.shade>0?'#f2dfb8':'#142331',Math.min(.25,Math.abs(pt.shade)));
        base=mixed(base,'#263747',known?.03:.18);
        if(x===this.size-1||y===this.size-1){
          const side=pt.points.slice(1);polygon(c,[...side,[side[2][0],side[2][1]+20*s],[side[1][0],side[1][1]+20*s],[side[0][0],side[0][1]+20*s]],mixed(base,'#06121d',.55));
        }
        if(water)base=mixed(base,biome==='ocean'?'#164059':'#71c0bd',Math.min(.35,(this.size-x)/this.size*.4));
        polygon(c,pt.points,base,base,.65);
        // Slight tonal grain, no permanent grid over the natural landscape.
        c.save();c.beginPath();pt.points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip();
        for(let n=0;n<6;n++){
          const dx=(hash(x+n,y,3)-.5)*52*s,dy=(hash(x,y+n,7)-.5)*26*s;
          c.fillStyle=rgba('#fff0cc',.035+hash(x+n,y,13)*.05);c.fillRect(pt.x+dx,pt.y+dy,3*s,s*.6);
        }
        if(water){
          const glint=.13+.08*Math.sin(time*1.2+x*.4+y*.3);
          c.strokeStyle=rgba('#c3f5ec',glint);c.lineWidth=.8*s;
          for(let n=0;n<(hash(x,y,41)>.65?2:0);n++){
            const offset=Math.sin(time*.75+x*.8+n)*3*s;
            c.beginPath();c.moveTo(pt.x-18*s+offset,pt.y+(n-1)*7*s);c.quadraticCurveTo(pt.x-3*s+offset,pt.y+(n-1)*7*s-3*s,pt.x+12*s+offset,pt.y+(n-1)*7*s);c.stroke();
          }
          // Foam only on edges shared with dry land.
          for(const [n,dx,dy] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]]){
            const nx=x+dx,ny=y+dy,neighbor=nx>=0&&ny>=0&&nx<this.size&&ny<this.size?this.props.tiles[ny*this.size+nx]:null;
            if(neighbor&&!['ocean','water'].includes(neighbor.biome)){
              const a=pt.points[n],b=pt.points[(n+1)%4];c.strokeStyle=rgba('#def7dc',.45+.15*Math.sin(time+x+y));c.lineWidth=2*s;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
            }
          }
        }
        if(biome==='dunes'||biome==='beach'||biome==='basin'){
          c.strokeStyle=rgba('#f7d5a0',.23);c.lineWidth=.8*s;
          for(let n=-2;n<3;n++){c.beginPath();c.moveTo(pt.x-25*s,pt.y+n*6*s);c.bezierCurveTo(pt.x-4*s,pt.y+(n*6-8)*s,pt.x+5*s,pt.y+(n*6+8)*s,pt.x+25*s,pt.y+n*6*s);c.stroke();}
        }
        if(['icefield','chaos','fissure','lava','frost'].includes(biome)&&hash(x,y,37)>.57){
          c.strokeStyle=biome==='lava'?rgba('#ff9e4c',.7+.2*Math.sin(time+x)):biome==='fissure'?'#203d56':rgba('#edf9fa',.35);c.lineWidth=(biome==='lava'||biome==='fissure'?3:1)*s;
          const tilt=hash(x,y,31)>.5?1:-1,shift=(hash(x,y,33)-.5)*10*s;c.beginPath();c.moveTo(pt.x-23*s,pt.y-9*s*tilt+shift);c.lineTo(pt.x-6*s,pt.y+2*s*tilt+shift);c.lineTo(pt.x+4*s,pt.y-3*s*tilt+shift);c.lineTo(pt.x+19*s,pt.y+6*s*tilt+shift);c.stroke();
        }
        if(['crater','shadow','highland'].includes(biome)&&hash(x,y,34)>.66){
          const r=(7+hash(x,y,2)*10)*s;c.fillStyle=rgba('#142031',.15);c.strokeStyle=rgba('#ece3d6',.22);c.lineWidth=1.5*s;c.beginPath();c.ellipse(pt.x,pt.y,r,r*.46,0,0,Math.PI*2);c.fill();c.stroke();
        }
        c.restore();
        if(!t.building&&!water)this.drawScenery(c,pt.x,pt.y,biome,x,y,s,time);
        if(known&&t.terrain==='ice'&&!water){polygon(c,[[pt.x-7*s,pt.y],[pt.x,pt.y-5*s],[pt.x+7*s,pt.y],[pt.x,pt.y+3*s]],'#d5f6ef','#74c6de',s*.6);}
        if(known&&['science','salvage','hazard'].includes(t.terrain)){
          const colors={science:'#b8ede5',salvage:'#f2cc87',hazard:'#ff9476'};c.fillStyle=colors[t.terrain];c.font=`bold ${9*s}px monospace`;c.textAlign='center';c.fillText(t.terrain==='science'?'✧':t.terrain==='salvage'?'◇':'!',pt.x,pt.y+4*s);
        }
        if(t.building&&known){
          // Visible utility connections explain edge-connected construction.
          for(const [dx,dy] of [[-1,0],[0,-1]]){
            const nx=x+dx,ny=y+dy,neighbor=nx>=0&&ny>=0?this.props.tiles[ny*this.size+nx]:null;
            if(neighbor?.building){const other=this.geometry(nx,ny);c.strokeStyle='#dfc69888';c.lineWidth=3*s;c.beginPath();c.moveTo(pt.x,pt.y);c.lineTo(other.x,other.y);c.stroke();}
          }
          this.drawBuilding(c,pt.x,pt.y-3*s,t.building,s,p,motion?now:0);
        }
        if(this.props.buildingMode&&known&&!t.building){polygon(c,pt.points,'#c4f1e80a',this.props.biomes?.[biome]?.blocked||t.terrain==='hazard'?'#e8756d60':'#d9eee735',.65*s);}
        if(index===this.hover||index===this.props.selection){polygon(c,pt.points,index===this.props.selection?'#c4f1e823':'#c4f1e810',index===this.props.selection?'#f4dfb1':'#d3e8e2',index===this.props.selection?2:1);}
        if(this.props.surveys?.includes(index)){c.strokeStyle='#dfedd9bb';c.lineWidth=1.5;const radius=(10+(time*5)%14)*s;c.beginPath();c.ellipse(pt.x,pt.y,radius,radius*.45,0,0,Math.PI*2);c.stroke();}
      }
    }
    // Slow atmospheric haze; the map stays still for accurate picking.
    if(['earth','mars','venus'].includes(this.props.world)){
      for(let n=0;n<3;n++){
        const x=((n*.38+(time*.006)%1)*w)%(w*1.4)-w*.2,y=h*(.28+n*.24);
        const cloud=c.createRadialGradient(x,y,10,x,y,w*.29);cloud.addColorStop(0,this.props.world==='earth'?'#e4f0dd09':'#dab08c08');cloud.addColorStop(1,'#ffffff00');c.fillStyle=cloud;c.fillRect(0,0,w,h);
      }
    }
    const vignette=c.createLinearGradient(0,0,0,h);vignette.addColorStop(0,'#06101b60');vignette.addColorStop(.4,'#07111a00');vignette.addColorStop(1,'#02050a60');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
  drawScenery(c,x,y,biome,gx,gy,s,time){
    if(biome==='forest'||biome==='grassland'||biome==='wetland'){
      const count=biome==='forest'?2+Math.floor(hash(gx,gy,28)*3):biome==='wetland'?2:hash(gx,gy,8)>.86?1:0;
      for(let n=0;n<count;n++){
        const tx=x+(hash(gx+n,gy,22)-.5)*29*s,ty=y+(hash(gx,gy+n,24)-.5)*12*s;
        const height=(biome==='wetland'?8:14+hash(gx+n,gy,25)*9)*s,sway=Math.sin(time*.8+gx+gy+n)*.7*s;
        c.fillStyle='#132e2436';c.beginPath();c.ellipse(tx+6*s,ty+3*s,10*s,4*s,-.3,0,Math.PI*2);c.fill();
        c.strokeStyle='#675846';c.lineWidth=2*s;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx+sway,ty-height*.65);c.stroke();
        for(let branch=0;branch<3;branch++){
          c.fillStyle=['#355f43','#507e4c','#779951'][branch];c.beginPath();c.ellipse(tx+sway+(branch-1)*3*s,ty-height+branch*3*s,(5+hash(gx+n,gy,14)*3)*s,(6+hash(gx,gy+n,18)*4)*s,-.2,0,Math.PI*2);c.fill();
        }
      }
    }else if(['mountain','mesa','highland','chaos','basalt'].includes(biome)&&hash(gx,gy,2)>.54){
      const rock=hash(gx,gy,8),height=(biome==='mountain'?27+rock*24:9+rock*16)*s;
      const stone=biome==='chaos'?'#bcd6db':biome==='mesa'?'#cb9272':biome==='basalt'?'#93827b':'#bcb7a8';
      const width=(biome==='mountain'?18+rock*9:10+rock*8)*s;
      c.fillStyle='#1e262e22';c.beginPath();c.ellipse(x+width*.6,y+4*s,width*1.4,6*s,-.1,0,Math.PI*2);c.fill();
      polygon(c,[[x-width,y+2*s],[x-width*.7,y-height*.3],[x-width*.35,y-height*.85],[x+width*.02,y-height],[x+width*.4,y-height*.58],[x+width*.65,y-height*.35],[x+width,y+6*s]],mixed(stone,'#233643',.35));
      polygon(c,[[x-width,y+2*s],[x-width*.7,y-height*.3],[x-width*.35,y-height*.85],[x+width*.02,y-height],[x+width*.18,y-height*.4],[x-width*.1,y+4*s]],stone);
      polygon(c,[[x+width*.02,y-height],[x+width*.4,y-height*.58],[x+width*.32,y-height*.2],[x+width*.18,y-height*.4]],mixed(stone,'#eee0ba',.2));
      if(biome==='mountain')polygon(c,[[x-width*.35,y-height*.85],[x+width*.02,y-height],[x+width*.22,y-height*.8],[x+width*.08,y-height*.77],[x-width*.05,y-height*.7],[x-width*.18,y-height*.78]],'#dde4da');
    }
  }

  drawBuilding(c,x,y,b,s,p,now){
    const t=b.type,at=now/550; c.save();c.translate(x,y);c.scale(s,s);
    c.fillStyle='#05151cae';c.beginPath();c.ellipse(1,7,22,9,0,0,Math.PI*2);c.fill();
    box(c,0,2,35,18,7,'#8497a1','#394953');
    if(t==='solar'){for(let side of [-1,1]){polygon(c,[[side*8,-11],[side*27,-18],[side*34,-9],[side*14,-2]],'#265a78','#18354f',1);for(let n=0;n<3;n++){c.strokeStyle='#75b7d282';c.beginPath();c.moveTo(side*(12+n*6),-13-n*2);c.lineTo(side*(19+n*5),-5-n*.9);c.stroke();}}box(c,0,-6,10,9,5,'#aec9d3','#576875');}
    else if(t==='shield'){c.fillStyle='#7de8ed30';c.strokeStyle='#bffcffb9';c.lineWidth=1.4;c.beginPath();c.ellipse(0,-6,21,19,0,Math.PI,Math.PI*2);c.lineTo(21,-6);c.ellipse(0,-6,21,7,0,0,Math.PI);c.fill();c.stroke();}
    else if(t==='greenhouse'){c.fillStyle='#9adbc13b';c.strokeStyle='#a8f5d5';c.lineWidth=1.7;c.beginPath();c.ellipse(0,-9,17,14,0,Math.PI,Math.PI*2);c.lineTo(17,-9);c.ellipse(0,-9,17,7,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#aee48c';c.fillRect(-9,-14,6,6);c.fillRect(5,-14,5,6);}
    else if(t==='habitat'||t==='command'){box(c,0,-13,28,19,18,'#b9d0d6','#738591');c.fillStyle='#2e617b';c.fillRect(-4,-34,8,5);c.strokeStyle='#f8b986';c.lineWidth=2;c.beginPath();c.moveTo(1,-34);c.lineTo(1,-45);c.stroke();}
    else if(t==='laboratory'){box(c,0,-10,27,17,18,'#aec1cd','#657681');c.fillStyle='#82e5f9';c.fillRect(-8,-27,16,6);}
    else if(t==='extractor'||t==='drill'){box(c,0,-12,22,14,19,'#b9b7aa','#7f7868');c.strokeStyle='#ffcc85';c.lineWidth=3;c.beginPath();c.moveTo(7,-23);c.lineTo(13,-37);c.stroke();}
    else if(t==='recycler'){box(c,-7,-9,12,12,22,'#bad6d8','#668a9e');box(c,8,-5,12,12,22,'#c7ddd2','#547e78');c.strokeStyle='#9ee9d7';c.lineWidth=2;c.beginPath();c.moveTo(-7,-21);c.lineTo(8,-17);c.stroke();}
    else if(t==='heater'){box(c,0,-14,22,14,20,'#bd9991','#715c59');c.fillStyle='#ffb36b';c.fillRect(-7,-29,14,7);}
    else box(c,0,-12,24,16,15,'#b7cad0','#657d8b');
    if(b.onlineFrom>this.props.turn){c.globalAlpha=.65;c.fillStyle='#ffe5aa';c.font='bold 9px monospace';c.textAlign='center';c.fillText('BUILDING',0,-46);}
    else if(t==='habitat'||t==='command'||t==='laboratory'){c.fillStyle=`rgba(130,245,255,${.7+.3*Math.sin(at)})`;c.beginPath();c.arc(0,-48,2.4,0,Math.PI*2);c.fill();}
    c.restore();
  }
  drawMini(){if(!this.minimap)return;const canvas=this.minimap,rect=canvas.getBoundingClientRect();if(rect.width<1)return;let dpr=Math.min(2,devicePixelRatio||1);canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);const width=rect.width,height=rect.height;
    c.fillStyle='#091823';c.fillRect(0,0,width,height);const tw=width/this.size,th=height/this.size;
    for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){const tile=this.props.tiles?.[y*this.size+x];c.fillStyle=mixed(this.biomeColor(tile),'#102335',tile?.revealed?.02:.22);c.fillRect(x*tw,y*th,Math.ceil(tw+.5),Math.ceil(th+.5));if(tile?.building){c.fillStyle='#ddfaff';c.fillRect(x*tw,y*th,Math.max(2,tw),Math.max(2,th));}}
    const x=this.props.selection%this.size,y=Math.floor(this.props.selection/this.size);if(Number.isFinite(x)&&Number.isFinite(y)){c.strokeStyle='#ffffff';c.lineWidth=1.5;c.strokeRect(x*tw-2,y*th-2,tw+4,th+4);}c.strokeStyle='#74c3d3aa';c.strokeRect(.5,.5,width-1,height-1);
  }
}

export function mountPlanetMap(canvas, minimap, props){if(activeMap)activeMap.destroy();activeMap=new PlanetMap(canvas,minimap,props);return activeMap;}
