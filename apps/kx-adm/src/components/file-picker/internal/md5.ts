const UINT32_MODULO = 2 ** 32;

function toUint32(value: number) {
  const truncated = Math.trunc(value);
  return ((truncated % UINT32_MODULO) + UINT32_MODULO) % UINT32_MODULO;
}

const shiftAmounts = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
];

const table = Array.from({ length: 64 }, (_, index) =>
  toUint32(Math.floor(Math.abs(Math.sin(index + 1)) * UINT32_MODULO)),
);

function rotateLeft(value: number, amount: number) {
  return (value << amount) | (value >>> (32 - amount));
}

function wordToHex(value: number) {
  let result = '';
  for (let index = 0; index < 4; index += 1) {
    result += ((value >>> (index * 8)) & 255).toString(16).padStart(2, '0');
  }
  return result;
}

export function md5ArrayBuffer(input: ArrayBuffer) {
  const bytes = new Uint8Array(input);
  let paddedLength = bytes.length + 1;
  while (paddedLength % 64 !== 56) paddedLength += 1;

  const buffer = new Uint8Array(paddedLength + 8);
  buffer.set(bytes);
  buffer[bytes.length] = 128;

  const bitLength = bytes.length * 8;
  for (let index = 0; index < 8; index += 1) {
    buffer[paddedLength + index] =
      Math.floor(bitLength / 2 ** (8 * index)) & 255;
  }

  let a0 = 1_732_584_193;
  let b0 = 4_023_233_417;
  let c0 = 2_562_383_102;
  let d0 = 271_733_878;

  const words = new Uint32Array(16);
  for (let offset = 0; offset < buffer.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const byteOffset = offset + index * 4;
      words[index] =
        (buffer[byteOffset] ?? 0) |
        ((buffer[byteOffset + 1] ?? 0) << 8) |
        ((buffer[byteOffset + 2] ?? 0) << 16) |
        ((buffer[byteOffset + 3] ?? 0) << 24);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f: number;
      let g: number;
      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }

      const next = d;
      d = c;
      c = b;
      b = toUint32(
        b +
          rotateLeft(
            toUint32(a + f + (table[index] ?? 0) + (words[g] ?? 0)),
            shiftAmounts[index] ?? 0,
          ),
      );
      a = next;
    }

    a0 = toUint32(a0 + a);
    b0 = toUint32(b0 + b);
    c0 = toUint32(c0 + c);
    d0 = toUint32(d0 + d);
  }

  return `${wordToHex(a0)}${wordToHex(b0)}${wordToHex(c0)}${wordToHex(d0)}`;
}

export async function md5File(file: File) {
  return md5ArrayBuffer(await file.arrayBuffer());
}
