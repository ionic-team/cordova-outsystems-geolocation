const fs = require('fs');
const xml2js = require('xml2js');

module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    {
      // updates to plugin version without npm publishing
      prepare: [
        {
          path: '@semantic-release/npm',
          pkgRoot: '.',
        },
        {
          path: '@semantic-release/npm',
          pkgRoot: 'packages/cordova-plugin',
        },
        {
          async prepare({ nextRelease }) {
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
          },
        },
      ],
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
