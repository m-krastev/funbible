/**
 * FunBible - Main Application Controller
 */

import { BibleManager } from './bible-manager.js';
import { BibleSearch } from './search.js';

class FunBibleApp {
    constructor() {
        this.bibleManager = new BibleManager();
        this.search = null;

        // State
        this.selectedVerses = new Map(); // reference -> verse data
        this.highlights = JSON.parse(localStorage.getItem('funbible-highlights') || '{}'); // reference -> color
        this.currentBook = JSON.parse(localStorage.getItem('funbible-current-book') || 'null');
        this.currentChapter = parseInt(localStorage.getItem('funbible-current-chapter') || '0') || null;
        this.fontSize = parseInt(localStorage.getItem('funbible-font-size') || '18');
        this.lineHeight = parseFloat(localStorage.getItem('funbible-line-height') || '1.6');
        this.fontFamily = localStorage.getItem('funbible-font-family') || 'serif';
        this.language = localStorage.getItem('funbible-lang') || 'en';
        this.isSplitView = false;
        this.secondaryVersion = null;

        // Translations
        this.translations = {
            en: {
                app_title: "Biblia",
                search_placeholder: "Search verses or enter reference...",
                books_header: "Books",
                select_book: "Select a book",
                select_chapter: "Select Chapter",
                welcome_title: "Welcome to Biblia",
                welcome_text: "Select a book from the sidebar, search for verses, or try a random verse to get started.",
                random_button: "🎲 Random Verse",
                search_button: "🔍 Search",
                compare_with: "Compare with:",
                none: "None",
                copy: "Copy",
                clear: "Clear",
                highlight_color: "Highlight Color",
                copy_ref: "Copy with Reference",
                copy_text: "Copy Text Only",
                split_view: "Compare",
                chapter: "Chapter",
                verse_selected: "verse selected",
                verses_selected: "verses selected",
                settings_title: "Settings",
                bible_versions: "Bible Versions",
                default_version: "Default Version",
                font_size: "Font Size",
                line_height: "Line Height",
                font_family: "Font Family",
                app_language: "App Language",
                clear_cache: "Clear Downloaded Versions",
                status_bundled: "Bundled",
                status_downloaded: "Downloaded",
                status_available: "Available",
                download_btn: "Download",
                remove_btn: "Remove"
            },
            bg: {
                app_title: "Библия",
                search_placeholder: "Търсене на стихове или препратки...",
                books_header: "Книги",
                select_book: "Изберете книга",
                select_chapter: "Изберете глава",
                welcome_title: "Добре дошли в Библия",
                welcome_text: "Изберете книга от страничното меню, потърсете стихове или опитайте случаен стих, за да започнете.",
                random_button: "🎲 Случаен Стих",
                search_button: "🔍 Търсене",
                compare_with: "Сравни с:",
                none: "Няма",
                copy: "Копирай",
                clear: "Изчисти",
                highlight_color: "Цвят на подчертаване",
                copy_ref: "Копирай с препратка",
                copy_text: "Само текста",
                split_view: "Сравни",
                chapter: "Глава",
                verse_selected: "избран стих",
                verses_selected: "избрани стиха",
                settings_title: "Настройки",
                bible_versions: "Версии на Библията",
                default_version: "Версия по подразбиране",
                font_size: "Размер на шрифта",
                line_height: "Междуредие",
                font_family: "Шрифт",
                app_language: "Език на приложението",
                clear_cache: "Изчисти изтеглените версии",
                status_bundled: "Включена",
                status_downloaded: "Изтеглена",
                status_available: "Налична",
                download_btn: "Изтегли",
                remove_btn: "Премахни"
            }
        };

        // DOM elements
        this.elements = {};
    }

