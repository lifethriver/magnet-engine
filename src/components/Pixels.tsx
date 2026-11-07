import Script from "next/script";
import type { Settings } from "@/lib/settings";

/**
 * Google Tag Manager and Meta Pixel, only when the owner set their ids. The
 * ids are validated by the settings schema (GTM-XXXX, digits) and passed
 * through JSON.stringify, so nothing else can reach these scripts.
 */
export function Pixels({ tracking }: { tracking: Settings["tracking"] | undefined }) {
  const gtm = tracking?.gtmId && /^GTM-[A-Z0-9]{4,12}$/.test(tracking.gtmId) ? tracking.gtmId : null;
  const meta = tracking?.metaPixelId && /^\d{5,20}$/.test(tracking.metaPixelId) ? tracking.metaPixelId : null;
  return (
    <>
      {gtm && (
        <>
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtm)});`}
          </Script>
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="gtm" />
          </noscript>
        </>
      )}
      {meta && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(meta)});fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
