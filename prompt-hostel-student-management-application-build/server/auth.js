const unauthorized = res => res.status(401).json({ error: 'Authentication required' });

export function createOwnerAuth({ authClient, ownerUserId } = {}) {
  return async function ownerAuth(req, res, next) {
    const header = req.get('authorization');
    const match = typeof header === 'string' && header.match(/^Bearer ([^\s]+)$/);

    if (!match) return unauthorized(res);
    if (!authClient || !ownerUserId) return unauthorized(res);

    try {
      const { data, error } = await authClient.getUser(match[1]);
      if (error || !data?.user?.id) return unauthorized(res);
      if (data.user.id !== ownerUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      req.authUser = { id: data.user.id };
      next();
    } catch {
      return unauthorized(res);
    }
  };
}

export function ownerSession(_, res) {
  return res.json({ authenticated: true });
}
