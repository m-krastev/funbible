"""Rich console output utilities for FunBible."""

from typing import Optional

# Try to use rich for colored output, fall back to plain text
try:
    from rich.console import Console
    from rich.theme import Theme
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich.syntax import Syntax
    from rich.markdown import Markdown
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


# Custom theme for Bible output
BIBLE_THEME = Theme({
    "verse.number": "bold cyan",
    "verse.text": "white",
    "reference": "bold yellow",
    "book": "bold magenta",
    "chapter": "bold green",
    "search.exact": "bold green",
    "search.fuzzy": "dim yellow",
    "info": "dim cyan",
    "success": "bold green",
    "error": "bold red",
    "warning": "bold yellow",
}) if RICH_AVAILABLE else None

# Global console instance
console = Console(theme=BIBLE_THEME) if RICH_AVAILABLE else None


def print_styled(text: str, style: str = "") -> None:
    """Print text with optional styling."""
    if RICH_AVAILABLE and console:
        console.print(text, style=style)
    else:
        print(text)


def print_verse(verse_num: str, text: str, reference: Optional[str] = None) -> None:
    """Print a verse with styling."""
    if RICH_AVAILABLE and console:
        output = Text()
        if reference:
            output.append(f"({reference}) ", style="reference")
        output.append(f"{verse_num} ", style="verse.number")
        output.append(text, style="verse.text")
        console.print(output)
    else:
        if reference:
            print(f"({reference}) {verse_num} {text}")
        else:
            print(f"{verse_num} {text}")


def print_search_result(result: dict, highlight_query: Optional[str] = None) -> None:
    """Print a search result with styling."""
    if RICH_AVAILABLE and console:
        output = Text()
        
        # Match type indicator
        match_style = "search.exact" if result["match_type"] == "exact" else "search.fuzzy"
        
        output.append(f"({result['reference']}) ", style="reference")
        
        text = result["text"]
        if highlight_query and result["match_type"] == "exact":
            # Highlight the matched text
            query_lower = highlight_query.lower()
            text_lower = text.lower()
            idx = text_lower.find(query_lower)
            if idx >= 0:
                output.append(text[:idx])
                output.append(text[idx:idx + len(highlight_query)], style="bold green underline")
                output.append(text[idx + len(highlight_query):])
            else:
                output.append(text)
        else:
            output.append(text)
        
        # Score indicator for fuzzy matches
        if result["match_type"] == "fuzzy":
            output.append(f" [{result['score']:.0f}%]", style="dim")
        
        console.print(output)
    else:
        prefix = "≈" if result["match_type"] == "fuzzy" else "="
        score = f" [{result['score']:.0f}%]" if result["match_type"] == "fuzzy" else ""
        print(f"{prefix} ({result['reference']}) {result['text']}{score}")


def print_chapter(verses: list, book_name: str, chapter: str) -> None:
    """Print a chapter with styling."""
    if RICH_AVAILABLE and console:
        # Create a panel for the chapter
        content = Text()
        for i, (v_num, text) in enumerate(verses):
            content.append(f"{v_num} ", style="verse.number")
            content.append(text, style="verse.text")
            if i < len(verses) - 1:
                content.append("\n")
        
        panel = Panel(
            content,
            title=f"[book]{book_name}[/book] [chapter]{chapter}[/chapter]",
            border_style="dim",
            box=box.ROUNDED,
        )
        console.print(panel)
    else:
        print(f"--- {book_name} {chapter} ---")
        for v_num, text in verses:
            print(f"{v_num} {text}")


def print_versions_table(versions: list) -> None:
    """Print a table of Bible versions."""
    if RICH_AVAILABLE and console:
        table = Table(title="Bible Versions", box=box.ROUNDED, show_lines=True)
        table.add_column("ID", style="cyan", no_wrap=True)
        table.add_column("Name", style="white", no_wrap=True)
        table.add_column("Lang", style="dim", no_wrap=True)
        table.add_column("Status", style="green", no_wrap=True)
        table.add_column("", style="yellow", no_wrap=True)
        
        for v in versions:
            status = "✓ Installed" if v["installed"] else "Available"
            status_style = "green" if v["installed"] else "dim"
            default = "★" if v.get("is_default") else ""
            
            table.add_row(
                v["id"],
                v["name"],
                v["language"],
                f"[{status_style}]{status}[/{status_style}]",
                default,
            )
        
        console.print(table)
    else:
        print("Bible Versions:")
        print("-" * 60)
        for v in versions:
            status = "[installed]" if v["installed"] else "[available]"
            default = " (default)" if v.get("is_default") else ""
            print(f"  {v['id']:20} {v['name']:30} {status}{default}")


def print_success(message: str) -> None:
    """Print a success message."""
    print_styled(f"✓ {message}", "success")


def print_error(message: str) -> None:
    """Print an error message."""
    print_styled(f"✗ {message}", "error")


def print_info(message: str) -> None:
    """Print an info message."""
    print_styled(f"ℹ {message}", "info")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print_styled(f"⚠ {message}", "warning")


def print_welcome() -> None:
    """Print welcome banner."""
    if RICH_AVAILABLE and console:
        banner = Panel(
            "[bold]FunBible[/bold] - Terminal Bible Reader\n"
            "[dim]Type 'help' for commands, or enter a verse reference[/dim]",
            border_style="blue",
            box=box.DOUBLE,
        )
        console.print(banner)
    else:
        print("=" * 50)
        print("  FunBible - Terminal Bible Reader")
        print("  Type 'help' for commands")
        print("=" * 50)
