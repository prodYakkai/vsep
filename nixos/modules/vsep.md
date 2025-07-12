# VSEP NixOS Module

This NixOS module provides a complete, production-ready deployment of VSEP (Very Simple Embedded Player) as a system service.

## Features

- **Complete Service Management**: Automatic startup, monitoring, and restart of VSEP services
- **SSL Certificate Management**: Automatic generation of self-signed certificates or use custom ones
- **Redis Integration**: Built-in Redis service configuration and management
- **Multi-Monitor Support**: Automatic detection and management of multiple display outputs
- **Security Hardening**: Proper user isolation, filesystem permissions, and resource limits
- **Chromium Integration**: Automated kiosk-mode browser windows for projection displays
- **Production Ready**: Logging, monitoring, and backup configuration options

## Quick Start

1. **Add the module to your NixOS configuration:**

```nix
{
  imports = [ ./path/to/vsep.nix ];
  
  services.vsep = {
    enable = true;
    environment = "production";
    openFirewall = true;
  };
}
```

2. **Rebuild your system:**

```bash
sudo nixos-rebuild switch
```

3. **Access VSEP:**
   - Control Panel: `https://your-server:3000/control.html`
   - Projection: `https://your-server:3000/projection-whep.html?id=monitor1`

## Configuration Options

### Basic Configuration

```nix
services.vsep = {
  enable = true;
  environment = "production";  # development, production, test
  port = 3000;
  host = "0.0.0.0";
  user = "vsep";
  group = "vsep";
  dataDir = "/var/lib/vsep";
  configDir = "/etc/vsep";
  openFirewall = true;
};
```

### SSL Configuration

```nix
services.vsep.ssl = {
  generateSelfSigned = true;  # Auto-generate self-signed certificates
  certFile = "/var/lib/vsep/ssl/cert.crt";
  keyFile = "/var/lib/vsep/ssl/cert.key";
};
```

For production, use proper certificates:

```nix
services.vsep.ssl = {
  generateSelfSigned = false;
  certFile = "/etc/ssl/certs/vsep.crt";
  keyFile = "/etc/ssl/private/vsep.key";
};
```

### Redis Configuration

```nix
services.vsep.redis = {
  enable = true;          # Enable managed Redis instance
  host = "127.0.0.1";
  port = 6379;
  database = 0;
};
```

Use external Redis:

```nix
services.vsep.redis = {
  enable = false;         # Don't start local Redis
  host = "redis.internal";
  port = 6379;
  database = 0;
};
```

### Projection Display Configuration

```nix
services.vsep.projection = {
  enableKiosk = true;           # Fullscreen kiosk mode
  enableMultiMonitor = true;    # Multi-monitor support
  chromiumPackage = pkgs.chromium;  # Browser package
};
```

### Advanced Configuration

```nix
services.vsep = {
  # Resource limits
  extraEnvironment = {
    NODE_ENV = "production";
    DEBUG = "";
    MAX_MEMORY = "2048";
  };
  
  # Logging
  logLevel = "info";  # error, warn, info, debug
};
```

## Service Management

### System Services

The module creates several systemd services:

1. **`vsep.service`**: Main VSEP server process
2. **`vsep-launcher.service`**: Display management and Chromium launcher
3. **`vsep-ssl-setup.service`**: SSL certificate generation (if enabled)
4. **`redis-vsep.service`**: Redis instance (if enabled)

### Service Commands

```bash
# Check service status
sudo systemctl status vsep
sudo systemctl status vsep-launcher

# View logs
sudo journalctl -u vsep -f
sudo journalctl -u vsep-launcher -f

# Restart services
sudo systemctl restart vsep
sudo systemctl restart vsep-launcher

# Enable/disable services
sudo systemctl enable vsep
sudo systemctl disable vsep-launcher
```

### Service Dependencies

```
vsep-ssl-setup (if enabled)
         ↓
    redis-vsep (if enabled)
         ↓
    vsep.service
         ↓
  vsep-launcher.service
```

## Directory Structure

```
/var/lib/vsep/              # Data directory
├── ssl/                    # SSL certificates
│   ├── cert.crt
│   └── cert.key
├── logs/                   # Application logs
├── profiles/               # Chromium user profiles
└── config/                 # Runtime configuration

/etc/vsep/                  # Configuration directory
└── config.json             # VSEP configuration
```

