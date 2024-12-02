const stats = require('node-statsd');

const user = new stats({
    host: '127.0.0.1',
    port: 8125,
});

const getcount = () =>{
    return (req,res,next) => {
        const url = `api.${req.method.toLowerCase()}.${req.originalUrl}`;
        console.log(url);
        user.increment(url);
        next();
    };
};

module.exports = getcount;