const { Sequelize } = require("sequelize");

module.exports = (Sequelize, DataTypes) => {
    const submission = Sequelize.define("submission", {
        // userid: {
        //     type: DataTypes.UUID,
        //     primaryKey: true,
        //     defaultValue: DataTypes.UUIDV4
        // },
        assignment_id: {
            type: DataTypes.UUID,
            // allowNull: false,
            // references: {
            //     model: "assignments",
            //     key: "id"
            // }
        },
        submission_url: {
            type: DataTypes.STRING,
            allowNull: false
        },
        submission_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        submission_updated: {
            type: DataTypes.DATE
        },

        userId: {
            type: DataTypes.STRING
        }

        // submission_attempts: {
        //     type: DataTypes.INTEGER,
        //     defaultValue: 0 // Default value for the column
        // }
    });
    return submission;
};