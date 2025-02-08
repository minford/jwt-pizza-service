const request = require('supertest');
const app = require('../service');
const franchiseRouter = require('./franchiseRouter.test.js');

let admin;
let adminAuthToken;
let costumerAuthToken;
let testFranchise;
let testStore;

beforeAll(async () => {
    [, costumerAuthToken] = await createNewUser();
    [admin, adminAuthToken] = await createAdminUser();
    testFranchise = await franchiseRouter.createFranchise(admin, adminAuthToken);
    testStore = await franchiseRouter.createStore(testFranchise.id, adminAuthToken);
});

test('add menu item', async () => {
    const menuItem = { title: randomName(), description: 'new menu item', image: 'pizzaSlice', price: 10.00 };
    const addMenuItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(menuItem);
    expect(addMenuItemRes.status).toBe(200);

    const menu = await getMenu();
    const newMenuItem = menu.find((item) => item.title === menuItem.title);
    expect(newMenuItem).toMatchObject(menuItem);
});

// test('unauthorized', async () => {
//     const menuItem = { title: randomName(), description: 'new menu item', image: 'pizzaSlice', price: 10.00 };
//     const addMenuItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer  ${costumerAuthToken}`).send(menuItem);
//     expect(addMenuItemRes.status).toBe(403);
// });

test('get orders', async () => {
    const getOrdersRes = await request(app).get('/api/order/').set('Authorization', `Bearer ${costumerAuthToken}`);
    expect(getOrdersRes.status).toBe(200);
});

test('create order', async () => {
  const menu = await getMenu();
  const orderItem = menu[0];
  const order = { franchiseId: testFranchise.id, storeId: testStore.id, items: [{ menuId: orderItem.id, ...orderItem }] };
  const createOrdersRes = await request(app).post('/api/order/').set('Authorization', `Bearer ${costumerAuthToken}`).send(order);
  expect(createOrdersRes.status).toBe(200);
  expect(createOrdersRes.body.order).toMatchObject(order);
});

async function getMenu() {
    const getMenuRes = await request(app).get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);
    return getMenuRes.body;
}

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