    /**
     * Initialize the application
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        this.applyTheme();
        this.applyReadingSettings();
        this.updateUI();

        try {
            // Register Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js')
                    .then(reg => console.log('SW registered', reg))
                    .catch(err => console.error('SW registration failed', err));
            }

            // Initialize IndexedDB
            await this.bibleManager.initDB();
            this.updateLoadingText('Loading versions...');

            // Load version metadata
            await this.bibleManager.loadVersions();
            this.populateVersionSelects();

            // Load default version
            const defaultVersion = this.bibleManager.getDefaultVersion();
            this.updateLoadingText(`Loading ${this.bibleManager.versions[defaultVersion]?.name || defaultVersion}...`);

            await this.bibleManager.loadVersion(defaultVersion);

            // Initialize search
            this.search = new BibleSearch(this.bibleManager);
            this.search.initialize();

            // Populate book list
            this.populateBookList();

            // Restore last state if exists
            if (this.currentBook && this.currentChapter) {
                this.showChapter(this.currentBook, this.currentChapter);
            } else if (this.currentBook) {
                this.showChapterSelector(this.currentBook);
            }

            // Hide loading, show app
            this.hideLoading();

        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showToast('Failed to initialize app: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText: document.getElementById('loading-text'),
            app: document.getElementById('app'),
            searchInput: document.getElementById('search-input'),
            versionSelect: document.getElementById('version-select'),
            randomBtn: document.getElementById('random-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            themeToggle: document.getElementById('theme-toggle'),
            sidebar: document.getElementById('sidebar'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            bookList: document.getElementById('book-list'),
            breadcrumb: document.getElementById('breadcrumb'),
            breadcrumbBook: document.getElementById('breadcrumb-book'),
            breadcrumbSep: document.getElementById('breadcrumb-sep'),
            breadcrumbChapterContainer: document.getElementById('breadcrumb-chapter-container'),
            breadcrumbChapter: document.getElementById('breadcrumb-chapter'),
            chapterSelector: document.getElementById('chapter-selector'),
            chapterGrid: document.getElementById('chapter-grid'),
            versesContainer: document.getElementById('verses-container'),
            welcomeMessage: document.getElementById('welcome-message'),
            welcomeRandom: document.getElementById('welcome-random'),
            welcomeSearch: document.getElementById('welcome-search'),
            searchResults: document.getElementById('search-results'),
            searchResultsTitle: document.getElementById('search-results-title'),
            searchResultsList: document.getElementById('search-results-list'),
            closeSearch: document.getElementById('close-search'),
            loadMoreResults: document.getElementById('load-more-results'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            versionList: document.getElementById('version-list'),
            defaultVersionSelect: document.getElementById('default-version-select'),
            fontSizeSlider: document.getElementById('font-size-slider'),
            fontSizeValue: document.getElementById('font-size-value'),
            lineHeightSlider: document.getElementById('line-height-slider'),
            lineHeightValue: document.getElementById('line-height-value'),
            fontSerifBtn: document.getElementById('font-serif-btn'),
            fontSansBtn: document.getElementById('font-sans-btn'),
            langToggle: document.getElementById('lang-toggle'),
            langText: document.getElementById('lang-text'),
            clearCache: document.getElementById('clear-cache'),
            toastContainer: document.getElementById('toast-container'),
            splitViewToggle: document.getElementById('split-view-toggle'),
            splitViewSelectContainer: document.getElementById('split-version-select-container'),
            splitVersionSelect: document.getElementById('split-version-select'),
            primaryVerses: document.getElementById('primary-verses'),
            secondaryVerses: document.getElementById('secondary-verses'),
            versesLayout: document.getElementById('verses-layout'),
            verseModal: document.getElementById('verse-modal'),
            modalRef: document.getElementById('modal-ref'),
            modalCopy: document.getElementById('modal-copy'),
            modalClearHighlight: document.getElementById('modal-clear-highlight'),
            closeModal: document.getElementById('close-modal'),
            colorPalette: document.getElementById('color-palette'),
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search
        this.elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch(e.target.value);
            }
        });

        // Keyboard shortcut for search
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.elements.searchInput.focus();
            }
        });

        // Breadcrumb Selects
        this.elements.breadcrumbBook.addEventListener('change', (e) => {
            const bookId = e.target.value;
            const bookName = e.target.options[e.target.selectedIndex].text;
            this.selectBook({ id: bookId, name: bookName });
        });

        this.elements.breadcrumbChapter.addEventListener('change', (e) => {
            if (this.currentBook) {
                this.showChapter(this.currentBook, parseInt(e.target.value));
            }
        });

        // Version select
        this.elements.versionSelect.addEventListener('change', (e) => {
            this.switchVersion(e.target.value);
        });

        // Random verse
        this.elements.randomBtn.addEventListener('click', () => this.showRandomVerse());
        this.elements.welcomeRandom?.addEventListener('click', () => this.showRandomVerse());

        // Welcome search
        this.elements.welcomeSearch?.addEventListener('click', () => {
            this.elements.searchInput.focus();
        });

        // Settings
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.closeSettings();
        });

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Sidebar toggle (mobile)
        this.elements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());

        // Close search results
        this.elements.closeSearch.addEventListener('click', () => this.closeSearchResults());

        // Load more search results
        this.elements.loadMoreResults.addEventListener('click', () => this.loadMoreSearchResults());



        // Font size slider
        this.elements.fontSizeSlider.addEventListener('input', (e) => {
            this.fontSize = parseInt(e.target.value);
            this.applyReadingSettings();
            localStorage.setItem('funbible-font-size', String(this.fontSize));
        });

        // Line height slider
        this.elements.lineHeightSlider.addEventListener('input', (e) => {
            this.lineHeight = parseFloat(e.target.value);
            this.applyReadingSettings();
            localStorage.setItem('funbible-line-height', String(this.lineHeight));
        });

        // Font family buttons
        this.elements.fontSerifBtn.addEventListener('click', () => {
            this.fontFamily = 'serif';
            this.applyReadingSettings();
            localStorage.setItem('funbible-font-family', 'serif');
        });

        this.elements.fontSansBtn.addEventListener('click', () => {
            this.fontFamily = 'sans';
            this.applyReadingSettings();
            localStorage.setItem('funbible-font-family', 'sans');
        });

        // Default version select
        this.elements.defaultVersionSelect.addEventListener('change', (e) => {
            this.bibleManager.setDefaultVersion(e.target.value);
            this.showToast('Default version updated', 'success');
        });

        // Clear cache
        this.elements.clearCache.addEventListener('click', async () => {
            if (confirm('This will remove all downloaded Bible versions. Continue?')) {
                await this.bibleManager.clearCache();
                this.populateVersionList();
                this.showToast('Cache cleared', 'success');
            }
        });

        // Language toggle
        this.elements.langToggle?.addEventListener('click', () => this.toggleLanguage());

        // Split view toggle
        this.elements.splitViewToggle?.addEventListener('click', () => this.toggleSplitView());

        // Split version select
        this.elements.splitVersionSelect?.addEventListener('change', (e) => {
            this.secondaryVersion = e.target.value;
            if (this.currentBook && this.currentChapter) {
                this.showChapter(this.currentBook, this.currentChapter);
            }
        });


        // Verse modal events
        this.elements.closeModal?.addEventListener('click', () => {
            this.elements.verseModal.classList.add('hidden');
        });

        this.elements.modalCopy?.addEventListener('click', () => {
            this.copySelected(true);
            this.elements.verseModal.classList.add('hidden');
        });

        this.elements.modalClearHighlight?.addEventListener('click', () => {
            if (this.selectedVerses.size === 0) return;

            this.selectedVerses.forEach((verse, ref) => {
                delete this.highlights[ref];
                const els = document.querySelectorAll(`.verse-item[data-reference="${ref}"]`);
                els.forEach(el => {
                    el.classList.remove('highlighted');
                    el.style.removeProperty('--highlight-color');
                });
            });

            localStorage.setItem('funbible-highlights', JSON.stringify(this.highlights));
            this.elements.verseModal.classList.add('hidden');
            this.clearSelection();
        });

        this.elements.colorPalette?.addEventListener('click', (e) => {
            if (e.target.dataset.color && this.selectedVerses.size > 0) {
                const color = e.target.dataset.color;

                this.selectedVerses.forEach((verse, ref) => {
                    this.highlights[ref] = color;
                    const els = document.querySelectorAll(`.verse-item[data-reference="${ref}"]`);
                    els.forEach(el => {
                        el.classList.add('highlighted');
                        el.style.setProperty('--highlight-color', color);
                    });
                });

                localStorage.setItem('funbible-highlights', JSON.stringify(this.highlights));
                this.elements.verseModal.classList.add('hidden');
                this.clearSelection();
            }
        });
    }

    /**
     * Update loading text
     */
    updateLoadingText(text) {
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
    }

