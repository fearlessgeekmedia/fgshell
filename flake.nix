{
  description = "fgshell - A shell written in JavaScript that probably shouldn't exist, but does";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          name = "fgshell";
          version = "0.1.0";
          
          src = ./.;
          
          buildInputs = with pkgs; [
            bun
            nodejs
            gnumake
            gcc
            pkg-config
          ];
          
          phases = [ "unpackPhase" "buildPhase" "installPhase" ];
          
          buildPhase = ''
            export HOME=$TMPDIR
            export BUN_INSTALL=$TMPDIR/.bun
            
            # Build native job control library
            bash build-ptctl.sh
            
            # Build the shell
            bun build-fgsh.js
          '';
          
          installPhase = ''
            mkdir -p $out/bin
            if [ -f fgsh ]; then
              cp fgsh $out/bin/fgsh
              chmod +x $out/bin/fgsh
            else
              echo "ERROR: fgsh binary not built"
              exit 1
            fi
          '';
          
          meta = {
            description = "A shell written in JavaScript that probably shouldn't exist, but does";
            license = nixpkgs.lib.licenses.unlicense;
            platforms = nixpkgs.lib.platforms.unix;
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun
            nodejs
            gnumake
            gcc
            pkg-config
            sqlite
          ];
        };
      }
    );
}
