const crypto = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'social-auto-encryption-key-change-in-production';

// Encrypt sensitive data
exports.encrypt = (data) => {
    if (typeof data === 'object') {
        data = JSON.stringify(data);
    }
    return crypto.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

// Decrypt sensitive data
exports.decrypt = (encryptedData) => {
    const bytes = crypto.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(crypto.enc.Utf8);
    try {
        return JSON.parse(decrypted);
    } catch {
        return decrypted;
    }
};
