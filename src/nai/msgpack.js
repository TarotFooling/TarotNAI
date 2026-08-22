function decode(buf, at) {
  const byte = buf[at];

  if (byte === undefined) throw new Error(`msgpack ran out of bytes @${at}`);

  if (byte <= 0x7f) return [byte, at + 1];
  if (byte >= 0xe0) return [byte - 0x100, at + 1];

  if (byte >= 0x80 && byte <= 0x8f) return decodeMap(buf, at + 1, byte - 0x80);
  if (byte >= 0x90 && byte <= 0x9f) return decodeArray(buf, at + 1, byte - 0x90);
  if (byte >= 0xa0 && byte <= 0xbf) return decodeStr(buf, at + 1, byte - 0xa0);

  switch (byte) {
    case 0xc0: return [null, at + 1];
    case 0xc2: return [false, at + 1];
    case 0xc3: return [true, at + 1];

    case 0xc4: return decodeBin(buf, at + 2, buf.readUInt8(at + 1));
    case 0xc5: return decodeBin(buf, at + 3, buf.readUInt16BE(at + 1));
    case 0xc6: return decodeBin(buf, at + 5, buf.readUInt32BE(at + 1));

    case 0xca: return [buf.readFloatBE(at + 1), at + 5];
    case 0xcb: return [buf.readDoubleBE(at + 1), at + 9];

    case 0xcc: return [buf.readUInt8(at + 1), at + 2];
    case 0xcd: return [buf.readUInt16BE(at + 1), at + 3];
    case 0xce: return [buf.readUInt32BE(at + 1), at + 5];
    case 0xcf: return [Number(buf.readBigUInt64BE(at + 1)), at + 9];

    case 0xd0: return [buf.readInt8(at + 1), at + 2];
    case 0xd1: return [buf.readInt16BE(at + 1), at + 3];
    case 0xd2: return [buf.readInt32BE(at + 1), at + 5];
    case 0xd3: return [Number(buf.readBigInt64BE(at + 1)), at + 9];

    case 0xd9: return decodeStr(buf, at + 2, buf.readUInt8(at + 1));
    case 0xda: return decodeStr(buf, at + 3, buf.readUInt16BE(at + 1));
    case 0xdb: return decodeStr(buf, at + 5, buf.readUInt32BE(at + 1));

    case 0xdc: return decodeArray(buf, at + 3, buf.readUInt16BE(at + 1));
    case 0xdd: return decodeArray(buf, at + 5, buf.readUInt32BE(at + 1));

    case 0xde: return decodeMap(buf, at + 3, buf.readUInt16BE(at + 1));
    case 0xdf: return decodeMap(buf, at + 5, buf.readUInt32BE(at + 1));

    default:
      throw new Error(`unhandled msgpack byte 0x${byte.toString(16).padStart(2, '0')} @${at}`);
  }
}

function decodeStr(buf, at, length) {
  return [buf.toString('utf8', at, at + length), at + length];
}

function decodeBin(buf, at, length) {
  return [Buffer.from(buf.subarray(at, at + length)), at + length];
}

function decodeArray(buf, at, count) {
  const out = [];
  let pos = at;
  for (let i = 0; i < count; i += 1) {
    const [value, next] = decode(buf, pos);
    out.push(value);
    pos = next;
  }
  return [out, pos];
}

function decodeMap(buf, at, count) {
  const out = {};
  let pos = at;
  for (let i = 0; i < count; i += 1) {
    const [key, afterKey] = decode(buf, pos);
    const [value, afterValue] = decode(buf, afterKey);
    out[key] = value;
    pos = afterValue;
  }
  return [out, pos];
}

export function createFrameReader() {
  let carry = Buffer.alloc(0);

  return function push(chunk) {
    carry = carry.length ? Buffer.concat([carry, chunk]) : Buffer.from(chunk);
    const events = [];
    let pos = 0;

    while (pos + 4 <= carry.length) {
      const len = carry.readUInt32BE(pos);
      if (len === 0) {
        pos += 4;
        continue;
      }
      if (pos + 4 + len > carry.length) break;
      const [obj] = decode(carry, pos + 4);
      events.push(obj);
      pos += 4 + len;
    }

    carry = pos ? carry.subarray(pos) : carry;
    return events;
  };
}

export function createSseReader() {
  let carry = '';

  return function push(chunk) {
    carry += Buffer.from(chunk).toString('utf8');
    const frames = [];

    let split = carry.indexOf('\n\n');
    while (split !== -1) {
      frames.push(carry.slice(0, split));
      carry = carry.slice(split + 2);
      split = carry.indexOf('\n\n');
    }

    return frames;
  };
}

export function sseToEvent(frame) {
  let name = '';
  const data = [];

  for (const raw of frame.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }

  const payload = data.join('\n');
  if (!payload) return null;

  if (payload.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }
    const image = parsed.image;
    return {
      ...parsed,
      event_type: parsed.event_type ?? name ?? '',
      image: typeof image === 'string' ? Buffer.from(image, 'base64') : image,
    };
  }

  return {
    event_type: name || 'intermediate',
    image: Buffer.from(payload, 'base64'),
  };
}
