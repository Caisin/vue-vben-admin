const U8_MAX = 255;
const DEFAULT_SALT_LENGTH = 32;

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function transform(data: Uint8Array, salt: Uint8Array, encrypt: boolean) {
  if (salt.length === 0) return Uint8Array.from(data);
  const result = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    const source = data[index] ?? 0;
    const saltByte = salt[index % salt.length] ?? 0;
    const salted = encrypt
      ? (source + saltByte) & U8_MAX
      : (source - saltByte + 256) & U8_MAX;
    result[index] = U8_MAX - salted;
  }
  return result;
}

function decryptWithSalt(data: Uint8Array, salt: Uint8Array) {
  const inverted = Uint8Array.from(data, (value) => U8_MAX - value);
  const result = new Uint8Array(inverted.length);
  for (let index = 0; index < inverted.length; index += 1) {
    const source = inverted[index] ?? 0;
    const saltByte = salt[index % salt.length] ?? 0;
    result[index] = (source - saltByte + 256) & U8_MAX;
  }
  return result;
}

function encryptWithSalt(data: Uint8Array, salt: Uint8Array) {
  return transform(data, salt, true);
}

function encrypt(data: Uint8Array) {
  if (data.length === 0) return Uint8Array.from(data);
  const salt = randomBytes(DEFAULT_SALT_LENGTH);
  const encrypted = encryptWithSalt(data, salt);
  const result = new Uint8Array(1 + salt.length + encrypted.length);
  result[0] = salt.length;
  result.set(salt, 1);
  result.set(encrypted, 1 + salt.length);
  return result;
}

function encodeText(value: string) {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.codePointAt(index) ?? 0);
    }
  }
  return Uint8Array.from(bytes);
}

function decodeText(data: Uint8Array) {
  let encoded = '';
  for (const value of data) {
    encoded += `%${value.toString(16).padStart(2, '0')}`;
  }
  return decodeURIComponent(encoded);
}

function decrypt(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 0) return Uint8Array.from(bytes);
  const saltLength = bytes[0] ?? 0;
  if (saltLength === 0 || bytes.length <= saltLength) {
    throw new Error('invalid KxEd payload');
  }
  const salt = bytes.slice(1, 1 + saltLength);
  return decryptWithSalt(bytes.slice(1 + saltLength), salt);
}

function toArrayBuffer(data: Uint8Array) {
  const copy = new Uint8Array(data.length);
  copy.set(data);
  return copy.buffer;
}

export const KxEd = {
  decrypt,
  decryptText(data: ArrayBuffer | Uint8Array) {
    return decodeText(decrypt(data));
  },
  decryptWithSalt,
  decodeText,
  encodeText,
  encrypt,
  encryptText(value: string) {
    return encrypt(encodeText(value));
  },
  encryptWithSalt,
  toArrayBuffer,
};
