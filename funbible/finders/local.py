import re
from typing import Dict, Tuple, List, Optional, Union
from rapidfuzz import fuzz, process

def find_verses_local(
    query: str, 
    bible: Dict[Tuple[str, str, str], str], 
    book_lookup: Dict[str, str]
) -> str:
    """
    Find verses in the local bible dictionary.
    Supports formats:
    - "Book Chapter" (e.g., "John 3") -> returns whole chapter
    - "Book Chapter:Verse" (e.g., "John 3:16") -> returns single verse
    - "Book Chapter:Verse-Verse" (e.g., "John 3:16-18") -> returns verse range
    """
    query = query.strip()
    # Match [Book Name] [Chapter](:[Verse](-[VerseEnd])?)?
    # This regex allows for book names with spaces and numbers
    match = re.match(r"(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$", query)
    
    if not match:
        return f"Invalid format: '{query}'. Use 'Book Chapter:Verse' or 'Book Chapter'."

    book_query, chapter, verse_start, verse_end = match.groups()

    # Fuzzy match book name
    extracted = process.extractOne(book_query, book_lookup.keys(), processor=lambda x: x.lower())
    if not extracted:
        return f"Book '{book_query}' not found."
    
    book_key = book_lookup[extracted[0]]

    # Filter bible for this book and chapter
    # Note: chapter, verse_start, verse_end are strings from regex
    chapter_verses = {
        int(k[2]): v for k, v in bible.items() 
        if k[0] == book_key and k[1] == chapter
    }

    if not chapter_verses:
        return f"Chapter {chapter} not found in {extracted[0]}."

    if verse_start is None:
        # Return whole chapter
        sorted_verses = sorted(chapter_verses.items())
        return " ".join(f"{v_num} {text}" for v_num, text in sorted_verses)

    v_start = int(verse_start)
    if verse_end is None:
        # Single verse
        verse_text = chapter_verses.get(v_start)
        if verse_text:
            return f"{v_start} {verse_text}"
        return f"Verse {v_start} not found in {extracted[0]} {chapter}."

    # Verse range
    v_end = int(verse_end)
    results = []
    for v_num in range(v_start, v_end + 1):
        text = chapter_verses.get(v_num)
        if text:
            results.append(f"{v_num} {text}")
    
    if not results:
        return f"Verses {v_start}-{v_end} not found in {extracted[0]} {chapter}."
    
    return " ".join(results)


def match_verse(
    text_query: str, 
    flattened_bible: Dict[Tuple[str, str, str], str], 
    limit: int = 10, 
    score_cutoff: int = 70
) -> List[Tuple[str, float, Tuple[str, str, str]]]:
    """
    Match verse text using fuzzy matching.
    Returns list of (text, score, (book, chapter, verse))
    """
    return process.extract(
        text_query, 
        flattened_bible, 
        scorer=fuzz.token_set_ratio, 
        limit=limit, 
        score_cutoff=score_cutoff
    )