    /**
     * Update UI text based on current language
     */
    updateUI() {
        const set = this.translations[this.language];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (set[key]) el.textContent = set[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (set[key]) el.placeholder = set[key];
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            if (set[key]) el.title = set[key];
        });

        if (this.elements.langText) {
            this.elements.langText.textContent = this.language.toUpperCase() === 'EN' ? 'BG' : 'EN';
        } else {
            this.elements.langToggle.textContent = this.language.toUpperCase() === 'EN' ? 'BG' : 'EN';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.elements.loadingOverlay.classList.add('opacity-0');
        this.elements.app.classList.remove('opacity-0');
        setTimeout(() => {
            this.elements.loadingOverlay.classList.add('hidden');
        }, 500);
    }

    /**
     * Populate version select dropdowns
     */
    populateVersionSelects() {
        const versions = this.bibleManager.getVersionList();
        const defaultVersion = this.bibleManager.getDefaultVersion();

        // Main select
        this.elements.versionSelect.innerHTML = versions
            .filter(v => v.cached || v.bundled)
            .map(v => `<option value="${v.id}" ${v.id === defaultVersion ? 'selected' : ''}>
                ${v.name}
            </option>`)
            .join('');

        // Default version select in settings
        this.elements.defaultVersionSelect.innerHTML = versions
            .filter(v => v.cached || v.bundled)
            .map(v => `<option value="${v.id}" ${v.isDefault ? 'selected' : ''}>
                ${v.name}
            </option>`)
            .join('');
    }

