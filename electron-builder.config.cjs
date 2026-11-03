const { build } = require('./package.json');
const configured = require('./updates.config.json').url;
const feed = process.env.NOVA_UPDATE_URL || configured;
if (!feed || new URL(feed).protocol !== 'https:') throw new Error('Set updates.config.json to a public HTTPS update directory before packaging a release.');
module.exports = {
  ...build,
  extraMetadata: { novaUpdateUrl: feed },
  publish: [{ provider: 'generic', url: feed, useMultipleRangeRequest: false }],
};
