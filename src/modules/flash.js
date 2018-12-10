const fetch = require('node-fetch');
const download = require('download');
const tar = require('tar');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const rimraf = require('rimraf');

function loadFlashManifest(flashPath) {
  env.verbose && console.log('Reading libpepflashplayer manifest from `%s`', flashPath);
  return JSON.parse(fs.readFileSync(path.join(flashPath, 'manifest.json'), 'utf-8'));
}

const toInt = e => parseInt(e);

function compareVersions(a, b) {
  a = a.split('.').map(toInt);
  b = b.split('.').map(toInt);
  const min = Math.min(a.length, b.length);

  for (let i = 0; i < min; i++) {
    if (a[i] < b[i]) // outdated
      return -1;
    else if (a[i] === b[i]) // updated
      continue;
    else
      return 1;
  }
  return 0;
}

let isUpdating = false;

function mktempdir() {
  env.verbose && console.log('Creating temp directory');
  return new Promise((resolve, reject) => {
    fs.mkdtemp(path.join(os.tmpdir(), 'temp-standalone-'), (err, folder) => (err ? reject(err) : resolve(folder)));
  });
}

function rmdir(dir) {
  env.verbose && console.log('Removing directory (%s)', dir);
  return new Promise((resolve, reject) => rimraf(dir, (err) => (err ? reject(err) : resolve())));
}

function move(oldPath, newPath) {
  env.verbose && console.log('Renaming file `%s` to `%s`', oldPath, newPath);
  return new Promise((resolve, reject) => fs.move(oldPath, newPath, (err) => (err ? reject(err) : resolve())));
}

function downloadUpdate(url, folder) {
  env.verbose && console.log('Download libpepflashplayer update to `%s`', folder);
  return new Promise((resolve, reject) => {
    download(url).pipe(tar.extract({
      cwd: folder
    }))
      .on('finish', () => resolve())
      .on('error', err => reject(err))
      ;
  });
}

async function updateFlash(currentVersion, flashPath) {
  if (isUpdating)
    return;

  env.verbose && console.log('Checking for libpepflashplayer update');
  
  isUpdating = true;

  const latestData = await fetch(`https://get.adobe.com/flashplayer/webservices/json/?platform_type=Linux&platform_dist=tar&platform_arch=${(process.arch === 'x64') ? 'x86-64' : 'x86-32'}&browser_arch=&browser_type=&browser_vers=&browser_dist=Chrome&eventname=flashplayerotherversions`)
    .then(res => res.json())
    .then(res => res.find(dist => dist.installer_description === 'DOWNLOADCENTER_FLASH_PLAYER_LINUX_TAR_GZ'));

  if (!('Version' in latestData)) {
    throw 'Missing `Version` field';
  }

  const res = compareVersions(currentVersion, latestData.Version);
  if (res === -1) {
    const folder = await mktempdir();
  
    await downloadUpdate(latestData.download_url, folder);
    await rmdir(flashPath);
    await move(folder, flashPath);
  }

  isUpdating = false;
  return res;
}

module.exports.update = updateFlash;
module.exports.loadManifest = loadFlashManifest;