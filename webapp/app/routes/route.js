
const controller = require('../controller/controller.js');

const routerRoute = require('express').Router();

// router.get('/',controller.getData);

// router.all('*', (req, res) => {  //incase of any other routes throw a 405 response.
//     res.status(405).send();
// })

routerRoute.get('/', (req, res) => {
    if ((Object.keys(req.query).length>0)|| (req.headers['content-length'] && parseInt(req.headers['content-length']) > 0)) {  //checks if the body is empty or not
        const requestBody = req.body.toString();
        if (requestBody.trim() !== '') {
            res.status(400).send();
            return;
        }
    }
    controller.getData(req, res);
});

routerRoute.all('/', (req, res) => {
    res.status(405).send();
})

module.exports= routerRoute;