## Security

### User and Permissions

- **User**: `vsep` (system user, no shell access)
- **Group**: `vsep`
- **Home**: `/var/lib/vsep`
- **Additional Groups**: `audio`, `video` (for media access)

### Filesystem Security

- **Private temp directories**: Isolated temporary storage
- **Read-only system**: System files mounted read-only
- **Protected home**: No access to user home directories
- **Specific write access**: Only `/var/lib/vsep` and `/etc/vsep`

### Resource Limits

- **Memory**: 2GB limit (configurable)
- **File descriptors**: 65536 limit
- **Process security**: No new privileges allowed

### Network Security

- **Firewall**: Optional automatic firewall rules
- **Binding**: Configurable host binding (default: 0.0.0.0)
- **SSL**: Automatic HTTPS with certificate management

## Multi-Monitor Setup

### Automatic Detection

The module automatically detects connected monitors using:

- **Linux**: `xrandr` command
- **Windows**: PowerShell WMI queries (if cross-platform needed)
- **macOS**: `system_profiler` (if cross-platform needed)

### Kiosk Mode

When enabled, each monitor gets:

1. **Dedicated Chromium window**: Fullscreen projection display
2. **Isolated profile**: Separate browser profile per monitor
3. **Auto-positioning**: Window positioned on specific monitor
4. **Auto-recovery**: Automatic restart if browser crashes

### Manual Monitor Configuration

For custom monitor setups, override the auto-detection:

```nix
# Disable auto-detection and use manual setup
services.vsep.projection.enableMultiMonitor = false;

# Configure displays manually in your X11 setup
services.xserver.xrandrHeads = [
  { output = "DP-1"; primary = true; }
  { output = "DP-2"; monitorConfig = "Option \"Position\" \"1920 0\""; }
];
```

## Monitoring and Logging

### Log Files

Logs are written to systemd journal and optionally to files:

```bash
# Real-time logs
sudo journalctl -u vsep -f

# Service-specific logs
sudo journalctl -u vsep-launcher -f
sudo journalctl -u redis-vsep -f

# Log files (if configured)
tail -f /var/lib/vsep/logs/vsep.log
```

### Log Rotation

Configure automatic log rotation:

```nix
services.logrotate.settings.vsep = {
  files = "/var/lib/vsep/logs/*.log";
  frequency = "daily";
  rotate = 30;
  compress = true;
};
```

### Health Checks

Built-in health check endpoints:

- **Server health**: `https://localhost:3000/ping`
- **Redis health**: Automatic connection testing
- **Display health**: Browser process monitoring

### Monitoring Integration

Example Prometheus monitoring:

```nix
services.prometheus.exporters.node.enable = true;

# Custom VSEP metrics (implement in application)
services.prometheus.scrapeConfigs = [
  {
    job_name = "vsep";
    static_configs = [
      { targets = [ "localhost:3000" ]; }
    ];
  }
];
```

## Backup and Recovery

### Configuration Backup

Important files to backup:

```
/var/lib/vsep/ssl/          # SSL certificates
/etc/vsep/                  # Configuration files
/var/lib/vsep/config/       # Runtime configuration
```

### Automated Backup

Example with Borg backup:

```nix
services.borgbackup.jobs.vsep-data = {
  enable = true;
  paths = [
    "/var/lib/vsep"
    "/etc/vsep"
  ];
  exclude = [
    "/var/lib/vsep/logs"
    "/var/lib/vsep/profiles"  # Chromium profiles (regeneratable)
  ];
  repo = "/backup/vsep";
  compression = "auto,zstd";
  startAt = "daily";
};
```

### Disaster Recovery

1. **Restore configuration**:
   ```bash
   sudo systemctl stop vsep vsep-launcher
   sudo restore-from-backup /var/lib/vsep /etc/vsep
   sudo systemctl start vsep vsep-launcher
   ```

2. **Regenerate certificates** (if using self-signed):
   ```bash
   sudo systemctl restart vsep-ssl-setup
   ```

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**:
   ```bash
   # Regenerate certificates
   sudo rm -rf /var/lib/vsep/ssl/*
   sudo systemctl restart vsep-ssl-setup
   ```

2. **Redis Connection Failed**:
   ```bash
   # Check Redis status
   sudo systemctl status redis-vsep
   
   # Test Redis connection
   redis-cli -h 127.0.0.1 -p 6379 ping
   ```

