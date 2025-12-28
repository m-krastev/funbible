/**
 * FunBible - Bible Data Manager
 * Handles loading, caching, and managing Bible versions
 */

// Standard English book names for normalization
const ENGLISH_BOOKS = [
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
];

// Map of common Bible book ID codes to their canonical position
const BIBLE_ID_MAP = {
    "GEN": 0, "EXO": 1, "LEV": 2, "NUM": 3, "DEU": 4, "JOS": 5, "JDG": 6, "RUT": 7,
    "1SA": 8, "2SA": 9, "1KI": 10, "2KI": 11, "1CH": 12, "2CH": 13, "EZR": 14, "NEH": 15,
    "EST": 16, "JOB": 17, "PSA": 18, "PRO": 19, "ECC": 20, "SNG": 21, "ISA": 22, "JER": 23,
    "LAM": 24, "EZK": 25, "DAN": 26, "HOS": 27, "JOL": 28, "AMO": 29, "OBA": 30, "JON": 31,
    "MIC": 32, "NAM": 33, "HAB": 34, "ZEP": 35, "HAG": 36, "ZEC": 37, "MAL": 38,
    "MAT": 39, "MRK": 40, "LUK": 41, "JHN": 42, "ACT": 43, "ROM": 44, "1CO": 45, "2CO": 46,
    "GAL": 47, "EPH": 48, "PHP": 49, "COL": 50, "1TH": 51, "2TH": 52, "1TI": 53, "2TI": 54,
    "TIT": 55, "PHM": 56, "HEB": 57, "JAS": 58, "1PE": 59, "2PE": 60, "1JN": 61, "2JN": 62,
    "3JN": 63, "JUD": 64, "REV": 65
};

const STORE_NAME = 'bibles';

class BibleManager {
    constructor() {
        this.dbName = 'FunBibleDB_v4';
        this.dbVersion = 1;
        this.versions = {};
        this.currentVersion = null;
        this.currentBible = null;
        this.currentLookup = null;
        this.currentLookupInverse = null;
        this.db = null;
        this.loadedVersions = {}; // versionId -> {bible, lookup, lookupInverse}

        // English fallback lookup
        const ids = Object.keys(BIBLE_ID_MAP);
        this.englishLookupInverse = {};
        this.englishLookup = {};
        ENGLISH_BOOKS.forEach((name, idx) => {
            const id = ids[idx];
            if (id) {
                this.englishLookupInverse[id] = name;
                this.englishLookup[name] = id;
            }
        });
    }

    /**
     * Initialize the IndexedDB database
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Load version metadata from versions.json
     */
    async loadVersions() {
        try {
            const response = await fetch('data/versions.json');
            this.versions = await response.json();

            // Check which versions are cached
            for (const id of Object.keys(this.versions)) {
                this.versions[id].cached = await this.isVersionCached(id);
            }

            return this.versions;
        } catch (error) {
            console.error('Failed to load versions:', error);
            return {};
        }
    }

