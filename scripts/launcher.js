#!/usr/bin/env node

/**
 * VSEP Universal Launcher
 * Cross-platform launcher for Windows, macOS, and Linux
 * Handles environment setup, dependency checks, and application startup
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

const execAsync = promisify(exec);

class VSEPLauncher {
  constructor(config = {}) {
    this.config = {
      environment: 'development',
      port: 3000,
      host: '0.0.0.0',
      redisPort: 6379,
      maxRetries: 30,
      retryDelay: 1000,
      skipGitPull: false,
      skipNpmInstall: false,
      skipBuild: false,
      enableKiosk: true,
      enableMultiMonitor: true,
      chromiumArgs: [
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
        '--remote-debugging-port=9222'
      ],
      ...config
    };

    this.processes = [];
    this.nodeProcess = null;
    this.isShuttingDown = false;
    this.platform = os.platform();

    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        if (!this.isShuttingDown) {
          this.log(`Received ${signal}, shutting down gracefully...`);
          this.cleanup().then(() => process.exit(0));
        }
      });
    });

    process.on('exit', () => {
      if (!this.isShuttingDown) {
        this.cleanup();
      }
    });
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
  }

  async execCommand(command, cwd) {
    try {
      const result = await execAsync(command, { cwd: cwd || process.cwd() });
      return result;
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  async checkPort(port, host = 'localhost') {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 1000);

      socket.connect(port, host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  async waitForPort(port, maxRetries = this.config.maxRetries) {
    this.log(`Waiting for port ${port} to be available...`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (await this.checkPort(port)) {
        this.log(`Port ${port} is available!`);
        return;
      }
      
      this.log(`Port check attempt ${attempt}/${maxRetries}...`);
      await this.sleep(this.config.retryDelay);
    }
    
    throw new Error(`Port ${port} is not available after ${maxRetries} attempts`);
  }

  async waitForEndpoint(url, maxRetries = this.config.maxRetries) {
    this.log(`Waiting for endpoint ${url} to respond...`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const command = this.platform === 'win32' 
          ? `powershell -Command "try { Invoke-WebRequest -Uri '${url}' -Method Get -TimeoutSec 5 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"`
          : `curl -s --insecure --max-time 5 "${url}" >/dev/null 2>&1`;
        
        await this.execCommand(command);
        this.log(`Endpoint ${url} is responding!`);
        return;
      } catch (error) {
        this.log(`Endpoint check attempt ${attempt}/${maxRetries}...`);
        await this.sleep(this.config.retryDelay);
      }
    }
    
    throw new Error(`Endpoint ${url} is not responding after ${maxRetries} attempts`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async pullLatestCode() {
    if (this.config.skipGitPull) {
      this.log('Skipping git pull (skipGitPull = true)');
      return;
    }

    this.log('Pulling latest code from git repository...');
    try {
      const { stdout } = await this.execCommand('git pull');
      this.log(`Git pull result: ${stdout.trim()}`);
    } catch (error) {
      this.log(`Git pull failed: ${error.message}`, 'warn');
      // Don't fail the launch if git pull fails
    }
  }

  async installDependencies() {
    if (this.config.skipNpmInstall) {
      this.log('Skipping npm install (skipNpmInstall = true)');
      return;
    }

    // Install root dependencies
    this.log('Installing Node.js dependencies...');
    await this.execCommand('npm install');

    // Install static dependencies
    this.log('Installing static directory dependencies...');
    const staticDir = path.join(process.cwd(), 'src', 'static');
    if (fs.existsSync(staticDir)) {
      await this.execCommand('npm install', staticDir);
    } else {
      this.log('Static directory not found, skipping static npm install', 'warn');
    }
  }

  async buildProject() {
    if (this.config.skipBuild) {
      this.log('Skipping build (skipBuild = true)');
      return;
    }

    this.log('Building project...');
    await this.execCommand('npm run build');
    
    // Verify build output
    const distFile = path.join(process.cwd(), 'dist', 'index.js');
    if (!fs.existsSync(distFile)) {
      throw new Error('Build failed: dist/index.js not found');
    }
    this.log('Build completed successfully');
  }

  async startNodeApp() {
    this.log('Starting Node.js application...');
    
    const nodeArgs = ['./dist/index.js'];
    const env = {
      ...process.env,
      NODE_ENV: this.config.environment,
      PORT: this.config.port.toString(),
      HOST: this.config.host
    };

    this.nodeProcess = spawn('node', nodeArgs, {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (this.nodeProcess.stdout) {
      this.nodeProcess.stdout.on('data', (data) => {
        this.log(`[Node] ${data.toString().trim()}`);
      });
    }

    if (this.nodeProcess.stderr) {
      this.nodeProcess.stderr.on('data', (data) => {
        this.log(`[Node Error] ${data.toString().trim()}`, 'error');
      });
    }

    this.nodeProcess.on('exit', (code) => {
      if (!this.isShuttingDown) {
        this.log(`Node.js process exited with code ${code}`, code === 0 ? 'info' : 'error');
      }
    });

    // Wait for the app to be ready
    await this.waitForEndpoint(`https://localhost:${this.config.port}/ping`);
  }

  async getMonitors() {
    const monitors = [];

    try {
      if (this.platform === 'win32') {
        // Windows: Use PowerShell to get monitor info
        const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { Write-Output (\\"$($_.Bounds.X),$($_.Bounds.Y),$($_.Bounds.Width),$($_.Bounds.Height)\\") }"`;
        const { stdout } = await this.execCommand(command);
        
        stdout.trim().split('\n').forEach((line, index) => {
          const [x, y, width, height] = line.trim().split(',').map(Number);
          if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
            monitors.push({
              id: `monitor${index + 1}`,
              x, y, width, height
            });
          }
        });
      } else if (this.platform === 'linux') {
        // Linux: Use xrandr
        try {
          const { stdout } = await this.execCommand('xrandr --query');
          const lines = stdout.split('\n');
          
          lines.forEach((line, index) => {
            if (line.includes(' connected')) {
              const match = line.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
              if (match) {
                const [, width, height, x, y] = match.map(Number);
                monitors.push({
                  id: `monitor${index + 1}`,
                  x, y, width, height
                });
              }
            }
          });
        } catch (error) {
          this.log('xrandr not available, using single monitor fallback', 'warn');
        }
      } else if (this.platform === 'darwin') {
        // macOS: Use system_profiler (basic implementation)
        try {
          const { stdout } = await this.execCommand('system_profiler SPDisplaysDataType');
          // Basic parsing - could be enhanced
          if (stdout.includes('Resolution:')) {
            monitors.push({
              id: 'monitor1',
              x: 0, y: 0, width: 1920, height: 1080 // Default fallback
            });
          }
        } catch (error) {
          this.log('system_profiler failed, using fallback', 'warn');
        }
      }
    } catch (error) {
      this.log(`Failed to detect monitors: ${error.message}`, 'warn');
    }

    // Fallback to single monitor if detection failed
    if (monitors.length === 0) {
      monitors.push({
        id: 'monitor1',
        x: 0, y: 0, width: 1920, height: 1080
      });
    }

    return monitors;
  }

  getChromiumPath() {
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

    const paths = commonPaths[this.platform] || commonPaths.linux;
    
    for (const chromePath of paths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    // Fallback to PATH lookup
    const commands = this.platform === 'win32' 
      ? ['chrome.exe', 'chromium.exe'] 
      : ['google-chrome', 'chromium-browser', 'chromium'];
    
    for (const cmd of commands) {
      try {
        const which = this.platform === 'win32' ? 'where' : 'which';
        execAsync(`${which} ${cmd}`);
        return cmd; // If which/where succeeds, return the command
      } catch (error) {
        // Continue to next command
      }
    }

    throw new Error('Chromium/Chrome not found. Please install Chromium or Google Chrome.');
  }

  async launchChromiumWindows() {
    if (!this.config.enableMultiMonitor) {
      this.log('Multi-monitor mode disabled');
      return;
    }

    const monitors = await this.getMonitors();
    const chromiumPath = this.getChromiumPath();
    
    this.log(`Found ${monitors.length} monitor(s), launching Chromium windows...`);

    for (const monitor of monitors) {
      try {
        const profileDir = path.join(os.homedir(), '.vsep-profiles', monitor.id);
        
        // Ensure profile directory exists
        if (!fs.existsSync(profileDir)) {
          fs.mkdirSync(profileDir, { recursive: true });
        }

        const args = [
          ...this.config.chromiumArgs,
          `--window-position=${monitor.x},${monitor.y}`,
          `--window-size=${monitor.width},${monitor.height}`,
          `--user-data-dir="${profileDir}"`,
          `--app=https://localhost:${this.config.port}/projection-whep.html?id=${monitor.id}`
        ];

        if (this.config.enableKiosk) {
          args.push('--kiosk');
        }

        this.log(`Launching Chromium for ${monitor.id}: ${monitor.width}x${monitor.height}+${monitor.x}+${monitor.y}`);

        const chromiumProcess = spawn(chromiumPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

        this.processes.push(chromiumProcess);

        chromiumProcess.on('exit', (code) => {
          if (!this.isShuttingDown) {
            this.log(`Chromium window for ${monitor.id} exited with code ${code}`);
          }
        });

        if (chromiumProcess.stderr) {
          chromiumProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message && !message.includes('DevTools listening')) {
              this.log(`[Chromium ${monitor.id}] ${message}`, 'warn');
            }
          });
        }

      } catch (error) {
        this.log(`Failed to launch Chromium for ${monitor.id}: ${error.message}`, 'error');
      }
    }
  }

  async cleanup() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.log('Cleaning up processes...');

    // Kill Chromium processes
    for (const process of this.processes) {
      try {
        if (!process.killed) {
          process.kill('SIGTERM');
          // Give it a moment to close gracefully
          await this.sleep(1000);
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }
      } catch (error) {
        this.log(`Error killing process: ${error.message}`, 'warn');
      }
    }

    // Kill Node.js process
    if (this.nodeProcess && !this.nodeProcess.killed) {
      try {
        this.nodeProcess.kill('SIGTERM');
        await this.sleep(2000);
        if (!this.nodeProcess.killed) {
          this.nodeProcess.kill('SIGKILL');
        }
      } catch (error) {
        this.log(`Error killing Node.js process: ${error.message}`, 'warn');
      }
    }

    this.log('Cleanup completed');
  }

  async launch() {
    try {
      this.log('🚀 Starting VSEP Universal Launcher...');
      this.log(`Platform: ${this.platform}`);
      this.log(`Environment: ${this.config.environment}`);
      this.log(`Port: ${this.config.port}`);

      // Step 1: Check Redis availability
      await this.waitForPort(this.config.redisPort);

      // Step 2: Pull latest code
      await this.pullLatestCode();

      // Step 3: Install dependencies
      await this.installDependencies();

      // Step 4: Build project
      await this.buildProject();

      // Step 5: Start Node.js application
      await this.startNodeApp();

      // Step 6: Launch Chromium windows
      await this.launchChromiumWindows();

      this.log('✅ VSEP launched successfully!');
      this.log('Press Ctrl+C to stop the application');

      // Keep the process running
      await new Promise(() => {}); // Run forever until signal

    } catch (error) {
      this.log(`❌ Launch failed: ${error.message}`, 'error');
      await this.cleanup();
      process.exit(1);
    }
  }
}

// CLI Interface
function parseArgs() {
  const config = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--env':
        config.environment = args[++i];
        break;
      case '--port':
        config.port = parseInt(args[++i]);
        break;
      case '--host':
        config.host = args[++i];
        break;
      case '--skip-git':
        config.skipGitPull = true;
        break;
      case '--skip-npm':
        config.skipNpmInstall = true;
        break;
      case '--skip-build':
        config.skipBuild = true;
        break;
      case '--no-kiosk':
        config.enableKiosk = false;
        break;
      case '--no-multimonitor':
        config.enableMultiMonitor = false;
        break;
      case '--help':
        console.log(`
VSEP Universal Launcher

Usage: node launcher.js [options]

Options:
  --env <env>          Environment (development|production|test) [default: development]
  --port <port>        Server port [default: 3000]
  --host <host>        Server host [default: 0.0.0.0]
  --skip-git           Skip git pull
  --skip-npm           Skip npm install
  --skip-build         Skip npm run build
  --no-kiosk           Disable kiosk mode for Chromium
  --no-multimonitor    Disable multi-monitor setup
  --help               Show this help message

Examples:
  node launcher.js
  node launcher.js --env production --port 8080
  node launcher.js --skip-git --skip-npm --no-kiosk
        `);
        process.exit(0);
        break;
    }
  }

  return config;
}

// Main execution
if (require.main === module) {
  const config = parseArgs();
  const launcher = new VSEPLauncher(config);
  launcher.launch().catch((error) => {
    console.error('Launch failed:', error);
    process.exit(1);
  });
}

module.exports = { VSEPLauncher };