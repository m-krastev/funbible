"""Enhanced search functionality with hybrid exact + fuzzy matching."""

import re
from typing import Dict, List, Tuple, Optional
from rapidfuzz import fuzz, process


def hybrid_search(
    query: str,
    bible: Dict[Tuple[str, str, str], str],
    books_lookup_inv: Dict[str, str],
    limit: int = 10,
    fuzzy_threshold: int = 70,
) -> List[Dict]:
    """
    Hybrid search combining exact substring match and fuzzy matching.

    Results are sorted by book order, with exact matches appearing first.

    Priority:
    1. Exact case-insensitive substring matches (sorted by book order)
    2. Fuzzy matches using token_set_ratio (sorted by book order)

    Returns list of dicts with keys: text, reference, score, match_type
    """
    query_lower = query.lower()
    seen_keys = set()

    # Phase 1: Find all exact substring matches
    exact_matches = []
    for key, text in bible.items():
        if query_lower in text.lower():
            book_name = books_lookup_inv.get(key[0], key[0])
            reference = f"{book_name} {key[1]}:{key[2]}"
            exact_matches.append({
                "text": text,
                "reference": reference,
                "key": key,
                "score": 100,
                "match_type": "exact",
            })
            seen_keys.add(key)

    # Sort exact matches by biblical order
    exact_matches.sort(key=lambda r: (int(r["key"][0]), int(r["key"][1]), int(r["key"][2])))

    # Phase 2: Find fuzzy matches from the remaining verses if needed
    fuzzy_matches = []
    if len(exact_matches) < limit:
        candidates = {k: v for k, v in bible.items() if k not in seen_keys}
        needed = limit - len(exact_matches)

        fuzzy_results = process.extract(
            query,
            candidates,
            scorer=fuzz.token_set_ratio,
            limit=needed,
            score_cutoff=fuzzy_threshold,
        )

        for text, score, key in fuzzy_results:
            book_name = books_lookup_inv.get(key[0], key[0])
            reference = f"{book_name} {key[1]}:{key[2]}"
            fuzzy_matches.append({
                "text": text,
                "reference": reference,
                "key": key,
                "score": score,
                "match_type": "fuzzy",
            })

        # Sort fuzzy matches by biblical order
        fuzzy_matches.sort(key=lambda r: (int(r["key"][0]), int(r["key"][1]), int(r["key"][2])))

    # Combine and return
    all_results = exact_matches + fuzzy_matches

    return all_results


def search_by_reference(
    query: str,
    bible: Dict[Tuple[str, str, str], str],
    books_lookup: Dict[str, str],
    books_lookup_inv: Dict[str, str],
    separator: str = "\n",
) -> Tuple[Optional[str], Optional[str]]:
    """
    Find verses by reference (e.g., "John 3:16", "Genesis 1").
    
    Args:
        separator: String to join multiple verses (default newline)
    
    Returns:
        Tuple of (result_text, error_message)
    """
    query = query.strip()
    
    # Match [Book Name] [Chapter](:[Verse](-[VerseEnd])?)?
    match = re.match(r"(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$", query)
    
    if not match:
        return None, f"Invalid format: '{query}'. Use 'Book Chapter:Verse' or 'Book Chapter'."
    
    book_query, chapter, verse_start, verse_end = match.groups()
    
    # Fuzzy match book name
    extracted = process.extractOne(
        book_query, 
        books_lookup.keys(), 
        processor=lambda x: x.lower()
    )
    
    if not extracted:
        return None, f"Book '{book_query}' not found."
    
    book_name = extracted[0]
    book_key = books_lookup[book_name]
    
    # Filter bible for this book and chapter
    chapter_verses = {
        int(k[2]): v for k, v in bible.items()
        if k[0] == book_key and k[1] == chapter
    }
    
    if not chapter_verses:
        return None, f"Chapter {chapter} not found in {book_name}."
    
    if verse_start is None:
        # Return whole chapter
        sorted_verses = sorted(chapter_verses.items())
        result = separator.join(f"{v_num} {text}" for v_num, text in sorted_verses)
        return result, None
    
    v_start = int(verse_start)
    if verse_end is None:
        # Single verse
        verse_text = chapter_verses.get(v_start)
        if verse_text:
            return f"{v_start} {verse_text}", None
        return None, f"Verse {v_start} not found in {book_name} {chapter}."
    
    # Verse range
    v_end = int(verse_end)
    results = []
    for v_num in range(v_start, v_end + 1):
        text = chapter_verses.get(v_num)
        if text:
            results.append(f"{v_num} {text}")
    
    if not results:
        return None, f"Verses {v_start}-{v_end} not found in {book_name} {chapter}."
    
    return separator.join(results), None


def get_book(
    book_query: str,
    bible: Dict[Tuple[str, str, str], str],
    books_lookup: Dict[str, str],
    books_lookup_inv: Dict[str, str],
    separator: str = "\n",
) -> Tuple[Optional[List[Tuple[str, str]]], Optional[str], Optional[str]]:
    """
    Get an entire book.
    
    Returns:
        Tuple of (list of (chapter_title, chapter_text), book_name, error_message)
    """
    # Fuzzy match book name
    extracted = process.extractOne(
        book_query.strip(), 
        books_lookup.keys(), 
        processor=lambda x: x.lower()
    )
    
    if not extracted:
        return None, None, f"Book '{book_query}' not found."
    
    book_name = extracted[0]
    book_key = books_lookup[book_name]
    
    # Get all verses for this book
    book_verses = {
        (int(k[1]), int(k[2])): v for k, v in bible.items()
        if k[0] == book_key
    }
    
    if not book_verses:
        return None, book_name, f"No verses found for {book_name}."
    
    # Group by chapter
    chapters = {}
    for (chapter, verse), text in book_verses.items():
        if chapter not in chapters:
            chapters[chapter] = []
        chapters[chapter].append((verse, text))
    
    # Sort and format
    result = []
    for chapter_num in sorted(chapters.keys()):
        verses = sorted(chapters[chapter_num])
        chapter_text = separator.join(f"{v_num} {text}" for v_num, text in verses)
        result.append((f"Chapter {chapter_num}", chapter_text))
    
    return result, book_name, None


def get_random_verse(
    bible: Dict[Tuple[str, str, str], str],
    books_lookup_inv: Dict[str, str],
) -> Dict:
    """Get a random verse from the Bible."""
    import random
    
    key = random.choice(list(bible.keys()))
    text = bible[key]
    book_name = books_lookup_inv.get(key[0], key[0])
    
    return {
        "text": text,
        "reference": f"{book_name} {key[1]}:{key[2]}",
        "key": key,
    }
