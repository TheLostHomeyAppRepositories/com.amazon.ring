(()=>{var e={930:(e,t,r)=>{e.exports=r(275)},275:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});Object.defineProperty(t,"NIL",{enumerable:true,get:function(){return f.default}});Object.defineProperty(t,"parse",{enumerable:true,get:function(){return s.default}});Object.defineProperty(t,"stringify",{enumerable:true,get:function(){return d.default}});Object.defineProperty(t,"v1",{enumerable:true,get:function(){return u.default}});Object.defineProperty(t,"v3",{enumerable:true,get:function(){return n.default}});Object.defineProperty(t,"v4",{enumerable:true,get:function(){return i.default}});Object.defineProperty(t,"v5",{enumerable:true,get:function(){return a.default}});Object.defineProperty(t,"validate",{enumerable:true,get:function(){return o.default}});Object.defineProperty(t,"version",{enumerable:true,get:function(){return l.default}});var u=_interopRequireDefault(r(839));var n=_interopRequireDefault(r(364));var i=_interopRequireDefault(r(268));var a=_interopRequireDefault(r(777));var f=_interopRequireDefault(r(455));var l=_interopRequireDefault(r(265));var o=_interopRequireDefault(r(279));var d=_interopRequireDefault(r(278));var s=_interopRequireDefault(r(319));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}},823:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(113));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function md5(e){if(Array.isArray(e)){e=Buffer.from(e)}else if(typeof e==="string"){e=Buffer.from(e,"utf8")}return u.default.createHash("md5").update(e).digest()}var n=md5;t["default"]=n},248:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(113));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}var n={randomUUID:u.default.randomUUID};t["default"]=n},455:(e,t)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var r="00000000-0000-0000-0000-000000000000";t["default"]=r},319:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(279));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function parse(e){if(!(0,u.default)(e)){throw TypeError("Invalid UUID")}let t;const r=new Uint8Array(16);r[0]=(t=parseInt(e.slice(0,8),16))>>>24;r[1]=t>>>16&255;r[2]=t>>>8&255;r[3]=t&255;r[4]=(t=parseInt(e.slice(9,13),16))>>>8;r[5]=t&255;r[6]=(t=parseInt(e.slice(14,18),16))>>>8;r[7]=t&255;r[8]=(t=parseInt(e.slice(19,23),16))>>>8;r[9]=t&255;r[10]=(t=parseInt(e.slice(24,36),16))/1099511627776&255;r[11]=t/4294967296&255;r[12]=t>>>24&255;r[13]=t>>>16&255;r[14]=t>>>8&255;r[15]=t&255;return r}var n=parse;t["default"]=n},417:(e,t)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var r=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;t["default"]=r},806:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=rng;var u=_interopRequireDefault(r(113));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}const n=new Uint8Array(256);let i=n.length;function rng(){if(i>n.length-16){u.default.randomFillSync(n);i=0}return n.slice(i,i+=16)}},424:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(113));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function sha1(e){if(Array.isArray(e)){e=Buffer.from(e)}else if(typeof e==="string"){e=Buffer.from(e,"utf8")}return u.default.createHash("sha1").update(e).digest()}var n=sha1;t["default"]=n},278:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;t.unsafeStringify=unsafeStringify;var u=_interopRequireDefault(r(279));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}const n=[];for(let e=0;e<256;++e){n.push((e+256).toString(16).slice(1))}function unsafeStringify(e,t=0){return(n[e[t+0]]+n[e[t+1]]+n[e[t+2]]+n[e[t+3]]+"-"+n[e[t+4]]+n[e[t+5]]+"-"+n[e[t+6]]+n[e[t+7]]+"-"+n[e[t+8]]+n[e[t+9]]+"-"+n[e[t+10]]+n[e[t+11]]+n[e[t+12]]+n[e[t+13]]+n[e[t+14]]+n[e[t+15]]).toLowerCase()}function stringify(e,t=0){const r=unsafeStringify(e,t);if(!(0,u.default)(r)){throw TypeError("Stringified UUID is invalid")}return r}var i=stringify;t["default"]=i},839:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(806));var n=r(278);function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}let i;let a;let f=0;let l=0;function v1(e,t,r){let o=t&&r||0;const d=t||new Array(16);e=e||{};let s=e.node||i;let c=e.clockseq!==undefined?e.clockseq:a;if(s==null||c==null){const t=e.random||(e.rng||u.default)();if(s==null){s=i=[t[0]|1,t[1],t[2],t[3],t[4],t[5]]}if(c==null){c=a=(t[6]<<8|t[7])&16383}}let _=e.msecs!==undefined?e.msecs:Date.now();let p=e.nsecs!==undefined?e.nsecs:l+1;const v=_-f+(p-l)/1e4;if(v<0&&e.clockseq===undefined){c=c+1&16383}if((v<0||_>f)&&e.nsecs===undefined){p=0}if(p>=1e4){throw new Error("uuid.v1(): Can't create more than 10M uuids/sec")}f=_;l=p;a=c;_+=122192928e5;const y=((_&268435455)*1e4+p)%4294967296;d[o++]=y>>>24&255;d[o++]=y>>>16&255;d[o++]=y>>>8&255;d[o++]=y&255;const D=_/4294967296*1e4&268435455;d[o++]=D>>>8&255;d[o++]=D&255;d[o++]=D>>>24&15|16;d[o++]=D>>>16&255;d[o++]=c>>>8|128;d[o++]=c&255;for(let e=0;e<6;++e){d[o+e]=s[e]}return t||(0,n.unsafeStringify)(d)}var o=v1;t["default"]=o},364:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(858));var n=_interopRequireDefault(r(823));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}const i=(0,u.default)("v3",48,n.default);var a=i;t["default"]=a},858:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t.URL=t.DNS=void 0;t["default"]=v35;var u=r(278);var n=_interopRequireDefault(r(319));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function stringToBytes(e){e=unescape(encodeURIComponent(e));const t=[];for(let r=0;r<e.length;++r){t.push(e.charCodeAt(r))}return t}const i="6ba7b810-9dad-11d1-80b4-00c04fd430c8";t.DNS=i;const a="6ba7b811-9dad-11d1-80b4-00c04fd430c8";t.URL=a;function v35(e,t,r){function generateUUID(e,i,a,f){var l;if(typeof e==="string"){e=stringToBytes(e)}if(typeof i==="string"){i=(0,n.default)(i)}if(((l=i)===null||l===void 0?void 0:l.length)!==16){throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)")}let o=new Uint8Array(16+e.length);o.set(i);o.set(e,i.length);o=r(o);o[6]=o[6]&15|t;o[8]=o[8]&63|128;if(a){f=f||0;for(let e=0;e<16;++e){a[f+e]=o[e]}return a}return(0,u.unsafeStringify)(o)}try{generateUUID.name=e}catch(e){}generateUUID.DNS=i;generateUUID.URL=a;return generateUUID}},268:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(248));var n=_interopRequireDefault(r(806));var i=r(278);function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function v4(e,t,r){if(u.default.randomUUID&&!t&&!e){return u.default.randomUUID()}e=e||{};const a=e.random||(e.rng||n.default)();a[6]=a[6]&15|64;a[8]=a[8]&63|128;if(t){r=r||0;for(let e=0;e<16;++e){t[r+e]=a[e]}return t}return(0,i.unsafeStringify)(a)}var a=v4;t["default"]=a},777:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(858));var n=_interopRequireDefault(r(424));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}const i=(0,u.default)("v5",80,n.default);var a=i;t["default"]=a},279:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(417));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function validate(e){return typeof e==="string"&&u.default.test(e)}var n=validate;t["default"]=n},265:(e,t,r)=>{"use strict";Object.defineProperty(t,"__esModule",{value:true});t["default"]=void 0;var u=_interopRequireDefault(r(279));function _interopRequireDefault(e){return e&&e.__esModule?e:{default:e}}function version(e){if(!(0,u.default)(e)){throw TypeError("Invalid UUID")}return parseInt(e.slice(14,15),16)}var n=version;t["default"]=n},113:e=>{"use strict";e.exports=require("crypto")}};var t={};function __nccwpck_require__(r){var u=t[r];if(u!==undefined){return u.exports}var n=t[r]={exports:{}};var i=true;try{e[r](n,n.exports,__nccwpck_require__);i=false}finally{if(i)delete t[r]}return n.exports}if(typeof __nccwpck_require__!=="undefined")__nccwpck_require__.ab=__dirname+"/";var r=__nccwpck_require__(930);module.exports=r})();