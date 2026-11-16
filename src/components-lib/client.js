"use strict";
// components-lib behaviour, as photoshop.scenario.com behaves: the contents
// rail (open beside the page, a closed card on narrow screens, the section in
// view marked), search ("/" focuses it), drag to compare, the film, and
// pictures that enlarge. The page reads fine without it.

const CLIENT = String.raw`
(function(){
  // Contents rail
  var toc=document.getElementById("toc");
  if(toc){
    var det=toc.querySelector("details"),mq=window.matchMedia("(max-width: 960px)");
    function fit(){det.open=!mq.matches;}
    fit();
    if(mq.addEventListener)mq.addEventListener("change",fit);else if(mq.addListener)mq.addListener(fit);
    det.querySelector("summary").addEventListener("click",function(e){if(!mq.matches)e.preventDefault();});
    toc.addEventListener("click",function(e){if(mq.matches&&e.target.closest("a"))det.open=false;});
    var marks=[].slice.call(toc.querySelectorAll("a[href^='#']")).map(function(a){
      var up=a.parentNode.parentNode.closest("li");
      return {a:a,el:document.getElementById(a.getAttribute("href").slice(1)),up:up?up.firstElementChild:null};
    }).filter(function(m){return m.el;});
    var ticking=false;
    function spy(){
      ticking=false;
      if(!marks.length)return;
      var cur=marks[0];
      marks.forEach(function(m){if(m.el.getBoundingClientRect().top<=140)cur=m;});
      if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4)cur=marks[marks.length-1];
      marks.forEach(function(m){m.a.removeAttribute("aria-current");m.a.classList.remove("in");});
      cur.a.setAttribute("aria-current","location");
      if(cur.up)cur.up.classList.add("in");
      if(!mq.matches){var t=cur.a.offsetTop,h=toc.clientHeight;if(t<toc.scrollTop+40||t>toc.scrollTop+h-60)toc.scrollTop=t-h/3;}
    }
    window.addEventListener("scroll",function(){if(!ticking){ticking=true;requestAnimationFrame(spy);}},{passive:true});
    spy();
  }

  // Drag to compare
  [].forEach.call(document.querySelectorAll(".wipe"),function(w){
    var r=w.querySelector("input");
    if(r)r.addEventListener("input",function(){w.style.setProperty("--cut",r.value+"%");});
  });

  // The film: its poster until it plays; no broken player
  var film=document.getElementById("film"),fv=document.getElementById("film-v"),fp=document.getElementById("film-play");
  if(film&&fv&&fp){
    fv.addEventListener("error",function(){film.setAttribute("data-state","missing");fv.controls=false;});
    fp.addEventListener("click",function(){
      if(film.getAttribute("data-state")==="missing")return;
      fv.controls=true;
      var p=fv.play();
      film.setAttribute("data-state","playing");
      if(p&&p.catch)p.catch(function(err){if(err&&err.name==="NotAllowedError")return;film.setAttribute("data-state","missing");fv.controls=false;});
    });
  }

  // Pictures that enlarge
  var lb=document.getElementById("lightbox");
  if(lb&&lb.showModal){
    var lbImg=lb.querySelector("img"),lbCap=lb.querySelector(".lb-cap");
    document.addEventListener("click",function(e){
      var b=e.target.closest&&e.target.closest("[data-zoom]");
      if(!b)return;
      var img=b.querySelector("img");
      lbImg.src=img.currentSrc||img.src;lbImg.alt=img.alt;lbCap.textContent=img.alt;
      lb.showModal();
    });
    lb.addEventListener("click",function(e){if(e.target===lb||e.target===lbImg)lb.close();});
  }

  // Search: entries from the page's search index
  var input=document.getElementById("q"),panel=document.getElementById("q-panel"),list=document.getElementById("q-results"),status=document.getElementById("q-status");
  var data=[];try{data=JSON.parse(document.getElementById("search-index").textContent);}catch(e){}
  data.forEach(function(d){d.lt=d.t.toLowerCase();d.lx=d.x.toLowerCase();});
  var sel=-1,hits=[];
  function escH(s){return s.replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  // Marks the query words on the raw text, then escapes each piece, so a word
  // such as "amp" or "mark" never matches inside an entity or a tag.
  function hl(s,words){var ws=words.filter(function(w){return w.length>=2;}).map(function(w){return w.replace(/[.*+?^$()|[\]\\{}]/g,"\\$&");});if(!ws.length)return escH(s);return s.split(new RegExp("("+ws.join("|")+")","ig")).map(function(part,i){return i%2?"<mark>"+escH(part)+"</mark>":escH(part);}).join("");}
  function snippet(d,words){var i=-1;for(var k=0;k<words.length&&i<0;k++)i=d.lx.indexOf(words[k]);if(i<0)return d.x.slice(0,140);var s=Math.max(0,i-50);return (s?"…":"")+d.x.slice(s,s+150)+"…";}
  function run(){
    var q=input.value.trim().toLowerCase();
    if(!q){close();return;}
    var words=q.split(/\s+/);
    hits=[];
    data.forEach(function(d){var score=0;for(var k=0;k<words.length;k++){var w=words[k];var t=d.lt.indexOf(w)>=0,x=d.lx.indexOf(w)>=0;if(!t&&!x)return;score+=(t?10:0)+(x?1:0)+(d.lt.indexOf(w)===0?5:0);}hits.push({d:d,s:score});});
    hits.sort(function(a,b){return b.s-a.s;});hits=hits.slice(0,12);sel=hits.length?0:-1;
    list.innerHTML=hits.map(function(h,i){return '<li role="option" id="q-o'+i+'" aria-selected="'+(i===sel)+'"><a href="#'+h.d.id+'">'+(h.d.c?'<span class="s-trail">'+escH(h.d.c)+'</span>':'')+'<span class="s-title">'+hl(h.d.t,words)+'</span><span class="s-snip">'+hl(snippet(h.d,words),words)+'</span></a></li>';}).join("");
    status.textContent=hits.length?(hits.length+(hits.length===1?" section":" sections")+". Enter opens, arrows move, Esc closes."):"No section matches.";
    panel.hidden=false;input.setAttribute("aria-expanded","true");
    if(sel>=0)input.setAttribute("aria-activedescendant","q-o0");
  }
  function close(){panel.hidden=true;input.setAttribute("aria-expanded","false");input.removeAttribute("aria-activedescendant");}
  function move(n){if(!hits.length)return;var items=list.children;if(items[sel])items[sel].setAttribute("aria-selected","false");sel=(sel+n+hits.length)%hits.length;items[sel].setAttribute("aria-selected","true");items[sel].scrollIntoView({block:"nearest"});input.setAttribute("aria-activedescendant","q-o"+sel);}
  function go(id){close();input.blur();var el=document.getElementById(id);if(el){location.hash=id;el.setAttribute("tabindex","-1");el.focus({preventScroll:true});}}
  if(input){
    input.addEventListener("input",run);
    input.addEventListener("focus",function(){if(input.value.trim())run();});
    input.addEventListener("keydown",function(e){
      if(e.key==="ArrowDown"){e.preventDefault();move(1);}
      else if(e.key==="ArrowUp"){e.preventDefault();move(-1);}
      else if(e.key==="Enter"){if(hits[sel]){e.preventDefault();go(hits[sel].d.id);}}
      else if(e.key==="Escape"){if(!panel.hidden){close();}else{input.value="";input.blur();}}
    });
    list.addEventListener("click",function(e){var a=e.target.closest("a");if(a){e.preventDefault();go(a.getAttribute("href").slice(1));}});
    document.addEventListener("click",function(e){if(!e.target.closest(".search"))close();});
    document.addEventListener("keydown",function(e){
      if(e.key!=="/"||e.metaKey||e.ctrlKey||e.altKey)return;
      var t=e.target,tag=t&&t.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||(t&&t.isContentEditable))return;
      e.preventDefault();input.focus();input.select();
    });
  }
})();
`;

module.exports = { CLIENT };
