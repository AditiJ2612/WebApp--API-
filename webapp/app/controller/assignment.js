const { request } = require('express');
const { sequelize } = require('../model/model');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const log = require('../../log/log');
const submission = require('../model/submission');
const SubmissionModel = require('../model/model').submissions;

// creating main model
const Assignment = require('../model/model').assignments
const User = require('../model/model').users

function isValidDateTime(dateTimeString) {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/; // format is YYYY-MM-DD HH:MM:SS
    if (!regex.test(dateTimeString)) return false;
    const dateTimeParts = dateTimeString.split(" ");
    const dateParts = dateTimeParts[0].split("-");
    const timeParts = dateTimeParts[1].split(":");
    
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const second = parseInt(timeParts[2], 10);
    
    const date = new Date(year, month, day, hour, minute, second);
    
    return (
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day &&
        date.getHours() === hour &&
        date.getMinutes() === minute &&
        date.getSeconds() === second
    );
}


// function isValidDate(dateString) {
//     const regex = /^\d{4}-\d{2}-\d{2}$/; // date format is YYYY-MM-DD
//     if (!regex.test(dateString)) return false;
//     const dateParts = dateString.split("-");
//     const year = parseInt(dateParts[0]);
//     const month = parseInt(dateParts[1], 10) - 1;
//     const day = parseInt(dateParts[2], 10);
//     const date = new Date(year, month, day);
//     return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
// }

