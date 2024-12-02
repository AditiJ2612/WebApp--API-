const dbget = require('../model/model');

//checks if the server is available and response accordingly.
const getData = async (req,res)=>{
    dbget.sequelize.authenticate().then(() => {  
        res.status(200).send();
    }).catch(err => {
        res.status(503).send()
    })
}

module.exports = {getData}