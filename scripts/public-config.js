export function publicConfig(input = {}) {
  const supabaseUrl = String(input.supabaseUrl || '').replace(/\/$/, '');
  const supabaseAnonKey = String(input.supabaseAnonKey || '');
  if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) throw new Error('Supabase URL과 공개 키는 함께 설정하세요. 사용하지 않으면 둘 다 비워 두세요.');
  if (supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) throw new Error('Supabase URL 형식을 확인하세요.');
  if (supabaseAnonKey.startsWith('sb_secret_')) throw new Error('비공개 Supabase 키는 배포할 수 없습니다. anon/publishable 키를 사용하세요.');
  if (supabaseAnonKey.split('.').length === 3) {
    let payload;
    try { payload = JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64url').toString()); } catch { throw new Error('Supabase 공개 키 형식을 확인하세요.'); }
    if (payload.role !== 'anon') throw new Error('anon 역할이 아닌 Supabase 키는 배포할 수 없습니다.');
  }
  return { supabaseUrl, supabaseAnonKey };
}
