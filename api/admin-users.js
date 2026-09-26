async function requireAdmin(request) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!url || !serviceKey || !token) return null;
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const profileResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  const profiles = await profileResponse.json();
  return profiles?.[0]?.role === 'admin' ? { url, serviceKey } : null;
}

module.exports = async (request, response) => {
  const context = await requireAdmin(request);
  if (!context) return response.status(401).json({ error: 'Acesso administrativo necessário.' });
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  const { email, password, fullName } = request.body || {};
  if (!email || !password || password.length < 8 || !fullName) return response.status(400).json({ error: 'Informe nome, e-mail e uma senha com ao menos 8 caracteres.' });
  const authResponse = await fetch(`${context.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: context.serviceKey, Authorization: `Bearer ${context.serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  const authData = await authResponse.json();
  if (!authResponse.ok) return response.status(400).json({ error: authData.message || 'Não foi possível criar a usuária.' });
  const profileResponse = await fetch(`${context.url}/rest/v1/profiles`, {
    method: 'POST',
    headers: { apikey: context.serviceKey, Authorization: `Bearer ${context.serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: authData.id, full_name: fullName, role: 'admin' })
  });
  if (!profileResponse.ok) return response.status(502).json({ error: 'Usuária criada, mas o perfil administrativo falhou.' });
  return response.status(201).json({ id: authData.id, email, fullName });
};