const fs = require('fs');
const csv = require('csv-parser');
const basicAuth = require('basic-auth');
const log = require('../../log/log');
const authenticationBlock = (req, res, next) => {
    const details = basicAuth(req);
  
    if (!details || !details.name || !details.pass) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      log.logForAssignment.log("error","Basic auth is required");
      return res.status(401).send('Basic auth is required');
    }
  
    const rows = [];
  
    fs.createReadStream('users.csv')
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        const user = rows.find(u => u.email === details.name && u.password === details.pass);
        
  
        if (user) {
          req.user = user;
          return next();
        } else {
          log.logForAssignment.log("error","Unauthorized or bad username and password");
          return res.status(401).send('Unauthorized or bad username and password');
        }
      })
      .on('error', (error) => {
        return res.status(500).send(`Internal Server Error: ${error.message}`);
      });
  };

module.exports = authenticationBlock;