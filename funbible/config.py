"""Configuration management for FunBible."""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

# XDG-compliant paths
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "funbible"
DATA_DIR = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "funbible"
VERSIONS_DIR = DATA_DIR / "versions"
CONFIG_FILE = CONFIG_DIR / "config.json"

# Default configuration
DEFAULT_CONFIG = {
    "default_version": "biblia-1940",
    "auto_copy": False,
    "color_output": True,
    "search_limit": 10,
    "fuzzy_threshold": 70,
    "verse_newlines": True,  # If True, verses on separate lines; if False, joined with space
}

# Available versions for download (could be fetched from an API)
AVAILABLE_VERSIONS = {
    "biblia-1940": {
        "name": "Bulgarian Bible 1940",
        "language": "bg",
        "bundled": True,
        "description": "Bulgarian Protestant Bible, 1940 edition",
    },
    "biblia-revizirano": {
        "name": "Bulgarian Bible Revised",
        "language": "bg",
        "bundled": True,
        "description": "Bulgarian Protestant Bible, Revised edition",
    },
    "kjv": {
        "name": "King James Version",
        "language": "en",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json",
        "description": "King James Version (1611)",
    },
    "asv": {
        "name": "American Standard Version",
        "language": "en",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_asv.json",
        "description": "American Standard Version (1901)",
    },
    "bbe": {
        "name": "Bible in Basic English",
        "language": "en",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json",
        "description": "Bible in Basic English",
    },
    "web": {
        "name": "World English Bible",
        "language": "en",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_web.json",
        "description": "World English Bible (Public Domain)",
    },
}


def ensure_dirs() -> None:
    """Ensure configuration and data directories exist."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> Dict[str, Any]:
    """Load configuration from file, creating default if missing."""
    ensure_dirs()
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Merge with defaults for any missing keys
                return {**DEFAULT_CONFIG, **config}
        except (json.JSONDecodeError, IOError):
            pass
    return DEFAULT_CONFIG.copy()


def save_config(config: Dict[str, Any]) -> None:
    """Save configuration to file."""
    ensure_dirs()
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_config_value(key: str) -> Any:
    """Get a specific configuration value."""
    config = load_config()
    return config.get(key, DEFAULT_CONFIG.get(key))


def set_config_value(key: str, value: Any) -> None:
    """Set a specific configuration value."""
    config = load_config()
    config[key] = value
    save_config(config)


def get_installed_versions() -> Dict[str, Dict[str, Any]]:
    """Get list of installed versions (bundled + downloaded)."""
    installed = {}
    
    # Check bundled versions
    base_dir = Path(__file__).parent.parent / "resources"
    for version_id, info in AVAILABLE_VERSIONS.items():
        if info.get("bundled"):
            bible_path = base_dir / f"{version_id}.json"
            if bible_path.exists():
                installed[version_id] = {**info, "path": str(bible_path)}
    
    # Check downloaded versions
    if VERSIONS_DIR.exists():
        for json_file in VERSIONS_DIR.glob("*.json"):
            version_id = json_file.stem
            if version_id not in installed and not version_id.endswith(".lookup"):
                info = AVAILABLE_VERSIONS.get(version_id, {
                    "name": version_id,
                    "language": "unknown",
                    "bundled": False,
                })
                installed[version_id] = {**info, "path": str(json_file)}
    
    return installed


def get_version_path(version_id: str) -> Optional[Path]:
    """Get the path to a version's bible.json file."""
    installed = get_installed_versions()
    if version_id in installed:
        return Path(installed[version_id]["path"])
    return None
