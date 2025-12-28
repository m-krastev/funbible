"""FunBible - Terminal Bible Reader with enhanced CLI."""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional, Any

import click
import pyperclip

from .config import (
    get_config_value, set_config_value, get_installed_versions,
    get_version_path, AVAILABLE_VERSIONS,
)
from .search import hybrid_search, search_by_reference, get_random_verse
from .output import (
    print_verse, print_search_result, print_versions_table,
    print_success, print_error, print_info, print_warning,
)


class BibleApp:
    """Core Bible application with version management."""
    
    def __init__(self, version_id: Optional[str] = None):
        self.version_id = version_id or get_config_value("default_version")
        self.do_copy = get_config_value("auto_copy")
        self.bible: Dict[Tuple[str, str, str], str] = {}
        self.books_lookup: Dict[str, str] = {}
        self.books_lookup_inv: Dict[str, str] = {}
        self.version_info: Dict[str, Any] = {}
        self._load_version(self.version_id)
    
    def _load_version(self, version_id: str) -> bool:
        """Load a Bible version from file."""
        installed = get_installed_versions()
        
        if version_id not in installed:
            # Try fallback to default
            default = get_config_value("default_version")
            if default in installed:
                version_id = default
            elif installed:
                version_id = next(iter(installed))
            else:
                print_error("No Bible versions installed!")
                sys.exit(1)
        
        self.version_id = version_id
        self.version_info = installed[version_id]
        
        bible_path = Path(self.version_info["path"])
        
        try:
            with open(bible_path, "r", encoding="utf-8") as f:
                raw_bible = json.load(f)
            
            # Expect array format: [{abbrev, book, chapters: [[verses]]}]
            if not isinstance(raw_bible, list):
                print_error(f"Invalid format: expected array format, got {type(raw_bible).__name__}")
                return False
            
            # Convert array format to object format for internal use
            bible_obj = {}
            lookup_from_data = {}
            
            for book_idx, book in enumerate(raw_bible):
                book_id = str(book_idx + 1)
                book_name = book.get("book", f"Book {book_idx + 1}")
                lookup_from_data[book_name] = book_id
                
                bible_obj[book_id] = {}
                chapters = book.get("chapters", [])
                for chapter_idx, verses in enumerate(chapters):
                    chapter_num = str(chapter_idx + 1)
                    bible_obj[book_id][chapter_num] = {}
                    for verse_idx, verse_text in enumerate(verses):
                        verse_num = str(verse_idx + 1)
                        bible_obj[book_id][chapter_num][verse_num] = verse_text
            
            self.books_lookup = lookup_from_data
            self.books_lookup_inv = {v: k for k, v in self.books_lookup.items()}
            
            # Flatten the bible structure
            self.bible = {
                (book, chapter, verse): text
                for book, chapters in bible_obj.items()
                for chapter, verses in chapters.items()
                for verse, text in verses.items()
            }
            
            return True
            
        except FileNotFoundError as e:
            print_error(f"Could not find resource file: {e.filename}")
            return False
        except json.JSONDecodeError as e:
            print_error(f"Failed to decode JSON: {e}")
            return False
    
    def switch_version(self, version_id: str) -> bool:
        """Switch to a different Bible version."""
        return self._load_version(version_id)


# Click CLI group
@click.group(invoke_without_command=True)
@click.option("--version", "-v", "version_id", default=None, help="Bible version to use")
@click.option("--copy/--no-copy", default=None, help="Auto-copy results to clipboard")
@click.pass_context
def cli(ctx, version_id: Optional[str], copy: Optional[bool]):
    """FunBible - Terminal Bible Reader
    
    Enter interactive shell mode, or use subcommands for quick lookups.
    
    \b
    Examples:
      funbible                    # Start interactive shell
      funbible get "John 3:16"    # Quick verse lookup
      funbible find "love"        # Search for text
      funbible version list       # List Bible versions
    """
    # Store app in context
    ctx.ensure_object(dict)
    ctx.obj["version_id"] = version_id
    ctx.obj["copy"] = copy
    
    # If no subcommand, enter interactive shell
    if ctx.invoked_subcommand is None:
        app = BibleApp(version_id=version_id)
        if copy is not None:
            app.do_copy = copy
        
        from .shell import BibleShell
        shell = BibleShell(app)
        
        try:
            shell.cmdloop()
        except KeyboardInterrupt:
            print("\n")
            print_info("Goodbye!")


@cli.command("get")
@click.argument("reference")
@click.option("--newlines/--no-newlines", "use_newlines", default=None, 
              help="Output verses on separate lines (overrides config)")
