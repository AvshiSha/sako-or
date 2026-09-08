'use client'

import { usePathname } from 'next/navigation'

/**
 * Chatbase AI chat bubble, replacing the WhatsApp button that used to sit in
 * this slot.
 *
 * The embed is held as a STRING, not written as ordinary module code, and that
 * is deliberate: it declares an arrow function parameter named `arguments`,
 * which is a SyntaxError in strict mode. Module code is always strict, so
 * pasting it inline would fail the build. As a string it is injected as a
 * classic (non-strict) inline script, which is the context Chatbase wrote it
 * for. Keep it byte-for-byte as Chatbase supplied it - the `id` identifies the
 * agent.
 */
const CHATBASE_EMBED = `(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="MPJAQdlFfGrQ2IncZnNl-";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();`

export default function ChatbaseWidget() {
  const pathname = usePathname()

  // Never in the admin panel. The WhatsApp button excluded it for the same
  // reason: it is internal tooling, not a place to offer customer support, and
  // staff traffic would otherwise burn Chatbase message quota.
  if (pathname?.startsWith('/admin')) {
    return null
  }

  // A plain tag rather than next/script: this way the embed is in the
  // server-rendered HTML, immediately before </body>, which is what Chatbase's
  // instructions ask for and what makes it verifiable in `view-source`.
  // next/script's afterInteractive strategy injects only after hydration, so
  // the markup never shows it.
  //
  // Nothing is lost by skipping client-side navigation handling: /admin and the
  // storefront are separate route groups with their own <html>, so moving
  // between them is always a full page load.
  return <script dangerouslySetInnerHTML={{ __html: CHATBASE_EMBED }} />
}
