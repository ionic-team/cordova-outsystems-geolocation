const fs = require('fs');
const xml2js = require('xml2js');

module.exports = {
  branches: ['main'],
  tagFormat: '${version}',  // semantic-release uses vX.Y.Z by default, but cordova plugins expect X.Y.Z
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    // updates to plugin versions without npm publishing
    [
      '@semantic-release/npm',
      {
        pkgRoot: '.',
        npmPublish: false
      }
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/cordova-plugin',
        npmPublish: false
      }
    ],
    // upddate plugin.xml version
    {
      async prepare(pluginConfig, context) {
        const { nextRelease } = context;
        const version = nextRelease.version;

        const xmlPath = 'plugin.xml';
        const xml = fs.readFileSync(xmlPath, 'utf8');
        const parser = new xml2js.Parser();
        const builder = new xml2js.Builder();

        const parsed = await parser.parseStringPromise(xml);
        parsed.plugin.$.version = version;

        const updatedXml = builder.buildObject(parsed);
        fs.writeFileSync(xmlPath, updatedXml);

        console.log(`🔖 Updated plugin.xml version to ${version}`);
      }
    },
    [
      '@semantic-release/git',
      {
        assets: [
          'package.json',
          'packages/cordova-plugin/package.json',
          'plugin.xml',
          'CHANGELOG.md',
        ],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        successComment: false,
        failComment: false,
        releasedLabels: false,
        addReleases: 'bottom'
      }
    ],
  ],
};
