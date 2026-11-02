const { build } = require('./package.json');
const configured = require('./updates.config.json').url;
const feed = process.env.NOVA_UPDATE_URL || configured;
if (!feed || new URL(feed).protocol !== 'https:') throw new Error('NOVA_UPDATE_URL must be a public HTTPS update directory.');
module.exports = {
  ...build,
  extraMetadata: { novaUpdateUrl: feed },
  publish: [{ provider: 'generic', url: feed, useMultipleRangeRequest: false }],
};
