const assignment = require('./assignment');
const route = require('./route');
const submission = require('./submission');
const getcount = require('../../stats/stats');

//checks the url's extension for the request
module.exports = (index)=>{
    // index.use(getcount());
    index.use("/healthz",route);
    index.use("/v2/assignments",assignment)
    index.use("/v2/assignments",submission)
    index.all("*",(req,res,next)=>{
        res.status(404).send();
    })
}

