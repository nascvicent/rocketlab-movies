import unicodedata


def fold_text(value: str | None) -> str | None:
    """Normaliza texto para busca: minúsculas e sem acentos ("Amélie" -> "amelie")."""

    if value is None:
        return None
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))
