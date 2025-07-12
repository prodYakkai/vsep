# Example NixOS configuration for VSEP
# This file shows how to integrate VSEP into your NixOS system configuration

{ config, pkgs, ... }:

{
  imports = [
    # Import the VSEP module
    ./modules/vsep.nix
  ];

  # Basic system configuration
  system.stateVersion = "23.11";
  
  # Enable VSEP service
  services.vsep = {
    enable = true;
    
    # Basic configuration
    environment = "production";
    port = 3000;
    host = "0.0.0.0";
    
    # User and permissions
    user = "vsep";
    group = "vsep";
    
    # Data directories
    dataDir = "/var/lib/vsep";
    configDir = "/etc/vsep";
    
    # SSL configuration
    ssl = {
      generateSelfSigned = true;  # Generate self-signed certs automatically
      certFile = "/var/lib/vsep/ssl/cert.crt";
      keyFile = "/var/lib/vsep/ssl/cert.key";
    };
    
    # Redis configuration
    redis = {
      enable = true;        # Enable Redis automatically
      host = "127.0.0.1";
      port = 6379;
      database = 0;
    };
    
    # Projection display settings
    projection = {
      enableKiosk = true;           # Enable fullscreen kiosk mode
      enableMultiMonitor = true;    # Enable multi-monitor support
      chromiumPackage = pkgs.chromium;  # Use system Chromium
    };
    
    # Network configuration
    openFirewall = true;  # Open port 3000 in firewall
    
    # Additional environment variables
    extraEnvironment = {
      NODE_ENV = "production";
      DEBUG = "";  # Disable debug logging in production
    };
    
    # Logging
    logLevel = "info";
  };

  # Additional system configuration for VSEP

  # X11 and display manager (required for multi-monitor)
  services.xserver = {
    enable = true;
    displayManager = {
      autoLogin = {
        enable = true;
        user = "vsep";
      };
      # Use a lightweight display manager
      lightdm.enable = true;
    };
    # Use a minimal window manager
    windowManager.i3.enable = true;
    desktopManager.xterm.enable = false;
  };

  # Audio support for media playback
  hardware.pulseaudio = {
    enable = true;
    systemWide = true;  # Enable system-wide audio
  };

  # Network configuration
  networking = {
    hostName = "vsep-server";
    
    # Configure firewall
    firewall = {
      enable = true;
      allowedTCPPorts = [ 
        22    # SSH
        3000  # VSEP (also opened by services.vsep.openFirewall)
        6379  # Redis (if accessed externally)
      ];
    };
    
    # DNS configuration
    nameservers = [ "8.8.8.8" "1.1.1.1" ];
  };

  # System packages
  environment.systemPackages = with pkgs; [
    # Development tools
    git
    curl
    wget
    htop
    tree
    
    # Media tools
    ffmpeg
    gstreamer
    
    # Network tools
    netcat
    telnet
    nmap
  ];

  # User configuration
  users.users.root.openssh.authorizedKeys.keys = [
    # Add your SSH public keys here
    # "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAA... user@example.com"
  ];

  # SSH service
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "prohibit-password";
    };
  };

  # Automatic system updates (optional)
  system.autoUpgrade = {
    enable = false;  # Enable if you want automatic updates
    allowReboot = false;
  };

  # Garbage collection
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };

  # Performance tuning for media applications
  boot.kernel.sysctl = {
    # Increase file descriptor limits
    "fs.file-max" = 2097152;
    "fs.nr_open" = 1048576;
    
    # Network performance
    "net.core.rmem_max" = 16777216;
    "net.core.wmem_max" = 16777216;
    "net.ipv4.tcp_rmem" = "4096 87380 16777216";
    "net.ipv4.tcp_wmem" = "4096 65536 16777216";
    
    # Virtual memory
    "vm.swappiness" = 10;
  };

  # Hardware configuration for media workloads
  hardware = {
    # Enable hardware video acceleration
    opengl = {
      enable = true;
      driSupport = true;
      driSupport32Bit = true;
    };
    
    # CPU governor for performance
    cpu.intel.updateMicrocode = true;  # For Intel CPUs
    # cpu.amd.updateMicrocode = true;  # For AMD CPUs
  };

  # Time zone and locale
  time.timeZone = "UTC";
  i18n.defaultLocale = "en_US.UTF-8";

  # Font configuration for Chromium displays
  fonts = {
    enableDefaultPackages = true;
    packages = with pkgs; [
      dejavu_fonts
      liberation_ttf
      noto-fonts
      noto-fonts-cjk
      noto-fonts-emoji
      font-awesome
    ];
  };

  # Systemd service overrides (optional)
  systemd.services.vsep = {
    # Add additional service dependencies
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    
    # Custom restart policy
    serviceConfig = {
      RestartSec = "30s";
      StartLimitBurst = 5;
      StartLimitIntervalSec = 300;
    };
  };

  # Log rotation for VSEP
  services.logrotate = {
    enable = true;
    settings.vsep = {
      files = "/var/lib/vsep/logs/*.log";
      frequency = "daily";
      rotate = 30;
      compress = true;
      delaycompress = true;
      missingok = true;
      notifempty = true;
      create = "644 vsep vsep";
    };
  };

  # Monitoring (optional)
  services.prometheus = {
    enable = false;  # Enable if you want monitoring
    port = 9090;
    exporters = {
      node = {
        enable = false;  # Enable for system metrics
        enabledCollectors = [ "systemd" "processes" "network" ];
      };
    };
  };

  # Backup configuration (optional)
  services.borgbackup.jobs = {
    vsep-data = {
      enable = false;  # Enable if you want automated backups
      paths = [
        "/var/lib/vsep"
        "/etc/vsep"
      ];
      exclude = [
        "/var/lib/vsep/logs"
        "/var/lib/vsep/profiles"
      ];
      repo = "/backup/vsep";  # Configure your backup destination
      compression = "auto,zstd";
      startAt = "daily";
      user = "root";
    };
  };
}