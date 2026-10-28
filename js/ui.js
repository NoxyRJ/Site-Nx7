/* (opcional) convite do seu Discord, usado só no link "Discord de Suporte" do rodapé */
const TICKET_URL="https://discord.gg/SEU-CONVITE";
document.querySelectorAll('[data-buy="suporte"]').forEach(a=>{a.href=TICKET_URL;a.target='_blank';a.rel='noopener'});
document.getElementById('yr').textContent=new Date().getFullYear();
const w=['AUTOMAÇÃO','LIMPEZA','MULTI-CONTAS','ANTI-DETECÇÃO','FACILIDADE','ATUALIZAÇÕES','ORBS','DISCORD','MENSAGENS'].map(t=>t+'<i>✦</i>').join('');document.getElementById('mq').innerHTML=w+w+w+w;
const fraco=matchMedia('(max-width:860px)').matches||matchMedia('(pointer:coarse)').matches||(navigator.hardwareConcurrency||8)<=2||(navigator.deviceMemory||8)<=2;const desk=matchMedia('(hover:hover)').matches&&!fraco;
if(window.gsap&&!fraco){gsap.to('#in3',{y:-18,duration:2.4,yoyo:true,repeat:-1,ease:'sine.inOut'});document.querySelectorAll('i.sp').forEach((s,i)=>gsap.to(s,{y:-14,rotation:i%2?25:-25,duration:1.6+i*.35,yoyo:true,repeat:-1,ease:'sine.inOut'}))}
const e3=document.querySelector('.emb'),emb3=e3.firstElementChild;emb3.style.transition='transform .2s';if(desk){let f3=0,v3;e3.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;v3=e;if(f3)return;f3=requestAnimationFrame(()=>{f3=0;const r=e3.getBoundingClientRect(),x=(v3.clientX-r.left)/r.width-.5,y=(v3.clientY-r.top)/r.height-.5;emb3.style.transform=`rotateY(${x*28}deg) rotateX(${-y*28}deg)`})});e3.addEventListener('pointerleave',()=>emb3.style.transform='')}
document.querySelectorAll('.card').forEach(c=>{const k=c.classList.contains('combo')?' scale(1.04)':'';let f=0,ev;c.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;ev=e;if(f)return;f=requestAnimationFrame(()=>{f=0;const r=c.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width-.5,y=(ev.clientY-r.top)/r.height-.5;c.style.setProperty('--mx',ev.clientX-r.left+'px');c.style.setProperty('--my',ev.clientY-r.top+'px');if(desk)c.style.transform=`perspective(900px) rotateY(${x*10}deg) rotateX(${-y*10}deg)${k}`})});c.addEventListener('pointerleave',()=>{if(desk)c.style.transform=''})});
/* revela os blocos ao rolar; depois zera o atraso para o hover dos cards não ficar com lag */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);setTimeout(()=>{e.target.style.transitionDelay='0s'},1500)}}),{threshold:.12});document.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%3)*.1+'s';io.observe(el)});
const cv=document.getElementById('bg'),cx=cv.getContext('2d');let W,H,P=[];
const reduz=matchMedia('(prefers-reduced-motion:reduce)').matches,gate=()=>document.documentElement.classList.contains('gate');
const mk=(cor,glow)=>{const s=document.createElement('canvas');s.width=s.height=32;const g=s.getContext('2d');g.shadowBlur=10;g.shadowColor=glow;g.fillStyle=cor;g.beginPath();g.arc(16,16,4,0,7);g.fill();return s};
const spr=[mk('rgba(192,132,252,.7)','#a855f7'),mk('rgba(251,191,36,.85)','#fbbf24')];
function rs(){W=cv.width=innerWidth;H=cv.height=innerHeight;P=Array.from({length:fraco?Math.min(25,W/24|0):Math.min(60,W/20|0)},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.8+.4,v:Math.random()*.45+.12,g:Math.random()<.18}))}
rs();let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(rs,200)});
let rodando=false,ultimo=0;
function loop(now){if(!rodando)return;requestAnimationFrame(loop);if(now-ultimo<(fraco?33:16))return;ultimo=now;
cx.clearRect(0,0,W,H);for(const p of P){p.y-=p.v;p.x+=Math.sin(p.y/60)*.3;if(p.y<-5){p.y=H+5;p.x=Math.random()*W}const d=p.r*8;cx.drawImage(spr[+p.g],p.x-d/2,p.y-d/2,d,d)}}
function ligar(){const quer=!reduz&&!document.hidden&&!gate()&&!document.documentElement.classList.contains('cobre');if(quer&&!rodando){rodando=true;requestAnimationFrame(loop)}else if(!quer)rodando=false}
document.addEventListener('visibilitychange',ligar);new MutationObserver(ligar).observe(document.documentElement,{attributes:true,attributeFilter:['class']});ligar();
/* GPU: com modal / tela de tickets aberta a página de trás fica coberta -> pausa partículas, aurora, GSAP e animações CSS */
(function(){const h=document.documentElement,temCamada=()=>!!document.querySelector('.mdl:not([hidden]),.tv:not([hidden])');
function sync(){const c=temCamada();if(h.classList.contains('cobre')===c)return;h.classList.toggle('cobre',c);if(window.gsap)gsap.globalTimeline.paused(c)}
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['hidden'],subtree:true});sync()})();
/* GPU: animações infinitas só rodam enquanto o elemento está visível na tela */
const io2=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('pausa',!e.isIntersecting)));
document.querySelectorAll('.combo,.emb,h1 em,.mq,.bar,.btn').forEach(el=>io2.observe(el));
const nv=document.querySelector('nav'),mb=document.getElementById('mb'),pg=document.getElementById('pg');
mb.onclick=()=>nv.classList.toggle('open');nv.querySelectorAll('ul a').forEach(a=>a.onclick=()=>nv.classList.remove('open'));
addEventListener('scroll',()=>{pg.style.transform='scaleX('+Math.min(1,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight))+')'},{passive:true});

