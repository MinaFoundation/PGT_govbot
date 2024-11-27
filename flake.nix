{
  description = "Next.js development environment with Podman";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # Systems support
    systems.url = "github:nix-systems/default";
  };

  outputs = { self, nixpkgs, systems, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Core dependencies
            nodejs_20
            nodePackages.typescript
            podman
            podman-compose
            direnv
            git
          ];

          # Add environment variables
          env = {
            NODE_ENV = "production";
          };
        };
      });
}
