// Generuje fikcyjne "Elektroniczne zestawienie operacji" z mBanku (CSV, windows-1250) – do prezentacji importu.
// Użycie: node demo/generuj-demo-mbank.mjs  →  demo/mbank_demo_260901_260930.csv
import fs from 'fs';
import path from 'path';

const KATALOG = path.dirname(new URL(import.meta.url).pathname);
const SALDO_POCZATKOWE = 2840.15;

const kwotaTxt = k => k.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).replace(/ /g, ' ');
const dopelnij = (s, n) => s.padEnd(n, ' ');

const karta = (data, dataZakupu, nazwa, miasto, kwota) => [data, 'ZAKUP PRZY UŻYCIU KARTY',
  `${dopelnij(nazwa, 19)}/${dopelnij(miasto, 51)}DATA TRANSAKCJI: ${dataZakupu}`, '  ', '', -kwota];
const blikOd = (data, od, kwota) => [data, 'BLIK P2P-PRZYCHODZĄCY',
  `Przelew na telefon +48xxxxxx123    Przelew na telefon                 Dla Jan Przykładowy                 Od ${od}`, '  ', '', kwota];
const blikDo = (data, tytul, kwota) => [data, 'BLIK P2P-WYCHODZĄCY', tytul, '  ', '', -kwota];
const eCommerce = (data, sklep, kwota) => [data, kwota > 0 ? 'BLIK KOR. ZAKUPU E-COMMERCE' : 'BLIK ZAKUP E-COMMERCE', sklep, '  ', '', kwota];
const przelew = (data, tytul, kontrahent, konto, kwota) => [data, kwota > 0 ? 'PRZELEW ZEWNĘTRZNY PRZYCHODZĄCY' : 'PRZELEW ZEWNĘTRZNY WYCHODZĄCY', tytul, `${kontrahent}  `, konto, kwota];

const operacje = [
  karta('2026-09-01', '2026-08-30', 'UBER   *EATS', 'HELP.UBER.', 72.40),
  przelew('2026-09-01', 'Wynagrodzenie 08/2026', 'ACME SOLUTIONS SP. Z O.O. UL. FIRMOWA 21 00-950 WARSZAWA', '00105000001000000012345678', 6450.00),
  karta('2026-09-02', '2026-09-01', 'Revolut**1234*', 'Dublin', 400.00),
  karta('2026-09-02', '2026-09-01', 'JMP S.A. BIEDRONKA', 'WARSZAWA', 96.32),
  przelew('2026-09-03', 'OPŁATY TESTOWA 1/2', 'WSPÓLNOTA MIESZKANIOWA TESTOWA 1', '00175000001000000099998888', -820.00),
  karta('2026-09-04', '2026-09-03', 'ZABKA Z1234 K.1', 'WARSZAWA', 21.47),
  blikDo('2026-09-05', 'ZA BILETY NA KONCERT', 120.00),
  karta('2026-09-05', '2026-09-04', 'ORLEN STACJA 4021', 'WARSZAWA', 198.60),
  karta('2026-09-06', '2026-09-05', 'NETFLIX.COM', 'Amsterdam', 43.00),
  blikOd('2026-09-07', 'ANNA NOWAK', 58.00),
  karta('2026-09-08', '2026-09-06', 'LIDL PULAWSKA', 'WARSZAWA', 143.85),
  karta('2026-09-09', '2026-09-08', 'PayU*rossmann.pl', 'Lodz', 64.21),
  eCommerce('2026-09-10', 'INTERCITY.PL', -89.00),
  przelew('2026-09-11', '229757000001', 'E.ON POLSKA S.A. UL. WYBRZEŻE KOŚCIUSZKOWSKIE 41 00-347 WARSZAWA', '00124000001000000077776666', -184.30),
  karta('2026-09-12', '2026-09-11', 'APTEKA DBAM O ZDROW', 'WARSZAWA', 37.90),
  karta('2026-09-13', '2026-09-12', 'MULTIKINO ARKADIA', 'WARSZAWA', 62.00),
  karta('2026-09-14', '2026-09-12', 'UBER   *EATS', 'HELP.UBER.', 58.15),
  przelew('2026-09-15', 'FV 14/09/2026 projekt strony', 'KLIENT TESTOWY SP. Z O.O. UL. PRZYKŁADOWA 10 31-000 KRAKÓW', '00109000001000000055554444', 1200.00),
  karta('2026-09-15', '2026-09-14', 'SPOTIFY P2C4B7', 'Stockholm', 23.99),
  karta('2026-09-16', '2026-09-15', 'DECATHLON', 'WARSZAWA', 179.98),
  karta('2026-09-17', '2026-09-16', 'JMDIF SP.Z.O.O. HEB', 'WARSZAWA', 45.98),
  eCommerce('2026-09-18', 'ALLEGRO.PL', -249.00),
  karta('2026-09-19', '2026-09-18', 'Revolut**1234*', 'Dublin', 200.00),
  karta('2026-09-19', '2026-09-18', 'PIZZERIA NAPOLI', 'WARSZAWA', 88.50),
  blikOd('2026-09-20', 'PIOTR KOWALCZYK', 45.00),
  karta('2026-09-21', '2026-09-19', 'MEDIA EXPERT', 'WARSZAWA', 129.99),
  karta('2026-09-22', '2026-09-21', 'ZABKA Z1234 K.1', 'WARSZAWA', 16.98),
  karta('2026-09-23', '2026-09-22', 'MAXI ZOO', 'WARSZAWA', 112.40),
  karta('2026-09-24', '2026-09-23', 'UBER   *ONE MEMBERS', 'AMSTERDAM', 12.99),
  karta('2026-09-25', '2026-09-24', 'KAUFLAND 0412', 'WARSZAWA', 167.23),
  eCommerce('2026-09-26', 'INTERCITY.PL', 22.00),
  karta('2026-09-27', '2026-09-25', 'APPLE.COM/BILL', 'APPLE.COM/', 9.99),
  przelew('2026-09-28', 'Polisa OC 2026/09', 'PZU SA AL. JANA PAWŁA II 24 00-133 WARSZAWA', '00116000001000000033332222', -96.00),
  karta('2026-09-29', '2026-09-28', 'JMP S.A. BIEDRONKA', 'WARSZAWA', 74.86),
  eCommerce('2026-09-30', 'POLREGIO SPOLKA AKCYJNA', -19.40),
  karta('2026-09-30', '2026-09-29', 'ORANGE POLSKA', 'WARSZAWA', 65.00),
];

