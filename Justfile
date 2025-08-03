prompt := BOLD + GREEN + ">>>" + NORMAL

root := justfile_directory()

alias b := build
alias c := check
alias f := format
alias fmt := format

# list recipes
[private]
default:
	@just --list --unsorted

# Install the action dependencies
install:
	@echo "{{prompt}} Installing dependencies"
	@npm clean-install

# Build the action locally
build: install
	@echo "{{prompt}} Building typescript code"
	@npm run build

# Run the typescript compiler lints
check: install
	@echo "{{prompt}} Linting typescript code"
	@npm run lint

# Update the compiled action in dist (for releases)
update: clean install check
	@echo "{{prompt}} Updating dist"
	@rm --recursive --force {{ root / 'dist' }}
	@cp --recursive {{ root / 'build ' }} {{ root / 'dist' }}

# Format the Typescript code
format:
	@echo "{{prompt}} Formatting with prettier in src"
	@npm run format

# Update the package thumbnail
lock:
	@echo "{{prompt}} Updating npm lockfile"
	@npm install --package-lock-only

# Clean temporary artifacts
clean:
	@rm --recursive --force {{ root / 'node_modules' }}
	@rm --recursive --force {{ root / 'dist' }}
	@rm --recursive --force {{ root / 'docs' / 'book' / 'dist' }}
