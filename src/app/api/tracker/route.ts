import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight tracking script served to external websites.
// Usage: <script defer src="https://yourapp.com/api/tracker?s=SITE_KEY"></script>
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const siteKey = searchParams.get("s") ?? "";

  // Use canonical app URL so the script works when embedded on external sites.
  // Railway/proxies may set origin to localhost — prefer the public env var or
  // the x-forwarded-host header.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin);

  const script = `(function(){
  var SITE_KEY="${siteKey}";
  var BASE="${baseUrl}";
  var SESSION_KEY="__wa_s";
  var VISITOR_KEY="__wa_v";

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

  function send(type,extra){
    var payload={
      siteKey:SITE_KEY,
      type:type,
      url:location.href,
      referrer:document.referrer||null,
      sessionId:getSession(),
      visitorId:getVisitor(),
      properties:extra||{}
    };
    if(navigator.sendBeacon){
      var blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
      navigator.sendBeacon(BASE+"/api/t",blob);
    }else{
      fetch(BASE+"/api/t",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),keepalive:true}).catch(function(){});
    }
  }

  // Page view on load
  send("pageview");

  // SPA navigation via History API
  var _push=history.pushState;
  history.pushState=function(){_push.apply(this,arguments);send("pageview");};
  window.addEventListener("popstate",function(){send("pageview");});

  // Outbound link clicks
  document.addEventListener("click",function(e){
    var a=e.target.closest("a");
    if(a&&a.href&&a.hostname!==location.hostname){
      send("click",{target:a.href,text:(a.innerText||"").slice(0,100)});
    }
  });

  // Expose manual track function
  window.waTrack=function(name,props){send("custom",Object.assign({name:name},props||{}));};
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
