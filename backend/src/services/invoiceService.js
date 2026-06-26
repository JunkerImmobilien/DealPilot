'use strict';
/*
 * invoiceService.js (v776) — Rechnungs-Archiv.
 * - recordFromStripeInvoice(invoice): zieht invoice_pdf, legt Metadaten + PDF in DB (idempotent).
 * - listInvoices / getPdf / listForCsv: für den Admin-Reiter "Rechnungen".
 * Resilient: scheitert der PDF-Download, wird der Datensatz trotzdem (ohne PDF) angelegt.
 */
const https = require('https');
const { query } = require('../db/pool');
const subscriptionService = require('./subscriptionService');

function _downloadBuffer(url, depth) {
  depth = depth || 0;
  return new Promise(function (resolve) {
    if (!url || depth > 3) return resolve(null);
    try {
      https.get(url, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(_downloadBuffer(res.headers.location, depth + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () { resolve(Buffer.concat(chunks)); });
      }).on('error', function () { resolve(null); });
    } catch (e) { resolve(null); }
  });
}

async function recordFromStripeInvoice(inv) {
  if (!inv || !inv.id) return { skipped: true, reason: 'no invoice' };

  const exists = await query('SELECT id FROM invoices WHERE stripe_invoice_id = $1', [inv.id]);
  if (exists.rowCount > 0) return { skipped: true, reason: 'exists' };

  let userId = null;
  try {
    if (inv.customer) userId = await subscriptionService.findUserByStripeCustomerId(inv.customer);
  } catch (e) { /* kein User zuordenbar -> user_id bleibt NULL */ }

  const pdfBuf = await _downloadBuffer(inv.invoice_pdf);
  const invoiceDate = inv.created ? new Date(inv.created * 1000) : new Date();

  await query(
    `INSERT INTO invoices
       (user_id, stripe_invoice_id, stripe_customer_id, invoice_number, amount_total,
        currency, status, hosted_invoice_url, pdf_data, invoice_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (stripe_invoice_id) DO NOTHING`,
    [
      userId, inv.id, inv.customer || null, inv.number || null,
      (typeof inv.total === 'number' ? inv.total : null), inv.currency || 'eur',
      inv.status || null, inv.hosted_invoice_url || null, pdfBuf, invoiceDate
    ]
  );
  return { recorded: true, hadPdf: !!pdfBuf };
}

function _rangeWhere(from, to, params, alias) {
  alias = alias || 'i';
  const where = [];
  if (from) { params.push(from); where.push(alias + '.invoice_date >= $' + params.length); }
  if (to)   { params.push(to);   where.push(alias + '.invoice_date <= $' + params.length); }
  return where;
}

async function listInvoices(opts) {
  opts = opts || {};
  const params = [];
  const where = _rangeWhere(opts.from, opts.to, params);
  if (opts.q) {
    params.push('%' + opts.q + '%');
    where.push('(i.invoice_number ILIKE $' + params.length + ' OR u.email ILIKE $' + params.length + ')');
  }
  const wsql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  params.push(opts.limit || 200); const lim = '$' + params.length;
  params.push(opts.offset || 0);  const off = '$' + params.length;
  const r = await query(
    `SELECT i.id, i.invoice_number, i.amount_total, i.currency, i.status,
            i.hosted_invoice_url, i.invoice_date, (i.pdf_data IS NOT NULL) AS has_pdf,
            u.email AS user_email
       FROM invoices i LEFT JOIN users u ON u.id = i.user_id
       ${wsql}
      ORDER BY i.invoice_date DESC
      LIMIT ${lim} OFFSET ${off}`,
    params
  );
  return r.rows;
}

async function getPdf(id) {
  const r = await query('SELECT invoice_number, pdf_data FROM invoices WHERE id = $1', [id]);
  if (r.rowCount === 0 || !r.rows[0].pdf_data) return null;
  return { number: r.rows[0].invoice_number, data: r.rows[0].pdf_data };
}

async function listForCsv(opts) {
  opts = opts || {};
  const params = [];
  const where = _rangeWhere(opts.from, opts.to, params);
  const wsql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const r = await query(
    `SELECT i.invoice_number, i.invoice_date, i.amount_total, i.currency, i.status, u.email AS user_email
       FROM invoices i LEFT JOIN users u ON u.id = i.user_id
       ${wsql}
      ORDER BY i.invoice_date DESC`,
    params
  );
  return r.rows;
}

module.exports = { recordFromStripeInvoice, listInvoices, getPdf, listForCsv };
