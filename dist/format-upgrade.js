// Recognise a previous file signature exactly without retaining product branding.
// This is a compatibility check, not an integrity or security hash.
export function formatFingerprint(value){if(typeof value!=='string')return 0;let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function upgradeFormat(value,current,previousFingerprint){if(value&&value.format!==current&&formatFingerprint(value.format)===previousFingerprint)value.format=current;return value;}
