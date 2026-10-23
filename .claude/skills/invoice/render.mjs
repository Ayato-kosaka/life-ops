#!/usr/bin/env node
// 請求書JSON → PDF
//   node .claude/skills/invoice/render.mjs <invoice.json> [--out <file.pdf>] [--html <file.html>]
// 金額の計算（小計・消費税・合計）と日付の整形はここで行う。JSON側には入力値だけを書く。
// データ形式は同じディレクトリの example.json を参照。

import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// ---------- 計算 ----------

const roundFns = { round: Math.round, floor: Math.floor, ceil: Math.ceil };

function lineAmount(line) {
  if (line.amount != null) return line.amount;
  return Math.round((line.qty ?? 1) * line.unitPrice);
}

// itemsTaxIncluded=true のとき、明細の単価は税込。表示用に税抜へ換算し、
// 消費税は「税込合計 − 税抜小計」として、取り決めた税込金額に必ず一致させる。
export function normalizeItems(inv) {
  if (!inv.itemsTaxIncluded) return inv;
  const div = 1 + (inv.taxRate ?? 0.1);
  const items = inv.items.map((l) => {
    const incl = lineAmount(l);
    return { ...l, unitPrice: Math.round((l.unitPrice ?? incl) / div), amount: Math.round(incl / div), amountTaxIncluded: incl };
  });
  return { ...inv, items };
}

export function computeTotals(inv) {
  const taxRate = inv.taxRate ?? 0.1;
  const round = roundFns[inv.taxRounding ?? "round"];
  const subtotal = inv.items.reduce((s, l) => s + lineAmount(l), 0);
  const tax = inv.itemsTaxIncluded
    ? inv.items.reduce((s, l) => s + l.amountTaxIncluded, 0) - subtotal
    : round(subtotal * taxRate);
  const itemsTotal = subtotal + tax;
  const expensesTotal = (inv.expenses ?? []).reduce((s, l) => s + lineAmount(l), 0);
  return { taxRate, subtotal, tax, itemsTotal, expensesTotal, total: itemsTotal + expensesTotal };
}

// ---------- 整形 ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const yen = (n) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const WEEKDAYS = "日月火水木金土";