//user authorization
const authorization = async (req, res) => {
    console.log(req.headers);
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return 'No Auth';
        // return res.status(401).json({ error: 'Authorization header missing' });
    }


    const token = authHeader.split(' ')[1];
    const credentials = Buffer.from(token, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    try {
        const user = await User.findOne({ where: { email: username } }); //find the specific useremail
        console.log('Entered try block of authorisation');
        if (!user) {
            return 'Not User';

        }

        const passwordMatch = await bcrypt.compare(password, user.password); //compare both the bcrypt password

        if (!passwordMatch) {
            return 'Incorrect password';

        }
        const base64Token = Buffer.from(username).toString('base64');

        console.log(user.id);
        return user.id;
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}





const addAssignment = async (req, res) => {
    try {
        const user = await authorization(req, res); // Check for authorization

        if (user == 'No Auth') {
            log.logForAssignment.log("error","No auth header");
            return res.status(401).json({ error: 'No Auth Header' });
        }


        else if (user === 'Not User' || user === 'Incorrect password') {
            log.logForAssignment.log("error","invalid credentials");
            return res.status(401).json({ error: 'Invalid credentials' });
        }


        const info = req.body;

        // Define a list of allowed parameters
        const allowedParameters = ['name', 'points', 'num_of_attempts', 'deadline'];

        // Check if there are any extra parameters in the request body
        const extraParameters = Object.keys(info).filter(
            param => !allowedParameters.includes(param)
        );

        if (extraParameters.length > 0) {
            log.logForAssignment.log('error','extra parameters not allowed');
            return res.status(400).json({ error: `Extra parameters not allowed`});
        }

        if(!isNaN(info.name)){
            log.logForAssignment.log('error','Invalid name parameter. Name should not be a number.');
            return res.status(400).json({ error: 'Invalid name parameter. Name should not be a number.' });
        }

        if (!info.name || !info.points || !info.num_of_attempts || !info.deadline) {
            log.logForAssignment.log('error','Missing required parameters in the request body');
            return res.status(400).json({ error: 'Missing required parameters in the request body' });
        }

        if (!isValidDateTime(info.deadline)) {
            log.logForAssignment.log('error','Deadline must be a valid date');
            return res.status(400).json({ error: 'Deadline must be a valid date' });
        }

        info.userId = user; // Assuming user contains the email address
        console.log(info.userId);

        //checking for query parameters:
        if (Object.keys(req.query).length > 0) {
            log.logForAssignment.log('error','query parameters is not allowed.');
            return res.status(400).json({ error: 'query parameters is not allowed.' })
        }

        if (!Number.isInteger(info.points)) {
            log.logForAssignment.log('error','Points must be an integer');
            return res.status(400).json({ error: 'Points must be an integer' });
        }

        // Bad Request error
        if (info.points < 1 || info.points > 10) {
            log.logForAssignment.log('error','Points must be between 1 and 10');
            return res.status(400).json({ error: 'Points must be between 1 and 10' });

        }
        if (info.num_of_attempts < 1 || info.num_of_attempts > 3) {
            log.logForAssignment.log('error','Number of attempts must be between 1 and 3');
            return res.status(400).json({ error: 'Number of attempts must be between 1 and 3' });

        }

        const assignment = await Assignment.create(info);
        res.status(201).send(assignment);
        log.logForAssignment.log("info","successfully created assignment");
    } catch (error) {
        console.error('Error adding assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
    // let info = {
    //             name: req.body.name,
    //             points: req.body.points,
    //             num_of_attempts: req.body.num_of_attempts,
    //             deadline: req.body.deadline,
    //         }

    //         const assignment = await Assignment.create(info)
    //         res.status(200).send(assignment)
}
// get all assignments

const getAllAssignments = async (req, res) => {
    try {
        const user = await authorization(req, res);

        if (user == 'No Auth') {
            return res.status(401).json({ error: 'No Auth Header' });
        }

        else if (user === 'Not User' || user === 'Incorrect password') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        //checking for query parameters:
        if (Object.keys(req.query).length > 0) {
            log.logForAssignment.log('error','query parameters is not allowed.');
            return res.status(400).json({ error: 'query parameters is not allowed.' })
        }

        let assignments = await Assignment.findAll({})
        res.status(200).send(assignments)
        log.logForAssignment.log('info','getallassignmentssuccessfull');
    } catch (error) {
        console.error('Error retrieving assignments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }


}

//get single assignment
const getOneAssignment = async (req, res) => {
    let id = req.params.id
    try {
        const user = await authorization(req, res);

        if (user === 'Not User' || user === 'Incorrect password') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        //checking for query parameters:
        if (Object.keys(req.query).length > 0) {
            log.logForAssignment.log('error','query parameters is not allowed.');
            return res.status(400).json({ error: 'query parameters is not allowed.' })
        }

        // //check whether the id is present in the database or not.
        // if (!checkAssignmentExists(id, id)) {
        //     return res.status(404).json({ error: 'Assignment not found' });
        // }

        const assignmentExists = await Assignment.findOne({ where: { id } });
        if (!assignmentExists) {
            log.logForAssignment.log('error','Assignment not found');
            return res.status(404).json({ message: 'Assignment not found' });
        }

        let assignment = await Assignment.findOne({ where: { id, userId: user } })
        if (!assignment) {
            log.logForAssignment.log('error','User is forbidden');
            return res.status(403).json({ error: 'User is forbidden' });
        }
        res.status(200).send(assignment)
        log.logForAssignment.log('info','getoneassignment');
    } catch (error) {
        console.error('Error retrieving assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }


}

//update assignment

const updateAssignment = async (req, res) => {
    let id = req.params.id;
    let updatedData = req.body;

    try {
        // Authorize the user
        const user = await authorization(req, res);

        if (user == 'No Auth') {
            return res.status(401).json({ error: 'No Auth Header' });
        }

        else if (user === 'Not User' || user === 'Incorrect password') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Define a list of allowed parameters
        const allowedParameters = ['name', 'points', 'num_of_attempts', 'deadline'];

        // Check if there are any extra parameters in the request body
        const extraParameters = Object.keys(updatedData).filter(
            param => !allowedParameters.includes(param)
        );

        if (extraParameters.length > 0) {
            log.logForAssignment.log('error','Extra parameters not allowed');
            return res.status(400).json({ error: `Extra parameters not allowed`});
        }

        if(!isNaN(updatedData.name)){
            log.logForAssignment.log('error','Invalid name parameter. Name should not be a number.');
            return res.status(400).json({ error: 'Invalid name parameter. Name should not be a number.' });
        }

        //checking if all the parameters are there or not 
        if (!updatedData.name || !updatedData.points || !updatedData.num_of_attempts || !updatedData.deadline) {
            log.logForAssignment.log('error','Missing required parameters in the request body');
            return res.status(400).json({ error: 'Missing required parameters in the request body' });
        }

        if (!isValidDateTime(req.body.deadline)) {
            log.logForAssignment.log('error','Deadline must be a valid date');
            return res.status(400).json({ error: 'Deadline must be a valid date' });
        }

        //checking for query parameters:
        if (Object.keys(req.query).length > 0) {
            log.logForAssignment.log('error','query parameters is not allowed.');
            return res.status(400).json({ error: 'query parameters is not allowed.' })
        }

        //check whether the assignment is there or not in the database.
        const assignmentExists = await Assignment.findOne({ where: { id } });
        if (!assignmentExists) {
            log.logForAssignment.log('error','Assignment not found');
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Check if 'points' and 'num_of_attempts' are within valid ranges
        const points = req.body.points;
        const num_of_attempts = req.body.num_of_attempts;

        if (!Number.isInteger(points)) {
            log.logForAssignment.log('error','Points must be an integer');
            return res.status(400).json({ error: 'Points must be an integer' });
        }

        if (points < 1 || points > 10 || num_of_attempts < 1 || num_of_attempts > 3) {
            log.logForAssignment.log('error','Points must be between 1 and 10, and number of attempts must be between 1 and 3');
            return res.status(400).json({
                error: 'Points must be between 1 and 10, and number of attempts must be between 1 and 3'
            });
        }

        // Check if the assignment with the provided ID and user exists
        const assignment = await Assignment.findOne({ where: { id, userId: user } });

        if (!assignment) {
            log.logForAssignment.log('error','user is forbidden');
            return res.status(403).json({ error: 'user is forbidden' });
        }

        // Update the assignment with the provided data
        const updatedAssignment = await Assignment.update(updatedData, { where: { id, userId: user } });

        if (!updatedAssignment) {
            log.logForAssignment.log('error','Failed to update assignment');
            return res.status(500).json({ error: 'Failed to update assignment' });
        }

        res.status(204).send({ message: 'Updated successfully' });
        log.logForAssignment.log('info','Updated successfully');

    } catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};




//delete assignment
const deleteAssignment = async (req, res) => {
    let id = req.params.id
    try {
        const user = await authorization(req, res);

        if (user === 'Not User' || user === 'Incorrect password') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        //checking for query parameters:
        if (Object.keys(req.query).length > 0) {
            log.logForAssignment.log('error','query parameters is not allowed.');
            return res.status(400).json({ error: 'query parameters is not allowed.' })
        }

        //check whether the assignment is there or not in the database.
        const assignmentExists = await Assignment.findOne({ where: { id } });
        if (!assignmentExists) {
            log.logForAssignment.log('error','Assignment not found');
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Delete associated submissions first
        await SubmissionModel.destroy({ where: { assignment_id: id } });

        let deleteAssignment = await Assignment.destroy({ where: { id, userId: user } });
        if (!deleteAssignment) {
            log.logForAssignment.log('error','user is forbidden');
            return res.status(403).json({ error: 'user is forbidden' });
        }
        res.status(204).json({ message: 'assignment deleted successfully' })
        log.logForAssignment.log('info','assignment deleted successfully');

    } catch (error) {
        console.error('Error retrieving assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }



}




module.exports = {
    addAssignment,
    getAllAssignments,
    getOneAssignment,
    updateAssignment,
    deleteAssignment
}