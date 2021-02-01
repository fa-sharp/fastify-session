import crypto, { BinaryToTextEncoding } from 'crypto';
import { createError, CRYPTO_SPLIT_CHAR } from 'src/utils';
import { SessionCrypto } from './SessionCrypto';

export class Hmac implements SessionCrypto {
  public readonly protocol = '/hmac';
  public readonly stateless = false;
  private readonly algorithm: string;
  private readonly encoding: BinaryToTextEncoding;
  constructor(encoding: BinaryToTextEncoding = 'base64', algorithm = 'sha256') {
    this.encoding = encoding;
    this.algorithm = algorithm;
  }
  public sealMessage(message: Buffer, secretKey: Buffer): string {
    return (
      message.toString(this.encoding) +
      CRYPTO_SPLIT_CHAR +
      crypto.createHmac(this.algorithm, secretKey).update(message).digest(this.encoding).replace(/\=+$/, '')
    );
  }
  public unsealMessage(message: string, secretKeys: Buffer[]): { buffer: Buffer; rotated: boolean } {
    const splitCharIndex = message.lastIndexOf(CRYPTO_SPLIT_CHAR);
    if (splitCharIndex === -1) {
      throw createError('MalformedMessageError', 'The message is malformed');
    }
    const cleartext = Buffer.from(message.slice(0, splitCharIndex), this.encoding);
    // const signature = Buffer.from(message.slice(splitCharIndex + 1), this.encoding);
    // if (signature.length !== 64) {
    //   throw createError('SignatureLengthError', 'The signature does not have the required length');
    // }

    let rotated = false;
    // const messageBuffer = Buffer.from(message);
    const success = secretKeys.some((secretKey, index) => {
      const signedBuffer = Buffer.from(this.sealMessage(cleartext, secretKey));
      const messageBuffer = Buffer.alloc(signedBuffer.length);
      messageBuffer.write(message);
      const verified = crypto.timingSafeEqual(signedBuffer, messageBuffer);
      rotated = verified && index > 0;
      return verified;
    });

    if (!success) {
      throw createError('VerifyError', 'Unable to verify');
    }

    return { buffer: cleartext, rotated };
  }
}

export const HMAC = new Hmac();
