"""Generate golden vectors for the TS port of x_client_transaction.

Zero-dependency: loads ONLY the x_client_transaction subpackage from the
reference fork (bypassing twikit/__init__.py which needs httpx/filetype/pyotp),
and stubs `bs4` (used only for type annotations on this pure-math path).
Run:  python3 tests/services/x-media/gen_golden.py
Out:  tests/services/x-media/golden.json
"""
import base64, importlib.util, json, random, re, sys, types
from pathlib import Path

REF = Path(__file__).resolve().parents[3] / 'reference' / 'twikit' / 'twikit' / 'x_client_transaction'
OUT = Path(__file__).resolve().parent / 'golden.json'

fake_bs4 = types.ModuleType('bs4')
class _Stub: pass
fake_bs4.BeautifulSoup = _Stub
fake_bs4.ResultSet = _Stub
sys.modules['bs4'] = fake_bs4

pkg = types.ModuleType('twikit'); pkg.__path__ = []
sys.modules['twikit'] = pkg
sub = types.ModuleType('twikit.x_client_transaction'); sub.__path__ = [str(REF)]
sys.modules['twikit.x_client_transaction'] = sub

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

for m in ['cubic_curve', 'interpolate', 'rotation', 'utils']:
    load(f'twikit.x_client_transaction.{m}', REF / f'{m}.py')
txn = load('twikit.x_client_transaction.transaction', REF / 'transaction.py')
ClientTransaction = txn.ClientTransaction

# 16 identical rows so row_index = kb[i] % 16 (<16) never lands on the empty first row
ROW = [20, 30, 40, 50, 60, 70, 10, 90, 160, 5, 200, 120]
D = 'M 0 0 128' + ''.join(' C ' + ' '.join(map(str, ROW)) for _ in range(16))

def parse_arr(d):
    return [[int(x) for x in re.sub(r'[^\d]+', ' ', seg).strip().split()] for seg in d[9:].split('C')]

ARR = parse_arr(D)
assert len(ARR) == 17 and len(ARR[2]) == 12

ct = ClientTransaction()

vectors = []
cases = [
    (list(range(32)), 2, [12, 14, 7],
     [('GET', '/i/api/graphql/vFPc2LVIu7so2uA_gHQAdg/UserMedia', 1700000000),
      ('POST', '/i/api/graphql/SiM_cAu83R0wnrpmKQQSEw/CreateTweet', 1234567890)]),
    (list(random.Random(7).randbytes(32)), 5, [12, 14, 7],
     [('GET', '/i/api/graphql/vFPc2LVIu7so2uA_gHQAdg/UserMedia', 999999999)]),
]
for key_bytes, ri, indices, calls in cases:
    key = base64.b64encode(bytes(key_bytes)).decode()
    frame_row = ARR[key_bytes[ri] % 16]
    frame_time = 1
    for i in indices:
        frame_time *= key_bytes[i] % 16
    target_time = frame_time / 4096
    animation_key = ct.animate(frame_row, target_time)
    entries = []
    for n, (method, path, time_now) in enumerate(calls):
        seed = 42 + n
        random.seed(seed)
        rn = random.randint(0, 255)
        random.seed(seed)
        tid = ct.generate_transaction_id(method=method, path=path, key=key, animation_key=animation_key, time_now=time_now)
        entries.append({'method': method, 'path': path, 'timeNow': time_now, 'randomNum': rn, 'transactionId': tid})
    vectors.append({'key': key, 'keyBytes': key_bytes, 'rowIndex': ri, 'keyByteIndices': indices,
                    'd': D, 'frameRow': frame_row, 'targetTime': target_time,
                    'animationKey': animation_key, 'calls': entries})

cubic = []
for curves in [[0.04, -0.29, 0.63, -0.96], [0.78, -0.06, 0.2, 0.9]]:
    c = txn.Cubic(curves)
    for t in [0.0, 1176 / 4096, 0.5, 1.0]:
        cubic.append({'curves': curves, 'time': t, 'value': c.get_value(t)})

OUT.write_text(json.dumps({'vectors': vectors, 'cubic': cubic}, indent=1), encoding='utf-8')
print(f'wrote {OUT} with {len(vectors)} tid vectors, {len(cubic)} cubic vectors')

# Optional cross-verification against installed twitscraper (user-verified working).
try:
    from twitscraper.x_client_transaction.transaction import ClientTransaction as TSCT
    ct2 = TSCT()
    for v in vectors:
        assert ct2.animate(v['frameRow'], v['targetTime']) == v['animationKey'], 'twitscraper cross-check FAILED'
    print('cross-verified against installed twitscraper: OK')
except ImportError:
    print('twitscraper not importable; cross-verification skipped')