document.querySelectorAll('.chip').forEach((c,i)=>window.gsap&&!fraco&&gsap.to(c,{y:i%2?12:-12,duration:2+i*.4,yoyo:true,repeat:-1,ease:'sine.inOut'}));
if(desk&&window.gsap){let lt=0,vivas=0;
addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||gate()||document.documentElement.classList.contains('cobre'))return;const n=performance.now();if(n-lt<70||vivas>=10)return;lt=n;vivas++;
const s=document.createElement('i');s.textContent=Math.random()<.5?'★':'✦';s.style.cssText=`position:fixed;left:${e.clientX}px;top:${e.clientY}px;color:#fbbf24;pointer-events:none;z-index:60;font-size:${8+Math.random()*10}px;text-shadow:0 0 6px #fbbf24;will-change:transform,opacity`;document.body.appendChild(s);
gsap.to(s,{x:(Math.random()-.5)*40,y:20+Math.random()*30,opacity:0,rotation:Math.random()*180,duration:.9,onComplete:()=>{s.remove();vivas--}})})}
;
  // ===== Lógica do Modal de Tutorial de Token =====
  document.addEventListener('DOMContentLoaded', () => {
    const tutBtns = [document.getElementById('tutBtn'), document.getElementById('tutBtnMobile'), ...document.querySelectorAll('[data-open-tut]')];
    const tutModal = document.getElementById('tutorialModal');
    const tutClose = document.getElementById('tutClose');
    const copyBtn = document.getElementById('copyScriptBtn');
    const scriptText = document.getElementById('tokenScriptText');

    if(tutModal) {
      // Abrir modal (funciona tanto no botão do PC quanto no do celular)
      tutBtns.forEach(btn => {
        if(btn) {
          btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            tutModal.hidden = false;
            document.body.classList.add('noscroll');
            // Fecha o menu hambúrguer se estiver aberto
            const nav = document.querySelector('nav');
            if(nav) nav.classList.remove('open');
          });
        }
      });

      // Fechar modal
      const closeModal = () => {
        tutModal.hidden = true;
        document.body.classList.remove('noscroll');
      };
      
      tutClose.addEventListener('click', closeModal);
      tutModal.addEventListener('click', (e) => { if(e.target === tutModal) closeModal(); });
      document.addEventListener('keydown', (e) => { 
        if(e.key === 'Escape' && !tutModal.hidden) closeModal(); 
      });

      // Copiar o script
      copyBtn.addEventListener('click', () => {
        const textToCopy = scriptText.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = '✅ Script Copiado!';
          copyBtn.style.background = 'linear-gradient(135deg, #059669, #10b981)';
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '';
          }, 2500);
        }).catch(err => {
          alert('Erro ao copiar. Por favor, tente novamente.');
        });
      });
    }
  });
;
/* menu do topo: destaca o link da seção que está na tela */
(function(){
  var links=[].slice.call(document.querySelectorAll('nav.topnav>ul a[href^="#"]')),map={};
  if(!links.length||!('IntersectionObserver' in window))return;
  links.forEach(function(a){var id=a.getAttribute('href').slice(1);if(id&&document.getElementById(id))map[id]=a;});
  function limpa(){links.forEach(function(l){l.classList.remove('on');l.removeAttribute('aria-current');});}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;var a=map[e.target.id];if(!a)return;limpa();a.classList.add('on');a.setAttribute('aria-current','true');
  });},{rootMargin:'-45% 0px -50% 0px'});
  Object.keys(map).forEach(function(id){io.observe(document.getElementById(id));});
  addEventListener('scroll',function(){if(window.scrollY<200)limpa();},{passive:true});
})();