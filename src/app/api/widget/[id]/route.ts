import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const js = `(function(){
  var s=document.currentScript||[].slice.call(document.querySelectorAll('script')).pop();
  var src=s.src||'';
  var m=src.match(/\\/api\\/widget\\/([^/?#]+)/);
  if(!m)return;
  var wid=m[1];
  var host=src.split('/api/widget/')[0];
  var cfg={
    buttonText:s.getAttribute('data-button-text')||'Get in touch',
    buttonColor:s.getAttribute('data-button-color')||'#7c3aed',
    title:s.getAttribute('data-title')||s.getAttribute('data-button-text')||'Get in touch',
    success:s.getAttribute('data-success')||"Thanks! We\\'ll be in touch.",
    position:s.getAttribute('data-position')||'bottom-right',
    fields:[]
  };
  try{cfg.fields=JSON.parse(s.getAttribute('data-fields')||'[]');}catch(e){}
  if(!cfg.fields.length)cfg.fields=[
    {name:'email',label:'Email',type:'email',required:true},
    {name:'message',label:'Message',type:'textarea',required:false}
  ];

  var isLeft=cfg.position.indexOf('left')>-1;
  var isTop=cfg.position.indexOf('top')>-1;
  var posV=isTop?'top:24px':'bottom:24px';
  var posH=isLeft?'left:24px':'right:24px';

  var css=document.createElement('style');
  css.textContent=[
    '.fmw-btn{position:fixed;z-index:999990;'+posV+';'+posH+';',
    'background:'+cfg.buttonColor+';color:#fff;border:none;border-radius:24px;',
    'padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:.01em;',
    'box-shadow:0 4px 20px rgba(0,0,0,.22);transition:transform .12s,opacity .12s;font-family:inherit;}',
    '.fmw-btn:hover{opacity:.88;transform:scale(1.03);}',
    '.fmw-overlay{position:fixed;inset:0;z-index:999991;background:rgba(0,0,0,.45);',
    'display:flex;align-items:center;justify-content:center;animation:fmwFadeIn .15s ease;}',
    '@keyframes fmwFadeIn{from{opacity:0}to{opacity:1}}',
    '.fmw-modal{background:#fff;border-radius:16px;padding:28px 28px 24px;width:min(420px,92vw);',
    'font-family:inherit;box-shadow:0 24px 64px rgba(0,0,0,.18);animation:fmwSlideUp .18s ease;}',
    '@keyframes fmwSlideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}',
    '.fmw-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}',
    '.fmw-modal-head h3{margin:0;font-size:17px;font-weight:700;color:#111;}',
    '.fmw-close{background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;',
    'line-height:1;padding:0;transition:color .12s;}',
    '.fmw-close:hover{color:#374151;}',
    '.fmw-field{margin-bottom:14px;}',
    '.fmw-field label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px;}',
    '.fmw-field input,.fmw-field textarea{width:100%;box-sizing:border-box;',
    'border:1.5px solid #e5e7eb;border-radius:8px;padding:9px 12px;',
    'font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;color:#111;}',
    '.fmw-field input:focus,.fmw-field textarea:focus{border-color:'+cfg.buttonColor+';}',
    '.fmw-field textarea{resize:vertical;min-height:88px;}',
    '.fmw-submit{width:100%;padding:11px;background:'+cfg.buttonColor+';color:#fff;border:none;',
    'border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;',
    'transition:opacity .15s;font-family:inherit;}',
    '.fmw-submit:hover:not(:disabled){opacity:.88;}',
    '.fmw-submit:disabled{opacity:.5;cursor:default;}',
    '.fmw-err{color:#dc2626;font-size:12px;margin-top:10px;text-align:center;}',
    '.fmw-success{text-align:center;padding:24px 0 8px;}',
    '.fmw-success svg{margin-bottom:10px;}',
    '.fmw-success p{font-size:15px;color:#111;margin:0;font-weight:500;}'
  ].join('');
  document.head.appendChild(css);

  var btn=document.createElement('button');
  btn.className='fmw-btn';
  btn.textContent=cfg.buttonText;
  document.body.appendChild(btn);

  var overlay=null;

  function openModal(){
    overlay=document.createElement('div');
    overlay.className='fmw-overlay';
    overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal();});

    var modal=document.createElement('div');
    modal.className='fmw-modal';

    var head=document.createElement('div');
    head.className='fmw-modal-head';
    var title=document.createElement('h3');
    title.textContent=cfg.title;
    var closeBtn=document.createElement('button');
    closeBtn.className='fmw-close';
    closeBtn.innerHTML='&times;';
    closeBtn.addEventListener('click',closeModal);
    head.appendChild(title);
    head.appendChild(closeBtn);

    var form=document.createElement('form');

    cfg.fields.forEach(function(f){
      var wrap=document.createElement('div');
      wrap.className='fmw-field';
      var lbl=document.createElement('label');
      lbl.textContent=f.label+(f.required?' *':'');
      var inp;
      if(f.type==='textarea'){
        inp=document.createElement('textarea');
      }else{
        inp=document.createElement('input');
        inp.type=f.type||'text';
      }
      inp.name=f.name;
      inp.required=!!f.required;
      inp.placeholder=f.label;
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      form.appendChild(wrap);
    });

    var submitBtn=document.createElement('button');
    submitBtn.type='submit';
    submitBtn.className='fmw-submit';
    submitBtn.textContent='Submit';
    form.appendChild(submitBtn);

    var errEl=document.createElement('p');
    errEl.className='fmw-err';
    errEl.style.display='none';
    form.appendChild(errEl);

    form.addEventListener('submit',function(e){
      e.preventDefault();
      submitBtn.disabled=true;
      submitBtn.textContent='Sending\u2026';
      errEl.style.display='none';
      var data={};
      cfg.fields.forEach(function(f){
        var el=form.elements[f.name];
        if(el)data[f.name]=el.value;
      });
      fetch(host+'/api/webhook/'+wid,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)
      }).then(function(r){
        if(!r.ok)throw new Error('error');
        modal.innerHTML='<div class="fmw-success">'+
          '<svg width="52" height="52" viewBox="0 0 52 52" fill="none">'+
          '<circle cx="26" cy="26" r="26" fill="#ecfdf5"/>'+
          '<path d="M15 26l8 8 14-16" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+
          '</svg>'+
          '<p>'+cfg.success+'</p></div>';
        setTimeout(closeModal,3200);
      }).catch(function(){
        submitBtn.disabled=false;
        submitBtn.textContent='Submit';
        errEl.textContent='Something went wrong. Please try again.';
        errEl.style.display='block';
      });
    });

    modal.appendChild(head);
    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function closeModal(){
    if(overlay){overlay.remove();overlay=null;}
  }

  btn.addEventListener('click',openModal);
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
