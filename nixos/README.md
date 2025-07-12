# VSEP NixOS Module

A production-ready NixOS module for deploying VSEP (Very Simple Embedded Player) as a system service.

## Quick Start

1. **Add to your NixOS configuration:**

```nix
# /etc/nixos/configuration.nix
{
  imports = [ /path/to/vsep/nixos/modules/vsep.nix ];
  
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
   - Control Panel: https://localhost:3000/control.html
   - Projection: https://localhost:3000/projection-whep.html?id=monitor1

## Features

- 🚀 **Complete Service Management**: Automatic startup, monitoring, and restart
- 🔒 **SSL Certificate Management**: Auto-generated self-signed certificates or custom ones
- 🗃️ **Redis Integration**: Built-in Redis service configuration
- 🖥️ **Multi-Monitor Support**: Automatic display detection and management
- 🔐 **Security Hardening**: User isolation, filesystem permissions, resource limits
- 🌐 **Chromium Integration**: Automated kiosk-mode browser windows
- 📊 **Production Ready**: Logging, monitoring, and backup options

## Configuration Examples

### Minimal Setup

```nix
services.vsep.enable = true;
```

### Production Setup

```nix
services.vsep = {
  enable = true;
  environment = "production";
  port = 443;
  
  ssl = {
    generateSelfSigned = false;
    certFile = "/etc/ssl/certs/vsep.crt";
    keyFile = "/etc/ssl/private/vsep.key";
  };
  
  projection = {
    enableKiosk = true;
    enableMultiMonitor = true;
  };
  
  openFirewall = true;
};
```

### Development Setup

```nix
services.vsep = {
  enable = true;
  environment = "development";
  projection.enableKiosk = false;  # Windowed mode
  extraEnvironment.DEBUG = "vsep:*";
};
```

## File Structure

```
nixos/
├── modules/
│   ├── vsep.nix           # Main NixOS module
│   └── vsep.md            # Detailed documentation
├── example-configuration.nix  # Complete example
├── flake.nix              # Nix flake for modern usage
└── README.md              # This file
```

## Using with Nix Flakes

If you're using Nix flakes, see `flake.nix` for modern integration:

```nix
{
  inputs.vsep.url = "github:your-org/ingester-web?dir=nixos";
  
  outputs = { self, nixpkgs, vsep }: {
    nixosConfigurations.your-host = nixpkgs.lib.nixosSystem {
      modules = [
        vsep.nixosModules.vsep
        { services.vsep.enable = true; }
      ];
    };
  };
}
```

## Services Created

- **`vsep.service`**: Main VSEP server
- **`vsep-launcher.service`**: Display management and browser launcher
- **`vsep-ssl-setup.service`**: SSL certificate generation (if enabled)
- **`redis-vsep.service`**: Redis database (if enabled)

## System Requirements

- **NixOS**: 23.05 or later
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 10GB for base system + logs
- **Network**: TCP port 3000 (configurable)
- **Display**: X11 server for multi-monitor support (optional)

## Documentation

- **[Complete Documentation](modules/vsep.md)**: Detailed configuration, troubleshooting, and examples
- **[Example Configuration](example-configuration.nix)**: Full system configuration example

## Support

### Service Management

```bash
# Check status
sudo systemctl status vsep

# View logs
sudo journalctl -u vsep -f

# Restart service
sudo systemctl restart vsep
```

### Common Issues

1. **Port in use**: Change `services.vsep.port`
2. **SSL errors**: Restart `vsep-ssl-setup.service`
3. **Redis connection**: Check `redis-vsep.service`
4. **Display issues**: Verify X11 server and `xrandr`

See [full documentation](modules/vsep.md#troubleshooting) for detailed troubleshooting.

## Contributing

1. Test changes in a VM: `nixos-rebuild build-vm`
2. Update documentation in `modules/vsep.md`
3. Follow NixOS module conventions
4. Include configuration examples

## License

Apache 2.0 License - see main project for details.