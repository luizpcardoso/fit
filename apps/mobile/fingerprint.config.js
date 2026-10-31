// Certificate changes alter native trust, even when generated Android files are ignored.
module.exports = {
  extraSources: [{ type: 'file', filePath: 'certs/updates.pem', reasons: ['otaCodeSigningCertificate'] }],
};
