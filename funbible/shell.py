"""Enhanced interactive shell with tab completion and history."""

import cmd
import os
import readline
import atexit
from pathlib import Path
from typing import List, Optional

import pyperclip

from .config import CONFIG_DIR, get_config_value, set_config_value, ensure_dirs
from .search import hybrid_search, search_by_reference, get_random_verse, get_book
from .output import (
    print_verse, print_search_result, print_chapter, print_success,
    print_error, print_info, print_warning, print_welcome, print_styled,
    RICH_AVAILABLE, console,
)

# History file location
HISTORY_FILE = CONFIG_DIR / "history"
HISTORY_LENGTH = 1000


class BibleShell(cmd.Cmd):
    """Enhanced Bible shell with tab completion and rich output."""
    
    prompt = "\033[1;36mfunbible>\033[0m " if not RICH_AVAILABLE else "funbible> "
    
    def __init__(self, bible_app):
        super().__init__()
        self.app = bible_app
        self._setup_readline()
        
        # Command aliases
        self.aliases = {
            "f": "find",
            "s": "search",
            "q": "exit",
            "quit": "exit",
            "r": "random",
            "v": "version",
            "c": "copy",
            "b": "book",
            "m": "more",
            "?": "help",
        }
        
        # Last search state for pagination
        self._last_search_query = None
        self._last_search_offset = 0
    
    def _setup_readline(self) -> None:
        """Set up readline with history and completion."""
        ensure_dirs()
        
        # Load history
        if HISTORY_FILE.exists():
            try:
                readline.read_history_file(HISTORY_FILE)
            except (IOError, OSError):
                pass
        
        readline.set_history_length(HISTORY_LENGTH)
        
        # Save history on exit
        atexit.register(self._save_history)
        
        # Configure completion
        readline.set_completer_delims(' \t\n')
    
    def _save_history(self) -> None:
        """Save readline history to file."""
        try:
            ensure_dirs()
            readline.write_history_file(HISTORY_FILE)
        except (IOError, OSError):
            pass
    
    def preloop(self) -> None:
        """Called before the command loop starts."""
        print_welcome()
        version_name = self.app.version_info.get("name", self.app.version_id)
        print_info(f"Using: {version_name}")
        print()
    
    def precmd(self, line: str) -> str:
        """Process command before execution (handle aliases)."""
        line = line.strip()
        if not line:
            return line
        
        parts = line.split(maxsplit=1)
        cmd_name = parts[0].lower()
        
        # Check for alias
        if cmd_name in self.aliases:
            actual_cmd = self.aliases[cmd_name]
            if len(parts) > 1:
                return f"{actual_cmd} {parts[1]}"
            return actual_cmd
        
        return line
    
    def default(self, line: str) -> None:
        """Handle verse references (e.g., 'John 3:16')."""
        if not line.strip():
            return
        
        # Get separator from config
        use_newlines = get_config_value("verse_newlines")
        separator = "\n" if use_newlines else " "
        
        result, error = search_by_reference(
            line.strip(),
            self.app.bible,
            self.app.books_lookup,
            self.app.books_lookup_inv,
            separator=separator,
        )
        
        if error:
            print_error(error)
            return
        
        print(result)
        self._copy_if_enabled(result)
    
    def do_find(self, arg: str) -> None:
        """
        Search for verses containing text.
        Usage: find <text>
        Aliases: f, search, s
        
        Uses hybrid search: exact matches first, then fuzzy matches.
        Use 'more' or 'm' to see additional results.
        """
        if not arg.strip():
            print_error("Please provide text to search for.")
            return
        
        query = arg.strip()
        limit = get_config_value("search_limit")
        threshold = get_config_value("fuzzy_threshold")
        
        # Store for pagination
        self._last_search_query = query
        self._last_search_offset = 0
        
        results = hybrid_search(
            query,
            self.app.bible,
            self.app.books_lookup_inv,
            limit=limit,
            fuzzy_threshold=threshold,
        )
        
        if not results:
            print_warning("No matches found.")
            return
        
        exact_count = sum(1 for r in results if r["match_type"] == "exact")
        fuzzy_count = len(results) - exact_count
        
        print_info(f"Found {len(results)} results ({exact_count} exact, {fuzzy_count} fuzzy)")
        if len(results) == limit:
            print_info("Type 'more' or 'm' for additional results")
        print()
        
        for result in results:
            print_search_result(result, highlight_query=query)
        
        # Update offset for 'more' command
        self._last_search_offset = len(results)
    
    do_search = do_find  # Alias
    
    def do_more(self, arg: str) -> None:
        """
        Show more results from the last search.
        Usage: more [count]
        Aliases: m
        """
        if self._last_search_query is None:
            print_error("No previous search. Use 'find <text>' first.")
            return
        
        # Parse optional count
        try:
            limit = int(arg.strip()) if arg.strip() else get_config_value("search_limit")
        except ValueError:
            limit = get_config_value("search_limit")
        
        threshold = get_config_value("fuzzy_threshold")
        fetch_limit = self._last_search_offset + limit
        
        results = hybrid_search(
            self._last_search_query,
            self.app.bible,
            self.app.books_lookup_inv,
            limit=fetch_limit,
            fuzzy_threshold=threshold,
        )
        
        # Get only the new results
        page_results = results[self._last_search_offset:]
        
        if not page_results:
            print_warning("No more results.")
            return
        
        print_info(f"Showing results {self._last_search_offset + 1}-{self._last_search_offset + len(page_results)}")
        print()
        
        for result in page_results:
            print_search_result(result, highlight_query=self._last_search_query)
        
        self._last_search_offset += len(page_results)
        
        if len(page_results) == limit:
            print()
            print_info("Type 'more' or 'm' for additional results")
    
    def do_random(self, arg: str) -> None:
        """
        Display a random verse.
        Usage: random
        Aliases: r
        """
        verse = get_random_verse(self.app.bible, self.app.books_lookup_inv)
        print()
        print_styled(f"[bold]{verse['reference']}[/bold]" if RICH_AVAILABLE else verse['reference'])
        print(verse['text'])
        print()
        self._copy_if_enabled(f"{verse['reference']}\n{verse['text']}")
    
    def do_book(self, arg: str) -> None:
        """
        Display an entire book (uses pager for long output).
        Usage: book <book_name> [chapter]
        Aliases: b
        
        Examples:
          book Genesis
          book Genesis 1
          book Ruth
        """
        import pydoc
        
        if not arg.strip():
            print_error("Please provide a book name.")
            return
        
        parts = arg.strip().rsplit(maxsplit=1)
        book_name = parts[0]
        chapter = None
        
        # Check if last part is a chapter number
        if len(parts) > 1 and parts[1].isdigit():
            book_name = parts[0]
            chapter = int(parts[1])
        
        use_newlines = get_config_value("verse_newlines")
        separator = "\n" if use_newlines else " "
        
        if chapter is not None:
            # Just show specific chapter
            result, error = search_by_reference(
                f"{book_name} {chapter}",
                self.app.bible,
                self.app.books_lookup,
                self.app.books_lookup_inv,
                separator=separator,
            )
            if error:
                print_error(error)
                return
            
            if result.count('\n') > 30:
                pydoc.pager(result)
            else:
                print(result)
            return
        
        # Get entire book
        chapters, resolved_name, error = get_book(
            book_name,
            self.app.bible,
            self.app.books_lookup,
            self.app.books_lookup_inv,
            separator=separator,
        )
        
        if error:
            print_error(error)
            return
        
        # Format output
        output_lines = []
        output_lines.append(f"━━━ {resolved_name} ━━━")
        output_lines.append("")
        
        for chapter_title, chapter_text in chapters:
            output_lines.append(f"── {chapter_title} ──")
            output_lines.append(chapter_text)
            output_lines.append("")
        
        output = "\n".join(output_lines)
        pydoc.pager(output)
    
    def do_copy(self, arg: str) -> None:
        """
        Toggle automatic clipboard copying.
        Usage: copy [on|off]
        Aliases: c
        """
        arg = arg.strip().lower()
        
        if arg == "on":
            self.app.do_copy = True
        elif arg == "off":
            self.app.do_copy = False
        else:
            self.app.do_copy = not self.app.do_copy
        
        set_config_value("auto_copy", self.app.do_copy)
        status = "ON" if self.app.do_copy else "OFF"
        print_success(f"Automatic copy is now {status}")
    
    def do_version(self, arg: str) -> None:
        """
        Manage Bible versions.
        Usage:
          version              - Show current version
          version list         - List installed versions
          version list all     - List all available versions
          version use <id>     - Switch to a version
          version install <id> - Download and install a version
          version remove <id>  - Remove a downloaded version
          version default <id> - Set default version
        Aliases: v
        """
        from .version_manager import list_versions, download_version, remove_version, set_default_version
        from .output import print_versions_table
        
        args = arg.strip().split()
        
        if not args:
            # Show current version
            print_info(f"Current: {self.app.version_info.get('name', self.app.version_id)}")
            return
        
        subcmd = args[0].lower()
        
        if subcmd == "list":
            show_all = len(args) > 1 and args[1].lower() == "all"
            versions = list_versions(show_all=show_all)
            print_versions_table(versions)
        
        elif subcmd == "use":
            if len(args) < 2:
                print_error("Please specify a version ID.")
                return
            version_id = args[1]
            success = self.app.switch_version(version_id)
            if success:
                print_success(f"Switched to {self.app.version_info.get('name', version_id)}")
            else:
                print_error(f"Version '{version_id}' not found. Try 'version install {version_id}'")
        
        elif subcmd == "install":
            if len(args) < 2:
                print_error("Please specify a version ID.")
                return
            version_id = args[1]
            print_info(f"Downloading {version_id}...")
            success, message = download_version(version_id)
            if success:
                print_success(message)
            else:
                print_error(message)
        
        elif subcmd == "remove":
            if len(args) < 2:
                print_error("Please specify a version ID.")
                return
            version_id = args[1]
            success, message = remove_version(version_id)
            if success:
                print_success(message)
            else:
                print_error(message)
        
        elif subcmd == "default":
            if len(args) < 2:
                print_error("Please specify a version ID.")
                return
            version_id = args[1]
            success, message = set_default_version(version_id)
            if success:
                print_success(message)
            else:
                print_error(message)
        
        else:
            print_error(f"Unknown subcommand: {subcmd}")
    
    def do_config(self, arg: str) -> None:
        """
        View or modify configuration.
        Usage:
          config                    - Show all settings
          config <key>              - Show a setting
          config <key> <value>      - Set a setting
        """
        from .config import load_config, set_config_value
        
        args = arg.strip().split(maxsplit=1)
        config = load_config()
        
        if not args:
            print_info("Current configuration:")
            for key, value in config.items():
                print(f"  {key}: {value}")
            return
        
        key = args[0]
        
        if len(args) == 1:
            if key in config:
                print(f"{key}: {config[key]}")
            else:
                print_error(f"Unknown config key: {key}")
            return
        
        # Set value
        value_str = args[1]
        
        # Type conversion
        if value_str.lower() in ("true", "on", "yes"):
            value = True
        elif value_str.lower() in ("false", "off", "no"):
            value = False
        elif value_str.isdigit():
            value = int(value_str)
        else:
            value = value_str
        
        set_config_value(key, value)
        print_success(f"Set {key} = {value}")
    
    def do_exit(self, arg: str) -> bool:
        """Exit the shell. Aliases: q, quit"""
        print_info("Goodbye!")
        return True
    
    def do_EOF(self, arg: str) -> bool:
        """Exit on Ctrl+D."""
        print()
        return self.do_exit(arg)
    
    def emptyline(self) -> None:
        """Do nothing on empty input."""
        pass
    
    def _copy_if_enabled(self, text: str) -> None:
        """Copy text to clipboard if auto-copy is enabled."""
        if self.app.do_copy:
            try:
                pyperclip.copy(text)
                print_info("Copied to clipboard")
            except Exception:
                pass
    
    # Tab completion methods
    def complete_version(self, text: str, line: str, begidx: int, endidx: int) -> List[str]:
        """Tab completion for version command."""
        from .version_manager import list_versions
        
        args = line[:endidx].split()
        
        if len(args) <= 2:
            # Complete subcommand
            subcommands = ["list", "use", "install", "remove", "default"]
            if len(args) == 1:
                return subcommands
            return [s for s in subcommands if s.startswith(text)]
        
        # Complete version ID
        if len(args) == 2 or (len(args) == 3 and not text):
            all_versions = list_versions(show_all=True)
            version_ids = [v["id"] for v in all_versions]
            return [v for v in version_ids if v.startswith(text)]
        
        return []
    
    def completedefault(self, text: str, line: str, begidx: int, endidx: int) -> List[str]:
        """Default completion: suggest book names."""
        # Suggest book names for reference lookup
        book_names = list(self.app.books_lookup.keys())
        return [b for b in book_names if b.lower().startswith(text.lower())]
