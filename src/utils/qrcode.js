export function generateQR(text, size = 200) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const QRCode = getQRModule(text);
  const len = QRCode.length;
  const cellSize = Math.floor(size / (len + 2 * 2));
  const offset = (size - len * cellSize) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < len; r++) {
    for (let c = 0; c < len; c++) {
      if (QRCode[r][c]) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

function getQRModule(text) {
  const data = encodeData(text);
  const len = findVersion(data.length);
  const size = 17 + len * 4;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  addFinderPatterns(matrix);
  addTimingPatterns(matrix);
  addFormatBits(matrix);
  placeData(matrix, data, size);

  return matrix;
}

function encodeData(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else {
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
  }
  return bytes;
}

function findVersion(dataLen) {
  for (let v = 1; v <= 10; v++) {
    const cap = v * 8 + 16;
    if (dataLen <= cap) return v;
  }
  return 10;
}

function addFinderPatterns(m) {
  const positions = [[0, 0], [0, m.length - 7], [m.length - 7, 0]];
  for (const [r, c] of positions) {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const ri = r + i, ci = c + j;
        if (ri < 0 || ci < 0 || ri >= m.length || ci >= m.length) continue;
        if (i >= 0 && i <= 6 && j >= 0 && j <= 6) {
          const outer = i === 0 || i === 6 || j === 0 || j === 6;
          const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          m[ri][ci] = outer || inner ? 1 : 0;
        } else {
          m[ri][ci] = 0;
        }
      }
    }
  }
}

function addTimingPatterns(m) {
  const len = m.length;
  for (let i = 8; i < len - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0;
    m[i][6] = i % 2 === 0 ? 1 : 0;
  }
}

function addFormatBits(m) {
  const mask = 0x5412;
  let f = mask;
  const len = m.length;
  for (let i = 0; i < 15; i++) {
    const bit = (f >> (14 - i)) & 1;
    if (i < 6) {
      m[8][i] = bit;
    } else if (i < 7) {
      m[8][i + 1] = bit;
    } else if (i < 8) {
      m[8 - (i - 7)][8] = bit;
    } else {
      m[len - 15 + i][8] = bit;
    }
  }
  for (let i = 0; i < 7; i++) {
    m[8][len - 7 + i] = (mask >> i) & 1;
  }
  m[len - 8][8] = 1;
}

function placeData(m, data, size) {
  let idx = 0;
  let dir = -1;
  const len = m.length;

  for (let c = len - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let r = dir === -1 ? len - 1 : 0; r >= 0 && r < len; r += dir) {
      for (let dc = 0; dc < 2; dc++) {
        const col = c - dc;
        if (m[r][col] !== 0) continue;
        if (idx < data.length) {
          const bit = (data[idx >> 3] >> (7 - (idx & 7))) & 1;
          m[r][col] = bit;
        }
        idx++;
      }
    }
    dir = -dir;
  }
}
