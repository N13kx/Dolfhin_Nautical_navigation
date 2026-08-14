'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDatumProfile } = require('../../scripts/nautical/datum-profile.cjs');
const { validateReleaseSelection } = require('../../scripts/nautical/release-config.cjs');

test('preserves verified Zeeland datum semantics', () => {
  assert.deepEqual(resolveDatumProfile({ DSPM_SDAT: 42, DSPM_VDAT: 24 }), {
    depthDatum: 'Approximate LAT',
    depthDatumCode: 42,
    depthDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
    verticalDatum: 'Local Datum',
    verticalDatumCode: 24,
    verticalDatumStatus: 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION',
    napIdentityStatus: 'UNVERIFIED',
  });
});

test('keeps inland datum 33 numeric, unlabelled, and unverified', () => {
  assert.deepEqual(resolveDatumProfile({ DSPM_SDAT: '33', DSPM_VDAT: 33 }), {
    depthDatum: null,
    depthDatumCode: 33,
    depthDatumStatus: 'UNVERIFIED',
    verticalDatum: null,
    verticalDatumCode: 33,
    verticalDatumStatus: 'UNVERIFIED',
    napIdentityStatus: 'UNVERIFIED',
  });
});

test('never invents missing datum codes or labels', () => {
  assert.deepEqual(resolveDatumProfile({}), {
    depthDatum: null,
    depthDatumCode: null,
    depthDatumStatus: 'UNVERIFIED',
    verticalDatum: null,
    verticalDatumCode: null,
    verticalDatumStatus: 'UNVERIFIED',
    napIdentityStatus: 'UNVERIFIED',
  });
});

test('release selection returns complete cell records, not bare IDs', () => {
  const config = {
    expectedTotalCells: 2,
    sourceSets: {
      'zeeland-validated-61': { cellCount: 1, cells: ['ZEELAND'] },
      'inland-mandatory-14': { cellCount: 1, cells: ['INLAND'] },
    },
  };
  const cells = [{ cellId: 'ZEELAND', marker: 1 }, { cellId: 'INLAND', marker: 2 }];
  const result = validateReleaseSelection(config, cells);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.inlandPresent, [{ cellId: 'INLAND', marker: 2 }]);
  assert.deepEqual(result.zeelandPresent, [{ cellId: 'ZEELAND', marker: 1 }]);
});
