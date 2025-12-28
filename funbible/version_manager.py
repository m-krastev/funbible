"""Version management for downloading and managing Bible versions."""

import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import requests

from .config import (
    AVAILABLE_VERSIONS,
    VERSIONS_DIR,
    get_installed_versions,
    get_config_value,
    set_config_value,
    ensure_dirs,
)

# Standard book names for English Bibles (used for normalization)
ENGLISH_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms",
    "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
    "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John",
    "3 John", "Jude", "Revelation"
]


def list_versions(show_all: bool = False) -> List[Dict[str, Any]]:
    """
    List Bible versions.
    
    Args:
        show_all: If True, show all available versions. If False, only installed.
    
    Returns:
        List of version info dicts with 'installed' boolean.
    """
    installed = get_installed_versions()
    default_version = get_config_value("default_version")
    
    versions = []
    source = AVAILABLE_VERSIONS if show_all else installed
    
    for version_id, info in source.items():
        is_installed = version_id in installed
        versions.append({
            "id": version_id,
            "name": info.get("name", version_id),
            "language": info.get("language", "unknown"),
            "description": info.get("description", ""),
            "bundled": info.get("bundled", False),
            "installed": is_installed,
            "is_default": version_id == default_version,
        })
    
    return sorted(versions, key=lambda x: (not x["installed"], x["name"]))


def download_version(version_id: str, progress_callback=None) -> Tuple[bool, str]:
    """
    Download a Bible version.
    
    Args:
        version_id: ID of the version to download
        progress_callback: Optional callback for progress updates
    
    Returns:
        Tuple of (success, message)
    """
    if version_id not in AVAILABLE_VERSIONS:
        return False, f"Unknown version: {version_id}"
    
    info = AVAILABLE_VERSIONS[version_id]
    
    if info.get("bundled"):
        return False, f"Version '{version_id}' is bundled with the package."
    
    url = info.get("url")
    if not url:
        return False, f"No download URL available for '{version_id}'."
    
    # Check if already installed
    installed = get_installed_versions()
    if version_id in installed and not info.get("bundled"):
        return False, f"Version '{version_id}' is already installed."
    
    ensure_dirs()
    
    try:
        # Handle local file URLs (e.g., "data/bg_1940.json")
        if url.startswith("data/"):
            if progress_callback:
                progress_callback(f"Copying {info['name']}...")
            
            # Local file - copy from docs/data
            docs_data_dir = Path(__file__).parent.parent.parent / "docs" / "data"
            source_path = docs_data_dir / url.replace("data/", "")
            
            if not source_path.exists():
                return False, f"Local file not found: {source_path}"
            
            # Copy to versions directory
            bible_path = VERSIONS_DIR / f"{version_id}.json"
            shutil.copy2(source_path, bible_path)
            
            if progress_callback:
                progress_callback(f"Successfully installed {info['name']}")
            
            return True, f"Successfully installed '{info['name']}'."
        
        # Remote URL - download
        if progress_callback:
            progress_callback(f"Downloading {info['name']}...")
        
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        # Parse the downloaded JSON
        # Handle UTF-8 BOM by decoding with utf-8-sig
        content = response.content.decode('utf-8-sig')
        raw_data = json.loads(content)
        
        # Expect array format: [{abbrev, book, chapters: [[verses]]}]
        if not isinstance(raw_data, list):
            return False, f"Invalid format: expected array format, got {type(raw_data).__name__}"
        
        # Save in array format
        bible_path = VERSIONS_DIR / f"{version_id}.json"
        with open(bible_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        
        if progress_callback:
            progress_callback(f"Successfully installed {info['name']}")
        
        return True, f"Successfully downloaded and installed '{info['name']}'."
    
    except requests.RequestException as e:
        return False, f"Failed to download: {e}"
    except (json.JSONDecodeError, KeyError) as e:
        return False, f"Failed to parse Bible data: {e}"
    except (OSError, IOError) as e:
        return False, f"Failed to copy file: {e}"


def normalize_bible_format(raw_data: Any, version_id: str) -> Dict[str, Any]:
    """
    Convert array format to internal object format for processing.
    
    Input format: [{abbrev, book, chapters: [[verses]]}]
    Output format: {book_id: {chapter: {verse: text}}}
    Lookup format: {book_name: book_id}
    """
    bible = {}
    lookup = {}
    
    # Expect array format: [{abbrev, book, chapters: [[verses]]}]
    if not isinstance(raw_data, list) or len(raw_data) == 0:
        raise ValueError(f"Invalid format: expected array format, got {type(raw_data).__name__}")
    
    if "chapters" not in raw_data[0]:
        raise ValueError("Invalid array format: missing 'chapters' field")
    
    for book_idx, book in enumerate(raw_data):
        book_id = str(book_idx + 1)
        # Use book name from data, fallback to English name
        book_name = book.get("book") or (ENGLISH_BOOKS[book_idx] if book_idx < len(ENGLISH_BOOKS) else f"Book {book_idx + 1}")
        lookup[book_name] = book_id
        
        bible[book_id] = {}
        for chapter_idx, verses in enumerate(book.get("chapters", [])):
            chapter_num = str(chapter_idx + 1)
            bible[book_id][chapter_num] = {}
            for verse_idx, verse_text in enumerate(verses):
                verse_num = str(verse_idx + 1)
                bible[book_id][chapter_num][verse_num] = verse_text
    
    return {"bible": bible, "lookup": lookup}


def remove_version(version_id: str) -> Tuple[bool, str]:
    """
    Remove a downloaded Bible version.
    
    Args:
        version_id: ID of the version to remove
    
    Returns:
        Tuple of (success, message)
    """
    if version_id in AVAILABLE_VERSIONS and AVAILABLE_VERSIONS[version_id].get("bundled"):
        return False, f"Cannot remove bundled version '{version_id}'."
    
    bible_path = VERSIONS_DIR / f"{version_id}.json"
    
    if not bible_path.exists():
        return False, f"Version '{version_id}' is not installed."
    
    try:
        bible_path.unlink()
        
        # Reset default if this was the default
        if get_config_value("default_version") == version_id:
            set_config_value("default_version", "bg_bbd")
        
        return True, f"Successfully removed '{version_id}'."
    except OSError as e:
        return False, f"Failed to remove version: {e}"


def set_default_version(version_id: str) -> Tuple[bool, str]:
    """
    Set the default Bible version.
    
    Args:
        version_id: ID of the version to set as default
    
    Returns:
        Tuple of (success, message)
    """
    installed = get_installed_versions()
    
    if version_id not in installed:
        return False, f"Version '{version_id}' is not installed."
    
    set_config_value("default_version", version_id)
    name = installed[version_id].get("name", version_id)
    return True, f"Default version set to '{name}'."