3. **Chromium Won't Start**:
   ```bash
   # Check display server
   echo $DISPLAY
   
   # Test X11 access
   sudo -u vsep xrandr
   
   # Check audio permissions
   sudo -u vsep aplay -l
   ```

4. **Port Already in Use**:
   ```bash
   # Find process using port
   sudo netstat -tlnp | grep :3000
   
   # Change port in configuration
   services.vsep.port = 3001;
   ```

### Debug Mode

Enable debug logging:

```nix
services.vsep = {
  logLevel = "debug";
  extraEnvironment = {
    DEBUG = "vsep:*";
    NODE_ENV = "development";
  };
};
```

### Manual Testing

Test components individually:

```bash
# Test Node.js server directly
sudo -u vsep /nix/store/.../bin/vsep-server

# Test launcher without displays
sudo -u vsep /nix/store/.../bin/vsep --no-multimonitor

# Test Redis connection
redis-cli -h 127.0.0.1 -p 6379 ping

# Test SSL certificates
openssl x509 -in /var/lib/vsep/ssl/cert.crt -text -noout
```

## Performance Tuning

### System Limits

```nix
# Increase file descriptor limits
boot.kernel.sysctl = {
  "fs.file-max" = 2097152;
  "fs.nr_open" = 1048576;
};

# Network performance
boot.kernel.sysctl = {
  "net.core.rmem_max" = 16777216;
  "net.core.wmem_max" = 16777216;
};
```

### Hardware Acceleration

```nix
# Enable GPU acceleration
hardware.opengl = {
  enable = true;
  driSupport = true;
  driSupport32Bit = true;
};

# Intel GPU support
hardware.opengl.extraPackages = with pkgs; [
  intel-media-driver
  vaapiIntel
  vaapiVdpau
  libvdpau-va-gl
];
```

### Audio Optimization

```nix
# Low-latency audio
hardware.pulseaudio = {
  enable = true;
  extraConfig = ''
    default-sample-format = s16le
    default-sample-rate = 48000
    alternate-sample-rate = 44100
  '';
};
```

## Development

### Development Environment

For development, use a modified configuration:

```nix
services.vsep = {
  enable = true;
  environment = "development";
  projection.enableKiosk = false;  # Windowed mode for development
  ssl.generateSelfSigned = true;
  extraEnvironment = {
    DEBUG = "vsep:*";
    NODE_ENV = "development";
  };
};
```

### Custom Package

To use a custom VSEP package (e.g., development version):

```nix
services.vsep.package = pkgs.stdenv.mkDerivation {
  pname = "vsep-dev";
  version = "dev";
  src = /path/to/local/source;
  # ... build configuration
};
```

## Migration

### From Manual Installation

1. **Stop existing services**:
   ```bash
   sudo systemctl stop vsep-manual
   sudo systemctl disable vsep-manual
   ```

2. **Backup data**:
   ```bash
   sudo cp -r /opt/vsep/data /tmp/vsep-backup
   ```

3. **Configure NixOS module**:
   ```nix
   services.vsep = {
     enable = true;
     # Import your existing configuration
   };
   ```

4. **Migrate data**:
   ```bash
   sudo cp -r /tmp/vsep-backup/* /var/lib/vsep/
   sudo chown -R vsep:vsep /var/lib/vsep
   ```

### From Docker

1. **Export Docker volumes**:
   ```bash
   docker cp vsep-container:/app/data ./vsep-data
   ```

2. **Configure NixOS**:
   ```nix
   services.vsep.enable = true;
   ```

3. **Import data**:
   ```bash
   sudo cp -r ./vsep-data/* /var/lib/vsep/
   sudo systemctl restart vsep
   ```

## Contributing

### Module Development

The module is structured as:

```
nixos/
├── modules/
│   ├── vsep.nix           # Main module
│   └── vsep.md            # Documentation
├── example-configuration.nix  # Example usage
└── README.md              # Quick start guide
```

### Testing

Test the module with:

```bash
# Build test VM
nixos-rebuild build-vm -I nixos-config=./example-configuration.nix

# Run test VM
./result/bin/run-*-vm
```

### Submitting Changes

1. Test in a VM environment
2. Update documentation
3. Follow NixOS module conventions
4. Submit pull request with examples