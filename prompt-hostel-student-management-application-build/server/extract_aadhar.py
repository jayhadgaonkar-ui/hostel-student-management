"""Extract structured fields from a text-based Indian Aadhar PDF."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip(" :-,|")


def extract_name(lines, text):
    patterns = [
        r"(?:Name|नाम)\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})",
        r"(?:To|Resident)\s*[:\-]?\s*\n\s*([A-Za-z][A-Za-z .'-]{2,60})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return clean(match.group(1))

    dob_match = re.search(r"(?:DOB|Date of Birth|Year of Birth)", text, re.I)
    if dob_match:
        prefix = text[:dob_match.start()]
        prefix = re.sub(r"Government\s+of\s+India|Government\s+India|भारत सरकार", " ", prefix, flags=re.I)
        candidates = re.findall(r"[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,4}", prefix)
        if candidates:
            return clean(candidates[-1])

    blocked = re.compile(r"government|india|भारत|dob|birth|male|female|address|aadhaar|aadhar|vid|download|issue", re.I)
    for index, line in enumerate(lines):
        if re.search(r"(?:DOB|Date of Birth|Year of Birth)", line, re.I):
            for candidate in reversed(lines[max(0, index - 3):index]):
                if re.fullmatch(r"[A-Za-z][A-Za-z .'-]{2,60}", candidate) and not blocked.search(candidate):
                    return clean(candidate)
    return ""


def extract_address(lines, text):
    start = next((i for i, line in enumerate(lines) if re.match(r"^(?:Address|पता)\s*[:\-]?", line, re.I)), None)
    if start is None:
        match = re.search(r"Address\s*[:\-]\s*(.+?)(?=\s+(?:\d{4}\s*\d{4}\s*\d{4}|Aadhaar|VID|1947|www\.uidai))", text, re.I | re.S)
        return clean(match.group(1).replace("\n", ", ")) if match else ""

    parts = []
    first = re.sub(r"^(?:Address|पता)\s*[:\-]?\s*", "", lines[start], flags=re.I)
    if clean(first):
        parts.append(clean(first))
    stop = re.compile(r"(?:\d{4}\s*\d{4}\s*\d{4}|Aadhaar|VID\s*:|help@uidai|www\.uidai|1947)", re.I)
    for line in lines[start + 1:start + 10]:
        if stop.search(line):
            break
        if line:
            parts.append(clean(line))
        if re.search(r"\b\d{6}\b", line):
            break
    return clean(", ".join(parts))


def parse_text(text):
    if not clean(text):
        raise ValueError("No readable Aadhar text was found. Please use a clearer document or enter the details manually.")
    lines = [clean(line) for line in text.splitlines() if clean(line)]
    number_match = re.search(r"(?<!\d)(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})(?!\d)", text)
    result = {
        "full_name": extract_name(lines, text),
        "aadhar_number": "".join(number_match.groups()) if number_match else "",
        "address": extract_address(lines, text),
    }
    result["found"] = [key for key, value in result.items() if key != "found" and value]
    print(json.dumps(result, ensure_ascii=False))


def main(path):
    if Path(path).suffix.lower() == ".txt":
        parse_text(Path(path).read_text(encoding="utf-8-sig"))
        return
    reader = PdfReader(path)
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ValueError("The PDF is password-protected. Please unlock it before uploading.") from exc
    parse_text("\n".join(page.extract_text() or "" for page in reader.pages))


if __name__ == "__main__":
    try:
        main(sys.argv[1])
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)
