{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.services.vsep;

  # Create a custom package for VSEP
  vsepPackage = pkgs.stdenv.mkDerivation rec {
    pname = "vsep";
    version = "0.0.0";

    src = pkgs.fetchFromGitHub {
      owner = "your-org";  # Replace with actual GitHub org/user
      repo = "ingester-web";  # Replace with actual repo name
      rev = "main";  # Replace with specific commit or tag
      sha256 = "0000000000000000000000000000000000000000000000000000";  # Replace with actual sha256
    };

    buildInputs = with pkgs; [
      nodejs_20
      python3
      pkg-config
      cairo
      pango
      libpng
      libjpeg
      giflib
      librsvg
      pixman
    ];

    nativeBuildInputs = with pkgs; [
      nodejs_20
      nodePackages.npm
      nodePackages.node-gyp
    ];

    configurePhase = ''
      export HOME=$TMPDIR
      npm config set cache $TMPDIR/.npm
    '';

    buildPhase = ''
      # Install root dependencies
      npm ci --production

      # Install static dependencies
      cd src/static
      npm ci --production
      cd ../..

      # Build the project
      npm run build
    '';

    installPhase = ''
      mkdir -p $out/{bin,lib/vsep,share/vsep}
      
      # Copy built application
      cp -r dist/ $out/lib/vsep/
      cp -r config/ $out/lib/vsep/
      cp -r src/static/ $out/lib/vsep/
      cp -r node_modules/ $out/lib/vsep/
      cp package.json package-lock.json $out/lib/vsep/
      cp launcher.js $out/lib/vsep/
      cp dev-chromium.js $out/lib/vsep/

      # Create wrapper script
      cat > $out/bin/vsep <<EOF
      #!${pkgs.bash}/bin/bash
      export PATH="${pkgs.nodejs_20}/bin:${pkgs.redis}/bin:\$PATH"
      cd $out/lib/vsep
      exec ${pkgs.nodejs_20}/bin/node launcher.js "\$@"
      EOF
      chmod +x $out/bin/vsep

      # Create systemd service helper
      cat > $out/bin/vsep-server <<EOF
      #!${pkgs.bash}/bin/bash
      export PATH="${pkgs.nodejs_20}/bin:\$PATH"
      cd $out/lib/vsep
      exec ${pkgs.nodejs_20}/bin/node dist/index.js
      EOF
      chmod +x $out/bin/vsep-server

      # Copy documentation
      cp README.md CLAUDE.md $out/share/vsep/ || true
    '';

    meta = with lib; {
      description = "VSEP - Very Simple Embedded Player for media projection";
      homepage = "https://github.com/your-org/ingester-web";
      license = licenses.asl20;
      maintainers = [];
      platforms = platforms.linux;
    };
  };

  # Configuration file for VSEP
  vsepConfig = pkgs.writeText "vsep-config.json" (builtins.toJSON {
    environment = cfg.environment;
    port = cfg.port;
    host = cfg.host;
    redis = {
      host = cfg.redis.host;
      port = cfg.redis.port;
      db = cfg.redis.database;
    };
    ssl = {
      cert = cfg.ssl.certFile;
      key = cfg.ssl.keyFile;
    };
    projection = {
      enableKiosk = cfg.projection.enableKiosk;
      enableMultiMonitor = cfg.projection.enableMultiMonitor;
    };
  });

  # SSL certificate generation script
  generateCerts = pkgs.writeScriptBin "vsep-generate-certs" ''
    #!${pkgs.bash}/bin/bash
    set -euo pipefail

    CERT_DIR="$1"
    DOMAIN="''${2:-localhost}"

    mkdir -p "$CERT_DIR"

    if [[ ! -f "$CERT_DIR/cert.key" || ! -f "$CERT_DIR/cert.crt" ]]; then
      echo "Generating self-signed SSL certificate for $DOMAIN..."
      
      ${pkgs.openssl}/bin/openssl req -x509 -newkey rsa:4096 -keyout "$CERT_DIR/cert.key" \
        -out "$CERT_DIR/cert.crt" -days 365 -nodes -subj "/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"
      
      chmod 600 "$CERT_DIR/cert.key"
      chmod 644 "$CERT_DIR/cert.crt"
      
      echo "SSL certificate generated at $CERT_DIR"
    else
      echo "SSL certificate already exists at $CERT_DIR"
    fi
  '';

in {
  options.services.vsep = {
    enable = mkEnableOption "VSEP media projection service";

    package = mkOption {
      type = types.package;
      default = vsepPackage;
      description = "The VSEP package to use";
    };

    user = mkOption {
      type = types.str;
      default = "vsep";
      description = "User account under which VSEP runs";
    };

    group = mkOption {
      type = types.str;
      default = "vsep";
      description = "Group account under which VSEP runs";
    };

    environment = mkOption {
      type = types.enum [ "development" "production" "test" ];
      default = "production";
      description = "Runtime environment for VSEP";
    };

    port = mkOption {
      type = types.port;
      default = 3000;
      description = "Port on which VSEP server listens";
    };

    host = mkOption {
      type = types.str;
      default = "0.0.0.0";
      description = "Host address on which VSEP server binds";
    };

    dataDir = mkOption {
      type = types.path;
      default = "/var/lib/vsep";
      description = "Directory to store VSEP data";
    };

    configDir = mkOption {
      type = types.path;
      default = "/etc/vsep";
      description = "Directory to store VSEP configuration";
    };

    ssl = {
      certFile = mkOption {
        type = types.path;
        default = "/var/lib/vsep/ssl/cert.crt";
        description = "Path to SSL certificate file";
      };

      keyFile = mkOption {
        type = types.path;
        default = "/var/lib/vsep/ssl/cert.key";
        description = "Path to SSL private key file";
      };

      generateSelfSigned = mkOption {
        type = types.bool;
        default = true;
        description = "Whether to generate self-signed certificates automatically";
      };
    };

    redis = {
      host = mkOption {
        type = types.str;
        default = "127.0.0.1";
        description = "Redis server host";
      };

      port = mkOption {
        type = types.port;
        default = 6379;
        description = "Redis server port";
      };

      database = mkOption {
        type = types.int;
        default = 0;
        description = "Redis database number";
      };

      enable = mkOption {
        type = types.bool;
        default = true;
        description = "Whether to enable Redis service automatically";
      };
    };

    projection = {
      enableKiosk = mkOption {
        type = types.bool;
        default = false;
        description = "Enable kiosk mode for projection displays";
      };

      enableMultiMonitor = mkOption {
        type = types.bool;
        default = true;
        description = "Enable multi-monitor projection support";
      };

      chromiumPackage = mkOption {
        type = types.package;
        default = pkgs.chromium;
        description = "Chromium package to use for projection displays";
      };
    };

    openFirewall = mkOption {
      type = types.bool;
      default = false;
      description = "Whether to open the firewall for VSEP port";
    };

    extraEnvironment = mkOption {
      type = types.attrsOf types.str;
      default = {};
      description = "Additional environment variables for VSEP";
      example = {
        NODE_ENV = "production";
        DEBUG = "vsep:*";
      };
    };

    logLevel = mkOption {
      type = types.enum [ "error" "warn" "info" "debug" ];
      default = "info";
      description = "Log level for VSEP service";
    };
  };

  config = mkIf cfg.enable {
    # Create user and group
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.group;
      home = cfg.dataDir;
      createHome = true;
      description = "VSEP service user";
      extraGroups = [ "audio" "video" ];  # For media access
    };

    users.groups.${cfg.group} = {};

    # Enable Redis if requested
    services.redis.servers.vsep = mkIf cfg.redis.enable {
      enable = true;
      bind = cfg.redis.host;
      port = cfg.redis.port;
      databases = cfg.redis.database + 1;
    };

    # Create necessary directories
    systemd.tmpfiles.rules = [
      "d ${cfg.dataDir} 0755 ${cfg.user} ${cfg.group} -"
      "d ${cfg.dataDir}/ssl 0700 ${cfg.user} ${cfg.group} -"
      "d ${cfg.dataDir}/logs 0755 ${cfg.user} ${cfg.group} -"
      "d ${cfg.dataDir}/profiles 0755 ${cfg.user} ${cfg.group} -"
      "d ${cfg.configDir} 0755 ${cfg.user} ${cfg.group} -"
    ];

    # Generate SSL certificates if needed
    systemd.services.vsep-ssl-setup = mkIf cfg.ssl.generateSelfSigned {
      description = "Generate SSL certificates for VSEP";
      wantedBy = [ "vsep.service" ];
      before = [ "vsep.service" ];
      serviceConfig = {
        Type = "oneshot";
        User = cfg.user;
        Group = cfg.group;
        ExecStart = "${generateCerts}/bin/vsep-generate-certs ${cfg.dataDir}/ssl localhost";
        RemainAfterExit = true;
      };
    };

    # Main VSEP service
    systemd.services.vsep = {
      description = "VSEP Media Projection Service";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ] ++ optional cfg.redis.enable "redis-vsep.service"
                                   ++ optional cfg.ssl.generateSelfSigned "vsep-ssl-setup.service";
      wants = optional cfg.redis.enable "redis-vsep.service"
           ++ optional cfg.ssl.generateSelfSigned "vsep-ssl-setup.service";

      environment = {
        NODE_ENV = cfg.environment;
        PORT = toString cfg.port;
        HOST = cfg.host;
        REDIS_HOST = cfg.redis.host;
        REDIS_PORT = toString cfg.redis.port;
        REDIS_DB = toString cfg.redis.database;
        SSL_CERT = cfg.ssl.certFile;
        SSL_KEY = cfg.ssl.keyFile;
        LOG_LEVEL = cfg.logLevel;
        HOME = cfg.dataDir;
      } // cfg.extraEnvironment;

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = "${cfg.package}/lib/vsep";
        ExecStart = "${cfg.package}/bin/vsep-server";
        Restart = "always";
        RestartSec = "10s";
        
        # Security settings
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadWritePaths = [ cfg.dataDir cfg.configDir ];
        
        # Resource limits
        LimitNOFILE = "65536";
        MemoryMax = "2G";
        
        # Logging
        StandardOutput = "journal";
        StandardError = "journal";
        SyslogIdentifier = "vsep";
      };

      # Graceful shutdown
      preStop = ''
        ${pkgs.coreutils}/bin/sleep 5
      '';
    };

    # VSEP launcher service (for display management)
    systemd.services.vsep-launcher = {
      description = "VSEP Display Launcher";
      wantedBy = [ "multi-user.target" ];
      after = [ "vsep.service" "graphical-session.target" ];
      wants = [ "vsep.service" ];
      
      environment = {
        DISPLAY = ":0";
        HOME = cfg.dataDir;
      };

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = "${cfg.package}/lib/vsep";
        ExecStart = "${cfg.package}/bin/vsep --skip-build --skip-npm --skip-git --env ${cfg.environment} --port ${toString cfg.port}";
        Restart = "always";
        RestartSec = "10s";
        
        # Display access
        SupplementaryGroups = [ "audio" "video" ];
        
        # Logging
        StandardOutput = "journal";
        StandardError = "journal";
        SyslogIdentifier = "vsep-launcher";
      };
    };

    # Open firewall if requested
    networking.firewall.allowedTCPPorts = mkIf cfg.openFirewall [ cfg.port ];

    # Install required packages system-wide
    environment.systemPackages = with pkgs; [
      cfg.package
      cfg.projection.chromiumPackage
      xorg.xrandr  # For multi-monitor detection
      curl         # For health checks
    ];

    # Enable required services
    services.xserver = mkIf cfg.projection.enableMultiMonitor {
      enable = mkDefault true;
      displayManager.autoLogin = {
        enable = mkDefault true;
        user = cfg.user;
      };
    };

    # Font packages for Chromium
    fonts.packages = with pkgs; [
      dejavu_fonts
      liberation_ttf
      noto-fonts
      noto-fonts-cjk
      noto-fonts-emoji
    ];

    # Audio support
    hardware.pulseaudio.enable = mkDefault true;
    
    # Add user to audio group for media playback
    users.users.${cfg.user}.extraGroups = [ "audio" "video" ];
  };

  meta = {
    maintainers = with lib.maintainers; [ ];
    doc = ./vsep.md;
  };
}