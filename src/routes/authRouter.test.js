const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
});

test('login', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);

    const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
    delete expectedUser.password;
    expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
    const registerRes = await request(app).post('/api/auth').send(testUser);
    const authToken = registerRes.body.token;

    const logoutRes = await request(app).delete('/api/auth/').set('Authorization', `Bearer ${authToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toMatchObject({ message: 'logout successful' });
});

test('register', async () => {
    const registerRes = await request(app).post('/api/auth').send({ name: 'newUser', email: 'new@email.com', password: 'p' });
    expect(registerRes.status).toBe(200);

    expect(registerRes.body.user).toMatchObject({ email: 'new@email.com', name: 'newUser', roles: [{ role: 'diner' }] });
});

test('no authToken', async () => {
    const getOrdersRes = await request(app).get('/api/order/');
    expect(getOrdersRes.status).toBe(401);
});

test('update user', async () => {
    let [newUser, newUserAuthToken] = await createNewUser();

    const body = { email: newUser.email, password: 'anotherPass' };

    const updateRes = await request(app).put(`/api/auth/${newUser.id}`).set('Authorization', `Bearer ${newUserAuthToken}`).send(body);
    expect(updateRes.status).toBe(200);
    const loginRes = await request(app).put('/api/auth').send(body);
    expect(loginRes.status).toBe(200);
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

//   const { Role, DB } = require('../database/database.js');

//   async function createAdminUser() {
//     let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
//     user.name = randomName();
//     user.email = user.name + '@admin.com';

//     user = await DB.addUser(user);
//     return { ...user, password: 'toomanysecrets' };
//   }

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