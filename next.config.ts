import type { NextConfig } from "next";
const isProduction=process.env.NODE_ENV==="production";
const securityHeaders=[
 {key:"X-Content-Type-Options",value:"nosniff"},
 {key:"X-Frame-Options",value:"DENY"},
 {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
 {key:"X-DNS-Prefetch-Control",value:"off"},
 {key:"Permissions-Policy",value:"camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), browsing-topics=()"},
 {key:"Content-Security-Policy",value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
 ...(isProduction?[{key:"Strict-Transport-Security",value:"max-age=63072000; includeSubDomains; preload"}]:[])
];
const nextConfig:NextConfig={poweredByHeader:false,async headers(){return [{source:"/:path*",headers:securityHeaders}]}};
export default nextConfig;
