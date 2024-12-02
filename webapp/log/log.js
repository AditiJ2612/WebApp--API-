const { createLogger, transports, format} = require('winston');

const logForAssignment = createLogger({
    transports: [
        new transports.File({
            filename: 'logDetails.log',
            level: 'info',
            format: format.combine(format.timestamp(),format.json())
        }),
    ]
})

module.exports = {logForAssignment}