let saldo = SALDO_POCZATKOWE;
const wiersze = operacje.map(([data, rodzaj, tytul, kontrahent, konto, kwota]) => {
  saldo = Math.round((saldo + kwota) * 100) / 100;
  return `${data};${data};${rodzaj};"${tytul}";"${kontrahent}";'${konto}';${kwotaTxt(kwota)};${kwotaTxt(saldo)};`;
});
const uznania = operacje.filter(o => o[5] > 0), obciazenia = operacje.filter(o => o[5] < 0);
const suma = l => l.reduce((s, o) => s + o[5], 0);

const csv = [
  'mBank S.A. Bankowość Detaliczna;', '\t\tSkrytka Pocztowa 2108;', '\t\t90-959 Łódź 2;', '\t\twww.mBank.pl;', '\t\tmLinia: 801 300 800;', '\t\t+48 (42) 6 300 800;', '\t\t', '',
  '#Klient;', 'JAN PRZYKŁADOWY;', '', 'Elektroniczne zestawienie operacji;', '',
  '#Za okres:;', '01.09.2026;30.09.2026;', '#Rodzaj rachunku;', 'EKONTO;', '#Waluta;', 'PLN;',
  '#Numer rachunku;', '00 1140 0000 0000 0000 0000 0000;', '#Data następnej kapitalizacji;', '2026-10-31;',
  '#Oprocentowanie rachunku;', '0,00%;', '#Limit kredytu;', '0,00 PLN;', '#Oprocentowanie kredytu;', '0,00%;', '',
  '#Podsumowanie obrotów na rachunku;#Liczba operacji;#Wartość operacji',
  `Uznania;${uznania.length};${kwotaTxt(suma(uznania))} PLN;`,
  `Obciążenia;${obciazenia.length};${kwotaTxt(-suma(obciazenia))} PLN;`,
  `Łącznie;${operacje.length};${kwotaTxt(suma(operacje))} PLN;`, '',
  `#Saldo początkowe;${kwotaTxt(SALDO_POCZATKOWE)} PLN;`, '',
  '#Data księgowania;#Data operacji;#Opis operacji;#Tytuł;#Nadawca/Odbiorca;#Numer konta;#Kwota;#Saldo po operacji;',
  ...wiersze, '', '',
  `;;;;;;#Saldo końcowe;${kwotaTxt(saldo)} PLN;`, '',
  'DOKUMENT DEMONSTRACYJNY – dane fikcyjne, przygotowane do prezentacji aplikacji Mój Budżet.',
].join('\r\n');

// mBank eksportuje w windows-1250 – kodujemy polskie znaki ręcznie (Node nie ma tego kodowania w TextEncoder)
const CP1250 = { 'ą': 0xb9, 'ć': 0xe6, 'ę': 0xea, 'ł': 0xb3, 'ń': 0xf1, 'ó': 0xf3, 'ś': 0x9c, 'ź': 0x9f, 'ż': 0xbf,
  'Ą': 0xa5, 'Ć': 0xc6, 'Ę': 0xca, 'Ł': 0xa3, 'Ń': 0xd1, 'Ó': 0xd3, 'Ś': 0x8c, 'Ź': 0x8f, 'Ż': 0xaf, '–': 0x96 };
const bajty = Buffer.from([...csv].map(z => CP1250[z] ?? (z.charCodeAt(0) < 128 ? z.charCodeAt(0) : 0x3f)));

const plik = path.join(KATALOG, 'mbank_demo_260901_260930.csv');
fs.writeFileSync(plik, bajty);
console.log(`${operacje.length} operacji → ${plik}`);
console.log(`uznania ${uznania.length}: ${kwotaTxt(suma(uznania))}, obciążenia ${obciazenia.length}: ${kwotaTxt(-suma(obciazenia))}`);
