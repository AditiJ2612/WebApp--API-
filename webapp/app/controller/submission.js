const assignment = require('../model/assignment');
const configureDB = require('../config/configureDB');
const user = require('../model/user');
const db = require('../model/model');
const bcrypt = require('bcrypt');
const log = require('../../log/log');
const {publishMessage} = require('../model/awssns');
const Assignment = require('../model/model').assignments
const User = require('../model/model').users;

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
    console.log("Email", username);
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
};

const submitAssignment = async (req, res) => {
    try {
        const header = req.get('Authorization');
        const token = header.split(' ')[1];
        const cred = Buffer.from(token, 'base64').toString('utf-8');
        const [username, password] = cred.split(':');
        const { id: assignmentId } = req.params;
        const submissionUrl = req.body.submission_url;

        console.log("ASS", assignmentId);
        console.log("SUB", submissionUrl);
        // const userSchema = req.users ;
        // console.log(userSchema);

        // Check if the submission_url property is present in req.body and is not empty
        if (!submissionUrl && Object.keys(req.body).length === 0) {
            log.logForAssignment.log("error", "Submission URL is required");
            return res.status(400).json({ error: 'Submission URL is required' });
        }

        // Validate submissionUrl existence
        if (!submissionUrl) {
            log.logForAssignment.log("error", "Submission URL is required");
            return res.status(400).json({ error: 'Submission URL is required' });
        }

        // Authorization check
        const user = await authorization(req, res);

        if (user === 'No Auth') {
            log.logForAssignment.log("error", "No Auth Header");
            return res.status(401).json({ error: 'No Auth Header' });
        } else if (user === 'Not User' || user === 'Incorrect password') {
            log.logForAssignment.log("error", "Invalid credentials");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Validate URL format
        const zipExtensionCheck = /.zip$/i; 
        const spaceCheck = /\s/; 

        if (!zipExtensionCheck.test(submissionUrl) || spaceCheck.test(submissionUrl)) {
            log.logForAssignment.log("error", "Invalid URL format");
            return res.status(400).json({ error: 'Invalid URL format. Must end with .zip and contain no spaces' });
        }
      
        // Check if the assignment exists
        const assignment = await db.assignments.findByPk(assignmentId);
        if (!assignment) {
            log.logForAssignment.log("error", "Assignment not found");
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Check if the due date for the assignment has passed
        if (new Date(assignment.deadline) < new Date()) {
            log.logForAssignment.log("error", "Assignment deadline is passed");
            return res.status(400).json({ error: 'Assignment deadline has passed' });
        }

        // // Check if the logged-in user is the creator of the assignment
        // console.log(assignment.userId);
        // console.log(user);
        // if (assignment.userId != user) {
        //     log.logForAssignment.log("error","User is forbidden");
        //     return res.status(403).json({ error: 'Forbidden: User did not create this assignment' });
        // }

        // const existingSubmission = await db.submissions.findOne({
        //     where: {
        //         assignment_id: assignmentId,
        //     },
        // });

        // // Check if the submission attempts exceed the allowed number before updating
        // if (existingSubmission && existingSubmission.submission_attempts >= assignment.num_of_attempts) {
        //     log.logForAssignment.log("error","Max Attempts reached");
        //     return res.status(400).json({ error: 'Exceeded maximum attempts' });
        // }

        // if (existingSubmission) {
        //     // // Update existing submission
        //     // const updatedSubmission = await db.submissions.findByPk(existingSubmission.id);

        //     await db.submissions.update(
        //         {
        //             submission_url: submissionUrl,
        //             submission_date: new Date(),
        //             submission_updated: new Date(),
        //             submission_attempts: db.sequelize.literal('submission_attempts + 1'),
        //         },
        //         {
        //             where: {
        //                 assignment_id: assignmentId,
        //             },
        //         }
        //     );
        //     log.logForAssignment.log("info","submission updated");
        //     return res.status(200).json({ message: 'Submission updated successfully' });
        // }

        // Check if the user has exceeded the number of attempts allowed
        const submissionsCount = await db.submissions.count({
            where: {
                assignment_id: assignmentId,
                userId: user,
            },
        });

        if (submissionsCount >= assignment.num_of_attempts) {
            log.logForAssignment.log("error", "Max attempts");
            return res.status(400).json({ error: 'Exceeded maximum attempts' });
        }

        // Create the submission associated with the specific assignment ID
        const submissionDate = new Date(); // Generate the submission date
        await db.submissions.create({
            assignment_id: assignmentId,
            submission_url: submissionUrl,
            submission_date: submissionDate,
            submission_updated: submissionDate,
            userId: user,
            submission_attempts: 1,
        });
        log.logForAssignment.log("error", "submitted assignment");

        const topicArn = configureDB.TOPIC_ARN;
        const message = `${username},${submissionUrl}`;
        console.log(message);

        try {
            console.log("inside try of sns");
            const messageId = await publishMessage(topicArn, message);
            console.log("inside publishMsg of sns");
            // logger.assignmentLogger.log('success', 'Message published to SNS');
        } catch (error) {
            console.error('Error publishing message to SNS:', error);
            // logger.assignmentLogger.log('error', `Error publishing message to SNS: ${error}`);
        }
        return res.status(201).json({ message: 'Submission successful' });
    } catch (error) {
        console.error(error);
        log.logForAssignment.log("error", "server error");
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    submitAssignment,
};
