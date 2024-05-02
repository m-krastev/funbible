from rapidfuzz import fuzz, process


def find_verses_local(
    bible_verse: str, bible: dict[tuple, str], book_lookup: dict[str, str]
):
    """Find verses"""
    print(bible_verse)
    book = bible_verse.rsplit(maxsplit=1)
    if len(book) != 2:
        return "Verse not found"
    book, verse_data = book

    book = process.extractOne(book, book_lookup, processor=lambda x: x.lower())[-1]

    # if its a whole chapter
    if ":" not in verse_data:
        chapter = verse_data[-1]
        keys = [key for key in bible if key[0] == book and key[1] == chapter]
        results = [f"{key[-1]} {bible[key]}" for key in keys]
        return " ".join(results)

    chapter, verse = verse_data.split(":", 1)

    # if a single verse
    if "-" not in verse:
        return f"{verse} {bible[(book, chapter, verse)]}"

    # if a verse span
    verse, verse_end = map(int, verse.split("-", 1))
    keys = [key for key in bible if key[0] == book and key[1] == chapter]
    compilation = [f"{key[-1]} {bible[key]}" for key in keys]
    return " ".join(compilation[verse - 1 : verse_end])


def match_verse(ref: str, flattened_text: str, limit: int = None, score_cutoff: int = 80):
    """Match verse to text using fuzzy matching"""
    return process.extract(
        ref, flattened_text, scorer=fuzz.token_set_ratio, limit=limit, score_cutoff=score_cutoff
    )
