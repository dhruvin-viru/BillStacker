const crypto = require('crypto');

class PaytmChecksum {
  static encrypt(src, key) {
    const cipher = crypto.createCipheriv('aes-128-cbc', key, '@@@@&&&&####$$$$');
    return cipher.update(src, 'utf8', 'base64') + cipher.final('base64');
  }

  static decrypt(src, key) {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, '@@@@&&&&####$$$$');
    return decipher.update(src, 'base64', 'utf8') + decipher.final('utf8');
  }

  static generateSignatureByString(params, key) {
    const salt = crypto.randomBytes(4).toString('hex');
    const sha256 = crypto.createHash('sha256').update(params + '|' + salt).digest('hex');
    return this.encrypt(sha256 + salt, key);
  }

  static generateSignature(params, key) {
    if (typeof params === 'string') {
      return this.generateSignatureByString(params, key);
    }
    const sortedParams = Object.keys(params).sort().reduce((acc, k) => {
      acc[k] = params[k];
      return acc;
    }, {});
    const data = Object.keys(sortedParams).map(k => `${k}=${sortedParams[k]}`).join('|');
    return this.generateSignatureByString(data, key);
  }

  static verifySignatureByString(params, key, checksum) {
    try {
      const decrypted = this.decrypt(checksum, key);
      const salt = decrypted.substring(decrypted.length - 8);
      const sha256 = decrypted.substring(0, decrypted.length - 8);
      const hash = crypto.createHash('sha256').update(params + '|' + salt).digest('hex');
      return hash === sha256;
    } catch (e) {
      return false;
    }
  }

  static verifySignature(params, key, checksum) {
    if (typeof params === 'string') {
      return this.verifySignatureByString(params, key, checksum);
    }
    const sortedParams = Object.keys(params).sort().reduce((acc, k) => {
      acc[k] = params[k];
      return acc;
    }, {});
    const data = Object.keys(sortedParams).map(k => `${k}=${sortedParams[k]}`).join('|');
    return this.verifySignatureByString(data, key, checksum);
  }
}

module.exports = PaytmChecksum;
