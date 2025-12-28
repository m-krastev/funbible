/**
 * FunBible - Search Module
 * Hybrid search combining exact substring match and fuzzy matching
 */

class BibleSearch {
    constructor(bibleManager) {
        this.bibleManager = bibleManager;
        this.fuse = null;
        this.verses = [];
        this.lastQuery = '';
        this.lastResults = [];
        this.currentPage = 0;
        this.pageSize = 20;
    }

    /**
     * Initialize Fuse.js with current Bible data
     */
    initialize() {
        this.verses = this.bibleManager.getAllVersesFlat();

        // Configure Fuse.js for fuzzy search
        const options = {
            keys: ['text'],
            threshold: 0.4,
            distance: 100,
            ignoreLocation: true,
            includeScore: true,
            minMatchCharLength: 3,
        };

        this.fuse = new Fuse(this.verses, options);
    }

    /**
     * Perform hybrid search: exact matches first, then fuzzy
     */
    search(query, limit = 20) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        this.lastQuery = query.trim();
        this.currentPage = 0;

        const queryLower = this.lastQuery.toLowerCase();
        const results = [];
        const seenRefs = new Set();

        // Phase 1: Exact substring matches
        const exactMatches = [];
        const versesLen = this.verses.length;
        for (let i = 0; i < versesLen; i++) {
            const verse = this.verses[i];
            const pos = verse.text.toLowerCase().indexOf(queryLower);
            if (pos !== -1) {
                exactMatches.push({
                    ...verse,
                    score: 100,
                    matchType: 'exact',
                    matchPosition: pos
                });
                seenRefs.add(verse.reference);
                if (exactMatches.length >= limit * 5) break; // Cap exact matches for performance
            }
        }

        // Sort exact matches by position (earlier = more relevant)
        exactMatches.sort((a, b) => a.matchPosition - b.matchPosition);
        results.push(...exactMatches);

        // Phase 2: Fuzzy matches (if we need more results or no exact matches)
        if (results.length < limit && this.fuse) {
            const fuzzyResults = this.fuse.search(this.lastQuery, { limit: limit * 2 });

            for (const result of fuzzyResults) {
                if (!seenRefs.has(result.item.reference)) {
                    results.push({
                        ...result.item,
                        score: Math.round((1 - result.score) * 100),
                        matchType: 'fuzzy'
                    });
                    seenRefs.add(result.item.reference);
                }
            }
        }

        this.lastResults = results;
        return this.getResultsPage(0, limit);
    }

    /**
     * Get a page of results
     */
    getResultsPage(page, limit = 20) {
        const start = page * limit;
        const end = start + limit;
        this.currentPage = page;
        return {
            results: this.lastResults.slice(start, end),
            total: this.lastResults.length,
            hasMore: end < this.lastResults.length,
            page,
            query: this.lastQuery
        };
    }

    /**
     * Get next page of results
     */
    getNextPage(limit = 20) {
        return this.getResultsPage(this.currentPage + 1, limit);
    }

    /**
     * Parse a reference string and return matching verses
     * Supports: "John 3:16", "Genesis 1:1-3", "Psalms 23"
     */
    searchByReference(query) {
        if (!query) return null;

        // Pattern: [Book Name] [Chapter](:[Verse](-[VerseEnd])?)?
        const match = query.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);

        if (!match) {
            return null;
        }

        const [, bookQuery, chapter, verseStart, verseEnd] = match;

        // Find the book
        const book = this.bibleManager.findBook(bookQuery);
        if (!book) {
            return { error: `Book "${bookQuery}" not found.` };
        }

        const bible = this.bibleManager.currentBible;
        const chapterData = bible[book.id]?.[chapter];

        if (!chapterData) {
            return { error: `Chapter ${chapter} not found in ${book.name}.` };
        }

        const results = [];

        if (!verseStart) {
            // Return whole chapter
            const verseNums = Object.keys(chapterData)
                .map(v => parseInt(v))
                .sort((a, b) => a - b);

            for (const verseNum of verseNums) {
                results.push({
                    bookId: book.id,
                    bookName: book.name,
                    chapter: parseInt(chapter),
                    verse: verseNum,
                    text: chapterData[String(verseNum)],
                    reference: `${book.name} ${chapter}:${verseNum}`
                });
            }
        } else if (!verseEnd) {
            // Single verse
            const text = chapterData[verseStart];
            if (text) {
                results.push({
                    bookId: book.id,
                    bookName: book.name,
                    chapter: parseInt(chapter),
                    verse: parseInt(verseStart),
                    text,
                    reference: `${book.name} ${chapter}:${verseStart}`
                });
            } else {
                return { error: `Verse ${verseStart} not found in ${book.name} ${chapter}.` };
            }
        } else {
            // Verse range
            const start = parseInt(verseStart);
            const end = parseInt(verseEnd);

            for (let v = start; v <= end; v++) {
                const text = chapterData[String(v)];
                if (text) {
                    results.push({
                        bookId: book.id,
                        bookName: book.name,
                        chapter: parseInt(chapter),
                        verse: v,
                        text,
                        reference: `${book.name} ${chapter}:${v}`
                    });
                }
            }

            if (results.length === 0) {
                return { error: `Verses ${verseStart}-${verseEnd} not found in ${book.name} ${chapter}.` };
            }
        }

        return {
            book: book.name,
            chapter: parseInt(chapter),
            verses: results,
            isChapter: !verseStart
        };
    }

    /**
     * Highlight matching text in a string
     */
    highlightMatch(text, query) {
        if (!query) return text;

        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();
        const index = textLower.indexOf(queryLower);

        if (index === -1) return text;

        const before = text.slice(0, index);
        const match = text.slice(index, index + query.length);
        const after = text.slice(index + query.length);

        return `${before}<mark class="search-result-match">${match}</mark>${after}`;
    }
}

export { BibleSearch };
