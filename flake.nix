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
          version = "0.0.2a";
          
          src = builtins.filterSource
            (path: type:
              let baseName = builtins.baseNameOf path;
              in !(builtins.elem baseName [".git" "result" "node_modules" "fgshell-pty.node" "pty-2zx5wcm5.node" "libptctl.so" "fgsh" "fgsh-backup" ".yarn" "dist"])
            )
            ./.;
          
          buildInputs = with pkgs; [
            bun
            nodejs
            gnumake
            gcc
            pkg-config
          ];
          
          phases = [ "unpackPhase" "buildPhase" "installPhase" ];
          
          __impure = true;
          impureEnvVars = pkgs.lib.fetchers.proxyImpureEnvVars ++ [ "GIT_PROXY_COMMAND" "SOCKS_SERVER" ];
          
          buildPhase = ''
            export HOME=$TMPDIR
            export BUN_INSTALL=$TMPDIR/.bun
            mkdir -p $BUN_INSTALL
            
            # Install dependencies
            bun install
            
            # Build native job control library
            bash build-ptctl.sh
          '';
          
          installPhase = ''
            mkdir -p $out/bin $out/lib
            
            # Copy the fgshell.js source and all dependencies
            cp src/fgshell.js $out/lib/
            cp -r src/*.js $out/lib/ 2>/dev/null || true
            cp -r node_modules $out/lib/
            cp -r fakehome $out/lib/ 2>/dev/null || true
            cp *.node $out/lib/ 2>/dev/null || true
            cp *.so $out/lib/ 2>/dev/null || true
            
            # Create bash wrapper script that uses bun to run fgshell.js
            cat > $out/bin/fgsh << WRAPPER
            #!${pkgs.bash}/bin/bash
            LIBDIR="\$( dirname "\$(readlink -f "\$0")")/../lib"
            cd "\$LIBDIR"
            exec ${pkgs.bun}/bin/bun ./fgshell.js "\$@"
            WRAPPER
            chmod +x $out/bin/fgsh
            
            # Copy package.json to lib so version can be read
            cp package.json $out/lib/
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