function jpDate(iso, { weekday = false } = {}) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日${weekday ? `（${wd}）` : ""}`;
}

const qtyLabel = (l) => `${l.qty ?? 1}${l.unit ?? "式"}`;

function lineRows(lines, startNo) {
  return lines
    .map(
      (l, i) => `
      <tr class="line">
        <td class="c">${startNo + i}</td>
        <td class="desc">${esc(l.description)}</td>
        <td class="c">${esc(qtyLabel(l))}</td>
        <td class="r">${yen(l.unitPrice ?? lineAmount(l))}</td>
        <td class="r">${yen(lineAmount(l))}</td>
      </tr>`,
    )
    .join("");
}

function buildHtml(inv, t, css) {
  const { client, issuer, bank } = inv;
  const pct = Math.round(t.taxRate * 100);
  const expenses = inv.expenses ?? [];
  const notes = inv.notes ?? [];
  const lines = (arr) => arr.filter(Boolean).map((s) => esc(s)).join("<br>");

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>請求書 ${esc(inv.number)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=block">
<style>${css}</style>
</head><body>
<header class="title">
  <h1>請 求 書</h1>
  <div class="en">INVOICE</div>
</header>

<table class="meta">
  <tr><th>請求書番号：</th><td>${esc(inv.number)}</td></tr>
  <tr><th>請求日：</th><td>${jpDate(inv.issueDate)}</td></tr>
</table>

<section class="parties">
  <div class="party">
    <div class="label">ご請求先</div>
    ${client.company ? `<div class="client-company">${esc(client.company)}</div>` : ""}
    ${client.person ? `<div class="client-person">${esc(client.person)}</div>` : ""}
    <div class="small">${lines([client.postalCode ? `〒${client.postalCode}` : "", client.address])}</div>
  </div>
  <div class="party">
    <div class="label">請求元</div>
    <div class="issuer-name">${esc(issuer.name)}</div>
    <div class="small">${lines([issuer.postalCode ? `〒${issuer.postalCode}` : "", issuer.address, issuer.email, issuer.tel])}</div>
    ${issuer.registrationNumber
      ? `<div class="small">登録番号：${esc(issuer.registrationNumber)}</div>`
      : `<div class="note">適格請求書発行事業者ではありません</div>`}
  </div>
</section>

<table class="amount">
  <tr><th>ご請求金額（税込）</th><td>${yen(t.total)}</td></tr>
</table>

<table class="subject">
  <tr><th>件名</th><td>${esc(inv.subject)}</td></tr>
</table>

<table class="lines">
  <colgroup><col style="width:6.3%"><col style="width:50.5%"><col style="width:11.6%"><col style="width:15.8%"><col style="width:15.8%"></colgroup>
  <thead><tr><th>No.</th><th>内容</th><th>数量</th><th>単価</th><th>金額</th></tr></thead>
  <tbody>
    ${lineRows(inv.items, 1)}
    ${t.taxRate > 0
      ? `<tr class="sum"><td colspan="4">小計</td><td>${yen(t.subtotal)}</td></tr>
    <tr class="sum"><td colspan="4">消費税（${pct}%）</td><td>${yen(t.tax)}</td></tr>`
      : ""}
    <tr class="sum strong"><td colspan="4">${esc(inv.itemsTotalLabel ?? "計（税込）")}</td><td>${yen(t.itemsTotal)}</td></tr>
  </tbody>
  ${expenses.length
    ? `<tbody>
    <tr class="spacer"><td colspan="5"></td></tr>
    <tr class="section"><td colspan="5">${esc(inv.expensesLabel ?? "立替経費（実費精算・税込・消費税の課税対象外）")}</td></tr>
    ${lineRows(expenses, inv.items.length + 1)}
    <tr class="sum strong"><td colspan="4">立替経費 計</td><td>${yen(t.expensesTotal)}</td></tr>
  </tbody>`
    : ""}
  <tbody>
    <tr class="spacer"><td colspan="5"></td></tr>
    <tr class="grand"><td colspan="4">合計　ご請求金額</td><td>${yen(t.total)}</td></tr>
  </tbody>
</table>

<table class="info">
  <colgroup><col style="width:6.3%"><col></colgroup>
  <tr class="section"><td colspan="2">お支払条件</td></tr>
  <tr><th>支払期日</th><td>${jpDate(inv.dueDate, { weekday: true })}${inv.dueNote ? `　${esc(inv.dueNote)}` : ""}</td></tr>
  <tr><th>振込先</th><td>${esc(bank.bankName)}（${esc(bank.branch)}）　${esc(bank.accountType ?? "普通")}　${esc(bank.accountNumber)}<br>名義：${esc(bank.accountHolder)}</td></tr>
</table>

${notes.length
  ? `<table class="info notes">
  <tr class="section"><td>備考</td></tr>
  ${notes.map((n) => `<tr><td>・${esc(n)}</td></tr>`).join("")}
</table>`
  : ""}
</body></html>`;
}

// ---------- PDF ----------

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // グローバルインストールされた playwright を探す
    const root = execSync("npm root -g").toString().trim();
    return import(pathToFileURL(join(root, "playwright", "index.mjs")).href);
  }
}

async function toPdf(html, out) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: out, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" } });
  } finally {
    await browser.close();
  }
}

// ---------- main ----------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opts = {};
  let src;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) opts[args[i].slice(2)] = args[++i];
    else src ??= args[i];
  }
  const opt = (k) => opts[k];
  if (!src) {
    console.error("usage: render.mjs <invoice.json> [--out <file.pdf>] [--html <file.html>]");
    process.exit(2);
  }
  const raw = JSON.parse(await readFile(src, "utf8"));
  for (const key of ["number", "issueDate", "dueDate", "subject", "client", "issuer", "bank", "items"]) {
    if (raw[key] == null) throw new Error(`invoice.${key} がありません`);
  }
  const inv = normalizeItems(raw);
  const totals = computeTotals(inv);
  const html = buildHtml(inv, totals, await readFile(join(here, "style.css"), "utf8"));
  const out = opt("out") ?? src.replace(/\.json$/, "") + ".pdf";
  if (opt("html")) await writeFile(opt("html"), html);
  await toPdf(html, out);
  console.log(JSON.stringify({ pdf: out, totals }, null, 2));
}
