import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight tracking script served to external websites.
// Usage: <script defer src="https://yourapp.com/api/tracker?s=SITE_KEY"></script>
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const siteKey = searchParams.get("s") ?? "";

  // On Railway the request origin is localhost (internal proxy).
  // Use x-forwarded-host to get the real public domain in production.
  // Falls back to origin for local development where x-forwarded-host is absent.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost.split(",")[0].trim()}`
    : origin;

  const script = `(function(){
  var SITE_KEY="${siteKey}";
  var BASE="${baseUrl}";
  var SESSION_KEY="__wa_s";
  var VISITOR_KEY="__wa_v";
  var pageStart=Date.now();

  function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36);}

  function getSession(){
    var s=sessionStorage.getItem(SESSION_KEY);
    if(!s){s=uid();sessionStorage.setItem(SESSION_KEY,s);}
    return s;
  }

  function getVisitor(){
    var v;
    try{v=localStorage.getItem(VISITOR_KEY);}catch(e){}
    if(!v){v=uid();try{localStorage.setItem(VISITOR_KEY,v);}catch(e){}}
    return v;
  }

  function getClientInfo(){
    return {
      screen_width:  window.screen?window.screen.width:null,
      screen_height: window.screen?window.screen.height:null,
      language:      navigator.language||navigator.userLanguage||null,
      timezone:      Intl&&Intl.DateTimeFormat?Intl.DateTimeFormat().resolvedOptions().timeZone:null,
    };
  }

  function send(type,extra){
    var payload=Object.assign({
      siteKey:SITE_KEY,
      type:type,
      url:location.href,
      referrer:document.referrer||null,
      sessionId:getSession(),
      visitorId:getVisitor(),
      properties:extra||{}
    },getClientInfo());
    if(navigator.sendBeacon){
      var blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
      navigator.sendBeacon(BASE+"/api/t",blob);
    }else{
      fetch(BASE+"/api/t",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),keepalive:true}).catch(function(){});
    }
  }

  // Track time on page and send duration on exit
  function sendDuration(){
    var ms=Date.now()-pageStart;
    if(ms<500)return; // ignore bounces under 0.5s
    var payload=Object.assign({
      siteKey:SITE_KEY,
      type:"duration",
      url:location.href,
      referrer:null,
      sessionId:getSession(),
      visitorId:getVisitor(),
      duration_ms:ms,
      properties:{}
    },getClientInfo());
    var blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
    if(navigator.sendBeacon){navigator.sendBeacon(BASE+"/api/t",blob);}
  }

  // Reset timer on SPA navigation
  function resetTimer(){pageStart=Date.now();}

  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="hidden")sendDuration();
  });
  window.addEventListener("pagehide",sendDuration);

  // Page view on load
  send("pageview");

  // SPA navigation via History API
  var _push=history.pushState;
  history.pushState=function(){sendDuration();_push.apply(this,arguments);resetTimer();send("pageview");};
  window.addEventListener("popstate",function(){sendDuration();resetTimer();send("pageview");});

  // Click tracking: outbound links + buttons
  document.addEventListener("click",function(e){
    var el=e.target;
    // Outbound links
    var a=el.closest("a");
    if(a&&a.href&&a.hostname!==location.hostname){
      send("click",{element:"link",target:a.href,text:(a.innerText||"").slice(0,100),page:location.pathname});
      return;
    }
    // Button clicks — track all, use data-track > text > aria-label > title > id > "button"
    var btn=el.closest("button,[role='button']");
    if(btn){
      var btext=(btn.innerText||"").slice(0,100).trim();
      var blabel=btn.getAttribute("aria-label")||btn.getAttribute("title")||"";
      var bid=btn.id||null;
      var bname=btn.getAttribute("data-track")||btext||blabel||bid||"button";
      send("click",{element:"button",name:bname,text:btext||blabel,id:bid,page:location.pathname});
    }
  });

  // Form submissions
  document.addEventListener("submit",function(e){
    var form=e.target;
    var id=form.id||null;
    var fname=form.getAttribute("name")||null;
    send("form_submit",{name:fname||id||"form",form_id:id,page:location.pathname});
  });

  // Expose manual track function (supports isLoggedIn flag)
  window.waTrack=function(name,props){send("custom",Object.assign({name:name},props||{}));};
  window.waIdentify=function(isLoggedIn){send("identify",{is_logged_in:!!isLoggedIn});};
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
