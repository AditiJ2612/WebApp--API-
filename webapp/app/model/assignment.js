// const { assignments } = require(".");

// const { assignments } = require("./assignment");



module.exports = (sequelize,DataTypes) =>{
    const assignment = sequelize.define("assignment",{
        id:{
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue:DataTypes.UUIDV4
            
        },
        name:{
            type:DataTypes.STRING,
            allowNull: false
        },
        points: {
            type: DataTypes.INTEGER,
            allowNull: false,
            // validate: {
            //   isPointsValid: function (value) {
            //     if (value < 1 || value > 10) {
            //       throw new Error('Points must be between 1 and 10');
            //     }
            //   }
            // }
        },
        // points: {
        //     type:DataTypes.INTEGER,
        //     allowNull: false
        //     validate:{
        //         isPointsValid(value) {
        //             if(value<1 || value >10){
        //                 throw new Error('points must be between 1 -10');
        //             }
        //         }
        //     }
        // },
        num_of_attempts: {
            type:DataTypes.INTEGER,
            allowNull:false
        },
        deadline:{
            type:DataTypes.DATE,
            allowNull:false
        },
        userId: {
            type: DataTypes.STRING
        }
    });

    return assignment
}