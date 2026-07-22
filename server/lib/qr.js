import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

function getSecret() {
  const secretPath = join(dataDir, '.qr-secret');
  if (existsSync(secretPath)) {
    return readFileSync(secretPath, 'utf8').trim();
  }
  const secret = randomBytes(32).toString('hex');
  writeFileSync(secretPath, secret, { mode: 0o600 });
  console.log('[qr] Generated persistent signing secret');
  return secret;
}

const SECRET = getSecret();

export function signCheckinToken(registrationId, sessionId) {
  return jwt.sign({ rid: registrationId, sid: sessionId }, SECRET);
}

export function verifyCheckinToken(token) {
  return jwt.verify(token, SECRET);
}

export async function generateQRDataUrl(token) {
  return QRCode.toDataURL(token, {
    width: 320,
    margin: 2,
    color: { dark: '#163a7d', light: '#ffffff' },
  });
}

export async function generateQRBuffer(token) {
  return QRCode.toBuffer(token, {
    width: 320,
    margin: 2,
    type: 'png',
    color: { dark: '#163a7d', light: '#ffffff' },
  });
}
