"""Search normalization for Arabic and English names (DESIGN.md 7.3).

MySQL's utf8mb4_0900_ai_ci ignores diacritics but does not fold Arabic letter
variants, so search compares normalized strings in Python instead.
"""

import re
import unicodedata

# Harakat, tanween, shadda, sukun, superscript alef, Quranic marks, tatweel.
_DIACRITICS = re.compile(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]")
_LETTERS = str.maketrans(
    {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ٱ": "ا",  # alef forms -> bare alef
        "ة": "ه",  # teh marbuta -> heh
        "ى": "ي",  # alef maksura -> yeh
    }
)


def normalize(text: str) -> str:
    """Lower-case, strip diacritics, fold letter variants and collapse spaces."""
    text = unicodedata.normalize("NFKC", text)
    text = _DIACRITICS.sub("", text).translate(_LETTERS).casefold()
    return " ".join(text.split())


def matches(query: str, *fields: str) -> bool:
    needle = normalize(query)
    return not needle or any(needle in normalize(field) for field in fields if field)
