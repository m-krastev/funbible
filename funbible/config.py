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
    "default_version": "bg_bbd",
    "auto_copy": False,
    "color_output": True,
    "search_limit": 10,
    "fuzzy_threshold": 70,
    "verse_newlines": True,  # If True, verses on separate lines; if False, joined with space
}

# Available versions for download (matches docs/data/versions.json)
AVAILABLE_VERSIONS = {
    "bg_bbd": {
        "name": "РИ ББД",
        "language": "bg",
        "bundled": True,
        "description": "Ревизирано издание (Българско библейско дружество)",
    },
    "bg_1940": {
        "name": "BG1940",
        "language": "bg",
        "bundled": False,
        "url": "data/bg_1940.json",
        "description": "Българска Библия, ревизирана от 1940 г.",
    },
    "en_kjv": {
        "name": "King James Version",
        "language": "en",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json",
        "description": "King James Version (1611)",
    },
    "en_bbe": {
        "name": "Bible in Basic English",
        "language": "en",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json",
        "description": "Bible in Basic English",
    },
    "pt_nvi": {
        "name": "Nova Versão Internacional",
        "language": "pt",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_nvi.json",
        "description": "Nova Versão Internacional (Portuguese)",
    },
    "es_rvr": {
        "name": "Reina Valera",
        "language": "es",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/es_rvr.json",
        "description": "Reina Valera (Spanish)",
    },
    "ru_synodal": {
        "name": "Синодальный перевод",
        "language": "ru",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ru_synodal.json",
        "description": "Russian Synodal translation",
    },
    "fr_apee": {
        "name": "Le Bible de I'Épée",
        "language": "fr",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/fr_apee.json",
        "description": "Le Bible de I'Épée (French)",
    },
    "de_schlachter": {
        "name": "Schlachter",
        "language": "de",
        "bundled": False,
        "url": "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/de_schlachter.json",
        "description": "Schlachter Bible (German)",
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
    """Get list of installed versions (bundled + local + downloaded)."""
    installed = {}
    
    # Check bundled and local versions in docs/data directory (array format)
    docs_data_dir = Path(__file__).parent.parent / "docs" / "data"
    for version_id, info in AVAILABLE_VERSIONS.items():
        # Check if it's a local file (bundled or has local URL)
        if info.get("bundled"):
            # Bundled versions use the version_id as the file name
            bible_path = docs_data_dir / f"{version_id}.json"
            if bible_path.exists():
                installed[version_id] = {**info, "path": str(bible_path)}
        elif info.get("url") and not info.get("url", "").startswith("http"):
            # Local file (not bundled but available locally)
            # URL format: "data/bg_1940.json" -> file name is bg_1940.json
            url = info.get("url", "")
            if url.startswith("data/"):
                file_name = url.replace("data/", "")
                bible_path = docs_data_dir / file_name
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
