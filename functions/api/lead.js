/**
 * Purrap Packaging lead handler — Cloudflare Pages Function
 * Route: /api/lead   (the contact/quote form POSTs here)
 *
 * Replaces Shopify's native contact endpoint. Rule: NEVER fake success. Every
 * failure returns a real error page, sets X-Lead-Error, and logs. A lost lead
 * must be loud. Resend only (no silent fallback).
 *
 * !! Cloudflare edge trap: a 5xx from a Pages Function has its body+headers
 * replaced by Cloudflare's generic error page. So failures return 424.
 *
 * Env (Pages > Settings > Variables and secrets):
 *   RESEND_API_KEY (Secret), LEAD_TO, LEAD_FROM
 */

const ORIGIN = 'https://purrappackaging.com';

const FORMS = {
  quote: {
    subject: 'New quote request from PurrapPackaging.com',
    thankYou: '/thank-you',
    required: ['name', 'email', 'product'],
    autoSubject: 'Thanks for your request — Purrap Packaging',
    autoBody: (d) =>
      'Hi ' + d.name + ',\n\n' +
      'Thanks for reaching out to Purrap Packaging. We got your request and will ' +
      'reply with pricing, samples, and a free digital proof within 1 business day.\n\n' +
      'New customers get their first delivery free.\n\n' +
      'If it is urgent, call or text 978-549-5979.\n\n' +
      '- Purrap Packaging\npurrappackaging.com'
  }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s == null ? '' : s).trim());
}

function errorPage(msg, status, detail) {
  const html =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Something went wrong - Purrap Packaging</title>' +
    '<style>:root{--ink:#161616;--accent:#e8552d;--soft:#faf7f4}' +
    'body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--soft);' +
    'color:var(--ink);display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;line-height:1.6}' +
    '.box{max-width:520px;text-align:center}h1{font-size:2rem;margin:0 0 12px}p{color:#4a4a4a;margin:0 0 22px}' +
    'a.btn{display:inline-block;background:var(--accent);color:#fff;padding:14px 28px;border-radius:9px;' +
    'text-decoration:none;font-weight:700}a.inline{color:var(--accent);font-weight:700}</style></head>' +
    '<body><div class="box"><h1>That didn&rsquo;t send.</h1><p>' + esc(msg) + '</p>' +
    '<p>Nothing reached us, so please email <a class="inline" href="mailto:manny.encarnacion@purrappackaging.com">' +
    'manny.encarnacion@purrappackaging.com</a> or call/text <strong>978-549-5979</strong> ' +
    'and we&rsquo;ll pick it up from there.</p>' +
    '<a class="btn" href="' + ORIGIN + '/contact">Back to the form</a></div></body></html>';
  const headers = { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' };
  if (detail) headers['X-Lead-Error'] = String(detail).replace(/[\r\n]+/g, ' ').slice(0, 300);
  return new Response(html, { status: status, headers: headers });
}

function redirectTo(path) {
  return new Response(null, { status: 303, headers: { Location: ORIGIN + path, 'Cache-Control': 'no-store' } });
}

async function sendViaResend(env, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + text.slice(0, 200));
  return text;
}

export async function onRequestPost(context) {
  try {
    const request = context.request;
    const env = context.env || {};

    if (!env.RESEND_API_KEY || !env.LEAD_TO || !env.LEAD_FROM) {
      return errorPage('Our form is misconfigured on our end.', 424, 'missing RESEND_API_KEY / LEAD_TO / LEAD_FROM');
    }

    let data;
    try {
      const ct = request.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) data = await request.json();
      else data = Object.fromEntries(await request.formData());
    } catch (e) {
      return errorPage('We could not read that submission.', 400, 'parse: ' + e.message);
    }

    const form = FORMS[data._form] || FORMS.quote;
    const missing = form.required.filter(function (f) { return !String(data[f] == null ? '' : data[f]).trim(); });
    if (missing.length) return errorPage('Please fill in: ' + missing.join(', ') + '.', 400, 'missing: ' + missing.join(','));
    if (!isEmail(data.email)) return errorPage('That email address does not look right.', 400, 'bad email');

    const clean = {};
    Object.keys(data).forEach(function (k) { if (k.charAt(0) !== '_') clean[k] = data[k]; });

    // the notification IS the lead
    try {
      const rows = Object.keys(clean).map(function (k) {
        return '<tr><td style="padding:8px 14px;border:1px solid #e6e3df;font-weight:700;text-transform:capitalize">' +
          esc(k) + '</td><td style="padding:8px 14px;border:1px solid #e6e3df">' + esc(clean[k]) + '</td></tr>';
      }).join('');
      await sendViaResend(env, {
        from: env.LEAD_FROM, to: [env.LEAD_TO], reply_to: String(data.email).trim(),
        subject: form.subject,
        html: '<div style="font-family:system-ui,sans-serif;color:#161616">' +
          '<h2>New quote request</h2><table style="border-collapse:collapse;margin:16px 0">' + rows + '</table>' +
          '<p style="color:#6b6b6b;font-size:12px">' + esc(new Date().toISOString()) + '</p></div>'
      });
    } catch (e) {
      console.error('lead: NOTIFICATION FAILED', e && e.message);
      return errorPage('We could not deliver your message just now.', 424, e && e.message);
    }

    // autoresponse — courtesy only, never blocks the lead
    try {
      await sendViaResend(env, {
        from: env.LEAD_FROM, to: [String(data.email).trim()], reply_to: env.LEAD_TO,
        subject: form.autoSubject, text: form.autoBody(data)
      });
    } catch (e) {
      console.error('lead: AUTORESPONSE FAILED (lead still captured)', e && e.message);
    }

    return redirectTo(form.thankYou);
  } catch (e) {
    console.error('lead: UNHANDLED', e && e.stack);
    return errorPage('Something broke on our end.', 424, 'unhandled: ' + (e && e.message));
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get('selftest') === '1') {
    const env = context.env || {};
    if (!env.RESEND_API_KEY || !env.LEAD_TO || !env.LEAD_FROM)
      return new Response('SELFTEST FAIL: missing RESEND_API_KEY / LEAD_TO / LEAD_FROM', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    try {
      const out = await sendViaResend(env, { from: env.LEAD_FROM, to: [env.LEAD_TO], subject: 'Purrap lead endpoint self-test', text: 'Self-test OK at ' + new Date().toISOString() });
      return new Response('SELFTEST OK: ' + out, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } catch (e) {
      return new Response('SELFTEST FAIL: ' + (e && e.message), { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
  }
  return new Response('Purrap lead endpoint is alive. POST only.', { status: 405, headers: { 'Content-Type': 'text/plain', Allow: 'POST' } });
}
