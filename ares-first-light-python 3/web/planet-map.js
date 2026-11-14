/** Canvas strategy map. Cosmetic terrain is not scientific or authoritative game data. */

const W = 60, H = 30;
const surfaces = {
  mars: {sky:'#130c14', land:'#795044', light:'#c18b68', dark:'#392a32', accent:'#ffb47b', ridge:'#aa7365', ice:'#86bdcb'},
  venus: {sky:'#241710', land:'#8b6348', light:'#e7b876', dark:'#4c342e', accent:'#ffe19c', ridge:'#c78c55', ice:'#c8bb92'},
  mercury: {sky:'#0f1119', land:'#71717c', light:'#b3b4b8', dark:'#303541', accent:'#f4ca87', ridge:'#94919b', ice:'#bfc9cc'},
  europa: {sky:'#101923', land:'#6e919d', light:'#c9e4e2', dark:'#294d62', accent:'#bcf5ff', ridge:'#8cabb3', ice:'#c2e5e9'},
  earth: {sky:'#071b26', land:'#577d81', light:'#9ec1bb', dark:'#253c52', accent:'#c1fff3', ridge:'#6f9392', ice:'#d6efed'},
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
  return `rgb(${v.join(',')})`;
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
    this.pointer=null;this.dead=false;this.lastFrame=0;
    this.resize=()=>{if(this.dead)return;const r=canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(this.width*dpr);canvas.height=Math.round(this.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.draw();this.drawMini();};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY<0?1.15:1/1.15,e.offsetX,e.offsetY);},{passive:false});
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragged:false};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!this.pointer)return;const p=this.pointer;const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY;p.lastX=e.clientX;p.lastY=e.clientY;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>5)p.dragged=true;if(p.dragged){this.cam.x+=dx;this.cam.y+=dy;this.draw();this.drawMini();}});
    canvas.addEventListener('pointerup',e=>{const p=this.pointer;this.pointer=null;if(p&&!p.dragged){const rect=canvas.getBoundingClientRect();const index=this.pick(e.clientX-rect.left,e.clientY-rect.top);if(index!==null)this.props.onSelect(index);} });
    canvas.addEventListener('pointercancel',()=>{this.pointer=null;});
    if(minimap)minimap.addEventListener('click',e=>{const r=minimap.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*this.size;const y=(e.clientY-r.top)/r.height*this.size;this.centerOn(x,y);});
    this.resize();this.animate=timestamp=>{if(this.dead)return;if(timestamp-this.lastFrame>110){this.lastFrame=timestamp;this.draw(timestamp);}this.animation=requestAnimationFrame(this.animate);};this.animation=requestAnimationFrame(this.animate);
  }
  destroy(){this.dead=true;this.observer.disconnect();cancelAnimationFrame(this.animation);}
  coord(x,y){const shift=this.size/2-.5;return {x:this.width/2+this.cam.x+(x-y)*W/2*this.cam.scale,y:this.height/2+this.cam.y+((x+y)-shift*2)*H/2*this.cam.scale};}
  pick(sx,sy){const scale=this.cam.scale;const q=(sx-this.width/2-this.cam.x)/scale/(W/2);const r=(sy-this.height/2-this.cam.y)/scale/(H/2)+(this.size-1);const x=Math.round((q+r)/2),y=Math.round((r-q)/2);return x>=0&&y>=0&&x<this.size&&y<this.size?y*this.size+x:null;}
  centerOn(x=this.size/2-.5,y=this.size/2-.5){this.cam.x=-(x-y)*W/2*this.cam.scale;this.cam.y=-((x+y)-(this.size-1))*H/2*this.cam.scale+85;this.draw();this.drawMini();}
  overview(){this.cam.scale=.56;this.centerOn();}
  zoom(factor,sx=this.width/2,sy=this.height/2){const prior=this.cam.scale;this.cam.scale=Math.max(.42,Math.min(3.2,prior*factor));const z=this.cam.scale/prior;this.cam.x=sx-this.width/2+(this.cam.x-(sx-this.width/2))*z;this.cam.y=sy-this.height/2+(this.cam.y-(sy-this.height/2))*z;this.draw();this.drawMini();}
  features(x,y){return hash(x,y,11);}
  draw(now=0){
    if(!this.width||!this.height)return;
    const c=this.ctx,p=this.palette,w=this.width,h=this.height,s=this.cam.scale;
    c.clearRect(0,0,w,h);
    const sky=c.createRadialGradient(w*.56,h*.45,30,w*.5,h*.5,Math.max(w,h)*.92);
    sky.addColorStop(0,mixed(p.sky,p.land,.27));sky.addColorStop(.55,p.sky);sky.addColorStop(1,'#04070d');c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(let i=0;i<100;i++){let x=hash(i,3)*w,y=hash(i,7)*h;c.fillStyle=`rgba(219,231,239,${.06+hash(i,8)*.26})`;c.fillRect(x,y,hash(i,9)>0.93?2:1,1);}
    const pad=W*s;
    for(let sum=0;sum<=2*(this.size-1);sum++){
      const first=Math.max(0,sum-(this.size-1)),last=Math.min(this.size-1,sum);
      for(let x=first;x<=last;x++){
        const y=sum-x,index=y*this.size+x,t=this.props.tiles?.[index];
        const pt=this.coord(x,y);if(pt.x<-pad||pt.x>w+pad||pt.y<-pad*1.5||pt.y>h+pad*1.5)continue;
        const known=Boolean(t?.revealed),terrain=known?t.terrain:null;
        const colorVar=this.features(x,y),ridge=terrain==='ridge'||(!known&&colorVar>.77),ice=terrain==='ice';
        const depth=(2+Math.floor(hash(x,y,4)*3)+(ridge?6:0))*s;
        const tint=colorVar*.30-.12;
        let base=known?(terrain==='ice'?p.ice:terrain==='hazard'?mixed(p.land,'#481c2e',.5):terrain==='science'?mixed(p.land,p.accent,.28):terrain==='ridge'?p.ridge:terrain==='salvage'?mixed(p.land,'#c2a37a',.2):p.land):mixed(p.dark,p.land,.52+tint);
        base=mixed(base,p.light,Math.max(0,tint+(known?.16:.035)));
        const a=W/2*s,b=H/2*s;
        polygon(c,[[pt.x-a,pt.y],[pt.x,pt.y+b],[pt.x,pt.y+b+depth],[pt.x-a,pt.y+depth]],mixed(base,p.dark,.5));
        polygon(c,[[pt.x,pt.y+b],[pt.x+a,pt.y],[pt.x+a,pt.y+depth],[pt.x,pt.y+b+depth]],mixed(base,p.dark,.78));
        polygon(c,[[pt.x,pt.y-b],[pt.x+a,pt.y],[pt.x,pt.y+b],[pt.x-a,pt.y]],base,known?rgba(p.light,.16):rgba(p.light,.09),.75*s);
        const r=hash(x,y,12);
        if(r>.68){c.strokeStyle=rgba(known?p.light:p.ridge,known?.25:.17);c.lineWidth=Math.max(.6,s*.72);c.beginPath();c.ellipse(pt.x+(r-.8)*11*s,pt.y+(r-.75)*4*s,Math.max(2,7*s),Math.max(1.5,3*s),0,0,Math.PI*2);c.stroke();}
        if(ridge){polygon(c,[[pt.x-12*s,pt.y+2*s],[pt.x-4*s,pt.y-10*s],[pt.x+9*s,pt.y+3*s]],rgba(p.light,known?.31:.18));polygon(c,[[pt.x-4*s,pt.y-10*s],[pt.x+13*s,pt.y+3*s],[pt.x+9*s,pt.y+3*s]],rgba(p.dark,.36));}
        if(known&&terrain==='science'){c.fillStyle=rgba(p.accent,.72);c.beginPath();c.arc(pt.x,pt.y,2.4*s,0,Math.PI*2);c.fill();}
        if(known&&terrain==='ice'){c.strokeStyle=rgba('#e8ffff',.55);c.lineWidth=1.2*s;c.beginPath();c.moveTo(pt.x-8*s,pt.y);c.lineTo(pt.x,pt.y-3*s);c.lineTo(pt.x+8*s,pt.y+2*s);c.stroke();}
        if(known&&terrain==='hazard'){c.strokeStyle=rgba('#ff715f',.45);c.beginPath();c.moveTo(pt.x-12*s,pt.y-2*s);c.lineTo(pt.x+3*s,pt.y+3*s);c.lineTo(pt.x+10*s,pt.y-4*s);c.stroke();}
        if(known&&t.building)this.drawBuilding(c,pt.x,pt.y-6*s,t.building,s,p,now);
        if(index===this.props.selection){polygon(c,[[pt.x,pt.y-b],[pt.x+a,pt.y],[pt.x,pt.y+b],[pt.x-a,pt.y]],rgba(p.accent,.11),p.accent,Math.max(1.5,2/s)*s);c.strokeStyle=rgba(p.accent,.8);c.beginPath();c.moveTo(pt.x,pt.y-b-9*s);c.lineTo(pt.x,pt.y-b-2*s);c.stroke();}
        if(this.props.expeditions?.includes(index)){c.strokeStyle=rgba(p.accent,.8);c.lineWidth=2.4;const radius=(8+(now/90)%13)*s;c.beginPath();c.ellipse(pt.x,pt.y,radius,radius*.45,0,0,Math.PI*2);c.stroke();}
      }
    }
    const vignette=c.createLinearGradient(0,0,0,h);vignette.addColorStop(0,'#06101b80');vignette.addColorStop(.30,'#07111a00');vignette.addColorStop(1,'#02050aa8');c.fillStyle=vignette;c.fillRect(0,0,w,h);
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
    else if(t==='heater'){box(c,0,-14,22,14,20,'#bd9991','#715c59');c.fillStyle='#ffb36b';c.fillRect(-7,-29,14,7);}
    else box(c,0,-12,24,16,15,'#b7cad0','#657d8b');
    if(b.onlineFrom>this.props.turn){c.globalAlpha=.65;c.fillStyle='#ffe5aa';c.font='bold 9px monospace';c.textAlign='center';c.fillText('BUILDING',0,-46);}
    else if(t==='habitat'||t==='command'||t==='laboratory'){c.fillStyle=`rgba(130,245,255,${.7+.3*Math.sin(at)})`;c.beginPath();c.arc(0,-48,2.4,0,Math.PI*2);c.fill();}
    c.restore();
  }
  drawMini(){if(!this.minimap)return;const canvas=this.minimap,rect=canvas.getBoundingClientRect();if(rect.width<1)return;let dpr=Math.min(2,devicePixelRatio||1);canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);const width=rect.width,height=rect.height;
    c.fillStyle='#091823';c.fillRect(0,0,width,height);const tw=width/this.size,th=height/this.size;
    for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){const tile=this.props.tiles?.[y*this.size+x];c.fillStyle=tile?.revealed?(tile.terrain==='ice'?this.palette.ice:tile.terrain==='hazard'?'#c35f5f':this.palette.light):mixed(this.palette.dark,this.palette.land,hash(x,y,11)*.6);c.fillRect(x*tw,y*th,Math.ceil(tw+.5),Math.ceil(th+.5));if(tile?.building){c.fillStyle='#ddfaff';c.fillRect(x*tw,y*th,Math.max(2,tw),Math.max(2,th));}}
    const x=this.props.selection%this.size,y=Math.floor(this.props.selection/this.size);if(Number.isFinite(x)&&Number.isFinite(y)){c.strokeStyle='#ffffff';c.lineWidth=1.5;c.strokeRect(x*tw-2,y*th-2,tw+4,th+4);}c.strokeStyle='#74c3d3aa';c.strokeRect(.5,.5,width-1,height-1);
  }
}

export function mountPlanetMap(canvas, minimap, props){if(activeMap)activeMap.destroy();activeMap=new PlanetMap(canvas,minimap,props);return activeMap;}
