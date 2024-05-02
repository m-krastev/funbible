"""Lookup bible verses from the command line"""

import argparse
import cmd
import json
import os.path

import pyperclip

from .finders.local import find_verses_local, match_verse


class Shell(cmd.Cmd):
    prompt = "> "

    def __init__(
        self,
        lookup_func: dict[str, str],
        do_copy: bool,
        bible: dict[tuple, str],
        book_lookup: dict[str, str],
    ):
        super().__init__()
        self.intro = "Welcome to the bible verses shell"
        self.lookup_func = lookup_func
        self.copy = do_copy
        self.bible = bible
        self.book_lookup = book_lookup

    def do_exit(self, arg):
        return True
    
    def do_EOF(self, arg):
        return True

    def do_find(self, arg):
        """Find a verse based on text"""
        matches = match_verse(arg.strip(), self.bible, limit=30)
        for match in matches:
            print(
                "({} {}:{}) {}".format(
                    self.book_lookup[match[-1][0]], match[-1][1], match[-1][2], match[0]
                )
            )

    def default(self, arg):
        """Find a verse based on reference"""
        res = self.lookup_func(arg.strip())
        print(res)
        if self.copy:
            pyperclip.copy(res)

    def emptyline(self):
        pass


def main():
    parser = argparse.ArgumentParser(description="Get bible verses")
    parser.add_argument(
        "--revised", action="store_true", help="If you want to get the revised version"
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="If you want to copy the result to the clipboard",
    )
    args = parser.parse_args()

    version = "biblia-revizirano" if args.revised else "biblia-1940"
    curdir = os.path.dirname(__file__) + "/.."

    with open(f"{curdir}/resources/{version}.json", encoding="utf8") as f:
        bible = json.load(f)
    with open(f"{curdir}/resources/{version}.lookup.json", encoding="utf8") as f:
        books_lookup = json.load(f)

    # flatten the bible
    bible = {
        (book, chapter, verse): text
        for book, chapters in bible.items()
        for chapter, verses in chapters.items()
        for verse, text in verses.items()
    }

    lookup = lambda x: find_verses_local(x, bible, books_lookup)

    shell = Shell(lookup, args.copy, bible, book_lookup=books_lookup)
    try:
        shell.cmdloop()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
