// Builds the tail of the frequency dictionary, src/data/freq.txt, from lists kept in a folder:
//
//   node scripts/gen-freq.mjs <folder>
//
// The first HEAD words of the file are kept as they are, so the places that people hold in the
// course (and every saved position) do not move. After them come TAIL more words, taken from the
// words that are in both of two public lists, ordered by how high they stand in both:
//   20k.txt    https://github.com/first20hours/google-10000-english (20k.txt), words by how often
//              they are written on the web
//   subs.txt   https://github.com/hermitdave/FrequencyWords (content/2018/en/en_50k.txt), words
//              by how often they are said in films and series, as "word count" lines
// and kept only if they are
//   alpha.txt  in a list of English words (https://github.com/dwyl/english-words, words_alpha.txt)
// and are not
//   bad.txt    obscene (https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words, en)
//   first.txt  a first name (https://github.com/dominictarr/random-name, first-names.txt)
//   or an abbreviation or a web word on the short list below.
// The lists are only read here; none of their text goes into the app, only the order of the words.
//
// The counts of the tail follow the Zipf curve out of the last word of the head, as the lists
// have no counts on the same scale: a word at rank r has HEAD_F * (HEAD / r) ** ALPHA per million
// (written times 100, as in the rest of the file).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HEAD = 5000;
const TAIL = 5000;
const ALPHA = 1.1;
const FILE = 'src/data/freq.txt';

const dir = process.argv[2];
if (!dir) {
  console.error(
    'usage: node scripts/gen-freq.mjs <folder with 20k.txt subs.txt alpha.txt bad.txt first.txt>',
  );
  process.exit(1);
}
const lines = (name) =>
  readFileSync(join(dir, name), 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

const OUT = new Set(
  (
    'mon tue wed thu fri sat sun jan feb mar apr jun jul aug sep sept oct nov dec pics faq tel est deg ' +
    'www com org net html http https url blog blogs wiki forums forum login logout email emails ' +
    'download downloads upload uploads username password website websites online offline homepage ' +
    'sitemap newsletter newsletters subscribe unsubscribe cookies cookie hosting webcam webcams ' +
    'poker casino casinos gambling jewelry viagra cialis'
  ).split(' '),
);

const current = readFileSync(FILE, 'utf8').split('|');
const head = current.slice(0, HEAD);
if (head.length < HEAD) throw new Error('the dictionary has fewer than ' + HEAD + ' words');
const have = new Set(head.map((s) => s.slice(0, s.lastIndexOf(' '))));
const headF = +head[HEAD - 1].slice(head[HEAD - 1].lastIndexOf(' ') + 1);

const google = new Map(lines('20k.txt').map((w, i) => [w, i + 1]));
const subs = new Map(lines('subs.txt').map((l, i) => [l.split(' ')[0], i + 1]));
const alpha = new Set(lines('alpha.txt'));
const bad = new Set(lines('bad.txt').map((s) => s.toLowerCase()));
const first = new Set(lines('first.txt').map((s) => s.toLowerCase()));

const pick = [...google.keys()]
  .filter(
    (w) =>
      !have.has(w) &&
      /^[a-z]{3,}$/.test(w) &&
      subs.has(w) &&
      alpha.has(w) &&
      !bad.has(w) &&
      !first.has(w) &&
      !OUT.has(w),
  )
  .sort((a, b) => google.get(a) + subs.get(a) - (google.get(b) + subs.get(b)))
  .slice(0, TAIL);
if (pick.length < TAIL) throw new Error('only ' + pick.length + ' words for the tail');

const tail = pick.map((w, i) => `${w} ${Math.round(headF * (HEAD / (HEAD + 1 + i)) ** ALPHA)}`);
writeFileSync(FILE, head.concat(tail).join('|'));
console.log(`${FILE}: ${HEAD} kept, ${tail.length} added, ${HEAD + tail.length} words`);
