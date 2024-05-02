
from bs4 import BeautifulSoup
import rapidfuzz
from requests import get

def find_verses_online(bible_verse: str, lookup_table):
    """Find verses"""
    verse_data: list[str] = bible_verse.split()
    book = " ".join(verse_data[:-1])

    book = rapidfuzz.process.extractOne(book, lookup_table.values())[0]

    book = lookup_table[book]

    # if its a whole chapter
    if ":" not in bible_verse:
        
        URL = f'https://biblia.bg/index.php?k={book}&g={verse_data[-1]}'

        soup = BeautifulSoup(get(URL).content, 'html.parser')

        results = soup.find_all("div",class_="versions")
        res = ""
        
        for verse in results:
            res += verse.text
            
        return res


    ch, verse = verse_data[-1].split(":",1)
    ch = int(ch)
    
    URL = f'https://biblia.bg/index.php?k={book}&g={ch}'

    soup = BeautifulSoup(get(URL).content, 'html.parser')

    results = soup.find_all("div",class_="versions")
    
    # if a verse span
    if "-" in verse:
        res = ""
        verse, verse_end = map(int,verse.split("-",1))
        for i in range(verse-1, verse_end if verse_end < len(results) else len(results)):
                res += results[i].text + " "
    else:
        verse = int(verse)-1
        try:
            res = results[verse].text
        except KeyError:
            res = "Verse not found"
    return res
    