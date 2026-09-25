module.exports = (request, response) => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response.status(503).json({ error: 'Supabase is not configured.' });
  }

  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return response.status(200).json({ url, anonKey });
};