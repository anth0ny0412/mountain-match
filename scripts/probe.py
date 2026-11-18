"""오퍼레이션 이름 후보를 호출해 응답 상태만 확인 (키는 출력하지 않음)."""
import sys, requests
sys.path.insert(0, "scripts")
from keys import load_keys, mask

K = load_keys()
BASE = "https://apis.data.go.kr/1400000/"

def call(path, **params):
    p = {"serviceKey": K["DATA_GO_KR_KEY"], "pageNo": 1, "numOfRows": 3, **params}
    r = requests.get(BASE + path, params=p, timeout=30)
    r.encoding = "utf-8"
    return r.status_code, mask(r.text, K)

if __name__ == "__main__":
    for path in sys.argv[1:]:
        try:
            s, t = call(path)
            print(f"--- {path} [{s}] {len(t)}B\n{t[:700]}\n")
        except Exception as e:
            print(path, "ERR", mask(str(e), K))
