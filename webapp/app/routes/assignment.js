const controller = require('../controller/assignment');

const router = require('express').Router();



router.post('/',controller.addAssignment);
router.get('/',controller.getAllAssignments);

//require ID for access 
router.get('/:id',controller.getOneAssignment);
router.put('/:id',controller.updateAssignment);
router.delete('/:id',controller.deleteAssignment);

module.exports = router