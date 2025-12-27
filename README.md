# FunBible

A feature-rich terminal Bible reader written in Python with version management, smart search, and a beautiful CLI.

## Features

- **📖 Interactive Shell**: Type `funbible` to enter a powerful interactive shell with tab completion and command history
- **🔍 Smart Search**: Hybrid search combining exact substring matching with fuzzy search for typo tolerance
- **📚 Version Management**: Download and switch between multiple Bible versions on-demand
- **🌐 Online Lookup**: Fetch verses from [biblia.bg](https://biblia.bg) when offline copies aren't available
- **📋 Clipboard Integration**: Automatically copy results to your clipboard
- **🎨 Rich Output**: Beautiful colored terminal output with syntax highlighting
- **⚡ Quick Commands**: Direct CLI access for one-shot lookups without entering the shell

## Installation

This project uses [Poetry](https://python-poetry.org/) for dependency management.

```bash
# Clone the repository
git clone https://github.com/m-krastev/funbible.git
cd funbible

# Install dependencies
poetry install

# Or install globally with pip
pip install .
```

## Quick Start

```bash
# Start interactive shell
funbible

# Quick verse lookup
funbible get "John 3:16"

# Search for text
funbible find "love"

# Get a random verse
funbible random

# List available Bible versions
funbible version list --all

# Install a new version
funbible version install kjv

# Set default version
funbible version default kjv
```

## Usage

### Interactive Shell

```bash
funbible
```

Inside the shell:

```text
funbible> John 3:16
16 For God so loved the world...

funbible> find love
ℹ Found 10 results (5 exact, 5 fuzzy)
= (John 3:16) For God so loved the world...
...

funbible> version use kjv
✓ Switched to King James Version

funbible> random
Romans 8:28
And we know that all things work together for good...

funbible> help
```

### Shell Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `find <text>` | `f`, `s` | Search for verses containing text |
| `more` | `m` | Show more results from last search |
| `book <name>` | `b` | Display an entire book |
| `random` | `r` | Display a random verse |
| `version` | `v` | Manage Bible versions |
| `copy` | `c` | Toggle clipboard copying |
| `config` | - | View/modify settings |
| `exit` | `q` | Exit the shell |

### Version Management

```bash
# List installed versions
funbible version list

# List all available versions (including downloadable)
funbible version list --all

# Install a version
funbible version install kjv

# Set as default
funbible version default kjv

# Remove a version
funbible version remove kjv
```

### Available Versions

| ID | Name | Language |
|----|------|----------|
| `biblia-1940` | Bulgarian Bible 1940 | Bulgarian |
| `biblia-revizirano` | Bulgarian Bible Revised | Bulgarian |
| `kjv` | King James Version | English |
| `asv` | American Standard Version | English |
| `bbe` | Bible in Basic English | English |
| `web` | World English Bible | English |

### Configuration

Settings are stored in `~/.config/funbible/config.json`:

```bash
# View all settings
funbible config

# Set a value
funbible config auto_copy true
funbible config search_limit 20
funbible config fuzzy_threshold 60
```

## CLI Options

```bash
funbible --help
funbible get --help
funbible version --help
```

## License

MIT License - see LICENSE file for details.
