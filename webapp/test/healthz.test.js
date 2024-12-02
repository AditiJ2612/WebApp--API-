const chai = require('chai');
const chaiHttp = require('chai-http');

const app = require('../app');

chai.use(chaiHttp);
const expect = chai.expect;

describe("Healthz Endpoint ", ()=>{
    it('should return a 200 status', async ()=>{
        const response = await chai.request(app).get('/healthz');
        expect(response.status).to.equal(200);
    });
});