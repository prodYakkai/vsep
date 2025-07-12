#!/usr/bin/env node

/**
 * VSEP Development Chromium Launcher
 * Launches a single Chromium window with development-friendly settings
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEV_PORT = 3000;
let CONTROL_URL = `https://localhost:${DEV_PORT}/control.html`;
let WHEP_DEV_URL = `https://localhost:${DEV_PORT}/projection-whep.html?id=dev`;

function getChromiumPath() {
  const commonPaths = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Chromium\\chrome.exe',
      'C:\\Program Files (x86)\\Chromium\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Chromium\\Application\\chrome.exe')
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/opt/google/chrome/chrome',
      '/snap/bin/chromium'
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ]
  };

  const platform = os.platform();
  const paths = commonPaths[platform] || commonPaths.linux;
  
  for (const chromePath of paths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  // Fallback to PATH lookup
  const commands = platform === 'win32' 
    ? ['chrome.exe', 'chromium.exe'] 
    : ['google-chrome', 'chromium-browser', 'chromium'];
  
  return commands[0]; // Return first command and let spawn handle PATH lookup
}

function launchDevChromium() {
  const chromiumPath = getChromiumPath();
  const profileDir = path.join(os.homedir(), '.vsep-dev-profile');
  
  // Ensure profile directory exists
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Development-focused Chromium arguments
  const args = [
    // Core flags from launcher (security/media related)
    '--chrome-frame',
    '--autoplay-policy=no-user-gesture-required',
    '--ignore-certificate-errors',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-hidden-media-playback',
    '--use-fake-ui-for-media-stream',
    '--test-type',
    '--suppress-badflags-warnings',
    
    // Development-specific flags
    '--remote-debugging-port=9222',
    '--auto-open-devtools-for-tabs',  // Auto-open DevTools
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    
    // Window settings (development friendly)
    '--window-size=1200,800',
    '--window-position=100,100',
    '--new-window',
    
    // Profile and URLs (multiple tabs)
    `--user-data-dir=${profileDir}`,
    CONTROL_URL,
    WHEP_DEV_URL
  ];

  console.log('🛠️  Launching development Chromium...');
  console.log(`📂 Profile: ${profileDir}`);
  console.log(`🌐 Control Panel: ${CONTROL_URL}`);
  console.log(`🌐 WHEP Projection (dev): ${WHEP_DEV_URL}`);
  console.log(`🔧 Remote debugging: http://localhost:9222`);

  const chromiumProcess = spawn(chromiumPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  chromiumProcess.on('exit', (code) => {
    console.log(`Chromium exited with code ${code}`);
  });

  chromiumProcess.on('error', (error) => {
    console.error(`Failed to launch Chromium: ${error.message}`);
  });

  if (chromiumProcess.stderr) {
    chromiumProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message && !message.includes('DevTools listening')) {
        console.log(`[Chromium] ${message}`);
      }
    });
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    if (!chromiumProcess.killed) {
      chromiumProcess.kill('SIGTERM');
    }
    process.exit(0);
  });

  console.log('✅ Chromium launched! Press Ctrl+C to stop.');
}

// CLI Interface
function showHelp() {
  console.log(`
VSEP Development Chromium Launcher

Usage: node dev-chromium.js [options]

Options:
  --help               Show this help message
  --control-url <url>  Override control panel URL (default: ${CONTROL_URL})
  --whep-url <url>     Override WHEP projection URL (default: ${WHEP_DEV_URL})
  --port <port>        Override default port (default: ${DEV_PORT})

Examples:
  node dev-chromium.js
  node dev-chromium.js --port 8080
  node dev-chromium.js --whep-url https://localhost:3000/projection-whep.html?id=test
  `);
}

// Parse command line arguments
const args = process.argv.slice(2);
let customControlUrl = null;
let customWhepUrl = null;
let customPort = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--help':
      showHelp();
      process.exit(0);
      break;
    case '--control-url':
      customControlUrl = args[++i];
      break;
    case '--whep-url':
      customWhepUrl = args[++i];
      break;
    case '--port':
      customPort = parseInt(args[++i]);
      break;
  }
}

// Update URLs if custom port provided
if (customPort) {
  CONTROL_URL = customControlUrl || `https://localhost:${customPort}/control.html`;
  WHEP_DEV_URL = customWhepUrl || `https://localhost:${customPort}/projection-whep.html?id=dev`;
} else {
  if (customControlUrl) {
    CONTROL_URL = customControlUrl;
  }
  if (customWhepUrl) {
    WHEP_DEV_URL = customWhepUrl;
  }
}

// Main execution
if (require.main === module) {
  launchDevChromium();
}