@click.pass_context
def cmd_get(ctx, reference: str, use_newlines: Optional[bool]):
    """Look up a verse by reference.
    
    \b
    Examples:
      funbible get "John 3:16"
      funbible get "Genesis 1:1-3"
      funbible get "Psalms 23"
      funbible get "John 3" --no-newlines  # Compact output
    """
    app = BibleApp(version_id=ctx.obj.get("version_id"))
    if ctx.obj.get("copy") is not None:
        app.do_copy = ctx.obj["copy"]
    
    # Determine separator
    if use_newlines is None:
        use_newlines = get_config_value("verse_newlines")
    separator = "\n" if use_newlines else " "
    
    result, error = search_by_reference(
        reference,
        app.bible,
        app.books_lookup,
        app.books_lookup_inv,
        separator=separator,
    )
    
    if error:
        print_error(error)
        sys.exit(1)
    
    print(result)
    
    if app.do_copy:
        pyperclip.copy(result)
        print_info("Copied to clipboard")


@cli.command("find")
@click.argument("query")
@click.option("--limit", "-l", default=None, type=int, help="Maximum results to show (default: from config)")
@click.option("--page", "-p", default=1, type=int, help="Page number for pagination")
@click.option("--offset", "-o", default=0, type=int, help="Skip first N results")
@click.pass_context
def cmd_find(ctx, query: str, limit: Optional[int], page: int, offset: int):
    """Search for verses containing text.
    
    Uses hybrid search: exact matches first, then fuzzy matches.
    Supports pagination for browsing through many results.
    
    \b
    Examples:
      funbible find "love"
      funbible find "love" --limit 20
      funbible find "love" --page 2        # Show results 11-20
      funbible find "love" --offset 5      # Skip first 5 results
    """
    app = BibleApp(version_id=ctx.obj.get("version_id"))
    
    # Get limit from config if not specified
    if limit is None:
        limit = get_config_value("search_limit")
    
    # Calculate actual limit to fetch (need more for pagination)
    fetch_limit = offset + (page * limit)
    
    results = hybrid_search(
        query,
        app.bible,
        app.books_lookup_inv,
        limit=fetch_limit,
        fuzzy_threshold=get_config_value("fuzzy_threshold"),
    )
    
    # Apply pagination
    start_idx = offset + ((page - 1) * limit)
    end_idx = start_idx + limit
    page_results = results[start_idx:end_idx]
    
    if not page_results:
        if page > 1 or offset > 0:
            print_warning(f"No more results (page {page}, offset {offset}).")
        else:
            print_warning("No matches found.")
        sys.exit(0)
    
    total_found = len(results)
    exact_count = sum(1 for r in results if r["match_type"] == "exact")
    fuzzy_count = total_found - exact_count
    
    # Show pagination info
    showing_start = start_idx + 1
    showing_end = min(end_idx, total_found)
    
    if page > 1 or offset > 0:
        print_info(f"Showing {showing_start}-{showing_end} of {total_found}+ results ({exact_count} exact, {fuzzy_count} fuzzy)")
    else:
        print_info(f"Found {total_found} results ({exact_count} exact, {fuzzy_count} fuzzy)")
    
    if showing_end < total_found or total_found == fetch_limit:
        next_page = page + 1
        print_info(f"Use --page {next_page} to see more results")
    print()
    
    for result in page_results:
        print_search_result(result, highlight_query=query)


@cli.command("random")
@click.pass_context
def cmd_random(ctx):
    """Display a random verse."""
    app = BibleApp(version_id=ctx.obj.get("version_id"))
    if ctx.obj.get("copy") is not None:
        app.do_copy = ctx.obj["copy"]
    
    verse = get_random_verse(app.bible, app.books_lookup_inv)
    
    print()
    click.secho(verse["reference"], bold=True)
    print(verse["text"])
    print()
    
    if app.do_copy:
        pyperclip.copy(f"{verse['reference']}\n{verse['text']}")
        print_info("Copied to clipboard")


@cli.command("book")
@click.argument("book_name")
@click.option("--chapter", "-c", default=None, type=int, help="Show only a specific chapter")
@click.option("--newlines/--no-newlines", "use_newlines", default=None,
              help="Output verses on separate lines (overrides config)")
