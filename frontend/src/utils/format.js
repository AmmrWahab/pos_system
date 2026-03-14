// src/utils/format.js
export const fmt = (n) => `RS ${Number(n || 0).toLocaleString()}`;

export const fmtDate = (d) =>
  new Date(d).toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const genSku = (prefix = 'SKU') =>
  `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