    /**
     * Populate version list in settings
     */
    populateVersionList() {
        const versions = this.bibleManager.getVersionList();
        const set = this.translations[this.language];

        this.elements.versionList.innerHTML = versions.map(v => {
            const statusText = v.bundled ? set.status_bundled : (v.cached ? set.status_downloaded : set.status_available);
            const statusClass = v.bundled ? 'text-green-400' : (v.cached ? 'text-primary-400' : 'text-slate-500');

            let buttonHtml = '';
            if (!v.bundled && !v.cached) {
                buttonHtml = `<button class="version-item-btn" 
                    data-action="download" data-version="${v.id}">${set.download_btn}</button>`;
            } else if (!v.bundled && v.cached) {
                buttonHtml = `<button class="version-item-btn" 
                    data-action="remove" data-version="${v.id}">${set.remove_btn}</button>`;
            }

            return `
                <div class="version-item">
                    <div>
                        <div class="version-item-name">${v.name}</div>
                        <div class="version-item-status ${statusClass}">${statusText} • ${v.language.toUpperCase()}</div>
                    </div>
                    ${buttonHtml}
                </div>
            `;
        }).join('');

        // Bind download/remove buttons
        this.elements.versionList.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;
                const versionId = e.target.dataset.version;

                if (action === 'download') {
                    await this.downloadVersion(versionId, e.target);
                } else if (action === 'remove') {
                    await this.removeVersion(versionId);
                }
            });
        });
    }

    /**
     * Download a version
     */
    async downloadVersion(versionId, button) {
        const originalText = button.textContent;
        button.textContent = 'Downloading...';
        button.disabled = true;

        try {
            await this.bibleManager.loadVersion(versionId, (msg) => {
                button.textContent = msg;
            });

            this.populateVersionSelects();
            this.populateVersionList();
            if (this.isSplitView) this.populateSplitVersionSelect();
            this.showToast(`Downloaded ${this.bibleManager.versions[versionId].name}`, 'success');
        } catch (error) {
            this.showToast(`Failed to download: ${error.message}`, 'error');
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    /**
     * Remove a version from cache
     */
    async removeVersion(versionId) {
        try {
            await this.bibleManager.removeFromCache(versionId);
            this.populateVersionSelects();
            this.populateVersionList();
            if (this.isSplitView) this.populateSplitVersionSelect();
            this.showToast('Version removed', 'success');
        } catch (error) {
            this.showToast(`Failed to remove: ${error.message}`, 'error');
        }
    }

    /**
     * Switch Bible version
     */
    async switchVersion(versionId) {
        try {
            this.showToast(`Loading ${this.bibleManager.versions[versionId]?.name}...`, 'info');

            await this.bibleManager.loadVersion(versionId, null, true);
            this.bibleManager.setDefaultVersion(versionId); // Save preference
            this.search.initialize();
            this.populateBookList();

            // Refresh current view
            if (this.isSplitView) this.populateSplitVersionSelect();
            if (this.currentChapter && this.currentBook) {
                this.showChapter(this.currentBook, this.currentChapter);
            }

            this.showToast(`Switched to ${this.bibleManager.versions[versionId].name}`, 'success');
        } catch (error) {
            this.showToast(`Failed to switch: ${error.message}`, 'error');
        }
    }

    /**
     * Populate book list in sidebar with collapsible sections
     */
    populateBookList() {
        const books = this.bibleManager.getBooks();

        const html = books.map(book => `
            <div class="book-item" data-book-id="${book.id}" data-book-name="${book.name}">
                ${book.name}
                <svg class="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </div>
        `).join('');

        this.elements.bookList.innerHTML = html;

        // Bind click events for books
        this.elements.bookList.querySelectorAll('.book-item[data-book-id]').forEach(item => {
            item.addEventListener('click', () => {
                const bookId = item.dataset.bookId;
                const bookName = item.dataset.bookName;
                this.selectBook({ id: bookId, name: bookName });
            });
        });

        // Populate Breadcrumb Book Select
        const options = books.map(book => `<option value="${book.id}">${book.name}</option>`).join('');
        this.elements.breadcrumbBook.innerHTML = `<option value="" disabled>Select a book</option>${options}`;
        
        // Set selected book if we have one
        if (this.currentBook) {
            this.elements.breadcrumbBook.value = this.currentBook.id;
        }
    }

    /**
     * Select a book and show chapter selector
     */
    selectBook(book) {
        this.currentBook = book;
        this.currentChapter = null;

        localStorage.setItem('funbible-current-book', JSON.stringify(book));
        localStorage.removeItem('funbible-current-chapter');

        // Update sidebar active state
        this.elements.bookList.querySelectorAll('.book-item').forEach(item => {
            item.classList.toggle('active', item.dataset.bookId === book.id);
        });

        // Close modal on navigation
        if (typeof this.closeModal === 'function') this.closeModal();

        // Update breadcrumb
        this.elements.breadcrumbBook.value = book.id;
        this.elements.breadcrumbChapterContainer.classList.add('hidden');
        this.elements.breadcrumbChapter.innerHTML = '';

        // Close sidebar on mobile
        this.closeSidebar();

        this.showChapterSelector(book);
    }

    /**
     * Show chapter selector for a book
     */
    showChapterSelector(book) {
        const chapters = this.bibleManager.getChapters(book.id);

        this.elements.chapterGrid.innerHTML = chapters.map(chapter =>
            `<button class="chapter-btn" data-chapter="${chapter}">${chapter}</button>`
        ).join('');

        // Bind click events
        this.elements.chapterGrid.querySelectorAll('.chapter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chapter = parseInt(btn.dataset.chapter);
                if (typeof this.closeModal === 'function') this.closeModal();
                this.showChapter(book, chapter);
            });
        });

        // Populate Breadcrumb Chapter Select
        const chapterOptions = chapters.map(c => `<option value="${c}">${this.translations[this.language].chapter} ${c}</option>`).join('');
        this.elements.breadcrumbChapter.innerHTML = `<option value="" disabled>${this.translations[this.language].select_chapter}</option>${chapterOptions}`;
        
        // Ensure book select is set
        this.elements.breadcrumbBook.value = book.id;

        // Show chapter selector, hide welcome/verses
        this.elements.welcomeMessage.classList.add('hidden');
        this.elements.chapterSelector.classList.remove('hidden');
        this.elements.searchResults.classList.add('hidden');

        // Clear verses
        if (this.elements.primaryVerses) this.elements.primaryVerses.innerHTML = '';
        if (this.elements.secondaryVerses) this.elements.secondaryVerses.innerHTML = '';
        this.elements.versesContainer.classList.add('hidden');
    }

    /**
     * Show chapter content
     */
    async showChapter(book, chapter) {
        this.currentBook = book;
        this.currentChapter = chapter;

        localStorage.setItem('funbible-current-book', JSON.stringify(book));
        localStorage.setItem('funbible-current-chapter', String(chapter));

        // Ensure chapter select is populated
        if (!this.elements.breadcrumbChapter.querySelector(`option[value="${chapter}"]`)) {
            const chapters = this.bibleManager.getChapters(book.id);
            const chapterOptions = chapters.map(c => `<option value="${c}">${this.translations[this.language].chapter} ${c}</option>`).join('');
            this.elements.breadcrumbChapter.innerHTML = `<option value="" disabled>${this.translations[this.language].select_chapter}</option>${chapterOptions}`;
        }

        // Update Breadcrumb
        this.elements.breadcrumbChapterContainer.classList.remove('hidden');
        this.elements.breadcrumbChapter.value = chapter;
        this.elements.breadcrumbBook.value = book.id;

        // Render verse list
        this.elements.breadcrumbSep.classList.remove('hidden');

        // Update chapter button active state
        this.elements.chapterGrid.querySelectorAll('.chapter-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.chapter) === chapter);
        });

        this.elements.chapterSelector.classList.add('hidden');
        this.elements.versesContainer.classList.remove('hidden');

        // Primary version
        const primaryVerses = this.bibleManager.getVerses(book.id, chapter, this.bibleManager.currentVersion);
        this.renderVersesTo(this.elements.primaryVerses, primaryVerses, book, chapter);

        // Secondary version for split view
        if (this.isSplitView && this.secondaryVersion) {
            try {
                // Ensure version is loaded
                await this.bibleManager.loadVersion(this.secondaryVersion);
                const secondaryVerses = this.bibleManager.getVerses(book.id, chapter, this.secondaryVersion);
                this.renderVersesTo(this.elements.secondaryVerses, secondaryVerses, book, chapter);
                this.elements.secondaryVerses.classList.remove('hidden');
            } catch (e) {
                console.error("Failed to load secondary version", e);
                this.elements.secondaryVerses.classList.add('hidden');
            }
        } else {
            this.elements.secondaryVerses.classList.add('hidden');
        }
    }

    /**
     * Render verses to a specific container
     */
    renderVersesTo(container, verses, book, chapter) {
        container.innerHTML = '';
        if (verses.length === 0) return;

        this.elements.welcomeMessage.classList.add('hidden');
        this.elements.searchResults.classList.add('hidden');

        const fragment = document.createDocumentFragment();

        verses.forEach(verse => {
            const fullVerse = {
                ...verse,
                bookId: book.id,
                bookName: book.name,
                chapter,
                reference: `${book.name} ${chapter}:${verse.number}`
            };

            const isSelected = this.selectedVerses.has(fullVerse.reference);
            const highlightColor = this.highlights[fullVerse.reference];

            const verseEl = document.createElement('div');
            verseEl.className = `verse-item ${isSelected ? 'selected' : ''} ${highlightColor ? 'highlighted' : ''}`;
            verseEl.dataset.reference = fullVerse.reference;
            verseEl.dataset.verse = JSON.stringify(fullVerse);

            if (highlightColor) {
                verseEl.style.setProperty('--highlight-color', highlightColor);
            }

            verseEl.innerHTML = `
                <span class="verse-number">${verse.number || verse.verse}</span>
                <span class="verse-text">${verse.text}</span>
            `;

            verseEl.addEventListener('click', (e) => {
                this.handleVerseClick(verseEl, e);
            });

            fragment.appendChild(verseEl);
        });

        container.appendChild(fragment);
    }

    /**
     * Handle verse click - toggle selection and show modal
     */
    handleVerseClick(element, event) {
        const reference = element.dataset.reference;
        const verse = JSON.parse(element.dataset.verse);

        // Toggle selection
        if (this.selectedVerses.has(reference)) {
            this.selectedVerses.delete(reference);
            element.classList.remove('selected');

            if (this.selectedVerses.size === 0) {
                this.elements.verseModal.classList.add('hidden');
            } else {
                // Find another selected element to anchor the modal to
                const firstSelectedRef = this.selectedVerses.keys().next().value;
                const firstSelectedEl = document.querySelector(`.verse-item.selected[data-reference="${firstSelectedRef}"]`);
                if (firstSelectedEl) {
                    this.showVerseModal(firstSelectedEl, firstSelectedRef);
                }
            }
        } else {
            this.selectedVerses.set(reference, verse);
            element.classList.add('selected');
            this.showVerseModal(element, reference);
        }

        // Sync with other view if in split mode
        const otherRef = document.querySelectorAll(`.verse-item[data-reference="${reference}"]`);
        otherRef.forEach(el => {
            if (el !== element) {
                el.classList.toggle('selected', this.selectedVerses.has(reference));
            }
        });
    }

    /**
     * Show verse actions modal
     */
    showVerseModal(element, reference) {
        const rect = element.getBoundingClientRect();
        const modal = this.elements.verseModal;
        const selectionRef = this.getSelectionReference();

        this.elements.modalRef.textContent = selectionRef || reference;
        this.elements.modalRef.dataset.ref = reference;

        modal.classList.remove('hidden');

        // Check for mobile
        if (window.innerWidth < 768) {
            // Mobile Bottom Sheet Style
            modal.style.top = 'auto';
            modal.style.left = '0';
            modal.style.right = '0';
            modal.style.bottom = '0';
            modal.style.width = '100%';
            modal.style.maxWidth = '100%';
            modal.style.borderRadius = '1rem 1rem 0 0';
            modal.style.transform = 'translateY(100%)';
            modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            // Force reflow
            void modal.offsetWidth;

            modal.style.transform = 'translateY(0)';
        } else {
            // Desktop Popover Style
            modal.style.width = 'auto';
            modal.style.maxWidth = 'none';
            modal.style.borderRadius = '1rem';
            modal.style.bottom = 'auto';
            modal.style.right = 'auto';
            modal.style.transform = 'none';
            modal.style.transition = 'none';

        // Position modal to the side
        let top = rect.top + window.scrollY;
        let left = rect.right + 10;

        // Check if it fits on the right
        if (left + modal.offsetWidth > window.innerWidth) {
            left = rect.left - modal.offsetWidth - 10;
        }

        modal.style.top = `${top}px`;
        modal.style.left = `${left}px`;
    }
    }



    /**
     * Clear all selected verses
     */
    clearSelection() {
        this.selectedVerses.clear();
        document.querySelectorAll('.verse-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }

    /**
     * Get a formatted reference string for currently selected verses
     */
    getSelectionReference() {
        if (this.selectedVerses.size === 0) return '';
        const verses = Array.from(this.selectedVerses.values());

        // Sort by canonical order
        verses.sort((a, b) => {
            if (a.bookId !== b.bookId) {
                // Use order from BibleManager if available
                const orderA = this.bibleManager.getBooks().find(bk => bk.id === a.bookId)?.order || 0;
                const orderB = this.bibleManager.getBooks().find(bk => bk.id === b.bookId)?.order || 0;
                return orderA - orderB;
            }
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return (a.verse || a.number) - (b.verse || b.number);
        });

        // Group by book and chapter
        const groups = [];
        verses.forEach(v => {
            const key = `${v.bookName} ${v.chapter}`;
            let group = groups.find(g => g.key === key);
            if (!group) {
                group = { key, bookName: v.bookName, chapter: v.chapter, verses: [] };
                groups.push(group);
            }
            group.verses.push(parseInt(v.verse || v.number));
        });

        // Format each group
        return groups.map(g => {
            const verseRanges = [];
            let start = g.verses[0];
            let prev = start;

            for (let i = 1; i <= g.verses.length; i++) {
                const curr = g.verses[i];
                if (curr !== prev + 1) {
                    if (start === prev) {
                        verseRanges.push(`${start}`);
                    } else {
                        verseRanges.push(`${start}-${prev}`);
                    }
                    start = curr;
                }
                prev = curr;
            }

            return `${g.key}:${verseRanges.join(', ')}`;
        }).join('; ');
    }

    /**
     * Copy selected verses to clipboard
     */
    async copySelected(includeRef) {
        const verses = Array.from(this.selectedVerses.values());

        // Sort by reference order
        verses.sort((a, b) => {
            if (a.bookId !== b.bookId) return parseInt(a.bookId) - parseInt(b.bookId);
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return (a.verse || a.number) - (b.verse || b.number);
        });

        let text;
        if (includeRef) {
            // Group by reference
            if (verses.length === 1) {
                const v = verses[0];
                text = `"${v.text}" — ${v.reference}`;
            } else {
                text = verses.map(v => `${v.verse || v.number} ${v.text}`).join('\n');
                // Add overall reference using complex range logic
                text += `\n\n— ${this.getSelectionReference()}`;
            }
        } else {
            text = verses.map(v => v.text).join(' ');
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
        } catch (error) {
            this.showToast('Failed to copy', 'error');
        }
    }

    /**
     * Handle search input
     */
    handleSearch(query) {
        if (!query || query.trim().length < 2) return;

        // First try to parse as reference
        const refResult = this.search.searchByReference(query);

        if (refResult && !refResult.error) {
            // It's a valid reference
            if (refResult.isChapter) {
                // Show full chapter
                const book = this.bibleManager.findBook(refResult.book);
                this.showChapter(book, refResult.chapter);
            } else {
                // Show specific verses
                this.elements.chapterSelector.classList.add('hidden');
                this.elements.welcomeMessage.classList.add('hidden');
                this.elements.searchResults.classList.add('hidden');
                this.elements.versesContainer.classList.remove('hidden');
                this.elements.secondaryVerses.classList.add('hidden'); // Hide secondary in search mode for simplicity

                this.renderVersesTo(this.elements.primaryVerses, refResult.verses, { id: refResult.bookId, name: refResult.book }, refResult.chapter);

                this.elements.currentBook.textContent = refResult.book;
                const set = this.translations[this.language];
                this.elements.currentChapter.textContent = `${set.chapter} ${refResult.chapter}`;
                this.elements.currentChapter.classList.remove('hidden');
                this.elements.breadcrumbSep.classList.remove('hidden');
                
            }
            return;
        }

        // Otherwise, do text search
        const results = this.search.search(query);
        this.displaySearchResults(results);
    }

    /**
     * Display search results
     */
    displaySearchResults(results) {
        this.elements.welcomeMessage.classList.add('hidden');
        this.elements.chapterSelector.classList.add('hidden');
        this.elements.searchResults.classList.remove('hidden');
        this.elements.versesContainer.classList.add('hidden');

        this.elements.primaryVerses.innerHTML = '';
        this.elements.secondaryVerses.innerHTML = '';

        const exactCount = results.results.filter(r => r.matchType === 'exact').length;
        const fuzzyCount = results.results.filter(r => r.matchType === 'fuzzy').length;

        this.elements.searchResultsTitle.textContent =
            `Found ${results.total} results for "${results.query}"` +
            (exactCount > 0 ? ` (${exactCount} exact, ${fuzzyCount} fuzzy)` : '');

        this.elements.searchResultsList.innerHTML = results.results.map(r => `
            <div class="search-result" data-verse='${JSON.stringify(r).replace(/'/g, "&#39;")}'>
                <div class="search-result-ref">${r.reference}</div>
                <div class="search-result-text">${this.search.highlightMatch(r.text, results.query)}</div>
            </div>
        `).join('');

        // Show/hide load more button
        this.elements.loadMoreResults.classList.toggle('hidden', !results.hasMore);

        // Bind click events
        this.elements.searchResultsList.querySelectorAll('.search-result').forEach(item => {
            item.addEventListener('click', () => {
                const verse = JSON.parse(item.dataset.verse);
                // Navigate to the verse
                const book = this.bibleManager.findBook(verse.bookName);
                if (book) {
                    this.currentBook = book;
                    this.showChapter(book, verse.chapter);

                    // Scroll to and highlight the verse
                    setTimeout(() => {
                        const verseEl = document.querySelector(`.verse-item[data-reference="${verse.reference}"]`);
                        if (verseEl) {
                            verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            verseEl.classList.add('copy-flash');
                        }
                    }, 100);
                }
            });
        });
    }

    /**
     * Load more search results
     */
    loadMoreSearchResults() {
        const results = this.search.getNextPage();

        // Append to existing results
        const newHtml = results.results.map(r => `
            <div class="search-result" data-verse='${JSON.stringify(r).replace(/'/g, "&#39;")}'>
                <div class="search-result-ref">${r.reference}</div>
                <div class="search-result-text">${this.search.highlightMatch(r.text, results.query)}</div>
            </div>
        `).join('');

        this.elements.searchResultsList.insertAdjacentHTML('beforeend', newHtml);

        // Show/hide load more button
        this.elements.loadMoreResults.classList.toggle('hidden', !results.hasMore);

        // Bind click events for new items
        const newItems = this.elements.searchResultsList.querySelectorAll('.search-result:not([data-bound])');
        newItems.forEach(item => {
            item.dataset.bound = 'true';
            item.addEventListener('click', () => {
                const verse = JSON.parse(item.dataset.verse);
                const book = this.bibleManager.findBook(verse.bookName);
                if (book) {
                    this.showChapter(book, verse.chapter);
                }
            });
        });
    }

    /**
     * Close search results
     */
    closeSearchResults() {
        this.elements.searchResults.classList.add('hidden');
        this.elements.searchInput.value = '';

        if (this.currentBook && this.currentChapter) {
            this.showChapter(this.currentBook, this.currentChapter);
        } else if (this.currentBook) {
            this.showChapterSelector(this.currentBook);
        } else {
            this.elements.welcomeMessage.classList.remove('hidden');
        }
    }

    /**
     * Show a random verse
     */
    showRandomVerse() {
        const verse = this.bibleManager.getRandomVerse();
        if (!verse) return;

        // Navigate to the verse's chapter
        const book = this.bibleManager.findBook(verse.bookName);
        if (book) {
            this.currentBook = book;
            this.showChapter(book, verse.chapter);

            // Scroll to and highlight the verse
            setTimeout(() => {
                const verseEl = document.querySelector(`.verse-item[data-reference="${verse.reference}"]`);
                if (verseEl) {
                    verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    verseEl.classList.add('selected');
                    this.selectedVerses.set(verse.reference, verse);
                }
            }, 100);
        }
    }

    /**
     * Toggle dark/light theme
     */
    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('funbible-theme', isDark ? 'dark' : 'light');
    }

    /**
     * Apply saved theme or system preference
     */
    applyTheme() {
        const saved = localStorage.getItem('funbible-theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (saved === 'dark' || (!saved && systemDark)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Listen for system changes if no manual override
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('funbible-theme')) {
                if (e.matches) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        });
    }

    /**
     * Apply reading settings
     */
    applyReadingSettings() {
        const root = document.documentElement;
        root.style.setProperty('--verse-font-size', `${this.fontSize}px`);
        root.style.setProperty('--verse-line-height', String(this.lineHeight));

        const fontFamilyValue = this.fontFamily === 'serif'
            ? "'Merriweather', Georgia, serif"
            : "'Inter', system-ui, sans-serif";
        root.style.setProperty('--verse-font-family', fontFamilyValue);

        // Update UI elements
        if (this.elements.fontSizeSlider) {
            this.elements.fontSizeSlider.value = this.fontSize;
            this.elements.fontSizeValue.textContent = `${this.fontSize}px`;
        }

        if (this.elements.lineHeightSlider) {
            this.elements.lineHeightSlider.value = this.lineHeight;
            this.elements.lineHeightValue.textContent = this.lineHeight.toFixed(1);
        }

        if (this.elements.fontSerifBtn && this.elements.fontSansBtn) {
            this.elements.fontSerifBtn.classList.toggle('bg-primary-500/20', this.fontFamily === 'serif');
            this.elements.fontSerifBtn.classList.toggle('border-primary-500/50', this.fontFamily === 'serif');
            this.elements.fontSansBtn.classList.toggle('bg-primary-500/20', this.fontFamily === 'sans');
            this.elements.fontSansBtn.classList.toggle('border-primary-500/50', this.fontFamily === 'sans');
        }
    }

    /**
     * Toggle sidebar (mobile)
     */
    toggleSidebar() {
        const isOpen = this.elements.sidebar.classList.toggle('mobile-open');

        // Create/toggle overlay
        let overlay = document.getElementById('sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => this.closeSidebar());
        }
        overlay.classList.toggle('show', isOpen);
    }

    /**
     * Close sidebar
     */
    closeSidebar() {
        this.elements.sidebar.classList.remove('mobile-open');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.remove('show');
    }

    /**
     * Open settings modal
     */
    openSettings() {
        this.populateVersionList();
        this.elements.settingsModal.classList.remove('hidden');
        setTimeout(() => {
            this.elements.settingsModal.classList.remove('opacity-0');
            this.elements.settingsModal.querySelector('div:last-child').classList.remove('scale-95');
        }, 10);
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        this.elements.settingsModal.classList.add('opacity-0');
        this.elements.settingsModal.querySelector('div:last-child').classList.add('scale-95');
        setTimeout(() => {
            this.elements.settingsModal.classList.add('hidden');
        }, 300);
    }

    /**
     * Toggle split view mode
     */
    toggleSplitView() {
        this.isSplitView = !this.isSplitView;
        this.elements.splitViewToggle.classList.toggle('active', this.isSplitView);
        this.elements.splitViewSelectContainer.classList.toggle('hidden', !this.isSplitView);
        this.elements.secondaryVerses.classList.toggle('hidden', !this.isSplitView);
        this.elements.versesLayout.classList.toggle('grid-cols-2', this.isSplitView);

        if (this.isSplitView) {
            this.populateSplitVersionSelect();
            // Auto-select a version if none selected
            if (!this.secondaryVersion) {
                const versions = this.bibleManager.getVersionList().filter(v => v.cached || v.bundled);
                const other = versions.find(v => v.id !== this.bibleManager.currentVersion);
                if (other) {
                    this.secondaryVersion = other.id;
                    this.elements.splitVersionSelect.value = other.id;
                }
            }
        }

        if (this.currentBook && this.currentChapter) {
            this.showChapter(this.currentBook, this.currentChapter);
        }
    }

    /**
     * Populate split version select
     */
    populateSplitVersionSelect() {
        const versions = this.bibleManager.getVersionList();
        const set = this.translations[this.language];
        this.elements.splitVersionSelect.innerHTML = `<option value="">${set.none}</option>` +
            versions
                .filter(v => v.cached || v.bundled)
                .map(v => `<option value="${v.id}" ${v.id === this.secondaryVersion ? 'selected' : ''}>
                ${v.name}
            </option>`)
                .join('');
    }

    /**
     * Toggle between languages
     */
    toggleLanguage() {
        this.language = this.language === 'en' ? 'bg' : 'en';
        localStorage.setItem('funbible-lang', this.language);
        this.updateUI();
        this.populateBookList(); // Refresh book names if they change, though they usually come from bible data
        this.populateVersionSelects();
        if (this.isSplitView) this.populateSplitVersionSelect();
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="ml-2 hover:text-white" onclick="this.parentElement.remove()">✕</button>
        `;

        this.elements.toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new FunBibleApp();
    app.init();

    // Expose for debugging
    window.funbible = app;
});

export { FunBibleApp };
