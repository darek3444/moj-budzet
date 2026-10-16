// Generuje fikcyjną "Listę transakcji" w układzie PDF z ING – do prezentacji importu.
// Użycie: node demo/generuj-demo.mjs  →  demo/lista-transakcji-demo.html (+ PDF przez Chrome)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const KATALOG = path.dirname(new URL(import.meta.url).pathname);
const WLASCICIEL = ['JAN PRZYKŁADOWY', 'UL. TESTOWA 1/2', '00-001 WARSZAWA'];
const KONTA = {
  'KONTO Mobi 18-26': { nr: '00 1111 2222 3333 4444 5555 6666', saldo: 3412.58 },
  'Smart Saver': { nr: '00 1111 2222 3333 4444 5555 7777', saldo: 186.40 },
  'Otwarte Konto Oszczędnościowe': { nr: '00 1111 2222 3333 4444 5555 8888', saldo: 8250.00 },
};
const KARTA = 'Nr karty 1234xx5678';
const MOBI = 'KONTO Mobi 18-26';

let ziarno = 7;
const losowa = () => (ziarno = (ziarno * 16807) % 2147483647) / 2147483647;
const nrTr = () => '20262' + Array.from({ length: 13 }, () => Math.floor(losowa() * 10)).join('');
const kwotaTxt = k => `${k < 0 ? '-' : ''}${Math.abs(k).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).replace(/ /g, ' ')} PLN`;
const nrBez = nr => nr.replace(/\s/g, '');

const karta = (data, [nazwa, miasto], kwota) => ({
  data, kontrahent: [nazwa, miasto, '1915031/19730'], tytul: ['Płatność kartą', data, KARTA],
  szczegoly: ['<b>TR.KART</b>', `<b>Nr tr.:</b> ${nrTr()}`], kwota: -kwota, konto: MOBI,
});
const blik = (data, [nazwa, adres, miasto, domena], kwota) => ({
  data, kontrahent: [nazwa, adres, miasto], tytul: [`Płatność BLIK ${data}`, 'Nr transakcji', String(9500000000 + Math.floor(losowa() * 99999999)), domena],
  szczegoly: ['<b>TR.BLIK</b>', `<b>Nr tr.:</b> ${nrTr()}`], kwota: -kwota, konto: MOBI,
});
const przelew = (data, kontrahent, tytul, kwota) => ({
  data, kontrahent: [...kontrahent, 'Bank Przykładowy S.A.'], tytul,
  szczegoly: [kwota > 0 ? '<b>PRZELEW</b>' : '<b>PZ</b>', `<b>Nr tr.:</b> ${nrTr()}`], kwota, konto: MOBI,
});
const wlasneKonto = konto => [...WLASCICIEL, nrBez(KONTA[konto].nr), 'ING Bank Śląski S.A.'];
const przelewWlasny = (data, z, na, kwota) => {
  const nr = nrTr();
  return [
    { data, kontrahent: wlasneKonto(z), tytul: ['Przelew własny'], szczegoly: ['<b>PRZELEW</b>', `<b>Nr tr.:</b> ${nr}`], kwota, konto: na },
    { data, kontrahent: wlasneKonto(na), tytul: ['Przelew własny'], szczegoly: ['<b>PRZELEW</b>', `<b>Nr tr.:</b> ${nr}`], kwota: -kwota, konto: z },
  ];
};
const smartSaver = (data, dataZakupu, zakup, kwota) => {
  const nr = nrTr();
  const tytul = ['przelew Smart Saver', 'Płatność kartą', dataZakupu, KARTA, `Kwota: ${kwotaTxt(zakup)}`];
  return [
    { data, kontrahent: wlasneKonto(MOBI), tytul, szczegoly: [`<b>Nr tr.:</b> ${nr}`], kwota, konto: 'Smart Saver' },
    { data, kontrahent: wlasneKonto('Smart Saver'), tytul, szczegoly: [`<b>Nr tr.:</b> ${nr}`], kwota: -kwota, konto: MOBI },
  ];
};
const odsetki = (data, konto, brutto) => {
  const podatek = Math.round(brutto * 0.19 * 100) / 100;
  const bank = ['ING BANK ŚLĄSKI S.A.', 'UL.SOKOLSKA 34', '40-086 KATOWICE'];
  return [
    { data, kontrahent: [...bank, '5530045\\'], tytul: ['OBC.PODATEK OD ODSET'], szczegoly: ['<b>PRZELEW</b>', `<b>Nr tr.:</b> ${nrTr()}`], kwota: -podatek, konto },
    { data, kontrahent: [...bank, '2795996\\'], tytul: ['NALICZONE ODSETKI'], szczegoly: ['<b>PRZELEW</b>', `<b>Nr tr.:</b> ${nrTr()}`], kwota: brutto, konto },
  ];
};

