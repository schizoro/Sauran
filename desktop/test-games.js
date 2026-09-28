const assert = require('assert');
const { detectGame, parseTasklist } = require('./games');

const sample = [
    '"System Idle Process","0","Services","0","8 K"',
    '"chrome.exe","1234","Console","1","180.000 K"',
    '"VALORANT-Win64-Shipping.exe","4321","Console","1","3.000.000 K"',
    '"Discord.exe","999","Console","1","200.000 K"'
].join('\r\n');

const names = parseTasklist(sample);
assert.strictEqual(names.length, 4);
assert.strictEqual(detectGame(names), 'VALORANT');
assert.strictEqual(detectGame(['chrome.exe', 'Discord.exe']), null);
assert.strictEqual(detectGame(['LeagueClient.exe']), null, 'istemci açıkken oyun sayılmaz');
assert.strictEqual(detectGame(['League of Legends.exe']), 'League of Legends');
assert.strictEqual(detectGame(parseTasklist('')), null);
console.log('games.js testleri geçti');