@click.option("--pager/--no-pager", default=True, help="Use pager for long output")
@click.pass_context
def cmd_book(ctx, book_name: str, chapter: Optional[int], use_newlines: Optional[bool], pager: bool):
    """Display an entire book or a specific chapter.
    
    \b
    Examples:
      funbible book Genesis           # Entire book (with pager)
      funbible book Genesis -c 1      # Just chapter 1
      funbible book Ruth --no-pager   # Output without paging
      funbible book Psalms --no-newlines  # Compact output
    """
    from .search import get_book
    import pydoc
    
    app = BibleApp(version_id=ctx.obj.get("version_id"))
    if ctx.obj.get("copy") is not None:
        app.do_copy = ctx.obj["copy"]
    
    # Determine separator
    if use_newlines is None:
        use_newlines = get_config_value("verse_newlines")
    separator = "\n" if use_newlines else " "
    
    # If specific chapter requested, use regular reference lookup
    if chapter is not None:
        result, error = search_by_reference(
            f"{book_name} {chapter}",
            app.bible,
            app.books_lookup,
            app.books_lookup_inv,
            separator=separator,
        )
        if error:
            print_error(error)
            sys.exit(1)
        
        if pager and result.count('\n') > 30:
            pydoc.pager(result)
        else:
            print(result)
        return
    
    # Get entire book
    chapters, resolved_name, error = get_book(
        book_name,
        app.bible,
        app.books_lookup,
        app.books_lookup_inv,
        separator=separator,
    )
    
    if error:
        print_error(error)
        sys.exit(1)
    
    # Format output
    output_lines = []
    output_lines.append(f"━━━ {resolved_name} ━━━")
    output_lines.append("")
    
    for chapter_title, chapter_text in chapters:
        output_lines.append(f"── {chapter_title} ──")
        output_lines.append(chapter_text)
        output_lines.append("")
    
    output = "\n".join(output_lines)
    
    # Use pager for long output
    if pager:
        pydoc.pager(output)
    else:
        print(output)
    
    if app.do_copy:
        pyperclip.copy(output)
        print_info("Copied to clipboard")


# Version management subgroup
@cli.group("version")
def version_group():
    """Manage Bible versions.
    
    \b
    Examples:
      funbible version list
      funbible version list --all
      funbible version install kjv
      funbible version default kjv
    """
    pass


@version_group.command("list")
@click.option("--all", "-a", "show_all", is_flag=True, help="Show all available versions")
def version_list(show_all: bool):
    """List Bible versions."""
    from .version_manager import list_versions
    
    versions = list_versions(show_all=show_all)
    print_versions_table(versions)
    
    if not show_all:
        print_info("Use 'funbible version list --all' to see all available versions")


@version_group.command("install")
@click.argument("version_id")
def version_install(version_id: str):
    """Download and install a Bible version."""
    from .version_manager import download_version
    
    print_info(f"Downloading {version_id}...")
    
    def progress(msg):
        print_info(msg)
    
    success, message = download_version(version_id, progress_callback=progress)
    
    if success:
        print_success(message)
    else:
        print_error(message)
        sys.exit(1)


@version_group.command("remove")
@click.argument("version_id")
@click.confirmation_option(prompt="Are you sure you want to remove this version?")
def version_remove(version_id: str):
    """Remove a downloaded Bible version."""
    from .version_manager import remove_version
    
    success, message = remove_version(version_id)
    
    if success:
        print_success(message)
    else:
        print_error(message)
        sys.exit(1)


@version_group.command("default")
@click.argument("version_id")
def version_default(version_id: str):
    """Set the default Bible version."""
    from .version_manager import set_default_version
    
    success, message = set_default_version(version_id)
    
    if success:
        print_success(message)
    else:
        print_error(message)
        sys.exit(1)


@version_group.command("use")
@click.argument("version_id")
@click.pass_context
def version_use(ctx, version_id: str):
    """Start shell with a specific version (one-time, not saved)."""
    ctx.obj["version_id"] = version_id
    ctx.invoke(cli)


# Config management
@cli.command("config")
@click.argument("key", required=False)
@click.argument("value", required=False)
def cmd_config(key: Optional[str], value: Optional[str]):
    """View or modify configuration.
    
    \b
    Examples:
      funbible config                  # Show all settings
      funbible config auto_copy        # Show a setting
      funbible config auto_copy true   # Set a setting
    """
    from .config import load_config
    
    config = load_config()
    
    if key is None:
        print_info("Current configuration:")
        for k, v in config.items():
            print(f"  {k}: {v}")
        return
    
    if value is None:
        if key in config:
            print(f"{key}: {config[key]}")
        else:
            print_error(f"Unknown config key: {key}")
            sys.exit(1)
        return
    
    # Type conversion
    if value.lower() in ("true", "on", "yes"):
        typed_value = True
    elif value.lower() in ("false", "off", "no"):
        typed_value = False
    elif value.isdigit():
        typed_value = int(value)
    else:
        typed_value = value
    
    set_config_value(key, typed_value)
    print_success(f"Set {key} = {typed_value}")


def main():
    """Entry point for the CLI."""
    cli(obj={})


if __name__ == "__main__":
    main()