// Od najnowszej, jak w oryginale
const transakcje = [
  blik('30.09.2026', ['Uber', 'Meester Treublaan 7', 'Amsterdam', 'uber.com'], 27.40),
  ...smartSaver('30.09.2026', '28.09.2026', 87.36, 2.64),
  karta('29.09.2026', ['BIEDRONKA 3105', 'WARSZAWA'], 87.36),
  karta('29.09.2026', ['NETFLIX.COM', 'Amsterdam'], 43.00),
  przelew('28.09.2026', ['PGE OBRÓT S.A.', 'UL. 8-GO MARCA 6', '35-959 RZESZÓW', '00999988887777666655554444'], ['Faktura 09/2026', 'energia elektryczna'], -164.20),
  karta('27.09.2026', ['MULTIKINO ZLOTE TARASY', 'WARSZAWA'], 68.00),
  karta('27.09.2026', ['PIZZERIA NAPOLI', 'WARSZAWA'], 94.50),
  ...przelewWlasny('26.09.2026', 'Otwarte Konto Oszczędnościowe', MOBI, 500),
  karta('26.09.2026', ['ZALANDO SE', 'Berlin'], 249.99),
  karta('25.09.2026', ['ROSSMANN 214', 'WARSZAWA'], 46.87),
  karta('25.09.2026', ['ZABKA Z1234 K.1', 'WARSZAWA'], 18.49),
  blik('24.09.2026', ['Bolt', 'Vana-Lõuna 15', 'Tallinn', 'bolt.eu'], 19.90),
  karta('24.09.2026', ['LIDL UL. PULAWSKA', 'WARSZAWA'], 132.14),
  karta('23.09.2026', ['APTEKA DBAM O ZDROWIE', 'WARSZAWA'], 38.60),
  karta('22.09.2026', ['ORLEN STACJA NR 4021', 'WARSZAWA'], 210.35),
  karta('22.09.2026', ['SPOTIFY P2C4B7', 'Stockholm'], 23.99),
  ...smartSaver('21.09.2026', '19.09.2026', 54.20, 0.80),
  karta('20.09.2026', ['EMPIK MARKETPLACE', 'WARSZAWA'], 59.99),
  blik('19.09.2026', ['Glovo', 'Calle Llull 108', 'Barcelona', 'glovoapp.com'], 54.20),
  karta('18.09.2026', ['UDEMY ONLINE COURSES', 'San Francisco'], 49.99),
  karta('17.09.2026', ['BIEDRONKA 3105', 'WARSZAWA'], 112.48),
  przelew('15.09.2026', ['KLIENT TESTOWY SP. Z O.O.', 'UL. PRZYKŁADOWA 10', '31-000 KRAKÓW', '00888877776666555544443333'], ['FV 14/09/2026', 'projekt strony www'], 1200.00),
  karta('14.09.2026', ['ORANGE POLSKA', 'WARSZAWA'], 65.00),
  karta('13.09.2026', ['CARREFOUR EXPRESS', 'WARSZAWA'], 41.27),
  karta('12.09.2026', ['DECATHLON WARSZAWA', 'WARSZAWA'], 189.90),
  ...przelewWlasny('11.09.2026', MOBI, 'Otwarte Konto Oszczędnościowe', 1000),
  karta('10.09.2026', ['ZABKA Z1234 K.1', 'WARSZAWA'], 12.98),
  przelew('10.09.2026', ['SPÓŁDZIELNIA MIESZKANIOWA', 'TESTOWE OSIEDLE', 'UL. OGRODOWA 5', '00-002 WARSZAWA', '00777766665555444433332222'], ['Czynsz 09/2026', 'lokal 2'], -890.00),
  przelew('10.09.2026', ['ACME SOLUTIONS SP. Z O.O.', 'UL. FIRMOWA 21', '00-950 WARSZAWA', '00666655554444333322221111'], ['Wynagrodzenie za 08/2026'], 6450.00),
  karta('06.09.2026', ['KAUFLAND 0412', 'WARSZAWA'], 154.62),
  karta('04.09.2026', ['RESTAURACJA BISTRO 12', 'WARSZAWA'], 76.00),
  karta('02.09.2026', ['JAKDOJADE BILET', 'WARSZAWA'], 110.00),
  ...odsetki('01.09.2026', 'Otwarte Konto Oszczędnościowe', 34.38),
  ...odsetki('01.09.2026', 'Smart Saver', 0.62),
];

// Saldo po transakcji: od salda końcowego cofamy się w czasie
const saldo = Object.fromEntries(Object.entries(KONTA).map(([k, v]) => [k, v.saldo]));
for (const t of transakcje) { t.saldo = saldo[t.konto]; saldo[t.konto] = Math.round((saldo[t.konto] - t.kwota) * 100) / 100; }

const uznania = transakcje.filter(t => t.kwota > 0), obciazenia = transakcje.filter(t => t.kwota < 0);
const suma = l => l.reduce((s, t) => s + t.kwota, 0);
const linie = l => l.join('<br>');

