"""`.env`에서 인증키를 읽는다. 키 값은 절대 출력하지 않는다."""
from pathlib import Path

ENV = Path(__file__).resolve().parents[1] / ".env"


def load_keys() -> dict:
    keys = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            keys[k.strip()] = v.strip().strip('"').strip("'")
    # 공공데이터포털 '인코딩' 키를 넣어도 동작하도록 디코딩 (requests가 다시 인코딩함)
    if keys.get("DATA_GO_KR_KEY"):
        from urllib.parse import unquote
        keys["DATA_GO_KR_KEY"] = unquote(keys["DATA_GO_KR_KEY"])
    return keys


def mask(text: str, keys: dict) -> str:
    """오류 메시지 등에 키가 섞여 있으면 가린다."""
    from urllib.parse import quote, quote_plus
    for v in keys.values():
        if v:
            # 원문 + URL 인코딩된 형태(요청 URL이 오류 메시지에 찍히는 경우)까지 가린다
            for form in {v, quote(v, safe=""), quote_plus(v), quote(v)}:
                text = text.replace(form, "***")
    # 혹시 남은 serviceKey 파라미터 값도 제거
    import re
    return re.sub(r"(?i)(servicekey=)[^&\s'\"]+", r"\1***", text)


if __name__ == "__main__":
    for k, v in load_keys().items():
        print(f"{k}: {'있음 (' + str(len(v)) + '자)' if v else '비어 있음'}")
