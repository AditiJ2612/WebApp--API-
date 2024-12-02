const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routerIndex = require('./app/routes/index');
const authenticationBlock = require('./app/authorization/authorization');
const getcount = require('./stats/stats');
const log = require('./log/log');
const app = express();

var portNumber = {
  origin: 'http://localhost:5000'
}

const handlePatchMethodNotAllowed = (req, res, next) => {
  if (req.method === 'PATCH') {
    log.logForAssignment.log("error","PATCH method not allowed for updating assignments");
    return res.status(405).json({ error: 'PATCH method not allowed for updating assignments' });
  }
  next();
};

const healthcare = (req, res, next) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    res.sendStatus(200);
  } else {
    next();
  }
};

const assignments = (req, res, next) => {
  if (req.url === '/') {
      return res.redirect('http://aditij.me.demo.aditij.me:8080/v1/assignments');
  }
  next();
}

//middleware

app.use(cors(portNumber));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) =>{
    // console.log("cache-control");
    res.setHeader('Cache-Control', 'no-cache');
    next();
});

app.use(handlePatchMethodNotAllowed);
app.use(healthcare);
app.use(assignments);
app.use(getcount());
app.use('/v1/assignments',authenticationBlock);


routerIndex(app);


module.exports = app;