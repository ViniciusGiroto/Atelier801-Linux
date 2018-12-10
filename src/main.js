// Load require apps
const electron = require('electron');
const path = require('path');
const flash = require('./modules/flash');

const { app, BrowserWindow, ipcMain, globalShortcut, shell, dialog } = electron;

const libPath = (process.arch === 'x64') ? 'lib64' : 'lib32';
const flashPath = path.join(__dirname, libPath, 'pepflashplayer');

const winBase = {
  width: 800,
  height: 600,
  show: false,
};

const games = {
  tfm: {
    title: 'Transformice',
    url: 'http://www.transformice.com/TransformiceChargeur.swf'
  },
  neko: {
    title: 'Nekodancer',
    url: 'http://www.nekodancer.com/ChargeurNekodancer.swf',
  },
  fort: {
    title: 'Fortoresse',
    url: 'http://www.fortoresse.com/ChargeurFortoresse.swf'
  },
  bbm: {
    title: 'Bouboum',
    url: 'http://www.bouboum.com/ChargeurBouboum.swf'
  },
  ddm: {
    title: 'Dead Maze',
    url: 'http://deadmaze.com/alpha/'
  },
  ext: {
    title: 'Extinction',
    url: 'http://www.extinction.fr/MiniJeux.swf'
  },
};

let flashVersion = '0.0.0.0';
let win;
let currentGame = null;
let hasFlash = false;

global.env = {
  verbose: false,
};

// Read arguments
for (const arg of process.argv) {
  switch (arg) {
    case '-v':
    case '--verbose':
      env.verbose = true;
  }
}

function createWindow(config, url) {
  env.verbose && console.log('Creating new window (%s)', url);
  const win = new BrowserWindow(config);

  win.setMenu(null);
  win.loadURL(url);

  win.once('ready-to-show', () => win.show());

  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    shell.openExternal(url);
  });

  return win;
}

function openGame(id) {
  env.verbose && console.log('Opening game (%s)', id);
  const game = games[id];
  const newWin = createWindow({
    ...winBase,
    title: game.title,
    icon: path.join(__dirname, 'images', `icon-${id}.png`),
    nodeIntegration: false,
    webPreferences: {
      devTools: false,
      plugins: true,
      sandbox: true
    }
  }, game.url);

  win && win.close();
  win = newWin;
  currentGame = id;
}

function openMain() {
  env.verbose && console.log('Opening main window');
  const newWin = createWindow({
    ...winBase,
    title: 'Atelier 801 - Launcher',
    icon: path.join(__dirname, 'images', 'icon-ext.png'),
    webContents: {
      devTools: false
    }
  }, path.join('file://', __dirname, 'main.html'));

  win && win.close();
  win = newWin;
  currentGame = null;
}

try {
  env.verbose && console.log('Loading libpepflashplayer');
  flashVersion = flash.loadManifest(flashPath).version; // throws an error if flashPath does not exist
  app.commandLine.appendSwitch('ppapi-flash-path', path.join(flashPath, 'libpepflashplayer.so'));
  app.commandLine.appendSwitch('ppapi-flash-version', flashVersion);
  hasFlash = true;
} catch (err) {
  if (env.verbose) {
    console.error('Could not load libpepflashplayer');
    console.error(err);
    console.log('Trying to install libpepflashplayer from Adobe\'s website');
  }
  flash.update(flashVersion, flashPath)
    .then(() => {
      env.verbose && console.log('Installed libpepflashplayer successfully');
      dialog.showMessageBox({
        title: 'FlashPlayer installed',
        message: 'Please restart the application',
        type: 'info',
        buttons: ['OK']
      }, () => app.quit());
    })
    .catch((err) => {
      if (env.verbose) {
        console.error('Could not install libpepflashplayer');
        console.error(err);
      }
      dialog.showMessageBox({
        title: 'Error',
        message: 'Could not reinstall FlashPlayer :(',
        type: 'error',
        buttons: ['Close']
      }, () => app.quit());
    });
}

// Starts Application
app.once('ready', () => {
  if (!hasFlash) return;
  env.verbose && console.log('Application is ready');
  openMain();
});

app.on('window-all-closed', () => (process.platform != 'darwin' && app.quit()));
app.on('will-quit', () => globalShortcut.unregisterAll());

ipcMain.on('update-flash', (e) => {
  env.verbose && console.log('Trying to update libpepflashplayer (required by user)');
  e.sender.send('update-flash-begin');

  flash.update(flashVersion, flashPath)
    .then(code => e.sender.send('update-flash-end', code))
    .catch((err) => {
      if (env.verbose) {
        console.error('Could not install libpepflashplayer (required by user');
        console.error(err);
      }
      e.sender.send('update-flash-error')
    })
    ;
});

ipcMain.on('open-game', (_, id) => openGame(id));