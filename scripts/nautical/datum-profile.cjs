'use strict';

const VERIFIED_LABELS = {
  sdat: new Map([[42, 'Approximate LAT']]),
  vdat: new Map([[24, 'Local Datum']]),
};

function numericCode(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const code = Number(value);
  if (!Number.isInteger(code)) throw new Error(`${fieldName} must be an integer or null, got ${JSON.stringify(value)}`);
  return code;
}

function resolveDatumProfile(metadata) {
  const depthDatumCode = numericCode(metadata.DSPM_SDAT, 'DSPM_SDAT');
  const verticalDatumCode = numericCode(metadata.DSPM_VDAT, 'DSPM_VDAT');
  const depthDatum = VERIFIED_LABELS.sdat.get(depthDatumCode) || null;
  const verticalDatum = VERIFIED_LABELS.vdat.get(verticalDatumCode) || null;

  return {
    depthDatum,
    depthDatumCode,
    depthDatumStatus: depthDatum ? 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION' : 'UNVERIFIED',
    verticalDatum,
    verticalDatumCode,
    verticalDatumStatus: verticalDatum ? 'VERIFIED_FROM_OFFICIAL_DOCUMENTATION' : 'UNVERIFIED',
    napIdentityStatus: 'UNVERIFIED',
  };
}

function datumProfileFromManifest(manifest) {
  return {
    depthDatum: manifest.depthDatum ?? null,
    depthDatumCode: numericCode(manifest.sdat, 'sdat'),
    depthDatumStatus: manifest.depthDatumStatus,
    verticalDatum: manifest.verticalDatum ?? null,
    verticalDatumCode: numericCode(manifest.vdat, 'vdat'),
    verticalDatumStatus: manifest.verticalDatumStatus,
    napIdentityStatus: manifest.napIdentityStatus,
  };
}

module.exports = { resolveDatumProfile, datumProfileFromManifest };
