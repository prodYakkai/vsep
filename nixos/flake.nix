{
  description = "VSEP NixOS Module - Very Simple Embedded Player";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    let
      # Supported systems
      systems = [ "x86_64-linux" "aarch64-linux" ];
      
      # Helper function to generate outputs for each system
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      # NixOS Modules
      nixosModules = {
        vsep = import ./modules/vsep.nix;
        default = self.nixosModules.vsep;
      };

      # Packages for each system
      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          
          # VSEP package definition
          vsep = pkgs.stdenv.mkDerivation rec {
            pname = "vsep";
            version = "0.0.0";

            # For development, use local source
            src = pkgs.lib.cleanSource ../.;
            
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

              # Create wrapper scripts
              cat > $out/bin/vsep <<EOF
              #!${pkgs.bash}/bin/bash
              export PATH="${pkgs.nodejs_20}/bin:${pkgs.redis}/bin:\$PATH"
              cd $out/lib/vsep
              exec ${pkgs.nodejs_20}/bin/node launcher.js "\$@"
              EOF
              chmod +x $out/bin/vsep

              cat > $out/bin/vsep-server <<EOF
              #!${pkgs.bash}/bin/bash
              export PATH="${pkgs.nodejs_20}/bin:\$PATH"
              cd $out/lib/vsep
              exec ${pkgs.nodejs_20}/bin/node dist/index.js "\$@"
              EOF
              chmod +x $out/bin/vsep-server

              # Copy documentation
              cp README.md CLAUDE.md $out/share/vsep/ || true
            '';

            meta = with pkgs.lib; {
              description = "VSEP - Very Simple Embedded Player for media projection";
              homepage = "https://github.com/your-org/ingester-web";
              license = licenses.asl20;
              maintainers = [ ];
              platforms = platforms.linux;
            };
          };

        in {
          inherit vsep;
          default = vsep;
        }
      );

      # Development shells
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              # Node.js development
              nodejs_20
              nodePackages.npm
              nodePackages.typescript
              nodePackages.ts-node
              
              # System dependencies
              redis
              chromium
              
              # Development tools
              git
              curl
              jq
              
              # NixOS tools
              nixos-rebuild
              nixfmt
            ];

            shellHook = ''
              echo "🚀 VSEP Development Environment"
              echo "Node.js: $(node --version)"
              echo "NPM: $(npm --version)"
              echo ""
              echo "Available commands:"
              echo "  npm run dev          - Start development server"
              echo "  npm run dev:chromium - Launch development browser"
              echo "  npm run build        - Build for production"
              echo "  nixos-rebuild build-vm - Test NixOS module"
              echo ""
            '';
          };
        }
      );

      # NixOS configuration examples
      nixosConfigurations = {
        # Minimal VSEP server
        vsep-minimal = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            self.nixosModules.vsep
            {
              services.vsep.enable = true;
              
              # Minimal system configuration
              boot.loader.grub.device = "/dev/sda";
              fileSystems."/" = { device = "/dev/sda1"; fsType = "ext4"; };
              networking.hostName = "vsep-minimal";
              system.stateVersion = "23.11";
            }
          ];
        };

        # Production VSEP server
        vsep-production = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            self.nixosModules.vsep
            {
              services.vsep = {
                enable = true;
                environment = "production";
                port = 443;
                openFirewall = true;
                
                projection = {
                  enableKiosk = true;
                  enableMultiMonitor = true;
                };
                
                ssl = {
                  generateSelfSigned = false;
                  certFile = "/etc/ssl/certs/vsep.crt";
                  keyFile = "/etc/ssl/private/vsep.key";
                };
              };

              # Production system hardening
              security.sudo.wheelNeedsPassword = false;
              users.users.admin = {
                isNormalUser = true;
                extraGroups = [ "wheel" ];
                openssh.authorizedKeys.keys = [
                  # Add your SSH keys here
                ];
              };

              services.openssh = {
                enable = true;
                settings = {
                  PasswordAuthentication = false;
                  PermitRootLogin = "no";
                };
              };

              # System configuration
              boot.loader.grub.device = "/dev/sda";
              fileSystems."/" = { device = "/dev/sda1"; fsType = "ext4"; };
              networking.hostName = "vsep-production";
              system.stateVersion = "23.11";
            }
          ];
        };
      };

      # CI/CD apps
      apps = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in {
          # Test the NixOS module
          test-module = {
            type = "app";
            program = "${pkgs.writeShellScript "test-vsep-module" ''
              set -euo pipefail
              echo "🧪 Testing VSEP NixOS Module"
              
              # Build test VM
              echo "Building test VM..."
              nixos-rebuild build-vm \
                --flake .#vsep-minimal \
                --no-out-link
              
              echo "✅ Module builds successfully"
              echo "Run 'nixos-rebuild build-vm --flake .#vsep-minimal && ./result/bin/run-*-vm' to test"
            ''}";
          };

          # Format Nix files
          format = {
            type = "app";
            program = "${pkgs.writeShellScript "format-nix" ''
              echo "🎨 Formatting Nix files..."
              find . -name "*.nix" -exec ${pkgs.nixfmt}/bin/nixfmt {} \;
              echo "✅ Formatting complete"
            ''}";
          };

          # Validate configuration
          check = {
            type = "app";
            program = "${pkgs.writeShellScript "check-config" ''
              set -euo pipefail
              echo "🔍 Validating VSEP configuration..."
              
              # Check Nix syntax
              for file in modules/*.nix *.nix; do
                if [ -f "$file" ]; then
                  echo "Checking $file..."
                  nix-instantiate --parse "$file" > /dev/null
                fi
              done
              
              # Build packages to verify they work
              echo "Building VSEP package..."
              nix build .#vsep --no-link
              
              echo "✅ All checks passed"
            ''}";
          };

          default = self.apps.${system}.test-module;
        }
      );

      # Hydra jobsets for CI
      hydraJobs = {
        inherit (self) packages;
        
        # Test NixOS configurations
        nixos-tests = forAllSystems (system: {
          vsep-minimal = self.nixosConfigurations.vsep-minimal.config.system.build.vm;
          vsep-production = self.nixosConfigurations.vsep-production.config.system.build.vm;
        });
      };

      # Overlays for custom package versions
      overlays.default = final: prev: {
        vsep = self.packages.${final.system}.vsep;
      };
    };
}