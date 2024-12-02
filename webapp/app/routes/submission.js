const submissionController = require('../controller/submission');
const submissionRoute = require('express').Router();

submissionRoute.post('/:id/submission', submissionController.submitAssignment);

module.exports = submissionRoute;