const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Lista transakcji – DEMO</title><style>
@page { size: A4; margin: 32pt 34pt 60pt 34pt;
  @bottom-left { content: "Dokument ma charakter informacyjny, nie stanowi dowodu księgowego. Dane fikcyjne – dokument demonstracyjny.\\AStrona: " counter(page) " z " counter(pages) ". Lista transakcji"; white-space: pre; font-family: Helvetica, Arial, sans-serif; font-size: 7pt; line-height: 14pt; vertical-align: top; padding-top: 8pt; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 7pt; line-height: 8.5pt; color: #222; }
b { font-weight: 700; }
.top { display: flex; justify-content: space-between; align-items: flex-start; height: 60pt; }
.demo { font-size: 9pt; line-height: 11pt; font-weight: 700; color: #b45309; border: 1.2pt solid #b45309; border-radius: 4pt; padding: 5pt 8pt; }
.meta { text-align: right; line-height: 14pt; }
h1 { font-size: 19pt; line-height: 22pt; margin: 18pt 0 16pt; }
h2 { font-size: 10pt; line-height: 12pt; margin: 0 0 10pt; }
hr { border: 0; border-top: 0.8pt solid #ccc; margin: 0 0 16pt; }
.sekcja { display: grid; margin-bottom: 16pt; }
.g1 { grid-template-columns: 210pt 1fr; } .g2 { grid-template-columns: 210pt 153pt 1fr; }
.rachunki { display: grid; grid-template-columns: 1fr auto; column-gap: 20pt; }
.pod p { margin: 0 0 6pt; }
table { width: 100%; border-collapse: collapse; margin-top: 30pt; table-layout: fixed; }
thead { display: table-header-group; }
th { text-align: left; vertical-align: bottom; padding: 0 0 6pt; border-bottom: 1.2pt solid #222; }
td { vertical-align: middle; padding: 11pt 0; border-bottom: 0.8pt solid #ddd; }
tr { break-inside: avoid; }
.r { text-align: right; } td.r:nth-child(5), th.r:nth-child(5) { padding-right: 8pt; }
</style></head><body>
<div class="top"><div class="demo">DOKUMENT DEMONSTRACYJNY<br>dane fikcyjne – do prezentacji</div>
<div class="meta">Dokument nr: <b>0000000000_DEMO</b><br>Wygenerowany dnia: <b>08.10.2026, 12:00</b></div></div>
<h1>Lista transakcji</h1><hr>
<div class="sekcja g1"><div><h2>Dane użytkownika</h2>${linie(WLASCICIEL)}</div>
<div><h2>Wybrane rachunki</h2><div class="rachunki">${Object.entries(KONTA).map(([k, v]) => `<b>${k} (PLN)</b><span>${v.nr}</span>`).join('')}</div></div></div><hr>
<div class="sekcja g2"><div><h2>Zastosowane kryteria wyboru</h2><b>Zakres dat:</b><br>01.09.2026 - 30.09.2026</div>
<div><h2>&nbsp;</h2><b>Typy transakcji:</b><br>Wszystkie</div>
<div class="pod"><h2>Podsumowanie</h2><p><b>Liczba transakcji:</b><br>${transakcje.length}</p>
<p><b>Suma uznań (${uznania.length}):</b><br>${kwotaTxt(suma(uznania))}</p>
<p><b>Suma obciążeń (${obciazenia.length}):</b><br>${kwotaTxt(-suma(obciazenia))}</p></div></div>
<table><colgroup><col style="width:68pt"><col style="width:116pt"><col style="width:85pt"><col style="width:128pt"><col style="width:66pt"><col></colgroup>
<thead><tr><th>Data transakcji<br>/data księgow.</th><th>Dane kontrahenta</th><th>Tytuł</th><th>Szczegóły / nr transakcji</th><th class="r">Kwota</th><th class="r">Konto i saldo<br>po transakcji</th></tr></thead>
<tbody>${transakcje.map(t => `<tr><td><b>${t.data}</b><br>${t.data}</td><td>${linie(t.kontrahent)}</td><td>${linie(t.tytul)}</td><td>${linie(t.szczegoly)}</td><td class="r"><b>${kwotaTxt(t.kwota)}</b></td><td class="r">${t.konto}<br><b>${kwotaTxt(t.saldo)}</b></td></tr>`).join('')}</tbody></table>
</body></html>`;

const plikHtml = path.join(KATALOG, 'lista-transakcji-demo.html');
const plikPdf = path.join(KATALOG, 'Lista_transakcji_DEMO.pdf');
fs.writeFileSync(plikHtml, html);
execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${plikPdf}`, plikHtml], { stdio: 'ignore' });
fs.unlinkSync(plikHtml);
console.log(`${transakcje.length} transakcji → ${plikPdf}`);
console.log(`uznania ${uznania.length}: ${kwotaTxt(suma(uznania))}, obciążenia ${obciazenia.length}: ${kwotaTxt(-suma(obciazenia))}`);
