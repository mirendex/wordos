// Builds the frequency dictionary, src/data/freq.txt, from the data of the wordfreq project
// (https://github.com/rspeer/wordfreq, the English list "large_en"), the same source the first
// 5000 words came from:
//
//   curl -L -o large_en.msgpack.gz https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/large_en.msgpack.gz
//   node scripts/gen-freq.mjs large_en.msgpack.gz
//
// wordfreq ranks words by how often they are written and said in a mix of sources (Wikipedia, films
// and series, news, books, the web, social media). Its list is kept to the words that are made of
// letters, with at most one apostrophe inside, and that are not a single letter other than "a" and
// "i" or a piece of a contraction ("ll", "ve", "re"): no numbers, no addresses, no emoji. The first
// WORDS of what is left are written as "word count" pairs, the count being the share of all words
// times 100,000,000, to three significant figures (so "the" is 5.37%, 5370000), and the pairs are
// joined by "|". The order of the words that stand level with each other is as in the file already
// there; this checks that the words of the file's first HEAD are the very ones this list gives, so
// that a place held in the course never moves, and the words after them are the new ones.
//
// wordfreq's data is licensed CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const WORDS = 10000;
const HEAD = 5000;
const FILE = 'src/data/freq.txt';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/gen-freq.mjs <large_en.msgpack.gz>');
  process.exit(1);
}

// a minimal msgpack reader: all that wordfreq's file holds is arrays, maps, strings and numbers
function unpack(buf) {
  let o = 0;
  const td = new TextDecoder();
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const take = (n) => buf.subarray(o, (o += n));
  const arr = (n) => Array.from({ length: n }, val);
  const map = (n) => {
    const m = {};
    for (let i = 0; i < n; i++) {
      const k = val();
      m[k] = val();
    }
    return m;
  };
  const len = (bytes) => {
    const n = bytes === 1 ? dv.getUint8(o) : bytes === 2 ? dv.getUint16(o) : dv.getUint32(o);
    o += bytes;
    return n;
  };
  function val() {
    const b = buf[o++];
    if (b <= 0x7f) return b;
    if (b >= 0xe0) return b - 256;
    if ((b & 0xe0) === 0xa0) return td.decode(take(b & 0x1f));
    if ((b & 0xf0) === 0x90) return arr(b & 0x0f);
    if ((b & 0xf0) === 0x80) return map(b & 0x0f);
    switch (b) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xcc:
        return len(1);
      case 0xcd:
        return len(2);
      case 0xce:
        return len(4);
      case 0xd9:
        return td.decode(take(len(1)));
      case 0xda:
        return td.decode(take(len(2)));
      case 0xdb:
        return td.decode(take(len(4)));
      case 0xdc:
        return arr(len(2));
      case 0xdd:
        return arr(len(4));
      case 0xde:
        return map(len(2));
      default:
        throw new Error('msgpack type 0x' + b.toString(16) + ' at ' + (o - 1));
    }
  }
  return val();
}

const data = unpack(gunzipSync(readFileSync(file)));
if (!data[0] || data[0].format !== 'cB') throw new Error('not a wordfreq list');
// each bucket i holds the words whose share is 10 ** (-i / 100), the first bucket the commonest
const ranked = [];
data.slice(1).forEach((list, i) => list.forEach((w) => ranked.push([w, 10 ** (-i / 100)])));

const keep = (w) =>
  /^[a-z]+('[a-z]+)?$/.test(w) && (w.length > 1 || w === 'a' || w === 'i') && !['ll', 've', 're'].includes(w);
const sig3 = (share) => {
  const v = share * 1e8;
  const p = 10 ** (Math.floor(Math.log10(v)) - 2);
  return Math.round(v / p) * p;
};
const list = ranked.filter(([w]) => keep(w)).slice(0, WORDS);

const current = readFileSync(FILE, 'utf8').split('|');
const wordOf = (s) => s.slice(0, s.lastIndexOf(' '));
const oldHead = current.slice(0, HEAD);
const newHead = new Set(list.slice(0, HEAD).map(([w]) => w));
const missing = oldHead.map(wordOf).filter((w) => !newHead.has(w));
if (oldHead.length < HEAD || missing.length) {
  throw new Error(
    'the first ' + HEAD + ' words of ' + FILE + ' are not the ones of this list: ' + missing.slice(0, 10),
  );
}

const out = oldHead.concat(list.slice(HEAD).map(([w, f]) => `${w} ${sig3(f)}`));
writeFileSync(FILE, out.join('|'));
console.log(`${FILE}: ${HEAD} kept, ${out.length - HEAD} added, ${out.length} words`);
