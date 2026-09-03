import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createOwnerAuth, ownerSession } from './auth.js';

const owner = 'owner-uuid';
const call = async (config = {}, authorization) => {
  const app = express();
  app.get('/api/private', createOwnerAuth({ authClient: config.getUser && { getUser: config.getUser }, ownerUserId: config.ownerUserId === undefined ? owner : config.ownerUserId }), (_, res) => res.json({ allowed: true }));
  const server = app.listen(0);
  try {
    const headers = authorization ? { Authorization: authorization } : {};
    return await fetch(`http://127.0.0.1:${server.address().port}/api/private`, { headers });
  } finally { server.close(); }
};

const callSession = async (config = {}, authorization) => {
  const app = express();
  app.use('/api', createOwnerAuth({ authClient: config.getUser && { getUser: config.getUser }, ownerUserId: config.ownerUserId === undefined ? owner : config.ownerUserId }));
  app.get('/api/auth/session', ownerSession);
  const server = app.listen(0);
  try {
    const headers = authorization ? { Authorization: authorization } : {};
    return await fetch(`http://127.0.0.1:${server.address().port}/api/auth/session`, { headers });
  } finally { server.close(); }
};

test('a sensitive route rejects a missing Authorization header', async () => {
  const response = await call({ getUser: async () => ({}) });
  assert.equal(response.status, 401);
});

test('a malformed Bearer header returns 401', async () => {
  const response = await call({ getUser: async () => ({}) }, 'Basic abc');
  assert.equal(response.status, 401);
});

test('an invalid or expired token returns 401', async () => {
  const response = await call({ getUser: async () => ({ data: { user: null }, error: new Error('invalid') }) }, 'Bearer expired');
  assert.equal(response.status, 401);
});

test('a valid non-owner returns 403', async () => {
  const response = await call({ getUser: async () => ({ data: { user: { id: 'someone-else' } }, error: null }) }, 'Bearer valid');
  assert.equal(response.status, 403);
});

test('the configured owner is allowed', async () => {
  const response = await call({ getUser: async token => ({ data: { user: { id: token === 'valid' ? owner : '' } }, error: null }) }, 'Bearer valid');
  assert.equal(response.status, 200);
});

test('missing authentication configuration fails closed', async () => {
  const response = await call({ getUser: null, ownerUserId: '' }, 'Bearer valid');
  assert.equal(response.status, 401);
});

test('owner session endpoint rejects missing authentication', async () => {
  assert.equal((await callSession({ getUser: async () => ({}) })).status, 401);
});

test('owner session endpoint rejects a valid non-owner', async () => {
  const response = await callSession({ getUser: async () => ({ data: { user: { id: 'not-owner' } }, error: null }) }, 'Bearer valid');
  assert.equal(response.status, 403);
});

test('owner session endpoint returns only the minimal response for the owner', async () => {
  const response = await callSession({ getUser: async () => ({ data: { user: { id: owner, email: 'owner@example.invalid' } }, error: null }) }, 'Bearer secret-token');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true });
});

test('owner session endpoint fails closed when configuration is missing', async () => {
  assert.equal((await callSession({ getUser: null, ownerUserId: '' }, 'Bearer valid')).status, 401);
});
