import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase_uploader import SupabaseREST

url = os.environ.get('SUPABASE_URL', '')
key = os.environ.get('SUPABASE_SERVICE_KEY', '')
if not url or not key:
    print('ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 없습니다.')
    sys.exit(1)

client = SupabaseREST(url, key)
try:
    rows = client.select('diet_settings', 'key,value')
    print('diet_settings 행 수:', len(rows))
    for r in rows:
        v = str(r.get('value') or '')
        print('  ' + str(r['key']) + ': ' + v[:60])
except Exception as e:
    print('ERROR:', e)