    /**
     * Check if a version is cached in IndexedDB
     */
    async isVersionCached(versionId) {
        if (!this.db) return false;

        return new Promise((resolve) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(versionId);

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => resolve(false);
        });
    }

    /**
     * Get a cached version from IndexedDB
     */
    async getCachedVersion(versionId) {
        if (!this.db) return null;

        return new Promise((resolve) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(versionId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Save a version to IndexedDB cache
     */
    async cacheVersion(versionId, bible, lookup) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ id: versionId, bible, lookup });

            request.onsuccess = () => {
                this.versions[versionId].cached = true;
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove a version from IndexedDB cache
     */
    async removeFromCache(versionId) {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(versionId);

            request.onsuccess = () => {
                this.versions[versionId].cached = false;
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all cached versions
     */
    async clearCache() {
        if (!this.db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                for (const id of Object.keys(this.versions)) {
                    this.versions[id].cached = false;
                }
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Normalize Bible data from thiagobodruk format
     */
    normalizeBibleFormat(rawData, versionId) {
        const bible = {};
        let lookup = {};

        const bibleKeys = Object.keys(BIBLE_ID_MAP).sort((a, b) => BIBLE_ID_MAP[a] - BIBLE_ID_MAP[b]);

        // Handle thiagobodruk/bible format with books array
        if (Array.isArray(rawData) || (rawData.books && Array.isArray(rawData.books))) {
            const booksArray = Array.isArray(rawData) ? rawData : rawData.books;

            booksArray.forEach((book, bookIdx) => {
                // Use canonical ID from BIBLE_ID_MAP based on index to ensure consistency across versions
                const canonicalId = bibleKeys[bookIdx];
                const bookId = canonicalId || book.abbrev || String(bookIdx + 1);

                // Priority: book.book > book.name > ENGLISH_BOOKS fallback
                const bookName = book.book || book.name || ENGLISH_BOOKS[bookIdx] || `Book ${bookIdx + 1}`;
                lookup[bookName] = bookId;

                bible[bookId] = {};
                const chapters = book.chapters || [];
                chapters.forEach((verses, chapterIdx) => {
                    const chapterNum = String(chapterIdx + 1);
                    bible[bookId][chapterNum] = {};
                    verses.forEach((verseText, verseIdx) => {
                        const verseNum = String(verseIdx + 1);
                        bible[bookId][chapterNum][verseNum] = verseText;
                    });
                });
            });
        }
        // Handle object format
        else if (typeof rawData === 'object') {
            // If the JSON itself contains a lookup table, use it
            if (rawData.lookup) {
                lookup = rawData.lookup;
                Object.assign(bible, rawData.bible || rawData);
                // Remove lookup from bible data
                delete bible.lookup;
            } else {
                Object.assign(bible, rawData);
                // Fallback lookup generation
                for (const bookId of Object.keys(bible)) {
                    lookup[bookId] = bookId;
                }
            }
        }

        return { bible, lookup };
    }

    /**
     * Load a Bible version
     */
    async loadVersion(versionId, progressCallback = null, forceCurrent = false) {
        const versionInfo = this.versions[versionId];
        if (!versionInfo) {
            throw new Error(`Unknown version: ${versionId}`);
        }

        // Check cache first
        const cached = await this.getCachedVersion(versionId);
        if (cached) {
            const loaded = {
                bible: cached.bible,
                lookup: cached.lookup,
                lookupInverse: this.invertLookup(cached.lookup)
            };
            this.loadedVersions[versionId] = loaded;

            // Only update current state if it's the very first load or explicitly cleared
            if (!this.currentVersion || forceCurrent) {
                this.setPrimaryVersion(versionId);
            }
            return true;
        }

        // Fetch from URL
        if (progressCallback) progressCallback('Downloading...');

        try {
            const response = await fetch(versionInfo.url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const rawData = await response.json();

            // Check if we need to normalize (external format) or use as-is
            let bible, lookup;

            if (versionInfo.lookupUrl) {
                // Has separate lookup file (our format)
                bible = rawData;
                const lookupResponse = await fetch(versionInfo.lookupUrl);
                const lookupData = await lookupResponse.json();
                // Invert the lookup (our format is {id: name}, we need {name: id})
                lookup = {};
                for (const [key, value] of Object.entries(lookupData)) {
                    lookup[value] = key;
                }
            } else {
                // External format, needs normalization
                const normalized = this.normalizeBibleFormat(rawData, versionId);
                bible = normalized.bible;
                lookup = normalized.lookup;
            }

            // Cache it
            await this.cacheVersion(versionId, bible, lookup);

            const loaded = {
                bible: bible,
                lookup: lookup,
                lookupInverse: this.invertLookup(lookup)
            };
            this.loadedVersions[versionId] = loaded;

            if (!this.currentVersion || forceCurrent) {
                this.setPrimaryVersion(versionId);
            }

            if (this.versions[versionId]) {
                this.versions[versionId].cached = true;
            }

            if (progressCallback) progressCallback('Complete!');
            return true;
        } catch (error) {
            console.error(`Failed to load version ${versionId}:`, error);
            throw error;
        }
    }

    /**
     * Set a loaded version as the primary one
     */
    setPrimaryVersion(versionId) {
        const loaded = this.loadedVersions[versionId];
        if (!loaded) return false;

        this.currentVersion = versionId;
        this.currentBible = loaded.bible;
        this.currentLookup = loaded.lookup;
        this.currentLookupInverse = loaded.lookupInverse;
        return true;
    }

    /**
     * Invert a lookup table {name: id} -> {id: name}
     */
    invertLookup(lookup) {
        const inverse = {};
        for (const [name, id] of Object.entries(lookup)) {
            inverse[id] = name;
        }
        return inverse;
    }

    /**
     * Get list of books in current version
     */
    getBooks() {
        if (!this.currentBible) return [];

        const books = [];
        // Map of English book names to their 0-indexed canonical position
        const canonicalOrder = {};
        ENGLISH_BOOKS.forEach((name, index) => {
            canonicalOrder[name] = index;
        });

        const bookIds = Object.keys(this.currentBible);

        for (const bookId of bookIds) {
            // Priority 1: Current version's title (e.g. Bulgarian)
            // Priority 2: English fallback
            const bookName = this.currentLookupInverse[bookId] || this.englishLookupInverse[bookId] || `Book ${bookId}`;

            // Try to find the canonical order
            let order = 999;

            // 1. Check if the bookId itself is a name in our canonical list
            const inverseName = this.currentLookupInverse[bookId];
            if (BIBLE_ID_MAP[bookId] !== undefined) {
                order = BIBLE_ID_MAP[bookId];
            }
            else if (canonicalOrder[inverseName] !== undefined) {
                order = canonicalOrder[inverseName];
            }
            // 2. Check if the English lookup has a mapping for this ID
            else if (this.englishLookupInverse[bookId] && canonicalOrder[this.englishLookupInverse[bookId]] !== undefined) {
                order = canonicalOrder[this.englishLookupInverse[bookId]];
            }
            // 3. Fallback to numeric ID if available (0-66)
            else if (!isNaN(bookId)) {
                order = parseInt(bookId);
            }
            // 4. Last resort: current index in keys
            else {
                order = 1000 + bookIds.indexOf(bookId);
            }

            const chapterCount = Object.keys(this.currentBible[bookId]).length;
            books.push({
                id: bookId,
                name: bookName,
                chapterCount,
                order: order
            });
        }

        // Sort by the determined order
        books.sort((a, b) => a.order - b.order);

        return books;
    }

    /**
     * Get chapters for a book
     */
    getChapters(bookId) {
        if (!this.currentBible || !this.currentBible[bookId]) return [];

        return Object.keys(this.currentBible[bookId])
            .map(c => parseInt(c))
            .sort((a, b) => a - b);
    }

    /**
     * Get verses for a chapter in a specific version
     */
    getVerses(bookId, chapter, versionId = null) {
        const targetVersion = versionId || this.currentVersion;
        const versionData = this.loadedVersions[targetVersion];

        if (!versionData || !versionData.bible || !versionData.bible[bookId]) {
            // Fallback to current if targeted one not loaded
            if (this.currentBible && this.currentBible[bookId]) {
                return this._getVersesFromBible(this.currentBible, bookId, chapter);
            }
            return [];
        }

        return this._getVersesFromBible(versionData.bible, bookId, chapter);
    }

    _getVersesFromBible(bible, bookId, chapter) {
        const chapterData = bible[bookId][String(chapter)];
        if (!chapterData) return [];

        const verses = [];
        const verseNums = Object.keys(chapterData)
            .map(v => parseInt(v))
            .sort((a, b) => a - b);

        for (const verseNum of verseNums) {
            verses.push({
                number: verseNum,
                text: chapterData[String(verseNum)]
            });
        }

        return verses;
    }

    /**
     * Get a random verse
     */
    getRandomVerse() {
        if (!this.currentBible) return null;

        const bookIds = Object.keys(this.currentBible);
        const bookId = bookIds[Math.floor(Math.random() * bookIds.length)];

        const chapters = Object.keys(this.currentBible[bookId]);
        const chapter = chapters[Math.floor(Math.random() * chapters.length)];

        const verses = Object.keys(this.currentBible[bookId][chapter]);
        const verse = verses[Math.floor(Math.random() * verses.length)];

        const bookName = this.currentLookupInverse[bookId] || `Book ${bookId}`;
        const text = this.currentBible[bookId][chapter][verse];

        return {
            bookId,
            bookName,
            chapter: parseInt(chapter),
            verse: parseInt(verse),
            text,
            reference: `${bookName} ${chapter}:${verse}`
        };
    }

    /**
     * Get all verses as flat array for search
     */
    getAllVersesFlat() {
        if (!this.currentBible) return [];

        const verses = [];

        for (const bookId of Object.keys(this.currentBible)) {
            const bookName = this.currentLookupInverse[bookId] || `Book ${bookId}`;

            for (const chapter of Object.keys(this.currentBible[bookId])) {
                for (const verse of Object.keys(this.currentBible[bookId][chapter])) {
                    const text = this.currentBible[bookId][chapter][verse];
                    verses.push({
                        bookId,
                        bookName,
                        chapter: parseInt(chapter),
                        verse: parseInt(verse),
                        text,
                        reference: `${bookName} ${chapter}:${verse}`
                    });
                }
            }
        }

        return verses;
    }

    /**
     * Find book by fuzzy name match
     */
    findBook(query) {
        if (!this.currentLookup) return null;

        const queryLower = query.toLowerCase().trim();
        const bookNames = Object.keys(this.currentLookup);

        // Exact match first
        for (const name of bookNames) {
            if (name.toLowerCase() === queryLower) {
                return { name, id: this.currentLookup[name] };
            }
        }

        // Prefix match
        for (const name of bookNames) {
            if (name.toLowerCase().startsWith(queryLower)) {
                return { name, id: this.currentLookup[name] };
            }
        }

        // Contains match
        for (const name of bookNames) {
            if (name.toLowerCase().includes(queryLower)) {
                return { name, id: this.currentLookup[name] };
            }
        }

        // Fallback to English names
        if (this.englishLookup) {
            const engNames = Object.keys(this.englishLookup);
            for (const name of engNames) {
                if (name.toLowerCase() === queryLower || name.toLowerCase().startsWith(queryLower) || name.toLowerCase().includes(queryLower)) {
                    return { name, id: this.englishLookup[name] };
                }
            }
        }

        return null;
    }

    /**
     * Get default version ID
     */
    getDefaultVersion() {
        const stored = localStorage.getItem('funbible-default-version');
        if (stored && this.versions[stored]) {
            return stored;
        }

        // Return first bundled version
        for (const [id, info] of Object.entries(this.versions)) {
            if (info.bundled) {
                return id;
            }
        }

        // Return first available
        return Object.keys(this.versions)[0];
    }

    /**
     * Set default version
     */
    setDefaultVersion(versionId) {
        localStorage.setItem('funbible-default-version', versionId);
    }

    /**
     * Get list of installed/available versions for display
     */
    getVersionList() {
        const list = [];

        for (const [id, info] of Object.entries(this.versions)) {
            list.push({
                id,
                name: info.name,
                language: info.language,
                description: info.description,
                bundled: info.bundled,
                cached: info.cached || info.bundled,
                isDefault: id === this.getDefaultVersion()
            });
        }

        // Sort: bundled first, then cached, then by name
        list.sort((a, b) => {
            if (a.bundled !== b.bundled) return b.bundled - a.bundled;
            if (a.cached !== b.cached) return b.cached - a.cached;
            return a.name.localeCompare(b.name);
        });

        return list;
    }
}

export { BibleManager, ENGLISH_BOOKS };
