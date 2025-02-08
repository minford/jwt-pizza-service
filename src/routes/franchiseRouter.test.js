
const request = require('supertest');
const app = require('../service');

let admin;
let adminAuthToken;
let franchisee;
let franchiseeAuthToken;
let testFranchise;

beforeAll(async () => {
  [admin, adminAuthToken] = await createAdminUser();
  [franchisee, franchiseeAuthToken] = await createNewUser();
  testFranchise = await createFranchise(franchisee, adminAuthToken);
});

test('get franchise', async () => {
  const getFranchiseRes = await request(app).get('/api/franchise');
  expect(getFranchiseRes.status).toBe(200);
  // expect(getFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');

  const franchise = getFranchiseRes.body.find((item) => item.id === testFranchise.id);
  expect(franchise).toMatchObject(franchise);

  expect(getFranchiseRes.body.length).not.toBe(0);
  expect(franchise).toMatchObject(franchise);
});

test('get user franchises', async () => {
  const franchises = await getUserFranchises(franchisee, franchiseeAuthToken);
  expect(franchises.length).toBe(1);
  expect(franchises[0]).toMatchObject(testFranchise);
});

test('create franchise', async () => {
  const franchise = await createFranchise(admin, adminAuthToken);
  expect(franchise.admins[0].id).toBe(admin.id);
});

test('delete franchise', async () => {
  const franchise = await createFranchise(admin, adminAuthToken);
  const { status, body: deleteFranchiseRes } = await request(app).delete(`/api/franchise/${franchise.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
  expect(status).toBe(200);
  expect(deleteFranchiseRes.message).toMatch('franchise deleted');
});

test('create store', async () => {
  const store = await createStore(testFranchise.id, adminAuthToken);
  expect(store).toMatchObject(store);
});

test('delete store', async () => {
  const store = await createStore(testFranchise.id, adminAuthToken);
  const { status, body: deleteStoreRes } = await request(app).delete(`/api/franchise/${testFranchise.id}/store/${store.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
  expect(status).toBe(200);
  expect(deleteStoreRes.message).toMatch('store deleted');
});

async function getFranchise(franchiseId, user, authToken) {
  const franchises = await getUserFranchises(user, authToken);
  if (franchises) {
    return franchises.find((f) => f.id === franchiseId);
  }
  return undefined;
}

async function getUserFranchises(user, authToken) {
  const getUserFranchisesRes = await request(app).get(`/api/franchise/${user.id}`).set('Authorization', `Bearer ${authToken}`);
  expect(getUserFranchisesRes.status).toBe(200);
  return getUserFranchisesRes.body;
}

async function createFranchise(user, authToken) {
  const franchise = { name: randomName(), admins: [{ email: user.email }] };
  const getFranchiseRes = await request(app).post(`/api/franchise`).set('Authorization', `Bearer ${authToken}`).send(franchise);
  expect(getFranchiseRes.status).toBe(200);
  return getFranchiseRes.body;
}

async function createStore(franchiseId, authToken) {
  const store = { name: randomName(), franchiseId: franchiseId };
  const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${authToken}`).send(store);
  expect(createStoreRes.status).toBe(200);
  return createStoreRes.body;
}

async function getStore(franchiseId, storeId, user, authToken) {
  const franchise = await getFranchise(franchiseId, user, authToken);
  if (franchise) {
    const matchingStore = franchise.stores.find((s) => s.id === storeId);
    return matchingStore;
  }
  return undefined;
}

module.exports = { getFranchise, getStore, createFranchise, createStore, getUserFranchises };

 
const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';

    const newUser = await DB.addUser(user);
    user = { ...user, id: newUser.id, password: 'toomanysecrets' };

    const registerRes = await request(app).put('/api/auth').send(user);
    return [user, registerRes.body.token];
}

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

async function createNewUser() {
    let user = { password: 'password' };
    user.name = randomName();
    user.email = user.name + '@newEmail.com';
    const registerRes = await request(app).post('/api/auth').send(user);
    user = { ...registerRes.body.user, password: 'password' };

    return [user, registerRes.body.token];
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}