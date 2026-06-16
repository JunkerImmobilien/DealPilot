/* dp-qr.js — clientseitiger QR-Code-Generator (kein externer Dienst). Marker dpfk-qr-v1.
   Faithful port of Project Nayuki's "QR Code generator" (MIT License), Byte-Modus/UTF-8.
   API:
     window.DpQr.matrix(text, opts)  -> { size, get(x,y)->bool }   (ohne Quiet-Zone)
     window.DpQr.svg(text, opts)     -> SVG-String (mit Quiet-Zone, faerbbar)
   opts: { ecc:'L'|'M'|'Q'|'H' (default 'M'), border:int (default 4),
           dark:'#141210', light:'#fff', px:int (modulgroesse, default 0=viewBox-only) } */
(function () {
  'use strict';

  /* ---------- Reed-Solomon / Bit-Helfer ---------- */
  function appendBits(val, len, bb) {
    if (len < 0 || len > 31 || (val >>> len) !== 0) throw new RangeError('appendBits');
    for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  }
  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function reedSolomonMultiply(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function reedSolomonComputeDivisor(degree) {
    if (degree < 1 || degree > 255) throw new RangeError('degree');
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var i2 = 0; i2 < degree; i2++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = reedSolomonMultiply(root, 0x02);
    }
    return result;
  }
  function reedSolomonComputeRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= reedSolomonMultiply(coef, factor); });
    });
    return result;
  }

  /* ---------- ECC-Tabellen ---------- */
  var ECL = {
    L: { ord: 0, fb: 1 }, M: { ord: 1, fb: 0 }, Q: { ord: 2, fb: 3 }, H: { ord: 3, fb: 2 }
  };
  var ECC_CODEWORDS_PER_BLOCK = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  var NUM_ERROR_CORRECTION_BLOCKS = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];

  function getNumRawDataModules(ver) {
    if (ver < 1 || ver > 40) throw new RangeError('ver');
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }
  function getNumDataCodewords(ver, ecl) {
    return Math.floor(getNumRawDataModules(ver) / 8)
      - ECC_CODEWORDS_PER_BLOCK[ecl.ord][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl.ord][ver];
  }

  /* ---------- Byte-Segment (UTF-8) ---------- */
  function toUtf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    }
    return out;
  }

  /* ---------- QR-Aufbau ---------- */
  function encode(text, ecl) {
    var bytes = toUtf8(text);
    // Versionswahl
    var version = -1, dataUsedBits, dataCapacityBits;
    for (var v = 1; v <= 40; v++) {
      dataCapacityBits = getNumDataCodewords(v, ecl) * 8;
      var ccBits = (v <= 9) ? 8 : 16;            // Byte-Modus char-count
      dataUsedBits = 4 + ccBits + bytes.length * 8;
      if (dataUsedBits <= dataCapacityBits) { version = v; break; }
    }
    if (version === -1) throw new RangeError('Daten zu lang fuer QR (max Version 40)');

    var bb = [];
    appendBits(0x4, 4, bb);                         // Byte-Modus
    appendBits(bytes.length, version <= 9 ? 8 : 16, bb);
    bytes.forEach(function (b) { appendBits(b, 8, bb); });

    var capacityBits = getNumDataCodewords(version, ecl) * 8;
    appendBits(0, Math.min(4, capacityBits - bb.length), bb);   // Terminator
    appendBits(0, (8 - bb.length % 8) % 8, bb);                 // Byte-Grenze
    for (var pad = 0xEC; bb.length < capacityBits; pad ^= 0xEC ^ 0x11) appendBits(pad, 8, bb);

    var dataCodewords = [];
    for (var i = 0; i < bb.length; i += 8) {
      var bv = 0; for (var k = 0; k < 8; k++) bv |= bb[i + k] << (7 - k);
      dataCodewords.push(bv);
    }
    return new QrCode(version, ecl, dataCodewords, -1);
  }

  function QrCode(version, ecl, dataCodewords, msk) {
    this.version = version;
    this.ecl = ecl;
    this.size = version * 4 + 17;
    var size = this.size;
    this.modules = [];
    this.isFunction = [];
    for (var i = 0; i < size; i++) { this.modules.push(new Array(size).fill(false)); this.isFunction.push(new Array(size).fill(false)); }

    this.drawFunctionPatterns();
    var allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);

    if (msk === -1) {
      var minPenalty = Infinity;
      for (var m = 0; m < 8; m++) {
        this.applyMask(m); this.drawFormatBits(m);
        var p = this.getPenaltyScore();
        if (p < minPenalty) { msk = m; minPenalty = p; }
        this.applyMask(m); // undo
      }
    }
    this.mask = msk;
    this.applyMask(msk);
    this.drawFormatBits(msk);
  }

  QrCode.prototype.get = function (x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
  };
  QrCode.prototype.setFunctionModule = function (x, y, isDark) {
    this.modules[y][x] = isDark; this.isFunction[y][x] = true;
  };
  QrCode.prototype.drawFunctionPatterns = function () {
    var size = this.size, self = this;
    for (var i = 0; i < size; i++) { this.setFunctionModule(6, i, i % 2 === 0); this.setFunctionModule(i, 6, i % 2 === 0); }
    this.drawFinderPattern(3, 3); this.drawFinderPattern(size - 4, 3); this.drawFinderPattern(3, size - 4);
    var alignPos = this.getAlignmentPatternPositions();
    var n = alignPos.length;
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
      if (!((a === 0 && b === 0) || (a === 0 && b === n - 1) || (a === n - 1 && b === 0)))
        this.drawAlignmentPattern(alignPos[a], alignPos[b]);
    }
    this.drawFormatBits(0);
    this.drawVersion();
  };
  QrCode.prototype.drawFinderPattern = function (x, y) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy)); var xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
        this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
    }
  };
  QrCode.prototype.drawAlignmentPattern = function (x, y) {
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
      this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  };
  QrCode.prototype.drawFormatBits = function (msk) {
    var data = (this.ecl.fb << 3) | msk;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    for (var j = 0; j <= 5; j++) this.setFunctionModule(8, j, getBit(bits, j));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (var k = 9; k < 15; k++) this.setFunctionModule(14 - k, 8, getBit(bits, k));
    var size = this.size;
    for (var l = 0; l < 8; l++) this.setFunctionModule(size - 1 - l, 8, getBit(bits, l));
    for (var m = 8; m < 15; m++) this.setFunctionModule(8, size - 15 + m, getBit(bits, m));
    this.setFunctionModule(8, size - 8, true);
  };
  QrCode.prototype.drawVersion = function () {
    if (this.version < 7) return;
    var rem = this.version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (this.version << 12) | rem;
    for (var j = 0; j < 18; j++) {
      var bit = getBit(bits, j); var a = this.size - 11 + j % 3, b = Math.floor(j / 3);
      this.setFunctionModule(a, b, bit); this.setFunctionModule(b, a, bit);
    }
  };
  QrCode.prototype.getAlignmentPatternPositions = function () {
    if (this.version === 1) return [];
    var numAlign = Math.floor(this.version / 7) + 2;
    var step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    var result = [6];
    for (var pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  };
  QrCode.prototype.addEccAndInterleave = function (data) {
    var ver = this.version, ecl = this.ecl;
    var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ord][ver];
    var blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ord][ver];
    var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);
    var blocks = [];
    var rsDiv = reedSolomonComputeDivisor(blockEccLen);
    for (var i = 0, k = 0; i < numBlocks; i++) {
      var datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      var dat = data.slice(k, k + datLen); k += datLen;
      var ecc = reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var col = 0; col < blocks[0].length; col++) {
      for (var row = 0; row < blocks.length; row++) {
        if (col !== shortBlockLen - blockEccLen || row >= numShortBlocks) result.push(blocks[row][col]);
      }
    }
    return result;
  };
  QrCode.prototype.drawCodewords = function (data) {
    var size = this.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7)); i++;
          }
        }
      }
    }
  };
  QrCode.prototype.applyMask = function (msk) {
    for (var y = 0; y < this.size; y++) for (var x = 0; x < this.size; x++) {
      if (this.isFunction[y][x]) continue;
      var invert;
      switch (msk) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
        default: throw new RangeError('mask');
      }
      if (invert) this.modules[y][x] = !this.modules[y][x];
    }
  };
  QrCode.prototype.getPenaltyScore = function () {
    var size = this.size, total = 0, self = this;
    // Rule 1: rows
    for (var y = 0; y < size; y++) {
      var runColor = false, runX = 0, runHistory = [0,0,0,0,0,0,0];
      for (var x = 0; x < size; x++) {
        if (this.modules[y][x] === runColor) { runX++; if (runX === 5) total += 3; else if (runX > 5) total++; }
        else { this.finderPenaltyAddHistory(runX, runHistory); if (!runColor) total += this.finderPenaltyCountPatterns(runHistory) * 40; runColor = this.modules[y][x]; runX = 1; }
      }
      total += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * 40;
    }
    // Rule 1: cols
    for (var x2 = 0; x2 < size; x2++) {
      var runColorC = false, runY = 0, runHistC = [0,0,0,0,0,0,0];
      for (var y2 = 0; y2 < size; y2++) {
        if (this.modules[y2][x2] === runColorC) { runY++; if (runY === 5) total += 3; else if (runY > 5) total++; }
        else { this.finderPenaltyAddHistory(runY, runHistC); if (!runColorC) total += this.finderPenaltyCountPatterns(runHistC) * 40; runColorC = this.modules[y2][x2]; runY = 1; }
      }
      total += this.finderPenaltyTerminateAndCount(runColorC, runY, runHistC) * 40;
    }
    // Rule 2: 2x2 blocks
    for (var y3 = 0; y3 < size - 1; y3++) for (var x3 = 0; x3 < size - 1; x3++) {
      var c = this.modules[y3][x3];
      if (c === this.modules[y3][x3 + 1] && c === this.modules[y3 + 1][x3] && c === this.modules[y3 + 1][x3 + 1]) total += 3;
    }
    // Rule 4: balance
    var dark = 0;
    for (var y4 = 0; y4 < size; y4++) for (var x4 = 0; x4 < size; x4++) if (this.modules[y4][x4]) dark++;
    var totalMods = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - totalMods * 10) / totalMods) - 1;
    total += k * 10;
    return total;
  };
  QrCode.prototype.finderPenaltyCountPatterns = function (rh) {
    var n = rh[1];
    var core = n > 0 && rh[2] === n && rh[3] === n * 3 && rh[4] === n && rh[5] === n;
    return (core && rh[0] >= n * 4 && rh[6] >= n ? 1 : 0) + (core && rh[6] >= n * 4 && rh[0] >= n ? 1 : 0);
  };
  QrCode.prototype.finderPenaltyTerminateAndCount = function (currentRunColor, currentRunLength, rh) {
    if (currentRunColor) { this.finderPenaltyAddHistory(currentRunLength, rh); currentRunLength = 0; }
    currentRunLength += this.size;
    this.finderPenaltyAddHistory(currentRunLength, rh);
    return this.finderPenaltyCountPatterns(rh);
  };
  QrCode.prototype.finderPenaltyAddHistory = function (currentRunLength, rh) {
    if (rh[0] === 0) currentRunLength += this.size;
    rh.pop(); rh.unshift(currentRunLength);
  };

  /* ---------- Public ---------- */
  function buildMatrix(text, opts) {
    opts = opts || {};
    var ecl = ECL[(opts.ecc || 'M').toUpperCase()] || ECL.M;
    return encode(String(text == null ? '' : text), ecl);
  }
  function toSvg(text, opts) {
    opts = opts || {};
    var qr = buildMatrix(text, opts);
    var border = opts.border == null ? 4 : opts.border;
    var dark = opts.dark || '#141210', light = opts.light || '#ffffff';
    var dim = qr.size + border * 2;
    var parts = [];
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++)
      if (qr.get(x, y)) parts.push('M' + (x + border) + ',' + (y + border) + 'h1v1h-1z');
    var attrW = opts.px ? (' width="' + (dim * opts.px) + '" height="' + (dim * opts.px) + '"') : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '"' + attrW +
      ' shape-rendering="crispEdges" role="img" aria-label="QR-Code">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path d="' + parts.join('') + '" fill="' + dark + '"/></svg>';
  }

  window.DpQr = { matrix: buildMatrix, svg: toSvg, _QrCode: QrCode };
})();
